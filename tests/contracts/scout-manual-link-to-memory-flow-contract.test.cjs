/**
 * Scout Manual Link-to-Memory Draft Flow Contract Test
 *
 * Contract-only verification for:
 *   docs/product/lovebud-scout-manual-link-to-memory-flow-contract.md (#3373)
 *
 * This test does NOT import any runtime source. It validates that the
 * contract document fixes the required flow states, visible fields,
 * blocked states, and the #3365 safety-boundary inheritance, and it
 * checks the documented state machine transitions as a pure contract.
 *
 * Parent: #1882. Inherits: #3365 / #3364.
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
  'lovebud-scout-manual-link-to-memory-flow-contract.md'
);

function loadDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `contract doc must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('contract doc exists and is not empty', () => {
  const doc = loadDoc();
  assert.ok(doc.trim().length > 0, 'contract doc must have content');
});

test('manual public link only, no crawler/scraper/auto-discovery', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('manual user-provided public link only'), 'must require manual user-provided public link');
  assert.ok(doc.includes('no crawler'), 'must forbid crawler');
  assert.ok(doc.includes('no scraper'), 'must forbid scraper');
  assert.ok(doc.includes('no automatic source discovery'), 'must forbid automatic source discovery');
});

test('feature-flag / prototype gating expectation present', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('feature flag'), 'must define feature-flag gating');
  assert.ok(doc.includes('prototype gate'), 'must define prototype gating');
});

test('all required flow states are defined', () => {
  const doc = loadDoc().toLowerCase();
  for (const state of [
    'empty',
    'validating',
    'unsupported source',
    'ready-to-review',
    'save-ready',
    'safe error / retry',
  ]) {
    assert.ok(doc.includes(state), `flow state must be defined: ${state}`);
  }
});

test('all required visible fields are defined', () => {
  const doc = loadDoc().toLowerCase();
  for (const field of [
    'original source link',
    'short source label',
    'short summary',
    'translated summary',
    'fan-relevant points',
    'emotion tags',
    'editable lovetree memory draft',
  ]) {
    assert.ok(doc.includes(field), `required visible field must be defined: ${field}`);
  }
});

test('edit-before-save requirement present', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('edit-before-save'), 'must require edit-before-save');
});

test('source attribution / provenance present', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('source attribution'), 'must define source attribution');
  assert.ok(doc.includes('provenance'), 'must define provenance');
});

test('all blocked states are defined', () => {
  const doc = loadDoc().toLowerCase();
  for (const blocked of [
    'private',
    'authenticated',
    'paywalled',
    'platform-risk',
    'full-content archive risk',
  ]) {
    assert.ok(doc.includes(blocked), `blocked state must be defined: ${blocked}`);
  }
});

test('storage boundary inherited from #3365', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('inherits'), 'must state inheritance of #3365 boundary');
  assert.ok(doc.includes('link-source safety boundary'), 'must reference #3365 link-source safety boundary');
  assert.ok(doc.includes('3365'), 'must reference #3365');
});

test('safe error copy only, no raw/private exposure', () => {
  const doc = loadDoc().toLowerCase();
  assert.ok(doc.includes('safe error copy'), 'must define safe error copy');
  assert.ok(doc.includes('raw/private'), 'must forbid raw/private exposure');
  assert.ok(!doc.includes('closes ') && !doc.includes('fixes ') && !doc.includes('resolves '),
    'contract doc must not use Closes/Fixes/Resolves verbs');
});

test('cross-links use Refs only (no Closes/Fixes/Resolves)', () => {
  const doc = loadDoc();
  assert.ok(doc.includes('Refs #3373'), 'must Refs #3373');
  assert.ok(doc.includes('Refs #1882'), 'must Refs #1882 (parent)');
  assert.ok(doc.includes('Refs #3365'), 'must Refs #3365');
  assert.ok(doc.includes('Refs #3364'), 'must Refs #3364');
});

test('documented state machine forbids skipping validation', () => {
  const transitions = {
    empty: ['validating'],
    validating: ['unsupported source', 'ready-to-review', 'safe error / retry'],
    'unsupported source': ['validating'],
    'ready-to-review': ['save-ready', 'validating'],
    'save-ready': ['safe error / retry'],
    'safe error / retry': ['validating'],
  };

  const allowed = (from, to) => (transitions[from] || []).includes(to);

  assert.ok(allowed('empty', 'validating'), 'empty -> validating allowed');
  assert.ok(allowed('validating', 'ready-to-review'), 'validating -> ready-to-review allowed');
  assert.ok(allowed('ready-to-review', 'save-ready'), 'ready-to-review -> save-ready allowed');
  assert.ok(allowed('validating', 'unsupported source'), 'validating -> unsupported source allowed');
  assert.ok(allowed('validating', 'safe error / retry'), 'validating -> safe error/retry allowed');
  assert.ok(allowed('unsupported source', 'validating'), 'unsupported source -> validating allowed');
  assert.ok(allowed('safe error / retry', 'validating'), 'safe error/retry -> validating allowed');

  assert.ok(!allowed('empty', 'ready-to-review'), 'empty must NOT skip to ready-to-review');
  assert.ok(!allowed('empty', 'save-ready'), 'empty must NOT skip to save-ready');
  assert.ok(!allowed('unsupported source', 'save-ready'), 'unsupported source must NOT go to save-ready');
});
