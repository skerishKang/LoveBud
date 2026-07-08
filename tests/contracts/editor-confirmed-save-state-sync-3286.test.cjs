const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const VIDEO_A = 'aaaaaaaaaaa';
const VIDEO_B = 'bbbbbbbbbbb';

function embedUrl(videoId, start = null, end = null) {
  const params = [];
  if (start !== null) params.push(`start=${start}`);
  if (end !== null) params.push(`end=${end}`);
  return `https://www.youtube.com/embed/${videoId}${params.length ? `?${params.join('&')}` : ''}`;
}

function watchUrl(videoId, start = null, end = null) {
  const params = [`v=${videoId}`];
  if (start !== null) params.push(`t=${start}`);
  if (end !== null) params.push(`end=${end}`);
  return `https://www.youtube.com/watch?${params.join('&')}`;
}

function thumbnailUrl(videoId, quality = 'mqdefault') {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

function createElement(id) {
  return {
    id,
    value: '',
    textContent: id === 'saveEditBtn' ? '저장' : '',
    disabled: false,
    dataset: {},
    style: {},
    _attrs: {},
    _listeners: {},
    classList: {
      _classes: new Set(),
      add(value) { this._classes.add(value); },
      remove(value) { this._classes.delete(value); },
      toggle(value, force) {
        if (force === undefined ? !this._classes.has(value) : force) this._classes.add(value);
        else this._classes.delete(value);
      },
      contains(value) { return this._classes.has(value); }
    },
    getAttribute(name) { return this._attrs[name]; },
    setAttribute(name, value) { this._attrs[name] = String(value); },
    removeAttribute(name) { delete this._attrs[name]; },
    addEventListener(type, handler) { this._listeners[type] = handler; },
    focus() {},
    closest() { return { className: 'editor-form-stack' }; },
    parentNode: { insertBefore() {} }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseMemory(overrides = {}) {
  return {
    id: 'mem-sync-1',
    treeId: 'tree-sync-1',
    title: 'Original title',
    memo: 'Original memo',
    emotionTags: ['original'],
    sourceUrl: embedUrl(VIDEO_A),
    sourceType: 'youtube',
    thumbnail: thumbnailUrl(VIDEO_A),
    source: 'YouTube',
    createdAt: 'created-time',
    authorId: 'author-sync',
    ...overrides
  };
}

function defaultDom(sourceUrl = embedUrl(VIDEO_A)) {
  return {
    editTitleInput: 'Original title',
    editMemoInput: 'Original memo',
    editTagsInput: 'original',
    editSourceUrlInput: sourceUrl,
    editStartTimeInput: '',
    editEndTimeInput: ''
  };
}

function createHarness({ initialMemory = baseMemory(), domValues = {}, apiResponse = null, updateMemoryError = null } = {}) {
  const sequence = [];
  let currentEditingMemory = clone(initialMemory);
  let treeMemories = [clone(initialMemory)];
  const currentTreeDataBacking = [clone(initialMemory)];
  const currentTreeDataMemories = new Proxy(currentTreeDataBacking, {
    set(target, property, value) {
      if (/^\d+$/.test(String(property))) {
        sequence.push({ type: 'currentTreeDataMemorySet', value });
      }
      target[property] = value;
      return true;
    }
  });
  const currentTreeData = { id: initialMemory.treeId || 'tree-sync-1', memories: currentTreeDataMemories };
  let savedPayload = null;
  const statusCalls = [];
  const toasts = [];
  const detailUpdates = [];
  const cacheWrites = [];
  const sidebarCalls = [];
  const rerenderCalls = [];
  let communityCacheClearCount = 0;

  const documentMock = {
    elements: {},
    getElementById(id) {
      if (!this.elements[id]) this.elements[id] = createElement(id);
      return this.elements[id];
    },
    createElement(tag) {
      return {
        tagName: tag,
        id: '',
        className: '',
        style: {},
        dataset: {},
        innerHTML: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        parentNode: { insertBefore() {} }
      };
    }
  };

  ['detailViewMode', 'detailEditMode', 'saveEditBtn', 'cancelEditBtn', 'deleteMemoryBtn'].forEach((id) => {
    documentMock.getElementById(id);
  });
  documentMock.getElementById('detailViewMode').style.display = 'block';
  documentMock.getElementById('detailEditMode').style.display = 'none';

  const sandbox = {
    console: { ...console, error() {} },
    document: documentMock,
    URL,
    URLSearchParams,
    setTimeout(fn) { fn(); },
    clearTimeout() {},
    window: {
      location: { origin: 'https://example.test' },
      LoveBudMedia: {
        extractYouTubeId(url) {
          const value = String(url || '');
          const match = value.match(/[?&]v=([0-9A-Za-z_-]{11})/) ||
            value.match(/(?:youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
          return match ? match[1] : '';
        },
        getEmbedUrl(url, type, options = {}) {
          const videoId = this.extractYouTubeId(url);
          let next = embedUrl(videoId);
          if (options.startSeconds !== undefined && options.startSeconds !== null) {
            next += `?start=${options.startSeconds}`;
          }
          return next;
        },
        getThumbnailUrl(url) {
          const videoId = this.extractYouTubeId(url);
          return videoId ? thumbnailUrl(videoId) : '';
        },
        parseYouTubeTimeToSeconds(value) {
          if (!value) return null;
          const parts = String(value).split(':').map(Number);
          if (parts.length === 2) return (parts[0] * 60) + parts[1];
          if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
          return Number(value);
        },
        formatYouTubeStartTime(seconds) {
          if (seconds === null || seconds === undefined) return '';
          return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        }
      },
      LoveBudEditorMemoryFormTime: {
        parseTime(value) {
          return sandbox.window.LoveBudMedia.parseYouTubeTimeToSeconds(value);
        },
        validateEndTime({ rawEndTime, startSeconds, invalidMessage, rangeMessage }) {
          if (!rawEndTime || !String(rawEndTime).trim()) return { ok: true, endSeconds: null };
          const endSeconds = sandbox.window.LoveBudMedia.parseYouTubeTimeToSeconds(rawEndTime);
          if (!Number.isFinite(endSeconds)) return { ok: false, message: invalidMessage };
          if (startSeconds !== null && startSeconds !== undefined && endSeconds <= startSeconds) {
            return { ok: false, message: rangeMessage };
          }
          return { ok: true, endSeconds };
        }
      },
      apiClient: {
        async updateMemory(id, payload) {
          sequence.push({ type: 'updateMemory', id, payload });
          savedPayload = { ...payload };
          if (updateMemoryError) throw updateMemoryError;
          if (apiResponse !== null) return typeof apiResponse === 'function' ? apiResponse(id, payload) : apiResponse;
          return { id, ...payload };
        },
        clearCommunityCaches() {
          communityCacheClearCount++;
          sequence.push({ type: 'clearCommunityCaches' });
        }
      },
      LoveBudEditorInteractionMode: { isEditMode() { return true; } },
      LoveBudCache: {
        set(key, value, ttl) {
          cacheWrites.push({ key, value, ttl });
          sequence.push({ type: 'cacheSet', key, value });
        }
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, 'utf8'), sandbox, { filename: ACTIONS_PATH });

  const actions = sandbox.window.createEditorMemoryActions({
    i18n: (key) => ({ save_saved: '저장됨', memory_updated: '순간을 수정했어요' }[key] || key),
    updateSaveStatus(status, message) { statusCalls.push({ status, message }); },
    updateDetailPanel(memory) {
      detailUpdates.push(memory);
      sequence.push({ type: 'updateDetailPanel', value: memory });
    },
    updateSidebarStatus() {
      sidebarCalls.push(true);
      sequence.push({ type: 'updateSidebarStatus' });
    },
    showToast(message, type) { toasts.push({ message, type }); },
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory(memory) {
      currentEditingMemory = memory;
      sequence.push({ type: 'setCurrentEditingMemory', value: memory });
    },
    getTreeMemories: () => treeMemories,
    setTreeMemories(next) {
      treeMemories = next;
      sequence.push({ type: 'setTreeMemories', value: next });
    },
    getSelectedNodeId: () => currentEditingMemory && currentEditingMemory.id,
    setSelectedNodeId() {},
    getCanonicalRootId: () => 'root',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: documentMock.getElementById('detailPanel'),
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState() {},
    rerenderCanvas() {
      rerenderCalls.push(true);
      sequence.push({ type: 'rerenderCanvas' });
    },
    getCurrentTreeData: () => currentTreeData,
    isLocalSaveMode: () => false,
    canEdit: true
  });

  function applyDomValues() {
    Object.entries({ ...defaultDom(initialMemory.sourceUrl), ...domValues }).forEach(([id, value]) => {
      documentMock.getElementById(id).value = value;
    });
  }

  async function save() {
    actions.enterEditMode();
    applyDomValues();
    return actions.saveMemoryEdit();
  }

  function dataSnapshot() {
    return {
      currentEditingMemory: clone(currentEditingMemory),
      treeMemories: clone(treeMemories),
      currentTreeDataMemories: clone(currentTreeDataBacking)
    };
  }

  return {
    save,
    dataSnapshot,
    getPayload: () => savedPayload,
    getMemory: () => currentEditingMemory,
    getTreeMemory: () => treeMemories[0],
    getTreeDataMemory: () => currentTreeDataBacking[0],
    getStatusCalls: () => statusCalls,
    getToasts: () => toasts,
    getDetailUpdates: () => detailUpdates,
    getCacheWrites: () => cacheWrites,
    getSidebarCalls: () => sidebarCalls,
    getRerenderCalls: () => rerenderCalls,
    getCommunityCacheClearCount: () => communityCacheClearCount,
    getSequence: () => sequence,
    document: documentMock
  };
}

test('success path applies one identical saved representation to every Editor state holder', async () => {
  const initialMemory = baseMemory();
  const harness = createHarness({
    initialMemory,
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({
      id,
      sourceUrl: payload.sourceUrl,
      updatedAt: 'server-confirmed'
    })
  });

  const result = await harness.save();

  assert.equal(result.outcome, 'saved');
  const expected = {
    ...initialMemory,
    ...clone(harness.getPayload()),
    id: initialMemory.id,
    sourceUrl: embedUrl(VIDEO_B),
    updatedAt: 'server-confirmed'
  };
  assert.deepEqual(clone(harness.getMemory()), expected);
  assert.deepEqual(clone(harness.getTreeMemory()), expected);
  assert.deepEqual(clone(harness.getTreeDataMemory()), expected);
  assert.deepEqual(clone(harness.getDetailUpdates().at(-1)), expected);
  assert.deepEqual(clone(harness.getCacheWrites().at(-1).value[0]), expected);
});

test('server response wins over submitted payload for confirmed source fields', async () => {
  const responseSourceUrl = watchUrl(VIDEO_B);
  const responseThumbnail = thumbnailUrl(VIDEO_B, 'hqdefault');
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({
      id,
      sourceUrl: responseSourceUrl,
      sourceType: payload.sourceType,
      thumbnail: responseThumbnail,
      source: payload.source
    })
  });

  const result = await harness.save();

  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().sourceUrl, embedUrl(VIDEO_B));
  assert.equal(harness.getMemory().sourceUrl, responseSourceUrl);
  assert.equal(harness.getMemory().thumbnail, responseThumbnail);
  assert.equal(harness.getTreeMemory().sourceUrl, responseSourceUrl);
  assert.equal(harness.getDetailUpdates().at(-1).thumbnail, responseThumbnail);
});

test('payload fills source fields omitted by server response', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({ id, sourceUrl: payload.sourceUrl })
  });

  const result = await harness.save();

  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_B));
  assert.equal(harness.getMemory().sourceType, 'youtube');
  assert.equal(harness.getMemory().thumbnail, thumbnailUrl(VIDEO_B));
  assert.equal(harness.getMemory().source, 'YouTube');
});

