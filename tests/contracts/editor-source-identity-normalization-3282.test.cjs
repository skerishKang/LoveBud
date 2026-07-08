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

function shortUrl(videoId) {
  return `https://youtu.be/${videoId}`;
}

function thumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
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
    dispatchEvent(type) { if (this._listeners[type]) this._listeners[type]({ type }); },
    focus() {},
    closest() { return { className: 'editor-form-stack' }; },
    parentNode: { insertBefore() {} }
  };
}

function createHarness({ initialMemory, domValues = {}, apiResponse = null }) {
  let currentEditingMemory = { ...initialMemory };
  let treeMemories = [{ ...initialMemory }];
  let currentTreeData = { id: 'tree-1', memories: [{ ...initialMemory }] };
  let savedPayload = null;
  const statusCalls = [];
  const toasts = [];
  const detailUpdates = [];

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
      location: { origin: 'https://lovebud.pages.dev' },
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
          savedPayload = { ...payload };
          if (apiResponse !== null) return typeof apiResponse === 'function' ? apiResponse(id, payload) : apiResponse;
          return { id, ...payload };
        },
        clearCommunityCaches() {}
      },
      LoveBudEditorInteractionMode: { isEditMode() { return true; } },
      LoveBudCache: { set() {} }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, 'utf8'), sandbox, { filename: ACTIONS_PATH });

  const actions = sandbox.window.createEditorMemoryActions({
    i18n: (key) => ({ save_saved: '저장됨', memory_updated: '순간을 수정했어요' }[key] || key),
    updateSaveStatus(status, message) { statusCalls.push({ status, message }); },
    updateDetailPanel(memory) { detailUpdates.push(memory); },
    updateSidebarStatus() {},
    showToast(message, type) { toasts.push({ message, type }); },
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory(memory) { currentEditingMemory = memory; },
    getTreeMemories: () => treeMemories,
    setTreeMemories(next) { treeMemories = next; },
    getSelectedNodeId: () => currentEditingMemory && currentEditingMemory.id,
    setSelectedNodeId() {},
    getCanonicalRootId: () => 'root',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: documentMock.getElementById('detailPanel'),
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState() {},
    rerenderCanvas() {},
    getCurrentTreeData: () => currentTreeData,
    isLocalSaveMode: () => false,
    canEdit: true
  });

  function applyDomValues() {
    Object.entries(domValues).forEach(([id, value]) => {
      documentMock.getElementById(id).value = value;
    });
  }

  async function save() {
    actions.enterEditMode();
    applyDomValues();
    return actions.saveMemoryEdit();
  }

  return {
    save,
    getPayload: () => savedPayload,
    getMemory: () => currentEditingMemory,
    getTreeMemory: () => treeMemories[0],
    getTreeDataMemory: () => currentTreeData.memories[0],
    getStatusCalls: () => statusCalls,
    getToasts: () => toasts,
    getDetailUpdates: () => detailUpdates
  };
}

function baseMemory(sourceUrl = embedUrl(VIDEO_A)) {
  return {
    id: 'mem-1',
    treeId: 'tree-1',
    title: 'Same title',
    memo: 'Same memo',
    emotionTags: ['tag'],
    sourceUrl,
    sourceType: 'youtube',
    thumbnail: thumbnailUrl(VIDEO_A),
    source: 'YouTube'
  };
}

function defaultDom(sourceUrl) {
  return {
    editTitleInput: 'Same title',
    editMemoInput: 'Same memo',
    editTagsInput: 'tag',
    editSourceUrlInput: sourceUrl,
    editStartTimeInput: '',
    editEndTimeInput: ''
  };
}

test('equivalent YouTube URL forms do not trigger source rewrite', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10)),
    domValues: {
      ...defaultDom(shortUrl(VIDEO_A)),
      editTitleInput: 'Retitled',
      editStartTimeInput: '0:10'
    }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().title, 'Retitled');
  assert.equal(harness.getPayload().sourceUrl, undefined);
  assert.equal(harness.getPayload().sourceType, undefined);
  assert.equal(harness.getPayload().thumbnail, undefined);
});

