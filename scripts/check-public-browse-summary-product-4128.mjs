import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BROWSE_SUMMARY_RUNTIME_ENV,
  handlePublicBrowseSummaryDirectNeon,
  isPublicBrowseSummaryDirectNeonSelected,
  readBrowseSummaryDirectConfig,
} from '../functions/_shared/public-browse-summary-direct-neon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const routeSource = fs.readFileSync(path.join(root, 'functions/api/community/trees.js'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'functions/_shared/public-browse-summary-direct-neon.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'functions/_shared/direct-neon-browse-summary-core.js'), 'utf8');

const TEST_NEON = 'postgresql://test:test@ep-browse-4128.us-east-1.neon.tech/neondb?sslmode=require';
let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

await check('default/modal/unknown gate does not select direct runtime', async () => {
  assert.equal(isPublicBrowseSummaryDirectNeonSelected({}), false);
  assert.equal(isPublicBrowseSummaryDirectNeonSelected({ LB_BROWSE_SUMMARY_READ_RUNTIME: 'modal' }), false);
  assert.equal(isPublicBrowseSummaryDirectNeonSelected({ LB_BROWSE_SUMMARY_READ_RUNTIME: 'legacy' }), false);
  assert.equal(isPublicBrowseSummaryDirectNeonSelected({ LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon' }), true);
});

await check('only LOVE_PLATFORM_DATABASE_URL satisfies Product direct config', async () => {
  const genericOnly = readBrowseSummaryDirectConfig({
    DATABASE_URL: TEST_NEON,
    NETLIFY_DATABASE_URL: TEST_NEON,
    DIRECT_NEON_BROWSE_DATABASE_URL: TEST_NEON,
  });
  assert.equal(genericOnly.configured, false);
  assert.equal(genericOnly.connectionString, '');

  const dedicated = readBrowseSummaryDirectConfig({ LOVE_PLATFORM_DATABASE_URL: TEST_NEON });
  assert.equal(dedicated.configured, true);
  assert.equal(dedicated.connectionString, TEST_NEON);
  assert.equal(BROWSE_SUMMARY_RUNTIME_ENV.GATE_FLAG, 'LB_BROWSE_SUMMARY_READ_RUNTIME');
  assert.equal(BROWSE_SUMMARY_RUNTIME_ENV.DATABASE_URL, 'LOVE_PLATFORM_DATABASE_URL');
});

await check('direct gate with missing dedicated config fails closed', async () => {
  const req = new Request('https://lovebud.test/api/community/trees?view=summary');
  const res = await handlePublicBrowseSummaryDirectNeon(
    req,
    { LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon', MODAL_BASE_URL: 'https://modal.invalid' },
    'req-4128-config'
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(res.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(res.headers.get('x-lovebud-route-status'), 'config-absent');
  assert.equal(res.headers.get('x-lovebud-request-id'), 'req-4128-config');
  const body = await res.json();
  assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
});

await check('direct route reuses #4003 capability + query core and returns strict DTO', async () => {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values });
    if (calls.length === 1) {
      assert.match(text, /information_schema\.tables/);
      return [{
        has_social_counts_table: true,
        has_like_count_column: true,
        has_view_count_column: true,
      }];
    }
    assert.match(text, /WHERE t\.visibility = 'public'/);
    assert.match(text, /HAVING count\(\*\) >= 3/);
    assert.match(text, /ORDER BY s\.like_count DESC/);
    assert.deepEqual(values, [17]);
    return [{
      id: 'tree-4128',
      title: 'Browse Tree',
      visibility: 'public',
      created_at: '2026-08-01 10:00:00.123456+00',
      updated_at: '2026-08-02 11:30:00.654321+00',
      memory_count: 4,
      all_tags: [['joy'], ['hope', 'joy']],
      like_count: 7,
      view_count: 11,
      raw_thumbnail: 'https://media.invalid/t.jpg',
      raw_source_url: 'https://media.invalid/s',
    }];
  };

  const req = new Request('https://lovebud.test/api/community/trees?view=summary&sort=likes&limit=17');
  const res = await handlePublicBrowseSummaryDirectNeon(
    req,
    { LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon' },
    'req-4128-ok',
    { executorOverride: executor }
  );
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(res.headers.get('x-lovebud-route-status'), 'ok');
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.deepEqual(body[0], {
    id: 'tree-4128',
    title: 'Browse Tree',
    visibility: 'public',
    createdAt: '2026-08-01T10:00:00.123456+00:00',
    updatedAt: '2026-08-02T11:30:00.654321+00:00',
    representativeThumbnail: 'https://media.invalid/t.jpg',
    memoryCount: 4,
    emotionTags: ['hope', 'joy'],
    stage: '성장',
    theme: 'LoveTree',
    timeRange: '',
    representativeMemorySourceUrl: 'https://media.invalid/s',
    likeCount: 7,
    viewCount: 11,
  });
  for (const forbidden of ['ownerId', 'owner_id', 'email', 'authSubject', 'memberId']) {
    assert.equal(Object.hasOwn(body[0], forbidden), false);
  }
});

await check('limit clamp and unknown sort stay owned by #4003 core', async () => {
  let dataCall = null;
  const executor = async (text, values) => {
    if (/information_schema\.tables/.test(text)) {
      return [{
        has_social_counts_table: false,
        has_like_count_column: false,
        has_view_count_column: false,
      }];
    }
    dataCall = { text, values };
    return [];
  };
  const req = new Request('https://lovebud.test/api/community/trees?view=summary&sort=hostile&limit=999');
  const res = await handlePublicBrowseSummaryDirectNeon(
    req,
    { LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon' },
    'req-4128-clamp',
    { executorOverride: executor }
  );
  assert.equal(res.status, 200);
  assert.ok(dataCall);
  assert.deepEqual(dataCall.values, [60]);
  assert.match(dataCall.text, /ORDER BY t\.created_at DESC/);
  assert.doesNotMatch(dataCall.text, /ORDER BY hostile/);
});

await check('fractional in-range limit rejects before any query', async () => {
  let queries = 0;
  const req = new Request('https://lovebud.test/api/community/trees?view=summary&limit=1.5');
  const res = await handlePublicBrowseSummaryDirectNeon(
    req,
    { LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon' },
    'req-4128-fractional',
    { executorOverride: async () => { queries += 1; return []; } }
  );
  assert.equal(res.status, 422);
  assert.equal(queries, 0);
  const body = await res.json();
  assert.equal(body.detail[0].type, 'int_parsing');
  assert.deepEqual(body.detail[0].loc, ['query', 'limit']);
});

await check('query failure is sanitized and never exposes DB details', async () => {
  const req = new Request('https://lovebud.test/api/community/trees?view=summary');
  const res = await handlePublicBrowseSummaryDirectNeon(
    req,
    { LB_BROWSE_SUMMARY_READ_RUNTIME: 'direct_neon' },
    'req-4128-error',
    { executorOverride: async () => { throw new Error(`boom ${TEST_NEON}`); } }
  );
  assert.equal(res.status, 500);
  const raw = await res.text();
  assert.match(raw, /DIRECT_NEON_QUERY_FAILED/);
  assert.doesNotMatch(raw, /postgres|neon\.tech|test:test/i);
});

await check('Product route checks direct candidate before Modal fallback', async () => {
  const directCall = routeSource.indexOf('handlePublicBrowseSummaryDirectNeon');
  const modalCall = routeSource.indexOf('const modalUrl = buildModalUrl');
  assert.ok(directCall >= 0);
  assert.ok(modalCall > directCall);
  assert.match(routeSource, /if \(directResponse\) return directResponse;/);
  assert.match(routeSource, /import \{ handlePublicBrowseSummaryDirectNeon \}/);
});

await check('Product helper contains no generic/experimental env fallback and core owns SQL', async () => {
  assert.match(helperSource, /LOVE_PLATFORM_DATABASE_URL/);
  assert.match(helperSource, /LB_BROWSE_SUMMARY_READ_RUNTIME/);
  assert.doesNotMatch(helperSource, /env\?\.DATABASE_URL|env\?\.NETLIFY_DATABASE_URL/);
  assert.doesNotMatch(helperSource, /DIRECT_NEON_BROWSE_DATABASE_URL/);
  assert.doesNotMatch(helperSource, /SELECT\s+t\.id/i);
  assert.match(coreSource, /HAVING count\(\*\) >= 3/);
  assert.match(coreSource, /tree_social_counts/);
});

console.log(`PUBLIC_BROWSE_SUMMARY_PRODUCT_4128_SELF_CHECK_PASS ${passed}/${passed}`);
