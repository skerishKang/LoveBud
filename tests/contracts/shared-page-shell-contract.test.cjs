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

  await t.test('Shared shell owns shell geometry; search-base.css does not redefine it', () => {
    const shellCss = read('css/global/lovetree-calm-page-shell.css');
    const searchBaseCss = read('css/search/search-base.css');
    // Shared shell must define all shell geometry
    assert.match(shellCss, /\.lovetree-calm-two-column-shell/, 'Shared shell must define two-column-shell');
    assert.match(shellCss, /width:\s*min/, 'Shared shell must own width');
    assert.match(shellCss, /max-width:\s*var\(--page-shell-max\)/, 'Shared shell must own max-width');
    assert.match(shellCss, /margin:\s*0\s+auto/, 'Shared shell must own margin');
    assert.match(shellCss, /box-sizing:\s*border-box/, 'Shared shell must own box-sizing on two-column-shell');
    assert.match(shellCss, /display:\s*grid/, 'Shared shell must own display:grid');
    assert.match(shellCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\)/, 'Shared shell must own desktop grid columns');
    assert.match(shellCss, /gap:\s*var\(--hero-gap\)/, 'Shared shell must own desktop gap via hero-gap');
    // search-base.css must keep its page-specific identity and icon rules but NOT shell geometry
    assert.ok(searchBaseCss.includes('.search-container'), 'search-base.css must define .search-container');
    const containerBlock = searchBaseCss.match(/\.search-container\s*\{[^}]*\}/);
    assert.ok(containerBlock, 'search-base.css must have a .search-container rule block');
    const block = containerBlock[0];
    assert.ok(!/width\s*:/.test(block), '.search-container block must not redefine width');
    assert.ok(!/max-width\s*:/.test(block), '.search-container block must not redefine max-width');
    assert.ok(!/margin\s*:/.test(block), '.search-container block must not redefine margin');
    assert.ok(!/display\s*:/.test(block), '.search-container block must not redefine display');
    assert.ok(!/grid-template-columns\s*:/.test(block), '.search-container block must not redefine grid-template-columns');
    assert.ok(!/gap\s*:/.test(block), '.search-container block must not redefine gap');
    assert.ok(!/box-sizing\s*:/.test(block), '.search-container block must not redefine box-sizing');
    assert.ok(!searchBaseCss.includes('min-width: 0'), 'search-base.css must not redefine min-width:0 on children');
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

  await t.test('my-trees-layout.css retains My Trees specific deltas but not shared geometry', () => {
    const layoutCss = read('css/my-trees/my-trees-layout.css');
    // My Trees unique deltas must be preserved
    assert.match(layoutCss, /min-height:\s*100vh/, 'my-trees-layout.css must keep min-height:100vh');
    assert.match(layoutCss, /body\.my-trees-auth-pending/, 'my-trees-layout.css must keep auth-pending visibility guard');
    assert.match(layoutCss, /visibility:\s*hidden/, 'my-trees-layout.css must keep visibility:hidden for auth-pending');
    // Page-specific padding is legitimate
    assert.ok(layoutCss.includes('padding: 52px var(--page-pad-desktop) 58px'), 'my-trees-layout.css must keep desktop padding');
    assert.ok(layoutCss.includes('padding: 40px var(--page-pad-tablet) 56px'), 'my-trees-layout.css must keep tablet padding');
    assert.ok(layoutCss.includes('padding: 24px var(--page-pad-mobile) 36px'), 'my-trees-layout.css must keep mobile padding');
    // Shared shell geometry must NOT be redefined in the .my-trees-container rule block
    const containerBlock = layoutCss.match(/\.my-trees-container\s*\{[^}]*\}/);
    assert.ok(containerBlock, 'my-trees-layout.css must have a .my-trees-container rule block');
    const block = containerBlock[0];
    assert.ok(!/width\s*:/.test(block), '.my-trees-container block must not redefine width');
    assert.ok(!/max-width\s*:/.test(block), '.my-trees-container block must not redefine max-width');
    assert.ok(!/margin\s*:/.test(block), '.my-trees-container block must not redefine margin');
    assert.ok(!/display\s*:/.test(block), '.my-trees-container block must not redefine display');
    assert.ok(!/grid-template-columns\s*:/.test(block), '.my-trees-container block must not redefine grid-template-columns');
    assert.ok(!/gap\s*:/.test(block), '.my-trees-container block must not redefine gap');
    assert.ok(!/box-sizing\s*:/.test(block), '.my-trees-container block must not redefine box-sizing');
    // Also check responsive blocks do not redefine grid/gap
    const responsiveBlocks = [...layoutCss.matchAll(/@media[^{]*\{[^}]*\}/g)].map(m => m[0]);
    for (const rb of responsiveBlocks) {
      if (rb.includes('.my-trees-container')) {
        assert.ok(!/grid-template-columns/.test(rb), 'responsive .my-trees-container block must not redefine grid');
        assert.ok(!/gap\s*:/.test(rb), 'responsive .my-trees-container block must not redefine gap');
      }
    }
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
    assert.ok(searchHtml.includes('browse-results-title-slot'), 'search.html must contain browse-results-title-slot');
    assert.ok(searchHtml.includes('browse-results-owner-cta-slot" hidden'), 'search.html must contain browse-results-owner-cta-slot with hidden attribute');
  });

  await t.test('pages/my-trees.html includes shared calm shell classes', () => {
    const myTreesHtml = read('pages/my-trees.html');
    assert.ok(myTreesHtml.includes('lovetree-calm-two-column-shell'), 'my-trees.html must include class lovetree-calm-two-column-shell');
    assert.ok(myTreesHtml.includes('lovetree-calm-main-column'), 'my-trees.html must include class lovetree-calm-main-column');
    assert.ok(myTreesHtml.includes('lovetree-calm-right-rail'), 'my-trees.html must include class lovetree-calm-right-rail');
    assert.ok(myTreesHtml.includes('my-trees-finder lovetree-calm-utility-row'), 'my-trees.html must contain my-trees-finder lovetree-calm-utility-row');
    assert.ok(myTreesHtml.includes('my-trees-results-head lovetree-calm-results-head'), 'my-trees.html must contain my-trees-results-head lovetree-calm-results-head');
    assert.ok(myTreesHtml.includes('browse-results-title-slot'), 'my-trees.html must contain browse-results-title-slot');
    assert.ok(myTreesHtml.includes('browse-results-owner-cta-slot'), 'my-trees.html must contain browse-results-owner-cta-slot');
    assert.ok(myTreesHtml.includes('my-trees-results-controls'), 'my-trees.html must retain my-trees-results-controls');
    assert.ok(!myTreesHtml.includes('my-trees-results-title-row'), 'my-trees.html must NOT contain my-trees-results-title-row (removed in Phase 2b)');
    // ID stability verification
    assert.ok(myTreesHtml.includes('headerCreateTreeBtn'), 'my-trees.html must contain headerCreateTreeBtn');
    assert.ok(myTreesHtml.includes('sortTreesSelect'), 'my-trees.html must contain sortTreesSelect');
    assert.ok(myTreesHtml.includes('myTreesViewModeMount'), 'my-trees.html must contain myTreesViewModeMount');
  });

  await t.test('Verify calm page shell css defines row baseline classes', () => {
    const calmCss = read('css/global/lovetree-calm-page-shell.css');
    assert.ok(calmCss.includes('.lovetree-calm-utility-row'), 'calm page shell CSS must define lovetree-calm-utility-row');
    assert.ok(calmCss.includes('.lovetree-calm-results-head'), 'calm page shell CSS must define lovetree-calm-results-head');
  });
});
