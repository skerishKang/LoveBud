/**
 * Scout Manual Review UI Readiness Audit Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-manual-review-ui-readiness-audit.md (#3383)
 *
 * This test does NOT import any runtime/network/browser/provider client.
 * It validates that the audit document fixes the future review-surface
 * states, the required boundaries, the inherited contracts, and the
 * required cross-reference set. No postgres-client / axios / fetch /
 * playwright / puppeteer / provider SDK is imported.
 *
 * Parent: #1882. Inherits: #3375 / #3379. Related: #3380 / #3373 / #3364 /
 * #3365 / #3188 / #3075.
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
  'lovebud-scout-manual-review-ui-readiness-audit.md'
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
  for (const ref of ['#3383', '#1882', '#3379', '#3380', '#3373', '#3375', '#3364', '#3365', '#3188', '#3075']) {
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

test('all future review surface states defined', () => {
  const doc = loadDoc().toLowerCase();
  for (const state of [
    'empty / ready-to-paste',
    'validating link',
    'source blocked',
    'draft generated',
    'edit-in-progress',
    'save disabled',
    'save ready',
    'save pending',
    'save success',
    'safe failure / retry',
  ]) {
    assert.ok(doc.includes(state), `review surface state must be defined: ${state}`);
  }
});

test('generated suggestion vs user-reviewed save distinction', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('generated suggestion'), 'must define generated suggestion fields');
  assert.ok(doc.includes('user-reviewed'), 'must define user-reviewed save fields');
});

test('edit-before-save / no auto-save', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('edit-before-save'), 'must require edit-before-save');
  assert.ok(doc.includes('auto-save is forbidden') || doc.includes('no auto-save') || doc.includes('must not auto-save'),
    'must forbid auto-save');
});

test('source attribution / original source link visibility', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('source attribution'), 'must define source attribution');
  assert.ok(doc.includes('original source link'), 'must keep original source link visible');
  assert.ok(doc.includes('provenance'), 'must define provenance');
});

test('full-content repost / storage / rehost forbidden', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('repost'), 'must forbid full-content repost');
  assert.ok(doc.includes('rehost'), 'must forbid rehosting');
  assert.ok(doc.includes('full-content storage') || doc.includes('full article'),
    'must forbid full-content storage');
});

test('safe text length / truncation feedback', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe text length'), 'must define safe text length');
  assert.ok(doc.includes('truncation feedback'), 'must define truncation feedback');
});

test('safe error copy / no raw backend or provider output', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error copy'), 'must define safe error copy');
  assert.ok(doc.includes('no raw backend') || doc.includes('raw backend'),
    'must forbid raw backend output');
  assert.ok(doc.includes('provider output'), 'must forbid raw provider output');
});

test('accessibility / keyboard / focus requirements', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('accessibility'), 'must define accessibility requirements');
  assert.ok(doc.includes('keyboard'), 'must define keyboard operability');
  assert.ok(doc.includes('focus'), 'must define focus requirements');
});

test('route / storage / provider handoff boundaries', () => {
  const doc = loadDoc().toLowerCase();
  for (const child of ['route child', 'storage child', 'provider/fetcher child', 'ui child']) {
    assert.ok(doc.includes(child), `must define handoff boundary: ${child}`);
  }
});

test('feature flag / prototype route gating', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('feature flag'), 'must define feature flag gating');
  assert.ok(doc.includes('prototype route gate') || doc.includes('prototype gate'),
    'must define prototype route gating');
});

test('no real platform request / no production smoke', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('no real platform request'), 'must forbid real platform request');
  assert.ok(doc.includes('no production smoke'), 'must forbid production smoke');
});

test('no raw / private value exposure across surfaces', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('raw/private'), 'must forbid raw/private values');
  for (const surface of ['ui copy', 'logs', 'test fixtures', 'screenshots', 'pr evidence', 'reports']) {
    assert.ok(doc.includes(surface), `must restrict raw/private exposure in: ${surface}`);
  }
  for (const item of ['raw/private ids', 'tokens', 'cookies', 'auth headers', 'api base urls', 'dashboard urls', 'db rows', 'request / response bodies']) {
    assert.ok(doc.includes(item), `must forbid raw/private item: ${item}`);
  }
});

test('no Social changes (tree-like / tree-comment / moment-like / moment-comment)', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('social likes / comments'), 'must reference social likes/comments as out of scope');
  assert.ok(doc.includes('#3188') && doc.includes('#3075'), 'must reference social parent issues #3188/#3075');
});

test('inherited boundaries from #3365 / #3375 / #3379', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('link-source safety boundary'), 'must inherit #3365 link-source safety boundary');
  assert.ok(doc.includes('#3365'), 'must reference #3365');
  assert.ok(doc.includes('manual link-to-memory draft flow'), 'must inherit #3375 manual flow contract');
  assert.ok(doc.includes('#3375'), 'must reference #3375');
  assert.ok(doc.includes('save-to-memory payload'), 'must inherit #3379 save-to-memory payload contract');
  assert.ok(doc.includes('#3379'), 'must reference #3379');
  assert.ok(doc.includes('#1882'), 'must reference parent #1882');
});
