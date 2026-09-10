// Load-bearing default-CI contract for the #4000/#4128/#4155 Public Browse
// Summary direct-Neon Production gate.
//
// `LB_BROWSE_SUMMARY_READ_RUNTIME = "direct_neon"` is checked into
// `[env.production.vars]`, so Production Product Browse traffic is served by
// the direct-Neon adapter, not Modal. Before this test the only scenario
// coverage lived in `scripts/check-public-browse-summary-product-4128.mjs`,
// which no package.json script, `scripts/pre-deploy.cjs` check, or workflow
// invokes, and no file under `tests/**` executed the adapter at all. This test
// makes the gate, the credential boundary, the read-only SQL boundary, and the
// Modal-fallback ownership provable inside `npm test` / `verify-static`.
//
// Everything runs in-process against an injected fake executor with a network
// tripwire installed, so no Production connection is ever opened and no real
// Product row is ever read.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HELPER_MODULE = '../../functions/_shared/public-browse-summary-direct-neon.js';
const CORE_MODULE = '../../functions/_shared/direct-neon-browse-summary-core.js';
const ROUTE_MODULE = '../../functions/api/community/trees.js';
const CATCH_ALL_MODULE = '../../functions/api/[[path]].js';
const WRANGLER_PATH = path.resolve(REPO_ROOT, 'wrangler.toml');
const MATRIX_PATH = path.resolve(REPO_ROOT, 'docs', 'architecture', 'direct-neon-readiness-matrix-4311.json');

const GATE = 'LB_BROWSE_SUMMARY_READ_RUNTIME';
const DATABASE_ENV = 'LOVE_PLATFORM_DATABASE_URL';
const DIRECT_VALUE = 'direct_neon';

const READ_URL = 'postgresql://ep-browse-contract.us-east-1.neon.tech/neondb?sslmode=require';
const WRITE_URL = 'postgresql://ep-browse-writer.us-east-2.neon.tech/neondb?sslmode=require';
const NON_NEON_URL = 'postgresql://ep-browse-replica.aws.internal:5432/neondb';

const SYNTHETIC_TREE_ID = '00000000-0000-4000-8000-000000000040';
const SYNTHETIC_ROW = Object.freeze({
  id: SYNTHETIC_TREE_ID,
  title: 'contract tree',
  visibility: 'public',
  created_at: '2026-07-01 12:34:56.123456+00',
  updated_at: '2026-07-02 00:00:00+00',
  memory_count: 4,
  all_tags: ['["기쁨"]'],
  like_count: 7,
  view_count: 11,
  raw_thumbnail: '',
  raw_source_url: 'https://example.invalid/thumb.jpg'
});

const CAPABILITY_ROW = {
  has_social_counts_table: true,
  has_like_count_column: true,
  has_view_count_column: true
};

const FETCH_CALLS = [];
const ORIGINAL_FETCH = globalThis.fetch;
globalThis.fetch = (...args) => {
  const target = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
  FETCH_CALLS.push(String(target));
  return Promise.reject(new Error('BROWSE_SUMMARY_CONTRACT_NETWORK_BLOCKED'));
};
test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

const NEON_TARGET_ATTEMPTS = () => FETCH_CALLS.filter((url) => /neon\.tech/i.test(url));
const MODAL_TARGET_ATTEMPTS = () => FETCH_CALLS.filter((url) => /modal\.invalid/i.test(url));

const WRITE_STATEMENT = /^\s*(INSERT|UPDATE|DELETE|MERGE|ALTER|TRUNCATE|DROP|CREATE|GRANT|REVOKE|COPY|VACUUM|ANALYZE|REFRESH|REINDEX|CLUSTER|LOCK|CALL|DO|PREPARE|EXECUTE|DEALLOCATE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|SET)\b/i;
const WRITE_VERB = /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|TRUNCATE|DROP|GRANT|REVOKE)\b/i;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\/[^'"\n]*$/gm, '');
}

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(REPO_ROOT, relativePath), 'utf8');
}

