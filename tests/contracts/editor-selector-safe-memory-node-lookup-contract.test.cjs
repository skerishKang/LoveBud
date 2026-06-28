const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Minimal DOM mock for testing findMemoryNodeById
// ---------------------------------------------------------------------------
function createMockDocument(nodes) {
  function toNodeList(arr) {
    var nodelist = [];
    for (var i = 0; i < arr.length; i++) {
      nodelist.push(arr[i]);
    }
    nodelist.length = arr.length;
    nodelist.item = function (i) { return this[i] || null; };
    return nodelist;
  }
  return {
    querySelectorAll: function (selector) {
      if (selector === '.memory-node') {
        return toNodeList(nodes);
      }
      return toNodeList([]);
    }
  };
}

function makeNode(memoryId) {
  var classList = [];
  var node = {
    dataset: { memoryId: memoryId },
    classList: {
      add: function (c) { classList.push(c); },
      remove: function () {},
      contains: function () { return false; }
    },
    _classList: classList,
    offsetWidth: 100
  };
  return node;
}

// ---------------------------------------------------------------------------
// Static guards — five audited files must not contain dynamic selector
// ---------------------------------------------------------------------------
const FILES = [
  'js/editor/editor-canvas-selection.js',
  'js/editor/editor-canvas.js',
  'js/editor/editor-canvas-viewport-actions.js',
  'js/editor/editor-canvas-ui-helpers.js',
  'js/editor/editor-memory-form.js'
];

var loadedModule = null;

test('setup — import real findMemoryNodeById', async function () {
  loadedModule = await import('../../js/editor/editor-canvas-selection.js');
  assert.ok(loadedModule);
  assert.equal(typeof loadedModule.findMemoryNodeById, 'function');
});

test('normal UUID-like ID lookup', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const node = makeNode(id);
  const doc = createMockDocument([node]);

  const result = findMemoryNodeById(id, doc);
  assert.notEqual(result, null);
  assert.equal(result.dataset.memoryId, id);
});

test('ID containing CSS-significant characters', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const dangerousId = 'bad"]#selector:case';
  const node = makeNode(dangerousId);
  const doc = createMockDocument([node, makeNode('other')]);

  const result = findMemoryNodeById(dangerousId, doc);
  assert.notEqual(result, null);
  assert.equal(result.dataset.memoryId, dangerousId);
});

test('ID containing a newline', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const newlineId = 'line1\nline2';
  const node = makeNode(newlineId);
  const doc = createMockDocument([node]);

  const result = findMemoryNodeById(newlineId, doc);
  assert.notEqual(result, null);
  assert.equal(result.dataset.memoryId, newlineId);
});

test('missing ID returns null', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const doc = createMockDocument([makeNode('present-id')]);

  const result = findMemoryNodeById('missing-id', doc);
  assert.equal(result, null);
});

test('null and undefined input return null', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const doc = createMockDocument([makeNode('any')]);

  assert.equal(findMemoryNodeById(null, doc), null);
  assert.equal(findMemoryNodeById(undefined, doc), null);
});

test('node with missing dataset.memoryId does not match string ID undefined', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  // Create a node that has no dataset.memoryId property
  var nodeWithoutMemoryId = {
    dataset: {},
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
    offsetWidth: 100
  };
  var doc = createMockDocument([nodeWithoutMemoryId]);

  // Searching for the string "undefined" must not match a node with no dataset.memoryId
  var result = findMemoryNodeById('undefined', doc);
  assert.equal(result, null, 'node with missing dataset.memoryId must not match string "undefined"');

  // Also a node that explicitly has dataset.memoryId === 'undefined' should match
  var nodeWithUndefinedValue = makeNode('undefined');
  doc = createMockDocument([nodeWithUndefinedValue]);
  result = findMemoryNodeById('undefined', doc);
  assert.notEqual(result, null, 'node with dataset.memoryId="undefined" must match string "undefined"');
  assert.equal(result.dataset.memoryId, 'undefined');
});

