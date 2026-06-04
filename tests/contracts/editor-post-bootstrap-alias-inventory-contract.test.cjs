const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('post-bootstrap namespace-level deps aliases remain inventoried', () => {
  const editor = read('js/editor.js');

  const expectedNamespaceAliases = [
    'const shellHelpers = deps.shellHelpers;',
    'const editorHelpers = deps.editorHelpers;',
    'const editorSaveStatus = deps.editorSaveStatus;',
    'const editorPageHelpers = deps.editorPageHelpers;',
    'const editorTreeHelpers = deps.editorTreeHelpers;',
    'const editorSelectionUI = deps.editorSelectionUI;',
    'const editorBindings = deps.editorBindings;',
    'const editorPageEventBindings = deps.editorPageEventBindings;',
    'const editorDataLoader = deps.editorDataLoader;',
    'const editorInitialLoadFlow = deps.editorInitialLoadFlow;',
    'const editorRefreshSaveRuntime = deps.editorRefreshSaveRuntime;',
    'const editorStartupContext = deps.editorStartupContext;',
    'const editorShellCopyApplier = deps.editorShellCopyApplier;',
    'const editorDomRefsBuilder = deps.editorDomRefsBuilder;'
  ];

  for (const alias of expectedNamespaceAliases) {
    assert.ok(editor.includes(alias), `namespace alias should remain after #2123: ${alias}`);
  }

  assert.equal(expectedNamespaceAliases.length, 14, 'exactly 14 namespace-level deps aliases');
});

test('direct deps function aliases remain inventoried', () => {
  const editor = read('js/editor.js');

  const expectedDirectAliases = [
    'const getConfirmedSessionUser = deps.getConfirmedSessionUser;',
    'const readConfirmedAuthCache = deps.readConfirmedAuthCache;',
    'const showToast = deps.showToast;',
    'const i18n = deps.i18n;',
    'const getEditorBasePath = deps.getEditorBasePath;',
    'const redirectToEditorLogin = deps.redirectToEditorLogin;',
    'const safeI18nText = deps.safeI18nText;',
    'const resolveHintText = deps.resolveHintText;',
    'const resolveTreeTitleText = deps.resolveTreeTitleText;',
    'const resolveInfoText = deps.resolveInfoText;',
    'const syncCurrentTreeData = deps.syncCurrentTreeData;',
    'const resolveParentIdForCreate = deps.resolveParentIdForCreate;',
    'const getMyTreesHref = deps.getMyTreesHref;',
    'const escapeHtml = deps.escapeHtml;',
    'const resolveMemoryThumbnail = deps.resolveMemoryThumbnail;',
    'const getYouTubeInputErrorMessage = deps.getYouTubeInputErrorMessage;',
    'const renderTreeLoadError = deps.renderTreeLoadError;',
    'const buildTreeLoadErrorCopy = deps.buildTreeLoadErrorCopy;',
    'const applyEditorShellCopy = deps.applyEditorShellCopy;',
    'const createPrepareEditorShell = deps.createPrepareEditorShell;',
    'const createEditorDebugReporter = deps.createEditorDebugReporter;',
    'const findRootMemory = deps.findRootMemory;',
    'const getCanonicalRootId = deps.getCanonicalRootId;',
    'const isRootMemory = deps.isRootMemory;'
  ];

  for (const alias of expectedDirectAliases) {
    assert.ok(editor.includes(alias), `direct deps alias should remain: ${alias}`);
  }
});

test('first batch helper method aliases now use direct deps aliases', () => {
  const editor = read('js/editor.js');

  const cleanupConfirmedDirectDepsAliases = [
    'const bindEditorPageEvents = deps.bindEditorPageEvents;',
    'const runEditorInitialLoadFlow = deps.runEditorInitialLoadFlow;',
    'const createEditorRefreshSaveRuntime = deps.createEditorRefreshSaveRuntime;',
    'const createEditorStartupContext = deps.createEditorStartupContext;',
    'const createEditorDomRefs = deps.createEditorDomRefs;',
    'const markEditorReady = deps.markEditorReady;',
    'const applyEditorEditabilityState = deps.applyEditorEditabilityState;',
    'const createEditorStartupDependencyWaiter = deps.createEditorStartupDependencyWaiter;',
    'const exposeCanvasEmptyGuideUpdater = deps.exposeCanvasEmptyGuideUpdater;',
    'const exposeDetailPanelUpdater = deps.exposeDetailPanelUpdater;',
    'const resolveSaveStatusTimeFormatter = deps.resolveSaveStatusTimeFormatter;',
    'const createSelectedMomentFocusHandler = deps.createSelectedMomentFocusHandler;',
    'const createSidebarTreeActionsUpdater = deps.createSidebarTreeActionsUpdater;',
    'const createMemoryActionsReadinessWrapper = deps.createMemoryActionsReadinessWrapper;',
    'const createCurrentMomentDetailOpener = deps.createCurrentMomentDetailOpener;'
  ];

  for (const alias of cleanupConfirmedDirectDepsAliases) {
    assert.ok(editor.includes(alias), `${alias} should use direct deps alias after cleanup`);
  }
});

