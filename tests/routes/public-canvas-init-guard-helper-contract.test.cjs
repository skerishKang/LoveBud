const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps editor canvas initialization behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function initializePublicEditorCanvas(editorCanvas)'),
    'public canvas init must expose a local editor canvas init helper'
  );
  assert.ok(
    initSrc.includes("if (editorCanvas && typeof editorCanvas.initCanvas === 'function')"),
    'editor canvas init helper must preserve initCanvas guard'
  );
  assert.ok(
    initSrc.includes('editorCanvas.initCanvas();'),
    'editor canvas init helper must preserve initCanvas call'
  );
  assert.ok(
    initSrc.includes('return true;'),
    'editor canvas init helper must return true after initialization'
  );
  assert.ok(
    initSrc.includes('return false;'),
    'editor canvas init helper must return false when initialization is skipped'
  );
  assert.ok(
    initSrc.includes('initializePublicEditorCanvas(editorCanvas);'),
    'startCanvas must consume the local editor canvas init helper'
  );

  const startCanvasSrc = initSrc.substring(
    initSrc.indexOf('function startCanvas()'),
    initSrc.indexOf("console.log('[public-canvas] Canvas initialized successfully')")
  );

  assert.equal(
    startCanvasSrc.includes("if (editorCanvas && typeof editorCanvas.initCanvas === 'function')"),
    false,
    'startCanvas should not inline editorCanvas.initCanvas guard'
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
    initSrc.indexOf('function initializePublicEditorCanvas(editorCanvas)') < initSrc.indexOf('function initPublicCanvas()'),
    'editor canvas init helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('installPublicCanvasReadOnlyState(canvas, editorCanvas);') < initSrc.indexOf('initializePublicEditorCanvas(editorCanvas);'),
    'editor canvas init must remain after read-only state installation'
  );
  assert.ok(
    initSrc.indexOf('initializePublicEditorCanvas(editorCanvas);') < initSrc.indexOf('runPublicCanvasPostInitRefresh({'),
    'editor canvas init must remain before post-init refresh'
  );
});
