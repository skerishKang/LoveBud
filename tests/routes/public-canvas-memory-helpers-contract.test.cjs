const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps memory/root helpers behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasMemoryHelpers(treeMemories)'),
    'public canvas init must expose a local memory helpers factory'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createMemorySelectors(treeMemories)'),
    'memory helpers factory must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes('var rootUtils = window.LoveBudEditorUtils || {};'),
    'memory helpers factory must preserve editor utils fallback'
  );
  assert.ok(
    initSrc.includes('function resolveExistingMemoryId(candidateId)'),
    'memory helpers factory must have a sentinel validation helper'
  );
  assert.ok(
    initSrc.includes('return resolveExistingMemoryId(rootUtils.getCanonicalRootId(treeMemories))'),
    'memory helpers factory must validate rootUtils.getCanonicalRootId through sentinel guard'
  );
  assert.ok(
    initSrc.includes('var roots = treeMemories.filter(function(m) { return m.parentId === null || m.parentId === undefined; });'),
    'memory helpers factory must preserve root filtering fallback'
  );
  assert.ok(
    initSrc.includes("if (roots.length === 0) return null;"),
    'memory helpers factory must return null when no root found'
  );
  assert.ok(
    initSrc.includes("return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;"),
    'memory helpers factory must preserve createdAt root sort fallback'
  );
  assert.ok(
    initSrc.includes('return rootUtils.isRootMemory(mem, rootId);'),
    'memory helpers factory must preserve isRootMemory utility fallback'
  );
  assert.ok(
    initSrc.includes('return !!(mem && rootId && mem.id === rootId);'),
    'memory helpers factory must preserve direct root memory fallback'
  );
  assert.ok(
    initSrc.includes('return memorySelectors.findFirstSelectableMemory(canonicalRootId);'),
    'memory helpers factory must preserve first selectable delegation'
  );
  assert.ok(
    initSrc.includes('var nonRoot = treeMemories.filter(function(m) { return !isRootMemory(m, canonicalRootId); });'),
    'memory helpers factory must preserve non-root selectable fallback'
  );
  assert.ok(
    initSrc.includes('return nonRoot.length > 0 ? nonRoot[0] : treeMemories[0] || null;'),
    'memory helpers factory must preserve first selectable fallback'
  );
  assert.ok(
    initSrc.includes('var memoryHelpers = createPublicCanvasMemoryHelpers(normalized.treeMemories);'),
    'startCanvas must consume the memory helpers factory'
  );
  assert.ok(
    initSrc.includes('var getCanonicalRootId = memoryHelpers.getCanonicalRootId;'),
    'startCanvas must keep getCanonicalRootId from helper result'
  );
  assert.ok(
    initSrc.includes('var isRootMemory = memoryHelpers.isRootMemory;'),
    'startCanvas must keep isRootMemory from helper result'
  );
  assert.ok(
    initSrc.includes('var canonicalRootId = memoryHelpers.canonicalRootId;'),
    'startCanvas must keep canonicalRootId from helper result'
  );
  assert.ok(
    initSrc.includes('var findFirstSelectableMemory = memoryHelpers.findFirstSelectableMemory;'),
    'startCanvas must keep findFirstSelectableMemory from helper result'
  );
  assert.equal(
    initSrc.includes('var rootUtils = window.LoveBudEditorUtils || {};\n                var memorySelectors = canvasEntry && typeof canvasEntry.createMemorySelectors'),
    false,
    'startCanvas should not inline memory selector setup'
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
    initSrc.indexOf('function createPublicCanvasMemoryHelpers(treeMemories)') < initSrc.indexOf('function initPublicCanvas()'),
    'memory helpers factory must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('var updateCanvasEmptyGuide = createPublicCanvasEmptyGuideUpdater(normalized.treeMemories);') < initSrc.indexOf('var memoryHelpers = createPublicCanvasMemoryHelpers(normalized.treeMemories);'),
    'memory helpers must remain after empty guide setup'
  );
  assert.ok(
    initSrc.indexOf('var memoryHelpers = createPublicCanvasMemoryHelpers(normalized.treeMemories);') < initSrc.indexOf('var readOnlyActions = createPublicCanvasReadOnlyActions();'),
    'memory helpers must remain before read-only action setup'
  );
});
