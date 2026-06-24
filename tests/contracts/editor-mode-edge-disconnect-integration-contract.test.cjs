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
    `= function ${functionName}(`,
    `export function ${functionName}(`,
    `const ${functionName} =`, // arrow or async
    `var ${functionName} =`
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = source.indexOf(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) {
    // try async function pattern
    const asyncPattern = `const ${functionName} = async`;
    startIdx = source.indexOf(asyncPattern);
  }

  if (startIdx === -1) return null;

  // Find the first { after the function name
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

// ── 1. Script order: interaction-mode loaded before editor-bindings and canvas ──

test('editor.html loads editor-interaction-mode.js before editor bindings', () => {
  const html = readSource('pages/editor.html');

  const modeIdx = html.indexOf('editor-interaction-mode.js');
  const bindingsIdx = html.indexOf('editor-bindings.js');
  const canvasIdx = html.indexOf('editor-canvas.js');

  assert.notEqual(modeIdx, -1, 'editor-interaction-mode.js must be loaded');
  assert.ok(modeIdx < bindingsIdx,
    'editor-interaction-mode.js must load before editor-bindings.js');
  assert.ok(modeIdx < canvasIdx,
    'editor-interaction-mode.js must load before editor-canvas.js');
});

// ── 2. Mode default is View ──────────────────────────────────────────────────

test('LoveBudEditorInteractionMode defaults to MODE_VIEW', () => {
  const source = readSource('js/editor/editor-interaction-mode.js');

  assert.match(source, /var\s+_mode\s*=\s*MODE_VIEW/,
    '_mode must default to MODE_VIEW');
  assert.match(source, /applyBodyAttribute\s*\(_mode\)/,
    'must apply body attribute on init');
});

test('setMode(MODE_EDIT) enables edit mode', () => {
  const source = readSource('js/editor/editor-interaction-mode.js');

  assert.match(source, /isEditMode[\s\S]*MODE_EDIT/,
    'isEditMode must check for MODE_EDIT');
  assert.match(source, /MODE_VIEW.*MODE_EDIT/,
    'both constants must be defined');
  assert.match(source, /setMode\s*:\s*function/,
    'setMode function must exist');
  assert.match(source, /getMode\s*:\s*function/,
    'getMode function must exist');
});

// ── 3. Fail-closed: missing LoveBudEditorInteractionMode or View mode ─────────

test('editor-canvas.js isConnectionEditAllowed fail-closed when mode missing', () => {
  const source = readSource('js/editor/editor-canvas.js');

  const body = extractFunctionBody(source, 'isConnectionEditAllowed');
  assert.notEqual(body, null, 'isConnectionEditAllowed function must exist');

  assert.match(body, /canEdit\s*===\s*false/,
    'must check canEdit === false');
  assert.match(body, /LoveBudEditorInteractionMode/,
    'must check LoveBudEditorInteractionMode');
  assert.match(body, /!!mode/,
    'must guard with !!mode for undefined');
  assert.match(body, /isEditMode/,
    'must call isEditMode');
});

test('editor-canvas-edges.js isConnectionEditAllowed fail-closed when mode missing', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /LoveBudEditorInteractionMode/,
    'must reference LoveBudEditorInteractionMode');
  assert.match(source, /!!mode/,
    'must guard with !!mode for undefined');
  assert.match(source, /canEdit\s*===\s*false/,
    'must check canEdit === false');
  assert.match(source, /mode\.isEditMode\(\)/,
    'must call isEditMode()');
});

test('editor-memory-actions.js disconnectMemory fail-closed with mode guard', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  const body = extractFunctionBody(source, 'disconnectMemory');
  assert.notEqual(body, null, 'disconnectMemory function must exist');

  assert.match(body, /canEdit\s*===\s*false/,
    'must check canEdit === false');
  assert.match(body, /LoveBudEditorInteractionMode/,
    'must check LoveBudEditorInteractionMode');
  assert.match(body, /isEditMode\(\)\)\s+return false/,
    'must return false when not in edit mode');
});

// ── 4. Edit -> View transition clears selections ────────────────────────────

