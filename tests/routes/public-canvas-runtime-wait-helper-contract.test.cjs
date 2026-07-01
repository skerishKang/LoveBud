const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps runtime wait loop behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function waitForPublicRuntime(startCanvas)'),
    'public canvas init must expose a local runtime wait helper'
  );
  assert.ok(
    initSrc.includes('var maxWait = 100;'),
    'runtime wait helper must preserve maxWait'
  );
  assert.ok(
    initSrc.includes('var waitInterval = 50;'),
    'runtime wait helper must preserve wait interval'
  );
  assert.ok(
    initSrc.includes("console.error('[public-canvas] Timeout waiting for editor modules')"),
    'runtime wait helper must preserve timeout error'
  );
  assert.ok(
    initSrc.includes('var runtimeReady = isPublicRuntimeReady();'),
    'runtime wait helper must use readiness helper'
  );
  assert.ok(
    initSrc.includes('setTimeout(function() { waitForModules(attempt + 1); }, waitInterval);'),
    'runtime wait helper must preserve retry scheduling'
  );
  assert.ok(
    initSrc.includes('waitForModules(0);'),
    'runtime wait helper must start polling at attempt 0'
  );
  assert.ok(
    initSrc.includes('waitForPublicRuntime(startCanvas);'),
    'public tree load flow must consume the runtime wait helper'
  );
  assert.equal(
    initSrc.includes('// Wait for all required modules\n            var maxWait = 100;'),
    false,
    'public tree load flow should not inline runtime wait loop'
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
    initSrc.indexOf('function waitForPublicRuntime(startCanvas)') < initSrc.indexOf('function initPublicCanvas()'),
    'runtime wait helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('function startCanvas()') < initSrc.indexOf('waitForPublicRuntime(startCanvas);'),
    'startCanvas must be defined before runtime wait helper is invoked'
  );
  assert.ok(
    initSrc.indexOf('waitForPublicRuntime(startCanvas);') < initSrc.indexOf('.catch(window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure)'),
    'runtime wait invocation must remain before load error handling'
  );
});
