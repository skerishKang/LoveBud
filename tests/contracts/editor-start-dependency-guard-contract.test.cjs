const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose start dependency guard factory', () => {
  assert.match(shellHelpersSource, /createEditorStartDependencyGuard:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function ensureStartEditorDependency\(dependency,\s*message\)/);
  assert.match(shellHelpersSource, /if \(typeof dependency === 'function'\) return true;/);
  assert.match(shellHelpersSource, /reportError\(message\);/);
  assert.match(shellHelpersSource, /return false;/);
});

test('editor entrypoint resolves start dependency guard from shell helpers', () => {
  assert.match(editorSource, /const createEditorStartDependencyGuard = shellHelpers\.createEditorStartDependencyGuard;/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorStartDependencyGuard missing/);
});

test('editor start flow delegates ensureStartEditorDependency to shell helper factory', () => {
  assert.match(editorSource, /const ensureStartEditorDependency = createEditorStartDependencyGuard\(\{ reportError \}\);/);
  assert.doesNotMatch(editorSource, /const ensureStartEditorDependency = \(dependency,\s*message\) => \{/);
});

test('editor start dependency guard slice avoids canvas runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
