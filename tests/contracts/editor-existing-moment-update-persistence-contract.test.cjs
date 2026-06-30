const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Helper: run saveMemoryEdit in a VM sandbox with given state.
 */
async function runSaveMemoryEdit({
  initialMemory = null,
  domValues = {},
  apiResponse = null,
  apiShouldResolve = true,
}) {
  let savedPayload = null;
  let currentEditingMemory = initialMemory ? { ...initialMemory } : null;
  let toastMessage = null;
  let toastType = null;
  let treeMemories = initialMemory ? [{ ...initialMemory }] : [];
  let currentTreeData = initialMemory ? { id: 'tree-1', memories: [...treeMemories] } : null;
  let detailPanelUpdated = null;
  let renderedCanvas = false;

  const doc = {
    elements: {},
    getElementById(id) {
      if (!this.elements[id]) {
        this.elements[id] = {
          id, value: '',
          classList: { classes: new Set(), add: function(c) { this.classes.add(c); }, remove: function(c) { this.classes.delete(c); }, toggle: function(c, f) { if (f) this.classes.add(c); else this.classes.delete(c); }, contains: function(c) { return this.classes.has(c); } },
          style: {}, dataset: {}, listeners: {},
          addEventListener: function(e, cb) { this.listeners[e] = cb; },
          dispatchEvent: function(e) { if (this.listeners[e]) this.listeners[e](); },
          focus: function() {},
          parentNode: { insertBefore: function() {} },
          closest: function() { return null; },
          querySelector: function() { return null; }
        };
      }
      return this.elements[id];
    },
    createElement: function(tag) {
      return { tagName: tag, style: {}, classList: { classes: new Set(), add: function(c) { this.classes.add(c); }, remove: function(c) { this.classes.delete(c); } }, innerHTML: '', dataset: {} };
    }
  };

  // Pre-set DOM field values
  doc.getElementById('detailViewMode').style.display = 'block';
  doc.getElementById('detailEditMode').style.display = 'none';
  if (domValues.title !== undefined) doc.getElementById('editTitleInput').value = domValues.title;
  if (domValues.memo !== undefined) doc.getElementById('editMemoInput').value = domValues.memo;
  if (domValues.tags !== undefined) doc.getElementById('editTagsInput').value = domValues.tags;
  if (domValues.sourceUrl !== undefined) doc.getElementById('editSourceUrlInput').value = domValues.sourceUrl;
  if (domValues.startTime !== undefined) doc.getElementById('editStartTimeInput').value = domValues.startTime;
  if (domValues.endTime !== undefined) doc.getElementById('editEndTimeInput').value = domValues.endTime;

  const sandbox = {
    console,
    URL,
    URLSearchParams,
    currentEditingMemory: currentEditingMemory,
    treeMemories: treeMemories,
    currentTreeData: currentTreeData,
    toastMessage: null,
    toastType: null,
    savedPayload: null,
    detailPanelUpdated: null,
    renderedCanvas: false,
    document: doc,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    window: {
      LoveBudMedia: {
        extractYouTubeId: function(url) {
          if (!url) return '';
          var m = String(url).match(/(?:v=|[/]|youtu[.]be[/]|embed[/]|shorts[/])([0-9A-Za-z_-]{11})/);
          // Simpler approach: find 11-char video ID after v= or /  
          var idMatch = String(url).match(/[?&]v=([^&]+)/) || String(url).match(/(?:youtu\.be\/|embed\/|shorts\/)([^/?&]+)/);
          return idMatch ? idMatch[1].slice(0, 11) : '';
        },
        getEmbedUrl: function(url, type, opts) {
          var m = String(url).match(/(?:youtu\.be\/|embed\/|shorts\/|\/watch\?v=)([^/?&]{11})/);
          var vid = m ? m[1] : '';
          var e = 'https://www.youtube.com/embed/' + vid;
          if (opts && opts.startSeconds != null) e += '?start=' + opts.startSeconds;
          return e;
        },
        getThumbnailUrl: function() { return 'https://img.youtube.com/vi/test/mqdefault.jpg'; },
        parseYouTubeTimeToSeconds: function(v) {
          if (!v) return null;
          var p = String(v).split(':');
          if (p.length === 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
          if (p.length === 3) return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]);
          return parseInt(v) || null;
        },
        formatYouTubeStartTime: function(s) {
          if (s == null) return '';
          return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        }
      },
      LoveBudEditorMemoryFormTime: {
        parseTime: function(v) {
          if (!v) return null;
          var p = String(v).trim().split(':').map(Number);
          if (p.length === 2) return p[0] * 60 + p[1];
          return parseInt(v) || null;
        },
        validateEndTime: function(o) {
          if (!o.rawEndTime || !String(o.rawEndTime).trim()) return { ok: true, endSeconds: null };
          var p = String(o.rawEndTime).trim().split(':').map(Number);
          var end = p.length === 2 ? p[0] * 60 + p[1] : NaN;
          if (isNaN(end)) return { ok: false, message: o.invalidMessage };
          if (o.startSeconds != null && end <= o.startSeconds) return { ok: false, message: o.rangeMessage };
          return { ok: true, endSeconds: end };
        }
      },
      apiClient: {
        updateMemory: async function(id, payload) {
          sandbox.savedPayload = { id: id, ...payload };
          if (!apiShouldResolve) throw new Error('update failed');
          if (apiResponse !== null) return apiResponse;
          return { id: id, ...(sandbox.currentEditingMemory || {}), ...payload, updatedAt: new Date().toISOString() };
        }
      },
      LoveBudEditorInteractionMode: { isEditMode: function() { return true; } }
    }
  };

  // Load and run source
  var source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf-8');
  var script = new vm.Script(source);
  script.runInNewContext(sandbox);

  // Create actions via factory
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
  var factoryScript = new vm.Script(factoryCode);
  var actions = factoryScript.runInNewContext(sandbox);

  return {
    actions,
    getSavedPayload: function() { return sandbox.savedPayload; },
    getEditingMemory: function() { return sandbox.currentEditingMemory; },
    getToast: function() { return { message: sandbox.toastMessage, type: sandbox.toastType }; },
    getDetailPanelUpdated: function() { return sandbox.detailPanelUpdated; },
    getTreeMemories: function() { return sandbox.treeMemories; },
    getCurrentTreeData: function() { return sandbox.currentTreeData; },
  };
}

