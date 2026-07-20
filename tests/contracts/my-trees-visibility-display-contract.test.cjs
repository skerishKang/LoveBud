'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function createDelegateSandbox() {
  var sandbox = {
    window: {},
    document: { createElement: function () { return {}; } },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    LoveBudMyTreesUtils: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  var visualsJs = read('js/my-trees/my-trees-card-visuals.js');
  var uiJs = read('js/my-trees/my-trees-ui.js');
  vm.runInContext(visualsJs, sandbox);
  vm.runInContext(uiJs, sandbox);
  return sandbox;
}

test('normalizeTree visibility missing fallback is private', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.match(uiJs, /visibility:\s*tree\s*&&\s*tree\.visibility\s*===\s*['"]public['"]\s*\?\s*['"]public['"]\s*:\s*['"]private['"]/,
    'Fallback object must default visibility to private');
  assert.match(uiJs, /normalizedTree\.visibility\s*=\s*normalizedTree\.visibility\s*===\s*['"]public['"]\s*\?\s*['"]public['"]\s*:\s*['"]private['"]/,
    'normalizeTree must canonicalize visibility to public/private');
});

test('buildTreeCard dataset.visibility canonicalized to public or private', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.match(uiJs, /card\.dataset\.visibility\s*=\s*normalizedTree\.visibility/,
    'dataset.visibility must be set from normalizedTree');
  assert.match(uiJs, /normalizedTree\.visibility\s*=\s*normalizedTree\.visibility\s*===\s*['"]public['"]\s*\?\s*['"]public['"]\s*:\s*['"]private['"]/,
    'visibility must be canonicalized before dataset assignment');
});

test('getTreeCardMeta generates visibilityBadgeHtml for both public and private', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.match(uiJs, /meta\.visibilityBadgeHtml\s*=/,
    'getTreeCardMeta must return visibilityBadgeHtml');
  assert.match(uiJs, /buildVisibilityBadgeHtml/,
    'getTreeCardMeta must use buildVisibilityBadgeHtml helper');
  assert.match(uiJs, /'<span class="tree-card-visibility/,
    'Badge markup must contain tree-card-visibility class');
  // #3587: label span must NOT be rendered (quiet icon-only indicator)
  assert.ok(!uiJs.includes('tree-card-visibility-label'),
    'Badge must NOT include visible label span (#3587 demotion)');
});

test('public badge uses public icon, private badge uses lock icon', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.match(uiJs, /var visibilityIcon\s*=\s*visibility\s*===\s*['"]public['"]\s*\?\s*['"]public['"]\s*:\s*['"]lock['"]/,
    'public must use public icon, private must use lock icon');
  assert.match(uiJs, /visibilityIcon/,
    'visibilityIcon variable must be used in badge markup');
});

test('badge inserted via visibilityBadgeHtml slot in shared composition', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  const compJs = read('js/shared/tree-card-composition.js');
  assert.ok(uiJs.includes('cardMeta.visibilityBadgeHtml'), 'visibilityBadgeHtml must be provided');
  assert.ok(uiJs.includes('visibilityBadgeHtml: cardMeta.visibilityBadgeHtml'), 'visibilityBadgeHtml slot must be wired');
  assert.ok(compJs.includes('visibilityBadgeHtml'), 'visibilityBadgeHtml slot must exist in shared composition');
  // Verify visibility badge is inside title row in shared composition output
  assert.ok(compJs.indexOf('love-tree-card-visibility') > compJs.indexOf('love-tree-card-title-row'),
    'visibility badge must be inside title-row');
  assert.ok(!uiJs.includes('cardMeta.privateBadgeHtml'),
    'privateBadgeHtml must not be in my-trees-ui.js');
});

test('gate CSS does not hide .tree-card-visibility', () => {
  const gateCss = read('css/my-trees/my-trees-visibility-gate.css');
  assert.ok(!/\.tree-card-visibility\s*,/.test(gateCss),
    'tree-card-visibility must not be in the hide selector list');
  assert.ok(!/\.tree-card-visibility\s*\{[^}]*display:\s*none/.test(gateCss),
    'tree-card-visibility must not have display:none rule');
});

