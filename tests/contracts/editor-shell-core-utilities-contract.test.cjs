const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const editorHtmlSource = fs.readFileSync('pages/editor.html', 'utf8');

function getCoreUtilitiesBlock() {
  const start = shellHelpersSource.indexOf('getI18n: function()');
  assert.notEqual(start, -1, 'getI18n helper must exist');

  const end = shellHelpersSource.indexOf('// HTTP status resolver', start);
  assert.notEqual(end, -1, 'core utility block must end before HTTP status resolver');

  return shellHelpersSource.slice(start, end);
}

test('editor shell helpers expose core utility helpers', () => {
  assert.match(shellHelpersSource, /getI18n:\s*function\(\)/);
  assert.match(shellHelpersSource, /getEditorBasePath:\s*function\(\)/);
  assert.match(shellHelpersSource, /buildEditorRedirectTarget:\s*function\(\)/);
});

test('getI18n preserves window translator fallback behavior', () => {
  const block = getCoreUtilitiesBlock();

  assert.match(block, /getI18n:\s*function\(\)\s*\{/);
  assert.match(block, /return window\.t \|\| \(\(k\) => k\)/);
});

test('getEditorBasePath preserves editor page path resolution', () => {
  const block = getCoreUtilitiesBlock();

  assert.match(block, /getEditorBasePath:\s*function\(\)\s*\{/);
  assert.match(block, /window\.location\.pathname\.indexOf\('\/pages\/'\) !== -1/);
  assert.match(block, /\?\s*''\s*:\s*'pages\/'/);
});

test('buildEditorRedirectTarget preserves editor redirect composition', () => {
  const block = getCoreUtilitiesBlock();

  assert.match(block, /buildEditorRedirectTarget:\s*function\(\)\s*\{/);
  assert.match(block, /return this\.getEditorBasePath\(\) \+ 'editor' \+ \(window\.location\.search \|\| ''\)/);
});

test('editor entrypoint keeps core utility fallback resolution intact', () => {
  // getI18n removed — i18n now comes directly from deps.i18n
  assert.doesNotMatch(
    editorSource,
    /deps\.shellHelpers\.getI18n/
  );
  assert.doesNotMatch(editorSource, /const i18n\s*=\s*deps\.i18n/);

  // getEditorBasePath now from deps (direct usage, no alias)
  assert.match(
    editorSource,
    /getEditorBasePath:\s*deps\.getEditorBasePath/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getEditorBasePath\s*=\s*deps\.getEditorBasePath/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getEditorBasePath\s*=\s*deps\.getEditorBasePath\s*\|\|/
  );
  assert.doesNotMatch(
    editorSource,
    /LoveBudEditorShellHelpers\.getEditorBasePath missing/
  );
  assert.doesNotMatch(
    editorSource,
    /typeof\s+getEditorBasePath\s*!==/
  );
});

test('editor html loads shell helpers before editor entrypoint for core utilities', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});

test('editor page helpers expose getMyTreesHref', () => {
  assert.match(pageHelpersSource, /function\s+getMyTreesHref\s*\(\)/);
  assert.match(pageHelpersSource, /getMyTreesHref:\s*getMyTreesHref/);
});

test('editor entrypoint requires getMyTreesHref through direct deps pattern', () => {
  assert.match(
    editorSource,
    /getMyTreesHref:\s*deps\.getMyTreesHref/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getMyTreesHref\s*=\s*deps\.getMyTreesHref/
  );
  assert.doesNotMatch(
    editorSource,
    /LoveBudEditorPageHelpers\.getMyTreesHref missing/
  );

  // No typeof guard for getMyTreesHref
  assert.doesNotMatch(
    editorSource,
    /typeof\s+getMyTreesHref\s*!==/
  );

  // check parameter passing is intact
  assert.match(
    editorSource,
    /deps\.createPrepareEditorShell\(\{\s*applyEditorShellCopy:\s*deps\.applyEditorShellCopy,\s*safeI18nText:\s*deps\.safeI18nText,\s*i18n:\s*deps\.i18n,\s*getMyTreesHref:\s*deps\.getMyTreesHref\s*\}\)/
  );
});