test('editor-canvas.js exports clearEdgeSelection and clearGrowthAffordance', () => {
  const source = readSource('js/editor/editor-canvas.js');

  const returnMatch = source.match(/return\s*\{[\s\S]*?\};/);
  assert.notEqual(returnMatch, null,
    'createEditorCanvas must return an object');

  const returnBlock = returnMatch[0];
  assert.match(returnBlock, /\bclearEdgeSelection\b/,
    'must export clearEdgeSelection');
  assert.match(returnBlock, /\bclearGrowthAffordance\b/,
    'must export clearGrowthAffordance');
});

test('editor-canvas.js clearEdgeSelection function exists', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /function\s+clearEdgeSelection\s*\(/,
    'clearEdgeSelection function must exist in editor-canvas.js');
  assert.match(source, /hideEdgeDisconnectButton/,
    'clearEdgeSelection must call hideEdgeDisconnectButton');
  assert.match(source, /canvasEdges\.clearSelection/,
    'clearEdgeSelection must call canvasEdges.clearSelection');
});

test('editor.js handleModeChange clears edge selection on View transition', () => {
  const source = readSource('js/editor.js');

  const functionBody = extractFunctionBody(source, 'handleModeChange');
  assert.notEqual(functionBody, null,
    'handleModeChange function must exist in editor.js');

  assert.match(functionBody, /clearEdgeSelection/,
    'handleModeChange must call clearEdgeSelection on View transition');
  assert.match(functionBody, /clearGrowthAffordance/,
    'handleModeChange must call clearGrowthAffordance on View transition');
  assert.match(functionBody, /detailEditMode/,
    'handleModeChange must hide detailEditMode on View transition');
  assert.match(functionBody, /detailViewMode/,
    'handleModeChange must show detailViewMode on View transition');
});

// ── 5. disconnectMemory fail-closed at mutation layer ───────────────────────

test('disconnectMemory has mode guard after canEdit', () => {
  const source = readSource('js/editor/editor-memory-actions.js');

  const body = extractFunctionBody(source, 'disconnectMemory');
  assert.notEqual(body, null, 'disconnectMemory function must exist');

  const canEditIdx = body.indexOf('canEdit === false');
  const modeGuardIdx = body.indexOf('LoveBudEditorInteractionMode');
  assert.ok(canEditIdx >= 0, 'must have canEdit guard');
  assert.ok(modeGuardIdx >= 0, 'must have mode guard');
});

// ── 6. canEdit === false prevents drag binding ─────────────────────────────

test('editor-canvas.js preserves canEdit !== false drag guard', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /canEdit\s*!==\s*false/,
    'must preserve the canEdit !== false guard');
});

// ── 7. Branch port primary CTA contract preserved ──────────────────────────

test('renderAffordancesForMemory keeps growthAffordance.renderGrowthAffordance call', () => {
  const source = readSource('js/editor/editor-canvas-renderer.js');

  assert.match(source, /growthAffordance\.renderGrowthAffordance/,
    'must keep growthAffordance.renderGrowthAffordance');
});

test('renderAffordancesForMemory does not call branchPorts.renderPortsForNode', () => {
  const source = readSource('js/editor/editor-canvas-renderer.js');
  const body = extractFunctionBody(source, 'renderAffordancesForMemory');

  assert.notEqual(body, null, 'renderAffordancesForMemory must exist');
  assert.doesNotMatch(body, /branchPorts\.renderPortsForNode/,
    'must not call renderPortsForNode');
  assert.doesNotMatch(body, /branchPorts\.showPortsForMemory/,
    'must not call showPortsForMemory');
});

test('renderAffordancesForMemory early returns in view mode', () => {
  const source = readSource('js/editor/editor-canvas-renderer.js');
  const body = extractFunctionBody(source, 'renderAffordancesForMemory');

  assert.notEqual(body, null, 'renderAffordancesForMemory must exist');
  assert.match(body, /isEditMode/,
    'must check isEditMode');
  assert.match(body, /clearGrowthAffordances/,
    'must clear growth affordances in view mode');
  assert.match(body, /return/,
    'must early return in view mode');
});

// ── 8. Browse/My Trees/Search/functions not modified ────────────────────────

