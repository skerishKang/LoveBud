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

  assert.match(editor, /const\s+editorAuthHelpers\s*=\s*window\.LoveBudEditorAuthHelpers\s*\|\|\s*\{\}/);
  assert.match(editor, /readConfirmedAuthCacheFromHelper\s*=\s*\(\)\s*=>\s*\(/);
  assert.match(editor, /window\.LoveBudEditorAuthHelpers\?\.readConfirmedAuthCache\?\.\(\)/);
  assert.doesNotMatch(editor, /[^.\w]readConfirmedAuthCache\s*\(/);
});
