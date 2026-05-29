const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps node click handling behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasNodeClickHandler(ctx)'),
    'public canvas init must expose a local node click handler factory'
  );
  assert.ok(
    initSrc.includes('return function(el, data)'),
    'node click helper must return an event handler'
  );
  assert.ok(
    initSrc.includes('if (!data) return;'),
    'node click helper must preserve missing data guard'
  );
  assert.ok(
    initSrc.includes('ctx.selectionState.selectMemory(data);'),
    'node click helper must preserve selection update'
  );
  assert.ok(
    initSrc.includes("document.querySelectorAll('.memory-node').forEach(function(n) { n.classList.remove('selected'); });"),
    'node click helper must preserve selected class reset'
  );
  assert.ok(
    initSrc.includes("if (el) el.classList.add('selected');"),
    'node click helper must preserve clicked element selected class'
  );
  assert.ok(
    initSrc.includes('ctx.updateDetailPanel(data);'),
    'node click helper must preserve detail panel update'
  );
  assert.ok(
    initSrc.includes('ctx.updateFocusSelectedBtn();'),
    'node click helper must preserve focus button update'
  );
  assert.ok(
    initSrc.includes('ctx.setDetailEmptyState(false);'),
    'node click helper must preserve detail empty state update'
  );
  assert.ok(
    initSrc.includes("var editorCanvas = typeof ctx.getEditorCanvas === 'function' ? ctx.getEditorCanvas() : null;"),
    'node click helper must lazily resolve editorCanvas'
  );
  assert.ok(
    initSrc.includes("if (editorCanvas && typeof editorCanvas.updateAffordance === 'function')"),
    'node click helper must preserve updateAffordance guard'
  );
  assert.ok(
    initSrc.includes('editorCanvas.updateAffordance();'),
    'node click helper must preserve updateAffordance call'
  );
  assert.ok(
    initSrc.includes('var editorCanvas;'),
    'startCanvas must declare editorCanvas before creating the node click handler'
  );
  assert.ok(
    initSrc.includes('var onPublicCanvasNodeClick = createPublicCanvasNodeClickHandler({'),
    'startCanvas must consume the local node click handler factory'
  );
  assert.ok(
    initSrc.includes('getEditorCanvas: function() { return editorCanvas; }'),
    'startCanvas must provide a lazy editorCanvas getter'
  );
  assert.ok(
    initSrc.includes('editorCanvas = createPublicEditorCanvas(canvasOptions);'),
    'startCanvas must assign editorCanvas after canvasOptions creation'
  );

  const startCanvasSrc = initSrc.substring(
    initSrc.indexOf('function startCanvas()'),
    initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({')
  );

  assert.equal(
    startCanvasSrc.includes('var onPublicCanvasNodeClick = function(el, data)'),
    false,
    'startCanvas should not inline node click handler'
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
    initSrc.indexOf('function createPublicCanvasNodeClickHandler(ctx)') < initSrc.indexOf('function initPublicCanvas()'),
    'node click handler factory must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var editorCanvas;') < initSrc.indexOf('var onPublicCanvasNodeClick = createPublicCanvasNodeClickHandler({'),
    'editorCanvas declaration must remain before handler creation'
  );
  assert.ok(
    initSrc.indexOf('var onPublicCanvasNodeClick = createPublicCanvasNodeClickHandler({') < initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({'),
    'node click handler must remain before canvas options creation'
  );
  assert.ok(
    initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({') < initSrc.indexOf('editorCanvas = createPublicEditorCanvas(canvasOptions);'),
    'editorCanvas assignment must remain after canvas options creation'
  );
});
