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

// ─── NO CUSTOM 200 REWRITES — CLOUDFLARE NATIVE CLEAN URLs ───────

test('has no 200 rewrite rules (Cloudflare native clean URLs used instead)', () => {
  const lines = redirectLines();
  for (const line of lines) {
    assert.ok(!line.endsWith(' 200'), `Must not have any 200 rewrite rule (Cloudflare natively serves clean URLs): ${line}`);
  }
});

// ─── TARGET .html FILES EXIST ─────────────────────────────────────

const TARGET_HTML_FILES = [
  'pages/intro.html',
  'pages/login.html',
  'pages/search.html',
  'pages/detail.html',
  'pages/editor.html',
  'pages/my-trees.html',
  'pages/tree.html',
  'pages/settings.html',
];

test('All target .html files exist', () => {
  for (const file of TARGET_HTML_FILES) {
    const p = path.join(ROOT, file);
    assert.ok(fs.existsSync(p), `Target file missing: ${file}`);
  }
});

// ─── ROOT LEGACY .html → /pages/<name> 301 RULES PRESERVED ────────

const EXPECTED_ROOT_301 = [
  '/intro.html /pages/intro 301',
  '/login.html /pages/login 301',
  '/search.html /pages/search 301',
  '/detail.html /pages/detail 301',
  '/editor.html /pages/editor 301',
  '/my-trees.html /pages/my-trees 301',
  '/tree.html /pages/tree 301',
  '/settings.html /pages/settings 301',
];

const EXPECTED_ROOT_TRAILING_SLASH_301 = [
  '/intro.html/ /pages/intro 301',
  '/login.html/ /pages/login 301',
  '/search.html/ /pages/search 301',
  '/detail.html/ /pages/detail 301',
  '/editor.html/ /pages/editor 301',
  '/my-trees.html/ /pages/my-trees 301',
  '/tree.html/ /pages/tree 301',
  '/settings.html/ /pages/settings 301',
];

test('root legacy .html → /pages/<name> 301 redirects are preserved', () => {
  const lines = redirectLines();
  for (const rule of EXPECTED_ROOT_301) {
    assert.ok(lines.includes(rule), `Missing root 301 rule: ${rule}`);
  }
});

test('root legacy .html/ trailing-slash 301 redirects are preserved', () => {
  const lines = redirectLines();
  for (const rule of EXPECTED_ROOT_TRAILING_SLASH_301) {
    assert.ok(lines.includes(rule), `Missing root trailing-slash 301: ${rule}`);
  }
});

// ─── ALL 301 SOURCES ARE .html FILES ──────────────────────────────

test('every 301 redirect source is a .html file', () => {
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

// ─── NESTED /pages/*.html → /pages/<name> 301 MUST NOT EXIST ──────

const FORBIDDEN_NESTED_301 = [
  '/pages/intro.html /pages/intro 301',
  '/pages/login.html /pages/login 301',
  '/pages/search.html /pages/search 301',
  '/pages/detail.html /pages/detail 301',
  '/pages/editor.html /pages/editor 301',
  '/pages/my-trees.html /pages/my-trees 301',
  '/pages/tree.html /pages/tree 301',
  '/pages/settings.html /pages/settings 301',

  '/pages/intro.html/ /pages/intro 301',
  '/pages/login.html/ /pages/login 301',
  '/pages/search.html/ /pages/search 301',
  '/pages/detail.html/ /pages/detail 301',
  '/pages/editor.html/ /pages/editor 301',
  '/pages/my-trees.html/ /pages/my-trees 301',
  '/pages/tree.html/ /pages/tree 301',
  '/pages/settings.html/ /pages/settings 301',
];

test('nested /pages/*.html → /pages/<name> 301 must not exist (would shadow Cloudflare native clean URLs)', () => {
  const lines = redirectLines();
  for (const rule of FORBIDDEN_NESTED_301) {
    assert.ok(!lines.includes(rule), `Nested 301 must be removed: ${rule}`);
  }
});

// ─── REWRITE TARGET NEVER CONFLICTS (NO CUSTOM 200, SO NO LOOP) ──

test('no custom rewrite pairs exist that could create a redirect loop', () => {
  const lines = redirectLines();
  const rewriteTargets = [];
  for (const line of lines) {
    if (!line.endsWith(' 200')) continue;
    const parts = line.split(/\s+/);
    rewriteTargets.push(parts[1]);
  }
  assert.equal(rewriteTargets.length, 0,
    'Must have zero 200 rewrite rules (Cloudflare natively serves clean URLs)');
});
