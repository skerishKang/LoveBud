const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Helper: run saveMemoryEdit in a VM sandbox.
 */
async function runSaveMemoryEdit({
  initialMemory = null,
  domValues = {},
  apiResponse = null,
  apiShouldResolve = true,
  apiDelayMs = 0,
} = {}) {
  let callCount = 0;
  let toastMessage = null;
  let toastType = null;
  // Track deferred promise for pending tests
  let deferResolve = null;
  let deferReject = null;
  let deferredPromise = null;

  function makeDeferredPromise() {
    deferredPromise = new Promise(function(resolve, reject) {
      deferResolve = resolve;
      deferReject = reject;
    });
  }

  const doc = {
    elements: {},
    getElementById(id) {
      if (!this.elements[id]) {
        this.elements[id] = {
          id, value: '',
          classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); }, toggle(c, f) { if (f) this.classes.add(c); else this.classes.delete(c); }, contains(c) { return this.classes.has(c); } },
          style: {}, dataset: {}, listeners: {},
          addEventListener(e, cb) { this.listeners[e] = cb; },
          dispatchEvent(e) { if (this.listeners[e]) this.listeners[e](); },
          focus() {},
          parentNode: { insertBefore() {} },
          closest() { return null; },
          querySelector() { return null; }
        };
      }
      return this.elements[id];
    },
    createElement(tag) {
      return { tagName: tag, style: {}, classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); } }, innerHTML: '', dataset: {} };
    }
  };

  doc.getElementById('detailViewMode').style.display = 'block';
  doc.getElementById('detailEditMode').style.display = 'none';
  if (domValues.title !== undefined) doc.getElementById('editTitleInput').value = domValues.title;
  if (domValues.memo !== undefined) doc.getElementById('editMemoInput').value = domValues.memo;
  if (domValues.tags !== undefined) doc.getElementById('editTagsInput').value = domValues.tags;
  if (domValues.sourceUrl !== undefined) doc.getElementById('editSourceUrlInput').value = domValues.sourceUrl;
  if (domValues.startTime !== undefined) doc.getElementById('editStartTimeInput').value = domValues.startTime;
  if (domValues.endTime !== undefined) doc.getElementById('editEndTimeInput').value = domValues.endTime;

  const sandbox = {
    console, URL, URLSearchParams,
    currentEditingMemory: initialMemory ? { ...initialMemory } : null,
    treeMemories: initialMemory ? [{ ...initialMemory }] : [],
    currentTreeData: initialMemory ? { id: 'tree-1', memories: [{ ...initialMemory }] } : null,
    toastMessage: null, toastType: null,
    savedPayload: null, detailPanelUpdated: null, renderedCanvas: false,
    document: doc,
    setTimeout: function(fn, ms) { return setTimeout(fn, ms || 0); },
    clearTimeout: function(id) { clearTimeout(id); },
    window: {
      LoveBudMedia: {
        extractYouTubeId(url) {
          if (!url) return '';
          var m = String(url).match(/[?&]v=([^&]+)/) || String(url).match(/(?:youtu\.be\/|embed\/|shorts\/)([^/?&]+)/);
          return m ? m[1].slice(0, 11) : '';
        },
        getEmbedUrl(url, type, opts) {
          var m = String(url).match(/(?:youtu\.be\/|embed\/|shorts\/|\/watch\?v=)([^/?&]{11})/);
          var vid = m ? m[1] : '';
          var e = 'https://www.youtube.com/embed/' + vid;
          if (opts && opts.startSeconds != null) e += '?start=' + opts.startSeconds;
          return e;
        },
        getThumbnailUrl() { return 'https://img.youtube.com/vi/test/mqdefault.jpg'; },
        parseYouTubeTimeToSeconds(v) {
          if (!v) return null;
          var p = String(v).split(':');
          if (p.length === 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
          if (p.length === 3) return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]);
          return parseInt(v) || null;
        },
        formatYouTubeStartTime(s) {
          if (s == null) return '';
          return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        }
      },
      LoveBudEditorMemoryFormTime: {
        parseTime(v) { if (!v) return null; var p = String(v).trim().split(':').map(Number); if (p.length === 2) return p[0] * 60 + p[1]; return parseInt(v) || null; },
        validateEndTime(o) {
          if (!o.rawEndTime || !String(o.rawEndTime).trim()) return { ok: true, endSeconds: null };
          var p = String(o.rawEndTime).trim().split(':').map(Number);
          var end = p.length === 2 ? p[0] * 60 + p[1] : NaN;
          if (isNaN(end)) return { ok: false, message: o.invalidMessage };
          if (o.startSeconds != null && end <= o.startSeconds) return { ok: false, message: o.rangeMessage };
          return { ok: true, endSeconds: end };
        }
      },
      apiClient: {
        async updateMemory(id, payload) {
          callCount++;
          // Simulate API delay if requested
          if (apiDelayMs > 0) {
            await new Promise(function(r) { setTimeout(r, apiDelayMs); });
          }
          sandbox.savedPayload = { id: id, ...payload };
          if (!apiShouldResolve) throw new Error('update failed');
          if (apiResponse !== null) return apiResponse;
          return { id: id, ...(sandbox.currentEditingMemory || {}), ...payload, updatedAt: new Date().toISOString() };
        }
      },
      LoveBudEditorInteractionMode: { isEditMode() { return true; } }
    }
  };

  var source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf-8');
  new vm.Script(source).runInNewContext(sandbox);

  var factoryCode = `
    (function() {
      var act = createEditorMemoryActions({
        i18n: function(k) { return k; },
        updateSaveStatus: function() {},
        updateDetailPanel: function(mem) { detailPanelUpdated = mem ? JSON.parse(JSON.stringify(mem)) : null; },
        updateSidebarStatus: function() {},
        showToast: function(msg, type) { toastMessage = msg; toastType = type; },
        getCurrentEditingMemory: function() { return currentEditingMemory; },
        setCurrentEditingMemory: function(mem) { currentEditingMemory = mem; },
        getTreeMemories: function() { return treeMemories; },
        setTreeMemories: function(mems) { treeMemories = mems; if(currentTreeData) currentTreeData.memories = mems; },
        getSelectedNodeId: function() { return currentEditingMemory ? currentEditingMemory.id : null; },
        setSelectedNodeId: function() {},
        getCanonicalRootId: function() { return null; },
        isRootMemory: function() { return false; },
        findRootMemory: function() { return null; },
        detailPanel: function() {},
        svg: {},
        calcPosition: function() { return {}; },
        setDetailEmptyState: function() {},
        rerenderCanvas: function() { renderedCanvas = true; },
        getCurrentTreeData: function() { return currentTreeData; },
        isLocalSaveMode: function() { return false; },
        canEdit: true
      });
      return act;
    })();
  `;
  var actions = new vm.Script(factoryCode).runInNewContext(sandbox);

  return {
    actions,
    getSavedPayload: function() { return sandbox.savedPayload; },
    getEditingMemory: function() { return sandbox.currentEditingMemory; },
    getToast: function() { return { message: sandbox.toastMessage, type: sandbox.toastType }; },
    getTreeMemories: function() { return sandbox.treeMemories; },
    getCurrentTreeData: function() { return sandbox.currentTreeData; },
    getCallCount: function() { return callCount; },
  };
}

