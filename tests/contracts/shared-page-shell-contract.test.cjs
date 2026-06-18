const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('Shared Page Shell Contract Verification', async (t) => {
  await t.test('Plan document contains Refs #2698 and no auto-closing keywords', () => {
    const doc = read('docs/product/lovebud-shared-page-shell-contract.md');
    assert.match(doc, /Refs #2698/, 'Document must contain Refs #2698');
    
    const forbidden = [
      /Closes #2698/i, /Fixes #2698/i, /Resolves #2698/i,
      /Closes #1882/i, /Fixes #1882/i, /Resolves #1882/i
    ];
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(doc), `Document must not contain closing pattern: ${pattern}`);
    }
  });

  await t.test('pages/search.html contains Browse page layout classes', () => {
    const searchHtml = read('pages/search.html');
    assert.ok(searchHtml.includes('class="search-container'), 'search.html must contain search-container');
    assert.ok(searchHtml.includes('class="preview-sidebar'), 'search.html must contain preview-sidebar');
    assert.ok(searchHtml.includes('browse-utility-row'), 'search.html must contain browse-utility-row');
    assert.ok(searchHtml.includes('browse-results-head'), 'search.html must contain browse-results-head');
  });

  await t.test('pages/my-trees.html contains My Trees page structure alignment target elements', () => {
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(myTreesHtml.includes('my-trees-with-hub'), 'my-trees.html must contain my-trees-with-hub');
    assert.ok(myTreesHtml.includes('my-trees-main-column'), 'my-trees.html must contain my-trees-main-column');
    assert.ok(myTreesHtml.includes('myTreesFinder'), 'my-trees.html must contain myTreesFinder');
    assert.ok(myTreesHtml.includes('my-trees-results-head'), 'my-trees.html must contain my-trees-results-head');
    assert.ok(myTreesHtml.includes('my-trees-hub-panel'), 'my-trees.html must contain my-trees-hub-panel');
    assert.ok(!myTreesHtml.includes('my-trees-dashboard-grid-shell'), 'Old grid shell my-trees-dashboard-grid-shell must not exist');
  });

  await t.test('index.html contains Home page layout structure classes', () => {
    const indexHtml = read('index.html');
    assert.ok(indexHtml.includes('home-v3-shell'), 'index.html must contain home-v3-shell');
    assert.ok(indexHtml.includes('home-v3-main'), 'index.html must contain home-v3-main');
    assert.ok(indexHtml.includes('home-v3-hero'), 'index.html must contain home-v3-hero');
    assert.ok(indexHtml.includes('home-v3-copy'), 'index.html must contain home-v3-copy');
    assert.ok(indexHtml.includes('home-v3-collage'), 'index.html must contain home-v3-collage');
  });

  await t.test('css/global/tokens.css defines necessary core spacing and sizing tokens', () => {
    const tokensCss = read('css/global/tokens.css');
    const requiredTokens = [
      '--page-shell-max',
      '--page-pad-desktop',
      '--page-pad-tablet',
      '--page-pad-mobile',
      '--hero-gap',
      '--hero-title-size',
      '--eyebrow-radius',
      '--lovetree-card-radius-lg'
    ];
    for (const token of requiredTokens) {
      assert.ok(tokensCss.includes(token), `tokens.css must define token: ${token}`);
    }
  });

  await t.test('css/search/search-base.css defines .search-container with desktop 2-column grid rhythm', () => {
    const searchBaseCss = read('css/search/search-base.css');
    assert.ok(searchBaseCss.includes('.search-container'), 'search-base.css must define .search-container');
    assert.match(searchBaseCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\)/, 'search-base.css grid layout column layout must align');
  });

  await t.test('css/my-trees/my-trees-preview-hub/layout.css defines .my-trees-with-hub with desktop 2-column grid rhythm', () => {
    const hubLayoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.ok(hubLayoutCss.includes('.my-trees-with-hub'), 'layout.css must define .my-trees-with-hub');
    assert.match(hubLayoutCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\)/, 'layout.css grid layout column layout must align');
  });

  await t.test('Verify no 3D orbit implementation is introduced and Scout is untouched', () => {
    const gitDiff = read('docs/product/lovebud-shared-page-shell-contract.md');
    assert.ok(!gitDiff.includes('orbit-viewer-canvas'), 'No 3D orbit component styling or integration');
    assert.ok(!gitDiff.includes('THREE.OrbitControls'), 'No 3D Three.js orbit component');
  });
});
