const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createHarness(overrides = {}) {
  const context = {
    URL,
    URLSearchParams,
    console: { ...console, error: () => {}, warn: () => {}, debug: () => {} },
    window: {
      location: { origin: 'https://lovebud.pages.dev' },
      apiClient: overrides.hasOwnProperty('apiClient') ? overrides.apiClient : {
        updateMemory: overrides.updateMemory || (async () => ({}))
      },
      LoveBudCache: { set: () => {} },
      LoveBudEditorInteractionMode: { isEditMode: () => true },
      LoveBudEditorMemoryFormTime: {
        parseTime: (str) => parseInt(str, 10) || null,
        validateEndTime: () => ({ ok: true, endSeconds: 20 })
      },
      __LOVEBUD_DIAGNOSTICS_ACTIVE__: true,
      __LOVEBUD_LAST_SAVE_DIAGNOSTIC__: null
    },
    document: {
      getElementById: (id) => {
        if (id === 'editSourceUrlInput') {
          return overrides.hasOwnProperty('sourceUrl') ? { value: overrides.sourceUrl } : null;
        }
        if (id === 'editTitleInput') return { value: overrides.title ?? 'Same Title' };
        if (id === 'editTagsInput') return { value: overrides.tags ?? 'tag1, tag2' };
        if (id === 'editMemoInput') return { value: overrides.memo ?? 'Same Memo', dataset: {}, addEventListener: () => {} };
        if (id === 'saveEditBtn') return overrides.saveEditBtn;
        return null;
      }
    }
  };
  vm.createContext(context);
  
  const utilsSource = fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8');
  vm.runInContext(utilsSource, context);
  
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
  vm.runInContext(source, context);

  const bindingsSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-bindings.js'), 'utf8');
  vm.runInContext(bindingsSource, context);

  let currentEditingMemory = overrides.currentEditingMemory !== undefined ? overrides.currentEditingMemory : { 
    id: 'memory-1', treeId: 'tree-1', 
    title: 'Same Title', memo: 'Same Memo', emotionTags: ['tag1', 'tag2'],
    sourceUrl: overrides.prevSourceUrl || 'https://youtube.com/watch?v=09876543210',
    sourceType: 'youtube_video',
    source: 'old'
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
    canEdit: true
  });

  return { actions, statuses, toasts, context };
}

test('production save button path calls saveMemoryEdit for existing moment edit', async () => {
  const listeners = {};
  const saveBtn = {
    dataset: {},
    addEventListener: (event, handler) => { listeners[event] = handler; }
  };
  const harness = createHarness({ saveEditBtn: saveBtn });
  
  // Call bindDetailActionButtons with saveMemoryEdit to simulate production hookup
  harness.context.window.LoveBudEditorBindings.bindDetailActionButtons({
    saveMemoryEdit: harness.actions.saveMemoryEdit
  });
  
  assert.ok(listeners.click, 'Click listener should be bound');
  
  // Simulate click
  await listeners.click();
  
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'SAVE_GUARD_NO_CHANGE', 'Diagnostic should reach NO_CHANGE if identical');
});

test('source-only edit can reach updateMemory', async () => {
  let callCount = 0;
  const harness = createHarness({
    sourceUrl: 'https://youtube.com/watch?v=12345678901',
    updateMemory: async (id, payload) => {
      callCount++;
      return { id, ...payload, sourceUrl: payload.sourceUrl || 'https://youtube.com/watch?v=12345678901' };
    }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 1, 'updateMemory should be called exactly once');
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'UPDATE_MEMORY_CALLED');
});

test('unchanged edit exits as manual_nochange', async () => {
  const harness = createHarness({
    sourceUrl: 'https://youtube.com/watch?v=09876543210'
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'SAVE_GUARD_NO_CHANGE');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_nochange');
});

test('missing current memory exits as manual_blocked', async () => {
  const harness = createHarness({
    currentEditingMemory: null
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'SAVE_GUARD_MISSING_MEMORY');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_blocked');
});

test('invalid source exits as manual_failed', async () => {
  const harness = createHarness({
    sourceUrl: 'https://not-youtube.com/video' // Invalid youtube
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'SAVE_GUARD_VALIDATION_FAILED');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_failed');
});

test('apiClient.updateMemory missing exits as typed API-unavailable failure', async () => {
  const harness = createHarness({
    sourceUrl: 'https://youtube.com/watch?v=12345678901',
    apiClient: null // explicit null to simulate missing API
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(harness.context.window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__, 'SAVE_API_UNAVAILABLE');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_failed');
});
