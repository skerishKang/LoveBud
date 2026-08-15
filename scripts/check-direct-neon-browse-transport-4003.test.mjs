import assert from 'node:assert/strict';
import {
  BROWSE_SCHEMA_CAPABILITY_SQL,
  buildDirectNeonBrowseSummaryQuery,
  estimateBrowseStage,
  normalizeBrowseLimit,
  normalizeBrowseSort,
  normalizeDirectNeonBrowseRow,
  parseBrowseEmotionTags,
} from '../functions/_shared/direct-neon-browse-summary-core.js';
import {
  DIRECT_NEON_BROWSE_CONNECTION_SECRET,
  DIRECT_NEON_BROWSE_ENABLED_FLAG,
  createDirectNeonBrowseExecutor,
  fetchBrowseSummaryViaDirectNeon,
  isNeonConnectionString,
  readDirectNeonBrowseConfig,
} from '../functions/_shared/direct-neon-browse-transport.js';
import {
  SEAM_PATH,
  buildDirectNeonBrowseResponse,
  onRequest,
  onRequestGet,
} from '../functions/api/experimental/direct-neon-browse.js';
import {
  buildModalUrl,
} from '../functions/api/[[path]].js';
import fs from 'node:fs';
import path from 'node:path';

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

const NEON_SECRET = 'postgresql://user:pass@ep-cool-123456.us-east-1.neon.tech/neondb?sslmode=require';

// ─────────────────────────────────────────────────────────────────────────────
// B. Transport adapter with injected (mock) executor — no real Neon driver
// ─────────────────────────────────────────────────────────────────────────────

function makeMockExecutor(capabilityRow, dataRows) {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values });
    if (text.includes('information_schema')) return [capabilityRow];
    return dataRows;
  };
  executor.calls = calls;
  return executor;
}

check('transport: injected executor path performs capability + data query without network', async () => {
  const executor = makeMockExecutor(
    { has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true },
    [{
      id: 'tree-x', title: 'X', visibility: 'public', memory_count: 3,
      all_tags: [['warm']], like_count: 1, view_count: 2,
      raw_thumbnail: 'thumb', raw_source_url: 'source',
      created_at: null, updated_at: null,
    }],
  );
  const rows = await fetchBrowseSummaryViaDirectNeon({ executor, sort: 'views', limit: 3 });
  assert.equal(executor.calls.length, 2);
  assert.equal(executor.calls[0].text, BROWSE_SCHEMA_CAPABILITY_SQL);
  assert.deepEqual(executor.calls[1].values, [3]);
  assert.equal(rows[0].id, 'tree-x');
  assert.equal(rows[0].stage, '성장');
});