test('changed video triggers source payload from shared identity', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom(watchUrl(VIDEO_B))
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().sourceUrl, embedUrl(VIDEO_B));
  assert.equal(harness.getPayload().sourceType, 'youtube');
  assert.equal(harness.getPayload().thumbnail, thumbnailUrl(VIDEO_B));
});

test('start-only change triggers source payload and acknowledgement validation', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10)),
    domValues: {
      ...defaultDom(embedUrl(VIDEO_A, 10)),
      editStartTimeInput: '0:20'
    }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().sourceUrl, embedUrl(VIDEO_A, 20));
});

test('end-only change triggers source payload and acknowledgement validation', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10)),
    domValues: {
      ...defaultDom(embedUrl(VIDEO_A, 10)),
      editStartTimeInput: '0:10',
      editEndTimeInput: '0:30'
    }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().sourceUrl, embedUrl(VIDEO_A, 10, 30));
});

test('start and end changes trigger one coherent source payload', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10, 20)),
    domValues: {
      ...defaultDom(embedUrl(VIDEO_A, 10, 20)),
      editStartTimeInput: '0:30',
      editEndTimeInput: '0:40'
    }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getPayload().sourceUrl, embedUrl(VIDEO_A, 30, 40));
});

test('clear source sends clear payload and accepts coherent clear acknowledgement', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom('')
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'saved');
  assert.deepEqual(
    {
      sourceUrl: harness.getPayload().sourceUrl,
      sourceType: harness.getPayload().sourceType,
      thumbnail: harness.getPayload().thumbnail,
      source: harness.getPayload().source
    },
    { sourceUrl: '', sourceType: 'other', thumbnail: '', source: '' }
  );
  assert.equal(harness.getMemory().sourceUrl, '');
});

test('clear source rejects stale clear acknowledgement before local synchronization', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom(''),
    apiResponse: { id: 'mem-1', sourceUrl: embedUrl(VIDEO_A), sourceType: 'youtube', thumbnail: thumbnailUrl(VIDEO_A), source: 'YouTube' }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getTreeMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getTreeDataMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('stale response video is rejected before local synchronization', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: { id: 'mem-1', sourceUrl: embedUrl(VIDEO_A), sourceType: 'youtube', thumbnail: thumbnailUrl(VIDEO_A), source: 'YouTube' }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getTreeMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('stale response start is rejected before local synchronization', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10)),
    domValues: { ...defaultDom(embedUrl(VIDEO_A, 10)), editStartTimeInput: '0:20' },
    apiResponse: { id: 'mem-1', sourceUrl: embedUrl(VIDEO_A, 10), sourceType: 'youtube', thumbnail: thumbnailUrl(VIDEO_A), source: 'YouTube' }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_A, 10));
  assert.equal(harness.getTreeMemory().sourceUrl, embedUrl(VIDEO_A, 10));
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('stale response end is rejected before local synchronization', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A, 10, 20)),
    domValues: { ...defaultDom(embedUrl(VIDEO_A, 10, 20)), editStartTimeInput: '0:10', editEndTimeInput: '0:30' },
    apiResponse: { id: 'mem-1', sourceUrl: embedUrl(VIDEO_A, 10, 20), sourceType: 'youtube', thumbnail: thumbnailUrl(VIDEO_A), source: 'YouTube' }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_A, 10, 20));
  assert.equal(harness.getTreeMemory().sourceUrl, embedUrl(VIDEO_A, 10, 20));
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('missing response sourceUrl acknowledgement is rejected when source changed', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom(watchUrl(VIDEO_B)),
    apiResponse: { id: 'mem-1', title: 'Same title', memo: 'Same memo', emotionTags: ['tag'] }
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getTreeMemory().sourceUrl, embedUrl(VIDEO_A));
  assert.equal(harness.getDetailUpdates().length, 0);
});

test('unsupported non-youtube source is rejected without a write call', async () => {
  const harness = createHarness({
    initialMemory: baseMemory(embedUrl(VIDEO_A)),
    domValues: defaultDom('not-a-supported-video-source')
  });

  const result = await harness.save();
  assert.equal(result.outcome, 'failed');
  assert.equal(harness.getPayload(), null);
  assert.deepEqual(harness.getToasts().at(-1), {
    message: 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.',
    type: 'error'
  });
});
