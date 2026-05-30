const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const bindingsSource = fs.readFileSync('js/editor/editor-bindings.js', 'utf8');

test('editor delegates detail action binding with action handlers only', () => {
  assert.match(
    editorSource,
    /bindEditorPageEvents\s*\(\{/
  );
  assert.match(
    editorSource,
    /enterEditMode,\s*deleteMemory,\s*exitEditMode,\s*saveMemoryEdit/
  );
});

test('editor no longer looks up detail action buttons directly', () => {
  assert.doesNotMatch(editorSource, /const editMemoryBtn\s*=\s*document\.getElementById\('editMemoryBtn'\)/);
  assert.doesNotMatch(editorSource, /const deleteMemoryBtn\s*=\s*document\.getElementById\('deleteMemoryBtn'\)/);
  assert.doesNotMatch(editorSource, /const cancelEditBtn\s*=\s*document\.getElementById\('cancelEditBtn'\)/);
  assert.doesNotMatch(editorSource, /const saveEditBtn\s*=\s*document\.getElementById\('saveEditBtn'\)/);
});

test('editor bindings own detail action button lookup', () => {
  assert.match(bindingsSource, /getDetailButton\('editMemoryBtn'\)/);
  assert.match(bindingsSource, /getDetailButton\('deleteMemoryBtn'\)/);
  assert.match(bindingsSource, /getDetailButton\('cancelEditBtn'\)/);
  assert.match(bindingsSource, /getDetailButton\('saveEditBtn'\)/);
});
