const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const shellUtilsSource = fs.readFileSync('js/editor/editor-shell-utils.js', 'utf8');
const shellGuardsSource = fs.readFileSync('js/editor/editor-shell-guards.js', 'utf8');
const shellStartupSource = fs.readFileSync('js/editor/editor-shell-startup.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const combinedShellSource = shellUtilsSource + '\n' + shellGuardsSource + '\n' + shellStartupSource + '\n' + shellHelpersSource;
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function loadShellHelpers(overrides = {}) {
  const classListCalls = [];
  const consoleCalls = {
    log: [],
    warn: [],
    error: []
  };

  const context = {
    window: {},
    document: {
      body: {
        classList: {
          remove: (...args) => classListCalls.push(['remove', ...args]),
          toggle: (...args) => classListCalls.push(['toggle', ...args])
        }
      }
    },
    console: {
      log: (...args) => consoleCalls.log.push(args),
      warn: (...args) => consoleCalls.warn.push(args),
      error: (...args) => consoleCalls.error.push(args)
    },
    setTimeout: (fn) => fn()
  };

  Object.assign(context, overrides);
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellUtilsSource, context);
  vm.runInContext(shellGuardsSource, context);
  vm.runInContext(shellStartupSource, context);
  vm.runInContext(shellHelpersSource, context);

  return {
    shellHelpers: context.window.LoveBudEditorShellHelpers,
    context,
    classListCalls,
    consoleCalls
  };
}

// --- 1. Sub-module export checks ---

test('editor shell startup sub-module exports markEditorReady', () => {
  assert.match(shellStartupSource, /markEditorReady:\s*function\(options\)/);
});

test('editor shell startup sub-module exports applyEditorEditabilityState', () => {
  assert.match(shellStartupSource, /applyEditorEditabilityState:\s*function\(options\)/);
});

test('editor shell utils sub-module exports createEditorDebugReporter', () => {
  assert.match(combinedShellSource, /createEditorDebugReporter:\s*function\(options\)/);
});

test('editor shell guards sub-module exports createEditorStartupDependencyWaiter', () => {
  assert.match(shellGuardsSource, /createEditorStartupDependencyWaiter:\s*function\(options\)/);
});

// --- 2. markEditorReady behavior ---

test('markEditorReady removes editor-preload class from body', () => {
  const start = shellStartupSource.indexOf('markEditorReady: function(options)');
  assert.notEqual(start, -1, 'markEditorReady must exist');

  const end = shellStartupSource.indexOf('},', start);
  const block = shellStartupSource.slice(start, end);

  assert.match(block, /body\.classList\.remove\('editor-preload'\)/);
});

// --- 3. applyEditorEditabilityState behavior ---

test('applyEditorEditabilityState sets editorNamespace.canEdit', () => {
  const start = shellStartupSource.indexOf('applyEditorEditabilityState: function(options)');
  assert.notEqual(start, -1, 'applyEditorEditabilityState must exist');

  const end = shellStartupSource.indexOf('},', start);
  const block = shellStartupSource.slice(start, end);

  assert.match(block, /editorNamespace\.canEdit\s*=\s*canEdit/);
});

test('applyEditorEditabilityState toggles editor-readonly class', () => {
  const start = shellStartupSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellStartupSource.indexOf('},', start);
  const block = shellStartupSource.slice(start, end);

  assert.match(block, /body\.classList\.toggle\('editor-readonly',\s*!canEdit\)/);
});

test('applyEditorEditabilityState defaults canEdit to true', () => {
  const start = shellStartupSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellStartupSource.indexOf('},', start);
  const block = shellStartupSource.slice(start, end);

  assert.match(block, /opts\.canEdit\s*!==\s*false/);
});

// --- 4. createEditorDebugReporter behavior (in utils sub-module) ---

