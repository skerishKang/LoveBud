const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps selection state behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasSelectionState(canonicalRootId)'),
    'public canvas init must expose a local selection state helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createSelectionState(canonicalRootId)'),
    'selection state helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('var selectedNodeId = canonicalRootId;'),
    'selection state helper must preserve selectedNodeId initial value'
  );
  assert.ok(
    initSrc.includes('var currentEditingMemory = null;'),
    'selection state helper must preserve currentEditingMemory initial value'
  );
  assert.ok(
    initSrc.includes('getSelectedNodeId: function()'),
    'selection state helper must preserve getSelectedNodeId'
  );
  assert.ok(
    initSrc.includes('setSelectedNodeId: function(nextSelectedNodeId)'),
    'selection state helper must preserve setSelectedNodeId'
  );
  assert.ok(
    initSrc.includes('selectedNodeId = nextSelectedNodeId || null;'),
    'selection state helper must preserve selected node setter fallback'
  );
  assert.ok(
    initSrc.includes('getCurrentEditingMemory: function()'),
    'selection state helper must preserve getCurrentEditingMemory'
  );
  assert.ok(
    initSrc.includes('setCurrentEditingMemory: function(memory)'),
    'selection state helper must preserve setCurrentEditingMemory'
  );
  assert.ok(
    initSrc.includes('currentEditingMemory = memory || null;'),
    'selection state helper must preserve current editing memory setter'
  );
  assert.ok(
    initSrc.includes('selectMemory: function(memory)'),
    'selection state helper must preserve selectMemory'
  );
  assert.ok(
    initSrc.includes('selectedNodeId = memory && memory.id ? memory.id : selectedNodeId;'),
    'selection state helper must preserve selected node update on selectMemory'
  );
  assert.ok(
    initSrc.includes('var selectionState = createPublicCanvasSelectionState(canonicalRootId);'),
    'startCanvas must consume the local selection state helper'
  );
  assert.equal(
    initSrc.includes("var selectionState = canvasEntry && typeof canvasEntry.createSelectionState === 'function'"),
    false,
    'startCanvas should not inline selection state delegation'
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
    initSrc.indexOf('function createPublicCanvasSelectionState(canonicalRootId)') < initSrc.indexOf('function initPublicCanvas()'),
    'selection state helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var readOnlyActions = createPublicCanvasReadOnlyActions();') < initSrc.indexOf('var selectionState = createPublicCanvasSelectionState(canonicalRootId);'),
    'selection state must remain after read-only actions setup'
  );
  assert.ok(
    initSrc.indexOf('var selectionState = createPublicCanvasSelectionState(canonicalRootId);') < initSrc.indexOf('var detailUIOptions = createPublicCanvasDetailUIOptions({'),
    'selection state must remain before detail UI options setup'
  );
});