test('existing memory fills fields omitted by both server response and payload', async () => {
  const initialMemory = baseMemory({ createdAt: 'original-created', authorId: 'owner-1' });
  const harness = createHarness({
    initialMemory,
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({ id, sourceUrl: payload.sourceUrl })
  });

  const result = await harness.save();

  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getMemory().createdAt, 'original-created');
  assert.equal(harness.getMemory().authorId, 'owner-1');
  assert.equal(harness.getTreeMemory().createdAt, 'original-created');
  assert.equal(harness.getTreeDataMemory().authorId, 'owner-1');
});

test('cache write happens only after confirmed validation and prepared state updates', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({ id, sourceUrl: payload.sourceUrl })
  });

  const result = await harness.save();

  assert.equal(result.outcome, 'saved');
  assert.deepEqual(
    harness.getSequence().map((entry) => entry.type).filter((type) => type !== 'updateMemory'),
    [
      'setTreeMemories',
      'currentTreeDataMemorySet',
      'cacheSet',
      'setCurrentEditingMemory',
      'updateDetailPanel',
      'updateSidebarStatus',
      'rerenderCanvas',
      'clearCommunityCaches'
    ]
  );
});

test('rejected missing acknowledgement preserves all pre-save state', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: { id: 'mem-sync-1' }
  });
  const before = harness.dataSnapshot();

  const result = await harness.save();

  assert.equal(result.outcome, 'failed');
  assert.deepEqual(harness.dataSnapshot(), before);
  assert.equal(harness.getDetailUpdates().length, 0);
  assert.equal(harness.getCacheWrites().length, 0);
  assert.equal(harness.getSidebarCalls().length, 0);
  assert.equal(harness.getRerenderCalls().length, 0);
});