test('createEditorDebugReporter logs entries to debugState.logs', () => {
  const start = shellUtilsSource.indexOf('createEditorDebugReporter: function(options)');
  assert.notEqual(start, -1, 'createEditorDebugReporter must exist');

  const end = shellUtilsSource.indexOf('},', start);
  const block = shellUtilsSource.slice(start, end);

  assert.match(block, /debugState\.logs\.push\(entry\)/);
});

test('createEditorDebugReporter records error entries to debugState.errors', () => {
  const start = shellUtilsSource.indexOf('createEditorDebugReporter: function(options)');
  const end = shellUtilsSource.indexOf('},', start);
  const block = shellUtilsSource.slice(start, end);

  assert.match(block, /debugState\.errors\.push\(/);
});

// --- 5. createEditorStartupDependencyWaiter behavior (in guards sub-module) ---

test('createEditorStartupDependencyWaiter returns true when dependency exists', () => {
  const start = shellGuardsSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  assert.notEqual(start, -1, 'createEditorStartupDependencyWaiter must exist');

  const block = shellGuardsSource.slice(start);

  assert.match(block, /return true/);
});

test('createEditorStartupDependencyWaiter calls reportError and returns false when dependency missing', () => {
  const start = shellGuardsSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  const block = shellGuardsSource.slice(start);

  assert.match(block, /reportError\(name \+ ' not found after 5s'\)/);
  assert.match(block, /return false/);
});

// --- 6. editor.js still keeps local fallbacks (test-only, not removing) ---

test('editor.js delegates markEditorReady through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+markEditorReady\s*=\s*deps\.markEditorReady/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+markEditorReady\s*=\s*deps\.markEditorReady\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.markEditorReady missing/
  );
});

test('editor.js delegates applyEditorEditabilityState through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+applyEditorEditabilityState\s*=\s*deps\.applyEditorEditabilityState/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+applyEditorEditabilityState\s*=\s*deps\.applyEditorEditabilityState\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.applyEditorEditabilityState missing/
  );
});

test('editor.js now uses createEditorDebugReporter as required deps helper without fallback', () => {
  assert.match(editorSource, /deps\.createEditorDebugReporter/);
  assert.doesNotMatch(editorSource, /const createEditorDebugReporter = deps\.createEditorDebugReporter;/);
});

test('editor.js now uses createEditorStartupDependencyWaiter as required helper without fallback', () => {
  assert.match(editorSource, /deps\.createEditorStartupDependencyWaiter;/);
  assert.doesNotMatch(editorSource, /deps\.createEditorStartupDependencyWaiter\s*\|\|/);
});

// --- 7. editor.js uses helpers in startup path ---

test('editor.js calls createEditorDebugReporter in startup path', () => {
  assert.match(editorSource, /deps\.createEditorDebugReporter\(\)/);
});

test('editor.js calls createEditorStartupDependencyWaiter with log and reportError', () => {
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
});

test('editor.js delegates applyEditorEditabilityState to startup shell applier', () => {
  assert.match(editorSource, /applyEditorEditabilityState,\s*canEdit:\s*false,\s*log/s);
  assert.match(editorSource, /applyEditorStartupShell\(\);/);
});

test('editor.js delegates markEditorReady to ready finalizer factory', () => {
  assert.match(editorSource, /markEditorReady,\s*\r?\n\s*log\r?\n\s*\}/);
  assert.match(editorSource, /finalizeEditorReady\(\);/);
});

test('editor.js guards missing markEditorReady before startup proceeds', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.markEditorReady missing');
  const logIndex = editorSource.indexOf("log('startEditor sequence initiated')");
  const waiterIndex = editorSource.indexOf('const waitForGlobal = createEditorStartupDependencyWaiter({ log, reportError });');

  assert.ok(guardIndex !== -1, 'missing markEditorReady guard must exist');
  assert.ok(logIndex !== -1, 'startup log must exist');
  assert.ok(waiterIndex !== -1, 'dependency waiter setup must exist');
  assert.ok(guardIndex < logIndex, 'markEditorReady guard must run before startup log');
  assert.ok(guardIndex < waiterIndex, 'markEditorReady guard must run before dependency waiter setup');
});

