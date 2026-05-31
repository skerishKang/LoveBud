const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');
const initialLoadFlowSource = fs.readFileSync('js/editor/editor-initial-load-flow.js', 'utf8');

// --- 1. Page helper exports renderTreeLoadError ---

test('editor-page-helpers.js exports renderTreeLoadError', () => {
  assert.match(pageHelpersSource, /function renderTreeLoadError\(options\)/);
  assert.match(pageHelpersSource, /renderTreeLoadError:\s*renderTreeLoadError/);
});

test('editor-page-helpers.js renderTreeLoadError uses canvas, addBtn, errorTitle, errorDesc, i18n, escapeHtml, setDetailEmptyState', () => {
  const fnStart = pageHelpersSource.indexOf('function renderTreeLoadError(options)');
  assert.notEqual(fnStart, -1, 'renderTreeLoadError function must exist');
  const fnEnd = pageHelpersSource.indexOf('function buildTreeLoadErrorCopy', fnStart);
  const fnBody = pageHelpersSource.slice(fnStart, fnEnd);

  assert.match(fnBody, /canvas/);
  assert.match(fnBody, /addBtn/);
  assert.match(fnBody, /errorTitle/);
  assert.match(fnBody, /errorDesc/);
  assert.match(fnBody, /i18n/);
  assert.match(fnBody, /escapeHtml/);
  assert.match(fnBody, /setDetailEmptyState/);
});

// --- 2. editor.js uses required pattern without fallback ---

test('editor.js uses renderTreeLoadError required assignment without fallback', () => {
  assert.match(
    editorSource,
    /const\s+renderTreeLoadError\s*=\s*editorPageHelpers\.renderTreeLoadError;/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+renderTreeLoadError\s*=\s*editorPageHelpers\.renderTreeLoadError\s*\|\|/
  );
});

test('editor.js no longer references entryFallbacks.createInlineRenderTreeLoadErrorFallback', () => {
  assert.doesNotMatch(
    editorSource,
    /createInlineRenderTreeLoadErrorFallback/
  );
});

// --- 3. Bootstrap guard exists and uses console.error ---

test('editor.js guards missing renderTreeLoadError before use', () => {
  assert.match(
    editorSource,
    /LoveBudEditorPageHelpers\.renderTreeLoadError missing/
  );
});

test('editor.js renderTreeLoadError guard does not use reportError', () => {
  const guardStart = editorSource.indexOf("if (typeof renderTreeLoadError !== 'function')");
  assert.notEqual(guardStart, -1, 'renderTreeLoadError guard must exist');

  const guardEnd = editorSource.indexOf("const buildTreeLoadErrorCopy", guardStart);
  assert.notEqual(guardEnd, -1, 'guard end marker must exist after guard');

  const guardBody = editorSource.slice(guardStart, guardEnd);

  assert.match(guardBody, /reportEditorBootstrapMissingDependency/);
  assert.doesNotMatch(guardBody, /reportError\(/);
});

// --- 4. Render call options structure preserved ---

test('initial load flow renderTreeLoadError call preserves options keys', () => {
  const callStart = initialLoadFlowSource.indexOf('opts.renderTreeLoadError({');
  assert.notEqual(callStart, -1, 'renderTreeLoadError call must exist');
  const callEnd = initialLoadFlowSource.indexOf('});', callStart);
  const callBody = initialLoadFlowSource.slice(callStart, callEnd + 3);

  assert.match(callBody, /canvas:/);
  assert.match(callBody, /addBtn:/);
  assert.match(callBody, /errorTitle:/);
  assert.match(callBody, /errorDesc:/);
  assert.match(callBody, /i18n:/);
  assert.match(callBody, /escapeHtml:/);
  assert.match(callBody, /setDetailEmptyState:/);
});
