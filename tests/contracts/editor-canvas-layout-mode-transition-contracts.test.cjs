const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const UI_HELPERS_PATH = path.join(ROOT, 'js/editor/editor-canvas-ui-helpers.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');

const canvasSource = fs.readFileSync(CANVAS_PATH, 'utf8');
const uiHelpersSource = fs.readFileSync(UI_HELPERS_PATH, 'utf8');
const editorHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 1. Function existence — layout mode transition functions must exist
// ---------------------------------------------------------------------------

test('layout mode transition — switchToFreeMode is defined in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function switchToFreeMode\s*\(\)/,
    'switchToFreeMode() must be defined as a zero-arg function'
  );
});

test('layout mode transition — switchToStructuredMode is defined in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function switchToStructuredMode\s*\(\)/,
    'switchToStructuredMode() must be defined as a zero-arg function'
  );
});

test('layout mode transition — setLayoutMode is defined in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function setLayoutMode\s*\(mode\)/,
    'setLayoutMode(mode) must be defined with one parameter'
  );
});

test('layout mode transition — toggleLayoutMode is defined in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function toggleLayoutMode\s*\(\)/,
    'toggleLayoutMode() must be defined as a zero-arg function'
  );
});

test('layout mode transition — updateLayoutToggleUI is defined in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function updateLayoutToggleUI\s*\(\)/,
    'updateLayoutToggleUI() must be defined as a zero-arg function'
  );
});

// ---------------------------------------------------------------------------
// 2. Class toggle — applyLayoutModeClasses must be called with correct modes
// ---------------------------------------------------------------------------

