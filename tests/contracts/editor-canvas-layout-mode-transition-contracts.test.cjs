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
    /applyLayoutModeClasses[^)]*\)\s*\(\s*['"]free['"]\s*\)/,
    'switchToFreeMode must call applyLayoutModeClasses("free") (directly or via delegation)'
  );
});

test('layout mode transition — switchToStructuredMode calls applyLayoutModeClasses("structured")', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    switchToStructuredBlock,
    /applyLayoutModeClasses[^)]*\)\s*\(\s*['"]structured['"]\s*\)/,
    'switchToStructuredMode must call applyLayoutModeClasses("structured") (directly or via delegation)'
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

// ---------------------------------------------------------------------------
// 11. Additional stabilization contracts for Stage 53
// ---------------------------------------------------------------------------

test('layout mode transition — switchToStructuredMode does NOT call persistStoredPositions', () => {
  const switchToStructuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.doesNotMatch(
    switchToStructuredBlock,
    /persistStoredPositions/,
    'switchToStructuredMode must not call persistStoredPositions()'
  );
});

test('layout mode transition — transition helper loaded before editor-canvas.js in editor.html', () => {
  const transitionIdx = editorHtml.indexOf('editor-canvas-layout-transition.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(transitionIdx >= 0, 'editor-canvas-layout-transition.js must be present in editor.html');
  assert.ok(canvasIdx >= 0, 'editor-canvas.js must be present in editor.html');
  assert.ok(transitionIdx < canvasIdx, 'transition helper must be loaded before editor-canvas.js');
});

// ---------------------------------------------------------------------------
// 12. Render refresh contracts — Stage 55
// ---------------------------------------------------------------------------

test('render refresh — switchToFreeMode calls initCanvas', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /initCanvas\s*\(\s*\)/,
    'switchToFreeMode must call initCanvas()'
  );
});

test('render refresh — switchToStructuredMode calls initCanvas', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    block,
    /initCanvas\s*\(\s*\)/,
    'switchToStructuredMode must call initCanvas()'
  );
});

test('render refresh — switchToFreeMode calls fitViewportToTree', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /fitViewportToTree\s*\(\s*\)/,
    'switchToFreeMode must call fitViewportToTree()'
  );
});

test('render refresh — switchToStructuredMode calls fitViewportToTree', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    block,
    /fitViewportToTree\s*\(\s*\)/,
    'switchToStructuredMode must call fitViewportToTree()'
  );
});

test('render refresh — switchToFreeMode calls persistStoredPositions', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /persistStoredPositions\s*\(\s*\)/,
    'switchToFreeMode must call persistStoredPositions()'
  );
});

test('render refresh — switchToStructuredMode does NOT call persistStoredPositions (asymmetry preserved)', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.doesNotMatch(
    block,
    /persistStoredPositions/,
    'switchToStructuredMode must not call persistStoredPositions()'
  );
});

test('render refresh — initCanvas is NOT delegated to transition helper', () => {
  assert.doesNotMatch(
    canvasSource,
    /layoutTransition\.initCanvas/,
    'initCanvas must NOT be delegated to layoutTransition helper'
  );
});

test('render refresh — fitViewportToTree delegated to transition helper with fallback', () => {
  assert.match(
    canvasSource,
    /layoutTransition\.fitViewportToTree/,
    'fitViewportToTree must be delegated to layoutTransition helper'
  );
});

test('render refresh — persistStoredPositions delegated to transition helper with fallback (free-mode only)', () => {
  assert.match(
    canvasSource,
    /layoutTransition\.persistStoredPositions/,
    'persistStoredPositions must be delegated to layoutTransition helper'
  );
});

test('render refresh — initCanvas call order: after class toggle and persistence delegation in switchToFreeMode', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  const classToggleIdx = block.search(/applyLayoutModeClasses/);
  const initCanvasIdx = block.search(/initCanvas\s*\(\s*\)/);
  assert.ok(classToggleIdx >= 0, 'applyLayoutModeClasses must appear in switchToFreeMode');
  assert.ok(initCanvasIdx >= 0, 'initCanvas must appear in switchToFreeMode');
  assert.ok(classToggleIdx < initCanvasIdx, 'initCanvas must come after class toggle in switchToFreeMode');
});

test('render refresh — initCanvas call order: after class toggle and persistence delegation in switchToStructuredMode', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  const classToggleIdx = block.search(/applyLayoutModeClasses/);
  const initCanvasIdx = block.search(/initCanvas\s*\(\s*\)/);
  assert.ok(classToggleIdx >= 0, 'applyLayoutModeClasses must appear in switchToStructuredMode');
  assert.ok(initCanvasIdx >= 0, 'initCanvas must appear in switchToStructuredMode');
  assert.ok(classToggleIdx < initCanvasIdx, 'initCanvas must come after class toggle in switchToStructuredMode');
});

