const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const treeHelpersSource = fs.readFileSync('js/editor/editor-tree-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor tree helpers expose createTreeVisibilityUpdater factory', () => {
  assert.match(treeHelpersSource, /treeHelpers\.createTreeVisibilityUpdater/);
  assert.match(treeHelpersSource, /function createTreeVisibilityUpdater\(options\)/);
});

test('createTreeVisibilityUpdater factory accepts required options', () => {
  assert.match(treeHelpersSource, /var canEdit\s*=\s*opts\.canEdit/);
  assert.match(treeHelpersSource, /var getTreeId\s*=\s*opts\.getTreeId/);
  assert.match(treeHelpersSource, /var getApiClient\s*=\s*opts\.getApiClient/);
  assert.match(treeHelpersSource, /var applyUpdatedTreeVisibility\s*=\s*opts\.applyUpdatedTreeVisibility/);
  assert.match(treeHelpersSource, /var getCurrentTreeData\s*=\s*opts\.getCurrentTreeData/);
  assert.match(treeHelpersSource, /var updateSidebarStatus\s*=\s*opts\.updateSidebarStatus/);
  assert.match(treeHelpersSource, /var getCurrentEditingMemory\s*=\s*opts\.getCurrentEditingMemory/);
  assert.match(treeHelpersSource, /var updateDetailPanel\s*=\s*opts\.updateDetailPanel/);
  assert.match(treeHelpersSource, /var reportError\s*=\s*opts\.reportError/);
});

test('createTreeVisibilityUpdater returns async function with correct guard and flow', () => {
  assert.match(treeHelpersSource, /return async function updateTreeVisibility\(nextVisibility\)/);
  assert.match(treeHelpersSource, /if \(canEdit === false\) return/);
  assert.match(treeHelpersSource, /apiClient\.updateTree\(treeId,\s*\{\s*visibility:\s*nextVisibility\s*\}\)/);
  assert.match(treeHelpersSource, /applyUpdatedTreeVisibility\(\{/);
  assert.match(treeHelpersSource, /updateSidebarStatus\(\)/);
  assert.match(treeHelpersSource, /updateDetailPanel\(currentEditingMemory\)/);
});

test('editor tree helpers expose updated visibility state helper', () => {
  assert.match(treeHelpersSource, /treeHelpers\.applyUpdatedTreeVisibility/);
  assert.match(treeHelpersSource, /function applyUpdatedTreeVisibility\(options\)/);
  assert.match(treeHelpersSource, /var updatedTree\s*=\s*opts\.updatedTree\s*\|\|\s*\{\}/);
  assert.match(treeHelpersSource, /var nextVisibility\s*=\s*opts\.nextVisibility/);
  assert.match(treeHelpersSource, /var currentTreeData\s*=\s*opts\.currentTreeData\s*\|\|\s*window\.currentTreeData\s*\|\|\s*\{\}/);
});

test('visibility state helper preserves current tree merge semantics', () => {
  assert.match(treeHelpersSource, /window\.currentTreeData\s*=\s*\{/);
  assert.match(treeHelpersSource, /\.\.\.currentTreeData/);
  assert.match(treeHelpersSource, /\.\.\.updatedTree/);
  assert.match(
    treeHelpersSource,
    /visibility:\s*updatedTree\s*&&\s*updatedTree\.visibility\s*\?\s*updatedTree\.visibility\s*:\s*nextVisibility/
  );
  assert.match(treeHelpersSource, /return window\.currentTreeData/);
});

test('editor.js delegates updateTreeVisibility to createTreeVisibilityUpdater factory', () => {
  assert.match(editorSource, /editorTreeHelpers\.createTreeVisibilityUpdater\(\{/);
  assert.doesNotMatch(editorSource, /const updateTreeVisibility = async \(nextVisibility\) => \{/);
});

test('editor.js passes correct options to createTreeVisibilityUpdater', () => {
  assert.match(editorSource, /canEdit,/);
  assert.match(editorSource, /getTreeId:\s*\(\)\s*=>\s*treeId/);
  assert.match(editorSource, /getApiClient:\s*\(\)\s*=>\s*window\.apiClient/);
  assert.match(editorSource, /applyUpdatedTreeVisibility:\s*editorTreeHelpers\.applyUpdatedTreeVisibility/);
  assert.match(editorSource, /getCurrentTreeData:\s*\(\)\s*=>\s*window\.currentTreeData\s*\|\|\s*\{\}/);
  assert.match(editorSource, /updateSidebarStatus,/);
  assert.match(editorSource, /getCurrentEditingMemory:\s*\(\)\s*=>\s*currentEditingMemory/);
  assert.match(editorSource, /updateDetailPanel,/);
  assert.match(editorSource, /reportError/);
});

test('editor tree helpers load before editor entrypoint', () => {
  const treeHelpersIndex = editorHtml.indexOf('js/editor/editor-tree-helpers.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(treeHelpersIndex, -1, 'editor-tree-helpers.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(treeHelpersIndex < editorJsIndex, 'editor-tree-helpers.js must load before editor.js');
});

test('editor tree helpers expose syncCurrentTreeData', () => {
  assert.match(treeHelpersSource, /syncCurrentTreeData/);
  assert.match(treeHelpersSource, /treeHelpers\.syncCurrentTreeData/);
  assert.match(treeHelpersSource, /function syncCurrentTreeData\(tree\)/);
  assert.match(treeHelpersSource, /window\.currentTreeData\s*=\s*\{/);
  assert.match(treeHelpersSource, /visibility:\s*tree\s*&&\s*tree\.visibility/);
});

test('editor.js delegates syncCurrentTreeData through required tree helper', () => {
  assert.match(
    editorSource,
    /const\s+syncCurrentTreeData\s*=\s*editorTreeHelpers\.syncCurrentTreeData/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+syncCurrentTreeData\s*=\s*editorTreeHelpers\.syncCurrentTreeData\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorTreeHelpers\.syncCurrentTreeData missing/
  );
});

test('editor.js delegates resolveParentIdForCreate through required tree helper', () => {
  assert.match(
    editorSource,
    /const\s+resolveParentIdForCreate\s*=\s*editorTreeHelpers\.resolveParentIdForCreate/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+resolveParentIdForCreate\s*=\s*editorTreeHelpers\.resolveParentIdForCreate\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorTreeHelpers\.resolveParentIdForCreate missing/
  );
});

test('editor.js guards missing resolveParentIdForCreate without reportError', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorTreeHelpers.resolveParentIdForCreate missing');
  const usageIndex = editorSource.indexOf('resolveParentIdForCreate,');

  assert.ok(guardIndex !== -1, 'missing resolveParentIdForCreate guard must exist');
  assert.ok(usageIndex !== -1, 'resolveParentIdForCreate usage must exist');
  assert.ok(guardIndex < usageIndex, 'guard must run before resolveParentIdForCreate usage');

  const guardBlock = editorSource.slice(guardIndex - 100, guardIndex + 200);
  assert.doesNotMatch(guardBlock, /reportError\(/);
});
