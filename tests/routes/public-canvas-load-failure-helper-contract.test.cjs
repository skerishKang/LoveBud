const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps load failure handling behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');
  const errorFallback = fs.readFileSync('js/viewer/public-canvas-error-fallback.js', 'utf8');

  // Error fallback module must expose a load failure helper
  assert.ok(
    errorFallback.includes('function handlePublicCanvasLoadFailure(error)'),
    'public canvas error fallback must expose a load failure helper'
  );
  assert.ok(
    errorFallback.includes("console.error('[public-canvas] Load failed:', error)"),
    'load failure helper must preserve load failed logging'
  );
  assert.ok(
    errorFallback.includes("var container = document.getElementById('canvasArea');"),
    'load failure helper must preserve canvasArea lookup'
  );
  assert.ok(
    errorFallback.includes('appendPublicLoadFailureState(container, error);'),
    'load failure helper must append public load failure state'
  );

  // New contract: local handlePublicCanvasLoadFailure must exist
  assert.ok(
    initSrc.includes('function handlePublicCanvasLoadFailure(error)'),
    'public canvas init must define a local load failure helper'
  );

  // Local handler must setPublicViewerLoadingState(false)
  assert.ok(
    initSrc.includes('setPublicViewerLoadingState(false);'),
    'local handler must clear loading state'
  );

  // Local handler must check for fallback namespace
  assert.ok(
    initSrc.includes('window.LoveBudPublicCanvasErrorFallback'),
    'local handler must look up error fallback namespace'
  );

  // Local handler must delegate to fallback when present
  assert.ok(
    initSrc.includes('fallback.handlePublicCanvasLoadFailure(error)'),
    'local handler must delegate to fallback when namespace present'
  );

  // Promise rejection must route through local handler
  assert.ok(
    initSrc.includes('}).catch(handlePublicCanvasLoadFailure);'),
    'promise rejection must use local catch handler'
  );

  // Old direct catch pattern must NOT appear in source
  assert.equal(
    initSrc.includes('}).catch(window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure)'),
    false,
    'source must not retain old direct catch pattern'
  );

  // Ordering: waitForPublicRuntime must come before local catch binding
  assert.ok(
    initSrc.indexOf('waitForPublicRuntime(startCanvas);') < initSrc.indexOf('}).catch(handlePublicCanvasLoadFailure);'),
    'runtime wait must remain before local catch handler'
  );

  // Preserved: old inline failure handling must not appear
  assert.equal(
    initSrc.includes("}).catch(function(error) {\n            console.error('[public-canvas] Load failed:', error);"),
    false,
    'public tree load flow should not inline load failure handling'
  );

  // Preserved: marker assertions
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

  // Preserved: error fallback helper ordering
  assert.ok(
    errorFallback.indexOf('function handlePublicCanvasLoadFailure(error)') < errorFallback.indexOf('window.LoveBudPublicCanvasErrorFallback = {'),
    'load failure helper must be defined before namespace export in error fallback'
  );

  // New ordering: local catch binding replaces old direct catch
  assert.ok(
    initSrc.indexOf('waitForPublicRuntime(startCanvas);') < initSrc.indexOf('}).catch(handlePublicCanvasLoadFailure);'),
    'runtime wait must remain before local catch handler'
  );
});