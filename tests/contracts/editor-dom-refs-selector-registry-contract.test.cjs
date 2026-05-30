const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const refsBuilderSource = fs.readFileSync('js/editor/editor-dom-refs-builder.js', 'utf8');
const selectorsSource = fs.readFileSync('js/editor/editor-dom-selectors.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor dom refs builder uses selector registry primary path', () => {
  assert.match(refsBuilderSource, /window\.LoveBudEditorDomSelectors/);
  assert.match(refsBuilderSource, /domSelectors\.SELECTORS/);
  assert.match(refsBuilderSource, /domSelectors\.getElement/);
});

test('editor dom refs builder keeps exported ref builder functions', () => {
  assert.match(refsBuilderSource, /const createEditorDomRefs\s*=/);
  assert.match(refsBuilderSource, /const createEditorFormRefs\s*=/);
  assert.match(refsBuilderSource, /createEditorDomRefs,\s*[\r\n\s]*createEditorFormRefs/);
});

test('editor dom refs builder resolves core editor refs through selector constants', () => {
  assert.match(refsBuilderSource, /SELECTORS\.canvasArea\s*\|\|\s*'canvasArea'/);
  assert.match(refsBuilderSource, /SELECTORS\.canvasSvg\s*\|\|\s*'canvasSvg'/);
  assert.match(refsBuilderSource, /SELECTORS\.detailPanel\s*\|\|\s*'detailPanel'/);
  assert.match(refsBuilderSource, /SELECTORS\.addMemoryBtn\s*\|\|\s*'addMemoryBtn'/);
});

test('editor dom refs builder resolves memory form refs through selector constants', () => {
  assert.match(refsBuilderSource, /SELECTORS\.memoryUrlInput\s*\|\|\s*'memoryUrlInput'/);
  assert.match(refsBuilderSource, /SELECTORS\.memoryTitleInput\s*\|\|\s*'memoryTitleInput'/);
  assert.match(refsBuilderSource, /SELECTORS\.memoryMemoInput\s*\|\|\s*'memoryMemoInput'/);
  assert.match(refsBuilderSource, /SELECTORS\.cancelAddMemory\s*\|\|\s*'cancelAddMemory'/);
  assert.match(refsBuilderSource, /SELECTORS\.confirmAddMemory\s*\|\|\s*'confirmAddMemory'/);
});

test('selector registry defines all ids consumed by dom refs builder', () => {
  [
    'canvasArea',
    'canvasSvg',
    'detailPanel',
    'addMemoryBtn',
    'memoryUrlInput',
    'memoryTitleInput',
    'memoryMemoInput',
    'cancelAddMemory',
    'confirmAddMemory'
  ].forEach((key) => {
    assert.match(selectorsSource, new RegExp(`${key}:\\s*'${key}'`));
  });
});

test('editor entrypoint still delegates initial refs through dom refs builder', () => {
  assert.match(editorSource, /const createEditorDomRefs\s*=\s*editorDomRefsBuilder\.createEditorDomRefs/);
  assert.match(editorSource, /typeof createEditorDomRefs !== 'function'/);
  assert.match(editorSource, /LoveBudEditorDomRefsBuilder\.createEditorDomRefs missing/);
  assert.match(editorSource, /createEditorStartupContext\(\{\s*createEditorDomRefs,/);
  assert.match(editorSource, /locationRef:\s*window\.location/);
  assert.match(editorSource, /URLSearchParamsRef:\s*URLSearchParams/);
});
