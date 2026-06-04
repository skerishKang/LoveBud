const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');
const initialLoadFlowSource = fs.readFileSync('js/editor/editor-initial-load-flow.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractTreeLoadFailureBlock(source) {
  const marker = 'if (!tree) {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'tree load failure block must exist');

  const end = source.indexOf('        opts.syncCurrentTreeData(tree);', start);
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

test('editor.js uses buildTreeLoadErrorCopy required reference from deps at call site', () => {
  assert.match(
    editorSource,
    /buildTreeLoadErrorCopy:\s*deps\.buildTreeLoadErrorCopy/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+buildTreeLoadErrorCopy\s*=\s*deps\.buildTreeLoadErrorCopy\s*\|\|/
  );
  // No typeof guard for buildTreeLoadErrorCopy (resolved through deps)
  assert.doesNotMatch(
    editorSource,
    /typeof\s+buildTreeLoadErrorCopy\s*!==\s*'function'/
  );
});

test('editor.js no longer has bootstrap guard for missing buildTreeLoadErrorCopy (guard removed, resolved through deps)', () => {
  assert.doesNotMatch(
    editorSource,
    /LoveBudEditorPageHelpers\.buildTreeLoadErrorCopy missing/
  );
  assert.doesNotMatch(
    editorSource,
    /typeof buildTreeLoadErrorCopy !== 'function'/
  );
});

test('editor.js buildTreeLoadErrorCopy guard no longer exists (typeof guard removed with duplicate guard cleanup)', () => {
  // Guard block was removed — no typeof guard should exist
  assert.equal(
    editorSource.indexOf("if (typeof buildTreeLoadErrorCopy !== 'function')"),
    -1,
    'buildTreeLoadErrorCopy typeof guard must not exist'
  );
});

// --- 3. Tree-load failure block delegates to required helper ---

test('editor tree load failure delegates copy creation to required helper', () => {
  const block = extractTreeLoadFailureBlock(initialLoadFlowSource);

  assert.match(block, /buildTreeLoadErrorCopy\(\{/);
  assert.match(block, /treeLoadStatus,/);
  assert.match(block, /treeLoadErrorMessage,/);
  assert.match(block, /i18n/);
});

test('editor tree load failure block no longer has inline fallback or optional check', () => {
  const block = extractTreeLoadFailureBlock(initialLoadFlowSource);

  assert.doesNotMatch(block, /let\s+treeLoadErrorCopy\s*=\s*\{/);
  assert.doesNotMatch(block, /typeof editorPageHelpers\.buildTreeLoadErrorCopy/);
  assert.doesNotMatch(block, /reportError\('LoveBudEditorPageHelpers\.buildTreeLoadErrorCopy missing'\)/);
});

test('editor no longer owns tree load status copy branching inline', () => {
  const block = extractTreeLoadFailureBlock(initialLoadFlowSource);

  assert.doesNotMatch(block, /const errorTitle\s*=/);
  assert.doesNotMatch(block, /const errorDesc\s*=/);
  assert.doesNotMatch(block, /treeLoadStatus === 'api_unavailable'\s*\?/);
  assert.doesNotMatch(block, /\/Access denied\/i\.test\(treeLoadErrorMessage\)\s*\?/);
  assert.doesNotMatch(block, /treeLoadStatus === 'error'\s*\?/);
});

// --- 4. Auth redirect and render flow preserved ---

test('editor tree load failure keeps auth redirect and render flow intact', () => {
  const block = extractTreeLoadFailureBlock(initialLoadFlowSource);

  assert.match(block, /if \(treeLoadResult\.authRequired\)/);
  assert.match(block, /opts\.showToast\(opts\.i18n\('need_login'\), 'error'\)/);
  assert.match(block, /opts\.redirectToEditorLogin\(2000\)/);
  assert.match(block, /opts\.renderTreeLoadError\(\{/);
  assert.match(block, /errorTitle:\s*treeLoadErrorCopy\.errorTitle/);
  assert.match(block, /errorDesc:\s*treeLoadErrorCopy\.errorDesc/);
  assert.match(block, /opts\.markEditorReady\(\)/);
});

// --- 5. Load order contract preserved ---

test('editor page helpers load before editor entrypoint', () => {
  const pageHelpersIndex = editorHtml.indexOf('js/editor/editor-page-helpers.js');
  const initialLoadFlowIndex = editorHtml.indexOf('js/editor/editor-initial-load-flow.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(pageHelpersIndex, -1, 'editor-page-helpers.js must be loaded');
  assert.notEqual(initialLoadFlowIndex, -1, 'editor-initial-load-flow.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(pageHelpersIndex < editorJsIndex, 'editor-page-helpers.js must load before editor.js');
  assert.ok(initialLoadFlowIndex < editorJsIndex, 'editor-initial-load-flow.js must load before editor.js');
});
