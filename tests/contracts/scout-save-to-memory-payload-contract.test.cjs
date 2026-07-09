/**
 * Scout Save-to-Memory Payload Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-save-to-memory-payload-contract.md (#3379)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the contract document fixes the payload shape, the
 * generated-vs-reviewed separation, storage/source/attribution rules, the
 * raw/private prohibition, the inherited boundaries, and the required
 * cross-reference set. No postgres-client / axios / fetch / playwright /
 * puppeteer / provider SDK is imported.
 *
 * Parent: #1882. Inherits: #3375 / #3365. Related: #3373 / #3364 / #3188 / #3075.
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
  'lovebud-scout-save-to-memory-payload-contract.md'
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
  for (const ref of ['#3379', '#1882', '#3373', '#3375', '#3364', '#3365', '#3188', '#3075']) {
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

test('draft-to-memory payload shape defined', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('draft-to-memory payload'), 'must define draft-to-memory payload');
  assert.ok(doc.includes('payload shape'), 'must define payload shape');
});

test('generated suggestion vs user-reviewed save distinction', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('generated suggestion'), 'must define generated suggestion fields');
  assert.ok(doc.includes('user-reviewed'), 'must define user-reviewed save fields');
  assert.ok(doc.includes('only `reviewed`') || doc.includes('only reviewed'),
    'must state only reviewed fields are persisted');
});

test('required / optional / forbidden field groups', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('required'), 'must define required fields');
  assert.ok(doc.includes('optional'), 'must define optional fields');
  assert.ok(doc.includes('forbidden'), 'must define forbidden fields');
  assert.ok(doc.includes('sourcelink'), 'must include sourceLink as a required field');
  assert.ok(doc.includes('memorydraft'), 'must include memoryDraft as a required field');
});

test('original source link preservation', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('source link preservation'), 'must define source link preservation');
  assert.ok(doc.includes('preserved'), 'source link must be preserved verbatim');
});

test('source attribution visibility', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('source attribution'), 'must define source attribution');
  assert.ok(doc.includes('provenance'), 'must define provenance');
});

test('full-text repost / storage forbidden', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('full scraped content'), 'must forbid full scraped content');
  assert.ok(doc.includes('full article'), 'must forbid full article storage');
  assert.ok(doc.includes('paywalled content'), 'must forbid paywalled content storage');
});

test('image / video rehosting forbidden', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('rehosting'), 'must forbid image/video rehosting');
});

test('summary / translation / fan-context / emotion-tag mapping', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('summary'), 'must map summary');
  assert.ok(doc.includes('translatedsummary'), 'must map translated summary');
  assert.ok(doc.includes('fancontext'), 'must map fan context');
  assert.ok(doc.includes('emotiontags'), 'must map emotion tags');
});

test('user review / edit required before save', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('review / edit requirement before save'), 'must require review/edit before save');
  assert.ok(doc.includes('must not auto-save'), 'must forbid auto-save without review');
});

test('safe text length and truncation posture', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe text length'), 'must define safe text length');
  assert.ok(doc.includes('truncation'), 'must define truncation posture');
});

test('no raw / private value exposure', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('raw/private'), 'must forbid raw/private values');
  for (const item of [
    'raw/private ids',
    'tokens',
    'cookies',
    'auth headers',
    'api base urls',
    'dashboard urls',
    'db rows',
    'private logs',
    'request / response bodies',
  ]) {
    assert.ok(doc.includes(item), `must forbid raw/private item: ${item}`);
  }
});

test('no crawler / scraper / fetcher / provider behavior', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no crawler'), 'must forbid crawler behavior');
  assert.ok(doc.includes('no scraper'), 'must forbid scraper behavior');
  assert.ok(doc.includes('no fetcher'), 'must forbid fetcher behavior');
  assert.ok(doc.includes('no provider behavior'), 'must forbid provider behavior');
});

test('no LLM provider wiring', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no llm provider wiring'), 'must forbid LLM provider wiring');
});

test('no Firebase / auth / runtime / storage / DB change', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no firebase'), 'must forbid Firebase change');
  assert.ok(doc.includes('no auth'), 'must forbid auth change');
  assert.ok(doc.includes('no runtime change'), 'must forbid runtime change');
  assert.ok(doc.includes('no storage implementation'), 'must forbid storage implementation');
  assert.ok(doc.includes('no db schema'), 'must forbid DB schema change');
});

test('no real platform request / no production smoke', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no production smoke'), 'must forbid production smoke');
  assert.ok(doc.includes('no real platform request'), 'must forbid real platform request');
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('future implementation handoff boundaries defined', () => {
  const doc = loadDoc().toLowerCase();
  for (const child of ['ui child', 'route child', 'storage child', 'provider / fetcher child']) {
    assert.ok(doc.includes(child), `must define handoff boundary: ${child}`);
  }
});

test('inherited boundaries from #3365 and #3375', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('link-source safety boundary'), 'must inherit #3365 link-source safety boundary');
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('manual link-to-memory draft flow'), 'must inherit #3375 manual flow contract');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});
