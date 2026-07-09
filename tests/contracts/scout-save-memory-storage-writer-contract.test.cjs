/**
 * Scout Save-Memory Storage Writer Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-save-memory-storage-writer-contract.md (#3402)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the writer contract document fixes the writer/helper
 * location and export-name candidates, the input/output DTOs, the
 * treeId/ownership posture, the allowed/forbidden fields, the
 * idempotency/duplicate-prevention semantics, the safe audit logging shape,
 * the safe error/result taxonomy, and the future implementation gates. It also
 * source-checks that the current route/intake still honor the pre-writer
 * boundary (no storage writer, no createMemory call, persistence gated, no
 * DB insert / provider / fetcher / crawler / scraper / LLM activation).
 *
 * No postgres-client / axios / fetch / playwright / puppeteer / provider SDK.
 *
 * Parent: #1882. Inherits: #3386 / #3395 / #3397 / #3399. Related: #3389 /
 * #3390 / #3387 / #3379 / #3380 / #3375 / #3365 / #3188 / #3075.
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
  'lovebud-scout-save-memory-storage-writer-contract.md'
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
    '#3402', '#1882', '#3397', '#3399', '#3391', '#3395', '#3389', '#3390',
    '#3386', '#3387', '#3379', '#3380', '#3375', '#3365', '#3188', '#3075',
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
    'closes #3402', 'fixes #3402', 'resolves #3402',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `contract doc must not contain "${phrase}"`);
  }
});

test('writer path / export contract documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('save-memory-storage') || doc.includes('save-memory-persist'),
    'must name a storage writer helper candidate');
  assert.ok(doc.includes('functions/api/scout/'), 'must place helper under functions/api/scout/');
  assert.ok(doc.includes('persistreviewedscoutmemorydraft'), 'must name export candidate persistReviewedScoutMemoryDraft');
  assert.ok(doc.includes('not implement') || doc.includes('does not implement'),
    'must state the export is NOT implemented in this PR');
});

test('input DTO documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('input dto'), 'must define input DTO');
  assert.ok(doc.includes('owner') && doc.includes('user identity'), 'must define owner/user identity from auth context');
  assert.ok(doc.includes('never') && (doc.includes('client payload') || doc.includes('client-supplied')),
    'must forbid reading owner/user id from client payload');
  assert.ok(doc.includes('treeid'), 'must address treeId');
  assert.ok(doc.includes('unresolved') && (doc.includes('draft-only') || doc.includes('draft only')),
    'must define unresolved/draft-only posture when treeId undecided');
  assert.ok(doc.includes('idempotency key'), 'must define idempotency key/hash posture');
  assert.ok(doc.includes('sha-256'), 'must store SHA-256 of idempotency key, not raw key');
});

test('input allowed fields documented', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['sourcelink', 'sourcelabel', 'memorydraft', 'summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `input must allow field: ${f}`);
  }
});

test('output DTO documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('output dto'), 'must define output DTO');
  assert.ok(doc.includes("persistence: 'stored'") || doc.includes('persistence: "stored"') || doc.includes("'stored'"),
    'must define persistence: stored only after real write');
  assert.ok(doc.includes('memoryid') || doc.includes('memory id'), 'must define memoryId return (when implementation exists)');
  assert.ok(doc.includes('requestid') || doc.includes('request id'), 'must define safe requestId');
  assert.ok(doc.includes('no raw payload echo') || doc.includes('never') && doc.includes('echo'),
    'must forbid raw payload echo in output');
});

test('treeId / ownership posture documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('treeid'), 'must address treeId');
  assert.ok(doc.includes('ownership'), 'must state ownership prerequisite');
  assert.ok(doc.includes('cross-user') || doc.includes('cross user'), 'must forbid cross-user payload adoption');
});

test('allowed fields documented', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['sourcelink', 'sourcelabel', 'memorydraft', 'summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `must allow storage field: ${f}`);
  }
});

test('forbidden defense-in-depth fields documented', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of [
    'raw source body',
    'full scraped content',
    'full article',
    'paywalled content',
    'copied image',
    'raw provider output',
    'raw request / response bodies',
    'tokens',
    'cookies',
    'auth headers',
    'api base urls',
    'dashboard urls',
    'db rows',
    'private logs',
    'screenshots with private ids',
  ]) {
    assert.ok(doc.includes(f), `must forbid defense-in-depth field group: ${f}`);
  }
  assert.ok(doc.includes('defense-in-depth'), 'must describe forbidden set as defense-in-depth');
});

test('idempotency / duplicate-prevention semantics documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('idempoten'), 'must define idempotency semantics');
  assert.ok(doc.includes('duplicate'), 'must define duplicate-prevention semantics');
  assert.ok(doc.includes('sha-256'), 'must store SHA-256 idempotency key hash');
});

test('safe audit metadata documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('audit'), 'must define safe audit logging');
  for (const m of ['request id', 'owner id', 'target tree id', 'field names', 'sha-256']) {
    assert.ok(doc.includes(m), `audit metadata must include: ${m}`);
  }
  assert.ok(doc.includes('only if resolved'), 'target tree id audit metadata only if resolved');
  for (const f of ['raw key', 'body', 'token', 'cookie', 'auth header']) {
    assert.ok(doc.includes(f), `audit logging must forbid storing: ${f}`);
  }
});

test('safe error / result taxonomy documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error') || doc.includes('safe result'), 'must define safe error/result taxonomy');
  for (const code of ['invalid_payload', 'unreviewed_generated_only', 'forbidden_content', 'unsafe_source', 'duplicate_submission', 'unauthorized', 'forbidden', 'persistence_unresolved']) {
    assert.ok(doc.includes(code), `must define error/result code: ${code}`);
  }
  assert.ok(doc.includes('safe copy'), 'errors must be safe copy');
});

test('future implementation gates documented (4 gates)', () => {
  const doc = loadDoc().toLowerCase();
  for (const g of ['storage writer implementation', 'client / ui tree selection integration', 'non-prod verification', 'production activation']) {
    assert.ok(doc.includes(g), `must define implementation gate: ${g}`);
  }
  assert.ok(doc.includes('separate') && doc.includes('approval'), 'production activation requires separate approval');
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments') || doc.includes('#3188'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('inherited boundaries from #3365 / #3375 / #3379 / #3386 / #3387 / #3395 / #3397 / #3399', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('#3386'), 'must reference #3386');
  assert.ok(doc.includes('#3387'), 'must reference #3387');
  assert.ok(doc.includes('#3395'), 'must reference #3395 (intake guard)');
  assert.ok(doc.includes('#3397'), 'must reference #3397 (handoff audit)');
  assert.ok(doc.includes('#3399'), 'must reference #3399 (handoff audit merged)');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});

// ─── Source-level boundary checks: current route/intake still pre-writer ─────

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

test('current route/intake have no DB insert, provider, fetcher/crawler/scraper/LLM activation', () => {
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
