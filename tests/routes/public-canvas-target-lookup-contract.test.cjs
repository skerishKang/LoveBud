const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps DOM target lookup behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function resolvePublicCanvasTargets()'),
    'public canvas init must expose a local target lookup helper'
  );
  assert.ok(
    initSrc.includes("canvas: document.getElementById('canvasArea')"),
    'target helper must resolve canvasArea'
  );
  assert.ok(
    initSrc.includes("svg: document.getElementById('canvasSvg')"),
    'target helper must resolve canvasSvg'
  );
  assert.ok(
    initSrc.includes("detailPanel: document.getElementById('detailPanel')"),
    'target helper must resolve detailPanel'
  );
  assert.ok(
    initSrc.includes('var targets = resolvePublicCanvasTargets();'),
    'startCanvas must consume the local target lookup helper'
  );
  assert.ok(
    initSrc.includes('var canvas = targets.canvas;'),
    'startCanvas must keep canvas variable from targets'
  );
  assert.ok(
    initSrc.includes('var svg = targets.svg;'),
    'startCanvas must keep svg variable from targets'
  );
  assert.ok(
    initSrc.includes('var detailPanel = targets.detailPanel;'),
    'startCanvas must keep detailPanel variable from targets'
  );
  assert.equal(
    initSrc.includes("var canvas = document.getElementById('canvasArea');"),
    false,
    'startCanvas should not inline canvas DOM lookup'
  );
  assert.ok(
    initSrc.includes("console.error('[public-canvas] Canvas or SVG element not found')"),
    'missing canvas/svg error must be preserved'
  );
  assert.ok(
    initSrc.indexOf('function resolvePublicCanvasTargets()') < initSrc.indexOf('function initPublicCanvas()'),
    'target lookup helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var targets = resolvePublicCanvasTargets();') < initSrc.indexOf('installPublicCanvasRuntimeProfile(canvas);'),
    'target lookup must happen before metrics installation'
  );
});
