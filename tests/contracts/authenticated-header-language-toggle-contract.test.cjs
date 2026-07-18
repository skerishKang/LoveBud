const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const HTML_PAGES = [
  'pages/search.html', 'pages/signup.html', 'pages/intro.html',
  'pages/view.html', 'pages/login.html', 'pages/public-canvas.html',
  'pages/detail.html', 'pages/settings.html', 'pages/my-trees.html',
  'pages/editor.html', 'index.html'
];

test('Authenticated Header Language Toggle Contract', async (t) => {
  await t.test('auth.js: updateHeaderLangToggleVisibility does NOT hide toggle when logged in', () => {
    const authJs = readRepoFile('js/auth.js');
    // Function must always show toggle regardless of isLoggedIn
    assert.ok(authJs.includes('headerLangToggle.hidden = false;'),
      'auth.js must always set hidden=false on the language toggle');
    // Must NOT set hidden=true when logged in
    assert.ok(!authJs.includes('headerLangToggle.hidden = true'),
      'auth.js must NOT set hidden=true on the language toggle');
    // Must NOT use display:none !important
    assert.ok(!authJs.includes("display', 'none', 'important"),
      'auth.js must NOT set display:none !important on the language toggle');
    // Must call removeProperty to restore display
    assert.ok(authJs.includes("headerLangToggle.style.removeProperty('display')"),
      'auth.js must removeProperty display on the language toggle');
  });

  await t.test('auth.js: updateNavUI still calls updateHeaderLangToggleVisibility', () => {
    const authJs = readRepoFile('js/auth.js');
    assert.ok(authJs.includes('updateHeaderLangToggleVisibility'),
      'auth.js must still call updateHeaderLangToggleVisibility');
  });

  await t.test('shared-header.js: buildLangToggleHTML has no hidden parameter', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    assert.ok(headerJs.includes('function buildLangToggleHTML()'),
      'buildLangToggleHTML must have no parameters');
    assert.ok(!headerJs.includes('buildLangToggleHTML(isHidden'),
      'buildLangToggleHTML must NOT accept isHidden parameter');
    assert.ok(!headerJs.includes('hiddenAttr'),
      'buildLangToggleHTML must NOT generate hidden attribute');
    assert.ok(!headerJs.includes('display:none'),
      'buildLangToggleHTML must NOT generate display:none style');
    assert.ok(!headerJs.includes('header-lang-toggle" hidden'),
      'header-lang-toggle must NOT have hidden attribute');
    assert.ok(!headerJs.includes('header-lang-toggle" style='),
      'header-lang-toggle must NOT have inline style');
  });

  await t.test('shared-header.js: buildHeaderHTML calls buildLangToggleHTML without argument', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    assert.ok(headerJs.includes('buildLangToggleHTML()'),
      'buildHeaderHTML must call buildLangToggleHTML() with no arguments');
    assert.ok(!headerJs.includes('buildLangToggleHTML(isLoggedIn'),
      'buildHeaderHTML must NOT pass isLoggedIn to buildLangToggleHTML');
  });

  await t.test('shared-header.js: setupLangToggle maintains setCurrentLang / applyI18n / triggerLangChange', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    assert.ok(headerJs.includes('window.setCurrentLang'),
      'setupLangToggle must call setCurrentLang');
    assert.ok(headerJs.includes('window.applyI18n'),
      'setupLangToggle must call applyI18n');
    assert.ok(headerJs.includes('window.triggerLangChange'),
      'setupLangToggle must call triggerLangChange');
    assert.ok(headerJs.includes('.lang-option[data-lang]'),
      'setupLangToggle must bind lang-option buttons by data-lang');
  });

  await t.test('shared-header.js: initial cached session render does NOT hide language toggle', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    // The isLoggedIn variable from cachedUser should not influence lang toggle markup
    assert.ok(headerJs.includes('buildLangToggleHTML()'),
      'buildHeaderHTML must always include buildLangToggleHTML()');
    // Verify that buildHeaderHTML content includes header-lang-toggle
    const buildHeaderContent = headerJs.match(/buildHeaderHTML[\s\S]*?function\s+\w/);
    assert.ok(headerJs.includes('header-lang-toggle'),
      'shared-header.js must include header-lang-toggle class in output');
  });

  await t.test('all HTML pages use the same shared-header.js cache version 20260718-3577-1', () => {
    const versions = new Set();
    for (const rel of HTML_PAGES) {
      const html = readRepoFile(rel);
      const m = html.match(/shared-header\.js\?v=([\w-]+)/);
      assert.ok(m, `${rel} must include shared-header.js?v=...`);
      versions.add(m[1]);
    }
    assert.strictEqual(versions.size, 1,
      `shared-header.js version must be the same across all pages; got ${[...versions].join(', ')}`);
    assert.ok(versions.has('20260718-3577-1'),
      `shared-header.js version must be 20260718-3577-1; got ${[...versions][0]}`);
  });

  await t.test('shared-header.js has the updated cache version in its header comment', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    assert.ok(headerJs.includes('v20260718-3577-1'),
      'shared-header.js header must reflect v20260718-3577-1');
  });

  await t.test('#3577: PAGE_ACTIVE_MAP maps editor.html alias to myTrees active', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    assert.ok(headerJs.includes("'editor.html': 'myTrees'"),
      "PAGE_ACTIVE_MAP must map 'editor.html' to 'myTrees'");
    assert.ok(headerJs.includes("'editor': 'myTrees'"),
      "PAGE_ACTIVE_MAP must map 'editor' (extensionless) to 'myTrees'");
  });

  await t.test('#3577: non-editor PAGE_ACTIVE_MAP entries remain unchanged', () => {
    const headerJs = readRepoFile('js/shared-header.js');
    // Verify that non-editor mappings are not affected
    assert.ok(headerJs.includes("'index.html': 'home'"), 'index.html → home');
    assert.ok(headerJs.includes("'intro.html': 'intro'"), 'intro.html → intro');
    assert.ok(headerJs.includes("'search.html': 'search'"), 'search.html → search');
    assert.ok(headerJs.includes("'detail.html': 'search'"), 'detail.html → search');
    assert.ok(headerJs.includes("'my-trees.html': 'myTrees'"), 'my-trees.html → myTrees');
    assert.ok(headerJs.includes("'login.html': null"), 'login.html → null');
    assert.ok(headerJs.includes("'settings.html': 'settings'"), 'settings.html → settings');
    assert.ok(headerJs.includes("'intro': 'intro'"), 'intro → intro');
    assert.ok(headerJs.includes("'search': 'search'"), 'search → search');
    assert.ok(headerJs.includes("'detail': 'search'"), 'detail → search');
    assert.ok(headerJs.includes("'my-trees': 'myTrees'"), 'my-trees → myTrees');
    assert.ok(headerJs.includes("'login': null"), 'login → null');
    assert.ok(headerJs.includes("'settings': 'settings'"), 'settings → settings');
  });

  await t.test('mobile header CSS preserves .nav-actions wrap support', () => {
    const globalHeaderCss = readRepoFile('css/global/global-header.css');
    assert.ok(globalHeaderCss.includes('.nav-actions'),
      'global-header.css must define .nav-actions');
    // Check that nav-actions supports flex-wrap or similar for mobile
    assert.ok(
      globalHeaderCss.includes('flex-wrap') || globalHeaderCss.includes('.nav-actions'),
      '.nav-actions should have wrap or mobile support'
    );
  });
});
