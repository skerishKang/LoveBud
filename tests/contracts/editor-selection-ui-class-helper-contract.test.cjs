const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const selectionUISource = fs.readFileSync('js/editor/editor-selection-ui.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractSelectNodeBlock(source) {
  const marker = 'const selectNode = (el, data) => {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'selectNode block must exist');

  const end = source.indexOf('            const focusSelectedMoment = () => {', start);
  assert.notEqual(end, -1, 'focusSelectedMoment marker must follow selectNode');

  return source.slice(start, end);
}

test('editor selection ui exposes selected memory node helper', () => {
  assert.match(selectionUISource, /window\.LoveBudEditorSelectionUI/);
  assert.match(selectionUISource, /selectionUI\.applySelectedMemoryNode\s*=\s*function\(el,\s*options\)/);
  assert.match(selectionUISource, /DEFAULT_NODE_SELECTOR\s*=\s*'\.memory-node'/);
  assert.match(selectionUISource, /DEFAULT_SELECTED_CLASS\s*=\s*'selected'/);
  assert.match(selectionUISource, /querySelectorAll\(nodeSelector\)/);
  assert.match(selectionUISource, /classList\.remove\(selectedClass\)/);
  assert.match(selectionUISource, /classList\.add\(selectedClass\)/);
});

test('editor selectNode delegates selected class handling to selection ui helper', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.match(editorSource, /const editorSelectionUI\s*=\s*window\.LoveBudEditorSelectionUI\s*\|\|\s*\{\}/);
  assert.match(selectNodeBlock, /typeof editorSelectionUI\.applySelectedMemoryNode === 'function'/);
  assert.match(selectNodeBlock, /editorSelectionUI\.applySelectedMemoryNode\(el\)/);
  assert.match(selectNodeBlock, /LoveBudEditorSelectionUI\.applySelectedMemoryNode missing/);
});

test('editor selectNode no longer owns selected class dom mutation inline', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.doesNotMatch(
    selectNodeBlock,
    /document\.querySelectorAll\('\.memory-node'\)\.forEach/
  );

  assert.doesNotMatch(
    selectNodeBlock,
    /classList\.remove\('selected'\)/
  );

  assert.doesNotMatch(
    selectNodeBlock,
    /if \(el\) el\.classList\.add\('selected'\)/
  );
});

test('editor selectNode keeps state detail and affordance flow intact', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.match(selectNodeBlock, /selectedNodeId\s*=\s*data\.id/);
  assert.match(selectNodeBlock, /currentEditingMemory\s*=\s*data/);
  assert.match(selectNodeBlock, /editorSaveStatus\.hideSaveStatusIndicator\(saveStatusData\)/);
  assert.match(selectNodeBlock, /updateDetailPanel\(data\)/);
  assert.match(selectNodeBlock, /updateFocusSelectedBtn\(\)/);
  assert.match(selectNodeBlock, /setDetailEmptyState\(false\)/);
  assert.match(selectNodeBlock, /editorCanvas\.updateAffordance\(\)/);
});

test('editor-selection-ui loads before editor entrypoint', () => {
  const selectionIndex = editorHtml.indexOf('js/editor/editor-selection-ui.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(selectionIndex, -1, 'editor-selection-ui.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(selectionIndex < editorJsIndex, 'editor-selection-ui.js must load before editor.js');
});

test('editor-canvas-selection remains module-only and is not reused by editor entrypoint', () => {
  const canvasSelectionSource = fs.readFileSync('js/editor/editor-canvas-selection.js', 'utf8');

  assert.match(canvasSelectionSource, /export function getSelectedMemoryId/);
  assert.match(canvasSelectionSource, /export function reapplySelection/);
  assert.doesNotMatch(editorSource, /editor-canvas-selection/);
});
