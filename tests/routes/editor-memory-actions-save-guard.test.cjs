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
    console: { ...console, error: () => {} },
    window: {
      location: { origin: 'https://lovebud.pages.dev' },
      apiClient: {
        updateMemory: overrides.updateMemory || (async () => ({}))
      },
      LoveBudCache: { set: () => {} },
      LoveBudEditorInteractionMode: { isEditMode: () => true },
      LoveBudEditorMemoryFormTime: {
        parseTime: (str) => parseInt(str, 10) || null,
        validateEndTime: () => ({ ok: true, endSeconds: 20 })
      }
    },
    document: {
      getElementById: (id) => {
        if (id === 'editSourceUrlInput') {
          return overrides.hasOwnProperty('sourceUrl') ? { value: overrides.sourceUrl } : null;
        }
        if (id === 'editTitleInput') return { value: overrides.title ?? 'Same Title' };
        if (id === 'editMemoInput') return { value: overrides.memo ?? 'Same Memo' };
        if (id === 'editTagsInput') return { value: overrides.tags ?? 'tag1, tag2' };
        return null;
      }
    }
  };
  vm.createContext(context);
  
  const utilsSource = fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8');
  vm.runInContext(utilsSource, context);
  
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
  vm.runInContext(source, context);

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
    isLocalSaveMode: () => false
  });

  return { actions, statuses, toasts, context };
}

test('source-only edit reaches updateMemory', async () => {
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
});

test('unchanged form returns no_change', async () => {
  let callCount = 0;
  const harness = createHarness({
    sourceUrl: 'https://youtube.com/watch?v=09876543210',
    updateMemory: async () => { callCount++; return {}; }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 0, 'updateMemory should not be called');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_nochange');
});

test('missing current memory returns error', async () => {
  let callCount = 0;
  const harness = createHarness({
    currentEditingMemory: null,
    updateMemory: async () => { callCount++; return {}; }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 0, 'updateMemory should not be called');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_blocked');
});

test('validation failure returns error', async () => {
  let callCount = 0;
  const harness = createHarness({
    sourceUrl: 'https://not-youtube.com/video', // Invalid youtube
    updateMemory: async () => { callCount++; return {}; }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 0, 'updateMemory should not be called');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_failed');
});

test('source + title edit reaches updateMemory', async () => {
  let callCount = 0;
  const harness = createHarness({
    sourceUrl: 'https://youtube.com/watch?v=12345678901',
    title: 'New Title',
    updateMemory: async (id, payload) => {
      callCount++;
      assert.equal(payload.title, 'New Title');
      return { id, ...payload, sourceUrl: payload.sourceUrl || 'https://youtube.com/watch?v=12345678901' };
    }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 1, 'updateMemory should be called exactly once');
});

test('changing youtube url format but same videoId returns no_change', async () => {
  let callCount = 0;
  const harness = createHarness({
    prevSourceUrl: 'https://www.youtube.com/watch?v=v9D8D3YgIUE',
    sourceUrl: 'https://youtu.be/v9D8D3YgIUE',
    updateMemory: async () => { callCount++; return {}; }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 0, 'updateMemory should not be called');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_nochange');
});

test('missing editSourceUrlInput falls back to prevSourceUrl and returns no_change', async () => {
  let callCount = 0;
  const harness = createHarness({
    prevSourceUrl: 'https://www.youtube.com/watch?v=v9D8D3YgIUE',
    // Omit sourceUrl to simulate missing DOM node
    updateMemory: async () => { callCount++; return {}; }
  });

  // Force document.getElementById to return null for editSourceUrlInput
  const originalGetElementById = harness.context.document.getElementById;
  harness.context.document.getElementById = (id) => {
    if (id === 'editSourceUrlInput') return null;
    return originalGetElementById(id);
  };

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 0, 'updateMemory should not be called');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_nochange');
});
test('adding start time in URL but leaving time input empty SHOULD save the new time', async () => {
  let callCount = 0;
  let sentPayload = null;
  const harness = createHarness({
    prevSourceUrl: 'https://www.youtube.com/watch?v=v9D8D3YgIUE',
    sourceUrl: 'https://www.youtube.com/watch?v=v9D8D3YgIUE&t=10s',
    updateMemory: async (id, payload) => { 
      callCount++; 
      sentPayload = payload;
      return { id, ...payload }; 
    }
  });

  await harness.actions.saveMemoryEdit();
  assert.equal(callCount, 1, 'updateMemory should be called once');
  assert.equal(harness.statuses[harness.statuses.length - 1], 'manual_saved', 'should return saved');
  
  assert.ok(sentPayload.sourceUrl.includes('start=10') || sentPayload.sourceUrl.includes('t=10'), 'payload sourceUrl should contain the start time');
});
