const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const UI_HELPERS_PATH = path.join(ROOT, 'js/editor/editor-canvas-ui-helpers.js');
const TRANSITION_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-transition.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');

const canvasSource = fs.readFileSync(CANVAS_PATH, 'utf8');
const uiHelpersSource = fs.readFileSync(UI_HELPERS_PATH, 'utf8');
const transitionSource = fs.readFileSync(TRANSITION_PATH, 'utf8');
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
// 2. Delegation to layoutModeSwitcher — switch functions delegate to factory
// ---------------------------------------------------------------------------

test('layout mode transition — switchToFreeMode delegates to layoutModeSwitcher', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /layoutModeSwitcher\.switchToFreeMode\(\)/,
    'switchToFreeMode must delegate to layoutModeSwitcher.switchToFreeMode()'
  );
});

test('layout mode transition — switchToStructuredMode delegates to layoutModeSwitcher', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    block,
    /layoutModeSwitcher\.switchToStructuredMode\(\)/,
    'switchToStructuredMode must delegate to layoutModeSwitcher.switchToStructuredMode()'
  );
});

test('layout mode transition — setLayoutMode delegates to layoutModeSwitcher', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function setLayoutMode'),
    canvasSource.indexOf('function toggleLayoutMode')
  );
  assert.match(
    block,
    /layoutModeSwitcher\.setLayoutMode\(mode\)/,
    'setLayoutMode must delegate to layoutModeSwitcher.setLayoutMode(mode)'
  );
});

test('layout mode transition — toggleLayoutMode delegates to layoutModeSwitcher', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function toggleLayoutMode'),
    canvasSource.indexOf('function updateLayoutToggleUI')
  );
  assert.match(
    block,
    /layoutModeSwitcher\.toggleLayoutMode\(\)/,
    'toggleLayoutMode must delegate to layoutModeSwitcher.toggleLayoutMode()'
  );
});

// ---------------------------------------------------------------------------
// 3. layoutModeSwitcher creation — factory is created after initCanvas
// ---------------------------------------------------------------------------

test('layout mode transition — layoutModeSwitcher is created using createLayoutModeSwitcher', () => {
  assert.match(
    canvasSource,
    /const layoutModeSwitcher\s*=\s*typeof layoutTransition\.createLayoutModeSwitcher\s*===\s*['"]function['"]/,
    'layoutModeSwitcher must be created using layoutTransition.createLayoutModeSwitcher'
  );
});

test('layout mode transition — layoutModeSwitcher is initialized after initCanvas', () => {
  const initCanvasIdx = canvasSource.indexOf('const initCanvas = () => {');
  const layoutModeSwitcherIdx = canvasSource.indexOf('const layoutModeSwitcher = typeof layoutTransition.createLayoutModeSwitcher');
  assert.ok(initCanvasIdx >= 0, 'initCanvas must exist');
  assert.ok(layoutModeSwitcherIdx >= 0, 'layoutModeSwitcher initialization must exist');
  assert.ok(layoutModeSwitcherIdx > initCanvasIdx, 'layoutModeSwitcher must be initialized after initCanvas');
});

test('layout mode transition — layoutModeSwitcher receives required options', () => {
  assert.match(canvasSource, /viewportState,\s*\n\s*loadStoredLayout/);
  assert.match(canvasSource, /persistLayoutMode,\s*\n\s*persistStoredPositions/);
  assert.match(canvasSource, /fitViewportToTree,\s*\n\s*initCanvas/);
  assert.match(canvasSource, /updateLayoutToggleUI/);
});

// ---------------------------------------------------------------------------
// 4. applyLayoutModeClasses handles body classList toggle
// ---------------------------------------------------------------------------

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
// 5. updateLayoutToggleUI delegates to uiHelpers
// ---------------------------------------------------------------------------

test('layout mode transition — updateLayoutToggleUI delegates to uiHelpers (direct or via transition helper)', () => {
  const updateBlock = canvasSource.slice(
    canvasSource.indexOf('function updateLayoutToggleUI'),
    canvasSource.indexOf('function updateLayoutToggleUI') + 400
  );
  assert.match(
    updateBlock,
    /updateLayoutToggleUI[^)]*\)\s*\(\s*viewportState\.layoutMode\s*,\s*i18n\s*\)/,
    'updateLayoutToggleUI must delegate via uiHelpers or layoutTransition helper'
  );
});

// ---------------------------------------------------------------------------
// 6. setLayoutMode public API — branching logic
// ---------------------------------------------------------------------------

