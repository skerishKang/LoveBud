const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const initialLoadFlowSource = fs.readFileSync('js/editor/editor-initial-load-flow.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose markEditorReady helper', () => {
  assert.match(shellHelpersSource, /markEditorReady:\s*function/);
  assert.match(shellHelpersSource, /classList\.remove\('editor-preload'\)/);
});

test('markEditorReady removes editor preload class through classList', () => {
  assert.match(shellHelpersSource, /body\.classList\.remove\(/);
  assert.match(shellHelpersSource, /'editor-preload'/);
});

test('editor delegates ready marker to shell helper with fallback', () => {
  assert.match(editorSource, /shellHelpers\.markEditorReady/);
  assert.doesNotMatch(editorSource, /document\.body\?\.classList\.remove\('editor-preload'\)/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.markEditorReady missing/);
});

test('editor ready marker call sites remain intact', () => {
  const matches = (editorSource + initialLoadFlowSource).match(/markEditorReady\(\)/g) || [];
  assert.ok(matches.length >= 2, 'existing markEditorReady call sites should remain');
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
