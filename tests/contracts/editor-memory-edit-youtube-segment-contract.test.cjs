const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function setupTestContext(initialMemory, finalDomValues = {}) {
  let savedPayload = null;
  let currentEditingMemory = initialMemory;
  let toastMessage = null;
  let toastType = null;

  const documentMock = {
    elements: {},
    getElementById(id) {
      if (!this.elements[id]) {
        this.elements[id] = {
          id,
          value: '',
          disabled: false,
          _attrs: {},
          getAttribute(attr) { return this._attrs[attr] !== undefined ? this._attrs[attr] : null; },
          setAttribute(attr, val) { this._attrs[attr] = val; },
          removeAttribute(attr) { delete this._attrs[attr]; },
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, force) {
              if (force) this.classes.add(c);
              else this.classes.delete(c);
            },
            contains(c) { return this.classes.has(c); }
          },
          style: {},
          dataset: {},
          listeners: {},
          addEventListener(event, cb) {
            this.listeners[event] = cb;
          },
          removeEventListener(event) {
            delete this.listeners[event];
          },
          dispatchEvent(event) {
            if (this.listeners[event]) this.listeners[event]();
          },
          focus() {},
          parentNode: {
            insertBefore: (newNode, referenceNode) => {}
          },
          closest: () => ({})
        };
      }
      return this.elements[id];
    },
    createElement(tag) {
      return {
        tagName: tag,
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, force) {
            if (force) this.classes.add(c);
            else this.classes.delete(c);
          },
          contains(c) { return this.classes.has(c); }
        },
        style: {},
        innerHTML: ''
      };
    }
  };

  const context = {
    console,
    URL,
    URLSearchParams,
    document: documentMock,
    setTimeout: (fn) => fn(), // execute immediately in test
    window: {
      LoveBudMedia: {
        extractYouTubeId: (url) => {
          if (!url) return null;
          const match = url.match(/(?:v=|\/|embed\/)([0-9A-Za-z_-]{11})/);
          return match ? match[1] : null;
        },
        getEmbedUrl: (url, type, options) => {
          const videoId = 'dQw4w9WgXcQ';
          let embed = `https://www.youtube.com/embed/${videoId}`;
          if (options && options.startSeconds) {
            embed += `?start=${options.startSeconds}`;
          }
          return embed;
        },
        getThumbnailUrl: () => 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        formatYouTubeStartTime: (seconds) => {
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          return `${m}:${String(s).padStart(2, '0')}`;
        },
        parseYouTubeTimeToSeconds: (val) => {
          if (!val) return null;
          if (/^\d+$/.test(val)) return Number(val);
          const parts = val.split(':');
          if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
          return null;
        }
      },
      LoveBudEditorMemoryFormTime: {
        parseTime: (val) => {
          if (!val) return null;
          if (/^\d+$/.test(val)) return Number(val);
          const parts = val.split(':');
          if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
          return null;
        },
        validateEndTime: (options) => {
          const { rawEndTime, startSeconds } = options;
          if (!rawEndTime) return { ok: true, endSeconds: null };
          const endSeconds = Number(rawEndTime.split(':')[0]) * 60 + Number(rawEndTime.split(':')[1]);
          if (startSeconds && endSeconds <= startSeconds) {
            return { ok: false, message: '끝 시간은 시작 시간보다 뒤여야 해요.' };
          }
          return { ok: true, endSeconds };
        }
      },
      apiClient: {
        updateMemory: async (id, payload) => {
          savedPayload = payload;
          return { id, ...payload };
        }
      }
    }
  };

  vm.createContext(context);
  const code = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
  vm.runInContext(code, context);

  const actions = context.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: () => {},
    updateDetailPanel: () => {},
    updateSidebarStatus: () => {},
    showToast: (msg, type) => {
      toastMessage = msg;
      toastType = type;
    },
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (mem) => { currentEditingMemory = mem; },
    getTreeMemories: () => [initialMemory],
    setTreeMemories: () => {},
    getSelectedNodeId: () => initialMemory.id,
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'root-1',
    isRootMemory: () => false,
    findRootMemory: () => null,
    getCurrentTreeData: () => ({ id: 'tree-1', memories: [initialMemory] }),
    canEdit: true
  });

  return {
    actions,
    document: documentMock,
    getContext: () => context,
    getSavedPayload: () => savedPayload,
    getToast: () => ({ message: toastMessage, type: toastType }),
    applyFinalDomValues: () => {
      Object.entries(finalDomValues).forEach(([id, val]) => {
        documentMock.getElementById(id).value = val;
      });
    }
  };
}

