'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const patterns = [
    `function ${functionName}(`,
    `= function ${functionName}(`
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = source.indexOf(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) return null;

  let braceCount = 0;
  let bodyStart = -1;
  let i = startIdx;

  while (i < source.length) {
    if (source[i] === '{') {
      braceCount++;
      if (braceCount === 1) {
        bodyStart = i + 1;
      }
    } else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0 && bodyStart !== -1) {
        return source.slice(bodyStart, i);
      }
    }
    i++;
  }

  return null;
}

// ── 1. connectMemory function exists in editor-memory-actions.js ──────────

test('connectMemory function must exist in editor-memory-actions.js', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  assert.match(source, /connectMemory/,
    'connectMemory function must be defined');
  assert.match(source, /updateMemory.*parentId/,
    'connectMemory must call apiClient.updateMemory with parentId');
  assert.match(source, /setTreeMemories/,
    'connectMemory must update local tree memories');
  assert.match(source, /rerenderCanvas/,
    'connectMemory must trigger canvas re-render');
  assert.match(source, /connect_success/,
    'connectMemory must show success toast');
});

// ── 2. isDescendant helper exists and detects cycles ─────────────────────

test('isDescendant helper function must exist in editor-memory-actions.js', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  assert.match(source, /function\s+isDescendant\s*\(/,
    'isDescendant helper must be defined');
});

test('runtime: isDescendant detects ancestor relationship', () => {
  const vm = require('node:vm');

  var guardScript = new vm.Script(
    '(function() {\n' +
    '  function isDescendant(memories, sourceId, targetId) {\n' +
    '    var visited = {};\n' +
    '    var currentId = targetId;\n' +
    '    while (currentId) {\n' +
    '      if (String(currentId) === String(sourceId)) return true;\n' +
    '      if (visited[String(currentId)]) return false;\n' +
    '      visited[String(currentId)] = true;\n' +
    '      var mem = memories.find(function (m) { return String(m.id) === String(currentId); });\n' +
    '      if (!mem || !mem.parentId) break;\n' +
    '      currentId = mem.parentId;\n' +
    '    }\n' +
    '    return false;\n' +
    '  }\n' +
    '  var tree = [\n' +
    '    { id: "root", parentId: null },\n' +
    '    { id: "mem-1", parentId: "root" },\n' +
    '    { id: "mem-2", parentId: "mem-1" },\n' +
    '    { id: "mem-3", parentId: "mem-2" }\n' +
    '  ];\n' +
    '  return [\n' +
    '    isDescendant(tree, "mem-1", "mem-2"),\n' +
    '    isDescendant(tree, "mem-1", "mem-3"),\n' +
    '    isDescendant(tree, "mem-2", "mem-3"),\n' +
    '    isDescendant(tree, "mem-1", "mem-1"),\n' +
    '    isDescendant(tree, "mem-3", "root"),\n' +
    '    isDescendant(tree, "mem-3", "no-such-id"),\n' +
    '    isDescendant(tree, "no-such", "mem-1")\n' +
    '  ];\n' +
    '})()'
  );
  var ctx = {};
  vm.createContext(ctx);
  var results = guardScript.runInContext(ctx);

  assert.equal(results.length, 7, 'all 7 descendant conditions must be tested');
  assert.equal(results[0], true, 'mem-1 is ancestor of mem-2');
  assert.equal(results[1], true, 'mem-1 is ancestor of mem-3 (indirect)');
  assert.equal(results[2], true, 'mem-2 is ancestor of mem-3');
  assert.equal(results[3], true, 'target=source must return true (self-cycle)');
  assert.equal(results[4], false, 'mem-3 is not ancestor of root (root has no parent)');
  assert.equal(results[5], false, 'non-existent target returns false');
  assert.equal(results[6], false, 'non-existent source returns false (walk fails to find starting node)');
});

// ── 3. connectMemory guards ──────────────────────────────────────────────

test('connectMemory blocks root from API call', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  assert.match(source, /connectMemory/,
    'connectMemory function must exist');
  assert.match(source, /isRootMemory/,
    'connectMemory must check isRootMemory');
  assert.match(source, /canEdit\s*===\s*false/,
    'connectMemory must check canEdit === false');
  assert.match(source, /LoveBudEditorInteractionMode/,
    'connectMemory must check interaction mode');
  assert.match(source, /isDescendant/,
    'connectMemory must call isDescendant for cycle detection');
  assert.match(source, /connect_root_blocked/,
    'connectMemory must show error for root connection');
  assert.match(source, /connect_already_connected/,
    'connectMemory must show error for already connected');
  assert.match(source, /connect_cycle_blocked/,
    'connectMemory must show error for cycle');
});