test('editor.js guards missing createEditorStartupDependencyWaiter after debug reporter creation', () => {
  const reporterCall = editorSource.indexOf('deps.createEditorDebugReporter()');
  const waiterGuard = editorSource.indexOf('LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing');

  assert.ok(reporterCall !== -1, 'createEditorDebugReporter() call must exist');
  assert.ok(waiterGuard !== -1, 'createEditorStartupDependencyWaiter missing guard must exist');
  assert.ok(reporterCall < waiterGuard, 'debug reporter must be created before waiter guard');
});

test('editor.js guards missing createEditorStartupDependencyWaiter before markEditorReady guard', () => {
  const waiterGuard = editorSource.indexOf('LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing');
  const markGuard = editorSource.indexOf('LoveBudEditorShellHelpers.markEditorReady missing');

  assert.ok(waiterGuard !== -1, 'createEditorStartupDependencyWaiter missing guard must exist');
  assert.ok(markGuard !== -1, 'markEditorReady missing guard must exist');
  assert.ok(waiterGuard < markGuard, 'waiter guard must run before markEditorReady guard');
});

test('editor.js does not use console.error for createEditorStartupDependencyWaiter missing guard at top level', () => {
  const topBootSection = editorSource.slice(0, editorSource.indexOf('const startEditor'));
  const consoleErrorPattern = /console\.error\(.*createEditorStartupDependencyWaiter missing/;
  assert.doesNotMatch(topBootSection, consoleErrorPattern,
    'createEditorStartupDependencyWaiter missing must use reportError, not top-level console.error');
});

test('editor.js delegates waitForGlobal dependency order to shell helper', () => {
  assert.match(shellGuardsSource, /'createEditorCanvas'/);
  assert.match(shellGuardsSource, /'createEditorDetailUI'/);
  assert.match(shellGuardsSource, /'createEditorMemoryActions'/);
  assert.match(shellGuardsSource, /'createEditorMemoryForm'/);

  const waiterStart = shellGuardsSource.indexOf('createEditorRequiredGlobalWaiter');
  assert.ok(waiterStart !== -1, 'shell helper must define createEditorRequiredGlobalWaiter');

  const globals = [
    'createEditorCanvas',
    'createEditorDetailUI',
    'createEditorMemoryActions',
    'createEditorMemoryForm'
  ];

  let prevIndex = -1;
  for (const global of globals) {
    const idx = shellGuardsSource.indexOf(global, waiterStart);
    assert.ok(idx !== -1, `Shell helper must reference ${global}`);
    assert.ok(idx > prevIndex, `Wait order must be preserved: ${global} after previous`);
    prevIndex = idx;
  }
});

test('editor.js guards missing applyEditorEditabilityState before startup shell applier', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.applyEditorEditabilityState missing');
  const applierIndex = editorSource.indexOf('const applyEditorStartupShell = createEditorStartupShellApplier({');

  assert.ok(guardIndex !== -1, 'missing applyEditorEditabilityState guard must exist');
  assert.ok(applierIndex !== -1, 'startup shell applier construction must exist');
  assert.ok(guardIndex < applierIndex, 'guard must run before startup shell applier construction');
});

// --- 8. VM-based runtime behavior tests ---

test('markEditorReady removes editor-preload class from provided body at runtime', () => {
  const { shellHelpers, classListCalls } = loadShellHelpers();

  const body = {
    classList: {
      remove: (...args) => classListCalls.push(['custom-remove', ...args])
    }
  };

  shellHelpers.markEditorReady({ body });

  assert.deepEqual(classListCalls, [['custom-remove', 'editor-preload']]);
});

test('markEditorReady uses document.body by default at runtime', () => {
  const { shellHelpers, classListCalls } = loadShellHelpers();

  shellHelpers.markEditorReady();

  assert.deepEqual(classListCalls, [['remove', 'editor-preload']]);
});

