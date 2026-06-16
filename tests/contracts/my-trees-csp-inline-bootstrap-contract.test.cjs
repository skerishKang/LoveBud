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

test('My Trees page moves inline bootstraps to external scripts', () => {
  const html = read(MY_TREES_HTML);
  const inlineScriptBlocks = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];

  assert.deepEqual(inlineScriptBlocks, []);
  assert.match(html, /my-trees-scroll-bootstrap\.js\?v=20260617-2606-1/);
  assert.match(html, /my-trees-page-bootstrap\.js\?v=20260617-2606-1/);
  assert.doesNotMatch(html, /<script>\s*renderSharedHeader\(\);\s*<\/script>/);
  assert.doesNotMatch(html, /LoveBudTreeViewModeSwitcher\.init\([\s\S]*?<\/script>/);
});

test('My Trees external bootstraps preserve the old startup behavior', () => {
  const scrollBootstrap = read(SCROLL_BOOTSTRAP);
  const pageBootstrap = read(PAGE_BOOTSTRAP);

  assert.match(scrollBootstrap, /scrollRestoration/);
  assert.match(scrollBootstrap, /window\.scrollTo\(0, 0\)/);
  assert.match(pageBootstrap, /renderSharedHeader\(\)/);
  assert.match(pageBootstrap, /LoveBudTreeViewModeSwitcher\.init/);
  assert.match(pageBootstrap, /lovebud:myTrees:viewMode/);
  assert.match(pageBootstrap, /#myTreesViewModeMount/);
  assert.match(pageBootstrap, /#trees-grid/);
});
