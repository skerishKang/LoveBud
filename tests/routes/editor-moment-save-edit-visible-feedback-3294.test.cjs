/**
 * Issue #3294 — Keep manual Save feedback visible during moment-edit form.
 *
 * Loads the real editor-memory-actions / editor-bindings / editor-save-status /
 * editor-save-status-orchestration modules against a minimal fake-DOM harness
 * (jsdom is not a dependency of this repo) and proves that:
 *   - the real Save-button binding invokes the real save action;
 *   - an unchanged Save makes zero updateMemory calls;
 *   - the edit form remains open;
 *   - the shared save-status indicator (mounted outside both mode containers)
 *     is shown with display:flex and reads '변경된 내용이 없어요';
 *   - the resulting state is manual_nochange;
 *   - there is exactly one status-indicator ID in the document.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const SAVE_STATUS_JS = fs.readFileSync(path.join(ROOT, 'js/editor/editor-save-status.js'), 'utf8');
const SAVE_STATUS_ORCHESTRATION_JS = fs.readFileSync(path.join(ROOT, 'js/editor/editor-save-status-orchestration.js'), 'utf8');
const MEMORY_ACTIONS_JS = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
const BINDINGS_JS = fs.readFileSync(path.join(ROOT, 'js/editor/editor-bindings.js'), 'utf8');

// ── Minimal fake-DOM ────────────────────────────────────────────────────────
// Supports only what the four real modules touch: getElementById, addEventListener,
// dataset, style, classList, textContent, attributes, querySelectorAll, closest.

function makeElement(tag, id) {
  const el = {
    tagName: tag,
    id: id || '',
    _children: [],
    dataset: {},
    style: {},
    _attrs: {},
    _listeners: {},
    textContent: '',
    className: '',
    disabled: false,
    parentNode: null,
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) { if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); } else if (force) { this._set.add(c); } else { this._set.delete(c); } }
    },
    setAttribute(name, value) { this._attrs[name] = String(value); if (name === 'id') this.id = String(value); },
    getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; },
    removeAttribute(name) { delete this._attrs[name]; },
    addEventListener(type, handler) {
      (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    click() {
      (this._listeners.click || []).forEach((h) => h({ preventDefault() {}, stopPropagation() {}, target: this }));
    },
    closest() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) { child.parentNode = this; this._children.push(child); return child; },
    insertBefore(node, ref) { node.parentNode = this; const i = this._children.indexOf(ref); if (i < 0) this._children.push(node); else this._children.splice(i, 0, node); return node; },
    insertAdjacentHTML() {},
  };
  return el;
}

function makeIndicator(register) {
  const card = makeElement('div', 'saveStatusCard');
  card.className = 'editor-save-status-card';
  const indicator = makeElement('div', 'saveStatusIndicator');
  indicator.className = 'save-status-indicator save-status editor-save-status-wrap';
  indicator.setAttribute('aria-live', 'polite');
  const icon = makeElement('span', 'saveStatusIcon');
  const text = makeElement('span', 'saveStatusText');
  text.textContent = '저장됨';
  const time = makeElement('span', 'lastSavedTime');
  indicator.appendChild(icon);
  indicator.appendChild(text);
  indicator.appendChild(time);
  indicator.style.display = 'none';
  card.appendChild(indicator);
  // Register every id the state-machine / orchestration modules look up by id.
  register(card);
  register(indicator);
  register(icon);
  register(text);
  register(time);
  return { card, indicator, icon, text, time };
}

function buildHarness() {
  const elements = {};

  function register(el) { if (el.id) elements[el.id] = el; return el; }

  const detailViewMode = register(makeElement('div', 'detailViewMode'));
  detailViewMode.style.display = 'none';

  const detailEditMode = register(makeElement('div', 'detailEditMode'));
  detailEditMode.style.display = 'block';

  const detailPanel = register(makeElement('aside', 'detailPanel'));
  detailPanel.appendChild(detailViewMode);
  detailPanel.appendChild(detailEditMode);

  // Save-status indicator is a SIBLING outside both mode containers.
  const status = makeIndicator(register);
  const statusCard = status.card;
  detailPanel.appendChild(statusCard);

  register(makeElement('button', 'editMemoryBtn'));
  const saveEditBtn = register(makeElement('button', 'saveEditBtn'));
  register(makeElement('button', 'cancelEditBtn'));
  register(makeElement('button', 'deleteMemoryBtn'));
  const editTitleInput = register(makeElement('input', 'editTitleInput'));
  const editMemoInput = register(makeElement('textarea', 'editMemoInput'));
  const editTagsInput = register(makeElement('input', 'editTagsInput'));
  editTitleInput.value = 'Before';
  editMemoInput.value = 'before';
  editTagsInput.value = 'a, b';

  const documentRef = {
    getElementById: (id) => elements[id] || null,
    documentElement: makeElement('html', ''),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  return {
    elements,
    detailViewMode,
    detailEditMode,
    detailPanel,
    status,
    saveEditBtn,
    editTitleInput,
    editMemoInput,
    editTagsInput,
    documentRef
  };
}

function createSandbox(harness, overrides = {}) {
  const updateMemoryCalls = [];

  const apiClient = {
    updateMemory: overrides.updateMemory || (async (memoryId, payload) => {
      updateMemoryCalls.push({ memoryId, payload });
      return { id: memoryId, ...payload, updatedAt: 'server-time' };
    })
  };

  const windowObj = {
    apiClient,
    LoveBudCache: { set: () => {} },
    LoveBudMedia: {}
  };

  const sandbox = {
    console: { ...console, error: () => {}, warn: () => {} },
    window: windowObj,
    document: harness.documentRef,
    setTimeout: (fn) => { /* do not auto-fire hide timer in this harness */ return 0; },
    clearTimeout: () => {},
    Date,
    Math
  };
  vm.createContext(sandbox);

  // Load state machine + orchestration first (they attach to window).
  vm.runInContext(SAVE_STATUS_JS, sandbox);
  vm.runInContext(SAVE_STATUS_ORCHESTRATION_JS, sandbox);

  const orchestration = windowObj.LoveBudEditorSaveStatusOrchestration
    .createEditorSaveStatusOrchestration({
      editorSaveStatus: windowObj.LoveBudEditorSaveStatus,
      i18n: (key) => key,
      formatTimeAgo: (date) => '방금'
    });

  // Load memory-actions + bindings (they read window globals at call time).
  vm.runInContext(MEMORY_ACTIONS_JS, sandbox);
  vm.runInContext(BINDINGS_JS, sandbox);

  const currentEditingMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: 'Before',
    memo: 'before',
    emotionTags: ['a', 'b'],
    sourceUrl: ''
  };
  let treeMemories = [{ ...currentEditingMemory, emotionTags: ['a', 'b'] }];
  const currentTreeData = { id: 'tree-1', memories: [{ ...currentEditingMemory, emotionTags: ['a', 'b'] }] };

  const actions = windowObj.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: orchestration.updateSaveStatus,
    updateDetailPanel: () => {},
    updateSidebarStatus: () => {},
    showToast: () => {},
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (v) => { Object.assign(currentEditingMemory, v); },
    getTreeMemories: () => treeMemories,
    setTreeMemories: (v) => { treeMemories = v; },
    getSelectedNodeId: () => 'memory-1',
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'root',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: harness.detailPanel,
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => {},
    getCurrentTreeData: () => currentTreeData,
    isLocalSaveMode: () => false,
    canEdit: true,
    reportSaveOutcome: () => {}
  });

  // Interaction mode helper (always edit mode) so save/bind logic proceeds.
  windowObj.LoveBudEditorInteractionMode = {
    MODE_EDIT: 'edit',
    MODE_VIEW: 'view',
    _mode: 'edit',
    isEditMode() { return this._mode === 'edit'; },
    setMode(m) { this._mode = m; },
    subscribe() {}
  };

  windowObj.LoveBudEditorBindings.bindDetailActionButtons({
    enterEditMode: actions.enterEditMode,
    deleteMemory: actions.deleteMemory,
    exitEditMode: actions.exitEditMode,
    saveMemoryEdit: actions.saveMemoryEdit
  });

  return { sandbox, windowObj, actions, orchestration, updateMemoryCalls };
}

