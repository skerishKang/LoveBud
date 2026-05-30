const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const editorHtmlSource = fs.readFileSync('pages/editor.html', 'utf8');

const interactionHelpers = [
  'createSelectedMomentFocusHandler',
  'createSidebarTreeActionsUpdater',
  'createCurrentMomentDetailOpener'
];

test('editor shell helpers expose interaction helper boundaries', () => {
  for (const helperName of interactionHelpers) {
    assert.match(
      shellHelpersSource,
      new RegExp(`${helperName}:\\s*function\\s*\\(`),
      `${helperName} must be exported from LoveBudEditorShellHelpers`
    );
  }
});

const requiredInteractionHelpers = [
  'createSelectedMomentFocusHandler',
  'createSidebarTreeActionsUpdater'
];

test('editor entrypoint resolves required interaction helpers through shell helper boundary', () => {
  for (const helperName of requiredInteractionHelpers) {
    assert.match(
      editorSource,
      new RegExp(`const\\s+${helperName}\\s*=\\s*shellHelpers\\.${helperName}`)
    );
    assert.doesNotMatch(
      editorSource,
      new RegExp(`const\\s+${helperName}\\s*=\\s*shellHelpers\\.${helperName}\\s*\\|\\|`)
    );
  }
});

const fallbackInteractionHelpers = [
  'createCurrentMomentDetailOpener'
];

test('editor entrypoint keeps remaining interaction helper fallback intact', () => {
  for (const helperName of fallbackInteractionHelpers) {
    assert.match(
      editorSource,
      new RegExp(`const\\s+${helperName}\\s*=\\s*shellHelpers\\.${helperName}\\s*\\|\\|`)
    );
  }
});

test('editor entrypoint guards missing sidebar tree actions helper before creation', () => {
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createSidebarTreeActionsUpdater missing/
  );
  assert.match(
    editorSource,
    /const\s+updateSidebarTreeActions\s*=\s*createSidebarTreeActionsUpdater\(\{/
  );
});

test('editor html loads shell helpers before editor entrypoint for interaction helpers', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});

test('interaction helper boundary contract avoids canvas auth data and persistence modules', () => {
  const combinedBoundaryText = interactionHelpers
    .map((helperName) => {
      const start = shellHelpersSource.indexOf(`${helperName}: function`);
      assert.notEqual(start, -1, `${helperName} must exist`);
      const nextExport = shellHelpersSource.indexOf('\n        ', start + helperName.length + 1);
      return nextExport === -1 ? shellHelpersSource.slice(start) : shellHelpersSource.slice(start, nextExport);
    })
    .join('\n');

  assert.doesNotMatch(combinedBoundaryText, /createEditorCanvas/);
  assert.doesNotMatch(combinedBoundaryText, /initCanvas/);
  assert.doesNotMatch(combinedBoundaryText, /createEditorMemoryActions/);
  assert.doesNotMatch(combinedBoundaryText, /createEditorMemoryForm/);
  assert.doesNotMatch(combinedBoundaryText, /registerOnAuthReady/);
  assert.doesNotMatch(combinedBoundaryText, /LoveBudProtectedRoute/);
  assert.doesNotMatch(combinedBoundaryText, /apiClient/);
});
