const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('auth callbacks preserve editor onAuthReady fallback registered before auth bootstrap loads', () => {
  const editorSource = readRepoFile('js/editor.js');
  const pageHelpersSource = readRepoFile('js/editor/editor-page-helpers.js');
  const callbacksSource = readRepoFile('js/auth/auth-callbacks.js');

  assert.match(
    editorSource,
    /registerEditorAuthStart/,
    'Editor must delegate auth start to page helpers'
  );
  assert.match(
    pageHelpersSource,
    /if\s*\(typeof\s+windowRef\.registerOnAuthReady\s*===\s*['"]function['"]\)/,
    'Page helpers must prefer registerOnAuthReady when auth callbacks are already available'
  );
  assert.match(
    pageHelpersSource,
    /windowRef\.onAuthReady\s*=\s*tryStartEditor/,
    'Page helpers currently falls back to window.onAuthReady when loaded before auth callbacks'
  );

  assert.match(
    callbacksSource,
    /function\s+preserveEarlyAuthReadyFallback\s*\(/,
    'auth callbacks must define a helper to preserve early window.onAuthReady fallback'
  );
  assert.match(
    callbacksSource,
    /typeof\s+window\.onAuthReady\s*!==\s*["']function["']/,
    'preservation helper must ignore missing non-function fallback values'
  );
  assert.match(
    callbacksSource,
    /window\.__onAuthReadyCallbacks\.push\(earlyCallback\)/,
    'early Editor callback must be pushed into the shared auth-ready callback registry'
  );
  assert.match(
    callbacksSource,
    /window\.onAuthReady\.__lovebudPreservedAuthReadyFallback\s*===\s*true/,
    'preservation helper must be idempotent for repeated auth bootstrap calls'
  );
  assert.match(
    callbacksSource,
    /window\.__onAuthReadyCallbacks\.indexOf\(callback\)\s*===\s*-1/,
    'registerOnAuthReady must avoid duplicate callback registration'
  );
  assert.match(
    callbacksSource,
    /preserveEarlyAuthReadyFallback\(\);[\s\S]*function\s+registerOnAuthReady/,
    'early fallback preservation must run before normal auth callback registration is used'
  );
});
