const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

test('editor page event bindings helper loads before editor entrypoint', () => {
  const eventBindingsScript = '../js/editor/editor-page-event-bindings.js';
  const editorEntrypointScript = '../js/editor.js';

  const eventBindingsIndex = editorHtml.indexOf(eventBindingsScript);
  const editorEntrypointIndex = editorHtml.indexOf(editorEntrypointScript);

  assert.notEqual(eventBindingsIndex, -1);
  assert.notEqual(editorEntrypointIndex, -1);
  assert.ok(eventBindingsIndex < editorEntrypointIndex);
});

test('editor page event bindings helper remains near existing editor orchestration helpers', () => {
  const saveStatusOrchestrationScript = '../js/editor/editor-save-status-orchestration.js';
  const eventBindingsScript = '../js/editor/editor-page-event-bindings.js';
  const editorEntrypointScript = '../js/editor.js';

  const saveStatusIndex = editorHtml.indexOf(saveStatusOrchestrationScript);
  const eventBindingsIndex = editorHtml.indexOf(eventBindingsScript);
  const editorEntrypointIndex = editorHtml.indexOf(editorEntrypointScript);

  assert.notEqual(saveStatusIndex, -1);
  assert.notEqual(eventBindingsIndex, -1);
  assert.notEqual(editorEntrypointIndex, -1);
  assert.ok(saveStatusIndex < eventBindingsIndex);
  assert.ok(eventBindingsIndex < editorEntrypointIndex);
});

test('editor page event bindings helper is loaded once before editor entrypoint', () => {
  assert.equal(countMatches(editorHtml, /\.\.\/js\/editor\/editor-page-event-bindings\.js/g), 1);
  assert.equal(countMatches(editorHtml, /\.\.\/js\/editor\.js/g), 1);
});

test('editor page event bindings script order contract does not reference public viewer scripts', () => {
  assert.doesNotMatch(editorHtml, /public-viewer-canvas-entry\.js/);
  assert.doesNotMatch(editorHtml, /public-canvas-init\.js/);
  assert.doesNotMatch(editorHtml, /public-viewer-canvas-adapter\.js/);
});
