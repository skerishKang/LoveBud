/**
 * Scout Reviewed Payload Route Readiness Audit Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-reviewed-payload-route-readiness-audit.md (#3389)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the audit document fixes the route location candidates,
 * the existing shell/stub/client/adapter reuse, the inherited #3386 intake
 * rules, the required/optional/forbidden fields, the safe error taxonomy,
 * the auth/storage/idempotency prerequisites, the non-prod plan, and the
 * required cross-reference set. No postgres-client / axios / fetch /
 * playwright / puppeteer / provider SDK is imported.
 *
 * Parent: #1882. Inherits: #3386 / #3383. Related: #3387 / #3384 / #3379 /
 * #3380 / #3375 / #3365 / #3188 / #3075.
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
  'lovebud-scout-reviewed-payload-route-readiness-audit.md'
);

function loadDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `audit doc must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('audit doc exists and is not empty', () => {
  const doc = loadDoc();
  assert.ok(doc.trim().length > 0, 'audit doc must have content');
});

test('required cross-references present (Refs only)', () => {
  const doc = loadDoc();
  for (const ref of ['#3389', '#1882', '#3386', '#3387', '#3383', '#3384', '#3379', '#3380', '#3375', '#3365', '#3188', '#3075']) {
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
    assert.ok(!doc.includes(phrase), `audit doc must not contain "${phrase}"`);
  }
});

test('future route / action location candidates with rationale', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('route') && doc.includes('action'), 'must address route/action');
  assert.ok(doc.includes('location candidate') || doc.includes('candidate location'), 'must define location candidates');
  assert.ok(doc.includes('rationale'), 'must give rationale');
});

test('existing Scout shell / stub / endpoint client / adapter boundary referenced', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('suggest.js'), 'must reference existing suggestion endpoint shell');
  assert.ok(doc.includes('scout-draft.js'), 'must reference existing draft shell');
  assert.ok(doc.includes('scout-draft-ui.js'), 'must reference existing draft UI shell');
  assert.ok(doc.includes('scout-suggestion-endpoint-client.js'), 'must reference endpoint client boundary');
  assert.ok(doc.includes('scout-suggestion-provider.js'), 'must reference provider boundary');
  assert.ok(doc.includes('live-auth-verifier-adapter.js'), 'must reference auth verifier adapter boundary');
  assert.ok(doc.includes('live-provider-adapter.js'), 'must reference provider adapter boundary');
  assert.ok(doc.includes('live-rate-limit-storage-adapter.js'), 'must reference rate-limit storage adapter boundary');
});

test('#3386 reviewed-only intake validation inherited', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('reviewed-only') || doc.includes('reviewed only'), 'must inherit reviewed-only intake');
  assert.ok(doc.includes('#3386'), 'must reference #3386');
});

test('generated-only save rejection', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('generated-only') || doc.includes('generated only'), 'must reject generated-only save');
});

test('required fields', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('sourcelink'), 'must require sourceLink');
  assert.ok(doc.includes('sourcelabel'), 'must require sourceLabel');
  assert.ok(doc.includes('memorydraft'), 'must require memoryDraft');
});

test('optional reviewed fields', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `must accept optional reviewed field: ${f}`);
  }
});

test('forbidden fields / raw-private exposure prohibition', () => {
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

test('safe error taxonomy', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error taxonomy'), 'must define safe error taxonomy');
  for (const code of ['invalid_payload', 'unreviewed_generated_only', 'forbidden_content', 'unsafe_source', 'duplicate_submission']) {
    assert.ok(doc.includes(code), `must define error taxonomy code: ${code}`);
  }
  assert.ok(doc.includes('safe copy'), 'errors must be safe copy');
});

test('auth / ownership prerequisite without auth implementation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('auth'), 'must state auth prerequisite');
  assert.ok(doc.includes('no auth implementation') || doc.includes('does not implement auth') || doc.includes('not implement auth'),
    'must state it does NOT implement auth');
  assert.ok(doc.includes('ownership'), 'must state ownership prerequisite');
});

test('storage handoff prerequisite without storage implementation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('storage handoff'), 'must define storage handoff prerequisite');
  assert.ok(doc.includes('no storage implementation') || doc.includes('does not create a storage implementation'),
    'must state it does NOT create storage implementation');
});

test('idempotency prerequisite', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('idempoten'), 'must define idempotency prerequisite');
  assert.ok(doc.includes('duplicate'), 'must address duplicate submission');
});

test('non-prod verification plan without real platform request / production smoke', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('non-prod verification'), 'must define non-prod verification plan');
  assert.ok(doc.includes('no real platform request'), 'must forbid real platform request');
  assert.ok(doc.includes('no production smoke'), 'must forbid production smoke');
  assert.ok(doc.includes('fixture'), 'must use fixtures (no raw/private values)');
});

test('future child split', () => {
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

test('inherited boundaries from #3365 / #3375 / #3379 / #3383 / #3386', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('link-source safety boundary'), 'must inherit #3365 link-source safety boundary');
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('manual link-to-memory draft flow'), 'must inherit #3375 manual flow contract');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('save-to-memory payload'), 'must inherit #3379 save-to-memory payload contract');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('manual review ui readiness'), 'must inherit #3383 review UI readiness audit');
  assert.ok(doc.includes('#3383'), 'must reference #3383');
  assert.ok(doc.includes('reviewed payload route intake'), 'must inherit #3386 route intake contract');
  assert.ok(doc.includes('#3386'), 'must reference #3386');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});
