const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('Browse and My Trees Card Density & Empty-State Rhythm Invariant Checks', async (t) => {
  await t.test('Contract document exists and contains Refs #2703', () => {
    const doc = read('docs/product/lovebud-browse-mytrees-card-density-rhythm-contract.md');
    assert.match(doc, /Refs #2703/, 'Document must contain Refs #2703');

    const forbidden = [
      /Closes #2703/i, /Fixes #2703/i, /Resolves #2703/i,
      /Closes #1882/i, /Fixes #1882/i, /Resolves #1882/i
    ];
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(doc), `Document must not contain closing pattern: ${pattern}`);
    }
  });

  await t.test('My Trees cards CSS utilizes shared tokens and grid layouts', () => {
    const cardsCss = read('css/my-trees/my-trees-cards.css');
    assert.match(cardsCss, /\.trees-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*var\(--lovetree-card-grid-gap\);[^}]*}/);
    assert.match(cardsCss, /border-radius:\s*var\(--lovetree-card-radius\)/);
    assert.match(cardsCss, /box-shadow:\s*var\(--lovetree-card-shadow\)/);
    assert.match(cardsCss, /box-shadow:\s*var\(--lovetree-card-shadow-hover\)/);
    assert.match(cardsCss, /box-shadow:\s*var\(--lovetree-card-ring-active\),\s*var\(--lovetree-card-shadow-active\)/);
    assert.match(cardsCss, /height:\s*var\(--lovetree-card-image-height\)/);
  });

  await t.test('Browse tree card layout CSS utilizes shared tokens', () => {
    const browseCardCss = read('css/search/search-tree-card/layout.css');
    assert.match(browseCardCss, /border-radius:\s*var\(--lovetree-card-radius-lg\)/);
    assert.match(browseCardCss, /padding:\s*var\(--lovetree-card-content-pad-compact\)/);
    assert.match(browseCardCss, /height:\s*var\(--lovetree-card-media-height-browse\)/);
  });

  await t.test('Browse search-empty-state.css utilizes empty state tokens', () => {
    const searchEmptyCss = read('css/search/search-empty-state.css');
    assert.match(searchEmptyCss, /color:\s*var\(--lovetree-empty-state-text\)/);
    assert.match(searchEmptyCss, /opacity:\s*var\(--lovetree-empty-state-icon-opacity\)/);
    assert.match(searchEmptyCss, /color:\s*var\(--lovetree-empty-state-icon-color\)/);
    assert.match(searchEmptyCss, /font-weight:\s*var\(--lovetree-empty-state-heading-weight\)/);
  });

  await t.test('My Trees my-trees-states.css utilizes empty state tokens', () => {
    const myTreesStatesCss = read('css/my-trees/my-trees-states.css');
    assert.match(myTreesStatesCss, /background:\s*var\(--lovetree-empty-state-surface\)/);
    assert.match(myTreesStatesCss, /border-radius:\s*var\(--lovetree-empty-state-radius\)/);
    assert.match(myTreesStatesCss, /border:\s*1px solid var\(--lovetree-empty-state-border\)/);
    assert.match(myTreesStatesCss, /box-shadow:\s*var\(--lovetree-empty-state-shadow\)/);
  });

  await t.test('css/global/tokens.css defines shared card density tokens', () => {
    const tokens = read('css/global/tokens.css');
    assert.match(tokens, /--lovetree-card-grid-gap:\s*24px;/);
    assert.match(tokens, /--lovetree-card-content-pad:\s*18px;/);
    assert.match(tokens, /--lovetree-card-content-pad-compact:\s*14px;/);
    assert.match(tokens, /--lovetree-card-media-height-browse:\s*336px;/);
    assert.match(tokens, /--lovetree-card-media-height-mytrees:\s*184px;/);
  });

  await t.test('No 3D orbit viewer code is introduced and Scout is untouched', () => {
    const doc = read('docs/product/lovebud-browse-mytrees-card-density-rhythm-contract.md');
    assert.ok(!doc.includes('orbit-viewer-canvas'), 'No 3D orbit component integration');
  });
});