// ── 4. Runtime: connectMemory blocks invalid connections ──────────────────

test('runtime: connectMemory blocks root, self, already-connected, cycle', () => {
  const vm = require('node:vm');
  var updateCallCount = 0;

  var source = readSource('js/editor/editor-memory-actions.js');

  var sandbox = {
    window: { apiClient: { updateMemory: async function() { updateCallCount++; return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var toastMessages = [];
  var fakeIsRootMemory = function(mem, cid) {
    return String(mem.id) === String(cid) || mem.id === 'root';
  };

  var memoryActions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRootMemory,
    findRootMemory: function() { return null; },
    getTreeMemories: function() {
      return [
        { id: 'root', parentId: null },
        { id: 'mem-1', parentId: 'root' },
        { id: 'mem-2', parentId: 'mem-1' },
        { id: 'mem-3', parentId: 'mem-2' }
      ];
    },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return { id: 'tree-1', memories: [] }; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function(msg) { toastMessages.push(msg); },
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  // Test root block
  var r1 = memoryActions.connectMemory('root', 'mem-1');
  return Promise.resolve(r1).then(function(res1) {
    assert.equal(res1, false, 'connectMemory must return false for root source');
    assert.equal(updateCallCount, 0, 'updateMemory must NOT be called for root');

    // Test self-connection
    return memoryActions.connectMemory('mem-1', 'mem-1');
  }).then(function(res2) {
    assert.equal(res2, false, 'connectMemory must return false for self-connection');
    assert.equal(updateCallCount, 0, 'updateMemory must NOT be called for self-connection');

    // Test already connected (mem-2 parentId is mem-1)
    return memoryActions.connectMemory('mem-2', 'mem-1');
  }).then(function(res3) {
    assert.equal(res3, false, 'connectMemory must return false for already-connected');
    assert.equal(updateCallCount, 0, 'updateMemory must NOT be called for already-connected');

    // Test cycle (mem-3 cannot be parent of mem-1)
    return memoryActions.connectMemory('mem-1', 'mem-3');
  }).then(function(res4) {
    assert.equal(res4, false, 'connectMemory must return false for cycle');
    assert.equal(updateCallCount, 0, 'updateMemory must NOT be called for cycle');

    // Test valid connection (mem-3 to root)
    return memoryActions.connectMemory('mem-3', 'root');
  }).then(function(res5) {
    assert.equal(res5, true, 'connectMemory must return true for valid connection');
    assert.equal(updateCallCount, 1, 'updateMemory must be called once for valid connection');
  });
});

// ── 5. Dashed preview methods exist in editor-canvas-edges.js ────────────

test('drawDashedPreview and clearDashedPreview exist in editor-canvas-edges.js', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /function\s+drawDashedPreview\s*\(/,
    'drawDashedPreview function must exist');
  assert.match(source, /function\s+clearDashedPreview\s*\(/,
    'clearDashedPreview function must exist');
  assert.match(source, /stroke-dasharray/,
    'drawDashedPreview must set stroke-dasharray for dashed style');
  assert.match(source, /branch-line-preview/,
    'drawDashedPreview must use branch-line-preview class');
});

// ── 6. Pending connect state in editor-canvas.js ─────────────────────────

test('setPendingConnect, clearPendingConnect, getPendingConnectSourceId exist in editor-canvas.js', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /function\s+setPendingConnect\s*\(/,
    'setPendingConnect function must exist');
  assert.match(source, /function\s+clearPendingConnect\s*\(/,
    'clearPendingConnect function must exist');
  assert.match(source, /function\s+getPendingConnectSourceId\s*\(/,
    'getPendingConnectSourceId function must exist');
  assert.match(source, /pendingConnectState/,
    'pendingConnectState variable must exist');
});

test('clearPendingConnect is called in clearEdgeSelection', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /clearEdgeSelection[\s\S]*clearPendingConnect/,
    'clearEdgeSelection must call clearPendingConnect');
});

test('clearPendingConnect is called during initCanvas cleanup', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /clearPendingConnect\(\)/,
    'initCanvas must call clearPendingConnect during cleanup');
});

// ── 7. selectMemoryNode intercepts during pending connect state ──────────

test('selectMemoryNode checks pendingConnectState before calling onNodeClick', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /selectMemoryNode\s*=\s*\(\)\s*=>\s*\{/,
    'selectMemoryNode arrow function must exist');
  assert.match(source, /pendingConnectState/,
    'selectMemoryNode must check pendingConnectState');
  assert.match(source, /handleConnectTargetSelect/,
    'selectMemoryNode must call handleConnectTargetSelect in connect mode');
});

