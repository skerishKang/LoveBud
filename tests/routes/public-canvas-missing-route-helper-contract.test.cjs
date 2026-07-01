const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps missing route append behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');
  const errorFallback = fs.readFileSync('js/viewer/public-canvas-error-fallback.js', 'utf8');

  assert.ok(
    errorFallback.includes('function appendMissingRouteState()'),
    'public canvas error fallback must expose a missing route append helper'
  );
  assert.ok(
    errorFallback.includes('var errEl = createMissingRouteState();'),
    'missing route helper must create the missing route state'
  );
  assert.ok(
    errorFallback.includes('document.body.appendChild(errEl);'),
    'missing route helper must append the missing route state'
  );
  assert.ok(
    initSrc.includes('window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState()'),
    'initPublicCanvas must consume the missing route helper through error fallback'
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
    errorFallback.indexOf('function appendMissingRouteState()') < errorFallback.indexOf('window.LoveBudPublicCanvasErrorFallback = {'),
    'missing route helper must be defined before namespace export in error fallback'
  );
  assert.ok(
    initSrc.indexOf('if (!treeId)') < initSrc.indexOf('window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState()'),
    'missing route guard must call the helper'
  );
  assert.ok(
    initSrc.indexOf('window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState()') < initSrc.indexOf('var bridge = getPublicCanvasBridge();'),
    'missing route handling must remain before bridge lookup'
  );
});
