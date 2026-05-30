const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

test('editor startup context helper loads before editor entrypoint', () => {
  const startupContextScript = '../js/editor/editor-startup-context.js';
  const editorEntrypointScript = '../js/editor.js';

  const startupContextIndex = editorHtml.indexOf(startupContextScript);
  const editorEntrypointIndex = editorHtml.indexOf(editorEntrypointScript);

  assert.notEqual(startupContextIndex, -1);
  assert.notEqual(editorEntrypointIndex, -1);
  assert.ok(startupContextIndex < editorEntrypointIndex);
});

test('editor startup context helper loads after dom refs builder', () => {
  const domRefsScript = '../js/editor/editor-dom-refs-builder.js';
  const startupContextScript = '../js/editor/editor-startup-context.js';
  const editorEntrypointScript = '../js/editor.js';

  const domRefsIndex = editorHtml.indexOf(domRefsScript);
  const startupContextIndex = editorHtml.indexOf(startupContextScript);
  const editorEntrypointIndex = editorHtml.indexOf(editorEntrypointScript);

  assert.notEqual(domRefsIndex, -1);
  assert.notEqual(startupContextIndex, -1);
  assert.notEqual(editorEntrypointIndex, -1);
  assert.ok(domRefsIndex < startupContextIndex);
  assert.ok(startupContextIndex < editorEntrypointIndex);
});

test('editor startup context helper is loaded once', () => {
  assert.equal(countMatches(editorHtml, /\.\.\/js\/editor\/editor-startup-context\.js/g), 1);
});
