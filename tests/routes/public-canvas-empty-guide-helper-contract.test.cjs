const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps empty guide updater behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasEmptyGuideUpdater(treeMemories)'),
    'public canvas init must expose a local empty guide updater helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createEmptyGuideUpdater(treeMemories)'),
    'empty guide updater helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes("var guide = document.getElementById('canvasEmptyGuide');"),
    'empty guide updater helper must preserve canvasEmptyGuide lookup'
  );
  assert.ok(
    initSrc.includes('if (!guide) return;'),
    'empty guide updater helper must preserve missing guide guard'
  );
  assert.ok(
    initSrc.includes('var hasMoments = treeMemories.length > 0;'),
    'empty guide updater helper must preserve hasMoments calculation'
  );
  assert.ok(
    initSrc.includes("guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);"),
    'empty guide updater helper must preserve hidden class toggle'
  );
  assert.ok(
    initSrc.includes('var updateCanvasEmptyGuide = createPublicCanvasEmptyGuideUpdater(normalized.treeMemories);'),
    'startCanvas must consume the local empty guide updater helper'
  );
  assert.equal(
    initSrc.includes("var updateCanvasEmptyGuide = canvasEntry && typeof canvasEntry.createEmptyGuideUpdater === 'function'"),
    false,
    'startCanvas should not inline empty guide updater delegation'
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
    initSrc.indexOf('function createPublicCanvasEmptyGuideUpdater(treeMemories)') < initSrc.indexOf('function initPublicCanvas()'),
    'empty guide updater helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var publicCanvasConfig = createPublicCanvasConfig(normalized);') < initSrc.indexOf('var updateCanvasEmptyGuide = createPublicCanvasEmptyGuideUpdater(normalized.treeMemories);'),
    'empty guide updater creation must remain after public canvas config creation'
  );
  assert.ok(
    initSrc.indexOf('var updateCanvasEmptyGuide = createPublicCanvasEmptyGuideUpdater(normalized.treeMemories);') < initSrc.indexOf('// Resolve root helpers via entry wrapper with fallback'),
    'empty guide updater creation must remain before root helper setup'
  );
});
