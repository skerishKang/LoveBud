const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps bridge lookup behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function getPublicCanvasBridge()'),
    'public canvas init must expose a local bridge lookup helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.getPublicCanvasBridge()'),
    'bridge helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('window.LoveBudPublicCanvasBridge'),
    'bridge helper must preserve direct bridge fallback'
  );
  assert.ok(
    initSrc.includes('var bridge = getPublicCanvasBridge();'),
    'initPublicCanvas must consume the local bridge helper'
  );
  assert.equal(
    initSrc.includes('var bridge = canvasEntry && typeof canvasEntry.getPublicCanvasBridge'),
    false,
    'initPublicCanvas should not inline bridge lookup'
  );
  assert.ok(
    initSrc.includes("console.error('[public-canvas] Bridge not loaded')"),
    'bridge missing error must be preserved'
  );
  assert.ok(
    initSrc.indexOf('function getPublicCanvasBridge()') > initSrc.indexOf('function initPublicCanvas()'),
    'bridge helper must be defined after initPublicCanvas'
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
    initSrc.includes("var _seq1"),
    false,
    'source must not contain test-only sequence variables'
  );

  assert.equal(
    initSrc.includes("var _seq2"),
    false,
    'source must not contain test-only sequence variables'
  );

  assert.equal(
    initSrc.includes("var _seq3"),
    false,
    'source must not contain test-only sequence variables'
  );
  assert.ok(
    initSrc.indexOf('var bridge = getPublicCanvasBridge();') < initSrc.indexOf('bridge.loadPublicTreeData(treeId)'),
    'bridge lookup must happen before public tree loading'
  );
});

test('public canvas init keeps normalization behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function normalizePublicCanvasData(bridge, tree, memories)'),
    'public canvas init must expose a local normalization helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.normalizePublicCanvasData(bridge, tree, memories)'),
    'normalization helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('bridge.normalizeForCanvas(tree, memories)'),
    'normalization helper must preserve bridge fallback'
  );
  assert.ok(
    initSrc.includes('var normalized = normalizePublicCanvasData(bridge, tree, memories);'),
    'data load flow must consume the local normalization helper'
  );
  assert.equal(
    initSrc.includes('var normalized = canvasEntry && typeof canvasEntry.normalizePublicCanvasData'),
    false,
    'data load flow should not inline normalization delegation'
  );
  assert.ok(
    initSrc.indexOf('function normalizePublicCanvasData(bridge, tree, memories)') > initSrc.indexOf('function initPublicCanvas()'),
    'normalization helper must be defined after initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('bridge.loadPublicTreeData(treeId).then(function(result)') < initSrc.indexOf('var normalized = normalizePublicCanvasData(bridge, tree, memories);'),
    'normalization must happen after public tree data load'
  );
  assert.ok(
    initSrc.indexOf('var normalized = normalizePublicCanvasData(bridge, tree, memories);') < initSrc.indexOf("console.log('[public-canvas] Loaded tree:'"),
    'normalization must happen before loaded tree logging'
  );
});
