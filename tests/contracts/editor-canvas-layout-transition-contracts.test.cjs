const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const TRANSITION_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-transition.js');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');

const transitionSource = fs.readFileSync(TRANSITION_PATH, 'utf8');
const canvasSource = fs.readFileSync(CANVAS_PATH, 'utf8');
const editorHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 1. Namespace existence
// ---------------------------------------------------------------------------

test('layout transition helper — LoveBudEditorCanvasLayoutTransition namespace is defined', () => {
  assert.match(
    transitionSource,
    /window\.LoveBudEditorCanvasLayoutTransition\s*=/,
    'window.LoveBudEditorCanvasLayoutTransition must be assigned'
  );
});

// ---------------------------------------------------------------------------
// 2. Function existence in helper
// ---------------------------------------------------------------------------

test('layout transition helper — applyLayoutModeClasses is exported', () => {
  assert.match(
    transitionSource,
    /applyLayoutModeClasses:\s*applyLayoutModeClasses/,
    'applyLayoutModeClasses must be exported on the namespace'
  );
});

test('layout transition helper — updateLayoutToggleUI is exported', () => {
  assert.match(
    transitionSource,
    /updateLayoutToggleUI:\s*updateLayoutToggleUI/,
    'updateLayoutToggleUI must be exported on the namespace'
  );
});

// ---------------------------------------------------------------------------
// 3. Class toggle targets preserved
// ---------------------------------------------------------------------------

