const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function scriptSources() {
  return Array.from(read('pages/editor.html').matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g))
    .map((match) => match[1]);
}

function sourceIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

function loadEntryDependencies() {
  const context = { window: {}, console: { error() {} }, Object };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-entry-dependencies.js'), context);
  return context.window.LoveBudEditorEntryDependencies.resolveEditorEntryDependencies;
}

function createReadyWindow() {
  const noop = function() {};
  return {
    LoveBudEditorDataLoaderFallbacks: {},
    LoveBudEditorEntryFallbacks: {},
    LoveBudEditorShellHelpers: {
      createInlineShowToastFallback: () => noop,
      getI18n: () => ((key) => key),
      getEditorBasePath: noop,
      getYouTubeInputErrorMessageFallback: noop,
      applyEditorShellCopy: noop,
      createEditorDebugReporter: noop,
      getHttpStatus: noop,
      markEditorReady: noop,
      applyEditorEditabilityState: noop,
      createEditorStartupDependencyWaiter: noop,
      exposeCanvasEmptyGuideUpdater: noop,
      exposeDetailPanelUpdater: noop,
      createSelectedMomentFocusHandler: noop,
      createSidebarTreeActionsUpdater: noop,
      createMemoryActionsReadinessWrapper: noop,
      createCurrentMomentDetailOpener: noop,
      createSaveStatusOrchestrationFallback: noop,
      exposeRefreshMemoriesBridge: noop,
      resolveSaveStatusTimeFormatter: noop,
    },
    LoveBudEditorUtils: {
      findRootMemory: noop,
      getCanonicalRootId: noop,
      isRootMemory: noop,
    },
    LoveBudEditorHelpers: {
      safeI18nText: noop,
      resolveHintText: noop,
      resolveTreeTitleText: noop,
      resolveInfoText: noop,
      escapeHtml: noop,
      safeUrl: noop,
      resolveMemoryThumbnail: noop,
    },
    LoveBudEditorSaveStatus: {},
    LoveBudEditorPageHelpers: {
      redirectToEditorLogin: noop,
      getMyTreesHref: noop,
      renderTreeLoadError: noop,
      buildTreeLoadErrorCopy: noop,
      registerEditorAuthStart: noop,
    },
    LoveBudEditorTreeHelpers: {
      syncCurrentTreeData: noop,
      resolveParentIdForCreate: noop,
      nextMemoryIdFromMemories: noop,
    },
    LoveBudEditorSelectionUI: {},
    LoveBudEditorBindings: {},
    LoveBudEditorPageEventBindings: { bindEditorPageEvents: noop },
    LoveBudEditorDataLoader: {},
    LoveBudEditorInitialLoadFlow: { runEditorInitialLoadFlow: noop },
    LoveBudEditorRefreshSaveRuntime: { createEditorRefreshSaveRuntime: noop },
    LoveBudEditorStartupContext: { createEditorStartupContext: noop },
    LoveBudEditorAuthHelpers: {
      readConfirmedAuthCache: () => ({ uid: 'u1' }),
      hasConfirmedSessionUser: () => true,
    },
    LoveBudEditorShellCopyApplier: { createPrepareEditorShell: noop },
    LoveBudEditorDomRefsBuilder: { createEditorDomRefs: noop },
  };
}

test('editor entry dependencies helper loads before editor entry', () => {
  const sources = scriptSources();
  const dependencyHelper = sourceIndex(sources, 'js/editor/editor-entry-dependencies.js');
  const editorEntry = sourceIndex(sources, 'js/editor.js');

  assert.notEqual(dependencyHelper, -1, 'editor-entry-dependencies.js must be loaded');
  assert.notEqual(editorEntry, -1, 'editor.js must be loaded');
  assert.ok(dependencyHelper < editorEntry, 'entry dependencies helper must load before editor.js');
});

test('editor entry dependencies helper exports resolveEditorEntryDependencies', () => {
  const context = { window: {}, console: { error() {} }, Object };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-entry-dependencies.js'), context);

  assert.equal(
    typeof context.window.LoveBudEditorEntryDependencies.resolveEditorEntryDependencies,
    'function'
  );
  assert.equal(Object.isFrozen(context.window.LoveBudEditorEntryDependencies), true);
});