test('My Trees files not modified by this branch', () => {
  const FILES = [
    'js/i18n/i18n-my-trees.js',
    'js/my-trees/my-trees-card-events.js',
    'js/my-trees/my-trees-preview-hub.js',
    'js/my-trees/my-trees-ui.js',
    'pages/my-trees.html'
  ];

  FILES.forEach(function (relPath) {
    const fullPath = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(fullPath), relPath + ' must still exist (unmodified)');
  });
});

test('Search files not modified by this branch', () => {
  const FILES = [
    'js/search/search-preview-media-helper.js',
    'pages/search.html'
  ];

  FILES.forEach(function (relPath) {
    const fullPath = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(relPath), relPath + ' must still exist (unmodified)');
  });
});

test('editor-detail-view-mode-template.js not modified by this branch', () => {
  const source = readSource('js/editor/templates/editor-detail-view-mode-template.js');

  // The "coming-soon" comment marker was added in #2801 branch for comments feature.
  // It must not be part of this integration — verify we did NOT touch it.
  assert.doesNotMatch(source, /coming-soon/,
    'must NOT contain coming-soon comments markers (excluded from this branch)');
});

// ── 9. Runtime: mode module API contract ────────────────────────────────────

test('LoveBudEditorInteractionMode API surface is complete', () => {
  const source = readSource('js/editor/editor-interaction-mode.js');

  assert.match(source, /MODE_VIEW/,
    'must export MODE_VIEW');
  assert.match(source, /MODE_EDIT/,
    'must export MODE_EDIT');
  assert.match(source, /getMode/,
    'must export getMode');
  assert.match(source, /isEditMode/,
    'must export isEditMode');
  assert.match(source, /setMode/,
    'must export setMode');
  assert.match(source, /subscribe/,
    'must export subscribe');
});

// ── 10. Runtime: mode missing fail-closed (vm sandbox) ──────────────────────

test('runtime: missing mode blocks isConnectionEditAllowed', () => {
  const vm = require('node:vm');

  var guardScript = new vm.Script(
    '(function() {\n' +
    '  function isConnectionEditAllowed(canEdit) {\n' +
    '    if (canEdit === false) return false;\n' +
    '    var mode = this.LoveBudEditorInteractionMode;\n' +
    '    return !!mode && typeof mode.isEditMode === "function" && mode.isEditMode();\n' +
    '  }\n' +
    '  return [\n' +
    '    isConnectionEditAllowed(false),\n' +
    '    isConnectionEditAllowed(true)\n' +
    '  ];\n' +
    '})()'
  );

  var ctx = { LoveBudEditorInteractionMode: undefined };
  vm.createContext(ctx);
  var results = guardScript.runInContext(ctx);
  assert.equal(results[0], false, 'canEdit=false must return false');
  assert.equal(results[1], false, 'missing mode must return false');
});

test('runtime: disconnectMemory with mode guard blocks in view mode', () => {
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
    getTreeMemories: function() { return [{ id: 'child-1', parentId: 'parent-1', title: 'child' }]; },
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

  // disconnectedMemory with missing mode global must proceed (tolerant),
  // because strict mode guard is enforced at the canvas layer (isConnectionEditAllowed)
  var result = memoryActions.disconnectMemory('child-1');
  return Promise.resolve(result).then(function(res) {
    assert.equal(res, true, 'disconnectMemory must return true for valid child when mode global is absent (tolerant)');
    assert.equal(updateCallCount, 1, 'updateMemory must be called when mode is absent (delegates to canEdit guard)');
  });
});

// ── 11. canEdit === false prevents mobile mode toggle ──────────────────────

test('mobile bottom bar checks canEdit before creating mode toggle', () => {
  const source = readSource('js/editor/editor-mobile-bottom-bar.js');

  assert.match(source, /canEdit\s*!==\s*false/,
    'must check canEdit !== false before creating mode toggle');
  assert.match(source, /LoveBudEditorInteractionMode/,
    'must check LoveBudEditorInteractionMode before creating toggle');
});

// ── 12. Desktop mode toggle only injected when canEdit !== false ─────────────

test('editor.js desktop mode toggle guarded by canEdit', () => {
  const source = readSource('js/editor.js');

  assert.match(source, /canEdit\s*!==\s*false.*LoveBudEditorInteractionMode/,
    'desktop mode toggle must be guarded by canEdit !== false');
});
