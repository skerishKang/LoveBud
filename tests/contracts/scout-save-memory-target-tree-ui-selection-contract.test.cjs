/**
 * Scout Save-Memory Target Tree UI Selection Integration Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-save-memory-target-tree-ui-selection-contract.md (#3409)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the target-tree UI selection integration contract document
 * fixes the existing LoveTree selection/listing affordance audit, the
 * target-tree selection placement, the selected tree label/name, the
 * empty / missing / unavailable / invalid-stale / server-failure states, the
 * accessibility expectations, the client payload envelope (reviewed-only +
 * treeId as target-selection field + no client-supplied owner/user id), the
 * #3407 unresolved/deferred posture bridge, the future route/intake handoff,
 * the safe copy/errors, and the 6 future implementation gates. It also
 * source-checks that the current route/intake still honor the pre-implementation
 * boundary (no target-tree UI implementation, no target-tree runtime activation,
 * no ownership validation helper, no storage writer, no createMemory, no
 * provider/fetcher/crawler/scraper/LLM activation, persistence gated).
 *
 * No postgres-client / axios / fetch / playwright / puppeteer / provider SDK.
 *
 * Parent: #1882. Inherits: #3407 / #3406 / #3386 / #3402 / #3403. Related:
 * #3397 / #3399 / #3389 / #3390 / #3387 / #3379 / #3380 / #3375 / #3365 / #3188 / #3075.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs',
  'product',
  'lovebud-scout-save-memory-target-tree-ui-selection-contract.md'
);
const ROUTE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory.js');
const INTAKE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory-intake.js');

function loadDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `contract doc must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('contract doc exists and is not empty', () => {
  const doc = loadDoc();
  assert.ok(doc.trim().length > 0, 'contract doc must have content');
});

test('required Refs present (Refs only)', () => {
  const doc = loadDoc();
  for (const ref of [
    '#3409', '#1882', '#3406', '#3407', '#3402', '#3403', '#3397', '#3399', '#3386', '#3387',
    '#3379', '#3380', '#3375', '#3365', '#3188', '#3075',
  ]) {
    assert.ok(doc.includes(`Refs ${ref}`), `must Refs ${ref}`);
  }
});

test('close/fix/resolve parent keywords forbidden', () => {
  const doc = loadDoc().toLowerCase();
  const forbidden = [
    'closes #1882', 'fixes #1882', 'resolves #1882',
    'closes #3188', 'fixes #3188', 'resolves #3188',
    'closes #3075', 'fixes #3075', 'resolves #3075',
    'closes #3407', 'fixes #3407', 'resolves #3407',
    'closes #3406', 'fixes #3406', 'resolves #3406',
    'closes #3409', 'fixes #3409', 'resolves #3409',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `contract doc must not contain "${phrase}"`);
  }
});

test('existing LoveTree selection/listing affordance audit documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('affordance audit'), 'must include an affordance audit section');
  assert.ok(doc.includes('scout-draft-ui') || doc.includes('scout reviewed save surface'),
    'must audit the Scout reviewed save surface');
  assert.ok(doc.includes('no reusable picker confirmed in this contract'),
    'must state no reusable save-target picker confirmed in this contract');
  assert.ok(doc.includes('unresolved') || doc.includes('deferred'),
    'audit conclusion must be UNRESOLVED / deferred');
});

test('target-tree UI placement documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('target-tree selection') || doc.includes('target tree selection'),
    'must define target-tree selection placement');
  assert.ok(doc.includes('reviewed save surface') || doc.includes('reviewed payload'),
    'must place selection on the reviewed save surface');
  assert.ok(doc.includes('before') && doc.includes('save action'),
    'must require selection before the save action');
});

test('selected tree label/name documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok((doc.includes('selected tree') && (doc.includes('label') || doc.includes('name'))),
    'must document the selected tree label/name display');
});

test('empty / no-tree state documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('empty') && (doc.includes('no-tree') || doc.includes('no tree')),
    'must define empty / no-tree state');
});

test('missing selection state documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('missing selection'), 'must define missing selection state');
  assert.ok(doc.includes('blocked') || doc.includes('holding') || doc.includes('draft-only'),
    'missing selection must block or hold save');
});

test('tree list unavailable / retry / error states documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('unavailable'), 'must define tree list unavailable state');
  assert.ok(doc.includes('retry'), 'must define a retry affordance for unavailable list');
  assert.ok(doc.includes('error'), 'must define error state copy');
});

test('invalid / stale selected tree state documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('invalid') && (doc.includes('stale') || doc.includes('invalid/stale')),
    'must define invalid / stale selected tree state');
});

test('server-side unauthorized / ownership failure state documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('server-side') || doc.includes('server side'),
    'must define server-side failure handling');
  assert.ok(doc.includes('unauthorized') || doc.includes('ownership'),
    'must define unauthorized / ownership failure state');
});

test('accessibility expectations documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('keyboard reachable') || (doc.includes('keyboard') && doc.includes('reachable')),
    'must require keyboard reachable');
  assert.ok(doc.includes('clear label'), 'must require a clear label');
  assert.ok(doc.includes('focus return'), 'must require focus return');
  assert.ok(doc.includes('aria-live') || doc.includes('live'),
    'must define status/live copy for loading/error/selection change');
});

test('client payload envelope documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('client payload envelope') || (doc.includes('payload') && doc.includes('envelope')),
    'must define the client payload envelope');
  assert.ok(doc.includes('reviewed-only'), 'reviewed payload fields must stay reviewed-only');
  assert.ok(doc.includes('treeid') && doc.includes('target-selection'),
    'treeId must be the target-selection field');
});

test('client-supplied owner/user id forbidden documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('never') && (doc.includes('client payload') || doc.includes('client-supplied')),
    'must forbid sending owner/user id from client payload');
  assert.ok(doc.includes('forbidden'), 'client-supplied owner/user identity must be forbidden');
});

test('#3407 unresolved / deferred posture bridge documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('#3407'), 'must bridge to #3407');
  assert.ok(doc.includes('unresolved') && (doc.includes('deferred') || doc.includes('bridge')),
    'must document the #3407 unresolved/deferred posture bridge');
  assert.ok(doc.includes('not enabled') || doc.includes('not') && doc.includes('enabled'),
    'must state persistence not enabled until target tree selected');
  assert.ok(doc.includes("persistence: 'gated'") || doc.includes('persistence: "gated"') || doc.includes("'gated'"),
    'current route must remain persistence: gated');
  assert.ok(doc.includes('does not invent') || doc.includes('does not guess'),
    'UI/client must not invent or guess a tree');
});

test('route / intake future handoff documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('future route'), 'must define future route handoff');
  assert.ok(doc.includes('auth-derived owner') || doc.includes('auth context'),
    'server validates auth-derived owner identity');
  assert.ok(doc.includes('ownership'), 'server validates tree ownership');
  assert.ok(doc.includes('does not trust client identity') || (doc.includes('not trust') && doc.includes('client')),
    'route/intake must not trust client identity');
});

test('safe error / copy states documented', () => {
  const doc = loadDoc().toLowerCase();
  for (const s of ['no trees available', 'tree list unavailable', 'missing selection', 'invalid / stale selected tree', 'unauthorized / ownership failure', 'unresolved target selection']) {
    assert.ok(doc.includes(s), `must define safe copy/error state: ${s}`);
  }
  assert.ok(doc.includes('safe copy'), 'states must be safe copy');
});

test('implementation gates documented (6 gates)', () => {
  const doc = loadDoc().toLowerCase();
  for (const g of ['client/ui tree selection', 'route/intake target-tree', 'ownership validation helper', 'storage writer', 'non-prod verification', 'production activation']) {
    assert.ok(doc.includes(g), `must define implementation gate: ${g}`);
  }
  assert.ok(doc.includes('separate') && doc.includes('approval'), 'production activation requires separate approval');
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments') || doc.includes('#3188'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

// ─── Source-level boundary checks: current route/intake still pre-implementation ─────

test('current route still returns persistence: gated', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(src.includes("persistence: 'gated'"), 'route must still return persistence: gated');
  assert.ok(src.includes('intake_accepted'), 'route must still return intake_accepted status');
});

test('current route has no target-tree UI implementation', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('scout-draft-ui') && !src.includes('targetTreePicker') && !src.includes('treePicker'),
    'route must not contain target-tree UI implementation');
});

test('current route has no route/intake runtime target-tree activation', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('treeId'), 'route must not activate target tree runtime yet');
  assert.ok(!src.includes('lookupTree') && !src.includes('getTree') && !src.includes('resolveTree'),
    'route must not call any tree lookup helper yet');
});

test('current route has no ownership validation helper activation', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('validateOwnership') && !src.includes('ownershipValidator') && !src.includes('isTreeOwned'),
    'route must not activate an ownership validation helper yet');
});

test('current route has no storage writer import/call', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('save-memory-storage'), 'route must not import the storage writer yet');
  assert.ok(!src.includes('persistReviewedScoutMemoryDraft'), 'route must not call the writer export yet');
  assert.ok(!src.includes('createMemory'), 'route must not call createMemory yet (writer child owns write)');
});

test('current route/intake have no provider/fetcher/crawler/scraper/LLM activation', () => {
  const routeSrc = fs.readFileSync(ROUTE_PATH, 'utf8');
  const intakeSrc = fs.readFileSync(INTAKE_PATH, 'utf8');
  const combined = routeSrc + '\n' + intakeSrc;
  const forbidden = [
    'fetch(', 'axios', 'XMLHttpRequest', 'knex', 'pg.', 'postgres',
    'createClient', 'INSERT INTO', 'insertInto', 'drizzle', 'prisma',
    'supabase', 'firebase', 'provider.', 'crawler', 'scraper', 'llm',
  ];
  for (const pattern of forbidden) {
    assert.ok(!combined.includes(pattern), `route/intake must not contain "${pattern}"`);
  }
});

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"][^'"]*postgres-client/i.test(self), 'Contract test must not require postgres-client');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(!/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self), 'Contract test must not call fetch');
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});