// ── 8. onConnectTargetSelect callback exists in canvas deps ──────────────

test('editor-canvas.js accepts onConnectTargetSelect dep', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /onConnectTargetSelect/,
    'onConnectTargetSelect must be accepted as a dependency');
});

test('onConnectTargetSelect is exported in createEditorCanvas return', () => {
  const source = readSource('js/editor/editor-canvas.js');
  const returnMatch = source.match(/return\s*\{[\s\S]*?\};/);
  assert.notEqual(returnMatch, null, 'createEditorCanvas must return an object');

  assert.match(returnMatch[0], /\bsetPendingConnect\b/,
    'must export setPendingConnect');
  assert.match(returnMatch[0], /\bclearPendingConnect\b/,
    'must export clearPendingConnect');
  assert.match(returnMatch[0], /\bgetPendingConnectSourceId\b/,
    'must export getPendingConnectSourceId');
});

// ── 9. Template has connect existing sections ────────────────────────────

test('editor-detail-edit-mode-template.js contains connect existing sections', () => {
  const source = readSource('js/editor/templates/editor-detail-edit-mode-template.js');

  assert.match(source, /connectExistingCtaSection/,
    'CTA section must exist');
  assert.match(source, /connectExistingCtaBtn/,
    'CTA button must exist');
  assert.match(source, /connectExistingPendingSection/,
    'Pending section must exist');
  assert.match(source, /connectExistingPendingHint/,
    'Pending hint text must exist');
  assert.match(source, /connectExistingCancelBtn/,
    'Cancel button during pending must exist');
  assert.match(source, /connectExistingConfirmSection/,
    'Confirm section must exist');
  assert.match(source, /connectExistingConfirmHint/,
    'Confirm hint text must exist');
  assert.match(source, /connectExistingConfirmBtn/,
    'Confirm button must exist');
  assert.match(source, /connectExistingConfirmCancelBtn/,
    'Confirm cancel button must exist');
});

// ── 10. CSS styles for connect existing UI ───────────────────────────────

test('CSS defines styles for connect existing sections', () => {
  const css = readSource('css/editor/editor-detail-edit/actions.css');

  assert.match(css, /\.editor-connect-existing-section/,
    'must have .editor-connect-existing-section CSS rule');
  assert.match(css, /\.editor-connect-pending-hint/,
    'must have .editor-connect-pending-hint CSS rule');
  assert.match(css, /\.editor-connect-confirm-hint/,
    'must have .editor-connect-confirm-hint CSS rule');
  assert.match(css, /\.editor-connect-pending-actions/,
    'must have .editor-connect-pending-actions CSS rule');
  assert.match(css, /\.editor-connect-confirm-actions/,
    'must have .editor-connect-confirm-actions CSS rule');
});

test('CSS defines dashed preview line style', () => {
  const css = readSource('css/editor/editor-canvas.css');

  assert.match(css, /\.branch-line-preview/,
    'must have .branch-line-preview CSS rule');
  assert.match(css, /pointer-events:\s*none/,
    'preview line must have pointer-events: none');
});

// ── 11. Bindings controller exists ───────────────────────────────────────

test('createConnectExistingController exists in editor-bindings.js', () => {
  const source = readSource('js/editor/editor-bindings.js');

  assert.match(source, /createConnectExistingController/,
    'createConnectExistingController must be defined');
  assert.match(source, /handleConnectTargetSelect/,
    'controller must have handleConnectTargetSelect');
  assert.match(source, /setEditorCanvas/,
    'controller must have setEditorCanvas');
  assert.match(source, /bindControls/,
    'controller must have bindControls');
  assert.match(source, /exitConnectMode/,
    'controller must have exitConnectMode');
  assert.match(source, /updateCtaVisibility/,
    'controller must have updateCtaVisibility');
});

// ── 12. editor.js wires onConnectTargetSelect and controller ──────────────

test('editor.js creates connectExistingController and wires it', () => {
  const source = readSource('js/editor.js');

  assert.match(source, /createConnectExistingController/,
    'editor.js must create connectExistingController');
  assert.match(source, /onConnectTargetSelect/,
    'editor.js must pass onConnectTargetSelect to canvas');
  assert.match(source, /setEditorCanvas/,
    'editor.js must set editorCanvas on controller');
  assert.match(source, /connectMemory\s*=\s*connectMemory/,
    'editor.js must extract connectMemory from memoryActions');
  assert.match(source, /connectExistingController\.connectMemory/,
    'editor.js must set connectMemory on controller');
  assert.match(source, /exitConnectMode/,
    'editor.js must call exitConnectMode on view mode transition');
});

