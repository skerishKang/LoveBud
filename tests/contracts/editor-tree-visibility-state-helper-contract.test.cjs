const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const treeHelpersSource = fs.readFileSync('js/editor/editor-tree-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractUpdateTreeVisibilityBlock(source) {
  const marker = 'const updateTreeVisibility = async (nextVisibility) => {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'updateTreeVisibility block must exist');

  const end = source.indexOf("            log('Initializing Detail UI...');", start);
  assert.notEqual(end, -1, 'detail UI init marker must follow updateTreeVisibility');

  return source.slice(start, end);
}

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

test('editor updateTreeVisibility delegates tree data merge to tree helper', () => {
  const block = extractUpdateTreeVisibilityBlock(editorSource);

  assert.match(block, /editorTreeHelpers\.applyUpdatedTreeVisibility/);
  assert.match(block, /updatedTree,/);
  assert.match(block, /nextVisibility,/);
  assert.match(block, /currentTreeData:\s*window\.currentTreeData\s*\|\|\s*\{\}/);
  assert.match(block, /LoveBudEditorTreeHelpers\.applyUpdatedTreeVisibility missing/);
});

test('editor updateTreeVisibility no longer owns currentTreeData merge inline', () => {
  const block = extractUpdateTreeVisibilityBlock(editorSource);

  assert.doesNotMatch(block, /window\.currentTreeData\s*=\s*\{/);
  assert.doesNotMatch(block, /\.\.\.\(window\.currentTreeData\s*\|\|\s*\{\}\)/);
  assert.doesNotMatch(block, /visibility:\s*updatedTree\?\.\s*visibility\s*\|\|\s*nextVisibility/);
});

test('editor updateTreeVisibility keeps api and refresh flow intact', () => {
  const block = extractUpdateTreeVisibilityBlock(editorSource);

  assert.match(block, /if \(canEdit === false\) return/);
  assert.match(block, /window\.apiClient\.updateTree\(treeId,\s*\{\s*visibility:\s*nextVisibility\s*\}\)/);
  assert.match(block, /updateSidebarStatus\(\)/);
  assert.match(block, /if \(currentEditingMemory\) updateDetailPanel\(currentEditingMemory\)/);
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

test('editor.js guards missing syncCurrentTreeData and keeps resolveParentIdForCreate fallback', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorTreeHelpers.syncCurrentTreeData missing');
  const callIndex = editorSource.indexOf('syncCurrentTreeData(tree);');

  assert.ok(guardIndex !== -1, 'missing syncCurrentTreeData guard must exist');
  assert.ok(callIndex !== -1, 'syncCurrentTreeData call must exist');
  assert.ok(guardIndex < callIndex, 'guard must run before syncCurrentTreeData call');

  const guardBlock = editorSource.slice(guardIndex - 100, guardIndex + 200);
  assert.doesNotMatch(guardBlock, /reportError\(/);

  // resolveParentIdForCreate fallback is still present
  assert.match(
    editorSource,
    /resolveParentIdForCreate\s*=\s*editorTreeHelpers\.resolveParentIdForCreate\s*\|\|/
  );
});