test('first batch namespace-derived aliases are removed', () => {
  const editor = read('js/editor.js');

  const removedNamespaceDerivedAliases = [
    'const bindEditorPageEvents = editorPageEventBindings.bindEditorPageEvents;',
    'const runEditorInitialLoadFlow = editorInitialLoadFlow.runEditorInitialLoadFlow;',
    'const createEditorRefreshSaveRuntime = editorRefreshSaveRuntime.createEditorRefreshSaveRuntime;',
    'const createEditorStartupContext = editorStartupContext.createEditorStartupContext;',
    'const createEditorDomRefs = editorDomRefsBuilder.createEditorDomRefs;',
    'const markEditorReady = shellHelpers.markEditorReady;',
    'const applyEditorEditabilityState = shellHelpers.applyEditorEditabilityState;',
    'const createEditorStartupDependencyWaiter = shellHelpers.createEditorStartupDependencyWaiter;',
    'const exposeCanvasEmptyGuideUpdater = shellHelpers.exposeCanvasEmptyGuideUpdater;',
    'const exposeDetailPanelUpdater = shellHelpers.exposeDetailPanelUpdater;',
    'const resolveSaveStatusTimeFormatter = shellHelpers.resolveSaveStatusTimeFormatter;',
    'const createSelectedMomentFocusHandler = shellHelpers.createSelectedMomentFocusHandler;',
    'const createSidebarTreeActionsUpdater = shellHelpers.createSidebarTreeActionsUpdater;',
    'const createMemoryActionsReadinessWrapper = shellHelpers.createMemoryActionsReadinessWrapper;',
    'const createCurrentMomentDetailOpener = shellHelpers.createCurrentMomentDetailOpener;',
    'const createSaveStatusOrchestrationFallback = shellHelpers.createSaveStatusOrchestrationFallback;',
    'const exposeRefreshMemoriesBridge = shellHelpers.exposeRefreshMemoriesBridge;',
    'const getHttpStatus = shellHelpers.getHttpStatus;',
    'const nextMemoryIdFromMemories = editorTreeHelpers.nextMemoryIdFromMemories;'
  ];

  for (const alias of removedNamespaceDerivedAliases) {
    assert.equal(editor.includes(alias), false, `${alias} should be removed`);
  }
});

test('remaining helper method aliases: none — all 20 helper method aliases have been cleaned up', () => {
  const editor = read('js/editor.js');

  // All 20 helper method aliases have been removed or inlined:
  //  - 5 first batch (PR #2127)
  //  - 6 second batch (PR #2129)
  //  - 4 third batch (PR #2131)
  //  - 2 fourth batch (PR #2133)
  //  - 1 http status (PR #2135)
  //  - 1 inline http status deps alias (PR #2137)
  //  - 1 memory id (PR #2139)
  //  - 1 auth start (PR #2141)

  const forbiddenLocalAliases = [
    'const bindEditorPageEvents = editorPageEventBindings.bindEditorPageEvents;',
    'const runEditorInitialLoadFlow = editorInitialLoadFlow.runEditorInitialLoadFlow;',
    'const createEditorRefreshSaveRuntime = editorRefreshSaveRuntime.createEditorRefreshSaveRuntime;',
    'const createEditorStartupContext = editorStartupContext.createEditorStartupContext;',
    'const createEditorDomRefs = editorDomRefsBuilder.createEditorDomRefs;',
    'const markEditorReady = shellHelpers.markEditorReady;',
    'const applyEditorEditabilityState = shellHelpers.applyEditorEditabilityState;',
    'const createEditorStartupDependencyWaiter = shellHelpers.createEditorStartupDependencyWaiter;',
    'const exposeCanvasEmptyGuideUpdater = shellHelpers.exposeCanvasEmptyGuideUpdater;',
    'const exposeDetailPanelUpdater = shellHelpers.exposeDetailPanelUpdater;',
    'const resolveSaveStatusTimeFormatter = shellHelpers.resolveSaveStatusTimeFormatter;',
    'const createSelectedMomentFocusHandler = shellHelpers.createSelectedMomentFocusHandler;',
    'const createSidebarTreeActionsUpdater = shellHelpers.createSidebarTreeActionsUpdater;',
    'const createMemoryActionsReadinessWrapper = shellHelpers.createMemoryActionsReadinessWrapper;',
    'const createCurrentMomentDetailOpener = shellHelpers.createCurrentMomentDetailOpener;',
    'const createSaveStatusOrchestrationFallback = shellHelpers.createSaveStatusOrchestrationFallback;',
    'const exposeRefreshMemoriesBridge = shellHelpers.exposeRefreshMemoriesBridge;',
    'const getHttpStatus = shellHelpers.getHttpStatus;',
    'const nextMemoryIdFromMemories = editorTreeHelpers.nextMemoryIdFromMemories;',
    'const registerEditorAuthStart = editorPageHelpers.registerEditorAuthStart;'
  ];

  for (const alias of forbiddenLocalAliases) {
    assert.equal(editor.includes(alias), false, `${alias} should be removed`);
  }

  // Verify direct deps usage for the last cleaned up alias
  assert.ok(editor.includes('deps.registerEditorAuthStart'), 'editor should use deps.registerEditorAuthStart directly');
});

