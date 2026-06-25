const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRedirects() {
  return fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
}

function redirectLines() {
  return readRedirects().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

// ─── REWRITE RULES (200) ─────────────────────────────────────────────────────

const EXPECTED_REWRITES = [
  '/intro /pages/intro.html 200',
  '/login /pages/login.html 200',
  '/search /pages/search.html 200',
  '/detail /pages/detail.html 200',
  '/editor /pages/editor.html 200',
  '/my-trees /pages/my-trees.html 200',
  '/tree /pages/tree.html 200',

  '/pages/intro /pages/intro.html 200',
  '/pages/login /pages/login.html 200',
  '/pages/search /pages/search.html 200',
  '/pages/detail /pages/detail.html 200',
  '/pages/editor /pages/editor.html 200',
  '/pages/my-trees /pages/my-trees.html 200',
  '/pages/tree /pages/tree.html 200',
];

test('_redirects contains all 14 extensionless -> .html 200 rewrite rules', () => {
  const lines = redirectLines();
  for (const rule of EXPECTED_REWRITES) {
    assert.ok(lines.includes(rule), `Missing rewrite rule: ${rule}`);
  }
});

test('_redirects /pages/login rewrites to /pages/login.html 200', () => {
  const lines = redirectLines();
  assert.ok(lines.includes('/pages/login /pages/login.html 200'));
});

test('_redirects /pages/my-trees rewrites to /pages/my-trees.html 200', () => {
  const lines = redirectLines();
  assert.ok(lines.includes('/pages/my-trees /pages/my-trees.html 200'));
});

// ─── TARGET FILES EXIST ──────────────────────────────────────────────────────

const TARGET_HTML_FILES = [
  'pages/intro.html',
  'pages/login.html',
  'pages/search.html',
  'pages/detail.html',
  'pages/editor.html',
  'pages/my-trees.html',
  'pages/tree.html',
];

test('All target .html files exist', () => {
  for (const file of TARGET_HTML_FILES) {
    const p = path.join(ROOT, file);
    assert.ok(fs.existsSync(p), `Target file missing: ${file}`);
  }
});

// ─── .html -> EXTENSIONLESS 301 RULES PRESERVED ──────────────────────────────

const EXPECTED_301_RULES = [
  '/intro.html /pages/intro 301',
  '/login.html /pages/login 301',
  '/search.html /pages/search 301',
  '/detail.html /pages/detail 301',
  '/editor.html /pages/editor 301',
  '/my-trees.html /pages/my-trees 301',
  '/tree.html /pages/tree 301',

  '/pages/intro.html /pages/intro 301',
  '/pages/login.html /pages/login 301',
  '/pages/search.html /pages/search 301',
  '/pages/detail.html /pages/detail 301',
  '/pages/editor.html /pages/editor 301',
  '/pages/my-trees.html /pages/my-trees 301',
  '/pages/tree.html /pages/tree 301',
];

test('.html -> extensionless 301 canonical redirects are preserved', () => {
  const lines = redirectLines();
  for (const rule of EXPECTED_301_RULES) {
    assert.ok(lines.includes(rule), `Missing 301 rule: ${rule}`);
  }
});

// ─── NO INVERTED DIRECTION ───────────────────────────────────────────────────

test('No rewrite tries to direct .html -> extensionless as 200', () => {
  const lines = redirectLines();
  for (const line of lines) {
    if (!line.endsWith(' 200')) continue;
    const parts = line.split(/\s+/);
    assert.equal(parts.length, 3, `Rewrite rule should have 3 parts: ${line}`);
    assert.ok(
      parts[1].endsWith('.html'),
      `200 rewrite target should be .html file, got: ${line}`
    );
  }
});

test('No 301 redirect targets .html file', () => {
  const lines = redirectLines();
  for (const line of lines) {
    if (!line.endsWith(' 301')) continue;
    const parts = line.split(/\s+/);
    assert.equal(parts.length, 3, `Redirect rule should have 3 parts: ${line}`);
    const source = parts[0].replace(/\/$/, '');
    assert.ok(
      source.endsWith('.html'),
      `301 redirect source should be .html, got: ${line}`
    );
  }
});

// ─── .html/ TRAILING SLASH VARIANTS ALSO PRESERVED ───────────────────────────

const EXPECTED_TRAILING_SLASH_301 = [
  '/intro.html/ /pages/intro 301',
  '/login.html/ /pages/login 301',
  '/search.html/ /pages/search 301',
  '/detail.html/ /pages/detail 301',
  '/editor.html/ /pages/editor 301',
  '/my-trees.html/ /pages/my-trees 301',
  '/tree.html/ /pages/tree 301',

  '/pages/intro.html/ /pages/intro 301',
  '/pages/login.html/ /pages/login 301',
  '/pages/search.html/ /pages/search 301',
  '/pages/detail.html/ /pages/detail 301',
  '/pages/editor.html/ /pages/editor 301',
  '/pages/my-trees.html/ /pages/my-trees 301',
  '/pages/tree.html/ /pages/tree 301',
];

test('.html/ trailing-slash 301 redirects are preserved', () => {
  const lines = redirectLines();
  for (const rule of EXPECTED_TRAILING_SLASH_301) {
    assert.ok(lines.includes(rule), `Missing trailing-slash 301: ${rule}`);
  }
});
