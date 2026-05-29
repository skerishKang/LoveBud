const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps canvas creation behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicEditorCanvas(canvasOptions)'),
    'public canvas init must expose a local canvas creation helper'
  );
  assert.ok(
    initSrc.includes('LoveBudPublicViewerCanvasAdapter'),
    'canvas creation helper must reference the public viewer canvas adapter'
  );
  assert.ok(
    initSrc.includes('adapter.createPublicViewerCanvas'),
    'canvas creation helper must delegate to adapter when available'
  );
  assert.ok(
    initSrc.includes('createEditorCanvas: window.createEditorCanvas'),
    'canvas creation helper must pass direct canvas factory into adapter'
  );
  assert.ok(
    initSrc.includes('editorCanvas = window.createEditorCanvas(canvasOptions);'),
    'canvas creation helper must preserve direct fallback assignment'
  );
  assert.ok(
    initSrc.includes('return editorCanvas;'),
    'canvas creation helper must return the created editor canvas'
  );
  assert.ok(
    initSrc.includes('editorCanvas = createPublicEditorCanvas(canvasOptions);'),
    'startCanvas must consume the local canvas creation helper'
  );
  assert.equal(
    initSrc.includes('var adapter = window.LoveBudPublicViewerCanvasAdapter;\n                var editorCanvas = adapter'),
    false,
    'startCanvas should not inline adapter canvas creation'
  );
  assert.ok(
    initSrc.indexOf('function createPublicEditorCanvas(canvasOptions)') < initSrc.indexOf('function initPublicCanvas()'),
    'canvas creation helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('editorCanvas = createPublicEditorCanvas(canvasOptions);') < initSrc.indexOf('installPublicCanvasReadOnlyState(canvas, editorCanvas);'),
    'canvas must be created before read-only state installation'
  );
  assert.ok(
    initSrc.indexOf('installPublicEditorReadOnlyState') < initSrc.indexOf('editorCanvas.initCanvas'),
    'read-only state setup must remain before editorCanvas.initCanvas'
  );
});