test('resolver-owned duplicate bootstrap guards remain removed after cleanup', () => {
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
    'LoveBudEditorShellHelpers.createEditorDebugReporter missing',
    'const missingTextResolvers = [',
    'const missingMediaResolvers = [',
    'const missingRootHelpers = ['
  ];

  for (const marker of removedMarkers) {
    assert.equal(editor.includes(marker), false, `${marker} should stay removed`);
  }
});

test('editor-owned bootstrap guards remain as explicit editor entry boundaries', () => {
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
    assert.ok(editor.includes(marker), `${marker} should remain`);
  }

  assert.equal(retainedMarkers.length, 13, 'exactly 13 editor-owned bootstrap guards');
});

test('editor-owned guard boundaries remain with typeof check before startEditor', () => {
  const editor = read('js/editor.js');

  const guardedBoundaries = [
    { name: 'registerEditorAuthStart', marker: 'registerEditorAuthStart' },
    { name: 'createEditorStartDependencyGuard', marker: 'createEditorStartDependencyGuard' },
    { name: 'createEditorStartDependencyChecker', marker: 'createEditorStartDependencyChecker' },
    { name: 'createEditorRequiredGlobalWaiter', marker: 'createEditorRequiredGlobalWaiter' },
    { name: 'createEditorStartupShellApplier', marker: 'createEditorStartupShellApplier' },
    { name: 'createEditorCanvasEmptyGuideUpdater', marker: 'createEditorCanvasEmptyGuideUpdater' },
    { name: 'createEditorSelectNodeHandler', marker: 'createEditorSelectNodeHandler' },
    { name: 'createEditorSidebarStatusUpdater', marker: 'createEditorSidebarStatusUpdater' },
    { name: 'createEditorInitialMemoryProvider', marker: 'createEditorInitialMemoryProvider' },
    { name: 'createEditorNextMemoryIdProvider', marker: 'createEditorNextMemoryIdProvider' },
    { name: 'createEditorInitialSelectionApplier', marker: 'createEditorInitialSelectionApplier' },
    { name: 'createEditorReadyFinalizer', marker: 'createEditorReadyFinalizer' }
  ];

  for (const { name, marker } of guardedBoundaries) {
    const pattern = `typeof ${marker} !== 'function'`;
    if (name === 'registerEditorAuthStart') {
      assert.ok(editor.includes('typeof deps.registerEditorAuthStart !== \'function\''), `typeof deps guard should exist for ${name}`);
    } else {
      assert.ok(editor.includes(pattern), `typeof guard should exist for ${name}: ${pattern}`);
    }
  }
});

test('getYouTubeInputErrorMessageFallback remains removed', () => {
  const editor = read('js/editor.js');
  assert.ok(!editor.includes('getYouTubeInputErrorMessageFallback'));
});

test('editor entry bootstrap structure is intact', () => {
  const editor = read('js/editor.js');

  // The core bootstrap flow must still be present
  assert.ok(editor.includes("entryDependenciesResult.status === 'stopped'"));
  assert.ok(editor.includes('const deps = entryDependenciesResult.deps;'));
  assert.ok(editor.includes('const startEditor = async () => {'));
  assert.ok(editor.includes('reportEditorBootstrapMissingDependency'));

  // Resolver-owned guards should not be in editor.js anymore
  assert.ok(!editor.includes('const createInlineShowToastFallback'));
  assert.ok(!editor.includes('const getI18n'));
  assert.ok(!editor.includes('const missingTextResolvers'));
});
