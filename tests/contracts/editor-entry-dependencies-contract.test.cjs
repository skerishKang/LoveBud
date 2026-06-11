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

function noop() {}

function buildReadyWindowRef(overrides = {}) {
  const registerEditorAuthStart = overrides.registerEditorAuthStart || noop;

  return {
    LoveBudEditorDataLoaderFallbacks: {},
    LoveBudEditorEntryFallbacks: {},
    LoveBudEditorShellHelpers: {
      createInlineShowToastFallback: () => noop,
      getI18n: () => ((key) => key),
      getEditorBasePath: () => 'pages/',
      getYouTubeInputErrorMessageFallback: () => 'invalid',
      applyEditorShellCopy: noop,
      createEditorDebugReporter: () => ({ log: noop, reportError: noop }),
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
      markEditorReady: noop,
      applyEditorEditabilityState: noop,
      getHttpStatus: noop,
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
      registerEditorAuthStart,
      getMyTreesHref: noop,
      renderTreeLoadError: noop,
      buildTreeLoadErrorCopy: noop,
    },
    LoveBudEditorTreeHelpers: {
      syncCurrentTreeData: noop,
      resolveParentIdForCreate: noop,
      nextMemoryIdFromMemories: noop,
    },
    LoveBudEditorSelectionUI: {},
    LoveBudEditorBindings: {},
    LoveBudEditorPageEventBindings: {
      bindEditorPageEvents: noop,
    },
    LoveBudEditorDataLoader: {},
    LoveBudEditorInitialLoadFlow: {
      runEditorInitialLoadFlow: noop,
    },
    LoveBudEditorRefreshSaveRuntime: {
      createEditorRefreshSaveRuntime: noop,
    },
    LoveBudEditorStartupContext: {
      createEditorStartupContext: noop,
    },
    LoveBudEditorAuthHelpers: {
      readConfirmedAuthCache: () => null,
      hasConfirmedSessionUser: () => false,
    },
    LoveBudEditorShellCopyApplier: {
      createPrepareEditorShell: noop,
    },
    LoveBudEditorDomRefsBuilder: {
      createEditorDomRefs: noop,
    },
  };
}

function loadResolver() {
  const context = { window: {}, console: { error() {} }, Object };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-entry-dependencies.js'), context);
  return context.window.LoveBudEditorEntryDependencies.resolveEditorEntryDependencies;
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

test('entry dependencies resolver exposes registerEditorAuthStart expected by editor entry', () => {
  const registerEditorAuthStart = noop;
  const resolveEditorEntryDependencies = loadResolver();
  const result = resolveEditorEntryDependencies({
    windowRef: buildReadyWindowRef({ registerEditorAuthStart }),
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.deps.registerEditorAuthStart, registerEditorAuthStart);
});

test('entry dependencies resolver stops when registerEditorAuthStart is missing', () => {
  const errors = [];
  const resolveEditorEntryDependencies = loadResolver();
  const windowRef = buildReadyWindowRef({ registerEditorAuthStart: undefined });
  delete windowRef.LoveBudEditorPageHelpers.registerEditorAuthStart;
  windowRef.LoveBudEditorDebug = { logs: [], errors };

  const result = resolveEditorEntryDependencies({ windowRef });

  assert.equal(result.status, 'stopped');
  assert.deepEqual(errors, [{
    msg: 'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
    error: 'LoveBudEditorPageHelpers.registerEditorAuthStart missing',
  }]);
});

test('entry dependencies helper preserves bootstrap missing-helper messages', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  const messages = [
    'LoveBudEditorUtils.findRootMemory',
    'LoveBudEditorHelpers.safeI18nText',
    'LoveBudEditorHelpers.escapeHtml',
    'LoveBudEditorPageHelpers.registerEditorAuthStart',
    'LoveBudEditorPageHelpers.renderTreeLoadError',
    'LoveBudEditorPageHelpers.buildTreeLoadErrorCopy',
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
