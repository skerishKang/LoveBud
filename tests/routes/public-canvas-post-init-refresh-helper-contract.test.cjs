const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps post-init refresh behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function runPublicCanvasPostInitRefresh(ctx)'),
    'public canvas init must expose a local post-init refresh helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.runPublicPostInitRefresh({'),
    'post-init refresh helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('updateCanvasEmptyGuide: updateCanvasEmptyGuide'),
    'post-init refresh helper must pass empty guide updater to entry wrapper'
  );
  assert.ok(
    initSrc.includes('updateSidebarStatus: updateSidebarStatus'),
    'post-init refresh helper must pass sidebar updater to entry wrapper'
  );
  assert.ok(
    initSrc.includes('selectionState: selectionState'),
    'post-init refresh helper must pass selectionState to entry wrapper'
  );
  assert.ok(
    initSrc.includes('updateDetailPanel: updateDetailPanel'),
    'post-init refresh helper must pass detail panel updater to entry wrapper'
  );
  assert.ok(
    initSrc.includes('setDetailEmptyState: setDetailEmptyState'),
    'post-init refresh helper must pass empty state updater to entry wrapper'
  );
  assert.ok(
    initSrc.includes('updateCanvasEmptyGuide();'),
    'post-init refresh helper must preserve fallback empty guide updater call'
  );
  assert.ok(
    initSrc.includes('updateSidebarStatus();'),
    'post-init refresh helper must preserve fallback sidebar updater call'
  );
  assert.ok(
    initSrc.includes('var currentEditingMemory = selectionState.getCurrentEditingMemory();'),
    'post-init refresh helper must preserve fallback current memory lookup'
  );
  assert.ok(
    initSrc.includes('updateDetailPanel(currentEditingMemory);'),
    'post-init refresh helper must preserve fallback detail panel refresh'
  );
  assert.ok(
    initSrc.includes('setDetailEmptyState(false);'),
    'post-init refresh helper must preserve fallback empty state hide'
  );
  assert.ok(
    initSrc.includes('runPublicCanvasPostInitRefresh({'),
    'startCanvas must consume the local post-init refresh helper'
  );

  const startCanvasSrc = initSrc.substring(
    initSrc.indexOf('function startCanvas()'),
    initSrc.indexOf("console.log('[public-canvas] Canvas initialized successfully')")
  );

  assert.equal(
    startCanvasSrc.includes('canvasEntry.runPublicPostInitRefresh({'),
    false,
    'startCanvas should not inline runPublicPostInitRefresh delegation'
  );

  assert.ok(
    initSrc.includes("var MARKER = 'LoveBudPublicCanvasInitLoaded';"),
    'public canvas init marker must remain unchanged'
  );
  assert.equal(
    initSrc.includes('LoveBudPublicCanvasInitLoaded_setupPublicRoute'),
    false,
    'marker must not contain contract-test strings'
  );
  assert.equal(
    initSrc.includes('var _seq'),
    false,
    'source must not contain test-only sequence variables'
  );
  assert.ok(
    initSrc.indexOf('function runPublicCanvasPostInitRefresh(ctx)') < initSrc.indexOf('function initPublicCanvas()'),
    'post-init refresh helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('initializePublicEditorCanvas(editorCanvas);') < initSrc.indexOf('runPublicCanvasPostInitRefresh({'),
    'post-init refresh helper call must remain after editor canvas initialization'
  );
  assert.ok(
    initSrc.indexOf('runPublicCanvasPostInitRefresh({') < initSrc.indexOf("console.log('[public-canvas] Canvas initialized successfully')"),
    'post-init refresh helper call must remain before post-init logging'
  );
  assert.ok(
    initSrc.indexOf("console.log('[public-canvas] Canvas initialized successfully')") < initSrc.indexOf('installPublicCanvasToolbarCompactMode();'),
    'successful initialization logging must remain before toolbar compact mode setup'
  );
});