test('layout transition helper — applyLayoutModeClasses toggles layout-structured', () => {
  assert.match(
    transitionSource,
    /classList\.add\s*\(\s*['"]layout-structured['"]\s*\)/,
    'must add "layout-structured" class'
  );
  assert.match(
    transitionSource,
    /classList\.remove\s*\(\s*['"]layout-free['"]\s*\)/,
    'must remove "layout-free" class'
  );
});

test('layout transition helper — applyLayoutModeClasses toggles layout-free', () => {
  assert.match(
    transitionSource,
    /classList\.add\s*\(\s*['"]layout-free['"]\s*\)/,
    'must add "layout-free" class'
  );
  assert.match(
    transitionSource,
    /classList\.remove\s*\(\s*['"]layout-structured['"]\s*\)/,
    'must remove "layout-structured" class'
  );
});

// ---------------------------------------------------------------------------
// 4. updateLayoutToggleUI targets preserved
// ---------------------------------------------------------------------------

test('layout transition helper — updateLayoutToggleUI queries layoutModeToggleBtn', () => {
  assert.match(
    transitionSource,
    /getElementById\s*\(\s*['"]layoutModeToggleBtn['"]\s*\)/,
    'must query #layoutModeToggleBtn'
  );
});

test('layout transition helper — updateLayoutToggleUI queries layoutModeToggleLabel', () => {
  assert.match(
    transitionSource,
    /getElementById\s*\(\s*['"]layoutModeToggleLabel['"]\s*\)/,
    'must query #layoutModeToggleLabel'
  );
});

test('layout transition helper — updateLayoutToggleUI queries layoutModeToggleIcon', () => {
  assert.match(
    transitionSource,
    /getElementById\s*\(\s*['"]layoutModeToggleIcon['"]\s*\)/,
    'must query #layoutModeToggleIcon'
  );
});

test('layout transition helper — updateLayoutToggleUI uses is-active class toggle', () => {
  assert.match(
    transitionSource,
    /classList\.toggle\s*\(\s*['"]is-active['"]\s*,\s*isStructured\s*\)/,
    'must toggle "is-active" class based on isStructured'
  );
});

test('layout transition helper — updateLayoutToggleUI preserves i18n fallback strings', () => {
  assert.match(
    transitionSource,
    /editor_layout_structured/,
    'must reference editor_layout_structured i18n key'
  );
  assert.match(
    transitionSource,
    /editor_layout_free/,
    'must reference editor_layout_free i18n key'
  );
});

test('layout transition helper — updateLayoutToggleUI preserves icon values', () => {
  assert.match(
    transitionSource,
    /account_tree/,
    'must use "account_tree" icon for structured mode'
  );
  assert.match(
    transitionSource,
    /auto_awesome/,
    'must use "auto_awesome" icon for free mode'
  );
});

// ---------------------------------------------------------------------------
// 5. editor-canvas.js delegation to layout transition helper
// ---------------------------------------------------------------------------

test('editor-canvas.js — references LoveBudEditorCanvasLayoutTransition', () => {
  assert.match(
    canvasSource,
    /window\.LoveBudEditorCanvasLayoutTransition/,
    'editor-canvas.js must reference window.LoveBudEditorCanvasLayoutTransition'
  );
});

test('editor-canvas.js — layoutTransition variable is assigned', () => {
  assert.match(
    canvasSource,
    /layoutTransition\s*=\s*window\.LoveBudEditorCanvasLayoutTransition/,
    'editor-canvas.js must assign layoutTransition from window global'
  );
});

// ---------------------------------------------------------------------------
// 6. Helper missing fallback — editor-canvas.js still references uiHelpers as fallback
// ---------------------------------------------------------------------------

test('editor-canvas.js — uiHelpers fallback is preserved for applyLayoutModeClasses', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.applyLayoutModeClasses/,
    'editor-canvas.js must retain uiHelpers.applyLayoutModeClasses as fallback'
  );
});

test('editor-canvas.js — uiHelpers fallback is preserved for updateLayoutToggleUI', () => {
  assert.match(
    canvasSource,
    /uiHelpers\.updateLayoutToggleUI/,
    'editor-canvas.js must retain uiHelpers.updateLayoutToggleUI as fallback'
  );
});

// ---------------------------------------------------------------------------
// 7. createEditorCanvas(deps) signature preserved
// ---------------------------------------------------------------------------

test('layout transition — createEditorCanvas(deps) signature preserved', () => {
  assert.match(
    canvasSource,
    /function createEditorCanvas\s*\(\s*deps\s*\)/,
    'createEditorCanvas(deps) function signature must be preserved'
  );
});

// ---------------------------------------------------------------------------
// 8. Public API — setLayoutMode still in return
// ---------------------------------------------------------------------------

test('layout transition — setLayoutMode is in public API returned by createEditorCanvas', () => {
  assert.match(
    canvasSource,
    /setLayoutMode\s*,/,
    'setLayoutMode must be returned as part of the public API'
  );
});

// ---------------------------------------------------------------------------
// 9. Script order — transition helper loaded before editor-canvas.js
// ---------------------------------------------------------------------------

test('layout transition — transition helper loaded before editor-canvas.js in editor.html', () => {
  const transitionIdx = editorHtml.indexOf('editor-canvas-layout-transition.js');
  const canvasIdx = editorHtml.indexOf('editor-canvas.js');
  assert.ok(transitionIdx >= 0, 'editor-canvas-layout-transition.js must be present in editor.html');
  assert.ok(canvasIdx >= 0, 'editor-canvas.js must be present in editor.html');
  assert.ok(transitionIdx < canvasIdx, 'transition helper must be loaded before editor-canvas.js');
});

// ---------------------------------------------------------------------------
// 10. IIFE pattern — helper uses self-executing function
// ---------------------------------------------------------------------------

test('layout transition helper — uses IIFE pattern', () => {
  assert.match(
    transitionSource,
    /\(function\s*\(\)\s*\{/,
    'helper must use IIFE pattern for encapsulation'
  );
});

// ---------------------------------------------------------------------------
// 11. switchToFreeMode / switchToStructuredMode still exist in editor-canvas.js
// ---------------------------------------------------------------------------

test('layout transition — switchToFreeMode still exists in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function switchToFreeMode\s*\(\)/,
    'switchToFreeMode must remain in editor-canvas.js'
  );
});

test('layout transition — switchToStructuredMode still exists in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function switchToStructuredMode\s*\(\)/,
    'switchToStructuredMode must remain in editor-canvas.js'
  );
});

test('layout transition — setLayoutMode still exists in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function setLayoutMode\s*\(mode\)/,
    'setLayoutMode must remain in editor-canvas.js'
  );
});

test('layout transition — toggleLayoutMode still exists in editor-canvas.js', () => {
  assert.match(
    canvasSource,
    /function toggleLayoutMode\s*\(\)/,
    'toggleLayoutMode must remain in editor-canvas.js'
  );
});
