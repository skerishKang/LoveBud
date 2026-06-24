const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

function getBindNodeDragBlock() {
  const start = indexOfRequired(canvasSource, 'function bindNodeDrag(nodeEl, mem) {');
  const end = indexOfRequired(canvasSource.slice(start), '\n    function createNodeElement(mem, pos) {');
  return canvasSource.slice(start, start + end);
}

const bindNodeDragBlock = getBindNodeDragBlock();

test('editor canvas node drag delegation — bindNodeDrag prefers primary interaction runtime', () => {
  const guardOpen = indexOfRequired(bindNodeDragBlock, "if (typeof canvasInteraction.beginNodeDrag === 'function') {");
  const modeGuard = indexOfRequired(bindNodeDragBlock, "if (mode && !mode.isEditMode()) return;");
  const callIndex = indexOfRequired(bindNodeDragBlock, 'canvasInteraction.beginNodeDrag(e, nodeEl, mem, viewportState, getWorldPosition, canEdit);');
  assert.ok(guardOpen < modeGuard, 'guardOpen must precede modeGuard');
  assert.ok(modeGuard < callIndex, 'modeGuard must precede call');
});

test('editor canvas node drag delegation — local fallback is removed after primary delegation', () => {
  for (const fallbackLine of [
    'if (e.button !== 0) return;',
    "if (e.target.closest('button')) return;",
    'e.preventDefault();',
    'e.stopPropagation();',
    'const startWorld = getWorldPosition(mem);',
    'viewportState.isDraggingNode = true;',
    'viewportState.dragNodeId = mem.id;',
    'viewportState.dragStartClientX = e.clientX;',
    'viewportState.dragStartClientY = e.clientY;',
    'viewportState.dragStartWorldX = startWorld.x;',
    'viewportState.dragStartWorldY = startWorld.y;',
    'viewportState.dragMoved = false;',
    "nodeEl.style.cursor = 'grabbing';"
  ]) {
    assert.doesNotMatch(bindNodeDragBlock, new RegExp(fallbackLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas node drag delegation — primary runtime contract remains linked', () => {
  const runtimeContract = fs.readFileSync('tests/contracts/editor-canvas-interaction-runtime-contract.test.cjs', 'utf8');

  assert.match(runtimeContract, /beginNodeDrag guards structured and read-only states/);
  assert.match(runtimeContract, /beginNodeDrag guards non-left mouse and button targets/);
  assert.match(runtimeContract, /beginNodeDrag initializes drag state for valid drag/);
});