function wranglerSectionVars(sectionHeader) {
  const lines = fs.readFileSync(WRANGLER_PATH, 'utf8').split(/\r?\n/);
  const vars = {};
  let active = false;
  for (const line of lines) {
    const header = line.trim();
    if (/^\[.*\]$/.test(header)) {
      active = header === `[${sectionHeader}]`;
      continue;
    }
    if (!active) continue;
    const match = header.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function makeBrowseRequest({ query = '', method = 'GET' } = {}) {
  return new Request(`https://lovebud.pages.dev/api/community/trees${query}`, {
    method,
    headers: new Headers()
  });
}

function makeExecutor({ capabilities = CAPABILITY_ROW, rows = [SYNTHETIC_ROW], throws = false } = {}) {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values: Array.isArray(values) ? [...values] : values });
    if (throws) throw new Error('browse executor down');
    if (text.includes('information_schema.tables')) return [capabilities];
    return rows;
  };
  return { calls, executor };
}

function summaryQueryFor(core, { sort, capabilities }) {
  return core.buildDirectNeonBrowseSummaryQuery({ sort, limit: 12, capabilities });
}

const ALL_CAPABILITY_COMBOS = (() => {
  const flags = [true, false];
  const combos = [];
  for (const hasSocialCountsTable of flags) {
    for (const hasLikeCountColumn of flags) {
      for (const hasViewCountColumn of flags) {
        combos.push({ hasSocialCountsTable, hasLikeCountColumn, hasViewCountColumn });
      }
    }
  }
  return combos;
})();

// ─── A. import purity ──────────────────────────────────────────────────────

test('A1. helper/core/route import performs no network, DB, or env-secret access', async () => {
  const helper = await import(HELPER_MODULE);
  const core = await import(CORE_MODULE);
  await import(ROUTE_MODULE);
  assert.equal(typeof helper.handlePublicBrowseSummaryDirectNeon, 'function');
  assert.equal(typeof helper.isPublicBrowseSummaryDirectNeonSelected, 'function');
  assert.equal(typeof helper.isPublicBrowseSummaryRequest, 'function');
  assert.equal(typeof helper.readBrowseSummaryDirectConfig, 'function');
  assert.equal(typeof helper.createPublicBrowseSummaryDirectExecutor, 'function');
  assert.equal(typeof helper.normalizeProductBrowseLimit, 'function');
  assert.equal(typeof core.fetchDirectNeonBrowseSummary, 'function');
  assert.equal(FETCH_CALLS.length, 0, 'import opened no HTTP connection');
});

test('A2. runtime env identity is frozen and an injected executor never reaches the Neon driver', async () => {
  const helper = await import(HELPER_MODULE);
  assert.equal(Object.isFrozen(helper.BROWSE_SUMMARY_RUNTIME_ENV), true);
  assert.deepEqual({ ...helper.BROWSE_SUMMARY_RUNTIME_ENV }, {
    GATE_FLAG: GATE,
    DIRECT_NEON_VALUE: DIRECT_VALUE,
    DATABASE_URL: DATABASE_ENV
  });
  assert.equal(Object.isFrozen(helper.BROWSE_SUMMARY_DIRECT_NEON_CONTRACT), true);
  assert.equal(helper.BROWSE_SUMMARY_DIRECT_NEON_CONTRACT.writes, false);
  assert.equal(helper.BROWSE_SUMMARY_DIRECT_NEON_CONTRACT.defaultRuntime, 'modal');
  assert.equal(helper.BROWSE_SUMMARY_DIRECT_NEON_CONTRACT.path, '/api/community/trees?view=summary');

  const fake = async () => [];
  const injected = await helper.createPublicBrowseSummaryDirectExecutor({
    connectionString: 'not-even-a-url',
    executor: fake
  });
  assert.equal(injected, fake, 'injected executor short-circuits driver construction');
  await assert.rejects(
    () => helper.createPublicBrowseSummaryDirectExecutor({ connectionString: NON_NEON_URL }),
    /BROWSE_SUMMARY_DIRECT_NEON_CONFIG_INVALID/
  );
  assert.equal(FETCH_CALLS.length, 0);
});

// ─── B. gate selection matrix ──────────────────────────────────────────────

