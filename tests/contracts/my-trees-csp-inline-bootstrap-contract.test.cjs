const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MY_TREES_HTML = path.join(ROOT, 'pages', 'my-trees.html');
const SCROLL_BOOTSTRAP = path.join(ROOT, 'js', 'my-trees', 'my-trees-scroll-bootstrap.js');
const PAGE_BOOTSTRAP = path.join(ROOT, 'js', 'my-trees', 'my-trees-page-bootstrap.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function indexOfOrFail(source, needle, label) {
  const index = source.indexOf(needle);
  assert.ok(index > -1, `missing ${label}`);
  return index;
}

test('My Trees page has no active inline script blocks', () => {
  const html = read(MY_TREES_HTML);
  const inlineScriptBlocks = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];

  assert.deepEqual(inlineScriptBlocks, []);
});

test('My Trees scroll bootstrap replaces the early inline scroll reset', () => {
  const html = read(MY_TREES_HTML);
  const scrollBootstrap = read(SCROLL_BOOTSTRAP);

  const titleIndex = indexOfOrFail(html, '<title>내 러브트리 | LoveTree</title>', 'page title');
  const scrollScriptIndex = indexOfOrFail(html, '../js/my-trees/my-trees-scroll-bootstrap.js?v=20260617-2606-1', 'scroll bootstrap script');
  const firstStylesheetIndex = indexOfOrFail(html, '../css/global.css', 'first stylesheet');

  assert.ok(titleIndex < scrollScriptIndex, 'scroll bootstrap must stay after title');
  assert.ok(scrollScriptIndex < firstStylesheetIndex, 'scroll bootstrap must run before stylesheets like the old head inline script');
  assert.match(scrollBootstrap, /scrollRestoration/);
  assert.match(scrollBootstrap, /history\.scrollRestoration\s*=\s*'manual'/);
  assert.match(scrollBootstrap, /window\.scrollTo\(0, 0\)/);
});

test('My Trees page bootstrap runs after required runtime dependencies', () => {
  const html = read(MY_TREES_HTML);

  const viewModeScriptIndex = indexOfOrFail(html, '../js/tree-view-mode-switcher.js?v=20260616-2533-1', 'view-mode switcher script');
  const sharedHeaderScriptIndex = indexOfOrFail(html, '../js/shared-header.js?v=20260421-2', 'shared header script');
  const pageTransitionsScriptIndex = indexOfOrFail(html, '../js/page-transitions.js?v=20260430-1', 'page transitions script');
  const pageBootstrapIndex = indexOfOrFail(html, '../js/my-trees/my-trees-page-bootstrap.js?v=20260617-2606-1', 'page bootstrap script');

  assert.ok(viewModeScriptIndex < pageBootstrapIndex, 'page bootstrap must load after tree-view-mode-switcher.js');
  assert.ok(sharedHeaderScriptIndex < pageBootstrapIndex, 'page bootstrap must load after shared-header.js');
  assert.ok(pageTransitionsScriptIndex < pageBootstrapIndex, 'page bootstrap must load after page-transitions.js at the old inline location');
});

test('My Trees page bootstrap preserves shared header and view mode init behavior', () => {
  const pageBootstrap = read(PAGE_BOOTSTRAP);

  assert.match(pageBootstrap, /renderSharedHeader\(\)/);
  assert.match(pageBootstrap, /LoveBudTreeViewModeSwitcher\.init/);
  assert.match(pageBootstrap, /storageKey:\s*'lovebud:myTrees:viewMode'/);
  assert.match(pageBootstrap, /defaultMode:\s*'large'/);
  assert.match(pageBootstrap, /mount:\s*'#myTreesViewModeMount'/);
  assert.match(pageBootstrap, /target:\s*'#trees-grid'/);
  assert.match(pageBootstrap, /DOMContentLoaded/);
});
