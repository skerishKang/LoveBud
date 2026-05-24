const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/editor/editor-responsive.css');
const TABLET = path.join(ROOT, 'css/editor/editor-responsive/tablet.css');
const MOBILE = path.join(ROOT, 'css/editor/editor-responsive/mobile.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const tablet = fs.readFileSync(TABLET, 'utf8');
const mobile = fs.readFileSync(MOBILE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /editor-responsive\/tablet\.css/);
  assert.match(manifest, /editor-responsive\/mobile\.css/);
});

test('manifest is thin — fewer than 8 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 8, `Manifest should be <8 lines, got ${lineCount}`);
});

// ---------------------------------------------------------------------------
// 2. tablet.css selectors (1024px)
// ---------------------------------------------------------------------------
test('tablet.css — @media 1024px preserved', () => {
  assert.match(tablet, /@media\s*\(max-width:\s*1024px\)/);
});

test('tablet.css — .editor-layout selector preserved', () => {
  assert.match(tablet, /\.editor-layout\s*\{/);
});

test('tablet.css — .sidebar selector preserved', () => {
  assert.match(tablet, /\.sidebar\s*\{/);
});

test('tablet.css — .tool-group selector preserved', () => {
  assert.match(tablet, /\.tool-group\s*\{/);
});

test('tablet.css — .tool-item selector preserved', () => {
  assert.match(tablet, /\.tool-item\s*\{/);
});

test('tablet.css — .detail-panel selector preserved', () => {
  assert.match(tablet, /\.detail-panel\s*\{/);
});

test('tablet.css — .canvas-area selector preserved', () => {
  assert.match(tablet, /\.canvas-area\s*\{/);
});

test('tablet.css — .node-card selector preserved', () => {
  assert.match(tablet, /\.node-card\s*\{/);
});

test('tablet.css — .node-img-wrapper selector preserved', () => {
  assert.match(tablet, /\.node-img-wrapper\s*\{/);
});

// ---------------------------------------------------------------------------
// 3. mobile.css selectors (768px)
// ---------------------------------------------------------------------------
test('mobile.css — @media 768px preserved', () => {
  assert.match(mobile, /@media\s*\(max-width:\s*768px\)/);
});

test('mobile.css — .editor-layout selector preserved', () => {
  assert.match(mobile, /\.editor-layout\s*\{/);
});

test('mobile.css — .sidebar selector preserved', () => {
  assert.match(mobile, /\.sidebar\s*\{/);
});

test('mobile.css — .editor-sidebar-back-link selector preserved', () => {
  assert.match(mobile, /\.editor-sidebar-back-link\s*\{/);
});

test('mobile.css — .detail-panel selector preserved', () => {
  assert.match(mobile, /\.detail-panel\s*\{/);
});

test('mobile.css — .detail-content selector preserved', () => {
  assert.match(mobile, /\.detail-content\s*\{/);
});

test('mobile.css — .editor-form-stack selector preserved', () => {
  assert.match(mobile, /\.editor-form-stack\s*\{/);
});

test('mobile.css — .editor-form-actions selector preserved', () => {
  assert.match(mobile, /\.editor-form-actions\s*\{/);
});

test('mobile.css — .editor-memory-form-modal selector preserved', () => {
  assert.match(mobile, /\.editor-memory-form-modal\s*\{/);
});

test('mobile.css — .node-card selector preserved', () => {
  assert.match(mobile, /\.node-card\s*\{/);
});

test('mobile.css — .editor-status-card selector preserved', () => {
  assert.match(mobile, /\.editor-status-card/);
});

test('mobile.css — .editor-title-settings-panel selector preserved', () => {
  assert.match(mobile, /\.editor-title-settings-panel\s*\{/);
});

test('mobile.css — .editor-add-card selector preserved', () => {
  assert.match(mobile, /\.editor-add-card\s*\{/);
});

// ---------------------------------------------------------------------------
// 4. Property values preserved
// ---------------------------------------------------------------------------
test('tablet.css — detail-panel z-index 2000 preserved', () => {
  assert.match(tablet, /z-index:\s*2000/);
});

test('tablet.css — canvas-area min-height 320px preserved', () => {
  assert.match(tablet, /min-height:\s*320px/);
});

test('mobile.css — editor-layout height calc preserved', () => {
  assert.match(mobile, /height:\s*calc\(100vh - 60px\)/);
});

test('mobile.css — canvas-empty-guide width min preserved', () => {
  assert.match(mobile, /width:\s*min\(342px/);
});

// ---------------------------------------------------------------------------
// 5. No forbidden content
// ---------------------------------------------------------------------------
test('no !important in any split file', () => {
  assert.doesNotMatch(tablet, /!important/);
  assert.doesNotMatch(mobile, /!important/);
});

test('no @keyframes in any split file', () => {
  assert.doesNotMatch(tablet, /@keyframes/);
  assert.doesNotMatch(mobile, /@keyframes/);
});

test('no @keyframes in any split file', () => {
  assert.doesNotMatch(tablet, /@keyframes/);
  assert.doesNotMatch(mobile, /@keyframes/);
});