test('unrelated edits do not rewrite sourceUrl/thumbnail/sourceType', async () => {
  const initialMemory = {
    id: 'mem-1',
    title: 'Original Title',
    memo: 'Original Memo',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    emotionTags: ['tag1']
  };

  const { actions, applyFinalDomValues, getSavedPayload } = setupTestContext(initialMemory, {
    editTitleInput: 'New Title',
    editMemoInput: 'New Memo',
    editTagsInput: 'tag1',
    editSourceUrlInput: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10',
    editStartTimeInput: '0:10',
    editEndTimeInput: ''
  });

  // Enter edit mode (populates DOM values from memory)
  actions.enterEditMode();

  // User edits values in DOM
  applyFinalDomValues();

  // Save memory edit
  await actions.saveMemoryEdit();

  const payload = getSavedPayload();
  assert.ok(payload);
  assert.equal(payload.title, 'New Title');
  assert.equal(payload.memo, 'New Memo');
  // source fields should not be present in payload
  assert.equal(payload.sourceUrl, undefined);
  assert.equal(payload.thumbnail, undefined);
  assert.equal(payload.sourceType, undefined);
});

test('changing start/end time patches sourceUrl', async () => {
  const initialMemory = {
    id: 'mem-1',
    title: 'Original Title',
    memo: 'Original Memo',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    emotionTags: ['tag1']
  };

  const { actions, applyFinalDomValues, getSavedPayload } = setupTestContext(initialMemory, {
    editTitleInput: 'Original Title',
    editMemoInput: 'Original Memo',
    editTagsInput: 'tag1',
    editSourceUrlInput: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10',
    editStartTimeInput: '0:20', // changed from 10 to 20
    editEndTimeInput: '0:30'   // changed
  });

  actions.enterEditMode();
  applyFinalDomValues();
  await actions.saveMemoryEdit();

  const payload = getSavedPayload();
  assert.ok(payload);
  assert.equal(payload.sourceUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=20&end=30');
});

test('invalid end <= start is rejected', async () => {
  const initialMemory = {
    id: 'mem-1',
    title: 'Original Title',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sourceType: 'youtube'
  };

  const { actions, applyFinalDomValues, getSavedPayload, getToast } = setupTestContext(initialMemory, {
    editTitleInput: 'Original Title',
    editSourceUrlInput: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    editStartTimeInput: '0:20',
    editEndTimeInput: '0:10' // end 10 <= start 20
  });

  actions.enterEditMode();
  applyFinalDomValues();
  await actions.saveMemoryEdit();

  const payload = getSavedPayload();
  assert.equal(payload, null); // should not be saved

  const toast = getToast();
  assert.equal(toast.type, 'error');
  assert.ok(toast.message.includes('끝 시간은 시작 시간보다 뒤여야 해요.'));
});

test('edit segment grid visibility is class-based (is-hidden toggle)', () => {
  const initialMemory = {
    id: 'mem-1',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sourceType: 'youtube'
  };

  const { actions, document } = setupTestContext(initialMemory);

  actions.enterEditMode();

  const grid = document.getElementById('editVideoSegmentGrid');
  assert.ok(grid);
  
  // YouTube url -> should not be hidden
  assert.equal(grid.classList.contains('is-hidden'), false);

  // Update input value to empty/non-youtube and dispatch input event
  const sourceUrlInput = document.getElementById('editSourceUrlInput');
  sourceUrlInput.value = 'plain text moment';
  sourceUrlInput.dispatchEvent('input');

  assert.equal(grid.classList.contains('is-hidden'), true);
});
