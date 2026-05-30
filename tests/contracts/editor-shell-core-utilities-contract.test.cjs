const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
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
  assert.match(editorSource, /shellHelpers\.getI18n \|\|/);
  assert.match(editorSource, /const i18n\s*=\s*getI18n\(\)/);

  assert.match(editorSource, /shellHelpers\.getEditorBasePath \|\|/);
  assert.match(editorSource, /shellHelpers\.buildEditorRedirectTarget \|\|/);
});

test('editor html loads shell helpers before editor entrypoint for core utilities', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
