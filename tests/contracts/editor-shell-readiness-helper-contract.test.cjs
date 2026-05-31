const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
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
  vm.runInContext(shellHelpersSource, context);

  return {
    shellHelpers: context.window.LoveBudEditorShellHelpers,
    context,
    classListCalls,
    consoleCalls
  };
}

// --- 1. Shell helpers export check ---

test('editor shell helpers export markEditorReady', () => {
  assert.match(shellHelpersSource, /markEditorReady:\s*function\(options\)/);
});

test('editor shell helpers export applyEditorEditabilityState', () => {
  assert.match(shellHelpersSource, /applyEditorEditabilityState:\s*function\(options\)/);
});

test('editor shell helpers export createEditorDebugReporter', () => {
  assert.match(shellHelpersSource, /createEditorDebugReporter:\s*function\(options\)/);
});

test('editor shell helpers export createEditorStartupDependencyWaiter', () => {
  assert.match(shellHelpersSource, /createEditorStartupDependencyWaiter:\s*function\(options\)/);
});

// --- 2. markEditorReady behavior ---

test('markEditorReady removes editor-preload class from body', () => {
  const start = shellHelpersSource.indexOf('markEditorReady: function(options)');
  assert.notEqual(start, -1, 'markEditorReady must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /body\.classList\.remove\('editor-preload'\)/);
});

// --- 3. applyEditorEditabilityState behavior ---

test('applyEditorEditabilityState sets editorNamespace.canEdit', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  assert.notEqual(start, -1, 'applyEditorEditabilityState must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /editorNamespace\.canEdit\s*=\s*canEdit/);
});

test('applyEditorEditabilityState toggles editor-readonly class', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /body\.classList\.toggle\('editor-readonly',\s*!canEdit\)/);
});

test('applyEditorEditabilityState defaults canEdit to true', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /opts\.canEdit\s*!==\s*false/);
});

// --- 4. createEditorDebugReporter behavior ---

test('createEditorDebugReporter logs entries to debugState.logs', () => {
  const start = shellHelpersSource.indexOf('createEditorDebugReporter: function(options)');
  assert.notEqual(start, -1, 'createEditorDebugReporter must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /debugState\.logs\.push\(entry\)/);
});

test('createEditorDebugReporter records error entries to debugState.errors', () => {
  const start = shellHelpersSource.indexOf('createEditorDebugReporter: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /debugState\.errors\.push\(/);
});

// --- 5. createEditorStartupDependencyWaiter behavior ---

test('createEditorStartupDependencyWaiter returns true when dependency exists', () => {
  const start = shellHelpersSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  assert.notEqual(start, -1, 'createEditorStartupDependencyWaiter must exist');

  const block = shellHelpersSource.slice(start);

  assert.match(block, /return true/);
});

test('createEditorStartupDependencyWaiter calls reportError and returns false when dependency missing', () => {
  const start = shellHelpersSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  const block = shellHelpersSource.slice(start);

  assert.match(block, /reportError\(name \+ ' not found after 5s'\)/);
  assert.match(block, /return false/);
});

// --- 6. editor.js still keeps local fallbacks (test-only, not removing) ---

test('editor.js delegates markEditorReady through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+markEditorReady\s*=\s*shellHelpers\.markEditorReady/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+markEditorReady\s*=\s*shellHelpers\.markEditorReady\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.markEditorReady missing/
  );
});

test('editor.js delegates applyEditorEditabilityState through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+applyEditorEditabilityState\s*=\s*shellHelpers\.applyEditorEditabilityState/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+applyEditorEditabilityState\s*=\s*shellHelpers\.applyEditorEditabilityState\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.applyEditorEditabilityState missing/
  );
});

test('editor.js now uses createEditorDebugReporter as required helper without fallback', () => {
  assert.match(editorSource, /shellHelpers\.createEditorDebugReporter;/);
  assert.doesNotMatch(editorSource, /shellHelpers\.createEditorDebugReporter\s*\|\|/);
});

test('editor.js now uses createEditorStartupDependencyWaiter as required helper without fallback', () => {
  assert.match(editorSource, /shellHelpers\.createEditorStartupDependencyWaiter;/);
  assert.doesNotMatch(editorSource, /shellHelpers\.createEditorStartupDependencyWaiter\s*\|\|/);
});

// --- 7. editor.js uses helpers in startup path ---

test('editor.js calls createEditorDebugReporter in startup path', () => {
  assert.match(editorSource, /createEditorDebugReporter\(\)/);
});

test('editor.js calls createEditorStartupDependencyWaiter with log and reportError', () => {
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
});

test('editor.js calls applyEditorEditabilityState with canEdit', () => {
  assert.match(editorSource, /applyEditorEditabilityState\(\{\s*canEdit\s*\}\)/);
});

test('editor.js calls markEditorReady in startup completion', () => {
  assert.match(editorSource, /markEditorReady\(\)/);
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

test('editor.js guards missing applyEditorEditabilityState before applying editability state', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.applyEditorEditabilityState missing');
  const applyIndex = editorSource.indexOf('applyEditorEditabilityState({ canEdit });');

  assert.ok(guardIndex !== -1, 'missing applyEditorEditabilityState guard must exist');
  assert.ok(applyIndex !== -1, 'applyEditorEditabilityState call must exist');
  assert.ok(guardIndex < applyIndex, 'guard must run before editability state application');
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
