const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('entry dependency resolver still guards individual bootstrap dependencies', () => {
  const resolver = read('js/editor/editor-entry-dependencies.js');

  const resolverGuarded = [
    'LoveBudEditorShellHelpers.createInlineShowToastFallback',
    'LoveBudEditorShellHelpers.getI18n',
    'LoveBudEditorShellHelpers.getEditorBasePath',
    'LoveBudEditorPageHelpers.redirectToEditorLogin',
    'LoveBudEditorTreeHelpers.syncCurrentTreeData',
    'LoveBudEditorTreeHelpers.resolveParentIdForCreate',
    'LoveBudEditorPageHelpers.getMyTreesHref',
    'LoveBudEditorPageHelpers.renderTreeLoadError',
    'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy',
    'LoveBudEditorShellHelpers.applyEditorShellCopy',
    'LoveBudEditorShellCopyApplier.createPrepareEditorShell',
    'LoveBudEditorShellHelpers.createEditorDebugReporter'
  ];

  for (const marker of resolverGuarded) {
    assert.ok(resolver.includes(marker), `entry-dependencies must guard ${marker}`);
  }
});

test('entry dependency resolver still guards aggregated bootstrap dependencies', () => {
  const resolver = read('js/editor/editor-entry-dependencies.js');

  const resolverAggregated = [
    'LoveBudEditorUtils.findRootMemory',
    'LoveBudEditorUtils.getCanonicalRootId',
    'LoveBudEditorUtils.isRootMemory',
    'LoveBudEditorHelpers.safeI18nText',
    'LoveBudEditorHelpers.resolveHintText',
    'LoveBudEditorHelpers.resolveTreeTitleText',
    'LoveBudEditorHelpers.resolveInfoText',
    'LoveBudEditorHelpers.escapeHtml',
    'LoveBudEditorHelpers.safeUrl',
    'LoveBudEditorHelpers.resolveMemoryThumbnail'
  ];

  for (const marker of resolverAggregated) {
    assert.ok(resolver.includes(marker), `entry-dependencies must guard ${marker}`);
  }
});

test('resolver-owned duplicate bootstrap guards are removed from editor entry', () => {
  const editor = read('js/editor.js');

  const removedMarkers = [
    'LoveBudEditorShellHelpers.createInlineShowToastFallback missing',
    'LoveBudEditorShellHelpers.getI18n missing',
    'LoveBudEditorShellHelpers.getEditorBasePath missing',
    'LoveBudEditorPageHelpers.redirectToEditorLogin missing',
    'LoveBudEditorTreeHelpers.syncCurrentTreeData missing',
    'LoveBudEditorTreeHelpers.resolveParentIdForCreate missing',
    'LoveBudEditorPageHelpers.getMyTreesHref missing',
    'LoveBudEditorPageHelpers.renderTreeLoadError missing',
    'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy missing',
    'LoveBudEditorShellHelpers.applyEditorShellCopy missing',
    'LoveBudEditorShellCopyApplier.createPrepareEditorShell missing',
    'LoveBudEditorShellHelpers.createEditorDebugReporter missing'
  ];

  for (const marker of removedMarkers) {
    assert.equal(editor.includes(marker), false, `${marker} should be removed from editor.js`);
  }

  assert.equal(editor.includes('const missingTextResolvers = ['), false);
  assert.equal(editor.includes('const missingMediaResolvers = ['), false);
  assert.equal(editor.includes('const missingRootHelpers = ['), false);
});

test('resolver-owned aliases now read directly from deps in editor entry', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /const showToast = deps\.showToast;/);
  assert.match(editor, /const i18n = deps\.i18n;/);
  assert.match(editor, /getEditorBasePath:\s*deps\.getEditorBasePath/);
  assert.doesNotMatch(editor, /const getEditorBasePath = deps\.getEditorBasePath;/);
  assert.match(editor, /const redirectToEditorLogin = deps\.redirectToEditorLogin;/);
  assert.match(editor, /const safeI18nText = deps\.safeI18nText;/);
  // syncCurrentTreeData and resolveParentIdForCreate are inlined at call site
  assert.match(editor, /syncCurrentTreeData:\s*deps\.syncCurrentTreeData/);
  assert.match(editor, /resolveParentIdForCreate:\s*deps\.resolveParentIdForCreate/);
  // renderTreeLoadError and buildTreeLoadErrorCopy are inlined at call site
  assert.match(editor, /renderTreeLoadError:\s*deps\.renderTreeLoadError/);
  assert.match(editor, /buildTreeLoadErrorCopy:\s*deps\.buildTreeLoadErrorCopy/);
  // applyEditorShellCopy and createPrepareEditorShell are inlined at call site
  assert.match(editor, /deps\.applyEditorShellCopy\(safeI18nText,\s*i18n\);/);
  assert.match(editor, /deps\.createPrepareEditorShell\(\{/);
  assert.match(editor, /applyEditorShellCopy:\s*deps\.applyEditorShellCopy/);
  assert.match(editor, /deps\.createEditorDebugReporter/);
  assert.doesNotMatch(editor, /const createEditorDebugReporter = deps\.createEditorDebugReporter;/);

  assert.doesNotMatch(editor, /const createInlineShowToastFallback = shellHelpers\./);
  assert.doesNotMatch(editor, /const getI18n = shellHelpers\./);
  assert.doesNotMatch(editor, /const getEditorBasePath = shellHelpers\./);
  assert.doesNotMatch(editor, /const syncCurrentTreeData = deps\.syncCurrentTreeData;/);
  assert.doesNotMatch(editor, /const resolveParentIdForCreate = deps\.resolveParentIdForCreate;/);
});

test('editor-owned bootstrap guards remain in editor entry', () => {
  const editor = read('js/editor.js');

  const retainedMarkers = [
    'LoveBudEditorEntryDependencies.resolveEditorEntryDependencies missing',
    'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
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
    'LoveBudEditorShellHelpers.createEditorReadyFinalizer missing'
  ];

  for (const marker of retainedMarkers) {
    assert.ok(editor.includes(marker), `${marker} should remain in editor.js`);
  }
});

test('getYouTubeInputErrorMessageFallback guard remains removed', () => {
  const editor = read('js/editor.js');

  assert.ok(!editor.includes('getYouTubeInputErrorMessageFallback'));
});

test('runtime checks still present in editor entry', () => {
  const editor = read('js/editor.js');

  assert.ok(editor.includes('reportEditorBootstrapMissingDependency'));
  assert.ok(editor.includes("entryDependenciesResult.status === 'stopped'"));
});