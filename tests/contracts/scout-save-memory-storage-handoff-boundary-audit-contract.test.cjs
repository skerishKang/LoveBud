/**
 * Scout Save-Memory Storage Handoff Boundary Audit Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-save-memory-storage-handoff-boundary-audit.md (#3397)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the audit document fixes the storage handoff boundary:
 * current memory creation/storage conventions, future storage writer/helper
 * location candidates, the treeId/draft-only UNRESOLVED posture, the
 * reviewed -> write-request transformation, the storage allowed/forbidden
 * fields, source-link visibility, idempotency/duplicate prevention,
 * auth/ownership/tree-selection prerequisites, safe audit logging, the safe
 * error taxonomy, and the future child split. It also source-checks that the
 * current route/intake still honor the boundary (no storage writer, no memory
 * insert, persistence gated, output limited to allowed fields).
 *
 * No postgres-client / axios / fetch / playwright / puppeteer / provider SDK.
 *
 * Parent: #1882. Inherits: #3386 / #3395. Related: #3389 / #3390 / #3387 /
 * #3379 / #3380 / #3375 / #3365 / #3188 / #3075.
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
  'lovebud-scout-save-memory-storage-handoff-boundary-audit.md'
);
const ROUTE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory.js');
const INTAKE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory-intake.js');

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
  for (const ref of [
    '#3397', '#1882', '#3391', '#3395', '#3389', '#3390',
    '#3386', '#3387', '#3379', '#3380', '#3375', '#3365', '#3188', '#3075',
  ]) {
    assert.ok(doc.includes(`Refs ${ref}`), `must Refs ${ref}`);
  }
});

test('close/fix/resolve keywords forbidden for parent/social issues', () => {
  const doc = loadDoc().toLowerCase();
  const forbidden = [
    'closes #1882', 'fixes #1882', 'resolves #1882',
    'closes #3188', 'fixes #3188', 'resolves #3188',
    'closes #3075', 'fixes #3075', 'resolves #3075',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `audit doc must not contain "${phrase}"`);
  }
});

test('current memory creation / storage conventions documented', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('creatememory'), 'must reference existing createMemory client boundary');
  assert.ok(doc.includes('post /memories') || doc.includes('post /memories'), 'must reference POST /memories entry');
  assert.ok(doc.includes('creatememorywithfallback') || doc.includes('fallback'), 'must reference editor fallback save flow');
  assert.ok(doc.includes('persistence'), 'must reference persistence gating convention');
});

test('future storage writer / helper location candidates', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('save-memory-storage') || doc.includes('save-memory-persist'), 'must name a storage helper candidate');
  assert.ok(doc.includes('functions/api/scout/'), 'must place helper under functions/api/scout/');
  assert.ok(doc.includes('live-rate-limit-storage-adapter'), 'must reuse rate-limit storage adapter pattern');
});

test('treeId / explicit tree / draft-only recorded as UNRESOLVED', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('treeid'), 'must address treeId');
  assert.ok(doc.includes('unresolved'), 'must record tree selection as unresolved');
  assert.ok(doc.includes('draft-only') || doc.includes('draft only'), 'must address draft-only memory posture');
});

test('reviewed payload -> write request transformation rules', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['sourcelink', 'sourcelabel', 'memorydraft', 'summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `must map reviewed field: ${f}`);
  }
  assert.ok(doc.includes('verbatim') || doc.includes('preserved'), 'sourceLink must be preserved verbatim');
  assert.ok(doc.includes('drop'), 'must state fields outside allowed set are dropped');
});

test('storage allowed fields', () => {
  const doc = loadDoc().toLowerCase();
  for (const f of ['sourcelink', 'sourcelabel', 'memorydraft', 'summary', 'translatedsummary', 'fancontext', 'emotiontags']) {
    assert.ok(doc.includes(f), `must allow storage field: ${f}`);
  }
});

test('forbidden storage fields', () => {
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
    assert.ok(doc.includes(f), `must forbid storage field group: ${f}`);
  }
});

test('source link visibility preserved; full-content repost/rehost forbidden', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('source link') || doc.includes('sourcelink'), 'must reference source link visibility');
  assert.ok(doc.includes('repost') || doc.includes('rehost'), 'must forbid full-content repost/rehost');
  assert.ok(doc.includes('provenance'), 'must preserve provenance');
});

test('idempotency posture', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('idempoten'), 'must define idempotency posture');
  assert.ok(doc.includes('sha-256') || doc.includes('hash'), 'must store idempotency key hash, not raw key');
});

test('duplicate prevention', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('duplicate'), 'must address duplicate prevention');
});

test('auth / ownership / tree-selection prerequisites without implementation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('auth'), 'must state auth prerequisite');
  assert.ok(doc.includes('ownership'), 'must state ownership prerequisite');
  assert.ok(doc.includes('tree selection') || doc.includes('tree-selection'), 'must state tree-selection prerequisite');
  assert.ok(doc.includes('does not implement auth') || doc.includes('no auth implementation') || doc.includes('not implement auth'),
    'must state it does NOT implement auth');
});

test('safe audit logging posture (no raw/private values)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('audit'), 'must define audit logging posture');
  for (const f of ['token', 'cookie', 'auth header', 'api base url', 'dashboard url', 'db row', 'request/response body', 'private log', 'screenshot']) {
    assert.ok(doc.includes(f), `audit logging must forbid storing: ${f}`);
  }
});

test('safe error taxonomy and response copy', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error taxonomy'), 'must define safe error taxonomy');
  for (const code of ['invalid_payload', 'unreviewed_generated_only', 'forbidden_content', 'unsafe_source', 'duplicate_submission']) {
    assert.ok(doc.includes(code), `must define error taxonomy code: ${code}`);
  }
  assert.ok(doc.includes('safe copy'), 'errors must be safe copy');
});

test('future child split (4 children)', () => {
  const doc = loadDoc().toLowerCase();
  for (const child of ['storage writer contract', 'storage writer implementation', 'client / ui integration', 'non-prod verification']) {
    assert.ok(doc.includes(child), `must define future child split: ${child}`);
  }
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments') || doc.includes('#3188'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('inherited boundaries from #3365 / #3375 / #3379 / #3386 / #3387 / #3395', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('#3386'), 'must reference #3386');
  assert.ok(doc.includes('#3387'), 'must reference #3387');
  assert.ok(doc.includes('#3395'), 'must reference #3395 (intake guard)');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});

// ─── Source-level boundary checks: current route/intake honor the audit ─────

test('route currently gates persistence (no storage writer yet)', () => {
  const src = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(src.includes("persistence: 'gated'"), 'route must return persistence: gated');
  assert.ok(src.includes('intake_accepted'), 'route must return intake_accepted status');
  assert.ok(!src.includes('INSERT'), 'route must not contain DB insert');
  assert.ok(!src.includes('createMemory'), 'route must not call createMemory yet (storage child owns write)');
});

test('route and intake have no fetch/provider/DB/storage writer', () => {
  const routeSrc = fs.readFileSync(ROUTE_PATH, 'utf8');
  const intakeSrc = fs.readFileSync(INTAKE_PATH, 'utf8');
  const combined = routeSrc + '\n' + intakeSrc;
  const forbidden = [
    'fetch(', 'axios', 'XMLHttpRequest', 'knex', 'pg.', 'postgres',
    'createClient', 'INSERT INTO', 'insertInto', 'drizzle', 'prisma',
    'supabase', 'firebase', 'provider.',
  ];
  for (const pattern of forbidden) {
    assert.ok(!combined.includes(pattern), `route/intake must not contain "${pattern}"`);
  }
});

test('intake-validated output contains only allowed storage fields', async () => {
  const mod = await import(path.relative(__dirname, INTAKE_PATH).replace(/\\/g, '/'));
  const validateReviewedPayload = mod.validateReviewedPayload;
  const result = validateReviewedPayload({
    reviewed: {
      sourceLink: 'https://example.com/article',
      sourceLabel: 'Example Article',
      memoryDraft: 'This is a draft memory about the article.',
      summary: 'A short summary.',
      translatedSummary: 'A translated summary.',
      fanContext: 'This is relevant to fans because...',
      emotionTags: 'happy, touched',
    },
  });
  assert.ok(result.ok, 'valid payload must be accepted');
  const allowed = new Set([
    'sourceLink', 'sourceLabel', 'memoryDraft',
    'summary', 'translatedSummary', 'fanContext', 'emotionTags',
  ]);
  for (const key of Object.keys(result.reviewed)) {
    assert.ok(allowed.has(key), `output field '${key}' must be an allowed storage field`);
  }
});

test('intake still rejects forbidden fields before any storage handoff', async () => {
  const mod = await import(path.relative(__dirname, INTAKE_PATH).replace(/\\/g, '/'));
  const validateReviewedPayload = mod.validateReviewedPayload;
  const result = validateReviewedPayload({
    reviewed: {
      sourceLink: 'https://example.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
      rawProviderOutput: 'DUMMY_SAFE_STRING',
    },
  });
  assert.ok(!result.ok, 'forbidden field must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
});

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"][^'"]*postgres-client/i.test(self), 'Contract test must not require postgres-client');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(!/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self), 'Contract test must not call fetch');
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});