test('applyEditorEditabilityState stores canEdit false and toggles readonly class at runtime', () => {
  const { shellHelpers, classListCalls } = loadShellHelpers();
  const editorNamespace = {};

  const result = shellHelpers.applyEditorEditabilityState({
    canEdit: false,
    editorNamespace
  });

  assert.equal(result, editorNamespace);
  assert.equal(editorNamespace.canEdit, false);
  assert.deepEqual(classListCalls, [['toggle', 'editor-readonly', true]]);
});

test('applyEditorEditabilityState defaults canEdit to true at runtime', () => {
  const { shellHelpers, classListCalls } = loadShellHelpers();
  const editorNamespace = {};

  shellHelpers.applyEditorEditabilityState({ editorNamespace });

  assert.equal(editorNamespace.canEdit, true);
  assert.deepEqual(classListCalls, [['toggle', 'editor-readonly', false]]);
});

test('applyEditorEditabilityState uses LoveBudEditor namespace by default at runtime', () => {
  const { shellHelpers, context } = loadShellHelpers();

  const result = shellHelpers.applyEditorEditabilityState({ canEdit: true });

  assert.equal(result, context.window.LoveBudEditor);
  assert.equal(context.window.LoveBudEditor.canEdit, true);
});

test('createEditorDebugReporter records log and error entries at runtime', () => {
  const logs = [];
  const errors = [];
  const debugState = { logs: [], errors: [] };
  const { shellHelpers } = loadShellHelpers();

  const reporter = shellHelpers.createEditorDebugReporter({
    debugState,
    consoleRef: {
      log: (...args) => logs.push(args),
      error: (...args) => errors.push(args)
    },
    now: () => new Date('2026-05-30T12:00:00.000Z')
  });

  reporter.log('hello');
  reporter.reportError('boom', new Error('failed'));

  assert.equal(debugState.logs.length, 1);
  assert.match(debugState.logs[0], /\[editor-main\] 12:00:00\.000Z hello/);
  assert.equal(debugState.errors.length, 1);
  assert.equal(debugState.errors[0].msg, 'boom');
  assert.equal(debugState.errors[0].error, 'failed');
  assert.equal(logs.length, 1);
  assert.equal(errors.length, 1);
});

test('createEditorDebugReporter uses LoveBudEditorDebug namespace by default at runtime', () => {
  const { shellHelpers, context } = loadShellHelpers({
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    }
  });

  const reporter = shellHelpers.createEditorDebugReporter({
    now: () => new Date('2026-05-30T12:00:00.000Z')
  });

  reporter.log('hello');

  assert.ok(context.window.LoveBudEditorDebug);
  assert.equal(context.window.LoveBudEditorDebug.logs.length, 1);
});

test('createEditorStartupDependencyWaiter resolves true when dependency exists at runtime', async () => {
  const { shellHelpers } = loadShellHelpers();
  const messages = [];

  const waitForGlobal = shellHelpers.createEditorStartupDependencyWaiter({
    windowRef: { createEditorCanvas: () => {} },
    log: (message) => messages.push(message),
    reportError: assert.fail,
    wait: async () => {},
    maxAttempts: 1,
    intervalMs: 0
  });

  const result = await waitForGlobal('createEditorCanvas');

  assert.equal(result, true);
  assert.deepEqual(messages, [
    'Waiting for createEditorCanvas...',
    'createEditorCanvas found.'
  ]);
});

test('createEditorStartupDependencyWaiter reports false when dependency is missing at runtime', async () => {
  const { shellHelpers } = loadShellHelpers();
  const messages = [];
  const errors = [];

  const waitForGlobal = shellHelpers.createEditorStartupDependencyWaiter({
    windowRef: {},
    log: (message) => messages.push(message),
    reportError: (message) => errors.push(message),
    wait: async () => {},
    maxAttempts: 2,
    intervalMs: 0
  });

  const result = await waitForGlobal('createEditorCanvas');

  assert.equal(result, false);
  assert.deepEqual(messages, ['Waiting for createEditorCanvas...']);
  assert.deepEqual(errors, ['createEditorCanvas not found after 5s']);
});
