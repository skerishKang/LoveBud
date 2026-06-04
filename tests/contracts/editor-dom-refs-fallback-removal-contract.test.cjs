const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const refsBuilderSource = fs.readFileSync('js/editor/editor-dom-refs-builder.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor entrypoint uses dom refs builder without inline fallback', () => {
  assert.match(
    editorSource,
    /const createEditorDomRefs\s*=\s*deps\.createEditorDomRefs/
  );

  assert.doesNotMatch(
    editorSource,
    /createEditorDomRefs\s*=\s*editorDomRefsBuilder\.createEditorDomRefs\s*\|\|/
  );

  assert.doesNotMatch(
    editorSource,
    /canvas:\s*document\.getElementById\('canvasArea'\)/
  );

  assert.doesNotMatch(
    editorSource,
    /svg:\s*document\.getElementById\('canvasSvg'\)/
  );

  assert.doesNotMatch(
    editorSource,
    /detailPanel:\s*document\.getElementById\('detailPanel'\)/
  );

  assert.doesNotMatch(
    editorSource,
    /addBtn:\s*document\.getElementById\('addMemoryBtn'\)/
  );
});

test('editor entrypoint reports missing dom refs builder before calling it', () => {
  const checkerIndex = editorSource.indexOf("checkEditorStartupContextDependencies");
  const startupContextCallIndex = editorSource.indexOf('createEditorStartupContext({');

  assert.notEqual(checkerIndex, -1, 'startup context dependency checker must exist');
  assert.notEqual(startupContextCallIndex, -1, 'startup context call must exist');
  assert.ok(checkerIndex < startupContextCallIndex, 'dependency checker must run before startup context call');

  assert.match(
    editorSource,
    /LoveBudEditorDomRefsBuilder\.createEditorDomRefs missing/
  );
});

test('dom refs builder remains responsible for core editor refs', () => {
  assert.match(refsBuilderSource, /const createEditorDomRefs\s*=\s*\(\)\s*=>\s*\(\{/);
  assert.match(refsBuilderSource, /canvas:\s*getElement\(SELECTORS\.canvasArea\s*\|\|\s*'canvasArea'\)/);
  assert.match(refsBuilderSource, /svg:\s*getElement\(SELECTORS\.canvasSvg\s*\|\|\s*'canvasSvg'\)/);
  assert.match(refsBuilderSource, /detailPanel:\s*getElement\(SELECTORS\.detailPanel\s*\|\|\s*'detailPanel'\)/);
  assert.match(refsBuilderSource, /addBtn:\s*getElement\(SELECTORS\.addMemoryBtn\s*\|\|\s*'addMemoryBtn'\)/);
});

test('dom refs builder still loads before editor entrypoint', () => {
  const builderIndex = editorHtml.indexOf('js/editor/editor-dom-refs-builder.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(builderIndex, -1, 'editor-dom-refs-builder.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(builderIndex < editorJsIndex, 'dom refs builder must load before editor.js');
});
