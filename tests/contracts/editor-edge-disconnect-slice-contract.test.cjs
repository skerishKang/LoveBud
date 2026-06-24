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

// ── 1. Edge identity: data-edge-child-id ──────────────────────────────────

test('drawBranchForMemory sets data-edge-child-id attribute on branch-line paths', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /data-edge-child-id/,
    'must set data-edge-child-id attribute on path');
  assert.match(source, /String\(node\.id\)/,
    'must use node.id as the child identifier');
  assert.match(source, /drawBranchForMemory/,
    'drawBranchForMemory must exist');
});

// ── 2. Edge identity: drawn via drawBranchForMemory ────────────────────────

test('drawBranchForMemory creates branch-line paths and assigns data-edge-child-id', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /drawBranchForMemory/,
    'drawBranchForMemory must exist');
  assert.match(source, /data-edge-child-id/,
    'must set data-edge-child-id on the drawn path');
  assert.match(source, /addEventListener\s*\(\s*['"]click['"]/,
    'must add click event listener for edge selection');
});

// ── 3. Edit mode guard: canEdit check in click handler ─────────────────────

test('edge click handler checks canEdit === false before selecting', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /canEdit\s*===\s*false/,
    'must guard against canEdit === false');
  assert.match(source, /addEventListener\s*\(\s*['"]click['"]/,
    'must add click event listener on path');
  assert.match(source, /e\.stopPropagation\(\)/,
    'click handler must stop propagation to prevent pan/zoom interference');
});

// ── 4. isEditMode guard: DOM-based edit mode check ────────────────────────

test('editor-canvas.js defines isEditMode check and passes canEdit to edges', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /isEditMode:\s*function\s*\(\)/,
    'must define isEditMode check function');
  assert.match(source, /detailEditMode/,
    'must check detailEditMode element');
  assert.match(source, /display\s*!==\s*['"]none['"]/,
    'must check display !== none');
  assert.match(source, /canEdit/,
    'must reference canEdit in createEditorCanvas scope');
  assert.match(source, /createEditorCanvasEdges/,
    'must pass isEditMode to edges factory');
});

// ── 5. Selection state: selectEdge and clearSelection ──────────────────────

test('selectEdge clears previous selection and adds class to matching path', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');

  assert.match(source, /function\s+selectEdge\s*\(/,
    'selectEdge function must exist');
  assert.match(source, /function\s+clearSelection\s*\(/,
    'clearSelection function must exist');
  assert.match(source, /function\s+getSelectedEdgeChildId\s*\(/,
    'getSelectedEdgeChildId function must exist');

  const selectBody = extractFunctionBody(source, 'selectEdge');
  assert.notEqual(selectBody, null, 'selectEdge function body must exist');
  assert.match(selectBody, /clearSelection\(\)/,
    'selectEdge must call clearSelection first');
  assert.match(selectBody, /is-selected/,
    'selectEdge must add is-selected class');

  const clearBody = extractFunctionBody(source, 'clearSelection');
  assert.notEqual(clearBody, null, 'clearSelection function body must exist');
  assert.match(clearBody, /is-selected/,
    'clearSelection must remove is-selected class');
  assert.match(clearBody, /classList\.remove/,
    'clearSelection must remove class via classList');
});

// ── 6. Disconnect button: shown on edge selection, hidden on clear ─────────

test('showEdgeDisconnectButton and hideEdgeDisconnectButton exist in canvas', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /function\s+showEdgeDisconnectButton\s*\(/,
    'showEdgeDisconnectButton helper must exist');
  assert.match(source, /function\s+hideEdgeDisconnectButton\s*\(/,
    'hideEdgeDisconnectButton helper must exist');
  assert.match(source, /function\s+clearEdgeSelection\s*\(/,
    'clearEdgeSelection helper must exist');
});

test('disconnectSelectedEdge confirms before calling updateMemory', () => {
  const source = readSource('js/editor/editor-canvas.js');
  const body = extractFunctionBody(source, 'disconnectSelectedEdge');

  assert.notEqual(body, null, 'disconnectSelectedEdge function must exist');
  assert.match(body, /canEdit\s*===\s*false/,
    'must guard against canEdit === false');
  assert.match(body, /window\.confirm\(/,
    'must call window.confirm before disconnecting');
  assert.match(body, /updateMemory/,
    'must call apiClient.updateMemory');
  assert.match(body, /parentId:\s*null/,
    'must set parentId to null (canonical root)');
  assert.match(body, /catch\s*\(/,
    'must handle errors');
  assert.match(body, /window\.alert\(/,
    'must show alert on failure');
});

// ── 7. Deselection on background click ──────────────────────────────────

test('background pointerdown handler clears edge selection', () => {
  const source = readSource('js/editor/editor-canvas.js');

  assert.match(source, /_edgeDeselectBound/,
    'must use a bound flag to prevent duplicate listeners');
  assert.match(source, /pointerdown/,
    'must listen for pointerdown events');
  assert.match(source, /memory-node/,
    'must skip deselection when clicking memory nodes');
  assert.match(source, /branch-line/,
    'must skip deselection when clicking branch lines');
  assert.match(source, /edge-disconnect-btn/,
    'must skip deselection when clicking disconnect button');
  assert.match(source, /clearEdgeSelection\(\)/,
    'must call clearEdgeSelection on background click');
});

// ── 8. View mode / canEdit === false fail-closed ──────────────────────────

test('edge click guard checks both canEdit and isEditMode', () => {
  const source = readSource('js/editor/editor-canvas-edges.js');
  const clickLineMatch = source.match(/addEventListener\s*\(\s*['"]click['"][\s\S]{0,600}\)/);

  assert.notEqual(clickLineMatch, null, 'click handler must exist');
  const clickHandler = clickLineMatch[0];

  assert.match(clickHandler, /canEdit\s*===\s*false/,
    'click handler must check canEdit');
  assert.match(clickHandler, /isEditMode/,
    'click handler must check isEditMode');
  assert.match(clickHandler, /onSelectEdge/,
    'click handler must call onSelectEdge callback');
});

// ── 9. No new API/network/fetch behavior ─────────────────────────────────

test('disconnectSelectedEdge only uses existing updateMemory, adds no new fetch/API', () => {
  const source = readSource('js/editor/editor-canvas.js');
  const body = extractFunctionBody(source, 'disconnectSelectedEdge');

  assert.notEqual(body, null, 'disconnectSelectedEdge function must exist');
  assert.doesNotMatch(body, /fetch\s*\(/,
    'must not add fetch calls');
  assert.doesNotMatch(body, /XMLHttpRequest/,
    'must not add XHR calls');
  assert.doesNotMatch(body, /axios/,
    'must not add axios calls');
  assert.match(body, /apiClient\.updateMemory/,
    'must reuse existing apiClient.updateMemory');
});

// ── 10. CSS: branch-line is clickable ───────────────────────────────────

test('CSS defines .branch-line with pointer-events: stroke and .is-selected', () => {
  const css = readSource('css/editor/editor-canvas.css');

  assert.match(css, /\.branch-line\s*\{/,
    'must have .branch-line CSS rule');
  assert.match(css, /pointer-events:\s*stroke/,
    'must set pointer-events to stroke for clickability');
  assert.match(css, /cursor:\s*pointer/,
    'must set cursor to pointer');
  assert.match(css, /\.branch-line\.is-selected/,
    'must have .is-selected style for selected edges');
  assert.match(css, /\.edge-disconnect-btn/,
    'must have .edge-disconnect-btn CSS rule');
});
