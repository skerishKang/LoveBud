const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps canvas options behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasOptions(ctx)'),
    'public canvas init must expose a local canvas options helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createCanvasOptions({'),
    'canvas options helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('canvas: ctx.canvas'),
    'canvas options helper must preserve canvas'
  );
  assert.ok(
    initSrc.includes('svg: ctx.svg'),
    'canvas options helper must preserve svg'
  );
  assert.ok(
    initSrc.includes('publicCanvasConfig: ctx.publicCanvasConfig'),
    'canvas options helper must pass publicCanvasConfig to entry wrapper'
  );
  assert.ok(
    initSrc.includes('readOnlyActions: ctx.readOnlyActions'),
    'canvas options helper must pass readOnlyActions to entry wrapper'
  );
  assert.ok(
    initSrc.includes('getCanonicalRootId: function() { return ctx.canonicalRootId; }'),
    'canvas options helper must preserve canonical root getter'
  );
  assert.ok(
    initSrc.includes('isRootMemory: ctx.isRootMemory'),
    'canvas options helper must preserve isRootMemory'
  );
  assert.ok(
    initSrc.includes('updateDetailPanel: ctx.updateDetailPanel'),
    'canvas options helper must preserve updateDetailPanel'
  );
  assert.ok(
    initSrc.includes('setDetailEmptyState: ctx.setDetailEmptyState'),
    'canvas options helper must preserve setDetailEmptyState'
  );
  assert.ok(
    initSrc.includes('updateFocusSelectedBtn: ctx.updateFocusSelectedBtn'),
    'canvas options helper must preserve updateFocusSelectedBtn'
  );
  assert.ok(
    initSrc.includes('return ctx.publicCanvasConfig.createInitialMemory(ctx.canonicalRootId);'),
    'canvas options helper must preserve initial memory creation'
  );
  assert.ok(
    initSrc.includes('onNodeClick: ctx.onNodeClick'),
    'canvas options helper must preserve onNodeClick'
  );
  assert.ok(
    initSrc.includes('getTreeMemories: ctx.publicCanvasConfig.getTreeMemories'),
    'canvas options fallback must preserve getTreeMemories'
  );
  assert.ok(
    initSrc.includes('resolveMemoryThumbnail: ctx.publicCanvasConfig.resolveMemoryThumbnail'),
    'canvas options fallback must preserve thumbnail resolver'
  );
  assert.ok(
    initSrc.includes('openAddMoment: ctx.readOnlyActions.noop'),
    'canvas options fallback must preserve add moment no-op'
  );
  assert.ok(
    initSrc.includes('canEdit: false'),
    'canvas options fallback must preserve read-only canEdit flag'
  );
  assert.ok(
    initSrc.includes('var canvasOptions = createPublicCanvasOptions({'),
    'startCanvas must consume the local canvas options helper'
  );
  assert.equal(
    initSrc.includes("var canvasOptions = canvasEntry && typeof canvasEntry.createCanvasOptions === 'function'"),
    false,
    'startCanvas should not inline canvas options delegation'
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
    initSrc.indexOf('function createPublicCanvasOptions(ctx)') < initSrc.indexOf('function initPublicCanvas()'),
    'canvas options helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var onPublicCanvasNodeClick = createPublicCanvasNodeClickHandler({') < initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({'),
    'node click handler must remain before canvas options creation'
  );
  assert.ok(
    initSrc.indexOf('var canvasOptions = createPublicCanvasOptions({') < initSrc.indexOf('editorCanvas = createPublicEditorCanvas(canvasOptions);'),
    'canvas options must remain before editor canvas assignment'
  );
  assert.ok(
    initSrc.indexOf('editorCanvas = createPublicEditorCanvas(canvasOptions);') < initSrc.indexOf('installPublicCanvasReadOnlyState(canvas, editorCanvas);'),
    'editor canvas creation must remain before read-only state install'
  );
});
