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
  'createSidebarTreeActionsUpdater',
  'createCurrentMomentDetailOpener'
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

test('editor entrypoint has no remaining interaction helper local fallbacks', () => {
  for (const helperName of interactionHelpers) {
    assert.doesNotMatch(
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

test('editor entrypoint delegates missing current moment detail opener guard before creation', () => {
  const checkerIndex = editorSource.indexOf('checkEditorCurrentMomentDetailDependencies');
  const createIndex = editorSource.indexOf('const openCurrentMomentDetail = createCurrentMomentDetailOpener({');

  assert.ok(checkerIndex !== -1, 'current moment detail dependency checker must exist');
  assert.ok(createIndex !== -1, 'current moment detail opener creation must exist');
  assert.ok(checkerIndex < createIndex, 'dependency checker must run before current moment detail opener creation');

  assert.match(editorSource, /LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing/);
});

test('editor entrypoint delegates missing selected moment focus helper guard before creation', () => {
  const checkerIndex = editorSource.indexOf('checkEditorSelectedMomentFocusDependencies');
  const createIndex = editorSource.indexOf('const focusSelectedMoment = createSelectedMomentFocusHandler({');

  assert.ok(checkerIndex !== -1, 'selected moment focus dependency checker must exist');
  assert.ok(createIndex !== -1, 'selected moment focus creation must exist');
  assert.ok(checkerIndex < createIndex, 'dependency checker must run before selected moment focus creation');

  assert.match(editorSource, /LoveBudEditorShellHelpers\.createSelectedMomentFocusHandler missing/);
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
