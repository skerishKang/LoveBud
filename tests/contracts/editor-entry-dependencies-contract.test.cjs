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
  assert.match(editor, /prepareEditorShell,\s*applyEditorEditabilityState,\s*canEdit:\s*false,\s*log/s);
  assert.match(editor, /applyEditorStartupShell\(\);/);

  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorPageHelpers\.registerEditorAuthStart missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorStartDependencyGuard missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorInitialMemoryProvider missing'\)/);
  assert.match(editor, /reportEditorBootstrapMissingDependency\('LoveBudEditorShellHelpers\.createEditorReadyFinalizer missing'\)/);
  assert.doesNotMatch(editor, /const\s+missingTextResolvers\s*=\s*\[/);
  assert.doesNotMatch(editor, /const\s+missingRootHelpers\s*=\s*\[/);
  assert.match(editor, /createEditorStartDependencyChecker\s*=\s*deps\.shellHelpers\.createEditorStartDependencyChecker/);
});

test('entry dependencies helper wires registerEditorAuthStart required by editor entry', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  assert.match(helper, /const\s+registerEditorAuthStart\s*=\s*editorPageHelpers\.registerEditorAuthStart/);
  assert.match(helper, /typeof\s+registerEditorAuthStart\s*!==\s*'function'\)\s*return\s+stopMissing\(windowRef,\s*'LoveBudEditorPageHelpers\.registerEditorAuthStart'\)/);
  assert.match(helper, /redirectToEditorLogin,\s*\n\s*registerEditorAuthStart,\s*\n\s*safeI18nText/);
});

test('entry dependencies helper wires getMyTreesHref required by prepare editor shell', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');
  const editor = read('js/editor.js');

  assert.match(editor, /getMyTreesHref:\s*deps\.getMyTreesHref/);
  assert.match(helper, /const\s+getMyTreesHref\s*=\s*editorPageHelpers\.getMyTreesHref/);
  assert.match(helper, /typeof\s+getMyTreesHref\s*!==\s*'function'\)\s*return\s+stopMissing\(windowRef,\s*'LoveBudEditorPageHelpers\.getMyTreesHref'\)/);
  assert.match(helper, /getEditorBasePath,\s*\n\s*getMyTreesHref,\s*\n\s*redirectToEditorLogin/);
});

test('entry dependencies helper preserves bootstrap missing-helper messages', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  const messages = [
    'LoveBudEditorUtils.findRootMemory',
    'LoveBudEditorHelpers.safeI18nText',
    'LoveBudEditorHelpers.escapeHtml',
    'LoveBudEditorPageHelpers.getMyTreesHref',
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

test('startEditor declares lazy let stubs for detail updaters before wiring selectNode', () => {
  const editor = read('js/editor.js');
  const lazyStubsIndex = editor.indexOf('let setDetailEmptyState = () => {};');
  const selectNodeIndex = editor.indexOf('const selectNode = createEditorSelectNodeHandler(');

  assert.notEqual(lazyStubsIndex, -1, 'lazy let stubs for setDetailEmptyState must be declared');
  assert.match(editor, /let\s+setDetailEmptyState\s*=\s*\(\)\s*=>\s*\{\};/);
  assert.match(editor, /let\s+updateFocusSelectedBtn\s*=\s*\(\)\s*=>\s*\{\};/);
  assert.match(editor, /let\s+updateDetailPanel\s*=\s*\(\)\s*=>\s*\{\};/);
  assert.match(editor, /let\s+updateSidebarStatus\s*=\s*\(\)\s*=>\s*\{\};/);
  assert.ok(
    lazyStubsIndex < selectNodeIndex,
    'lazy let stubs must be declared before createEditorSelectNodeHandler is invoked'
  );
});

test('startEditor wraps detail updaters through lazy callXxx functions', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /const\s+callSetDetailEmptyState\s*=\s*\(\.\.\.args\)\s*=>\s*setDetailEmptyState\(\.\.\.args\);/);
  assert.match(editor, /const\s+callUpdateFocusSelectedBtn\s*=\s*\(\.\.\.args\)\s*=>\s*updateFocusSelectedBtn\(\.\.\.args\);/);
  assert.match(editor, /const\s+callUpdateDetailPanel\s*=\s*\(\.\.\.args\)\s*=>\s*updateDetailPanel\(\.\.\.args\);/);
  assert.match(editor, /const\s+callUpdateSidebarStatus\s*=\s*\(\.\.\.args\)\s*=>\s*updateSidebarStatus\(\.\.\.args\);/);
});

