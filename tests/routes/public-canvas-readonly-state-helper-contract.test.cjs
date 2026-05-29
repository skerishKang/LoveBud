const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps read-only editor state install behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function installPublicCanvasReadOnlyState(canvas, editorCanvas)'),
    'public canvas init must expose a local read-only state helper'
  );
  assert.ok(
    initSrc.includes("canvasEntry.installPublicEditorReadOnlyState(canvas, editorCanvas);"),
    'read-only state helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('if (canvas) canvas.__editorCanvasInstance = editorCanvas;'),
    'read-only state helper must preserve canvas instance fallback'
  );
  assert.ok(
    initSrc.includes('window.LoveBudEditor = window.LoveBudEditor || {};'),
    'read-only state helper must preserve editor namespace fallback'
  );
  assert.ok(
    initSrc.includes('window.LoveBudEditor.canEdit = false;'),
    'read-only state helper must preserve read-only canEdit fallback'
  );
  assert.ok(
    initSrc.includes('installPublicCanvasReadOnlyState(canvas, editorCanvas);'),
    'startCanvas must consume the local read-only state helper'
  );
  const startCanvasSrc = initSrc.substring(initSrc.indexOf('function startCanvas()'), initSrc.indexOf('var editorCanvas = createPublicEditorCanvas(canvasOptions);'));
  assert.equal(
    startCanvasSrc.includes("if (canvasEntry && typeof canvasEntry.installPublicEditorReadOnlyState === 'function')"),
    false,
    'startCanvas should not inline read-only editor state installation'
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
    initSrc.indexOf('function installPublicCanvasReadOnlyState(canvas, editorCanvas)') < initSrc.indexOf('function initPublicCanvas()'),
    'read-only state helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var editorCanvas = createPublicEditorCanvas(canvasOptions);') < initSrc.indexOf('installPublicCanvasReadOnlyState(canvas, editorCanvas);'),
    'read-only state install must remain after editor canvas creation'
  );
  assert.ok(
    initSrc.indexOf('installPublicCanvasReadOnlyState(canvas, editorCanvas);') < initSrc.indexOf('initializePublicEditorCanvas(editorCanvas);'),
    'read-only state install must remain before canvas initialization'
  );
  assert.ok(
    initSrc.indexOf('initializePublicEditorCanvas(editorCanvas);') < initSrc.indexOf('runPublicCanvasPostInitRefresh({'),
    'editor canvas initialization must remain before post-init refresh'
  );

  assert.equal(
    initSrc.includes('var method = "installPublicEditor" + "ReadOnlyState";'),
    false,
    'source must not hide installPublicEditorReadOnlyState behind dynamic method construction'
  );

  assert.equal(
    initSrc.includes('// canvasEntry.installPublicEditorReadOnlyState(canvas, editorCanvas)'),
    false,
    'source must not keep trace comments only for contract tests'
  );
});
