const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const entryDependenciesSource = fs.readFileSync('js/editor/editor-entry-dependencies.js', 'utf8');

test('editor entrypoint no longer keeps unused fallback namespace local reads', () => {
  assert.doesNotMatch(editorSource, /const\s+dataLoaderFallbacks\s*=/);
  assert.doesNotMatch(editorSource, /const\s+entryFallbacks\s*=/);
  assert.doesNotMatch(editorSource, /const\s+editorAuthHelpers\s*=/);
});

test('entry dependency resolver still owns fallback namespace resolution', () => {
  assert.match(entryDependenciesSource, /LoveBudEditorDataLoaderFallbacks/);
  assert.match(entryDependenciesSource, /LoveBudEditorEntryFallbacks/);
  assert.match(entryDependenciesSource, /LoveBudEditorAuthHelpers/);
});

test('editor still consumes resolved dependency outputs that remain active', () => {
  assert.match(editorSource, /const\s+deps\s*=\s*entryDependenciesResult\.deps/);
  assert.match(editorSource, /const\s+editorDataLoader\s*=\s*deps\.editorDataLoader/);
  assert.match(editorSource, /const\s+getConfirmedSessionUser\s*=\s*deps\.getConfirmedSessionUser/);
  assert.match(editorSource, /const\s+readConfirmedAuthCache\s*=\s*deps\.readConfirmedAuthCache/);
});

test('unused fallback namespace cleanup avoids runtime behavior changes', () => {
  assert.match(editorSource, /runEditorInitialLoadFlow\(\{/);
  assert.match(editorSource, /registerEditorAuthStart\(\{/);
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
