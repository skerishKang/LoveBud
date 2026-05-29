const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps route setup behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function setupPublicRoute()'),
    'public canvas init must expose a local route setup helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.setupPublicRoute()'),
    'route setup helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('new URLSearchParams(window.location.search)'),
    'route setup helper must preserve URLSearchParams fallback'
  );
  assert.ok(
    initSrc.includes("params.get('treeId')"),
    'route setup helper must preserve treeId query lookup'
  );
  assert.ok(
    initSrc.includes("document.body.classList.add('editor-readonly')"),
    'route setup helper must preserve read-only body class fallback'
  );
  assert.ok(
    initSrc.includes("document.body.classList.remove('editor-preload')"),
    'route setup helper must preserve preload class removal fallback'
  );
  assert.ok(
    initSrc.includes('var routeSetup = setupPublicRoute();'),
    'initPublicCanvas must consume the local route setup helper'
  );
  assert.equal(
    initSrc.includes('var routeSetup = canvasEntry && typeof canvasEntry.setupPublicRoute'),
    false,
    'initPublicCanvas should not inline route setup delegation'
  );
  assert.ok(
    initSrc.indexOf('function setupPublicRoute()') < initSrc.indexOf('function initPublicCanvas()'),
    'route setup helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var routeSetup = setupPublicRoute();') < initSrc.indexOf('var treeId = routeSetup && routeSetup.treeId;'),
    'route setup must happen before treeId extraction'
  );
  assert.ok(
    initSrc.indexOf('var treeId = routeSetup && routeSetup.treeId;') < initSrc.indexOf('if (!treeId)'),
    'treeId extraction must remain before missing route guard'
  );
  assert.ok(
    initSrc.indexOf('if (!treeId)') < initSrc.indexOf('var bridge = getPublicCanvasBridge();'),
    'missing route guard must remain before bridge lookup'
  );
});
