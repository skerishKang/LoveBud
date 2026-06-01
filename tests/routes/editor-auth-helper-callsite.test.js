const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor auth cache reader is called through the helper namespace binding', () => {
  const editor = read('js/editor.js');
  const entryDeps = read('js/editor/editor-entry-dependencies.js');

  // editor.js should get readConfirmedAuthCache from deps (not directly from window)
  assert.match(editor, /const\s+readConfirmedAuthCache\s*=\s*deps\.readConfirmedAuthCache/);
  assert.doesNotMatch(editor, /const\s+editorAuthHelpers\s*=\s*window\.LoveBudEditorAuthHelpers/);

  // entry-dependencies.js should resolve the auth helpers namespace
  assert.match(entryDeps, /windowRef\.LoveBudEditorAuthHelpers\?\.readConfirmedAuthCache\?\.\(\)/);
});
