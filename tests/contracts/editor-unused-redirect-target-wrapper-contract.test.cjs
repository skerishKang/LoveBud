const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const pageHelpersSource = fs.readFileSync('js/editor/editor-page-helpers.js', 'utf8');

test('editor no longer owns unused redirect target wrapper', () => {
  assert.doesNotMatch(editorSource, /buildEditorRedirectTargetHelper/);
  assert.doesNotMatch(editorSource, /const\s+buildEditorRedirectTarget\s*=\s*\(\)\s*=>/);
  assert.doesNotMatch(editorSource, /LoveBudEditorShellHelpers\.buildEditorRedirectTarget missing/);
});

test('redirect target helpers remain implemented outside editor entrypoint', () => {
  assert.match(shellHelpersSource, /buildEditorRedirectTarget:\s*function\(\)/);
  assert.match(shellHelpersSource, /this\.getEditorBasePath\(\)\s*\+\s*'editor'/);
  assert.match(pageHelpersSource, /function buildEditorRedirectTarget\(\)/);
  assert.match(pageHelpersSource, /function redirectToEditorLogin\(delayMs\)/);
});

test('redirect login still encodes editor redirect target through page helper', () => {
  assert.match(pageHelpersSource, /encodeURIComponent\(buildEditorRedirectTarget\(\)\)/);
  assert.match(pageHelpersSource, /window\.location\.href\s*=\s*loginUrl/);
});

test('unused redirect wrapper slice avoids runtime behavior changes', () => {
  assert.match(editorSource, /redirectToEditorLogin:\s*deps\.redirectToEditorLogin/);
  assert.doesNotMatch(editorSource, /const redirectToEditorLogin\s*=\s*deps\.redirectToEditorLogin/);
  assert.match(editorSource, /deps\.registerEditorAuthStart\(\{/);
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