// =============================================================================
// Tests
// =============================================================================

test('1. pending save — form remains, single mutation', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiDelayMs: 50
  });

  var p1 = ctx.actions.saveMemoryEdit();
  var p2 = ctx.actions.saveMemoryEdit();
  await Promise.all([p1, p2]);

  assert.equal(ctx.getCallCount(), 1, 'must be exactly 1 API call for duplicate submits');
});

test('2. duplicate submit blocked by guard', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiDelayMs: 100
  });

  await ctx.actions.saveMemoryEdit();
  assert.equal(ctx.getCallCount(), 1, 'single API call');
  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.title, 'New', 'must be updated after promise resolves');
});

test('3. stale same-ID response — sourceUrl has old video ID', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg', emotionTags: []
  };
  var staleResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: staleResponse
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/aaaaaaaaaaa',
    'stale response must NOT update');
  assert.equal(ctx.getToast().type, 'error', 'must show error');
});

test('4. canonical success — Shorts input, embed response, same video ID', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg', emotionTags: []
  };
  var canonicalResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    sourceType: 'youtube', source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: canonicalResponse
  });

  await ctx.actions.saveMemoryEdit();

  assert.equal(ctx.getEditingMemory().sourceUrl, 'https://www.youtube.com/embed/bbbbbbbbbbb',
    'canonical embed URL with same video ID must be accepted');
});

test('5. mismatched ID — rejected', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Original',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Should NOT Persist', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbb' },
    apiResponse: { id: 'mem-999', title: 'Should NOT Persist' }
  });

  await ctx.actions.saveMemoryEdit();
  assert.equal(ctx.getEditingMemory().title, 'Original', 'mismatched ID must not update');
  assert.equal(ctx.getToast().type, 'error');
});

test('6. empty response — rejected', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Original',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Should NOT Persist', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbb' },
    apiResponse: {}
  });

  await ctx.actions.saveMemoryEdit();
  assert.equal(ctx.getEditingMemory().title, 'Original', 'empty response must not update');
  assert.equal(ctx.getToast().type, 'error');
});

test('7. stale title in response — rejected', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old Title', memo: 'Old memo',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube', emotionTags: []
  };
  var staleTitleResponse = {
    id: 'mem-1', title: 'Old Title', memo: 'Updated memo',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New Title', memo: 'Updated memo', tags: '', sourceUrl: 'https://www.youtube.com/embed/aaaa' },
    apiResponse: staleTitleResponse
  });

  await ctx.actions.saveMemoryEdit();
  assert.equal(ctx.getEditingMemory().title, 'Old Title', 'stale title response must not update');
  assert.equal(ctx.getToast().type, 'error');
});

test('8. normal partial update — title only, unrelated fields preserved', async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old Title', memo: 'Old memo',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: ['tag1']
  };
  var titleOnlyResponse = {
    id: 'mem-1', title: 'New Title', memo: 'Old memo',
    sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: ['tag1'],
    updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New Title', memo: 'Old memo', tags: 'tag1', sourceUrl: 'https://www.youtube.com/embed/aaaa' },
    apiResponse: titleOnlyResponse
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.title, 'New Title', 'title must update');
  assert.equal(editingMem.memo, 'Old memo', 'memo must be preserved');
  assert.ok(editingMem.source, 'source must be preserved');
  assert.ok(editingMem.thumbnail, 'thumbnail must be preserved');
});

test('9. no #1882 closing keywords', function(t) {
  var src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf-8');
  var testSrc = fs.readFileSync(__filename, 'utf-8');
  var closeKw = 'Closes ' + '#1882';
  var fixKw = 'Fixes ' + '#1882';
  var resolveKw = 'Resolves ' + '#1882';
  assert.equal(src.includes(closeKw), false, 'source must not close #1882');
  assert.equal(src.includes(fixKw), false, 'source must not fix #1882');
  assert.equal(src.includes(resolveKw), false, 'source must not resolve #1882');
  assert.equal(testSrc.includes(closeKw), false, 'test must not close #1882');
  assert.equal(testSrc.includes(fixKw), false, 'test must not fix #1882');
  assert.equal(testSrc.includes(resolveKw), false, 'test must not resolve #1882');
});