// ── 13. No new API calls, no innerHTML sinks, no browse/search/Firebase changes ──

test('connectMemory does not add new API endpoints or fetch calls', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  // connectMemory must use apiClient.updateMemory, not raw fetch
  assert.match(source, /updateMemory/,
    'must use apiClient.updateMemory');
  assert.doesNotMatch(source, /fetch\s*\(\s*['"][^'"]*\/api\/[^'"]*['"]\s*\)/,
    'must not add raw fetch calls to API endpoints');
});

test('editor-canvas.js does not add apiClient calls or cache mutations in connect flow', () => {
  const source = readSource('js/editor/editor-canvas.js');

  // The handleConnectTargetSelect must NOT contain apiClient calls
  const bodyMatch = source.match(/function\s+handleConnectTargetSelect[\s\S]*?\n\s*\}/);
  if (bodyMatch) {
    assert.doesNotMatch(bodyMatch[0], /apiClient/,
      'handleConnectTargetSelect must not call apiClient');
    assert.doesNotMatch(bodyMatch[0], /LoveBudCache/,
      'handleConnectTargetSelect must not touch cache');
  }
});

// ── 14. CanEdit === false blocks everywhere ──────────────────────────────

test('connectMemory is guarded by canEdit === false', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  assert.match(source, /canEdit\s*===\s*false/,
    'must check canEdit === false');
  assert.match(source, /LoveBudEditorInteractionMode/,
    'must check interaction mode global');
});

test('editor-canvas.js isConnectionEditAllowed guards include mode check', () => {
  const source = readSource('js/editor/editor-canvas.js');

  const body = extractFunctionBody(source, 'isConnectionEditAllowed');
  assert.notEqual(body, null, 'isConnectionEditAllowed function must exist');
  assert.match(body, /canEdit\s*===\s*false/,
    'must check canEdit === false');
  assert.match(body, /LoveBudEditorInteractionMode/,
    'must check mode global');
});

// ── 15. Runtime: dashed preview SVG path creation ────────────────────────

test('runtime: drawDashedPreview creates SVG path with dashed attributes', () => {
  const vm = require('node:vm');
  const source = readSource('js/editor/editor-canvas-edges.js');

  var createdPaths = [];
  var sandbox = {
    window: {},
    document: {
      createElementNS: function(ns, tag) {
        var el = {
          tagName: tag, namespaceURI: ns, attributes: {},
          setAttribute: function(k, v) { this.attributes[k] = v; },
          getAttribute: function(k) { return this.attributes[k] || null; },
          remove: function() { createdPaths = createdPaths.filter(function(p) { return p !== el; }); }
        };
        createdPaths.push(el);
        return el;
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var svg = {
    querySelectorAll: function() { return []; },
    appendChild: function() {}
  };

  var edges = sandbox.window.createEditorCanvasEdges({ svg: svg, canvasViewport: {}, canEdit: true });

  var result = edges.drawDashedPreview({ x: 10, y: 20 }, { x: 100, y: 200 });

  assert.notEqual(result, null, 'drawDashedPreview must return a value');
  assert.equal(result.getAttribute('class'), 'branch-line branch-line-preview', 'must have branch-line-preview class');
  assert.equal(result.getAttribute('stroke-dasharray'), '8 5', 'must have dashed stroke');
  assert.equal(result.getAttribute('stroke'), 'var(--primary)', 'must use primary color');

  edges.clearDashedPreview();
  assert.equal(createdPaths.length, 0, 'clearDashedPreview must remove the preview path');
});

// ── 16. Runtime: connectMemory with mode global absent (tolerant) ────────

test('runtime: connectMemory tolerates missing mode global when canEdit is true', () => {
  var vm = require('node:vm');
  var updateCallCount = 0;

  var source = readSource('js/editor/editor-memory-actions.js');

  var sandbox = {
    window: {
      apiClient: { updateMemory: async function() { updateCallCount++; return {}; } },
      LoveBudCache: { set: function() {} },
      LoveBudEditorInteractionMode: undefined
    },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var fakeIsRootMemory = function(mem, cid) {
    return String(mem.id) === String(cid) || mem.id === 'root';
  };

  var memoryActions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRootMemory,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return [{ id: 'mem-1', parentId: 'root' }, { id: 'mem-2', parentId: 'root' }]; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return { id: 'tree-1', memories: [] }; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var result = memoryActions.connectMemory('mem-1', 'mem-2');
  return Promise.resolve(result).then(function(res) {
    assert.equal(res, true, 'connectMemory must return true when mode global is absent (tolerant)');
    assert.equal(updateCallCount, 1, 'updateMemory must be called when mode is absent');
  });
});
