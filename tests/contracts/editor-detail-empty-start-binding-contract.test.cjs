const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const bindingsSource = fs.readFileSync('js/editor/editor-bindings.js', 'utf8');

test('editor bindings export detail empty start button helper', () => {
  assert.match(bindingsSource, /function bindDetailEmptyStartButton\(options\)/);
  assert.match(bindingsSource, /bindDetailEmptyStartButton:\s*bindDetailEmptyStartButton/);
});

test('editor delegates detail empty start binding through editor bindings helper', () => {
  assert.match(editorSource, /editorBindings\.bindDetailEmptyStartButton/);
  assert.match(editorSource, /bindDetailEmptyStartButton\(\{\s*showAddMemoryForm\s*\}\)/);
});

test('editor no longer binds detail empty start button directly', () => {
  assert.doesNotMatch(editorSource, /const detailEmptyStartBtn\s*=\s*document\.getElementById\('detailEmptyStartBtn'\)/);
  assert.doesNotMatch(editorSource, /detailEmptyStartBtn\.addEventListener\('click'/);
});
