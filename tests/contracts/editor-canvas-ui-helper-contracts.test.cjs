const assert = require('node:assert/strict');
const test = require('node:test');

// ---------------------------------------------------------------------------
// Helper: minimal fake DOM element (style + classList + querySelectorAll)
// ---------------------------------------------------------------------------
function fakeElement(overrides = {}) {
  const classList = new Set();
  const listeners = new Map();
  return {
    style: {},
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          const exists = classList.has(c);
          if (exists) classList.delete(c); else classList.add(c);
          return !exists;
        }
        if (force) classList.add(c); else classList.delete(c);
        return classList.has(c);
      },
    },
    setAttribute: function(name, val) { this._attrs = this._attrs || {}; this._attrs[name] = val; },
    getAttribute: function(name) { return this._attrs ? this._attrs[name] : null; },
    addEventListener: function(event, cb) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
    },
    dispatchEvent: function(event) {
      const callbacks = listeners.get(event);
      if (callbacks) callbacks.forEach(cb => cb());
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

test('updateLayoutToggleUI — synchronizes visual and a11y states', async () => {
  const { updateLayoutToggleUI } = await import('../../js/editor/editor-canvas-ui-helpers.js');
  const toggleBtn = fakeElement();
  const toggleLabel = { textContent: '' };
  const toggleIcon = { textContent: '' };
  const doc = fakeDocument();
  doc._set('layoutModeToggleBtn', toggleBtn);
  doc._set('layoutModeToggleLabel', toggleLabel);
  doc._set('layoutModeToggleIcon', toggleIcon);
  const originalDocument = globalThis.document;
  globalThis.document = doc;

  // structured layout
  updateLayoutToggleUI('structured', (k) => k);
  assert.equal(toggleBtn.classList.contains('is-active'), true);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 정리된 트리, 자유 배치로 전환');
  assert.equal(toggleBtn.getAttribute('title'), '현재 정리된 트리, 자유 배치로 전환');
  assert.equal(toggleLabel.textContent, '정리된 트리');
  assert.equal(toggleIcon.textContent, 'account_tree');

  // free layout
  updateLayoutToggleUI('free', (k) => k);
  assert.equal(toggleBtn.classList.contains('is-active'), false);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 자유 배치, 정리된 트리로 전환');
  assert.equal(toggleBtn.getAttribute('title'), '현재 자유 배치, 정리된 트리로 전환');
  assert.equal(toggleLabel.textContent, '자유 배치');
  assert.equal(toggleIcon.textContent, 'auto_awesome');

  if (originalDocument) {
    globalThis.document = originalDocument;
  } else {
    delete globalThis.document;
  }
});

test('updateCompactToggleUI — synchronizes visual and a11y states', async () => {
  const { updateCompactToggleUI } = await import('../../js/editor/editor-canvas-ui-helpers.js');
  const toggleBtn = fakeElement();
  const toggleLabel = { textContent: '' };
  const icon = fakeElement();
  toggleBtn._children.set('icon', icon);
  toggleBtn.querySelector = (sel) => (sel === '.material-symbols-outlined' ? icon : null);
  const doc = fakeDocument();
  doc._set('compactModeToggleBtn', toggleBtn);
  doc._set('compactModeToggleLabel', toggleLabel);
  const originalDocument = globalThis.document;
  globalThis.document = doc;

  // compact mode active
  updateCompactToggleUI(true, (k) => k);
  assert.equal(toggleBtn.classList.contains('is-active'), true);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 간략 보기, 상세 보기로 전환');
  assert.equal(toggleBtn.getAttribute('title'), '현재 간략 보기, 상세 보기로 전환');
  assert.equal(toggleLabel.textContent, '간략 보기');
  assert.equal(icon.textContent, 'unfold_less');

  // compact mode inactive (detailed)
  updateCompactToggleUI(false, (k) => k);
  assert.equal(toggleBtn.classList.contains('is-active'), false);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 상세 보기, 간략 보기로 전환');
  assert.equal(toggleBtn.getAttribute('title'), '현재 상세 보기, 간략 보기로 전환');
  assert.equal(toggleLabel.textContent, '상세 보기');
  assert.equal(icon.textContent, 'unfold_more');

  if (originalDocument) {
    globalThis.document = originalDocument;
  } else {
    delete globalThis.document;
  }
});

test('bindCompactModeToggle — restores state, prevents double bind and handles click', async () => {
  const { bindCompactModeToggle } = await import('../../js/editor/editor-canvas-ui-helpers.js');

  const toggleBtn = fakeElement();
  const toolbar = fakeElement();
  const icon = fakeElement();
  toggleBtn.querySelector = (sel) => (sel === '.material-symbols-outlined' ? icon : null);

  const doc = fakeDocument();
  doc._set('compactModeToggleBtn', toggleBtn);
  doc._set('compactModeToggleLabel', { textContent: '' });

  const originalDocument = globalThis.document;
  globalThis.document = {
    ...doc,
    querySelector: (sel) => (sel === '.editor-canvas-toolbar' ? toolbar : null)
  };
  globalThis.window = globalThis;

  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, v),
  };

  // 1. Restore compact = true
  storage.set('lovebud_toolbar_compact', 'true');
  bindCompactModeToggle();
  assert.equal(toolbar.classList.contains('is-compact'), true);
  assert.equal(toggleBtn.classList.contains('is-active'), true);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 간략 보기, 상세 보기로 전환');
  assert.equal(icon.textContent, 'unfold_less');

  // 2. Prevent double bind
  bindCompactModeToggle();
  assert.equal(toggleBtn.dataset.compactBound, '1');

  // 3. Test click behavior
  // Trigger the click event
  toggleBtn.dispatchEvent('click');

  assert.equal(toolbar.classList.contains('is-compact'), false);
  assert.equal(toggleBtn.classList.contains('is-active'), false);
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(toggleBtn.getAttribute('aria-label'), '현재 상세 보기, 간략 보기로 전환');
  assert.equal(storage.get('lovebud_toolbar_compact'), 'false');
  assert.equal(icon.textContent, 'unfold_more');

  if (originalDocument) {
    globalThis.document = originalDocument;
  } else {
    delete globalThis.document;
  }
});

