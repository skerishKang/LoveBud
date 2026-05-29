const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps public tree result extraction behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function extractPublicCanvasResult(result)'),
    'public canvas init must expose a local result extraction helper'
  );
  assert.ok(
    initSrc.includes('tree: result.tree'),
    'result extraction helper must preserve tree extraction'
  );
  assert.ok(
    initSrc.includes('memories: result.memories'),
    'result extraction helper must preserve memories extraction'
  );
  assert.ok(
    initSrc.includes('var publicCanvasResult = extractPublicCanvasResult(result);'),
    'load flow must consume the result extraction helper'
  );
  assert.ok(
    initSrc.includes('var tree = publicCanvasResult.tree;'),
    'load flow must keep tree variable from extracted result'
  );
  assert.ok(
    initSrc.includes('var memories = publicCanvasResult.memories;'),
    'load flow must keep memories variable from extracted result'
  );
  assert.equal(
    initSrc.includes('var tree = result.tree;'),
    false,
    'load flow should not inline result.tree extraction'
  );
  assert.equal(
    initSrc.includes('var memories = result.memories;'),
    false,
    'load flow should not inline result.memories extraction'
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
    initSrc.indexOf('bridge.loadPublicTreeData(treeId).then(function(result)') < initSrc.indexOf('var publicCanvasResult = extractPublicCanvasResult(result);'),
    'result extraction must happen after public tree data load'
  );
  assert.ok(
    initSrc.indexOf('var publicCanvasResult = extractPublicCanvasResult(result);') < initSrc.indexOf('var normalized = normalizePublicCanvasData(bridge, tree, memories);'),
    'result extraction must happen before normalization'
  );
  assert.ok(
    initSrc.indexOf('var normalized = normalizePublicCanvasData(bridge, tree, memories);') < initSrc.indexOf("console.log('[public-canvas] Loaded tree:'"),
    'normalization must remain before loaded tree logging'
  );
});