test('failed updateMemory error preserves all pre-save state', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    updateMemoryError: new Error('synthetic network failure')
  });
  const before = harness.dataSnapshot();

  const result = await harness.save();

  assert.equal(result.outcome, 'failed');
  assert.deepEqual(harness.dataSnapshot(), before);
  assert.equal(harness.getCacheWrites().length, 0);
  assert.equal(harness.getDetailUpdates().length, 0);
  assert.equal(harness.getCommunityCacheClearCount(), 0);
});

test('mismatched response ID preserves all pre-save state', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: (id, payload) => ({ id: 'different-memory', sourceUrl: payload.sourceUrl })
  });
  const before = harness.dataSnapshot();

  const result = await harness.save();

  assert.equal(result.outcome, 'failed');
  assert.deepEqual(harness.dataSnapshot(), before);
  assert.equal(harness.getCacheWrites().length, 0);
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('source stale acknowledgement rejection preserves all pre-save state', async () => {
  const harness = createHarness({
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: {
      id: 'mem-sync-1',
      sourceUrl: embedUrl(VIDEO_A),
      sourceType: 'youtube',
      thumbnail: thumbnailUrl(VIDEO_A),
      source: 'YouTube'
    }
  });
  const before = harness.dataSnapshot();

  const result = await harness.save();

  assert.equal(result.outcome, 'failed');
  assert.deepEqual(harness.dataSnapshot(), before);
  assert.equal(harness.getCacheWrites().length, 0);
  assert.equal(harness.getDetailUpdates().length, 0);
  assert.equal(harness.getSidebarCalls().length, 0);
  assert.equal(harness.getRerenderCalls().length, 0);
});

test('save path delegates confirmed synchronization to the helper', () => {
  const source = fs.readFileSync(ACTIONS_PATH, 'utf8');
  const saveStart = source.indexOf('const saveMemoryEdit = async () =>');
  const saveEnd = source.indexOf('const updateSelectedMemoryFields = async', saveStart);
  assert.notEqual(saveStart, -1, 'saveMemoryEdit must exist');
  assert.notEqual(saveEnd, -1, 'updateSelectedMemoryFields marker must exist');
  const saveSource = source.slice(saveStart, saveEnd);

  assert.match(source, /const applyConfirmedSavedMemory = \(/);
  assert.match(saveSource, /applyConfirmedSavedMemory\(\{/);
  assert.doesNotMatch(saveSource, /const prioritizedPatch =/);
  assert.doesNotMatch(saveSource, /setTreeMemories\(nextMemories\)/);
  assert.doesNotMatch(saveSource, /window\.LoveBudCache\.set\('memories_'/);
  assert.doesNotMatch(saveSource, /updateDetailPanel\(nextEditingMemory\)/);
});
