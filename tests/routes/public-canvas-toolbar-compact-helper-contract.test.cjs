const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps toolbar compact mode behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function installPublicCanvasToolbarCompactMode()'),
    'public canvas init must expose a local toolbar compact mode helper'
  );
  assert.ok(
    initSrc.includes("if (canvasEntry && typeof canvasEntry.installToolbarCompactMode === 'function')"),
    'toolbar compact helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('canvasEntry.installToolbarCompactMode();'),
    'toolbar compact helper must preserve entry wrapper call'
  );
  assert.ok(
    initSrc.includes("var compactMql = window.matchMedia('(max-width: 480px)');"),
    'toolbar compact helper must preserve compact media query'
  );
  assert.ok(
    initSrc.includes('function updateToolbarCompact(e)'),
    'toolbar compact helper must preserve compact update callback'
  );
  assert.ok(
    initSrc.includes("var tb = document.querySelector('.editor-canvas-toolbar');"),
    'toolbar compact helper must preserve toolbar lookup'
  );
  assert.ok(
    initSrc.includes('if (!tb) return;'),
    'toolbar compact helper must preserve missing toolbar guard'
  );
  assert.ok(
    initSrc.includes("tb.classList.toggle('is-compact', e.matches);"),
    'toolbar compact helper must preserve compact class toggle'
  );
  assert.ok(
    initSrc.includes('updateToolbarCompact(compactMql);'),
    'toolbar compact helper must preserve immediate compact sync'
  );
  assert.ok(
    initSrc.includes("compactMql.addEventListener('change', updateToolbarCompact);"),
    'toolbar compact helper must preserve media query change listener'
  );
  assert.ok(
    initSrc.includes('installPublicCanvasToolbarCompactMode();'),
    'startCanvas must consume the local toolbar compact mode helper'
  );

  const startCanvasSrc = initSrc.substring(
    initSrc.indexOf('function startCanvas()'),
    initSrc.indexOf('waitForPublicRuntime(startCanvas);')
  );

  assert.equal(
    startCanvasSrc.includes("if (canvasEntry && typeof canvasEntry.installToolbarCompactMode === 'function')"),
    false,
    'startCanvas should not inline toolbar compact mode delegation'
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
    initSrc.indexOf('function installPublicCanvasToolbarCompactMode()') < initSrc.indexOf('function initPublicCanvas()'),
    'toolbar compact helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf("console.log('[public-canvas] Canvas initialized successfully')") < initSrc.indexOf('installPublicCanvasToolbarCompactMode();'),
    'toolbar compact mode must remain after successful initialization logging'
  );
  assert.ok(
    initSrc.indexOf('installPublicCanvasToolbarCompactMode();') < initSrc.indexOf('waitForPublicRuntime(startCanvas);'),
    'toolbar compact mode install must remain inside startCanvas before runtime wait scheduling exits'
  );
});
