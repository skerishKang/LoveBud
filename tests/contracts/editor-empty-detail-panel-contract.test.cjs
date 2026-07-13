const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const detailUiPath = path.join(__dirname, '..', '..', 'js', 'editor', 'editor-detail-ui.js');
const editorPagePath = path.join(__dirname, '..', '..', 'pages', 'editor.html');

test('editor detail panel hides selected-memory UI when no memory is selected', () => {
  const source = fs.readFileSync(detailUiPath, 'utf8');

  function extractArrowFnBody(name) {
    const m = source.match(new RegExp('const ' + name + ' = \\([^)]*\\) => \\{([\\s\\S]*?)\\n    \\};'));
    return m ? m[1] : null;
  }
  function extractFunctionFnBody(name) {
    const m = source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'));
    return m ? m[1] : null;
  }

  assert.match(source, /const selectedNodeId = getSelectedNodeId\(\);/);

  assert.match(
    source,
    /const hasSelectedMemory = !!\(data && data\.id && !data\.isNewTree && selectedNodeId\);/,
    'hasSelectedMemory must use the !! guarded shape'
  );
  assert.match(
    source,
    /const isEmptyState = !hasSelectedMemory \|\| !treeState\.hasMoments \|\| !!data\?\.isNewTree;/,
    'isEmptyState must derive from hasSelectedMemory/treeState/data.isNewTree'
  );

  const updateBody = extractArrowFnBody('updateDetailPanel');
  assert.ok(updateBody, 'updateDetailPanel must exist in source');
  const setEmptyBody = extractArrowFnBody('setDetailEmptyState');
  assert.ok(setEmptyBody, 'setDetailEmptyState must exist in source');

  const emptyBranchMatch = updateBody.match(/if \(isEmptyState\) \{([\s\S]*?)\n        \}/);
  assert.ok(emptyBranchMatch, 'updateDetailPanel must have an isEmptyState branch');
  const emptyBranch = emptyBranchMatch[1];
  assert.match(emptyBranch, /if \(commentsController\) commentsController\.hide\(\);/, 'empty branch must hide commentsController');
  assert.match(emptyBranch, /setDetailEmptyState\(true\);/, 'empty branch must call setDetailEmptyState(true)');
  assert.match(emptyBranch, /updateFocusSelectedBtn\(\);/, 'empty branch must call updateFocusSelectedBtn');
  assert.match(emptyBranch, /return;/, 'empty branch must return early');
  assert.doesNotMatch(
    emptyBranch,
    /fetchReactionSummary|toggleReaction/,
    'empty branch must not call direct reaction I/O'
  );

  assert.match(
    setEmptyBody,
    /if \(isEmpty\) \{[\s\S]*?resetDetailViewState\(\);[\s\S]*?momentReactionsController\.hide\(\);[\s\S]*?\}/,
    'setDetailEmptyState must invalidate reactions through momentReactionsController.hide() when empty'
  );
  assert.doesNotMatch(
    setEmptyBody,
    /const reactionsCard = document\.getElementById\('momentReactionsCard'\)/,
    'setDetailEmptyState must not query the reactions card directly (delegates to controller)'
  );
  assert.doesNotMatch(
    setEmptyBody,
    /reactionsCard\.style\.display = 'none'/,
    'setDetailEmptyState must not set reactions card display directly'
  );
  assert.match(
    setEmptyBody,
    /if \(viewMode\) viewMode\.style\.display = isEmpty \? 'none' : 'grid';/,
    'setDetailEmptyState must hide viewMode on empty / grid on selection'
  );
  assert.match(
    setEmptyBody,
    /if \(editMode\) editMode\.style\.display = 'none';/,
    'setDetailEmptyState must always hide editMode'
  );
  assert.match(
    setEmptyBody,
    /if \(actions\) actions\.style\.display = isEmpty \? 'none' : 'flex';/,
    'setDetailEmptyState must hide actions on empty / flex on selection'
  );
  assert.match(
    setEmptyBody,
    /if \(footer\) footer\.style\.display = 'none';/,
    'setDetailEmptyState must always hide the detail panel footer'
  );

  assert.match(
    updateBody,
    /if \(reactionsCard\) \{[\s\S]*?if \(isEmptyState \|\| !data\?\.id \|\| isRootMemory\(data, canonicalRootId\)\) \{[\s\S]*?momentReactionsController\.hide\(\);[\s\S]*?\} else \{[\s\S]*?momentReactionsController\.update\(/,
    'updateDetailPanel must delegate root/invalid memory to controller.hide() and valid memory to controller.update()'
  );
  assert.doesNotMatch(
    updateBody,
    /momentLikeBtn|window\.apiClient\.fetchReactionSummary|window\.apiClient\.toggleReaction/,
    'updateDetailPanel must not contain direct reaction DOM state or API calls'
  );
  assert.match(
    updateBody,
    /if \(isEmptyState \|\| !data\?\.id \|\| isRootMemory\(data, canonicalRootId\)\) \{[\s\S]*?commentsController\.hide\(\);[\s\S]*?\} else \{[\s\S]*?commentsController\.update\(/,
    'updateDetailPanel must preserve commentsController hide/update delegation'
  );

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
