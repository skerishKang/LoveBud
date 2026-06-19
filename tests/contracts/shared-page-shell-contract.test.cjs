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
    assert.ok(myTreesHtml.includes('my-trees-container'), 'my-trees.html must contain my-trees-container');
    assert.ok(myTreesHtml.includes('lovetree-calm-two-column-shell'), 'my-trees.html must opt into shared .lovetree-calm-two-column-shell');
    assert.ok(myTreesHtml.includes('lovetree-calm-main-column'), 'my-trees.html must contain .lovetree-calm-main-column');
    assert.ok(myTreesHtml.includes('lovetree-calm-right-rail'), 'my-trees.html must contain .lovetree-calm-right-rail');
    assert.ok(myTreesHtml.includes('myTreesFinder'), 'my-trees.html must contain myTreesFinder');
    assert.ok(myTreesHtml.includes('my-trees-results-head'), 'my-trees.html must contain my-trees-results-head');
    assert.ok(myTreesHtml.includes('my-trees-hub-panel'), 'my-trees.html must contain my-trees-hub-panel');
    assert.ok(!myTreesHtml.includes('my-trees-with-hub'), 'Obsolete my-trees-with-hub wrapper must be removed');
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

  await t.test('css/my-trees/my-trees-preview-hub/layout.css keeps hub empty/loaded state toggles', () => {
    const hubLayoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.match(
      hubLayoutCss,
      /\.my-trees-hub-panel\.is-empty\s+\.my-trees-hub-content/,
      'layout.css must hide hub content when empty'
    );
    assert.match(
      hubLayoutCss,
      /\.my-trees-hub-panel:not\(\.is-empty\)\s+\.my-trees-hub-placeholder/,
      'layout.css must hide hub placeholder when loaded'
    );
  });

  await t.test('Verify no 3D orbit implementation is introduced and Scout is untouched', () => {
    const gitDiff = read('docs/product/lovebud-shared-page-shell-contract.md');
    assert.ok(!gitDiff.includes('orbit-viewer-canvas'), 'No 3D orbit component styling or integration');
    assert.ok(!gitDiff.includes('THREE.OrbitControls'), 'No 3D Three.js orbit component');
  });

  await t.test('shared CSS file exists and defines .lovetree-calm-two-column-shell', () => {
    const filePath = 'css/global/lovetree-calm-page-shell.css';
    const content = read(filePath);
    assert.ok(content.length > 200, 'Shared CSS should be populated');
    assert.match(content, /\.lovetree-calm-two-column-shell/, 'Must define lovetree-calm-two-column-shell class');
    assert.match(content, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\)/, 'Shared CSS must define the correct columns');
  });

  await t.test('css/global.css imports shared calm page shell CSS', () => {
    const globalCss = read('css/global.css');
    assert.match(globalCss, /@import url\(['"]\.\/global\/lovetree-calm-page-shell\.css['"]\);/, 'global.css must import lovetree-calm-page-shell.css');
  });

  await t.test('pages/search.html includes shared calm shell classes', () => {
    const searchHtml = read('pages/search.html');
    assert.ok(searchHtml.includes('lovetree-calm-two-column-shell'), 'search.html must include class lovetree-calm-two-column-shell');
    assert.ok(searchHtml.includes('lovetree-calm-main-column'), 'search.html must include class lovetree-calm-main-column');
    assert.ok(searchHtml.includes('lovetree-calm-right-rail'), 'search.html must include class lovetree-calm-right-rail');
    assert.ok(searchHtml.includes('browse-utility-row lovetree-calm-utility-row'), 'search.html must contain browse-utility-row lovetree-calm-utility-row');
    assert.ok(searchHtml.includes('browse-results-head lovetree-calm-results-head'), 'search.html must contain browse-results-head lovetree-calm-results-head');
  });

  await t.test('pages/my-trees.html includes shared calm shell classes', () => {
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(myTreesHtml.includes('lovetree-calm-two-column-shell'), 'my-trees.html must include class lovetree-calm-two-column-shell');
    assert.ok(myTreesHtml.includes('lovetree-calm-main-column'), 'my-trees.html must include class lovetree-calm-main-column');
    assert.ok(myTreesHtml.includes('lovetree-calm-right-rail'), 'my-trees.html must include class lovetree-calm-right-rail');
    assert.ok(myTreesHtml.includes('my-trees-finder lovetree-calm-utility-row'), 'my-trees.html must contain my-trees-finder lovetree-calm-utility-row');
    assert.ok(myTreesHtml.includes('my-trees-results-head lovetree-calm-results-head'), 'my-trees.html must contain my-trees-results-head lovetree-calm-results-head');
    assert.ok(myTreesHtml.includes('my-trees-results-title-row'), 'my-trees.html must retain my-trees-results-title-row');
    assert.ok(myTreesHtml.includes('my-trees-results-controls'), 'my-trees.html must retain my-trees-results-controls');
  });

  await t.test('Verify calm page shell css defines row baseline classes', () => {
    const calmCss = read('css/global/lovetree-calm-page-shell.css');
    assert.ok(calmCss.includes('.lovetree-calm-utility-row'), 'calm page shell CSS must define lovetree-calm-utility-row');
    assert.ok(calmCss.includes('.lovetree-calm-results-head'), 'calm page shell CSS must define lovetree-calm-results-head');
  });
});
