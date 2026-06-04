const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function verifyGuardExists(guardMsg) {
  const guardIndex = editorSource.indexOf(guardMsg);
  assert.notEqual(guardIndex, -1, `${guardMsg} guard must exist`);
  return guardIndex;
}

function verifyGuardPattern(guardMsg) {
  const guardIndex = editorSource.indexOf(guardMsg);
  assert.notEqual(guardIndex, -1, `${guardMsg} guard must exist`);

  // Find the enclosing typeof check before this guard message
  const blockStart = editorSource.lastIndexOf("if (typeof ", guardIndex);
  assert.notEqual(blockStart, -1, `typeof check must precede ${guardMsg}`);

  const block = editorSource.slice(blockStart, guardIndex + guardMsg.length + 30);
  assert.match(block, /typeof \w+ !== 'function'/);
  assert.match(block, /reportEditorBootstrapMissingDependency\(/);
  assert.match(block, /return/);
}

test('editor bootstrap has reportEditorBootstrapMissingDependency and reportEditorBootstrapMissingList helpers', () => {
  assert.match(editorSource, /function reportEditorBootstrapMissingDependency\(msg\)/);
  assert.match(editorSource, /function reportEditorBootstrapMissingList\(missingHelpers\)/);
  assert.match(editorSource, /console\.error\('\[editor-main\] ERROR: ' \+ msg\)/);
  assert.match(editorSource, /debugState\.errors\.push\(\{ msg, error: msg \}\)/);
});

test('editor bootstrap guards shell helper functions using typeof check with reportEditorBootstrapMissingDependency', () => {
  const guards = [
    'LoveBudEditorShellHelpers.createEditorStartDependencyGuard missing',
    'LoveBudEditorShellHelpers.createEditorStartDependencyChecker missing',
    'LoveBudEditorShellHelpers.createEditorRequiredGlobalWaiter missing',
    'LoveBudEditorShellHelpers.createEditorStartupShellApplier missing',
    'LoveBudEditorShellHelpers.createEditorCanvasEmptyGuideUpdater missing',
    'LoveBudEditorShellHelpers.createEditorSelectNodeHandler missing',
    'LoveBudEditorShellHelpers.createEditorSidebarStatusUpdater missing',
    'LoveBudEditorShellHelpers.createEditorInitialMemoryProvider missing',
    'LoveBudEditorShellHelpers.createEditorNextMemoryIdProvider missing',
    'LoveBudEditorShellHelpers.createEditorInitialSelectionApplier missing',
    'LoveBudEditorShellHelpers.createEditorReadyFinalizer missing',
    'LoveBudEditorPageHelpers.registerEditorAuthStart missing'
  ];

  for (const guard of guards) {
    verifyGuardPattern(guard);
  }
});

test('editor bootstrap typeof guards stay before startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(startEditorIndex, -1, 'startEditor must exist');

  const guards = [
    'createEditorStartDependencyGuard',
    'createEditorStartDependencyChecker',
    'createEditorRequiredGlobalWaiter',
    'createEditorStartupShellApplier',
    'registerEditorAuthStart'
  ];

  for (const funcName of guards) {
    const guardIndex = editorSource.indexOf(`typeof ${funcName} !== 'function'`);
    if (guardIndex !== -1) {
      assert.ok(guardIndex < startEditorIndex,
        `${funcName} typeof guard must stay before startEditor`);
    }
  }
});

test('editor bootstrap old missing-list arrays are removed', () => {
  assert.doesNotMatch(editorSource, /const missingTextResolvers = \[/);
  assert.doesNotMatch(editorSource, /const missingMediaResolvers = \[/);
  assert.doesNotMatch(editorSource, /const missingRootHelpers = \[/);
  assert.doesNotMatch(editorSource, /\.filter\(\(\[, helper\]\) => typeof helper !== 'function'\)/);
});

test('editor bootstrap old missing-list patterns do not leak into startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  const startEditorBody = editorSource.slice(startEditorIndex);

  assert.doesNotMatch(startEditorBody, /missingTextResolvers/);
  assert.doesNotMatch(startEditorBody, /missingMediaResolvers/);
  assert.doesNotMatch(startEditorBody, /missingRootHelpers/);
  assert.doesNotMatch(startEditorBody, /reportEditorBootstrapMissingDependency\(/);
});