// =============================================================================
// Tests
// =============================================================================

test('1. Shorts URL update sends updateMemory with existing ID', async () => {
  var mem = {
    id: 'mem-1', title: 'Old', memo: 'Old memo',
    sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps',
    sourceType: 'youtube', thumbnail: 'https://img.youtube.com/vi/R0h9_DmVLps/mqdefault.jpg',
    emotionTags: ['old']
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: 'Old memo', tags: 'old', sourceUrl: 'https://www.youtube.com/shorts/80Wo-CRbooU' }
  });

  await ctx.actions.saveMemoryEdit();
  var payload = ctx.getSavedPayload();
  assert.ok(payload, 'updateMemory must be called');
  assert.equal(payload.id, 'mem-1', 'must use existing memory ID');
  assert.ok(payload.sourceUrl, 'sourceUrl must be in payload');
  assert.ok(payload.thumbnail, 'thumbnail must be in payload');
});

test('2. Success response with matching ID updates editing memory and tree memory', async () => {
  var mem = {
    id: 'mem-1', title: 'Old', memo: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps',
    sourceType: 'youtube', emotionTags: []
  };
  var serverResp = {
    id: 'mem-1', title: 'New', memo: 'New',
    sourceUrl: 'https://www.youtube.com/embed/80Wo-CRbooU',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/80Wo-CRbooU/mqdefault.jpg',
    source: 'YouTube', emotionTags: [],
    updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New', memo: 'New', tags: '', sourceUrl: 'https://www.youtube.com/shorts/80Wo-CRbooU' },
    apiResponse: serverResp
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.ok(editingMem);
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/80Wo-CRbooU',
    'editing memory must use canonical sourceUrl from server');

  var treeMems = ctx.getTreeMemories();
  var updated = treeMems.find(function(m) { return m.id === 'mem-1'; });
  assert.ok(updated);
  assert.equal(updated.sourceUrl, 'https://www.youtube.com/embed/80Wo-CRbooU',
    'tree memory must have new sourceUrl');
});

test('3. Empty server response does NOT change editing memory', async () => {
  var mem = {
    id: 'mem-1', title: 'Original', sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps',
    sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Should NOT Persist', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/80Wo-CRbooU' },
    apiResponse: {}
  });

  await ctx.actions.saveMemoryEdit();
  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.title, 'Original', 'title must not change on empty response');
});

test('4. API failure retains original editing memory', async () => {
  var mem = {
    id: 'mem-1', title: 'Original', sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps',
    sourceType: 'youtube', emotionTags: []
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Should NOT Persist', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/80Wo-CRbooU' },
    apiShouldResolve: false
  });

  await ctx.actions.saveMemoryEdit();
  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.title, 'Original', 'title must not change on API failure');
});

test('5. Partial update (title only) preserves unrelated fields', async () => {
  var mem = {
    id: 'mem-1', title: 'Old Title', memo: 'Old memo',
    sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/R0h9_DmVLps/mqdefault.jpg',
    source: 'YouTube', emotionTags: ['old']
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'New Title Only', memo: 'Old memo', tags: 'old',
      sourceUrl: 'https://www.youtube.com/embed/R0h9_DmVLps' }
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.title, 'New Title Only', 'title must update');
  assert.ok(editingMem.source, 'source must be preserved');
});

test('6. No #1882 closing keywords in source', function() {
  var src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf-8');
  assert.ok(!src.includes('Closes #1882') && !src.includes('close #1882'), 'must not close #1882');
});