test('editing an unchanged moment shows visible manual_nochange feedback and keeps the form open', async () => {
  const harness = buildHarness();
  const { actions, orchestration, updateMemoryCalls } = createSandbox(harness);

  // Enter edit mode (simulates user clicking edit, then filling identical values).
  actions.enterEditMode();
  harness.editTitleInput.value = 'Before';
  harness.editMemoInput.value = 'before';
  harness.editTagsInput.value = 'a, b';

  assert.equal(harness.detailEditMode.style.display, 'block', 'edit form should be open after enterEditMode');
  assert.equal(harness.detailViewMode.style.display, 'none', 'view mode should be hidden while editing');

  // Click the real Save button bound by the real editor-bindings module.
  harness.saveEditBtn.click();
  await Promise.resolve();

  // Unchanged save must NOT call updateMemory.
  assert.equal(updateMemoryCalls.length, 0, 'unchanged Save must make zero updateMemory calls');

  // Form remains open.
  assert.equal(harness.detailEditMode.style.display, 'block', 'edit form must remain open after no-change save');

  // Indicator is visible and sibling of the hidden view container.
  const indicator = harness.status.indicator;
  const visible = indicator.style.display === 'flex' || indicator.style.display === 'block';
  assert.ok(visible, 'shared save-status indicator must be visible (display:flex) while editing');
  assert.equal(indicator.textContent, '', 'raw indicator textContent is cleared by module; readable text is in saveStatusText child');
  assert.equal(harness.status.text.textContent, '변경된 내용이 없어요', 'visible indicator text must read 변경된 내용이 없어요');
  assert.equal(indicator.className.includes('nochange-manual'), true, 'indicator must carry nochange-manual class');

  // State machine reports manual_nochange.
  const state = orchestration.saveStatusData;
  assert.equal(state.phase, 'nochange', 'state phase must be nochange');
  assert.equal(state.type, 'manual', 'state type must be manual');

  // Exactly one status indicator id exists in the harness document.
  const indicatorIds = Object.keys(harness.elements).filter((k) => k === 'saveStatusIndicator');
  assert.equal(indicatorIds.length, 1, 'exactly one saveStatusIndicator id must exist');
});
