const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractTreeLoadFailureBlock(source) {
  const marker = 'if (!tree) {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'tree load failure block must exist');

  const end = source.indexOf('            syncCurrentTreeData(tree);', start);
  assert.notEqual(end, -1, 'syncCurrentTreeData marker must follow tree load failure block');

  return source.slice(start, end);
}

// --- 1. Page helper exports buildTreeLoadErrorCopy ---

test('editor page helpers expose tree load error copy helper', () => {
  assert.match(pageHelpersSource, /function buildTreeLoadErrorCopy\(/);
  assert.match(pageHelpersSource, /buildTreeLoadErrorCopy:\s*buildTreeLoadErrorCopy/);
});

test('tree load error copy helper preserves status and access denied mapping', () => {
  assert.match(pageHelpersSource, /treeLoadStatus === 'api_unavailable'/);
  assert.match(pageHelpersSource, /\/Access denied\/i\.test\(treeLoadErrorMessage\)/);
  assert.match(pageHelpersSource, /treeLoadStatus === 'error'/);

  assert.match(pageHelpersSource, /tree_load_fail_title/);
  assert.match(pageHelpersSource, /tree_access_denied_title/);
  assert.match(pageHelpersSource, /tree_load_error_title/);
  assert.match(pageHelpersSource, /tree_not_found_title/);

  assert.match(pageHelpersSource, /tree_load_api_unavailable/);
  assert.match(pageHelpersSource, /tree_access_denied_desc/);
  assert.match(pageHelpersSource, /tree_load_error_desc/);
  assert.match(pageHelpersSource, /tree_load_not_found_desc/);
});

test('tree load error copy helper returns title and desc object', () => {
  assert.match(pageHelpersSource, /errorTitle:\s*errorTitle/);
  assert.match(pageHelpersSource, /errorDesc:\s*errorDesc/);
});

// --- 2. editor.js uses required reference without fallback ---

test('editor.js uses buildTreeLoadErrorCopy required reference', () => {
  assert.match(
    editorSource,
    /const\s+buildTreeLoadErrorCopy\s*=\s*editorPageHelpers\.buildTreeLoadErrorCopy/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+buildTreeLoadErrorCopy\s*=\s*editorPageHelpers\.buildTreeLoadErrorCopy\s*\|\|/
  );
});

test('editor.js has bootstrap guard for missing buildTreeLoadErrorCopy', () => {
  assert.match(
    editorSource,
    /LoveBudEditorPageHelpers\.buildTreeLoadErrorCopy missing/
  );
});

test('editor.js buildTreeLoadErrorCopy guard uses console.error pattern', () => {
  const guardStart = editorSource.indexOf("if (typeof buildTreeLoadErrorCopy !== 'function')");
  assert.notEqual(guardStart, -1, 'buildTreeLoadErrorCopy guard must exist');

  const guardEnd = editorSource.indexOf('const nextMemoryIdFromMemories', guardStart);
  assert.notEqual(guardEnd, -1, 'guard end marker must exist after guard');

  const guardBody = editorSource.slice(guardStart, guardEnd);

  assert.match(guardBody, /console\.error/);
  assert.match(guardBody, /LoveBudEditorDebug/);
  assert.match(guardBody, /debugState\.errors\.push/);
  assert.doesNotMatch(guardBody, /reportError\(/);
});

// --- 3. Tree-load failure block delegates to required helper ---

test('editor tree load failure delegates copy creation to required helper', () => {
  const block = extractTreeLoadFailureBlock(editorSource);

  assert.match(block, /buildTreeLoadErrorCopy\(\{/);
  assert.match(block, /treeLoadStatus,/);
  assert.match(block, /treeLoadErrorMessage,/);
  assert.match(block, /i18n/);
});

test('editor tree load failure block no longer has inline fallback or optional check', () => {
  const block = extractTreeLoadFailureBlock(editorSource);

  assert.doesNotMatch(block, /let\s+treeLoadErrorCopy\s*=\s*\{/);
  assert.doesNotMatch(block, /typeof editorPageHelpers\.buildTreeLoadErrorCopy/);
  assert.doesNotMatch(block, /reportError\('LoveBudEditorPageHelpers\.buildTreeLoadErrorCopy missing'\)/);
});

test('editor no longer owns tree load status copy branching inline', () => {
  const block = extractTreeLoadFailureBlock(editorSource);

  assert.doesNotMatch(block, /const errorTitle\s*=/);
  assert.doesNotMatch(block, /const errorDesc\s*=/);
  assert.doesNotMatch(block, /treeLoadStatus === 'api_unavailable'\s*\?/);
  assert.doesNotMatch(block, /\/Access denied\/i\.test\(treeLoadErrorMessage\)\s*\?/);
  assert.doesNotMatch(block, /treeLoadStatus === 'error'\s*\?/);
});

// --- 4. Auth redirect and render flow preserved ---

test('editor tree load failure keeps auth redirect and render flow intact', () => {
  const block = extractTreeLoadFailureBlock(editorSource);

  assert.match(block, /if \(treeLoadResult\.authRequired\)/);
  assert.match(block, /showToast\(i18n\('need_login'\), 'error'\)/);
  assert.match(block, /redirectToEditorLogin\(2000\)/);
  assert.match(block, /renderTreeLoadError\(\{/);
  assert.match(block, /errorTitle:\s*treeLoadErrorCopy\.errorTitle/);
  assert.match(block, /errorDesc:\s*treeLoadErrorCopy\.errorDesc/);
  assert.match(block, /markEditorReady\(\)/);
});

// --- 5. Load order contract preserved ---

test('editor page helpers load before editor entrypoint', () => {
  const pageHelpersIndex = editorHtml.indexOf('js/editor/editor-page-helpers.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(pageHelpersIndex, -1, 'editor-page-helpers.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(pageHelpersIndex < editorJsIndex, 'editor-page-helpers.js must load before editor.js');
});
