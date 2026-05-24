const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/search/search-responsive.css');
const LAYOUT = path.join(ROOT, 'css/search/search-responsive/layout.css');
const TREE_CARDS = path.join(ROOT, 'css/search/search-responsive/tree-cards.css');
const MOBILE_PREVIEW = path.join(ROOT, 'css/search/search-responsive/mobile-preview.css');
const BROWSE = path.join(ROOT, 'css/search/search-responsive/browse.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const layout = fs.readFileSync(LAYOUT, 'utf8');
const treeCards = fs.readFileSync(TREE_CARDS, 'utf8');
const mobilePreview = fs.readFileSync(MOBILE_PREVIEW, 'utf8');
const browse = fs.readFileSync(BROWSE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /search-responsive\/layout\.css/);
  assert.match(manifest, /search-responsive\/tree-cards\.css/);
  assert.match(manifest, /search-responsive\/mobile-preview\.css/);
  assert.match(manifest, /search-responsive\/browse\.css/);
});

test('manifest is thin — fewer than 10 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 10, `Manifest should be <10 lines, got ${lineCount}`);
});

// ---------------------------------------------------------------------------
// 2. layout.css — tablet breakpoints
// ---------------------------------------------------------------------------
test('layout.css — @media 1240px preserved', () => {
  assert.match(layout, /@media\s*\(max-width:\s*1240px\)/);
});

test('layout.css — @media 1024px preserved', () => {
  assert.match(layout, /@media\s*\(max-width:\s*1024px\)/);
});

test('layout.css — search-container selector preserved', () => {
  assert.match(layout, /\.search-container\s*\{/);
});

test('layout.css — #resultsList selector preserved', () => {
  assert.match(layout, /#resultsList/);
});

test('layout.css — #growingTreesList selector preserved', () => {
  assert.match(layout, /#growingTreesList/);
});

test('layout.css — preview-sidebar selector preserved', () => {
  assert.match(layout, /\.preview-sidebar\s*\{/);
});

// ---------------------------------------------------------------------------
// 3. tree-cards.css — 375px
// ---------------------------------------------------------------------------
test('tree-cards.css — @media 375px preserved', () => {
  assert.match(treeCards, /@media\s*\(max-width:\s*375px\)/);
});

test('tree-cards.css — tree-card selector preserved', () => {
  assert.match(treeCards, /\.tree-card\s*\{/);
});

test('tree-cards.css — tree-title selector preserved', () => {
  assert.match(treeCards, /\.tree-title\s*\{/);
});

test('tree-cards.css — tree-card-preview-node selector preserved', () => {
  assert.match(treeCards, /\.tree-card-preview-node\s*\{/);
});

test('tree-cards.css — tree-meta-row selector preserved', () => {
  assert.match(treeCards, /\.tree-meta-row\s*\{/);
});

test('tree-cards.css — tree-card-media::before preserved', () => {
  assert.match(treeCards, /\.tree-card-media::before\s*\{/);
});

// ---------------------------------------------------------------------------
// 4. mobile-preview.css — 768px preview
// ---------------------------------------------------------------------------
test('mobile-preview.css — @media 768px preserved', () => {
  assert.match(mobilePreview, /@media\s*\(max-width:\s*768px\)/);
});

test('mobile-preview.css — preview-sidebar fixed position preserved', () => {
  assert.match(mobilePreview, /position:\s*fixed/);
});

test('mobile-preview.css — mobile-sheet-slide-up animation preserved', () => {
  assert.match(mobilePreview, /@keyframes\s+mobile-sheet-slide-up/);
});

test('mobile-preview.css — overlay-fade-in animation preserved', () => {
  assert.match(mobilePreview, /@keyframes\s+overlay-fade-in/);
});

test('mobile-preview.css — preview-sheet-overlay selector preserved', () => {
  assert.match(mobilePreview, /\.preview-sheet-overlay\s*\{/);
});

test('mobile-preview.css — preview-mobile-close selector preserved', () => {
  assert.match(mobilePreview, /\.preview-mobile-close\s*\{/);
});

test('mobile-preview.css — !important on preview-primary-action preserved', () => {
  assert.match(mobilePreview, /preview-primary-action[\s\S]*?!important/);
});

test('mobile-preview.css — prefers-reduced-motion preserved', () => {
  assert.match(mobilePreview, /prefers-reduced-motion/);
});

// ---------------------------------------------------------------------------
// 5. browse.css — search/browse controls
// ---------------------------------------------------------------------------
test('browse.css — @media 768px preserved', () => {
  assert.match(browse, /@media\s*\(max-width:\s*768px\)/);
});

test('browse.css — @media 480px preserved', () => {
  assert.match(browse, /@media\s*\(max-width:\s*480px\)/);
});

test('browse.css — search-panel-header selector preserved', () => {
  assert.match(browse, /\.search-panel-header/);
});

test('browse.css — search-input selector preserved', () => {
  assert.match(browse, /\.search-input\s*\{/);
});

test('browse.css — tag-chip selector preserved', () => {
  assert.match(browse, /\.tag-chip/);
});

test('browse.css — browse-results-head selector preserved', () => {
  assert.match(browse, /\.browse-results-head/);
});

test('browse.css — growing-trees-section selector preserved', () => {
  assert.match(browse, /\.growing-trees-section\s*\{/);
});

test('browse.css — filter-row selector preserved', () => {
  assert.match(browse, /\.filter-row\s*\{/);
});

// ---------------------------------------------------------------------------
// 6. No forbidden content
// ---------------------------------------------------------------------------
test('no @keyframes duplication — only in mobile-preview.css', () => {
  assert.doesNotMatch(layout, /@keyframes/);
  assert.doesNotMatch(treeCards, /@keyframes/);
  assert.doesNotMatch(browse, /@keyframes/);
});