test('reapplySelection uses the real helper and adds selected', async function () {
  const findMemoryNodeById = loadedModule.findMemoryNodeById;
  const reapplySelection = loadedModule.reapplySelection;
  const id = 'test-reapply-id';
  const node = makeNode(id);
  const doc = createMockDocument([node]);

  reapplySelection(id, doc);
  assert.ok(node._classList.indexOf('selected') >= 0);
});

test('reapplySelection with null/undefined is safe no-op', async function () {
  const reapplySelection = loadedModule.reapplySelection;
  reapplySelection(null);
  reapplySelection(undefined);
});

test('focusNodeById from editor-canvas-viewport-actions receives and calls the injected helper before applying focus-animate', function () {
  // Load the viewport actions source and run it with a mock window
  const actionsSource = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-canvas-viewport-actions.js'),
    'utf8'
  );

  var calledWithId = null;
  var focusAnimateRemoved = false;
  var focusAnimateAdded = false;
  var helperCallCount = 0;

  const mockNode = {
    classList: {
      remove: function (c) {
        if (c === 'focus-animate') focusAnimateRemoved = true;
      },
      add: function (c) {
        if (c === 'focus-animate') focusAnimateAdded = true;
      }
    },
    offsetWidth: 100
  };

  globalThis.window = {
    LoveBudEditorCanvasViewportActions: {}
  };
  globalThis.requestAnimationFrame = function (fn) { fn(); };
  globalThis.document = {};

  // Execute the classic script to set up window.LoveBudEditorCanvasViewportActions
  eval(actionsSource);

  const findMemoryNodeById = function (id) {
    helperCallCount++;
    calledWithId = id;
    return mockNode;
  };

  window.LoveBudEditorCanvasViewportActions.focusNodeById(
    { setScale: function () {}, getScale: function () { return 1; }, readableCenter: { x: 0.5, y: 0.5 } },
    {
      nodeId: 'focus-test-id',
      getTreeMemories: function () { return [{ id: 'focus-test-id' }]; },
      getWorldPosition: function () { return { x: 100, y: 100 }; },
      getMetrics: function () { return { width: 800, height: 600 }; },
      viewportState: { scale: 1, offsetX: 0, offsetY: 0 },
      initCanvas: function () {},
      reapplySelection: function () {},
      findMemoryNodeById: findMemoryNodeById
    }
  );

  assert.equal(helperCallCount, 1, 'findMemoryNodeById must be called once');
  assert.equal(calledWithId, 'focus-test-id');
  assert.ok(focusAnimateRemoved, 'focus-animate must be removed before adding');
  assert.ok(focusAnimateAdded, 'focus-animate must be added');
});

test('helper missing in viewport actions is safe no-op', function () {
  var threw = false;
  try {
    window.LoveBudEditorCanvasViewportActions.focusNodeById(
      { setScale: function () {}, getScale: function () { return 1; }, readableCenter: { x: 0.5, y: 0.5 } },
      {
        nodeId: 'no-helper-test',
        getTreeMemories: function () { return [{ id: 'no-helper-test' }]; },
        getWorldPosition: function () { return { x: 100, y: 100 }; },
        getMetrics: function () { return { width: 800, height: 600 }; },
        viewportState: { scale: 1, offsetX: 0, offsetY: 0 },
        initCanvas: function () {},
        reapplySelection: function () {}
        // no findMemoryNodeById passed
      }
    );
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, 'focusNodeById must not throw when findMemoryNodeById is absent');
});

