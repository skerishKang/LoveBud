const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const saveStatusSource = fs.readFileSync('js/editor/editor-save-status.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

function extractSelectNodeBlock(source) {
  const marker = 'createEditorSelectNodeHandler: function(options) {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'selectNode factory block must exist');

  const end = source.indexOf('    },', start);
  const blockEnd = source.indexOf('    },', end + 1);
  assert.notEqual(blockEnd, -1, 'factory closing marker must follow');

  return source.slice(start, blockEnd + 6);
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
  const selectNodeBlock = extractSelectNodeBlock(shellHelpersSource);

  assert.match(
    selectNodeBlock,
    /editorSaveStatus\.hideSaveStatusIndicator\(getSaveStatusData\(\)\)/
  );

  assert.match(
    selectNodeBlock,
    /typeof editorSaveStatus\.hideSaveStatusIndicator === 'function'/
  );
});

test('editor selectNode no longer owns save status indicator dom hide logic', () => {
  const selectNodeBlock = extractSelectNodeBlock(shellHelpersSource);

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
  const selectNodeBlock = extractSelectNodeBlock(shellHelpersSource);

  assert.match(selectNodeBlock, /setSelectedNodeId\(data\.id\)/);
  assert.match(selectNodeBlock, /setCurrentEditingMemory\(data\)/);
  assert.match(selectNodeBlock, /editorSelectionUI\.applySelectedMemoryNode\(el\)/);
  assert.match(selectNodeBlock, /editorSaveStatus\.hideSaveStatusIndicator\(getSaveStatusData\(\)\)/);
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