test('layout mode transition — setLayoutMode is in the public API returned by createEditorCanvas', () => {
  assert.match(
    canvasSource,
    /setLayoutMode\s*,/,
    'setLayoutMode must be returned as part of the public API'
  );
});

// ---------------------------------------------------------------------------
// 7. Script order — helpers loaded before canvas
// ---------------------------------------------------------------------------

test('layout mode transition — storage helper loaded before editor-canvas.js in editor.html', () => {
  const storageIdx = editorHtml.indexOf('editor-canvas-layout-storage.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(storageIdx >= 0, 'editor-canvas-layout-storage.js must be present in editor.html');
  assert.ok(canvasIdx >= 0, 'editor-canvas.js must be present in editor.html');
  assert.ok(storageIdx < canvasIdx, 'storage helper must be loaded before editor-canvas.js');
});

test('layout mode transition — transition helper loaded before editor-canvas.js in editor.html', () => {
  const transitionIdx = editorHtml.indexOf('editor-canvas-layout-transition.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(transitionIdx >= 0, 'editor-canvas-layout-transition.js must be present in editor.html');
  assert.ok(canvasIdx >= 0, 'editor-canvas.js must be present in editor.html');
  assert.ok(transitionIdx < canvasIdx, 'transition helper must be loaded before editor-canvas.js');
});

// ---------------------------------------------------------------------------
// 8. createEditorCanvas is NOT modified — public API surface unchanged
// ---------------------------------------------------------------------------

test('layout mode transition — createEditorCanvas function signature is preserved', () => {
  assert.match(
    canvasSource,
    /function createEditorCanvas\s*\(\s*deps\s*\)/,
    'createEditorCanvas(deps) function signature must be preserved'
  );
});

// ---------------------------------------------------------------------------
// 9. Transition helper exports createLayoutModeSwitcher
// ---------------------------------------------------------------------------

test('layout mode transition — transition helper exports createLayoutModeSwitcher', () => {
  assert.match(
    transitionSource,
    /createLayoutModeSwitcher:\s*createLayoutModeSwitcher/,
    'createLayoutModeSwitcher must be exported on namespace'
  );
});

test('layout mode transition — transition helper exports persistLayoutMode', () => {
  assert.match(
    transitionSource,
    /persistLayoutMode:\s*persistLayoutMode/,
    'persistLayoutMode must be exported on namespace'
  );
});

// ---------------------------------------------------------------------------
// 10. updateLayoutToggleUI and uiHelpers fallbacks preserved
// ---------------------------------------------------------------------------

test('layout mode transition — uiHelpers.updateLayoutToggleUI preserved', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.updateLayoutToggleUI/,
    'uiHelpers.updateLayoutToggleUI fallback must remain'
  );
});

test('layout mode transition — uiHelpers.applyLayoutModeClasses preserved', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.applyLayoutModeClasses/,
    'uiHelpers.applyLayoutModeClasses fallback must remain'
  );
});

// ---------------------------------------------------------------------------
// 11. viewportState temporal dead zone — layoutModeSwitcher must come after
// ---------------------------------------------------------------------------

test('layout mode transition — viewportState is declared before layoutModeSwitcher', () => {
  const viewportStateIdx = canvasSource.indexOf('const viewportState = {');
  const layoutModeSwitcherIdx = canvasSource.indexOf('const layoutModeSwitcher = typeof layoutTransition.createLayoutModeSwitcher');
  assert.ok(viewportStateIdx >= 0, 'viewportState must be declared');
  assert.ok(layoutModeSwitcherIdx >= 0, 'layoutModeSwitcher must be initialized');
  assert.ok(viewportStateIdx < layoutModeSwitcherIdx, 'viewportState must be declared before layoutModeSwitcher to avoid temporal dead zone');
});

// ---------------------------------------------------------------------------
// 12. loadStoredLayout, persistLayoutMode, persistStoredPositions, fitViewportToTree, updateLayoutToggleUI must exist
// ---------------------------------------------------------------------------

test('layout mode transition — required local functions exist', () => {
  assert.match(canvasSource, /function loadStoredLayout\s*\(\)/);
  assert.match(canvasSource, /function persistLayoutMode\s*\(mode\)/);
  assert.match(canvasSource, /function persistStoredPositions\s*\(\)/);
  assert.match(canvasSource, /function fitViewportToTree\s*\(\)/);
  assert.match(canvasSource, /function updateLayoutToggleUI\s*\(\)/);
});