test('editor entry delegates dependency resolution to helper', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /window\.LoveBudEditorEntryDependencies/);
  assert.match(editor, /resolveEditorEntryDependencies\s*=\s*entryDependencies\.resolveEditorEntryDependencies/);
  assert.match(editor, /LoveBudEditorEntryDependencies\.resolveEditorEntryDependencies missing/);
  assert.match(editor, /resolveEditorEntryDependencies\(\{\s*windowRef:\s*window,\s*URLSearchParamsRef:\s*URLSearchParams\s*\}\)/);
  assert.match(editor, /entryDependenciesResult\.status\s*===\s*'stopped'/);
  assert.match(editor, /const\s+deps\s*=\s*entryDependenciesResult\.deps/);
  assert.match(editor, /deps\.createEditorDebugReporter/);
  assert.doesNotMatch(editor, /const\s+createEditorDebugReporter\s*=\s*deps\.createEditorDebugReporter/);
  // findRootMemory now used inline
  assert.match(editor, /deps\.findRootMemory/);
  assert.match(editor, /deps\.getCanonicalRootId/);
  assert.match(editor, /deps\.isRootMemory/);
  assert.match(editor, /const\s+\{\s*log,\s*reportError\s*\}\s*=\s*deps\.createEditorDebugReporter\(\)/);
  assert.match(editor, /prepareEditorShell,\s*applyEditorEditabilityState,\s*canEdit,\s*log/s);
  assert.match(editor, /applyEditorStartupShell\(\);/);

  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorPageHelpers\.registerEditorAuthStart missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorStartDependencyGuard missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorInitialMemoryProvider missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorReadyFinalizer missing'\)/);
  assert.doesNotMatch(editor, /const\s+missingTextResolvers\s*=\s*\[/);
  assert.doesNotMatch(editor, /const\s+missingRootHelpers\s*=\s*\[/);
  assert.match(editor, /createEditorStartDependencyChecker\s*=\s*deps\.shellHelpers\.createEditorStartDependencyChecker/);
});

test('entry dependencies helper preserves bootstrap missing-helper messages', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  const messages = [
    'LoveBudEditorUtils.findRootMemory',
    'LoveBudEditorHelpers.safeI18nText',
    'LoveBudEditorHelpers.escapeHtml',
    'LoveBudEditorPageHelpers.renderTreeLoadError',
    'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy',
    'LoveBudEditorPageHelpers.registerEditorAuthStart',
    'LoveBudEditorShellHelpers.applyEditorShellCopy',
    'LoveBudEditorShellCopyApplier.createPrepareEditorShell',
    'LoveBudEditorShellHelpers.createEditorDebugReporter'
  ];

  for (const message of messages) {
    assert.match(helper, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(helper, /console\.error\('\[editor-main\] ERROR: ' \+ message\)/);
  assert.match(helper, /debugState\.errors\.push\(\{ msg: message, error: message \}\)/);
});

test('entry dependencies helper preserves shell copy side effect before prepare shell return', () => {
  const editor = read('js/editor.js');
  const applyIndex = editor.indexOf('deps.applyEditorShellCopy(deps.safeI18nText, deps.i18n);');
  const prepareIndex = editor.indexOf('const prepareEditorShell = deps.createPrepareEditorShell');

  assert.notEqual(applyIndex, -1, 'applyEditorShellCopy side effect must remain');
  assert.notEqual(prepareIndex, -1, 'prepareEditorShell creation must remain');
  assert.ok(applyIndex < prepareIndex, 'shell copy must apply before prepareEditorShell is returned');
});

test('entry dependency resolver exposes auth start helper required by editor entry', () => {
  const resolveEditorEntryDependencies = loadEntryDependencies();
  const windowRef = createReadyWindow();
  const result = resolveEditorEntryDependencies({ windowRef });

  assert.equal(result.status, 'ready');
  assert.equal(
    result.deps.registerEditorAuthStart,
    windowRef.LoveBudEditorPageHelpers.registerEditorAuthStart,
    'resolver must pass through LoveBudEditorPageHelpers.registerEditorAuthStart'
  );
});

test('entry dependency resolver stops with auth start helper message when missing', () => {
  const resolveEditorEntryDependencies = loadEntryDependencies();
  const windowRef = createReadyWindow();
  delete windowRef.LoveBudEditorPageHelpers.registerEditorAuthStart;

  const result = resolveEditorEntryDependencies({ windowRef });

  assert.equal(result.status, 'stopped');
  assert.deepEqual(windowRef.LoveBudEditorDebug.errors, [
    {
      msg: 'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
      error: 'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
    },
  ]);
});
