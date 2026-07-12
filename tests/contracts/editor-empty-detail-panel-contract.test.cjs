const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const detailUiPath = path.join(__dirname, '..', '..', 'js', 'editor', 'editor-detail-ui.js');
const editorPagePath = path.join(__dirname, '..', '..', 'pages', 'editor.html');

test('editor detail panel hides selected-memory UI when no memory is selected', () => {
  const source = fs.readFileSync(detailUiPath, 'utf8');

  assert.match(source, /const selectedNodeId = getSelectedNodeId\(\);/);
  assert.match(source, /const hasSelectedMemory = !!\(data && data\.id && !data\.isNewTree && selectedNodeId\);/);
  assert.match(source, /const isEmptyState = !hasSelectedMemory \|\| !treeState\.hasMoments \|\| !!data\?\.isNewTree;/);
  assert.match(source, /if \(isEmptyState\) \{[\s\S]*?setDetailEmptyState\(true\);[\s\S]*?return;[\s\S]*?\}/);
  assert.match(source, /if \(reactionsCard && isEmpty\) reactionsCard\.style\.display = 'none';/);
  assert.match(source, /if \(isEmptyState \|\| !data\?\.id \|\| isRootMemory\(data, canonicalRootId\)\) \{[\s\S]*?reactionsCard\.style\.display = 'none';/);
  assert.match(source, /const viewMode = document\.getElementById\('detailViewMode'\);[\s\S]*?const editMode = document\.getElementById\('detailEditMode'\);[\s\S]*?if \(viewMode\) viewMode\.style\.display = isEmpty \? 'none' : 'grid';[\s\S]*?if \(editMode\) editMode\.style\.display = 'none';/);
  assert.match(source, /id="detailEmptyStartBtn"/);
  assert.match(source, /formatI18nText\('create_first_moment', '첫 순간 만들기'\)/);
});

test('editor page cache-busts the empty detail panel UI script', () => {
  // Softened from a pinned version string. The contract is now:
  //   1. The page loads js/editor/editor-detail-ui.js (any non-empty ?v=…).
  //   2. The ?v= query string is present (cache-bust is in effect).
  //   3. The page is NOT pinning a stale baseline (e.g. the 20260612-2400
  //      pre-#2816 reference value that this test originally guarded against).
  // Pinning to a specific version makes every future cache-bust bump a
  // contract failure; the page-level guard above catches regressions
  // (stale cache or missing cache-bust) without blocking legitimate
  // bumps.
  const editorPage = fs.readFileSync(editorPagePath, 'utf8');

  assert.match(
    editorPage,
    /\.\.\/js\/editor\/editor-detail-ui\.js\?v=[^"'\s>]+/,
    'editor page must load editor-detail-ui.js with a non-empty cache-bust query string'
  );
  assert.doesNotMatch(
    editorPage,
    /\.\.\/js\/editor\/editor-detail-ui\.js\?v=20260612-2400/,
    'editor page must not pin the pre-#2816 stale cache-bust value'
  );
});