// ---------------------------------------------------------------------------
// Static guard: no dynamic memory-ID selector interpolation in 5 files
// ---------------------------------------------------------------------------
test('static guard — no dynamic memory-ID selector interpolation in audited files', function () {
  for (const filePath of FILES) {
    const source = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    // Look for querySelector or querySelectorAll that combines data-memory-id with
    // a dynamic value (template literal or string concatenation).
    // Pattern: querySelector(`.memory-node[data-memory-id="${...}"]`)
    const templateSelector = /querySelector\(`[^`]*data-memory-id=["']\$\{/;
    // Pattern: querySelector(".memory-node[data-memory-id=\"" + ...
    const concatSelector = /querySelector\([^)]*data-memory-id=["'][^"']*["']\s*\+/;
    // Pattern: querySelector('.memory-node[data-memory-id="' + ...
    const concatSelector2 = /querySelector\([^)]*\+["'][^"']*data-memory-id/;

    const hasDynamic = templateSelector.test(source)
      || concatSelector.test(source)
      || concatSelector2.test(source);
    assert.equal(
      hasDynamic,
      false,
      `${filePath} must not contain dynamic data-memory-id selector interpolation`
    );
  }
});

test('static guard — no replace-based or CSS.escape-based memory-node lookup', function () {
  for (const filePath of FILES) {
    const source = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    // Check that no file uses .replace() on a memory-id for selector escaping
    const replaceEscapeOnId = /\.replace\(\s*[`"'][^`"']*[`"']\s*,\s*["'`].*["'`]\)/;
    // Check that CSS.escape is not used near memory-node or data-memory-id
    const cssEscapeMemPattern = /CSS\.escape\([^)]*(?:memory|id)/;

    assert.equal(
      replaceEscapeOnId.test(source) && /data-memory-id|\.memory-node/.test(source),
      false,
      `${filePath} must not use .replace() escaping for memory-node lookup`
    );

    const hasCssEscape = cssEscapeMemPattern.test(source);
    assert.equal(
      hasCssEscape,
      false,
      `${filePath} must not use CSS.escape() for memory-node lookup`
    );
  }
});

// ---------------------------------------------------------------------------
// Version string checks: all -3
// ---------------------------------------------------------------------------
test('version — editor-canvas-ui-helpers.js imports selection at -3', function () {
  const source = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-canvas-ui-helpers.js'),
    'utf8'
  );
  assert.ok(
    source.includes("'./editor-canvas-selection.js?v=20260628-2971-selector-safe-lookup-3'"),
    'ui-helpers must import selection at -3 version'
  );
});

test('version — editor-canvas.js imports selection and uiHelpers at -3', function () {
  const source = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-canvas.js'),
    'utf8'
  );
  assert.ok(
    source.includes("'./editor-canvas-selection.js?v=20260628-2971-selector-safe-lookup-3'"),
    'editor-canvas must import selection at -3 version'
  );
  assert.ok(
    source.includes("'./editor-canvas-ui-helpers.js?v=20260628-2971-selector-safe-lookup-3'"),
    'editor-canvas must import uiHelpers at -3 version'
  );
});

test('version — editor.html loads editor-canvas.js at -3', function () {
  const source = fs.readFileSync(
    path.join(ROOT, 'pages/editor.html'),
    'utf8'
  );
  assert.ok(
    source.includes('editor-canvas.js?v=20260628-2971-selector-safe-lookup-3'),
    'editor.html must load editor-canvas.js at -3 version'
  );
});

test('version — editor-canvas-viewport-actions.js and editor-memory-form.js remain at -2', function () {
  const source = fs.readFileSync(
    path.join(ROOT, 'pages/editor.html'),
    'utf8'
  );
  // These must stay at -2 since their contents do not change in this correction
  assert.ok(
    source.includes('editor-canvas-viewport-actions.js?v=20260628-2971-selector-safe-lookup-2'),
    'viewport-actions must remain at -2'
  );
  assert.ok(
    source.includes('editor-memory-form.js?v=20260628-2971-selector-safe-lookup-2'),
    'memory-form must remain at -2'
  );
});

// Cleanup globals
test.after(function () {
  delete globalThis.window;
  delete globalThis.requestAnimationFrame;
  delete globalThis.document;
});