check('transport: rejects when neither executor nor connectionString provided', async () => {
  await assert.rejects(
    () => fetchBrowseSummaryViaDirectNeon({ sort: 'latest' }),
    /DIRECT_NEON_BROWSE_CONFIG_INVALID/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// D. missing config fail-closed
// ─────────────────────────────────────────────────────────────────────────────

check('config: gate disabled => not enabled/configured', () => {
  const c = readDirectNeonBrowseConfig({});
  assert.equal(c.enabled, false);
  assert.equal(c.configured, false);
  assert.equal(c.connectionString, '');
});

check('config: gate enabled but no secret => enabled, not configured (fail closed)', () => {
  const c = readDirectNeonBrowseConfig({ [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true' });
  assert.equal(c.enabled, true);
  assert.equal(c.configured, false);
});

check('config: gate enabled with non-Neon secret => not configured', () => {
  const c = readDirectNeonBrowseConfig({
    [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true',
    [DIRECT_NEON_BROWSE_CONNECTION_SECRET]: 'postgres://localhost:5432/lovebud',
  });
  assert.equal(c.enabled, true);
  assert.equal(c.configured, false);
});

check('config: gate enabled with valid Neon secret => configured', () => {
  const c = readDirectNeonBrowseConfig({
    [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true',
    [DIRECT_NEON_BROWSE_CONNECTION_SECRET]: NEON_SECRET,
  });
  assert.equal(c.enabled, true);
  assert.equal(c.configured, true);
  assert.equal(c.connectionString, NEON_SECRET);
});

check('config: isNeonConnectionString accepts only Neon-shaped URLs', () => {
  assert.equal(isNeonConnectionString(NEON_SECRET), true);
  assert.equal(isNeonConnectionString('postgres://localhost/lovebud'), false);
  assert.equal(isNeonConnectionString('mysql://x'), false);
  assert.equal(isNeonConnectionString(''), false);
  assert.equal(isNeonConnectionString(null), false);
});

check('transport: invalid connectionString throws sanitized error (no secret leak)', async () => {
  let thrown;
  try {
    await createDirectNeonBrowseExecutor({ connectionString: 'postgres://localhost/lovebud' });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof TypeError);
  assert.match(thrown.message, /DIRECT_NEON_BROWSE_CONFIG_INVALID/);
  assert.doesNotMatch(thrown.message, /lovebud|localhost/);
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Production-unreachable experimental seam
// ─────────────────────────────────────────────────────────────────────────────

check('seam: gate disabled => 404 (unreachable from Production)', async () => {
  const res = await onRequestGet({ request: new Request('https://x.test/api/experimental/direct-neon-browse'), env: {} });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('x-lovebud-route-status'), 'disabled');
});

check('seam: gate enabled but no secret => 503, no DB query', async () => {
  let queried = false;
  const res = await buildDirectNeonBrowseResponse({
    request: new Request('https://x.test/api/experimental/direct-neon-browse?sort=latest&limit=5'),
    env: { [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true' },
    executorOverride: async () => { queried = true; return []; },
  });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('x-lovebud-route-status'), 'config-absent');
  assert.equal(queried, false);
});

check('seam: full wired path returns 200 normalized array via injected executor', async () => {
  const executor = makeMockExecutor(
    { has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true },
    [{
      id: 'tree-y', title: 'Y', visibility: 'public', memory_count: 4,
      all_tags: [['calm', 'joy']], like_count: 7, view_count: 11,
      raw_thumbnail: '', raw_source_url: 'https://example.invalid/v',
      created_at: '2026-08-01T00:00:00+00:00', updated_at: '2026-08-02T00:00:00+00:00',
    }],
  );
  const res = await buildDirectNeonBrowseResponse({
    request: new Request('https://x.test/api/experimental/direct-neon-browse?sort=likes&limit=10'),
    env: { [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true', [DIRECT_NEON_BROWSE_CONNECTION_SECRET]: NEON_SECRET },
    executorOverride: executor,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-lovebud-route-status'), 'ok');
  assert.equal(res.headers.get('x-lovebud-experimental-source'), 'neon-serverless-http');
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body[0].id, 'tree-y');
  assert.equal(body[0].likeCount, 7);
  assert.equal(body[0].viewCount, 11);
  assert.equal(body[0].representativeThumbnail, 'https://example.invalid/v');
  assert.deepEqual(body[0].emotionTags, ['calm', 'joy']);
});

check('seam: non-GET method => 405', async () => {
  const res = await onRequest({
    request: new Request('https://x.test/api/experimental/direct-neon-browse', { method: 'POST' }),
    env: {},
  });
  assert.equal(res.status, 405);
});

check('seam: experimental path is NOT the Production Browse path', () => {
  assert.notEqual(SEAM_PATH, '/api/community/trees');
});

// ─────────────────────────────────────────────────────────────────────────────
// D. all 4 sort parity fixtures (canonical Modal semantics preserved)
// ─────────────────────────────────────────────────────────────────────────────

check('sort latest: canonical created_at DESC', () => {
  const q = buildDirectNeonBrowseSummaryQuery({ sort: 'latest', limit: 12 });
  assert.match(q.text, /ORDER BY t\.created_at DESC/);
  assert.match(q.text, /WHERE t\.visibility = 'public'/);
  assert.match(q.text, /HAVING count\(\*\) >= 3/);
});

check('sort popular: canonical memory_count ordering', () => {
  const q = buildDirectNeonBrowseSummaryQuery({ sort: 'popular', limit: 12 });
  assert.match(q.text, /ORDER BY c\.memory_count DESC, t\.created_at DESC/);
});

check('sort likes: canonical like_count tie-breakers when capability present', () => {
  const q = buildDirectNeonBrowseSummaryQuery({
    sort: 'likes',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: true },
  });
  assert.equal(q.effectiveSort, 'likes');
  assert.match(q.text, /ORDER BY s\.like_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
});

check('sort views: canonical view_count tie-breakers when capability present', () => {
  const q = buildDirectNeonBrowseSummaryQuery({
    sort: 'views',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: true, hasViewCountColumn: true },
  });
  assert.equal(q.effectiveSort, 'views');
  assert.match(q.text, /ORDER BY s\.view_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
});

// ─────────────────────────────────────────────────────────────────────────────
// E. limit boundary parity (1..60 clamp)
// ─────────────────────────────────────────────────────────────────────────────

check('limit: 1..60 clamp parity', () => {
  assert.equal(normalizeBrowseLimit(undefined), 12);
  assert.equal(normalizeBrowseLimit(0), 12);
  assert.equal(normalizeBrowseLimit(-5), 1);
  assert.equal(normalizeBrowseLimit(61), 60);
  assert.equal(normalizeBrowseLimit('7'), 7);
  assert.equal(normalizeBrowseLimit(60), 60);
  assert.equal(normalizeBrowseLimit(1), 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// F. capability fallback (legacy/pre-modern)
// ─────────────────────────────────────────────────────────────────────────────

check('capability fallback: likes falls back to latest when like capability missing', () => {
  const q = buildDirectNeonBrowseSummaryQuery({
    sort: 'likes',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: false },
  });
  assert.equal(q.sort, 'likes');
  assert.equal(q.effectiveSort, 'latest');
  assert.match(q.text, /ORDER BY t\.created_at DESC/);
});

check('capability fallback: views falls back to latest when view capability missing', () => {
  const q = buildDirectNeonBrowseSummaryQuery({
    sort: 'views',
    capabilities: { hasSocialCountsTable: true, hasViewCountColumn: false },
  });
  assert.equal(q.effectiveSort, 'latest');
});

// ─────────────────────────────────────────────────────────────────────────────
// G. timestamp serialization boundary (Python/Modal vs Neon JS driver)
// ─────────────────────────────────────────────────────────────────────────────

check('timestamp: ISO string passes through unchanged', () => {
  const row = normalizeDirectNeonBrowseRow({ id: 't', created_at: '2026-08-01T00:00:00+00:00', memory_count: 3 });
  assert.equal(row.createdAt, '2026-08-01T00:00:00+00:00');
});

check('timestamp: JS Date serialized to ISO (Neon driver boundary)', () => {
  const date = new Date('2026-08-01T00:00:00Z');
  const row = normalizeDirectNeonBrowseRow({ id: 't', created_at: date, memory_count: 3 });
  assert.equal(row.createdAt, date.toISOString());
});

check('timestamp: transport executor returning Date timestamps normalizes consistently', async () => {
  const date = new Date('2026-08-03T12:00:00Z');
  const executor = makeMockExecutor(
    { has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true },
    [{ id: 't', title: 'T', visibility: 'public', memory_count: 3, created_at: date, updated_at: null, all_tags: [], like_count: 0, raw_thumbnail: '', raw_source_url: '' }],
  );
  const rows = await fetchBrowseSummaryViaDirectNeon({ executor, sort: 'latest', limit: 1 });
  assert.equal(rows[0].createdAt, date.toISOString());
});

// ─────────────────────────────────────────────────────────────────────────────
// H. response shape / DTO parity with canonical public Modal Browse contract
// ─────────────────────────────────────────────────────────────────────────────

check('response parity: normalized DTO carries canonical public fields, no private leakage', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 'tree-1', title: 'Example', visibility: 'public',
    created_at: '2026-08-01T00:00:00+00:00', updated_at: '2026-08-02T00:00:00+00:00',
    memory_count: 5, all_tags: [['joy', 'calm'], ['joy', 'hope']],
    like_count: 4, view_count: 9, raw_thumbnail: '', raw_source_url: 'https://example.invalid/video',
  });
  const keys = Object.keys(row).sort();
  const canonicalPublic = ['createdAt','emotionTags','id','likeCount','memoryCount','representativeMemorySourceUrl','representativeThumbnail','stage','theme','timeRange','title','updatedAt','visibility','viewCount'];
  assert.deepEqual(keys, canonicalPublic.sort());
  for (const leak of ['ownerId', 'owner_id', 'email', 'password', 'private', 'secret', 'token']) {
    assert.ok(!keys.includes(leak), `unexpected private key: ${leak}`);
  }
});

check('response parity: direct-Neon output equals canonical Modal-mapped DTO', () => {
  const dbRow = {
    id: 'tree-1', title: 'Example', visibility: 'public',
    created_at: '2026-08-01T00:00:00+00:00', updated_at: '2026-08-02T00:00:00+00:00',
    memory_count: 5, all_tags: [['joy', 'calm'], ['joy', 'hope']],
    like_count: 4, view_count: 9, raw_thumbnail: '', raw_source_url: 'https://example.invalid/video',
  };
  const directNeon = normalizeDirectNeonBrowseRow(dbRow);
  const modalMapped = {
    id: 'tree-1', title: 'Example', visibility: 'public',
    createdAt: '2026-08-01T00:00:00+00:00', updatedAt: '2026-08-02T00:00:00+00:00',
    representativeThumbnail: 'https://example.invalid/video', memoryCount: 5,
    emotionTags: ['calm', 'hope', 'joy'], stage: '최애', theme: 'LoveTree', timeRange: '',
    representativeMemorySourceUrl: 'https://example.invalid/video', likeCount: 4, viewCount: 9,
  };
  assert.deepEqual(directNeon, modalMapped);
});

// ─────────────────────────────────────────────────────────────────────────────
// I. SQL injection impossible (untrusted sort never reaches SQL)
// ─────────────────────────────────────────────────────────────────────────────

check('security: untrusted sort never reaches SQL; static order clause only', () => {
  const malicious = 'views DESC; DROP TABLE trees; --';
  const q = buildDirectNeonBrowseSummaryQuery({ sort: malicious, limit: 5 });
  assert.equal(q.effectiveSort, 'latest');
  assert.doesNotMatch(q.text, /DROP TABLE/i);
  assert.doesNotMatch(q.text, /--/);
  assert.doesNotMatch(q.text, /views DESC/);
  assert.match(q.text, /ORDER BY t\.created_at DESC/);
});

check('security: query never selects owner identity', () => {
  const q = buildDirectNeonBrowseSummaryQuery({ sort: 'latest' });
  assert.doesNotMatch(q.text, /owner_id|ownerId/);
});

// ─────────────────────────────────────────────────────────────────────────────
// J. Production route mapping unchanged contract
// ─────────────────────────────────────────────────────────────────────────────

check('production route: Browse still maps to Modal authority (/modal/browse/latest)', () => {
  const url = new URL('https://x.test/api/community/trees?view=summary&sort=latest&limit=12');
  const modal = buildModalUrl({ url: url.toString(), method: 'GET' }, { MODAL_BASE_URL: 'https://modal.test' });
  assert.equal(modal.pathname, '/modal/browse/latest');
  assert.equal(modal.searchParams.get('sort'), 'latest');
  assert.equal(modal.searchParams.get('limit'), '12');
});

check('production route: catch-all file contains no direct-Neon wiring', () => {
  const file = path.join(process.cwd(), 'functions', 'api', '[[path]].js');
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /direct-neon|DIRECT_NEON_BROWSE|neondatabase/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Supporting parity helpers (consistent with #4012 core contract)
// ─────────────────────────────────────────────────────────────────────────────

check('stage thresholds match canonical browse behavior', () => {
  assert.equal(estimateBrowseStage(0), 'empty');
  assert.equal(estimateBrowseStage(2), '입덕');
  assert.equal(estimateBrowseStage(4), '성장');
  assert.equal(estimateBrowseStage(5), '최애');
});

check('tag parsing deterministic and capped', () => {
  assert.deepEqual(parseBrowseEmotionTags([['z', 'a'], '["m","a"]', null, ['b', 'c', 'd']]), ['a', 'b', 'c', 'd', 'm']);
});

let passed = 0;
for (const [name, fn] of checks) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`DIRECT_NEON_BROWSE_TRANSPORT_4003 PASS ${passed}/${checks.length}`);
