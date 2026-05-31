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
  // getI18n
  assert.match(
    editorSource,
    /const\s+getI18n\s*=\s*shellHelpers\.getI18n/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getI18n\s*=\s*shellHelpers\.getI18n\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.getI18n missing/
  );

  const i18nGuardStart = editorSource.indexOf('LoveBudEditorShellHelpers.getI18n missing');
  assert.notEqual(i18nGuardStart, -1, 'getI18n missing guard must exist');
  const i18nGuardEnd = editorSource.indexOf('const i18n = getI18n();', i18nGuardStart);
  assert.notEqual(i18nGuardEnd, -1, 'i18n initialization must exist after guard');
  const i18nGuardBlock = editorSource.slice(i18nGuardStart, i18nGuardEnd);
  assert.doesNotMatch(i18nGuardBlock, /reportError/);

  assert.match(editorSource, /const i18n\s*=\s*getI18n\(\)/);

  // getEditorBasePath
  assert.match(
    editorSource,
    /const\s+getEditorBasePath\s*=\s*shellHelpers\.getEditorBasePath/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getEditorBasePath\s*=\s*shellHelpers\.getEditorBasePath\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.getEditorBasePath missing/
  );

  const bpGuardStart = editorSource.indexOf('LoveBudEditorShellHelpers.getEditorBasePath missing');
  assert.notEqual(bpGuardStart, -1, 'getEditorBasePath missing guard must exist');
  const bpGuardEnd = editorSource.indexOf('const buildEditorRedirectTarget =', bpGuardStart);
  assert.notEqual(bpGuardEnd, -1, 'buildEditorRedirectTarget must exist after base path guard');
  const bpGuardBlock = editorSource.slice(bpGuardStart, bpGuardEnd);
  assert.doesNotMatch(bpGuardBlock, /reportError/);

  // buildEditorRedirectTarget (fallback still active)
  assert.match(editorSource, /shellHelpers\.buildEditorRedirectTarget \|\|/);
});

test('editor html loads shell helpers before editor entrypoint for core utilities', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
