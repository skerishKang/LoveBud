const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)).map((match) => match[1]);
}

function stripVersion(src) {
  return String(src || '').split('?')[0];
}

function scriptIncludes(sources, needle) {
  return sources.some((src) => stripVersion(src).includes(needle));
}

function scriptIndex(sources, needle) {
  return sources.findIndex((src) => stripVersion(src).includes(needle));
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

const helperPath = 'js/editor/editor-canvas-interaction-helpers.js';
const canvasPath = 'js/editor/editor-canvas.js';
const primaryInteractionPath = 'js/editor/editor-canvas-interaction.js';

test('interaction helper removal readiness — helper only defines fallback namespace', () => {
  const helperSource = read(helperPath);

  assert.match(helperSource, /window\.LoveBudEditorCanvasInteractionHelpers\s*=/);
  assert.match(helperSource, /bindFallbackCanvasPan\s*\(options\)/);
  assert.match(helperSource, /viewportState\.globalsBound/);
  assert.match(helperSource, /persistStoredPositions\(\)/);
  assert.match(helperSource, /initCanvas\(\)/);
});

test('interaction helper removal readiness — editor canvas does not consume helper namespace', () => {
  const canvasSource = read(canvasPath);

  assert.equal(
    canvasSource.includes('LoveBudEditorCanvasInteractionHelpers'),
    false,
    'editor-canvas.js must not depend on LoveBudEditorCanvasInteractionHelpers while removal readiness is evaluated'
  );
  assert.equal(
    canvasSource.includes('bindFallbackCanvasPan'),
    false,
    'editor-canvas.js must not call bindFallbackCanvasPan while removal readiness is evaluated'
  );
});

test('interaction helper removal readiness — bindFallbackCanvasPan has no callsites outside helper file', () => {
  const filesToScan = [
    canvasPath,
    primaryInteractionPath,
    'pages/editor.html',
    'pages/view.html',
    'pages/public-canvas.html',
    'tests/contracts/editor-script-order-contract.test.cjs',
    'tests/contracts/editor-viewport-controls-contract.test.cjs',
    'tests/routes/public-canvas-route-dependency-contract.test.cjs'
  ];

  const references = filesToScan
    .map((file) => [file, countOccurrences(read(file), 'bindFallbackCanvasPan')])
    .filter(([, count]) => count > 0);

  assert.deepEqual(references, []);
});

test('interaction helper removal readiness — editor routes still load helper before editor canvas', () => {
  const editorScripts = scriptSources(read('pages/editor.html'));
  const publicCanvasScripts = scriptSources(read('pages/public-canvas.html'));

  assert.ok(scriptIncludes(editorScripts, helperPath), 'editor.html currently loads interaction helpers');
  assert.ok(scriptIncludes(publicCanvasScripts, helperPath), 'public-canvas.html currently loads interaction helpers');

  assert.ok(
    scriptIndex(editorScripts, helperPath) < scriptIndex(editorScripts, canvasPath),
    'editor.html must load interaction helpers before editor-canvas.js while present'
  );
  assert.ok(
    scriptIndex(publicCanvasScripts, helperPath) < scriptIndex(publicCanvasScripts, canvasPath),
    'public-canvas.html must load interaction helpers before editor-canvas.js while present'
  );
});

test('interaction helper removal readiness — public viewer route continues to exclude helper', () => {
  const viewScripts = scriptSources(read('pages/view.html'));
  const publicRouteContract = read('tests/routes/public-canvas-route-dependency-contract.test.cjs');

  assert.equal(scriptIncludes(viewScripts, helperPath), false, 'view.html must not load interaction helpers');
  assert.match(
    publicRouteContract,
    /js\/editor\/editor-canvas-interaction-helpers\.js/,
    'public route dependency contract must keep interaction helpers listed as removed editor-only runtime'
  );
});

test('interaction helper removal readiness — primary interaction runtime remains independently protected', () => {
  const runtimeContract = read('tests/contracts/editor-canvas-interaction-runtime-contract.test.cjs');

  assert.match(runtimeContract, /LoveBudEditorCanvasInteraction/);
  assert.match(runtimeContract, /beginNodeDrag/);
  assert.match(runtimeContract, /pointermove above drag threshold/);
  assert.match(runtimeContract, /pointerup finalizes moved drag/);
});
