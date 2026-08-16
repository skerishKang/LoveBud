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

check('seam: in-range fractional limit preserves Production 422 boundary and performs zero DB query', async () => {
  let queried = false;
  const res = await buildDirectNeonBrowseResponse({
    request: new Request('https://x.test/api/experimental/direct-neon-browse?sort=latest&limit=1.5'),
    env: {
      [DIRECT_NEON_BROWSE_ENABLED_FLAG]: 'true',
      [DIRECT_NEON_BROWSE_CONNECTION_SECRET]: NEON_SECRET,
    },
    executorOverride: async () => { queried = true; return []; },
  });
  assert.equal(res.status, 422);
  assert.equal(res.headers.get('x-lovebud-route-status'), 'invalid-limit');
  assert.equal(queried, false);

  const modal = buildModalUrl(
    { url: 'https://x.test/api/community/trees?view=summary&sort=latest&limit=1.5', method: 'GET' },
    { MODAL_BASE_URL: 'https://modal.test' },
  );
  assert.equal(modal.searchParams.get('limit'), '1.5');
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

check('timestamp: driver-returned PG-text timestamp normalizes to canonical Modal/Python form', () => {
  const row = normalizeDirectNeonBrowseRow({ id: 't', created_at: '2026-08-01 00:00:00.123456+00', memory_count: 3 });
  assert.equal(row.createdAt, '2026-08-01T00:00:00.123456+00:00');
});

check('timestamp: transport executor returning PG-text timestamps normalizes to canonical Modal/Python form', async () => {
  const executor = makeMockExecutor(
    { has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true },
    [{ id: 't', title: 'T', visibility: 'public', memory_count: 3, created_at: '2026-08-03 12:00:00.123456+00', updated_at: '2026-08-03 12:00:00.654321+00', all_tags: [], like_count: 0, raw_thumbnail: '', raw_source_url: '' }],
  );
  const rows = await fetchBrowseSummaryViaDirectNeon({ executor, sort: 'latest', limit: 1 });
  assert.equal(rows[0].createdAt, '2026-08-03T12:00:00.123456+00:00');
  assert.equal(rows[0].updatedAt, '2026-08-03T12:00:00.654321+00:00');
});

check('timestamp: transport executor returning a JS Date fails closed end-to-end (no fabricated precision)', async () => {
  // End-to-end through the real transport entry point: a JS Date reaching the
  // row normalizer must fail closed rather than being presented as strict
  // microsecond parity. The authoritative ::text path never yields a Date.
  const executor = makeMockExecutor(
    { has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true },
    [{
      id: 't', title: 'T', visibility: 'public', memory_count: 3,
      created_at: new Date('2026-07-01T12:34:56.123Z'),
      updated_at: '2026-07-01 12:34:56.123456+00',
      all_tags: [], like_count: 0, raw_thumbnail: '', raw_source_url: '',
    }],
  );
  let caught;
  try {
    await fetchBrowseSummaryViaDirectNeon({ executor, sort: 'latest', limit: 1 });
    assert.fail('expected JS Date timestamp to fail closed end-to-end');
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof TypeError, 'expected TypeError');
  assert.equal(caught.message, 'DIRECT_NEON_TIMESTAMP_PRECISION_LOST');
  assert.doesNotMatch(caught.message, /\.\d{3,6}\+00:00/);
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

// J2. CURRENT effective Production authority (post-#4052), proven against the
// exact handler file — NOT merely the catch-all file identity.
// After #4052, `/api/community/trees?view=summary` is owned by the exact Pages
// Function `functions/api/community/trees.js`, which reuses `buildModalUrl` and
// sets `Cache-Control: no-store` with NO persistent Cache API body authority.
check('production authority: effective Browse handler is community/trees.js (post-#4052)', () => {
  const file = path.join(process.cwd(), 'functions', 'api', 'community', 'trees.js');
  const src = fs.readFileSync(file, 'utf8');
  // Reuses the canonical mapping rather than reimplementing it.
  assert.match(src, /import\s*{\s*buildModalUrl\s*}\s*from\s*['"]\.\.\/\[\[path\]\]\.js['"]/);
  // Effective route authority: no-store, no persistent Cache API body.
  assert.match(src, /no-store/);
  assert.doesNotMatch(src, /caches\.default/);
  assert.doesNotMatch(src, /cache\.put/);
  assert.doesNotMatch(src, /max-age=420/);
  assert.doesNotMatch(src, /stale-while-revalidate/);
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

// ─────────────────────────────────────────────────────────────────────────────
// K. Real driver API-shape regression (no network)
//
// The previous live Preview benchmark (502 query-failed) proved that
// `@neondatabase/serverless` v1 rejects direct `sql(text, values)` calls and
// requires `sql.query(text, values)` for parameterized queries. The injected
// mock-executor tests above cannot catch that mismatch because they never run
// the real driver. These checks exercise the REAL installed driver with a
// stubbed global fetch (HTTP transport boundary only, zero network) so any
// regression to the wrong invocation shape fails here.
// ─────────────────────────────────────────────────────────────────────────────

check('driver contract: executor invokes real driver via sql.query (fetch-stubbed, no network)', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body });
    return new Response(
      JSON.stringify({
        rows: [[7]],
        fields: [{ name: 'n', dataTypeID: 23, tableOID: 0, columnAttributionNumber: 0 }],
        command: 'SELECT',
        rowCount: 1,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const executor = await createDirectNeonBrowseExecutor({ connectionString: NEON_SECRET });
    // If the transport regressed to `sql(text, values)`, the real driver
    // throws the tagged-template error BEFORE any fetch happens.
    const rows = await executor('SELECT $1::int AS n', [7]);
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].n), 7);
    // Exactly one HTTP round-trip at the driver fetch boundary.
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /neon\.tech\/sql$/);
    const payload = JSON.parse(calls[0].body);
    assert.equal(payload.query, 'SELECT $1::int AS n');
    assert.deepEqual(payload.params, ['7']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

check('driver contract: transport source uses sql.query, never a direct sql(...) invocation', () => {
  const file = path.join(process.cwd(), 'functions', '_shared', 'direct-neon-browse-transport.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.match(src, /sql\.query\(/);
  assert.doesNotMatch(src, /await\s+sql\s*\(/);
});

let passed = 0;
for (const [name, fn] of checks) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`DIRECT_NEON_BROWSE_TRANSPORT_4003 PASS ${passed}/${checks.length}`);