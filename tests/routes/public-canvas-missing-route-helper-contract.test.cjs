const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps missing route append behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function appendMissingRouteState()'),
    'public canvas init must expose a local missing route append helper'
  );
  assert.ok(
    initSrc.includes('var errEl = createMissingRouteState();'),
    'missing route helper must create the missing route state'
  );
  assert.ok(
    initSrc.includes('document.body.appendChild(errEl);'),
    'missing route helper must append the missing route state'
  );
  assert.ok(
    initSrc.includes('appendMissingRouteState();'),
    'initPublicCanvas must consume the missing route helper'
  );
  assert.equal(
    initSrc.includes('var errEl = createMissingRouteState();\n            if (errEl)'),
    false,
    'initPublicCanvas should not inline missing route append logic'
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
    initSrc.indexOf('function appendMissingRouteState()') < initSrc.indexOf('function initPublicCanvas()'),
    'missing route helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('if (!treeId)') < initSrc.indexOf('appendMissingRouteState();'),
    'missing route guard must call the helper'
  );
  assert.ok(
    initSrc.indexOf('appendMissingRouteState();') < initSrc.indexOf('var bridge = getPublicCanvasBridge();'),
    'missing route handling must remain before bridge lookup'
  );
});
