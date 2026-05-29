const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps load failure handling behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function handlePublicCanvasLoadFailure(error)'),
    'public canvas init must expose a local load failure helper'
  );
  assert.ok(
    initSrc.includes("console.error('[public-canvas] Load failed:', error)"),
    'load failure helper must preserve load failed logging'
  );
  assert.ok(
    initSrc.includes("var container = document.getElementById('canvasArea');"),
    'load failure helper must preserve canvasArea lookup'
  );
  assert.ok(
    initSrc.includes('appendPublicLoadFailureState(container, error);'),
    'load failure helper must append public load failure state'
  );
  assert.ok(
    initSrc.includes('}).catch(handlePublicCanvasLoadFailure);'),
    'public tree load flow must consume the load failure helper'
  );
  assert.equal(
    initSrc.includes("}).catch(function(error) {\n            console.error('[public-canvas] Load failed:', error);"),
    false,
    'public tree load flow should not inline load failure handling'
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
    initSrc.indexOf('function handlePublicCanvasLoadFailure(error)') < initSrc.indexOf('function initPublicCanvas()'),
    'load failure helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('waitForPublicRuntime(startCanvas);') < initSrc.indexOf('}).catch(handlePublicCanvasLoadFailure);'),
    'load failure handler must remain after runtime wait invocation'
  );
});