test('visual tokens .public and .private preserved', () => {
  const cardsCss = read('css/my-trees/my-trees-cards.css');
  assert.match(cardsCss, /\.tree-card-visibility\.public\s*\{/,
    '.tree-card-visibility.public token must exist');
  assert.match(cardsCss, /\.tree-card-visibility\.private\s*\{/,
    '.tree-card-visibility.private token must exist');
});

test('Browse public-tree adapter guard unchanged', () => {
  const adapterJs = read('js/api/public-tree-adapter.js');
  assert.ok(adapterJs.includes('.filter((tree) => tree.visibility'), 'Browse public-tree adapter must filter by public visibility');
  assert.ok(adapterJs.includes("=== 'public'"), 'Browse public-tree adapter must check for public visibility');
});

test('pages/my-trees.html cache-bust tokens are non-empty', () => {
  const html = read('pages/my-trees.html');
  assert.match(html, /my-trees\.css\?v=[^"'\s>]+/,
    'my-trees.css must carry a non-empty cache-bust query string');
  assert.match(html, /my-trees-ui\.js\?v=[^"'\s>]+/,
    'my-trees-ui.js must carry a non-empty cache-bust query string');
});

test('No Closes/Fixes/Resolves #1882 in changed files', () => {
  const changedFiles = [
    'js/my-trees/my-trees-ui.js',
    'css/my-trees/my-trees-visibility-gate.css',
    'css/my-trees/my-trees-cards.css',
    'pages/my-trees.html'
  ];
  for (const file of changedFiles) {
    const content = read(file);
    assert.ok(!content.includes('Closes #1882'), file + ' must not contain Closes #1882');
    assert.ok(!content.includes('Fixes #1882'), file + ' must not contain Fixes #1882');
    assert.ok(!content.includes('Resolves #1882'), file + ' must not contain Resolves #1882');
  }
});

test('delegate exists public card builds tree-card-visibility public badge', () => {
  var sandbox = createDelegateSandbox();
  var i18n = function (key) { return key; };

  var meta = sandbox.window.LoveBudMyTreesUI.getTreeCardMeta(
    { title: 'Public Tree', visibility: 'public', momentCount: 3 },
    i18n
  );

  assert.ok(meta, 'meta must be returned');
  assert.ok(meta.visibilityBadgeHtml, 'visibilityBadgeHtml must exist');
  assert.match(meta.visibilityBadgeHtml, /tree-card-visibility\s+public/,
    'badge must have public class');
  assert.match(meta.visibilityBadgeHtml, />public</,
    'badge icon must be public');
  // #3587: no visible label text (only inside aria-label/title attributes)
  assert.ok(!/>공개</.test(meta.visibilityBadgeHtml),
    'badge must NOT contain visible 공개 text node (#3587 demotion)');
  assert.ok(!meta.visibilityBadgeHtml.includes('tree-card-visibility-label'),
    'badge must NOT contain label span (#3587 demotion)');
  // #3587: aria-label + title preserved
  assert.match(meta.visibilityBadgeHtml, /aria-label="공개"/,
    'badge must preserve aria-label');
  assert.match(meta.visibilityBadgeHtml, /title="공개"/,
    'badge must preserve title tooltip');
  assert.equal(meta.title, 'Public Tree', 'title must be preserved');
  assert.ok(meta.mood, 'mood must exist');
});

test('delegate exists private card builds tree-card-visibility private badge', () => {
  var sandbox = createDelegateSandbox();
  var i18n = function (key) { return key; };

  var meta = sandbox.window.LoveBudMyTreesUI.getTreeCardMeta(
    { title: 'Private Tree', visibility: 'private', momentCount: 1 },
    i18n
  );

  assert.ok(meta, 'meta must be returned');
  assert.ok(meta.visibilityBadgeHtml, 'visibilityBadgeHtml must exist');
  assert.match(meta.visibilityBadgeHtml, /tree-card-visibility\s+private/,
    'badge must have private class');
  assert.match(meta.visibilityBadgeHtml, />lock</,
    'badge icon must be lock');
  // #3587: no visible label text (only inside aria-label/title attributes)
  assert.ok(!/>비공개</.test(meta.visibilityBadgeHtml),
    'badge must NOT contain visible 비공개 text node (#3587 demotion)');
  assert.ok(!meta.visibilityBadgeHtml.includes('tree-card-visibility-label'),
    'badge must NOT contain label span (#3587 demotion)');
  // #3587: aria-label + title preserved
  assert.match(meta.visibilityBadgeHtml, /aria-label="비공개"/,
    'badge must preserve aria-label');
  assert.match(meta.visibilityBadgeHtml, /title="비공개"/,
    'badge must preserve title tooltip');
  assert.equal(meta.title, 'Private Tree', 'title must be preserved');
});

test('delegate exists missing-visibility card defaults to private badge', () => {
  var sandbox = createDelegateSandbox();
  var i18n = function (key) { return key; };

  var meta = sandbox.window.LoveBudMyTreesUI.getTreeCardMeta(
    { title: 'Empty Vibe', momentCount: 0 },
    i18n
  );

  assert.ok(meta, 'meta must be returned');
  assert.ok(meta.visibilityBadgeHtml, 'visibilityBadgeHtml must exist');
  assert.match(meta.visibilityBadgeHtml, /tree-card-visibility\s+private/,
    'missing visibility must default to private badge');
  assert.match(meta.visibilityBadgeHtml, />lock</,
    'badge icon must be lock for missing visibility');
  assert.equal(meta.title, 'Empty Vibe', 'title must be preserved');
});

test('delegate exists delegated title and mood are preserved and visibilityBadgeHtml is overwritten', () => {
  var sandbox = createDelegateSandbox();
  var i18n = function (key) { return key; };

  var meta = sandbox.window.LoveBudMyTreesUI.getTreeCardMeta(
    { title: 'Keep Title', visibility: 'public', momentCount: 5 },
    i18n
  );

  assert.equal(meta.title, 'Keep Title', 'delegated title must survive');
  assert.ok(meta.visibilityBadgeHtml, 'visibilityBadgeHtml must be present');
  assert.ok(!meta.privateBadgeHtml || meta.visibilityBadgeHtml.indexOf('lock') < 0,
    'privateBadgeHtml must not leak or must be overwritten');
});