const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const sidebarSource = fs.readFileSync('js/editor/editor-sidebar-ui.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose HTTP status resolver', () => {
  assert.match(shellHelpersSource, /getHttpStatus:\s*function\(error\)/);
  assert.match(shellHelpersSource, /Number\(/);
  assert.match(shellHelpersSource, /error && error\.status/);
  assert.match(shellHelpersSource, /error && error\.statusCode/);
  assert.match(shellHelpersSource, /error && error\.response && error\.response\.status/);
  assert.match(shellHelpersSource, /\|\|\s*0/);
});

test('editor delegates HTTP status resolver through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+getHttpStatus\s*=\s*shellHelpers\.getHttpStatus/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+getHttpStatus\s*=\s*shellHelpers\.getHttpStatus\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.getHttpStatus missing/
  );
});

test('editor keeps sidebar visibility toggle injection intact', () => {
  assert.match(editorSource, /bindEditorPageEvents\s*\(\{/);
  assert.match(editorSource, /getHttpStatus,/);
  assert.match(editorSource, /updateSidebarStatus/);
});

test('sidebar still consumes injected HTTP status resolver', () => {
  assert.match(sidebarSource, /const getHttpStatus = options\.getHttpStatus/);
  assert.match(sidebarSource, /typeof getHttpStatus === 'function' \? getHttpStatus\(error\)/);
  assert.match(sidebarSource, /status === 409/);
});

test('editor no longer owns standalone inline HTTP status resolver', () => {
  assert.doesNotMatch(
    editorSource,
    /const getHttpStatus\s*=\s*\(error\)\s*=>\s*Number\(error\?\.status \|\| error\?\.statusCode \|\| error\?\.response\?\.status \|\| 0\);/
  );
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
