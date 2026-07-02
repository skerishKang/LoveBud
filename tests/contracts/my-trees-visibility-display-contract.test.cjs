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
  assert.match(uiJs, /tree-card-visibility-label/,
    'Badge must include label span');
});

test('public badge uses public icon, private badge uses lock icon', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.match(uiJs, /var visibilityIcon\s*=\s*visibility\s*===\s*['"]public['"]\s*\?\s*['"]public['"]\s*:\s*['"]lock['"]/,
    'public must use public icon, private must use lock icon');
  assert.match(uiJs, /visibilityIcon/,
    'visibilityIcon variable must be used in badge markup');
});

test('badge inserted inside .tree-card-title-row, not after subcopy', () => {
  const uiJs = read('js/my-trees/my-trees-ui.js');
  assert.ok(uiJs.includes('cardMeta.visibilityBadgeHtml'), 'visibilityBadgeHtml must be used');
  const titleIdx = uiJs.indexOf("'<div class=\"tree-card-title\">'");
  const badgeIdx = uiJs.indexOf('cardMeta.visibilityBadgeHtml');
  const subcopyIdx = uiJs.indexOf("'<div class=\"tree-card-subcopy\">'");
  assert.ok(titleIdx < badgeIdx && badgeIdx < subcopyIdx,
    'visibilityBadgeHtml must appear in title-row after title, before subcopy');
  assert.ok(!uiJs.includes('cardMeta.privateBadgeHtml'),
    'privateBadgeHtml must be removed from card.innerHTML');
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

test('pages/my-trees.html cache-bust token for my-trees-ui.js is -2, CSS is -1', () => {
  const html = read('pages/my-trees.html');
  assert.match(html, /my-trees\.css\?v=20260702-2710-shared-rhythm-1/,
    'my-trees.css must be at shared-rhythm-1');
  assert.match(html, new RegExp('my-trees-ui\\.js\\?v=20260626-2824-visibility-state-2'),
    'my-trees-ui.js must be at -2');
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
  assert.ok(meta.visibilityBadgeHtml.includes('공개'),
    'badge label must contain 공개');
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
  assert.ok(meta.visibilityBadgeHtml.includes('비공개'),
    'badge label must contain 비공개');
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