test('render refresh — setLayoutMode/toggleLayoutMode public API preserved', () => {
  assert.match(
    canvasSource,
    /setLayoutMode\s*,/,
    'setLayoutMode must be in public API'
  );
});

test('render refresh — createEditorCanvas(deps) signature preserved', () => {
  assert.match(
    canvasSource,
    /function createEditorCanvas\s*\(\s*deps\s*\)/,
    'createEditorCanvas(deps) signature must be preserved'
  );
});

test('render refresh — LoveBudEditorCanvasLayoutTransition.persistLayoutMode helper API maintained', () => {
  const transitionSrc = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-canvas-layout-transition.js'),
    'utf8'
  );
  assert.match(
    transitionSrc,
    /persistLayoutMode:\s*persistLayoutMode/,
    'persistLayoutMode must be exported on namespace'
  );
});

test('render refresh — script order unchanged: transition helper before canvas.js', () => {
  const transitionIdx = editorHtml.indexOf('editor-canvas-layout-transition.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(transitionIdx < canvasIdx, 'transition helper must load before editor-canvas.js');
});

test('render refresh — helper missing fallback: uiHelpers.applyLayoutModeClasses preserved', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.applyLayoutModeClasses/,
    'uiHelpers.applyLayoutModeClasses fallback must remain'
  );
});

test('render refresh — helper missing fallback: uiHelpers.updateLayoutToggleUI preserved', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.updateLayoutToggleUI/,
    'uiHelpers.updateLayoutToggleUI fallback must remain'
  );
});

test('render refresh — helper missing fallback: direct persistLayoutMode call preserved', () => {
  assert.match(
    canvasSource,
    /else\s*\{[\s\S]*?persistLayoutMode\s*\(\s*['"]free['"]\s*\)/,
    'direct persistLayoutMode("free") fallback must remain'
  );
  assert.match(
    canvasSource,
    /else\s*\{[\s\S]*?persistLayoutMode\s*\(\s*['"]structured['"]\s*\)/,
    'direct persistLayoutMode("structured") fallback must remain'
  );
});

// ---------------------------------------------------------------------------
// 13. persistStoredPositions delegation contracts — Stage 57
// ---------------------------------------------------------------------------

test('persistStoredPositions delegation — switchToFreeMode calls persistStoredPositions via helper', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /layoutTransition\.persistStoredPositions\s*\(\s*persistStoredPositions\s*\)/,
    'switchToFreeMode must delegate persistStoredPositions via layoutTransition helper'
  );
});

test('persistStoredPositions delegation — switchToFreeMode has fallback to direct persistStoredPositions', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    block,
    /else\s*\{[\s\S]*?persistStoredPositions\s*\(\s*\)/,
    'switchToFreeMode must have fallback to direct persistStoredPositions() call'
  );
});

test('persistStoredPositions delegation — switchToStructuredMode still does NOT call persistStoredPositions', () => {
  const block = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.doesNotMatch(
    block,
    /persistStoredPositions/,
    'switchToStructuredMode must not call persistStoredPositions() (asymmetry preserved)'
  );
});

test('persistStoredPositions delegation — fitViewportToTree delegation from Stage 56 not broken', () => {
  const freeBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToFreeMode'),
    canvasSource.indexOf('function switchToStructuredMode')
  );
  assert.match(
    freeBlock,
    /layoutTransition\.fitViewportToTree\s*\(\s*fitViewportToTree\s*\)/,
    'Stage 56 fitViewportToTree delegation must remain in switchToFreeMode'
  );
  const structuredBlock = canvasSource.slice(
    canvasSource.indexOf('function switchToStructuredMode'),
    canvasSource.indexOf('function setLayoutMode')
  );
  assert.match(
    structuredBlock,
    /layoutTransition\.fitViewportToTree\s*\(\s*fitViewportToTree\s*\)/,
    'Stage 56 fitViewportToTree delegation must remain in switchToStructuredMode'
  );
});

test('persistStoredPositions delegation — initCanvas is NOT delegated to transition helper', () => {
  assert.doesNotMatch(
    canvasSource,
    /layoutTransition\.initCanvas/,
    'initCanvas must NOT be delegated to layoutTransition helper'
  );
});

test('persistStoredPositions delegation — helper missing fallback: direct persistStoredPositions preserved', () => {
  assert.match(
    canvasSource,
    /else\s*\{[\s\S]*?persistStoredPositions\s*\(\s*\)/,
    'direct persistStoredPositions() fallback must remain'
  );
});

