/**
 * Scout Reviewed Payload Route Intake Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-reviewed-payload-route-intake-contract.md (#3386)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the contract document fixes the intake boundary, the
 * reviewed-only acceptance, the required/optional/forbidden fields, the
 * safe error taxonomy, the idempotency/auth/storage-handoff expectations,
 * the inherited contracts, and the required cross-reference set. No
 * postgres-client / axios / fetch / playwright / puppeteer / provider SDK
 * is imported.
 *
 * Parent: #1882. Inherits: #3375 / #3379 / #3383. Related: #3384 / #3380 /
 * #3373 / #3364 / #3365 / #3188 / #3075.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs',
  'product',
  'lovebud-scout-reviewed-payload-route-intake-contract.md'
);

function loadDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `contract doc must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('contract doc exists and is not empty', () => {
  const doc = loadDoc();
  assert.ok(doc.trim().length > 0, 'contract doc must have content');
});

test('required cross-references present (Refs only)', () => {
  const doc = loadDoc();
  for (const ref of ['#3386', '#1882', '#3383', '#3384', '#3379', '#3380', '#3373', '#3375', '#3364', '#3365', '#3188', '#3075']) {
    assert.ok(doc.includes(`Refs ${ref}`), `must Refs ${ref}`);
  }
});

test('close/fix/resolve keywords forbidden for parent/social issues', () => {
  const doc = loadDoc().toLowerCase();
  const forbidden = [
    'closes #1882',
    'fixes #1882',
    'resolves #1882',
    'closes #3188',
    'closes #3075',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `contract doc must not contain "${phrase}"`);
  }
});

test('route / action intake boundary defined', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('route / action intake'), 'must define route/action intake boundary');
  assert.ok(doc.includes('intake boundary'), 'must define intake boundary');
});

test('reviewed-only accepted payload group', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('reviewed') && doc.includes('accepted'), 'must accept reviewed group');
  assert.ok(doc.includes('accepted payload group'), 'must define accepted payload group');
});

test('generated-only save explicitly rejected', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('generated') && doc.includes('rejected'), 'must reject generated-only');
  assert.ok(doc.includes('generated-only') || doc.includes('generated only'), 'must reference generated-only rejection');
});

test('required fields validated', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('sourcelink'), 'must require sourceLink');
  assert.ok(doc.includes('sourcelabel'), 'must require sourceLabel');
  assert.ok(doc.includes('memorydraft'), 'must require memoryDraft');
  assert.ok(doc.includes('required field'), 'must define required field validation');
});

test('optional reviewed fields', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `must accept optional reviewed field: ${f}`);
  }
});

test('forbidden full-content / raw-private field groups', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of [
    'full scraped content',
    'raw source body',
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
    assert.ok(doc.includes(f), `must forbid field group: ${f}`);
  }
});

test('safe validation / error taxonomy', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error taxonomy'), 'must define safe error taxonomy');
  for (const code of ['invalid_payload', 'unreviewed_generated_only', 'forbidden_content', 'unsafe_source', 'duplicate_submission']) {
    assert.ok(doc.includes(code), `must define error taxonomy code: ${code}`);
  }
  assert.ok(doc.includes('safe copy'), 'errors must be safe copy');
});

test('idempotency posture', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('idempoten'), 'must define idempotency posture');
  assert.ok(doc.includes('duplicate'), 'must address duplicate submission');
});

test('auth / ownership expectation without auth implementation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('auth'), 'must state auth/ownership expectation');
  assert.ok(doc.includes('no auth implementation') || doc.includes('does not implement auth') || doc.includes('not implement auth'),
    'must state it does NOT implement auth');
  assert.ok(doc.includes('ownership'), 'must state ownership expectation');
});

test('storage handoff boundary without storage implementation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('storage handoff'), 'must define storage handoff boundary');
  assert.ok(doc.includes('no storage implementation') || doc.includes('does not create a storage implementation'),
    'must state it does NOT create storage implementation');
});

test('no real platform request / no provider call / no production smoke', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no real platform request'), 'must forbid real platform request');
  assert.ok(doc.includes('no provider call'), 'must forbid provider call');
  assert.ok(doc.includes('no production smoke'), 'must forbid production smoke');
});

test('no UI / no client adapter', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no ui'), 'must forbid UI implementation');
  assert.ok(doc.includes('no client adapter'), 'must forbid client adapter');
});

test('future child split before implementation', () => {
  const doc = loadDoc().toLowerCase();
  for (const child of ['route implementation', 'storage implementation', 'ui integration', 'non-prod verification']) {
    assert.ok(doc.includes(child), `must define future child split: ${child}`);
  }
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('inherited boundaries from #3365 / #3375 / #3379 / #3383', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('link-source safety boundary'), 'must inherit #3365 link-source safety boundary');
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('manual link-to-memory draft flow'), 'must inherit #3375 manual flow contract');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('save-to-memory payload'), 'must inherit #3379 save-to-memory payload contract');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('manual review ui readiness'), 'must inherit #3383 review UI readiness audit');
  assert.ok(doc.includes('#3383'), 'must reference #3383');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});
