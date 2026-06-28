const assert = require('node:assert/strict');
const test = require('node:test');

// ---------------------------------------------------------------------------
// Helper: minimal fake DOM element (style + classList + querySelectorAll)
// ---------------------------------------------------------------------------
function fakeElement(overrides = {}) {
  const classList = new Set();
  return {
    style: {},
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c),
    },
    /** @type {Map<string, fakeElement>} */
    _children: new Map(),
    /** @type {string|null} */
    _dataMemoryId: null,
    dataset: {},
    _allMemoryNodes: function () {
      var result = [];
      if (this._dataMemoryId !== null) result.push(this);
      for (const el of this._children.values()) {
        if (el._dataMemoryId !== null) result.push(el);
      }
      return result;
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: minimal fake document (supports querySelectorAll for collection lookup)
// ---------------------------------------------------------------------------
function fakeDocument() {
  const elements = new Map();
  function allMemoryNodes() {
    var result = [];
    for (const el of elements.values()) {
      if (el._dataMemoryId !== null) result.push(el);
    }
    return result;
  }
  return {
    _set(id, el) { elements.set(id, el); },
    querySelectorAll: function (sel) {
      if (sel === '.memory-node') {
        var items = allMemoryNodes();
        return Object.assign([], items, { length: items.length });
      }
      return [];
    },
    getElementById: function (id) { return elements.get(id) || null; }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('hasExceededNodeDragThreshold — pure threshold check', async () => {
  const { hasExceededNodeDragThreshold } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  // zero offset → false
  assert.equal(hasExceededNodeDragThreshold(0, 0), false);

  // equal to threshold (6) → false (not exceeded)
  assert.equal(hasExceededNodeDragThreshold(6, 0), false);
  assert.equal(hasExceededNodeDragThreshold(0, 6), false);
  assert.equal(hasExceededNodeDragThreshold(-6, 0), false);
  assert.equal(hasExceededNodeDragThreshold(0, -6), false);

  // exceeds threshold → true
  assert.equal(hasExceededNodeDragThreshold(7, 0), true);
  assert.equal(hasExceededNodeDragThreshold(0, 7), true);
  assert.equal(hasExceededNodeDragThreshold(-7, 0), true);
  assert.equal(hasExceededNodeDragThreshold(0, -7), true);

  // custom threshold
  assert.equal(hasExceededNodeDragThreshold(10, 0, 10), false);
  assert.equal(hasExceededNodeDragThreshold(11, 0, 10), true);
});

test('resetCanvasPanUI — resets panning class and cursor', async () => {
  const { resetCanvasPanUI } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  // structured layout → cursor default
  const el1 = fakeElement();
  el1.classList.add('panning');
  resetCanvasPanUI(el1, 'structured');
  assert.equal(el1.classList.contains('panning'), false);
  assert.equal(el1.style.cursor, 'default');

  // free layout → cursor grab
  const el2 = fakeElement();
  el2.classList.add('panning');
  resetCanvasPanUI(el2, 'free');
  assert.equal(el2.classList.contains('panning'), false);
  assert.equal(el2.style.cursor, 'grab');

  // unknown layout → cursor grab (fallback)
  const el3 = fakeElement();
  el3.classList.add('panning');
  resetCanvasPanUI(el3, 'compact');
  assert.equal(el3.style.cursor, 'grab');

  // null canvas → no throw
  resetCanvasPanUI(null, 'structured');
});

test('updateCanvasPanBackgroundPosition — sets backgroundPosition style', async () => {
  const { updateCanvasPanBackgroundPosition } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  const el = fakeElement();
  updateCanvasPanBackgroundPosition(el, 12, -8);
  assert.equal(el.style.backgroundPosition, '12px -8px');

  // zero values
  updateCanvasPanBackgroundPosition(el, 0, 0);
  assert.equal(el.style.backgroundPosition, '0px 0px');

  // negative values
  updateCanvasPanBackgroundPosition(el, -50, 100);
  assert.equal(el.style.backgroundPosition, '-50px 100px');

  // null canvas → no throw
  updateCanvasPanBackgroundPosition(null, 0, 0);
});

test('resetDraggedNodeCursor — resets cursor of dragged node', async () => {
  const { resetDraggedNodeCursor } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  // existing node → cursor set to grab + element returned
  const doc = fakeDocument();
  const node = fakeElement({ _dataMemoryId: 'abc', style: { cursor: 'grabbing' } });
  node.dataset.memoryId = 'abc';
  doc._set('node-abc', node);

  const result = resetDraggedNodeCursor(doc, 'abc');
  assert.equal(result, node);
  assert.equal(node.style.cursor, 'grab');

  // non-existing id → null returned
  const result2 = resetDraggedNodeCursor(doc, 'nonexistent');
  assert.equal(result2, null);

  // null documentRef → no throw, null returned
  const result3 = resetDraggedNodeCursor(null, 'abc');
  assert.equal(result3, null);

  // null draggedId → no throw, null returned
  const result4 = resetDraggedNodeCursor(doc, null);
  assert.equal(result4, null);
});

test('showMovedToast — displays movedToast and hides on timeout', async () => {
  const { showMovedToast } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  // with #movedToast present → display becomes 'block'
  const toast = fakeElement();
  const doc = fakeDocument();
  doc._set('movedToast', toast);
  const origGetElementById = globalThis.document?.getElementById;
  globalThis.document = { getElementById: (id) => doc.getElementById(id) };

  showMovedToast();
  assert.equal(toast.style.display, 'block');

  // #movedToast absent → no throw
  const doc2 = fakeDocument();
  globalThis.document = { getElementById: (id) => doc2.getElementById(id) };
  showMovedToast();

  // restore
  if (origGetElementById) {
    globalThis.document = { getElementById: origGetElementById };
  } else {
    delete globalThis.document;
  }
});

test('updateLayoutToggleUI falls back when i18n returns raw layout key', async () => {
  const { updateLayoutToggleUI } = await import('../../js/editor/editor-canvas-ui-helpers.js');
  const toggleBtn = fakeElement();
  toggleBtn.classList.toggle = (name, force) => {
    if (force) toggleBtn.classList.add(name);
    else toggleBtn.classList.remove(name);
  };
  const toggleLabel = { textContent: '' };
  const toggleIcon = { textContent: '' };
  const doc = fakeDocument();
  doc._set('layoutModeToggleBtn', toggleBtn);
  doc._set('layoutModeToggleLabel', toggleLabel);
  doc._set('layoutModeToggleIcon', toggleIcon);
  const originalDocument = globalThis.document;
  globalThis.document = doc;

  updateLayoutToggleUI('free', (key) => key);
  assert.equal(toggleLabel.textContent, '자유 배치');
  assert.equal(toggleIcon.textContent, 'auto_awesome');

  updateLayoutToggleUI('structured', (key) => key);
  assert.equal(toggleLabel.textContent, '정리된 트리');
  assert.equal(toggleIcon.textContent, 'account_tree');

  if (originalDocument) {
    globalThis.document = originalDocument;
  } else {
    delete globalThis.document;
  }
});
