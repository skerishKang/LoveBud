const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createHarness(overrides = {}) {
  const makeFakeElement = (id, tagName = 'div') => {
    let internalVal = '';
    const el = {
      id,
      tagName: String(tagName).toUpperCase(),
      disabled: false,
      get value() { return internalVal; },
      set value(v) { internalVal = v; },
      textContent: id === 'saveEditBtn' ? '저장' : '',
      dataset: {},
      _listeners: {},
      addEventListener(eventName, handler) {
        this._listeners[eventName] = this._listeners[eventName] || [];
        this._listeners[eventName].push(handler);
      },
      dispatchEvent(event) {
        const handlers = this._listeners[event.type] || [];
        handlers.forEach((handler) => handler(event));
      },
      closest() { return el; },
      classList: {
        remove: () => {},
        add: () => {}
      },
      setAttribute: () => {},
      removeAttribute: () => {},
      querySelector() { return null; },
      style: {}
    };
    return el;
  };

  const elements = {
    detailPanel: makeFakeElement('detailPanel', 'div'),
    detailViewMode: makeFakeElement('detailViewMode', 'div'),
    detailEditMode: makeFakeElement('detailEditMode', 'div'),
    editMemoryBtn: makeFakeElement('editMemoryBtn', 'button'),
    deleteMemoryBtn: makeFakeElement('deleteMemoryBtn', 'button'),
    cancelEditBtn: makeFakeElement('cancelEditBtn', 'button'),
    saveEditBtn: overrides.saveEditBtn || makeFakeElement('saveEditBtn', 'button'),
    editTitleInput: makeFakeElement('editTitleInput', 'input'),
    editMemoInput: makeFakeElement('editMemoInput', 'textarea'),
    editTagsInput: makeFakeElement('editTagsInput', 'input'),
    editorCanvas: makeFakeElement('editorCanvas', 'div')
  };

  // Populate form with unchanged values initially
  elements.editTitleInput.value = 'Same Title';
  elements.editTagsInput.value = 'tag1, tag2';
  elements.editMemoInput.value = 'Same Memo';

  const context = {
    URL,
    URLSearchParams,
    console: { ...console, error: () => {}, warn: () => {}, debug: () => {} },
    window: {
      location: { origin: 'https://lovebud.pages.dev' },
      apiClient: {
        updateMemory: async () => {
          context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__ = 'UPDATE_MEMORY_CALLED';
          return {};
        }
      },
      LoveBudCache: { set: () => {} },
      LoveBudEditorInteractionMode: {
        isEditMode: () => true
      },
      LoveBudEditorMemoryFormTime: {
        parseTime: (str) => parseInt(str, 10) || null,
        validateEndTime: () => ({ ok: true, endSeconds: 20 })
      },
      __LOVEBUD_DIAGNOSTICS_ACTIVE__: true
    },
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => makeFakeElement('new_elem', tag),
      addEventListener: () => {}
    },
    MutationObserver: function() {
      this.observe = () => {};
      this.disconnect = () => {};
    }
  };

  const diagnostics = [];
  Object.defineProperty(context.window, '__LOVEBUD_LAST_SAVE_DIAGNOSTIC__', {
    set(val) { if (val) diagnostics.push(val); },
    get() { return diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null; }
  });

  vm.createContext(context);

  const utilsSource = fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8');
  vm.runInContext(utilsSource, context);

  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
  vm.runInContext(source, context);

  const bindingsSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-bindings.js'), 'utf8');
  vm.runInContext(bindingsSource, context);

  let currentEditingMemory = {
    id: 'memory-1', treeId: 'tree-1',
    title: 'Same Title', memo: 'Same Memo', emotionTags: ['tag1', 'tag2'],
    sourceUrl: 'opaque-source://fixture-a',
    sourceType: 'opaque_fixture',
    source: 'opaque-source-handle-a'
  };

  const statuses = [];
  const toasts = [];
  const actions = context.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: (status) => statuses.push(status),
    updateDetailPanel: () => {},
    updateSidebarStatus: () => {},
    showToast: (msg, type) => toasts.push({ msg, type }),
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: () => {},
    getTreeMemories: () => currentEditingMemory ? [currentEditingMemory] : [],
    setTreeMemories: () => {},
    getSelectedNodeId: () => currentEditingMemory ? currentEditingMemory.id : null,
    getCanonicalRootId: () => currentEditingMemory ? currentEditingMemory.id : null,
    isRootMemory: () => false,
    findRootMemory: () => null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => {},
    getCurrentTreeData: () => ({ id: 'tree-1', memories: currentEditingMemory ? [currentEditingMemory] : [] }),
    isLocalSaveMode: () => false,
    buildActionUrl: () => 'https://lovebud.pages.dev/api/memory/update'
  });

  return { context, elements, actions, statuses, toasts, bindings: context.window.LoveBudEditorBindings, diagnostics };
}

