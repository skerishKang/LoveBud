/**
 * Runtime tests: normalizeBrowseTreeRecord, normalizeBrowseMemoryRecord,
 * buildPublicTreeSummaryModels, and _normalizeBrowseViewCount.
 *
 * Restores original camelCase/snake_case schema contracts and adds
 * comprehensive viewCount three-state policy coverage.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const adapterPath = path.join(ROOT, 'js/api/public-tree-adapter.js');
const adapterSrc = fs.readFileSync(adapterPath, 'utf8');

function getInternals() {
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      LoveBudRuntimeFlags: null,
      LoveTreeAuthPolicy: {
        endpointLikelyRequiresAuth: () => false,
        hasConfirmedAuthSession: () => false,
      },
      LoveTreeBaseApiFetch: {
        apiFetch: async () => [],
      },
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    URLSearchParams,
    URL,
  };
  const ctx = vm.createContext(sandbox);
  // postgres-client.js must run first to create __LoveBudApiClientInternals
  // (required by the original camelCase/snake_case record tests)
  const pgSrc = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');
  vm.runInContext(pgSrc, ctx, { filename: 'postgres-client.js' });
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  return ctx;
}

function getAdapter() {
  return getInternals().window.LoveTreePublicTreeAdapter;
}

// ============================================================
// Original contract: camelCase tree record normalizer
// ============================================================

test('browse tree helper normalizes camelCase tree record', () => {
  const I = getInternals().window.__LoveBudApiClientInternals;
  const tree = I.normalizeBrowseTreeRecord({
    id: 't1',
    title: 'Tree',
    visibility: 'public',
    createdAt: '2026-04-20T00:00:00Z',
    ownerId: 'u1',
  });
  assert.equal(tree.id, 't1');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
  assert.equal(tree.ownerId, 'u1');
});

// ============================================================
// Original contract: legacy wrapped snake_case memory record
// ============================================================

test('browse memory helper normalizes legacy wrapped snake_case record', () => {
  const I = getInternals().window.__LoveBudApiClientInternals;
  const memory = I.normalizeBrowseMemoryRecord({
    data: {
      id: 'm1',
      tree_id: 't1',
      created_at: '2026-04-20T00:00:00Z',
      emotion_tags: ['legacy'],
    }
  });
  assert.equal(memory.treeId, 't1');
  assert.equal(memory.createdAt, '2026-04-20T00:00:00Z');
  assert.deepEqual(memory.emotionTags, ['legacy']);
});

// ============================================================
// _normalizeBrowseViewCount — strict validation rules
// ============================================================

// --- ACCEPT ---

test('normalizeViewCount: camelCase positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 3 }), 3);
});

test('normalizeViewCount: snake_case positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ view_count: 5 }), 5);
});

test('normalizeViewCount: camelCase takes priority', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: 7, view_count: 99 }), 7);
});

test('normalizeViewCount: persisted zero', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 0 }), 0);
});

test('normalizeViewCount: numeric string zero', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '0' }), 0);
});

test('normalizeViewCount: numeric string positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '42' }), 42);
});

// --- REJECT ---

test('normalizeViewCount: missing field', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({}), undefined);
});

test('normalizeViewCount: explicit null', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: null }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ view_count: null }), undefined);
});

test('normalizeViewCount: empty string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '' }), undefined);
});

test('normalizeViewCount: whitespace string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '  ' }), undefined);
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '\t\n' }), undefined);
});

test('normalizeViewCount: boolean true/false', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: true }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ viewCount: false }), undefined);
});

test('normalizeViewCount: negative number', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: -1 }), undefined);
});

test('normalizeViewCount: fractional number', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 3.14 }), undefined);
});

test('normalizeViewCount: fractional string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '3.14' }), undefined);
});

test('normalizeViewCount: NaN', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: NaN }), undefined);
});

test('normalizeViewCount: Infinity', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: Infinity }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ viewCount: -Infinity }), undefined);
});

test('normalizeViewCount: array', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: [3] }), undefined);
});

test('normalizeViewCount: object', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: { n: 3 } }), undefined);
});

test('normalizeViewCount: unsafe integer (over MAX_SAFE_INTEGER)', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: Number.MAX_SAFE_INTEGER + 1 }), undefined);
});

test('normalizeViewCount: numeric string with leading zeros', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '01' }), undefined);
});

test('normalizeViewCount: numeric string with leading plus', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '+3' }), undefined);
});

test('normalizeViewCount: raw=null/undefined', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount(null), undefined);
  assert.equal(a._normalizeBrowseViewCount(undefined), undefined);
});

// ============================================================
// normalizeBrowseTreeRecord — viewCount passthrough
// ============================================================

test('normalizeBrowseTreeRecord: preserves camelCase viewCount', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 3 });
  assert.equal(r.viewCount, 3);
});

test('normalizeBrowseTreeRecord: preserves snake_case view_count', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', view_count: 5 });
  assert.equal(r.viewCount, 5);
});

test('normalizeBrowseTreeRecord: persisted zero', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 0 });
  assert.equal(r.viewCount, 0);
});

test('normalizeBrowseTreeRecord: missing viewCount omitted', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public' });
  assert.equal(r.viewCount, undefined);
});

test('normalizeBrowseTreeRecord: null viewCount omitted', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: null });
  assert.equal(r.viewCount, undefined);
});

// ============================================================
// buildPublicTreeSummaryModels
// ============================================================

test('buildPublicTreeSummaryModels: positive/zero/missing three-state', () => {
  const a = getAdapter();
  const trees = [
    { id: 't1', visibility: 'public', viewCount: 3 },
    { id: 't2', visibility: 'public', viewCount: 0 },
    { id: 't3', visibility: 'public' },
  ];
  const r = a.buildPublicTreeSummaryModels(trees);
  assert.equal(r.length, 3);
  assert.equal(r[0].viewCount, 3);
  assert.equal(r[1].viewCount, 0);
  assert.equal(r[2].viewCount, undefined);
});

test('buildPublicTreeSummaryModels: private tree excluded', () => {
  const a = getAdapter();
  const r = a.buildPublicTreeSummaryModels([
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'pub');
  assert.equal(r[0].viewCount, 3);
});

// ============================================================
// #4219 Phase-4 Tree View direct-Neon candidate
// ============================================================

const DIRECT_TREE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DIRECT_TREE_URL = `https://lovebud.pages.dev/api/trees/${DIRECT_TREE_ID}/views`;
const DIRECT_NEON_URL = 'postgresql://ep-tree-view-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const DIRECT_AUTHORITY = Object.freeze({
  actorKey: 'a'.repeat(64),
  actorKind: 'anonymous',
  source: 'public_tree_detail',
});

function directRequest(headers = {}) {
  return new Request(DIRECT_TREE_URL, {
    method: 'POST',
    headers,
  });
}

function makeDirectFakeClient({
  publicTree = true,
  capability = true,
  counted = true,
  viewCount = 4,
  commitUnknown = false,
} = {}) {
  const logs = [];
  class FakeClient {
    async connect() { logs.push({ text: 'CONNECT', values: [] }); }
    async query(text, values = []) {
      logs.push({ text, values: Array.isArray(values) ? [...values] : values });
      if (text === 'BEGIN') return { rows: [] };
      if (text === 'ROLLBACK') return { rows: [] };
      if (text === 'COMMIT') {
        if (commitUnknown) throw new Error('commit transport failure');
        return { rows: [] };
      }
      if (text.includes('FROM trees') && text.includes('FOR SHARE')) {
        return { rows: publicTree ? [{ id: DIRECT_TREE_ID, visibility: 'public' }] : [] };
      }
      if (text.includes('FROM information_schema.tables')) {
        return {
          rows: capability
            ? [{ table_name: 'tree_social_counts' }, { table_name: 'tree_view_dedup_events' }]
            : [],
        };
      }
      if (text.includes('INSERT INTO tree_view_dedup_events')) {
        return { rows: counted ? [{ id: 'event-1' }] : [] };
      }
      if (text.includes('SELECT view_count') && text.includes('tree_social_counts')) {
        return { rows: [{ view_count: viewCount }] };
      }
      return { rows: [] };
    }
    async end() { logs.push({ text: 'END', values: [] }); }
  }
  return { Client: FakeClient, logs };
}

function makeDirectImporter(factory) {
  return async () => ({ Client: factory.Client });
}

test('#4219 gate: unset/modal/unknown stays outside direct-Neon', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  assert.equal(mod.isTreeViewDirectNeonSelected({}), false);
  assert.equal(mod.isTreeViewDirectNeonSelected({ LB_TREE_VIEW_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeViewDirectNeonSelected({ LB_TREE_VIEW_WRITE_RUNTIME: 'unknown' }), false);
  const response = await mod.handleTreeViewDirectNeon(
    directRequest(),
    {},
    'rid-4219-gate',
    DIRECT_AUTHORITY,
    { treeIdOverride: DIRECT_TREE_ID },
  );
  assert.equal(response, null);
});

test('#4219 dedicated writer config forbids generic/read fallback', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const env = {
    LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: DIRECT_NEON_URL,
  };
  assert.equal(mod.readTreeViewWriteConfig(env).configured, false);
  const forbidden = mod.detectForbiddenTreeViewWriterFallback(env);
  assert.ok(forbidden);
  assert.equal(forbidden.name, 'LOVE_PLATFORM_DATABASE_URL');
});

test('#4219 direct fresh view: FOR SHARE precedes dedup and increments exactly once', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const fake = makeDirectFakeClient({ counted: true, viewCount: 4 });
  const response = await mod.handleTreeViewDirectNeon(
    directRequest({ 'x-lovebud-tree-view-actor-key': 'forged-browser-actor' }),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    'rid-4219-fresh',
    DIRECT_AUTHORITY,
    {
      treeIdOverride: DIRECT_TREE_ID,
      neonImporter: makeDirectImporter(fake),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    treeId: DIRECT_TREE_ID,
    counted: true,
    viewCount: 4,
  });
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const forShare = fake.logs.findIndex((row) => row.text.includes('FROM trees') && row.text.includes('FOR SHARE'));
  const ensureCount = fake.logs.findIndex((row) => row.text.includes('INSERT INTO tree_social_counts'));
  const dedup = fake.logs.findIndex((row) => row.text.includes('INSERT INTO tree_view_dedup_events'));
  const increment = fake.logs.findIndex((row) => row.text.includes('view_count = view_count + 1'));
  const reread = fake.logs.findIndex((row) => row.text.includes('SELECT view_count'));
  assert.ok(forShare >= 0 && ensureCount > forShare && dedup > ensureCount && increment > dedup && reread > increment);

  const dedupQuery = fake.logs[dedup];
  assert.equal(dedupQuery.values[2], DIRECT_AUTHORITY.actorKey);
  assert.notEqual(dedupQuery.values[2], 'forged-browser-actor');
  assert.match(dedupQuery.text, /date_trunc\('day', NOW\(\)\)/);
  assert.match(dedupQuery.text, /ON CONFLICT \(tree_id, actor_key, counted_window_start\) DO NOTHING/);
});

test('#4219 direct duplicate view does not increment', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const fake = makeDirectFakeClient({ counted: false, viewCount: 4 });
  const response = await mod.handleTreeViewDirectNeon(
    directRequest(),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    'rid-4219-dedup',
    DIRECT_AUTHORITY,
    {
      treeIdOverride: DIRECT_TREE_ID,
      neonImporter: makeDirectImporter(fake),
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    treeId: DIRECT_TREE_ID,
    counted: false,
    viewCount: 4,
  });
  assert.equal(fake.logs.some((row) => row.text.includes('view_count = view_count + 1')), false);
});

test('#4219 private/missing Tree rolls back before dedup/count mutation', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const fake = makeDirectFakeClient({ publicTree: false });
  const response = await mod.handleTreeViewDirectNeon(
    directRequest(),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    'rid-4219-private',
    DIRECT_AUTHORITY,
    {
      treeIdOverride: DIRECT_TREE_ID,
      neonImporter: makeDirectImporter(fake),
    },
  );
  assert.equal(response.status, 404);
  assert.equal(fake.logs.some((row) => row.text.includes('INSERT INTO tree_view_dedup_events')), false);
  assert.equal(fake.logs.some((row) => row.text === 'ROLLBACK'), true);
});

test('#4219 missing social/dedup capability returns counted=false without mutation', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const fake = makeDirectFakeClient({ capability: false, viewCount: 0 });
  const response = await mod.handleTreeViewDirectNeon(
    directRequest(),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    'rid-4219-capability',
    DIRECT_AUTHORITY,
    {
      treeIdOverride: DIRECT_TREE_ID,
      neonImporter: makeDirectImporter(fake),
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    treeId: DIRECT_TREE_ID,
    counted: false,
    viewCount: 0,
  });
  assert.equal(fake.logs.some((row) => row.text.includes('INSERT INTO tree_social_counts')), false);
  assert.equal(fake.logs.some((row) => row.text.includes('INSERT INTO tree_view_dedup_events')), false);
});

test('#4219 unknown COMMIT outcome is explicit and never followed by rollback/retry', async () => {
  const mod = await import('../../functions/_shared/tree-view-direct-neon.js');
  const fake = makeDirectFakeClient({ counted: true, viewCount: 5, commitUnknown: true });
  const response = await mod.handleTreeViewDirectNeon(
    directRequest(),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    'rid-4219-unknown',
    DIRECT_AUTHORITY,
    {
      treeIdOverride: DIRECT_TREE_ID,
      neonImporter: makeDirectImporter(fake),
    },
  );
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.code, 'COMMIT_OUTCOME_UNKNOWN');
  const commitIndex = fake.logs.findIndex((row) => row.text === 'COMMIT');
  assert.ok(commitIndex >= 0);
  assert.equal(fake.logs.slice(commitIndex + 1).some((row) => row.text === 'ROLLBACK'), false);
  assert.equal(fake.logs.filter((row) => row.text === 'BEGIN').length, 1);
});

test('#4219 route direct mode derives edge actor and does not require MODAL_BASE_URL', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/views.js');
  const fake = makeDirectFakeClient({ counted: true, viewCount: 2 });
  const request = directRequest({
    'CF-Connecting-IP': '203.0.113.42',
    'x-lovebud-tree-view-actor-key': 'forged-browser-actor',
  });
  const response = await route.proxyTreeView(
    request,
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
      TREE_VIEW_AUTHORITY_SECRET: 'test-only-secret-4219',
    },
    { neonImporter: makeDirectImporter(fake) },
  );
  assert.equal(response.status, 200);
  const dedup = fake.logs.find((row) => row.text.includes('INSERT INTO tree_view_dedup_events'));
  assert.ok(dedup);
  assert.notEqual(dedup.values[2], 'forged-browser-actor');
  assert.match(String(dedup.values[2]), /^[0-9a-f]{64}$/);
});

test('#4219 direct route missing edge secret fails before DB capability', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/views.js');
  let importerCalls = 0;
  const response = await route.proxyTreeView(
    directRequest({ 'CF-Connecting-IP': '203.0.113.42' }),
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
    },
    {
      neonImporter: async () => {
        importerCalls += 1;
        return { Client: class {} };
      },
    },
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'view-authority-unavailable');
  assert.equal(importerCalls, 0);
});

test('#4219 oversized direct view body is rejected before DB capability', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/views.js');
  let importerCalls = 0;
  const request = new Request(DIRECT_TREE_URL, {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.42' },
    body: 'x'.repeat(129 * 1024),
  });
  const response = await route.proxyTreeView(
    request,
    {
      LB_TREE_VIEW_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_NEON_URL,
      TREE_VIEW_AUTHORITY_SECRET: 'test-only-secret-4219',
    },
    {
      neonImporter: async () => {
        importerCalls += 1;
        return { Client: class {} };
      },
    },
  );
  assert.equal(response.status, 413);
  assert.equal(importerCalls, 0);
});

test('#4219 source guard reuses #4132 adapter and preserves default Modal branch', () => {
  const directAdapter = fs.readFileSync(path.join(ROOT, 'functions/_shared/tree-view-direct-neon.js'), 'utf8');
  const route = fs.readFileSync(path.join(ROOT, 'functions/api/trees/[tree_id]/views.js'), 'utf8');
  assert.match(directAdapter, /createNeonWsTransactionAdapter/);
  assert.match(directAdapter, /FOR SHARE/);
  assert.match(directAdapter, /LOVE_PLATFORM_WRITE_DATABASE_URL/);
  assert.doesNotMatch(directAdapter, /request\.headers\.get\(['"]x-lovebud-tree-view-actor-key/);
  assert.match(route, /isTreeViewDirectNeonSelected/);
  assert.match(route, /buildSignedAssertionHeaders/);
  assert.match(route, /MODAL_BASE_URL/);
  assert.match(route, /handleTreeViewDirectNeon/);
});
