const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps runtime profile installation behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function installPublicCanvasRuntimeProfile(canvas)'),
    'public canvas init must expose a local runtime profile helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.installPublicMetrics(canvas);'),
    'runtime profile helper must preserve public metrics installation'
  );
  assert.ok(
    initSrc.includes('canvasEntry.installPublicViewportProfile();'),
    'runtime profile helper must preserve public viewport profile installation'
  );
  assert.ok(
    initSrc.includes('installPublicCanvasRuntimeProfile(canvas);'),
    'startCanvas must consume the runtime profile helper'
  );
  assert.equal(
    initSrc.includes("if (canvasEntry && typeof canvasEntry.installPublicMetrics === 'function') {\n                    canvasEntry.installPublicMetrics(canvas);\n                }\n                if (canvasEntry && typeof canvasEntry.installPublicViewportProfile === 'function')"),
    false,
    'startCanvas should not inline runtime profile installation'
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
    initSrc.indexOf('function installPublicCanvasRuntimeProfile(canvas)') < initSrc.indexOf('function initPublicCanvas()'),
    'runtime profile helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf("console.error('[public-canvas] Canvas or SVG element not found')") < initSrc.indexOf('installPublicCanvasRuntimeProfile(canvas);'),
    'runtime profile installation must remain after canvas/svg guard'
  );
  assert.ok(
    initSrc.indexOf('installPublicCanvasRuntimeProfile(canvas);') < initSrc.indexOf('var publicCanvasConfig = createPublicCanvasConfig(normalized);'),
    'runtime profile installation must remain before public canvas config creation'
  );
});