test('layout mode transition — switchToFreeMode calls applyLayoutModeClasses("free")', () => {
  const switchToFreeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    switchToFreeBlock,
    /applyLayoutModeClasses\s*\(\s*['"]free['"]\s*\)/,
    'switchToFreeMode must call applyLayoutModeClasses("free")'
  );
});

test('layout mode transition — switchToStructuredMode calls applyLayoutModeClasses("structured")', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    switchToStructuredBlock,
    /applyLayoutModeClasses\s*\(\s*['"]structured['"]\s*\)/,
    'switchToStructuredMode must call applyLayoutModeClasses("structured")'
  );
});

test('layout mode transition — applyLayoutModeClasses handles body classList toggle', () => {
  assert.match(
    uiHelpersSource,
    /classList\.add\s*\(\s*['"]layout-structured['"]\s*\)/,
    'applyLayoutModeClasses must add "layout-structured" class'
  );
  assert.match(
    uiHelpersSource,
    /classList\.add\s*\(\s*['"]layout-free['"]\s*\)/,
    'applyLayoutModeClasses must add "layout-free" class'
  );
  assert.match(
    uiHelpersSource,
    /classList\.remove\s*\(\s*['"]layout-structured['"]\s*\)/,
    'applyLayoutModeClasses must remove "layout-structured" class'
  );
  assert.match(
    uiHelpersSource,
    /classList\.remove\s*\(\s*['"]layout-free['"]\s*\)/,
    'applyLayoutModeClasses must remove "layout-free" class'
  );
});

// ---------------------------------------------------------------------------
// 3. localStorage persistence — must delegate to storageUtils
// ---------------------------------------------------------------------------

test('layout mode transition — switchToFreeMode persists mode as "free"', () => {
  const switchToFreeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    switchToFreeBlock,
    /persistLayoutMode\s*\(\s*['"]free['"]\s*\)/,
    'switchToFreeMode must persist layout mode as "free"'
  );
});

test('layout mode transition — switchToStructuredMode persists mode as "structured"', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    switchToStructuredBlock,
    /persistLayoutMode\s*\(\s*['"]structured['"]\s*\)/,
    'switchToStructuredMode must persist layout mode as "structured"'
  );
});

test('layout mode transition — switchToFreeMode calls persistStoredPositions', () => {
  const switchToFreeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    switchToFreeBlock,
    /persistStoredPositions\s*\(\s*\)/,
    'switchToFreeMode must call persistStoredPositions()'
  );
});

// ---------------------------------------------------------------------------
// 4. Render refresh — fitViewportToTree and initCanvas must be called
// ---------------------------------------------------------------------------

test('layout mode transition — switchToFreeMode calls fitViewportToTree', () => {
  const switchToFreeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    switchToFreeBlock,
    /fitViewportToTree\s*\(\s*\)/,
    'switchToFreeMode must call fitViewportToTree()'
  );
});

test('layout mode transition — switchToStructuredMode calls fitViewportToTree', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    switchToStructuredBlock,
    /fitViewportToTree\s*\(\s*\)/,
    'switchToStructuredMode must call fitViewportToTree()'
  );
});

test('layout mode transition — switchToFreeMode calls initCanvas', () => {
  const switchToFreeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    switchToFreeBlock,
    /initCanvas\s*\(\s*\)/,
    'switchToFreeMode must call initCanvas()'
  );
});

test('layout mode transition — switchToStructuredMode calls initCanvas', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    switchToStructuredBlock,
    /initCanvas\s*\(\s*\)/,
    'switchToStructuredMode must call initCanvas()'
  );
});

// ---------------------------------------------------------------------------
// 5. updateLayoutToggleUI delegates to uiHelpers
// ---------------------------------------------------------------------------

test('layout mode transition — updateLayoutToggleUI delegates to uiHelpers', () => {
  const updateBlock = canvasSource.slice(
    canvasSource.indexOf('function updateLayoutToggleUI'),
    canvasSource.indexOf('function updateLayoutToggleUI') + 200
  );
  assert.match(
    updateBlock,
    /uiHelpers\.updateLayoutToggleUI\s*\(\s*viewportState\.layoutMode\s*,\s*i18n\s*\)/,
    'updateLayoutToggleUI must delegate to uiHelpers.updateLayoutToggleUI(viewportState.layoutMode, i18n)'
  );
});

// ---------------------------------------------------------------------------
// 6. setLayoutMode public API — branching logic
// ---------------------------------------------------------------------------

test('layout mode transition — setLayoutMode routes "structured" to switchToStructuredMode', () => {
  const setBlock = canvasSource.slice(
    canvasSource.indexOf('function setLayoutMode'),
    canvasSource.indexOf('function toggleLayoutMode')
  );
  assert.match(
    setBlock,
    /mode\s*===\s*['"]structured['"]\s*\)\s*\{[\s\S]*?switchToStructuredMode\s*\(\s*\)/,
    'setLayoutMode("structured") must call switchToStructuredMode()'
  );
});

test('layout mode transition — setLayoutMode routes other values to switchToFreeMode', () => {
  const setBlock = canvasSource.slice(
    canvasSource.indexOf('function setLayoutMode'),
    canvasSource.indexOf('function toggleLayoutMode')
  );
  assert.match(
    setBlock,
    /else\s*\{[\s\S]*?switchToFreeMode\s*\(\s*\)/,
    'setLayoutMode(non-"structured") must call switchToFreeMode()'
  );
});

// ---------------------------------------------------------------------------
// 7. toggleLayoutMode — branching logic
// ---------------------------------------------------------------------------

test('layout mode transition — toggleLayoutMode switches based on current layoutMode', () => {
  const toggleBlock = canvasSource.slice(
    canvasSource.indexOf('function toggleLayoutMode'),
    canvasSource.indexOf('function updateLayoutToggleUI')
  );
  assert.match(
    toggleBlock,
    /viewportState\.layoutMode\s*===\s*['"]structured['"]\s*\)\s*\{[\s\S]*?switchToFreeMode/,
    'toggleLayoutMode must call switchToFreeMode when current mode is "structured"'
  );
  assert.match(
    toggleBlock,
    /else\s*\{[\s\S]*?switchToStructuredMode/,
    'toggleLayoutMode must call switchToStructuredMode when current mode is not "structured"'
  );
});

// ---------------------------------------------------------------------------
// 8. setLayoutMode is exposed in createEditorCanvas return
// ---------------------------------------------------------------------------

test('layout mode transition — setLayoutMode is in the public API returned by createEditorCanvas', () => {
  // The return block exposes setLayoutMode
  assert.match(
    canvasSource,
    /setLayoutMode\s*,/,
    'setLayoutMode must be returned as part of the public API'
  );
});

// ---------------------------------------------------------------------------
// 9. Script order — layout storage helper loaded before canvas
// ---------------------------------------------------------------------------

test('layout mode transition — storage helper loaded before editor-canvas.js in editor.html', () => {
  const storageIdx = editorHtml.indexOf('editor-canvas-layout-storage.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(storageIdx >= 0, 'editor-canvas-layout-storage.js must be present in editor.html');
  assert.ok(canvasIdx >= 0, 'editor-canvas.js must be present in editor.html');
  assert.ok(storageIdx < canvasIdx, 'storage helper must be loaded before editor-canvas.js');
});

// ---------------------------------------------------------------------------
// 10. createEditorCanvas is NOT modified — public API surface unchanged
// ---------------------------------------------------------------------------

test('layout mode transition — createEditorCanvas function signature is preserved', () => {
  assert.match(
    canvasSource,
    /function createEditorCanvas\s*\(\s*deps\s*\)/,
    'createEditorCanvas(deps) function signature must be preserved'
  );
});
