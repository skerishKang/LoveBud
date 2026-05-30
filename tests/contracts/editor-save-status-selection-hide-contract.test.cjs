const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const saveStatusSource = fs.readFileSync('js/editor/editor-save-status.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractSelectNodeBlock(source) {
  const marker = 'const selectNode = (el, data) => {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'selectNode block must exist');

  const end = source.indexOf('            const focusSelectedMoment = () => {', start);
  assert.notEqual(end, -1, 'focusSelectedMoment marker must follow selectNode');

  return source.slice(start, end);
}

test('editor save status exposes selection hide helper', () => {
  assert.match(saveStatusSource, /function hideSaveStatusIndicator\(saveStatusData\)/);
  assert.match(saveStatusSource, /document\.getElementById\('saveStatusIndicator'\)/);
  assert.match(saveStatusSource, /clearTimeout\(saveStatusData\.timer\)/);
  assert.match(saveStatusSource, /saveStatusData\.timer\s*=\s*null/);
  assert.match(saveStatusSource, /indicator\.style\.display\s*=\s*'none'/);
  assert.match(saveStatusSource, /hideSaveStatusIndicator:\s*hideSaveStatusIndicator/);
});

test('editor selectNode delegates save status hide to save status helper', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.match(
    selectNodeBlock,
    /editorSaveStatus\.hideSaveStatusIndicator\(saveStatusData\)/
  );

  assert.match(
    selectNodeBlock,
    /typeof editorSaveStatus\.hideSaveStatusIndicator === 'function'/
  );
});

test('editor selectNode no longer owns save status indicator dom hide logic', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.doesNotMatch(
    selectNodeBlock,
    /document\.getElementById\('saveStatusIndicator'\)/
  );

  assert.doesNotMatch(
    selectNodeBlock,
    /clearTimeout\(saveStatusData\.timer\)/
  );

  assert.doesNotMatch(
    selectNodeBlock,
    /indicator\.style\.display\s*=\s*'none'/
  );
});

test('editor selectNode keeps selection and detail update flow intact', () => {
  const selectNodeBlock = extractSelectNodeBlock(editorSource);

  assert.match(selectNodeBlock, /selectedNodeId\s*=\s*data\.id/);
  assert.match(selectNodeBlock, /currentEditingMemory\s*=\s*data/);
  assert.match(selectNodeBlock, /document\.querySelectorAll\('\.memory-node'\)/);
  assert.match(selectNodeBlock, /if \(el\) el\.classList\.add\('selected'\)/);
  assert.match(selectNodeBlock, /updateDetailPanel\(data\)/);
  assert.match(selectNodeBlock, /updateFocusSelectedBtn\(\)/);
  assert.match(selectNodeBlock, /setDetailEmptyState\(false\)/);
  assert.match(selectNodeBlock, /editorCanvas\.updateAffordance\(\)/);
});

test('editor-save-status loads before editor entrypoint', () => {
  const saveStatusIndex = editorHtml.indexOf('js/editor/editor-save-status.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(saveStatusIndex, -1, 'editor-save-status.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(saveStatusIndex < editorJsIndex, 'editor-save-status.js must load before editor.js');
});
