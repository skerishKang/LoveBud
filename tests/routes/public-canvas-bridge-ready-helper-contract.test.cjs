const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps bridge readiness behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function isPublicCanvasBridgeReady(bridge)'),
    'public canvas init must expose a local bridge readiness helper'
  );
  assert.ok(
    initSrc.includes("return !!(bridge && typeof bridge.loadPublicTreeData === 'function');"),
    'bridge readiness helper must validate loadPublicTreeData'
  );
  assert.ok(
    initSrc.includes('if (!isPublicCanvasBridgeReady(bridge))'),
    'initPublicCanvas must consume the bridge readiness helper'
  );
  assert.equal(
    initSrc.includes("if (!bridge || typeof bridge.loadPublicTreeData !== 'function')"),
    false,
    'initPublicCanvas should not inline bridge readiness logic'
  );
  assert.ok(
    initSrc.includes("console.error('[public-canvas] Bridge not loaded')"),
    'bridge missing error must be preserved'
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
    initSrc.indexOf('var bridge = getPublicCanvasBridge();') < initSrc.indexOf('if (!isPublicCanvasBridgeReady(bridge))'),
    'bridge lookup must happen before bridge readiness guard'
  );
  assert.ok(
    initSrc.indexOf('if (!isPublicCanvasBridgeReady(bridge))') < initSrc.indexOf("console.error('[public-canvas] Bridge not loaded')"),
    'bridge readiness guard must preserve missing bridge error flow'
  );
  assert.ok(
    initSrc.indexOf("console.error('[public-canvas] Bridge not loaded')") < initSrc.indexOf('bridge.loadPublicTreeData(treeId)'),
    'missing bridge error must remain before public tree loading'
  );
});
