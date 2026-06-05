const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellGuardsSource = fs.readFileSync('js/editor/editor-shell-guards.js', 'utf8');

test('editor shell guards sub-module exposes start dependency guard factory', () => {
  assert.match(shellGuardsSource, /createEditorStartDependencyGuard:\s*function\(options\)/);
  assert.match(shellGuardsSource, /return function ensureStartEditorDependency\(dependency,\s*message\)/);
  assert.match(shellGuardsSource, /if \(typeof dependency === 'function'\) return true;/);
  assert.match(shellGuardsSource, /reportError\(message\);/);
  assert.match(shellGuardsSource, /return false;/);
});

test('editor entrypoint resolves start dependency guard from shell helpers', () => {
  assert.match(editorSource, /const createEditorStartDependencyGuard = deps\.shellHelpers\.createEditorStartDependencyGuard;/);
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
