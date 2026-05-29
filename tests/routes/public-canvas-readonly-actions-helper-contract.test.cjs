const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps read-only actions behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasReadOnlyActions()'),
    'public canvas init must expose a local read-only actions helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createReadOnlyActions()'),
    'read-only actions helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('noop: function() {}'),
    'read-only actions helper must preserve noop fallback'
  );
  assert.ok(
    initSrc.includes('noopAsync: function() { return Promise.resolve(); }'),
    'read-only actions helper must preserve async noop fallback'
  );
  assert.ok(
    initSrc.includes('noopFalseAsync: function() { return Promise.resolve(false); }'),
    'read-only actions helper must preserve false async noop fallback'
  );
  assert.ok(
    initSrc.includes('getLocalSaveMode: function() { return false; }'),
    'read-only actions helper must preserve local save mode fallback'
  );
  assert.ok(
    initSrc.includes("showToast: function(msg) { console.log('[public-canvas]', msg); }"),
    'read-only actions helper must preserve toast logging fallback'
  );
  assert.ok(
    initSrc.includes('var readOnlyActions = createPublicCanvasReadOnlyActions();'),
    'startCanvas must consume the local read-only actions helper'
  );
  assert.equal(
    initSrc.includes("var readOnlyActions = canvasEntry && typeof canvasEntry.createReadOnlyActions === 'function'"),
    false,
    'startCanvas should not inline read-only actions delegation'
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
    initSrc.indexOf('function createPublicCanvasReadOnlyActions()') < initSrc.indexOf('function initPublicCanvas()'),
    'read-only actions helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var memoryHelpers = createPublicCanvasMemoryHelpers(normalized.treeMemories);') < initSrc.indexOf('var readOnlyActions = createPublicCanvasReadOnlyActions();'),
    'read-only actions must remain after memory helper setup'
  );
  assert.ok(
    initSrc.indexOf('var readOnlyActions = createPublicCanvasReadOnlyActions();') < initSrc.indexOf('var selectionState = createPublicCanvasSelectionState(canonicalRootId);'),
    'read-only actions must remain before selection state setup'
  );
});