test('createEditorSelectNodeHandler receives callXxx wrappers, not direct let bindings', () => {
  const editor = read('js/editor.js');
  const callIndex = editor.indexOf('const selectNode = createEditorSelectNodeHandler(');
  const endIndex = editor.indexOf('});', callIndex);
  const selectNodeCall = editor.slice(callIndex, endIndex);

  assert.notEqual(callIndex, -1, 'createEditorSelectNodeHandler call must exist');
  assert.match(selectNodeCall, /updateDetailPanel:\s*callUpdateDetailPanel/);
  assert.match(selectNodeCall, /updateFocusSelectedBtn:\s*callUpdateFocusSelectedBtn/);
  assert.match(selectNodeCall, /setDetailEmptyState:\s*callSetDetailEmptyState/);
  // Bare shorthand references are forbidden inside the selectNode call.
  assert.doesNotMatch(selectNodeCall, /^\s*updateDetailPanel\s*,/m);
  assert.doesNotMatch(selectNodeCall, /^\s*updateFocusSelectedBtn\s*,/m);
  assert.doesNotMatch(selectNodeCall, /^\s*setDetailEmptyState\s*,/m);
});

test('createTreeVisibilityUpdater receives callXxx wrappers, not direct let bindings', () => {
  const editor = read('js/editor.js');
  const callIndex = editor.indexOf('deps.editorTreeHelpers.createTreeVisibilityUpdater(');
  const endIndex = editor.indexOf('});', callIndex);
  const updaterCall = editor.slice(callIndex, endIndex);

  assert.notEqual(callIndex, -1, 'createTreeVisibilityUpdater call must exist');
  assert.match(updaterCall, /updateSidebarStatus:\s*callUpdateSidebarStatus/);
  assert.match(updaterCall, /updateDetailPanel:\s*callUpdateDetailPanel/);
  assert.doesNotMatch(updaterCall, /^\s*updateSidebarStatus\s*,/m);
  assert.doesNotMatch(updaterCall, /^\s*updateDetailPanel\s*,/m);
});

test('detailUI wiring assigns to existing let stubs instead of redeclaring consts', () => {
  const editor = read('js/editor.js');

  // The destructuring that previously declared the four consts must be gone.
  assert.doesNotMatch(
    editor,
    /const\s*\{\s*setDetailEmptyState,\s*updateFocusSelectedBtn,\s*updateSidebarStatus:\s*updateSidebarStatusBase,\s*updateDetailPanel\s*\}\s*=\s*detailUI;/
  );
  assert.match(editor, /setDetailEmptyState\s*=\s*detailUI\.setDetailEmptyState;/);
  assert.match(editor, /updateFocusSelectedBtn\s*=\s*detailUI\.updateFocusSelectedBtn;/);
  assert.match(editor, /updateDetailPanel\s*=\s*detailUI\.updateDetailPanel;/);
  assert.match(editor, /const\s+updateSidebarStatusBase\s*=\s*detailUI\.updateSidebarStatus;/);
});

test('updateSidebarStatus is assigned to the let stub from createEditorSidebarStatusUpdater', () => {
  const editor = read('js/editor.js');

  // The `const updateSidebarStatus = createEditorSidebarStatusUpdater(...)` form is forbidden
  // because it would re-declare the lazy stub.
  assert.doesNotMatch(
    editor,
    /const\s+updateSidebarStatus\s*=\s*createEditorSidebarStatusUpdater\(\{/
  );
  assert.match(
    editor,
    /updateSidebarStatus\s*=\s*createEditorSidebarStatusUpdater\(\{[\s\S]*?updateSidebarStatusBase,[\s\S]*?updateCanvasEmptyGuide,[\s\S]*?updateSidebarTreeActions[\s\S]*?\}\);/
  );
});

test('lazy let stubs are declared strictly before detailUI wiring', () => {
  const editor = read('js/editor.js');
  const stubsIndex = editor.indexOf('let setDetailEmptyState = () => {};');
  const detailUiIndex = editor.indexOf('window.createEditorDetailUI(');
  const assignIndex = editor.indexOf('setDetailEmptyState = detailUI.setDetailEmptyState;');
  const sidebarIndex = editor.indexOf('updateSidebarStatus = createEditorSidebarStatusUpdater(');

  assert.ok(stubsIndex < detailUiIndex, 'lazy stubs must be declared before createEditorDetailUI is called');
  assert.ok(stubsIndex < assignIndex, 'lazy stubs must be declared before detailUI wiring assignments');
  assert.ok(assignIndex < sidebarIndex, 'detailUI wiring must finish before updateSidebarStatus is reassigned');
});

test('editor page cache-busts editor.js for the lazy wrapper fix', () => {
  const editorPage = read('pages/editor.html');

  // PR #2448: editor.js cache-bust 갱신
  assert.match(editorPage, /\.\.\/js\/editor\.js\?v=202606(13-2448|25-2874-auth-hotfix-1)/);
  assert.doesNotMatch(editorPage, /\.\.\/js\/editor\.js\?v=20260502-1/);
});
