const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('public canvas init keeps public canvas config behind a local helper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSrc.includes('function createPublicCanvasConfig(normalized)'),
    'public canvas init must expose a local public canvas config helper'
  );
  assert.ok(
    initSrc.includes('canvasEntry.createPublicCanvasConfig(normalized)'),
    'public canvas config helper must delegate to entry wrapper when available'
  );
  assert.ok(
    initSrc.includes("resolveTreeTitleText: function() { return normalized.treeData.title || '러브트리'; }"),
    'public canvas config helper must preserve tree title fallback'
  );
  assert.ok(
    initSrc.includes("resolveHintText: function() { return ''; }"),
    'public canvas config helper must preserve hint fallback'
  );
  assert.ok(
    initSrc.includes("resolveInfoText: function() { return ''; }"),
    'public canvas config helper must preserve info fallback'
  );
  assert.ok(
    initSrc.includes("resolveMemoryThumbnail: function(mem) { return mem && mem.thumbnail ? mem.thumbnail : ''; }"),
    'public canvas config helper must preserve thumbnail fallback'
  );
  assert.ok(
    initSrc.includes('getTreeMemories: function() { return normalized.treeMemories; }'),
    'public canvas config helper must preserve tree memories accessor'
  );
  assert.ok(
    initSrc.includes('getCurrentTreeData: function() { return window.currentTreeData || {}; }'),
    'public canvas config helper must preserve current tree data accessor'
  );
  assert.ok(
    initSrc.includes("return { id: rootId, title: normalized.treeData.title || '러브트리', parentId: null };"),
    'public canvas config helper must preserve initial root memory fallback'
  );
  assert.ok(
    initSrc.includes('var publicCanvasConfig = createPublicCanvasConfig(normalized);'),
    'startCanvas must consume the local public canvas config helper'
  );
  assert.equal(
    initSrc.includes("var publicCanvasConfig = canvasEntry && typeof canvasEntry.createPublicCanvasConfig === 'function'"),
    false,
    'startCanvas should not inline public canvas config delegation'
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
    initSrc.indexOf('function createPublicCanvasConfig(normalized)') < initSrc.indexOf('function initPublicCanvas()'),
    'public canvas config helper must be defined before initPublicCanvas'
  );
  assert.ok(
    initSrc.indexOf('installPublicCanvasRuntimeProfile(canvas);') < initSrc.indexOf('var publicCanvasConfig = createPublicCanvasConfig(normalized);'),
    'public canvas config creation must remain after runtime profile setup'
  );
  assert.ok(
    initSrc.indexOf('var publicCanvasConfig = createPublicCanvasConfig(normalized);') < initSrc.indexOf('// Set up empty guide UI'),
    'public canvas config creation must remain before empty guide setup'
  );
});
