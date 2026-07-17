/**
 * #3576 Fingerprint + ESM loading contract (SOURCE_STATIC)
 *
 * - sidebar loads as type="module"
 * - new fingerprint present
 * - old 6d79c66e2fbc removed
 * - fingerprint tracks sidebar source SHA-256 prefix when source/loading semantics change
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const EDITOR_HTML = path.join(ROOT, 'pages', 'editor.html');
const SIDEBAR_SRC = path.join(ROOT, 'js', 'editor', 'templates', 'editor-sidebar-template.js');
const OLD_FP = '6d79c66e2fbc';
const EXPECTED_FP = '38e12fa98ab9';

function sha12(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

test('#3576 fingerprint: sidebar is type=module with new fingerprint only', () => {
  const html = fs.readFileSync(EDITOR_HTML, 'utf8');
  const tag = html.match(/<script[^>]*editor-sidebar-template\.js[^"]*"[^>]*>/);
  assert.ok(tag, 'sidebar script tag must exist');
  assert.match(tag[0], /type="module"/, 'sidebar must load as type="module"');
  assert.ok(!tag[0].includes(OLD_FP), `old fingerprint ${OLD_FP} must be removed`);
  assert.ok(tag[0].includes(`v=${EXPECTED_FP}`), `new fingerprint ${EXPECTED_FP} must be present`);
  assert.equal((html.match(/editor-sidebar-template\.js/g) || []).length, 1, 'exactly one sidebar script reference');
});

test('#3576 fingerprint: HTML fingerprint matches current sidebar source SHA-256 prefix', () => {
  const src = fs.readFileSync(SIDEBAR_SRC);
  const actual = sha12(src);
  assert.equal(
    actual,
    EXPECTED_FP,
    `sidebar source sha12 must equal HTML fingerprint (got ${actual}, expected ${EXPECTED_FP})`
  );
  assert.notEqual(actual, OLD_FP, 'source must not hash to the retired fingerprint');
});

test('#3576 fingerprint: sidebar source remains ESM export builder', () => {
  const src = fs.readFileSync(SIDEBAR_SRC, 'utf8');
  assert.match(src, /export\s+function\s+buildSidebarTemplate\s*\(/);
  assert.doesNotMatch(src, /window\.LoveBudEditor[A-Z]/);
  assert.doesNotMatch(src, /window\.createEditor[A-Z]/);
  assert.match(src, /mount\.outerHTML\s*=\s*buildSidebarTemplate\(\)/);
});