test('B1. only the exact direct_neon value selects the Production gate', async () => {
  const helper = await import(HELPER_MODULE);
  const notSelected = [
    ['{}', {}],
    ['empty string', { [GATE]: '' }],
    ['whitespace only', { [GATE]: '   ' }],
    ['modal', { [GATE]: 'modal' }],
    ['unknown value', { [GATE]: 'neon_direct' }],
    ['wrong case', { [GATE]: 'DIRECT_NEON' }],
    ['substring', { [GATE]: 'direct_neon_extra' }],
    ['non-string number', { [GATE]: 1 }],
    ['non-string null', { [GATE]: null }]
  ];
  for (const [label, env] of notSelected) {
    assert.equal(helper.isPublicBrowseSummaryDirectNeonSelected(env), false, `${label} must not select direct`);
  }
  assert.equal(helper.isPublicBrowseSummaryDirectNeonSelected({ [GATE]: DIRECT_VALUE }), true);
  assert.equal(helper.isPublicBrowseSummaryDirectNeonSelected({ [GATE]: `  ${DIRECT_VALUE}  ` }), true, 'trim parity with Cloudflare vars');
  assert.equal(helper.isPublicBrowseSummaryDirectNeonSelected(), false, 'missing env argument fails closed');
});

test('B2. unselected gate returns null with zero executor calls (Modal path preserved)', async () => {
  const helper = await import(HELPER_MODULE);
  for (const [label, env] of [['unset', {}], ['modal', { [GATE]: 'modal' }], ['unknown', { [GATE]: 'legacy' }]]) {
    const { calls, executor } = makeExecutor();
    const resp = await helper.handlePublicBrowseSummaryDirectNeon(
      makeBrowseRequest({ query: '?view=summary' }),
      env,
      `rid-b2-${label}`,
      { executorOverride: executor }
    );
    assert.equal(resp, null, `${label} gate -> null so the route keeps Modal`);
    assert.equal(calls.length, 0, `${label} gate issued no query`);
  }
});

test('B3. gate selection is scoped to GET /api/community/trees?view=summary only', async () => {
  const helper = await import(HELPER_MODULE);
  const selected = { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL };
  const cases = [
    ['no view param', '/api/community/trees', undefined],
    ['other view', '/api/community/trees?view=list', undefined],
    ['non-summary path', '/api/community/growing-trees?view=summary', undefined],
    ['POST summary read path', '/api/community/trees?view=summary', 'POST']
  ];
  for (const [label, pathname, method] of cases) {
    const request = new Request(`https://lovebud.pages.dev${pathname}`, {
      method: method || 'GET',
      headers: new Headers()
    });
    const { calls, executor } = makeExecutor();
    const resp = await helper.handlePublicBrowseSummaryDirectNeon(request, selected, 'rid-b3', { executorOverride: executor });
    assert.equal(resp, null, `${label} must not be served by the direct adapter`);
    assert.equal(calls.length, 0, `${label} issued no query`);
  }
  assert.equal(helper.isPublicBrowseSummaryRequest(makeBrowseRequest({ query: '?view=summary' })), true);
  const trailingSlash = new Request('https://lovebud.pages.dev/api/community/trees/?view=summary', { method: 'GET', headers: new Headers() });
  assert.equal(helper.isPublicBrowseSummaryRequest(trailingSlash), true, 'trailing slash normalizes onto the summary route');
});

// ─── C. Production configuration contract ─────────────────────────────────

test('C1. Production wrangler gate value matches the adapter constant exactly', async () => {
  const helper = await import(HELPER_MODULE);
  const productionVars = wranglerSectionVars('env.production.vars');
  assert.equal(productionVars[GATE], DIRECT_VALUE, 'Production gate must stay checked in as direct_neon');
  const raw = fs.readFileSync(WRANGLER_PATH, 'utf8');
  const declarations = raw.split(/\r?\n/).filter((line) => line.trim().startsWith(GATE));
  assert.equal(declarations.length, 1, 'the gate is declared exactly once in wrangler.toml');
  assert.equal(declarations[0].trim(), `${GATE} = "${DIRECT_VALUE}"`, 'canonical declaration form');
  assert.equal(productionVars[GATE], helper.BROWSE_SUMMARY_RUNTIME_ENV.DIRECT_NEON_VALUE, 'checked-in value equals the adapter constant');
  assert.equal(helper.isPublicBrowseSummaryDirectNeonSelected(productionVars), true, 'the checked-in Production vars select direct mode');
});

test('C2. non-Production default vars leave the gate unset so Modal stays the default runtime', () => {
  const defaultVars = wranglerSectionVars('vars');
  assert.equal(Object.hasOwn(defaultVars, GATE), false, 'default [vars] must not force direct_neon');
  assert.ok(defaultVars.MODAL_BASE_URL, 'Modal base url remains configured for the default runtime');
});

// ─── D. route/helper delegation ownership ─────────────────────────────────

