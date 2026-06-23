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
  ];

  assert.equal(expectedNamespaceAliases.length, 0, 'no namespace deps aliases should remain');
});

test('direct deps function aliases remain inventoried', () => {
  const editor = read('js/editor.js');

  const expectedDirectAliases = [
  ];

  for (const alias of expectedDirectAliases) {
    assert.ok(editor.includes(alias), `direct deps alias should remain: ${alias}`);
  }

  assert.equal(expectedDirectAliases.length, 0, 'no direct deps function aliases should remain');
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

test('remaining helper method aliases: none — all 21 helper method aliases have been cleaned up', () => {
  const editor = read('js/editor.js');

  // All 21 helper method aliases have been removed or inlined:
  //  - 5 first batch (PR #2127)
  //  - 6 second batch (PR #2129)
  //  - 4 third batch (PR #2131)
  //  - 2 fourth batch (PR #2133)
  //  - 1 http status (PR #2135)
  //  - 1 inline http status deps alias (PR #2137)
  //  - 1 memory id (PR #2139)
  //  - 1 auth start (PR #2141)
  //  - 1 moment list (PR #2803)

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
    'const createMomentListBinding = shellHelpers.createMomentListBinding;',
    'const registerEditorAuthStart = editorPageHelpers.registerEditorAuthStart;',
    'const escapeHtml = deps.escapeHtml;',
    'const findRootMemory = deps.findRootMemory;',
    'const getCanonicalRootId = deps.getCanonicalRootId;',
    'const isRootMemory = deps.isRootMemory;',
    'const getConfirmedSessionUser = deps.getConfirmedSessionUser;',
    'const readConfirmedAuthCache = deps.readConfirmedAuthCache;',
    'const renderTreeLoadError = deps.renderTreeLoadError;',
    'const buildTreeLoadErrorCopy = deps.buildTreeLoadErrorCopy;',
    'const applyEditorShellCopy = deps.applyEditorShellCopy;',
    'const createPrepareEditorShell = deps.createPrepareEditorShell;',
    'const resolveHintText = deps.resolveHintText;',
    'const resolveTreeTitleText = deps.resolveTreeTitleText;',
    'const resolveInfoText = deps.resolveInfoText;',
    'const syncCurrentTreeData = deps.syncCurrentTreeData;',
    'const resolveParentIdForCreate = deps.resolveParentIdForCreate;',
    'const resolveMemoryThumbnail = deps.resolveMemoryThumbnail;',
    'const getMyTreesHref = deps.getMyTreesHref;',
    'const getYouTubeInputErrorMessage = deps.getYouTubeInputErrorMessage;',
    'const createEditorDebugReporter = deps.createEditorDebugReporter;',
    'const getEditorBasePath = deps.getEditorBasePath;',
    'const redirectToEditorLogin = deps.redirectToEditorLogin;',
    'const showToast = deps.showToast;',
    'const safeI18nText = deps.safeI18nText;',
    'const i18n = deps.i18n;',
    'const editorHelpers = deps.editorHelpers;',
    'const editorPageEventBindings = deps.editorPageEventBindings;',
    'const editorInitialLoadFlow = deps.editorInitialLoadFlow;',
    'const editorRefreshSaveRuntime = deps.editorRefreshSaveRuntime;',
    'const editorStartupContext = deps.editorStartupContext;',
    'const editorShellCopyApplier = deps.editorShellCopyApplier;',
    'const editorDomRefsBuilder = deps.editorDomRefsBuilder;',
    'const editorPageHelpers = deps.editorPageHelpers;',
    'const editorSelectionUI = deps.editorSelectionUI;',
    'const editorBindings = deps.editorBindings;',
    'const editorSaveStatus = deps.editorSaveStatus;',
    'const editorDataLoader = deps.editorDataLoader;',
    'const editorTreeHelpers = deps.editorTreeHelpers;',
    'const shellHelpers = deps.shellHelpers;'
  ];

  for (const alias of forbiddenLocalAliases) {
    assert.equal(editor.includes(alias), false, `${alias} should be removed`);
  }

  // Verify direct deps usage for the last cleaned up alias
  assert.ok(editor.includes('deps.registerEditorAuthStart'), 'editor should use deps.registerEditorAuthStart directly');
  assert.ok(editor.includes('deps.getConfirmedSessionUser'), 'editor should use deps.getConfirmedSessionUser directly');
  assert.ok(editor.includes('deps.readConfirmedAuthCache'), 'editor should use deps.readConfirmedAuthCache directly');
  assert.ok(editor.includes('deps.renderTreeLoadError'), 'editor should use deps.renderTreeLoadError directly');
  assert.ok(editor.includes('deps.buildTreeLoadErrorCopy'), 'editor should use deps.buildTreeLoadErrorCopy directly');
  assert.ok(editor.includes('deps.applyEditorShellCopy'), 'editor should use deps.applyEditorShellCopy directly');
  assert.ok(editor.includes('deps.createPrepareEditorShell'), 'editor should use deps.createPrepareEditorShell directly');
  assert.ok(editor.includes('deps.resolveHintText'), 'editor should use deps.resolveHintText directly');
  assert.ok(editor.includes('deps.resolveTreeTitleText'), 'editor should use deps.resolveTreeTitleText directly');
  assert.ok(editor.includes('deps.resolveInfoText'), 'editor should use deps.resolveInfoText directly');
  assert.ok(editor.includes('deps.syncCurrentTreeData'), 'editor should use deps.syncCurrentTreeData directly');
  assert.ok(editor.includes('deps.resolveParentIdForCreate'), 'editor should use deps.resolveParentIdForCreate directly');
  assert.ok(editor.includes('deps.resolveMemoryThumbnail'), 'editor should use deps.resolveMemoryThumbnail directly');
  assert.ok(editor.includes('deps.getMyTreesHref'), 'editor should use deps.getMyTreesHref directly');
  assert.ok(editor.includes('deps.getYouTubeInputErrorMessage'), 'editor should use deps.getYouTubeInputErrorMessage directly');
  assert.ok(editor.includes('deps.createEditorDebugReporter'), 'editor should use deps.createEditorDebugReporter directly');
  assert.ok(editor.includes('deps.getEditorBasePath'), 'editor should use deps.getEditorBasePath directly');
  assert.ok(editor.includes('deps.redirectToEditorLogin'), 'editor should use deps.redirectToEditorLogin directly');
  assert.ok(editor.includes('deps.showToast'), 'editor should use deps.showToast directly');
  assert.ok(editor.includes('deps.safeI18nText'), 'editor should use deps.safeI18nText directly');
  assert.ok(editor.includes('deps.i18n'), 'editor should use deps.i18n directly');
  assert.ok(editor.includes('deps.editorPageHelpers'), 'editor should use deps.editorPageHelpers directly');
  assert.ok(editor.includes('deps.editorSelectionUI'), 'editor should use deps.editorSelectionUI directly');
  assert.ok(editor.includes('deps.editorBindings'), 'editor should use deps.editorBindings directly');
  assert.ok(editor.includes('deps.editorSaveStatus'), 'editor should use deps.editorSaveStatus directly');
  assert.ok(editor.includes('deps.editorDataLoader'), 'editor should use deps.editorDataLoader directly');
  assert.ok(editor.includes('deps.editorTreeHelpers'), 'editor should use deps.editorTreeHelpers directly');
  assert.ok(editor.includes('deps.shellHelpers.createMomentListBinding'), 'editor should use deps.shellHelpers.createMomentListBinding directly');

  // Verify call site context for tree load error helpers
  assert.match(editor, /buildTreeLoadErrorCopy:\s*deps\.buildTreeLoadErrorCopy/);
  assert.match(editor, /renderTreeLoadError:\s*deps\.renderTreeLoadError/);

  // Verify call site context for shell preparation helpers
  assert.match(editor, /deps\.applyEditorShellCopy\(deps\.safeI18nText,\s*deps\.i18n\);/);
  assert.match(editor, /deps\.createPrepareEditorShell\(\{/);
  assert.match(editor, /applyEditorShellCopy:\s*deps\.applyEditorShellCopy/);

  // Verify call site context for text resolver helpers
  assert.match(editor, /createEditorDetailUI\(\{[\s\S]*resolveTreeTitleText:\s*deps\.resolveTreeTitleText/);
  assert.match(editor, /createEditorDetailUI\(\{[\s\S]*resolveHintText:\s*deps\.resolveHintText/);
  assert.match(editor, /createEditorDetailUI\(\{[\s\S]*resolveInfoText:\s*deps\.resolveInfoText/);

  // Verify call site context for page helpers
  assert.match(editor, /editorPageHelpers:\s*deps\.editorPageHelpers/);

  // Verify call site context for selection UI
  assert.match(editor, /editorSelectionUI:\s*deps\.editorSelectionUI/);

  // Verify call site context for bindings
  assert.match(editor, /editorBindings:\s*deps\.editorBindings/);

  // Verify call site context for save status (2 call sites)
  assert.match(editor, /editorSaveStatus:\s*deps\.editorSaveStatus/);
  assert.equal(
    (editor.match(/editorSaveStatus:\s*deps\.editorSaveStatus/g) || []).length,
    2,
    'editor should pass deps.editorSaveStatus directly at both save status call sites'
  );

  // Verify call site context for data loader (2 call sites)
  assert.match(editor, /editorDataLoader:\s*deps\.editorDataLoader/);
  assert.equal(
    (editor.match(/editorDataLoader:\s*deps\.editorDataLoader/g) || []).length,
    2,
    'editor should pass deps.editorDataLoader directly at both data loader call sites'
  );

  // Verify call site context for tree helpers (4 direct usages)
  assert.match(editor, /deps\.editorTreeHelpers\.createInitialMemory/);
  assert.match(editor, /editorTreeHelpers:\s*deps\.editorTreeHelpers/);
  assert.match(editor, /deps\.editorTreeHelpers\.createTreeVisibilityUpdater/);
  assert.match(editor, /applyUpdatedTreeVisibility:\s*deps\.editorTreeHelpers\.applyUpdatedTreeVisibility/);
  assert.equal(
    (editor.match(/deps\.editorTreeHelpers/g) || []).length,
    4,
    'editor should use deps.editorTreeHelpers directly at all tree helper call sites'
  );

  // Verify call site context for tree helpers
  assert.match(editor, /runEditorInitialLoadFlow\(\{[\s\S]*syncCurrentTreeData:\s*deps\.syncCurrentTreeData/);
  assert.match(editor, /resolveParentIdForCreate:\s*deps\.resolveParentIdForCreate/);

  // Verify shellHelpers is gone and deps.shellHelpers used directly
  assert.doesNotMatch(editor, /const\s+shellHelpers\s*=\s*deps\.shellHelpers;/);
  assert.doesNotMatch(editor, /(?<![A-Za-z0-9_$])(?<!\.)shellHelpers\.[A-Za-z0-9_$]+/);
  assert.ok(editor.includes('deps.shellHelpers'), 'editor should use deps.shellHelpers directly');
  assert.equal(
    (editor.match(/deps\.shellHelpers\.[A-Za-z0-9_$]+/g) || []).length,
    12,
    'editor should read all 12 shell helper methods from deps.shellHelpers directly'
  );

  // Verify call site context for memory thumbnail resolver
  assert.match(editor, /createEditorDetailUI\(\{[\s\S]*resolveMemoryThumbnail:\s*deps\.resolveMemoryThumbnail/);
  assert.match(editor, /createEditorCanvas\(\{[\s\S]*resolveMemoryThumbnail:\s*deps\.resolveMemoryThumbnail/);

  // Verify call site context for my-trees href resolver
  assert.match(editor, /deps\.createPrepareEditorShell\(\{[\s\S]*safeI18nText:\s*deps\.safeI18nText/);
  assert.match(editor, /deps\.createPrepareEditorShell\(\{[\s\S]*getMyTreesHref:\s*deps\.getMyTreesHref/);

  // Verify call site context for YouTube input error resolver
  assert.match(editor, /getYouTubeInputErrorMessage:\s*\(rawUrl\)\s*=>\s*deps\.getYouTubeInputErrorMessage\(deps\.i18n,\s*rawUrl\)/);

  // Verify call site context for debug reporter
  assert.match(editor, /const\s*\{\s*log,\s*reportError\s*\}\s*=\s*deps\.createEditorDebugReporter\(\);/);

  // Verify call site context for base path
  assert.match(editor, /createCurrentMomentDetailOpener\(\{[\s\S]*getEditorBasePath:\s*deps\.getEditorBasePath/);

  // Verify call site context for login redirect
  assert.match(editor, /deps\.registerEditorAuthStart\(\{[\s\S]*redirectToEditorLogin:\s*deps\.redirectToEditorLogin/);

  // Verify call site context for showToast DI
  assert.match(editor, /runEditorInitialLoadFlow\(\{[\s\S]*showToast:\s*deps\.showToast/);
  assert.match(editor, /createEditorDetailUI\(\{[\s\S]*showToast:\s*deps\.showToast/);
  assert.match(editor, /createEditorMemoryActions\(\{[\s\S]*showToast:\s*deps\.showToast/);
  assert.match(editor, /createEditorMemoryForm\(\{[\s\S]*showToast:\s*deps\.showToast/);
  assert.match(editor, /bindEditorPageEvents\(\{[\s\S]*showToast:\s*deps\.showToast/);

  // Verify call site context for safeI18nText DI
  assert.match(editor, /deps\.applyEditorShellCopy\(deps\.safeI18nText,\s*deps\.i18n\);/);
  assert.match(editor, /deps\.createPrepareEditorShell\(\{[\s\S]*safeI18nText:\s*deps\.safeI18nText/);
  assert.match(editor, /createDefaultTreeTitle:\s*\(\)\s*=>\s*deps\.safeI18nText\(deps\.i18n,\s*'default_tree_title',\s*'러브트리'\)/);
  assert.match(editor, /createSidebarTreeActionsUpdater\(\{[\s\S]*safeI18nText:\s*deps\.safeI18nText/);
  assert.match(editor, /bindEditorPageEvents\(\{[\s\S]*safeI18nText:\s*deps\.safeI18nText/);
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