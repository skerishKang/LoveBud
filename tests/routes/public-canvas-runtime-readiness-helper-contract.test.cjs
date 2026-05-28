const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps runtime readiness behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(initSrc.includes('function isPublicRuntimeReady()'), 'public canvas init must expose a local runtime readiness helper');
  assert.ok(initSrc.includes('canvasEntry.isPublicRuntimeReady()'), 'readiness helper must delegate to canvas entry when available');
  assert.ok(initSrc.includes('typeof window.createEditorCanvas === \'function\''), 'readiness helper must preserve direct canvas runtime fallback');
  assert.ok(initSrc.includes('typeof window.createPublicViewerDetailUI === \'function\''), 'readiness helper must preserve direct detail runtime fallback');
  assert.ok(initSrc.includes('var runtimeReady = isPublicRuntimeReady();'), 'wait loop must consume the local readiness helper');
  assert.equal(
    initSrc.includes('var runtimeReady = canvasEntry && typeof canvasEntry.isPublicRuntimeReady'),
    false,
    'wait loop should not inline the full readiness decision'
  );
  assert.ok(
    initSrc.indexOf('function isPublicRuntimeReady()') < initSrc.indexOf('function initPublicCanvas()'),
    'readiness helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var runtimeReady = isPublicRuntimeReady();') < initSrc.indexOf('startCanvas();'),
    'runtime readiness must be checked before starting the canvas'
  );
});
