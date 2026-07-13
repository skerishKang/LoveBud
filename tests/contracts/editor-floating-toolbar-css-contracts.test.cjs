const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/editor/editor-floating-toolbar.css');
const TOOLBAR = path.join(ROOT, 'css/editor/editor-floating-toolbar/toolbar.css');
const QUICK_ADD = path.join(ROOT, 'css/editor/editor-floating-toolbar/quick-add.css');
const TOOLTIP = path.join(ROOT, 'css/editor/editor-floating-toolbar/tooltip.css');
const DROPDOWN = path.join(ROOT, 'css/editor/editor-floating-toolbar/dropdown.css');
const RESPONSIVE = path.join(ROOT, 'css/editor/editor-floating-toolbar/responsive.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const toolbar = fs.readFileSync(TOOLBAR, 'utf8');
const quickAdd = fs.readFileSync(QUICK_ADD, 'utf8');
const tooltip = fs.readFileSync(TOOLTIP, 'utf8');
const dropdown = fs.readFileSync(DROPDOWN, 'utf8');
const responsive = fs.readFileSync(RESPONSIVE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /editor-floating-toolbar\/toolbar\.css/);
  assert.match(manifest, /editor-floating-toolbar\/quick-add\.css/);
  assert.match(manifest, /editor-floating-toolbar\/tooltip\.css/);
  assert.match(manifest, /editor-floating-toolbar\/dropdown\.css/);
  assert.match(manifest, /editor-floating-toolbar\/responsive\.css/);
});

test('manifest is thin — fewer than 15 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 15, `Manifest should be <15 lines, got ${lineCount}`);
});

// ---------------------------------------------------------------------------
// 2. toolbar.css selectors
// ---------------------------------------------------------------------------
test('toolbar.css — .editor-floating-toolbar selector preserved', () => {
  assert.match(toolbar, /\.editor-floating-toolbar\s*\{/);
});

test('toolbar.css — .is-visible selector preserved', () => {
  assert.match(toolbar, /\.editor-floating-toolbar\.is-visible/);
});

test('toolbar.css — .is-hidden selector preserved', () => {
  assert.match(toolbar, /\.editor-floating-toolbar\.is-hidden/);
});

test('toolbar.css — .editor-floating-toolbar-btn selector preserved', () => {
  assert.match(toolbar, /\.editor-floating-toolbar-btn\s*\{/);
});

test('toolbar.css — .editor-floating-toolbar-label selector preserved', () => {
  assert.match(toolbar, /\.editor-floating-toolbar-label\s*\{/);
});

test('toolbar.css — .ftb-key-hint selector preserved', () => {
  assert.match(toolbar, /\.ftb-key-hint/);
});

test('toolbar.css — legacy .is-connecting state is not reintroduced', () => {
  assert.doesNotMatch(toolbar, /\.is-connecting\b/);
});

test('toolbar.css — legacy .is-connecting !important variant is not reintroduced', () => {
  assert.doesNotMatch(toolbar, /\.is-connecting[\s\S]*?!important/);
});

// ---------------------------------------------------------------------------
// 3. quick-add.css selectors
// ---------------------------------------------------------------------------
test('quick-add.css — .editor-floating-quick-add selector preserved', () => {
  assert.match(quickAdd, /\.editor-floating-quick-add\s*\{/);
});

test('quick-add.css — .editor-floating-quick-add.is-visible preserved', () => {
  assert.match(quickAdd, /\.editor-floating-quick-add\.is-visible/);
});

test('quick-add.css — default visible state stays visually soft', () => {
  assert.match(quickAdd, /\.editor-floating-quick-add\.is-visible\s*\{[\s\S]*?opacity:\s*0\.68/);
  assert.match(quickAdd, /\.editor-floating-quick-add\.is-visible\s*\{[\s\S]*?transform:\s*scale\(0\.92\)/);
  assert.match(quickAdd, /background:\s*rgba\(144,73,81,0\.14\)/);
  assert.match(quickAdd, /border:\s*1px solid rgba\(144,73,81,0\.22\)/);
});

test('quick-add.css — hover and focus restore clear action emphasis', () => {
  assert.match(quickAdd, /\.editor-floating-quick-add:hover,[\s\S]*?\.editor-floating-quick-add:focus-visible\s*\{[\s\S]*?background:\s*rgba\(144,73,81,0\.88\)/);
  assert.match(quickAdd, /\.editor-floating-quick-add:hover,[\s\S]*?\.editor-floating-quick-add:focus-visible\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(quickAdd, /\.editor-floating-quick-add:hover,[\s\S]*?\.editor-floating-quick-add:focus-visible\s*\{[\s\S]*?transform:\s*scale\(1\.08\)/);
});

// ---------------------------------------------------------------------------
// 4. tooltip.css selectors
// ---------------------------------------------------------------------------
test('tooltip.css — .editor-floating-tooltip selector preserved', () => {
  assert.match(tooltip, /\.editor-floating-tooltip\s*\{/);
});

test('tooltip.css — .editor-floating-tooltip.is-visible preserved', () => {
  assert.match(tooltip, /\.editor-floating-tooltip\.is-visible/);
});

// ---------------------------------------------------------------------------
// 5. dropdown.css selectors
// ---------------------------------------------------------------------------
test('dropdown.css — .editor-ftb-more-btn selector preserved', () => {
  assert.match(dropdown, /\.editor-ftb-more-btn\s*\{/);
});

test('dropdown.css — .editor-ftb-dropdown selector preserved', () => {
  assert.match(dropdown, /\.editor-ftb-dropdown\s*\{/);
});

test('dropdown.css — .editor-ftb-dropdown-item selector preserved', () => {
  assert.match(dropdown, /\.editor-ftb-dropdown-item\s*\{/);
});

test('dropdown.css — .editor-ftb-shortcut-hint selector preserved', () => {
  assert.match(dropdown, /\.editor-ftb-shortcut-hint/);
});

// ---------------------------------------------------------------------------
// 6. responsive.css selectors
// ---------------------------------------------------------------------------
test('responsive.css — @media 1023px preserved', () => {
  assert.match(responsive, /@media\s*\(max-width:\s*1023px\)/);
});

test('responsive.css — @media 479px preserved', () => {
  assert.match(responsive, /@media\s*\(max-width:\s*479px\)/);
});

test('responsive.css — display:none !important for mobile hide preserved', () => {
  assert.match(responsive, /display:\s*none\s*!important/);
});

// ---------------------------------------------------------------------------
// 7. Property values preserved
// ---------------------------------------------------------------------------
test('toolbar.css — z-index 10 preserved', () => {
  assert.match(toolbar, /z-index:\s*10/);
});

test('toolbar.css — border-radius 16px preserved', () => {
  assert.match(toolbar, /border-radius:\s*16px/);
});

test('quick-add.css — width 28px preserved', () => {
  assert.match(quickAdd, /width:\s*28px/);
});

test('tooltip.css — z-index 15 preserved', () => {
  assert.match(tooltip, /z-index:\s*15/);
});

test('dropdown.css — border-radius 14px preserved', () => {
  assert.match(dropdown, /border-radius:\s*14px/);
});

// ---------------------------------------------------------------------------
// 8. No forbidden content
// ---------------------------------------------------------------------------
test('no @keyframes in any split file', () => {
  assert.doesNotMatch(toolbar, /@keyframes/);
  assert.doesNotMatch(quickAdd, /@keyframes/);
  assert.doesNotMatch(tooltip, /@keyframes/);
  assert.doesNotMatch(dropdown, /@keyframes/);
  assert.doesNotMatch(responsive, /@keyframes/);
});
