/**
 * Scout Save-Memory Target Tree Selection Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-save-memory-target-tree-selection-contract.md (#3406)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the target tree selection contract document fixes the
 * selection options, the explicit UNRESOLVED / deferred resolution status, the
 * reviewed-payload vs server-resolved context split, the auth-derived owner
 * identity, the forbidden client-supplied id, the ownership validation, the
 * safe failure states, the safe output/result posture, the future storage
 * writer handoff, and the future implementation gates. It also source-checks
 * that the current route/intake still honor the pre-implementation boundary
 * (no target-tree lookup activation, no storage writer, no createMemory, no
 * provider/fetcher/crawler/scraper/LLM activation, persistence gated).
 *
 * No postgres-client / axios / fetch / playwright / puppeteer / provider SDK.
 *
 * Parent: #1882. Inherits: #3386 / #3402 / #3403. Related: #3397 / #3399 /
 * #3389 / #3390 / #3387 / #3379 / #3380 / #3375 / #3365 / #3188 / #3075.
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
  'lovebud-scout-save-memory-target-tree-selection-contract.md'
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
    '#3406', '#1882', '#3402', '#3403', '#3397', '#3399', '#3386', '#3387',
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
    'closes #3406', 'fixes #3406', 'resolves #3406',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `contract doc must not contain "${phrase}"`);
  }
});

test('target tree selection options documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('target tree selection'), 'must define target tree selection');
  assert.ok(doc.includes('treeid'), 'must address explicit user-selected treeId');
  assert.ok(doc.includes('draft-only') || doc.includes('draft only'), 'must define draft-only / holding posture');
  assert.ok(doc.includes('repository-consistent') || doc.includes('repository consistent'),
    'must reference repository-consistent alternative');
});

test('final choice or UNRESOLVED / deferred explicitly documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('unresolved') && doc.includes('deferred'),
    'must explicitly mark final resolution as UNRESOLVED / deferred');
});

test('reviewed payload fields vs server-resolved context separated', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('server-resolved context') || doc.includes('server-resolved'),
    'must define server-resolved context');
  assert.ok(doc.includes('reviewed save payload') || doc.includes('reviewed payload'),
    'must define reviewed save payload source');
  assert.ok(doc.includes('never') && doc.includes('client payload'),
    'must state selection never adds owner/user field to payload');
});

test('auth-derived owner identity documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('owner') && doc.includes('user identity'), 'must define owner/user identity from auth context');
  assert.ok(doc.includes('verified auth context') || doc.includes('verified'), 'must require verified auth context');
});

test('client-supplied owner/user id forbidden documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('never') && (doc.includes('client payload') || doc.includes('client-supplied')),
    'must forbid reading owner/user id from client payload');
  assert.ok(doc.includes('rejected') || doc.includes('ignored'), 'client-supplied id must be rejected/ignored');
});

test('ownership validation documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('ownership'), 'must define ownership validation');
  assert.ok(doc.includes('cross-user'), 'must forbid cross-user save');
  assert.ok(doc.includes('owned by the requester') || doc.includes('owned by the requesting'),
    'must verify target tree owned by requester');
});

test('safe failure states documented', () => {
  const doc = loadDoc().toLowerCase();
  for (const s of ['missing_tree_selection', 'invalid_tree_id', 'tree_not_owned', 'tree_unavailable', 'unresolved_target_selection']) {
    assert.ok(doc.includes(s), `must define safe failure state: ${s}`);
  }
  assert.ok(doc.includes('safe copy'), 'failure states must be safe copy');
});

test('safe output / result posture documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no raw payload echo') || (doc.includes('never') && doc.includes('echo')),
    'must forbid raw payload echo');
  assert.ok(doc.includes('requestid') || doc.includes('request id'), 'must define safe requestId');
  assert.ok(doc.includes('no persistence flip') || doc.includes('no write'), 'must forbid persistence flip');
  assert.ok(doc.includes("persistence: 'gated'") || doc.includes('persistence: "gated"') || doc.includes("'gated'"),
    'current route must remain persistence: gated');
});

test('future storage writer handoff documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('persistreviewedscoutmemorydraft'), 'must reference persistReviewedScoutMemoryDraft handoff');
  assert.ok(doc.includes('unresolved') && doc.includes('not') && doc.includes('write'),
    'must state writer does NOT write when target tree unresolved');
});

test('implementation gates documented (5 gates)', () => {
  const doc = loadDoc().toLowerCase();
  for (const g of ['target-tree ui', 'ownership validation helper', 'storage writer implementation', 'non-prod verification', 'production activation']) {
    assert.ok(doc.includes(g), `must define implementation gate: ${g}`);
  }
  assert.ok(doc.includes('separate') && doc.includes('approval'), 'production activation requires separate approval');
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments') || doc.includes('#3188'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('inherited boundaries from #3365 / #3375 / #3379 / #3386 / #3397 / #3399 / #3402 / #3403', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('#3386'), 'must reference #3386');
  assert.ok(doc.includes('#3397'), 'must reference #3397 (handoff audit)');
  assert.ok(doc.includes('#3399'), 'must reference #3399 (handoff audit merged)');
  assert.ok(doc.includes('#3402'), 'must reference #3402 (writer contract)');
  assert.ok(doc.includes('#3403'), 'must reference #3403 (writer contract merged)');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});

// ─── Source-level boundary checks: current route/intake still pre-implementation ─────

test('current route still returns persistence: gated', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(src.includes("persistence: 'gated'"), 'route must still return persistence: gated');
  assert.ok(src.includes('intake_accepted'), 'route must still return intake_accepted status');
});

test('current route has no storage writer import/call', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('save-memory-storage'), 'route must not import the storage writer yet');
  assert.ok(!src.includes('persistReviewedScoutMemoryDraft'), 'route must not call the writer export yet');
  assert.ok(!src.includes('createMemory'), 'route must not call createMemory yet (writer child owns write)');
});

test('current route has no target tree lookup activation', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(!src.includes('treeId'), 'route must not activate target tree lookup yet');
  assert.ok(!src.includes('lookupTree') && !src.includes('getTree') && !src.includes('resolveTree'),
    'route must not call any tree lookup helper yet');
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
