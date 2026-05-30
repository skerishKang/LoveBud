const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const bindingsSource = fs.readFileSync('js/editor/editor-bindings.js', 'utf8');

test('editor delegates memory create control refs to editor bindings', () => {
  assert.match(editorSource, /editorBindings\.bindMemoryCreateControlsFromDom/);
  assert.match(
    editorSource,
    /bindMemoryCreateControlsFromDom\(\{\s*showAddMemoryForm,\s*hideAddMemoryForm,\s*addMemoryFromForm,\s*updateSaveStatus,\s*showToast,\s*i18n\s*\}\)/
  );
});

test('editor no longer builds memory create form refs directly', () => {
  assert.doesNotMatch(editorSource, /createEditorFormRefs/);
  assert.doesNotMatch(editorSource, /memoryUrlInput/);
  assert.doesNotMatch(editorSource, /memoryTitleInput/);
  assert.doesNotMatch(editorSource, /memoryMemoInput/);
  assert.doesNotMatch(editorSource, /cancelAddMemory/);
  assert.doesNotMatch(editorSource, /confirmAddMemory/);
});

test('editor bindings own memory create control lookup', () => {
  assert.match(bindingsSource, /function bindMemoryCreateControlsFromDom\(options\)/);
  assert.match(bindingsSource, /function getMemoryCreateControlRefs\(\)/);
  assert.match(bindingsSource, /document\.getElementById\('addMemoryBtn'\)/);
  assert.match(bindingsSource, /document\.getElementById\('cancelAddMemory'\)/);
  assert.match(bindingsSource, /document\.getElementById\('confirmAddMemory'\)/);
  assert.match(bindingsSource, /document\.getElementById\('memoryUrlInput'\)/);
  assert.match(bindingsSource, /document\.getElementById\('memoryTitleInput'\)/);
  assert.match(bindingsSource, /document\.getElementById\('memoryMemoInput'\)/);
  assert.match(bindingsSource, /bindMemoryCreateControlsFromDom:\s*bindMemoryCreateControlsFromDom/);
});

test('existing bindMemoryCreateControls export remains available', () => {
  assert.match(bindingsSource, /bindMemoryCreateControls:\s*bindMemoryCreateControls/);
});