test('D1. Production gate selected routes the Product Browse read through the direct adapter', async () => {
  const route = await import(ROUTE_MODULE);
  const before = FETCH_CALLS.length;
  const resp = await route.onRequest({
    request: makeBrowseRequest({ query: '?view=summary' }),
    env: { [GATE]: DIRECT_VALUE, MODAL_BASE_URL: 'https://modal.invalid' }
  });
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon', 'route delegated to the adapter');
  assert.equal(resp.status, 503, 'credential absent fails closed instead of falling back to Modal');
  assert.equal((await resp.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(FETCH_CALLS.length, before, 'a selected direct gate never reaches the Modal upstream');
});

test('D2. unselected gate keeps the Modal proxy path', async () => {
  const route = await import(ROUTE_MODULE);
  for (const [label, env] of [['unset', {}], ['modal', { [GATE]: 'modal' }], ['unknown', { [GATE]: 'shadow' }]]) {
    const resp = await route.onRequest({
      request: makeBrowseRequest({ query: '?view=summary' }),
      env
    });
    assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal', `${label} gate -> Modal path`);
    assert.notEqual(resp.headers.get('x-lovebud-runtime'), DIRECT_VALUE, `${label} gate never reports direct runtime`);
    assert.equal(NEON_TARGET_ATTEMPTS().length, 0, `${label} gate never contacted a Neon endpoint`);
  }
});

test('D2b. Modal fallback stays live and owns the request when the gate is unselected', async () => {
  const route = await import(ROUTE_MODULE);
  const before = FETCH_CALLS.length;
  const resp = await route.onRequest({
    request: makeBrowseRequest({ query: '?view=summary&limit=9' }),
    env: { MODAL_BASE_URL: 'https://modal.invalid' }
  });
  const attempted = FETCH_CALLS.slice(before);
  assert.equal(attempted.length, 1, 'the Modal upstream is actually dispatched');
  assert.deepEqual(MODAL_TARGET_ATTEMPTS(), attempted, 'the only dispatch target is the synthetic Modal host');
  assert.match(attempted[0], /modal\.invalid\/modal\/browse\/latest/);
  assert.match(attempted[0], /limit=9/);
  assert.equal(NEON_TARGET_ATTEMPTS().length, 0, 'no Neon endpoint was contacted on the Modal path');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal');
});

test('D3. adapter delegation is ordered before the Modal fallback and the route stays read-only', async () => {
  const routeSource = readSource('functions/api/community/trees.js');
  const delegateIdx = routeSource.indexOf('handlePublicBrowseSummaryDirectNeon(');
  const modalIdx = routeSource.indexOf('buildModalUrl(request');
  assert.ok(delegateIdx !== -1, 'route imports and calls the direct adapter');
  assert.ok(modalIdx !== -1, 'route still owns the Modal fallback');
  assert.ok(delegateIdx < modalIdx, 'direct adapter runs before the Modal fallback');
  assert.match(routeSource, /import \{ handlePublicBrowseSummaryDirectNeon \} from '\.\.\/\.\.\/_shared\/public-browse-summary-direct-neon\.js';/);

  const route = await import(ROUTE_MODULE);
  const post = await route.onRequest({
    request: makeBrowseRequest({ query: '?view=summary', method: 'POST' }),
    env: { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL }
  });
  assert.equal(post.status, 405, 'Browse summary route exposes no write capability');
});

// ─── E. read-only SQL boundary ─────────────────────────────────────────────

test('E1. every statement executed through the adapter is SELECT-only', async () => {
  const helper = await import(HELPER_MODULE);
  const { calls, executor } = makeExecutor();
  const resp = await helper.handlePublicBrowseSummaryDirectNeon(
    makeBrowseRequest({ query: '?view=summary&limit=5&sort=popular' }),
    { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL },
    'rid-e1',
    { executorOverride: executor }
  );
  assert.equal(resp.status, 200);
  assert.equal(calls.length, 2, 'capability probe then summary read');
  for (const call of calls) {
    assert.match(call.text.trim(), /^SELECT\b/i, `${call.text.slice(0, 24)}... must start with SELECT`);
    assert.equal(WRITE_STATEMENT.test(call.text.trim()), false, 'no write/DDL/transaction statement');
    assert.equal(WRITE_VERB.test(call.text), false, 'no mutation verb anywhere in the statement');
  }
  assert.match(calls[1].text, /FROM trees t/);
  assert.match(calls[1].text, /FROM memories/);
  assert.deepEqual(calls[1].values, [5], 'limit is the only bound parameter');
});

test('E2. all sorts and capability combinations stay read-only, public-only, and parameterized', async () => {
  const core = await import(CORE_MODULE);
  const sorts = ['latest', 'popular', 'likes', 'views', 'bogus', undefined];
  for (const sort of sorts) {
    for (const capabilities of ALL_CAPABILITY_COMBOS) {
      const query = summaryQueryFor(core, { sort, capabilities });
      assert.match(query.text.trim(), /^SELECT\b/i, 'generated statement is a SELECT');
      assert.equal(WRITE_STATEMENT.test(query.text.trim()), false, `no write verb for sort=${sort}`);
      assert.equal(WRITE_VERB.test(query.text), false, `no mutation verb anywhere for sort=${sort}`);
      assert.equal(query.text.match(/\$\d+/g) === null ? 0 : new Set(query.text.match(/\$\d+/g)).size, 1, 'exactly one placeholder');
      assert.match(query.text, /\bLIMIT \$1\s*$/, 'limit is bound, never interpolated');
      assert.deepEqual(query.values, [12]);
      assert.match(query.text, /WHERE t\.visibility = 'public'/, 'public trees only');
      assert.match(query.text, /WHERE visibility = 'public'/, 'public memories only');
      assert.ok(/ORDER BY t\.created_at DESC|ORDER BY c\.memory_count DESC|ORDER BY s\.like_count DESC|ORDER BY s\.view_count DESC/.test(query.text), 'ordering comes from the frozen allowlist');
      if (!capabilities.hasSocialCountsTable || (sort === 'likes' && !capabilities.hasLikeCountColumn) || (sort === 'views' && !capabilities.hasViewCountColumn)) {
        assert.ok(query.effectiveSort === 'latest' || query.text.includes('WHERE FALSE'), 'capability fallback degrades to a safe read');
      }
    }
  }
});

test('E3. the whole direct Browse read path contains no write, DDL, or privilege verb', () => {
  for (const relativePath of [
    'functions/_shared/public-browse-summary-direct-neon.js',
    'functions/_shared/direct-neon-browse-summary-core.js',
    'functions/_shared/direct-neon-browse-transport.js',
    'functions/api/community/trees.js'
  ]) {
    const source = stripComments(readSource(relativePath));
    assert.equal(WRITE_VERB.test(source), false, `${relativePath} must contain no mutation verb`);
  }
});

// ─── F. credential boundary ────────────────────────────────────────────────

test('F1. only the dedicated read credential is honored; no generic, prototype, or writer fallback', async () => {
  const helper = await import(HELPER_MODULE);
  const honored = helper.readBrowseSummaryDirectConfig({ [DATABASE_ENV]: READ_URL });
  assert.equal(honored.configured, true);
  assert.equal(honored.connectionString, READ_URL);
  assert.equal(Object.isFrozen(honored), true, 'descriptor cannot be mutated by callers');

  for (const [label, env] of [
    ['no credential', {}],
    ['generic DATABASE_URL only', { DATABASE_URL: READ_URL }],
    ['legacy NETLIFY_DATABASE_URL only', { NETLIFY_DATABASE_URL: READ_URL }],
    ['prototype DIRECT_NEON_BROWSE_DATABASE_URL only', { DIRECT_NEON_BROWSE_DATABASE_URL: READ_URL }],
    ['writer credential only', { LOVE_PLATFORM_WRITE_DATABASE_URL: WRITE_URL }],
    ['all forbidden credentials', {
      DATABASE_URL: READ_URL,
      NETLIFY_DATABASE_URL: READ_URL,
      DIRECT_NEON_BROWSE_DATABASE_URL: READ_URL,
      LOVE_PLATFORM_WRITE_DATABASE_URL: WRITE_URL
    }]
  ]) {
    const config = helper.readBrowseSummaryDirectConfig(env);
    assert.equal(config.configured, false, `${label} must not configure the direct read path`);
    assert.equal(config.connectionString, '', `${label} must not leak a connection string`);
  }
});

test('F2. non-Neon and malformed endpoints are rejected before any executor is built', async () => {
  const helper = await import(HELPER_MODULE);
  for (const value of [
    NON_NEON_URL,
    WRITE_URL.replace('.neon.tech', '.neon.tech.evil.example'),
    'mysql://ep-browse.neon.tech/db',
    'postgresql:///local-socket',
    'postgresql://notneon.tech/db',
    '   ',
    12345,
    null
  ]) {
    assert.equal(helper.isNeonDatabaseUrl(value), false, `${String(value)} is not a Neon read endpoint`);
  }
  assert.equal(helper.isNeonDatabaseUrl(WRITE_URL), true, 'host shape alone is not the authority; credential name isolation is tested in F1');
  assert.equal(helper.readBrowseSummaryDirectConfig({ [DATABASE_ENV]: NON_NEON_URL }).configured, false);
});

test('F3. selected gate without an authorized read credential fails closed with no Modal fallback', async () => {
  const helper = await import(HELPER_MODULE);
  for (const [label, env] of [
    ['absent credential', { [GATE]: DIRECT_VALUE }],
    ['forbidden writer credential', { [GATE]: DIRECT_VALUE, LOVE_PLATFORM_WRITE_DATABASE_URL: WRITE_URL }],
    ['non-Neon credential', { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: NON_NEON_URL }]
  ]) {
    const { calls, executor } = makeExecutor();
    const resp = await helper.handlePublicBrowseSummaryDirectNeon(
      makeBrowseRequest({ query: '?view=summary' }),
      env,
      `rid-f3-${label.length}`
    );
    assert.equal(resp.status, 503, `${label} -> bounded 503`);
    assert.equal((await resp.clone().json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
    assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon', `${label} never falls back to Modal`);
    assert.equal(calls.length, 0);
    assert.equal(NEON_TARGET_ATTEMPTS().length, 0, `${label} opened no real Neon connection`);
  }
});

test('F4. direct execution failure returns 500 without a blind Modal retry', async () => {
  const helper = await import(HELPER_MODULE);
  const { calls, executor } = makeExecutor({ throws: true });
  const resp = await helper.handlePublicBrowseSummaryDirectNeon(
    makeBrowseRequest({ query: '?view=summary' }),
    { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL },
    'rid-f4',
    { executorOverride: executor }
  );
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_QUERY_FAILED');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(calls.length, 1, 'no retry storm after the first failed read');
  assert.equal(NEON_TARGET_ATTEMPTS().length, 0);
});

// ─── G. Product read semantics and Modal parity ────────────────────────────

test('G1. direct limit coercion matches the Modal buildModalUrl edge coercion for every raw value', async () => {
  const helper = await import(HELPER_MODULE);
  const { buildModalUrl } = await import(CATCH_ALL_MODULE);
  const rawLimits = [null, '', '0', '-1', '1', '7', '12', '50', '60', '61', '999', 'abc', 'Infinity', '-Infinity', '2.5', '007', ' 5 '];
  for (const raw of rawLimits) {
    const query = raw === null ? '?view=summary' : `?view=summary&limit=${encodeURIComponent(raw)}`;
    const modalUrl = buildModalUrl(makeBrowseRequest({ query }), { MODAL_BASE_URL: 'https://modal.invalid' });
    assert.ok(modalUrl, 'Modal browse url still built');
    assert.equal(
      modalUrl.searchParams.get('limit'),
      String(helper.normalizeProductBrowseLimit(raw)),
      `limit parity for raw=${JSON.stringify(raw)}`
    );
  }
});

test('G2. direct 200 response returns the canonical Product Browse DTO with no internal fields', async () => {
  const helper = await import(HELPER_MODULE);
  const { executor } = makeExecutor();
  const resp = await helper.handlePublicBrowseSummaryDirectNeon(
    makeBrowseRequest({ query: '?view=summary&limit=3&sort=likes' }),
    { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL },
    'rid-g2',
    { executorOverride: executor }
  );
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'ok');
  const body = await resp.json();
  assert.equal(Array.isArray(body), true);
  assert.equal(body.length, 1);
  const item = body[0];
  assert.equal(item.id, SYNTHETIC_TREE_ID, 'row content came from the injected fake only');
  assert.equal(item.createdAt, '2026-07-01T12:34:56.123456+00:00', 'microsecond wire parity preserved');
  assert.equal(item.updatedAt, '2026-07-02T00:00:00+00:00');
  assert.equal(item.representativeThumbnail, 'https://example.invalid/thumb.jpg');
  assert.equal(item.memoryCount, 4);
  assert.deepEqual(item.emotionTags, ['기쁨']);
  assert.equal(item.stage, '성장');
  assert.equal(item.likeCount, 7);
  assert.equal(item.viewCount, 11);
  for (const forbidden of ['owner_id', 'ownerId', 'connectionString', 'password', 'raw_thumbnail', 'raw_source_url', 'sql', 'values']) {
    assert.equal(Object.hasOwn(item, forbidden), false, `${forbidden} must never be projected`);
  }
});

test('G3. direct responses are uncacheable and carry the runtime attribution headers', async () => {
  const helper = await import(HELPER_MODULE);
  const { executor } = makeExecutor();
  const resp = await helper.handlePublicBrowseSummaryDirectNeon(
    makeBrowseRequest({ query: '?view=summary' }),
    { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL },
    'rid-g3-attribution',
    { executorOverride: executor }
  );
  assert.equal(resp.headers.get('cache-control'), 'no-store');
  assert.match(resp.headers.get('content-type'), /^application\/json/);
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.headers.get('x-lovebud-runtime'), DIRECT_VALUE);
  assert.equal(resp.headers.get('x-lovebud-request-id'), 'rid-g3-attribution');
  assert.match(resp.headers.get('access-control-expose-headers'), /x-lovebud-request-id/);
});

test('G4. sort selection is allowlisted and capability gaps degrade to the safe ordering', async () => {
  const core = await import(CORE_MODULE);
  assert.equal(core.normalizeBrowseSort('bogus'), 'latest');
  assert.equal(core.normalizeBrowseSort('likes'), 'likes');
  const noCounts = { hasSocialCountsTable: false, hasLikeCountColumn: false, hasViewCountColumn: false };
  for (const sort of ['likes', 'views']) {
    const query = summaryQueryFor(core, { sort, capabilities: noCounts });
    assert.equal(query.effectiveSort, 'latest', `${sort} without social counts falls back`);
    assert.match(query.text, /ORDER BY t\.created_at DESC/);
    assert.match(query.text, /WHERE FALSE/, 'missing social counts source is an empty read-only relation');
  }
  const likesOnly = { hasSocialCountsTable: true, hasLikeCountColumn: true, hasViewCountColumn: false };
  const query = summaryQueryFor(core, { sort: 'likes', capabilities: likesOnly });
  assert.equal(query.effectiveSort, 'likes');
  assert.match(query.text, /0::bigint AS view_count/, 'absent column is projected as a literal zero, never read');
});

// ─── H. matrix regression and Production safety ────────────────────────────

test('H1. #4311 readiness matrix still describes this Production-gated read path with live attestation', () => {
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const vocab = matrix.classification_vocabulary;
  const row = matrix.routes.find((entry) => entry.id === 'browse-summary');
  assert.ok(row, 'browse-summary row present');
  assert.equal(row.source_helper, 'functions/_shared/public-browse-summary-direct-neon.js');
  assert.equal(row.runtime_gate, GATE);
  assert.equal(row.method, 'GET');
  assert.equal(row.family, 'READ');
  assert.equal(row.credential_boundary, 'direct_neon_runtime');
  assert.equal(row.checked_in_gate, 'CHECKED_IN_PRODUCTION_GATE');
  // Production live attestation (CENTRAL accepted 2026-09-11): exactly one target Production GET,
  // HTTP 200, x-lovebud-upstream=direct-neon, x-lovebud-runtime=direct_neon,
  // x-lovebud-route-status=ok, canonical response shape PASS, Modal fallback NO, secret leak NO,
  // retry NO, no remediation required. FUNCTIONAL_LIVE_PROOF=PASS,
  // ACTUAL_TARGET_GET_COUNT=1, ONE_SHOT_PROTOCOL_COMPLIANCE=PASS, bound to main e92de06e.
  // #4155 historical cutover/soak evidence is retained; this is fresh current-main proof.
  assert.equal(row.live_provider_state, 'LIVE_PROVEN_AT_CITED_SHA', 'live provider proven at cited SHA');
  assert.equal(row.live_gate_state, 'LIVE_GATE_VERIFIED', 'live gate verified');
  assert.equal(row.production_live, 'PRODUCTION_LIVE');
  assert.equal(row.privilege_state, 'PRIVILEGE_PROVEN_AT_CITED_SHA');
  assert.equal(row.source_parity, 'PASS_AT_CITED_SHA');
  assert.equal(row.modal_retained_by_design, false);
  // The bounded live evidence must not silently lose the accepted protocol facts.
  assert.ok(row.disposition_note.includes('FUNCTIONAL_LIVE_PROOF=PASS'), 'evidence: functional live proof PASS');
  assert.ok(row.disposition_note.includes('ACTUAL_TARGET_GET_COUNT=1'), 'evidence: exactly one target Production GET');
  assert.ok(row.disposition_note.includes('ONE_SHOT_PROTOCOL_COMPLIANCE=PASS'), 'evidence: one-shot protocol PASS');
  assert.ok(row.disposition_note.includes('HTTP=200'), 'evidence: HTTP 200');
  assert.ok(row.disposition_note.includes('x-lovebud-upstream=direct-neon'), 'evidence: upstream direct-neon');
  assert.ok(row.disposition_note.includes('x-lovebud-runtime=direct_neon'), 'evidence: runtime direct_neon');
  assert.ok(row.disposition_note.includes('x-lovebud-route-status=ok'), 'evidence: route status ok');
  assert.ok(row.disposition_note.includes('response shape=PASS'), 'evidence: canonical response shape PASS');
  assert.ok(row.disposition_note.includes('Modal fallback=NO'), 'evidence: no Modal fallback');
  assert.ok(row.disposition_note.includes('secret leak=NO'), 'evidence: no secret leak');
  assert.ok(row.disposition_note.includes('retry=NO'), 'evidence: no retry');
  assert.ok(row.disposition_note.includes('#4155'), 'evidence: #4155 history retained');
  assert.ok(row.last_exact_head_evidence.ref.includes('FUNCTIONAL_LIVE_PROOF=PASS'), 'evidence ref: functional live proof PASS');
  assert.ok(row.last_exact_head_evidence.ref.includes('ACTUAL_TARGET_GET_COUNT=1'), 'evidence ref: one target Production GET');
  assert.ok(row.last_exact_head_evidence.ref.includes('ONE_SHOT_PROTOCOL_COMPLIANCE=PASS'), 'evidence ref: one-shot protocol PASS');
  assert.equal(row.last_exact_head_evidence.main_sha, 'e92de06eff288f0585e8972bdcf410070b0793a8', 'live evidence bound to attested main SHA');
  assert.ok(row.next_action.includes('monitoring/regression'), 'next_action is monitoring/regression steady state');
  assert.ok(row.next_action.includes('invalidates this live attestation'), 'next_action states the invalidation rule');
  assert.ok(!row.next_action.includes('Fresh live Cloudflare provider read'), 'next_action no longer requests another canary');
  assert.equal(row.diagnostic_execution_authorized, 'NOT_AUTHORIZED');
  assert.ok(vocab.source_state.includes(row.source_state));
  assert.ok(vocab.privilege_state.includes(row.privilege_state));
  assert.ok(vocab.checked_in_gate.includes(row.checked_in_gate));
  assert.deepEqual(row.required_objects, {
    trees: ['SELECT'],
    memories: ['SELECT'],
    tree_social_counts: ['SELECT']
  }, 'the read path needs SELECT only');
  assert.ok(fs.existsSync(path.resolve(REPO_ROOT, row.source_helper)), 'source helper exists on disk');
});

test('H2. this contract opened zero Production connections and read zero real Product rows', async () => {
  await import(HELPER_MODULE);
  await import(CORE_MODULE);
  await import(ROUTE_MODULE);
  assert.equal(NEON_TARGET_ATTEMPTS().length, 0, 'PRODUCTION_CONNECTIONS_OPENED = 0');
  const helper = await import(HELPER_MODULE);
  const { calls, executor } = makeExecutor();
  const resp = await helper.handlePublicBrowseSummaryDirectNeon(
    makeBrowseRequest({ query: '?view=summary' }),
    { [GATE]: DIRECT_VALUE, [DATABASE_ENV]: READ_URL },
    'rid-h2',
    { executorOverride: executor }
  );
  const body = await resp.json();
  assert.deepEqual(body.map((entry) => entry.id), [SYNTHETIC_TREE_ID], 'PRODUCT_ROWS_READ = 0 real rows');
  assert.ok(calls.every((call) => !call.text.includes(READ_URL) && !call.values.includes(READ_URL)), 'no credential material reaches the SQL layer');
  assert.equal(NEON_TARGET_ATTEMPTS().length, 0);
});
