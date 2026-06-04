const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor auth cache reader is resolved from entry dependencies', () => {
  const editor = read('js/editor.js');
  const deps = read('js/editor/editor-entry-dependencies.js');

  // editor.js should get readConfirmedAuthCache from deps at call site
  assert.match(editor, /deps\.registerEditorAuthStart\(\{[\s\S]*readConfirmedAuthCache:\s*deps\.readConfirmedAuthCache/);

  // editor-entry-dependencies.js should expose readConfirmedAuthCache
  assert.match(deps, /readConfirmedAuthCache:\s*readConfirmedAuthCacheFromHelper/);

  // editor-entry-dependencies.js should define readConfirmedAuthCacheFromHelper internally
  assert.match(deps, /readConfirmedAuthCacheFromHelper\s*=\s*\(\)\s*=>\s*\(/);
  assert.match(deps, /windowRef\.LoveBudEditorAuthHelpers\?\.readConfirmedAuthCache\?\.\(\)/);
});