test('visible existing-moment edit save click reaches SAVE_CLICK_RECEIVED and triggers saveMemoryEdit (#3327)', async () => {
  const harness = createHarness();

  // Track saveMemoryEdit wrapper
  let originalSaveMemoryEdit = harness.actions.saveMemoryEdit;
  let saveMemoryEditCount = 0;
  harness.actions.saveMemoryEdit = async () => {
    saveMemoryEditCount++;
    return originalSaveMemoryEdit();
  };

  harness.bindings.bindDetailActionButtons({
    enterEditMode: harness.actions.enterEditMode,
    deleteMemory: harness.actions.deleteMemory,
    exitEditMode: harness.actions.exitEditMode,
    saveMemoryEdit: harness.actions.saveMemoryEdit,
    canEdit: true
  });

  // Test 1: Unchanged edit reaches SAVE_GUARD_NO_CHANGE
  harness.diagnostics.length = 0;
  harness.elements.saveEditBtn.dispatchEvent({ type: 'click' });

  // click is synchronous, saveMemoryEdit is async, but the click listener is sync and sets SAVE_CLICK_RECEIVED,
  // then calls saveMemoryEdit. saveMemoryEdit is synchronous up to the NO_CHANGE guard.
  assert.equal(saveMemoryEditCount, 1, 'saveMemoryEdit must be called exactly once');

  // Verify the sequence: SAVE_CLICK_RECEIVED -> SAVE_GUARD_NO_CHANGE
  assert.deepEqual(harness.diagnostics, ['SAVE_CLICK_RECEIVED', 'SAVE_HANDLER_ENTERED', 'SAVE_GUARD_NO_CHANGE'], 'Sequence must include SAVE_CLICK_RECEIVED directly from the click handler');

  // Test 2: Title-edit update reaches UPDATE_MEMORY_CALLED
  harness.diagnostics.length = 0;
  // Make a change
  harness.elements.editTitleInput.value = 'Changed Title';
  harness.elements.saveEditBtn.dispatchEvent({ type: 'click' });

  assert.equal(saveMemoryEditCount, 2, 'saveMemoryEdit called again');

  // Need to wait a tick for the async fetch simulation
  await new Promise(r => setTimeout(r, 0));

  // Verify the sequence: SAVE_CLICK_RECEIVED -> SAVE_REQUEST_EMITTED -> UPDATE_MEMORY_CALLED
  assert.ok(harness.diagnostics.includes('SAVE_CLICK_RECEIVED'), 'Sequence must include SAVE_CLICK_RECEIVED');
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'UPDATE_MEMORY_CALLED');

  // Test 3: Duplicate binding should not duplicate calls
  harness.bindings.bindDetailActionButtons({
    enterEditMode: harness.actions.enterEditMode,
    deleteMemory: harness.actions.deleteMemory,
    exitEditMode: harness.actions.exitEditMode,
    saveMemoryEdit: harness.actions.saveMemoryEdit,
    canEdit: true
  });

  harness.diagnostics.length = 0;
  harness.elements.saveEditBtn.dispatchEvent({ type: 'click' });
  assert.equal(saveMemoryEditCount, 3, 'saveMemoryEdit should not double fire (duplicate bindings prevented)');

  // Test 4: Cancel/delete/edit bindings are maintained
  assert.ok(harness.elements.cancelEditBtn.dataset.cancelBound === '1', 'cancel binding preserved');
  assert.ok(harness.elements.deleteMemoryBtn.dataset.deleteBound === '1', 'delete binding preserved');
  assert.ok(harness.elements.editMemoryBtn.dataset.editBound === '1', 'edit binding preserved');
});
