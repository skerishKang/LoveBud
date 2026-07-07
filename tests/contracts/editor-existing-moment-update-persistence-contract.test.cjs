const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Helper: run saveMemoryEdit in a VM sandbox.
 *
 * Exposed accessors:
 *   getDocument()        — the live doc object (mutations visible in VM)
 *   setInputValue(id, v) — set a DOM element's value
 *   getFormDisplay(mode) — 'edit' or 'view' display style
 *   getCallCount()       — how many times apiClient.updateMemory was called
 *   resolveDeferred(data) — resolve the deferred promise (useDeferred only)
 *   rejectDeferred(err)   — reject the deferred promise (useDeferred only)
 */
async function runSaveMemoryEdit({
  initialMemory = null,
  domValues = {},
  apiResponse = null,
  apiShouldResolve = true,
  apiDelayMs = 0,
  useDeferred = false,
} = {}) {
  let callCount = 0;
  let toastMessage = null;
  let toastType = null;
  let deferredResolveFn = null;
  let deferredRejectFn = null;
  let deferredPromise = null;

  if (useDeferred) {
    deferredPromise = new Promise(function(resolve, reject) {
      deferredResolveFn = resolve;
      deferredRejectFn = reject;
    });
  }

  const doc = {
    elements: {},
    getElementById(id) {
      if (!this.elements[id]) {
        this.elements[id] = {
          id, value: '', disabled: false,
          _attrs: {},
          getAttribute(attr) { return this._attrs[attr] !== undefined ? this._attrs[attr] : null; },
          setAttribute(attr, val) { this._attrs[attr] = val; },
          removeAttribute(attr) { delete this._attrs[attr]; },
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
    __editingMemoryMirror: initialMemory ? { ...initialMemory } : null,
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
        getThumbnailUrl(url) {
          var vid = this.extractYouTubeId(url);
          return vid ? 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg' : '';
        },
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
          sandbox.savedPayload = { id: id, ...payload };
          if (useDeferred && deferredPromise) {
            return deferredPromise.then(function(resp) { return resp; });
          }
          if (apiDelayMs > 0) {
            await new Promise(function(r) { setTimeout(r, apiDelayMs); });
          }
          if (!apiShouldResolve) throw new Error('update failed');
          if (apiResponse !== null) return apiResponse;
          return { id: id, ...(sandbox.currentEditingMemory || {}), ...payload, updatedAt: new Date().toISOString() };
        }
      },
      LoveBudEditorInteractionMode: { isEditMode() { return true; } }
    }
  };

  // ── Cache write tracker ────────────────────────────────────────────
  let cacheWriteCount = 0;
  sandbox.window.LoveBudCache = {
    set: function(key, val, ttl) { cacheWriteCount++; },
    get: function() { return null; }
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
        setCurrentEditingMemory: function(mem) { if (currentEditingMemory && mem) { Object.keys(mem).forEach(function(k) { currentEditingMemory[k] = mem[k]; }); } else { currentEditingMemory = mem; } },
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

  function editDisplay() { return doc.getElementById('detailEditMode').style.display || 'block'; }
  function viewDisplay() { return doc.getElementById('detailViewMode').style.display || 'block'; }

  return {
    actions,
    getSavedPayload: function() { return sandbox.savedPayload; },
    getEditingMemory: function() { return sandbox.currentEditingMemory; },
    getToast: function() { return { message: sandbox.toastMessage, type: sandbox.toastType }; },
    getTreeMemories: function() { return sandbox.treeMemories; },
    getCurrentTreeData: function() { return sandbox.currentTreeData; },
    getCallCount: function() { return callCount; },
    // DOM accessors — mutations are visible inside the VM (shared doc ref)
    getDocument: function() { return doc; },
    getElement: function(id) { return doc.getElementById(id); },
    setInputValue: function(id, value) { var el = doc.getElementById(id); if (el) el.value = value; },
    getFormDisplay: function(mode) { return mode === 'edit' ? editDisplay() : viewDisplay(); },
    // Deferred resolve/reject (useDeferred only)
    resolveDeferred: function(data) { if (deferredResolveFn) { deferredResolveFn(data); } },
    rejectDeferred: function(err) { if (deferredRejectFn) { deferredRejectFn(err); } },
    // Direct sandbox access for debugging
    getDirectMemoryTitle: function() { return sandbox.currentEditingMemory ? sandbox.currentEditingMemory.title : null; },
    getDirectCallCount: function() { return callCount; },
    getCacheWriteCount: function() { return cacheWriteCount; },
    getDetailPanelUpdated: function() { return sandbox.detailPanelUpdated; },
    getRenderedCanvas: function() { return sandbox.renderedCanvas; },
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

// =============================================================================
// Enhanced transition tests
// =============================================================================

test('10. same-context validation failure → fix input → retry → success', { timeout: 3000 }, async function(t) {
  var t10Ctx = await runSaveMemoryEdit({
    initialMemory: { id: 'mem-retry', title: 'Old', sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube', emotionTags: [] },
    // startTime 2:00 > endTime 1:00 → validation fails (end <= start)
    domValues: { title: 'New', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/embed/aaaa', startTime: '2:00', endTime: '1:00' }
  });

  // Phase 1: open edit form and set DOM values
  assert.equal(t10Ctx.getFormDisplay('edit'), 'none', 'inactive edit form starts as none');
  t10Ctx.actions.enterEditMode();
  assert.equal(t10Ctx.getFormDisplay('edit'), 'block', 'enterEditMode shows edit form');
  assert.equal(t10Ctx.getFormDisplay('view'), 'none', 'enterEditMode hides view form');
  // Re-set DOM values after enterEditMode (which resets them from currentMemory)
  t10Ctx.setInputValue('editTitleInput', 'New');
  t10Ctx.setInputValue('editMemoInput', '');
  t10Ctx.setInputValue('editTagsInput', '');
  t10Ctx.setInputValue('editStartTimeInput', '2:00');
  t10Ctx.setInputValue('editEndTimeInput', '1:00');

  // Phase 2: submit with invalid end time

  await t10Ctx.actions.saveMemoryEdit();
  assert.equal(t10Ctx.getCallCount(), 0, 'validation failure: 0 API calls');
  assert.equal(t10Ctx.getToast().type, 'error', 'validation error toast shown');
  assert.equal(t10Ctx.getFormDisplay('edit'), 'block', 'edit form stays open after validation failure');
  assert.equal(t10Ctx.getFormDisplay('view'), 'none', 'view form stays hidden after validation failure');

  // Phase 2: fix the DOM input values via shared doc reference — same context
  // Only fix startTime/endTime — keep sourceUrl same so no video change needed
  t10Ctx.setInputValue('editStartTimeInput', '');
  t10Ctx.setInputValue('editEndTimeInput', '');
  // sourceUrl stays same — only title changes, no video validation needed

  // Phase 3: retry — same ctx, same actions
  await t10Ctx.actions.saveMemoryEdit();

  assert.equal(t10Ctx.getCallCount(), 1, 'retry must call API exactly once');
  assert.equal(t10Ctx.getToast().type, 'success', 'retry must show success toast');
  // Validate via saved payload (crosses VM boundary correctly)
  var savedPayload = t10Ctx.getSavedPayload();
  assert.ok(savedPayload, 'retry must produce a saved payload');
  assert.equal(savedPayload.title, 'New', 'API payload must contain new title');
  // Validate form state transitions
  assert.equal(t10Ctx.getFormDisplay('edit'), 'none', 'success closes edit form');
  assert.equal(t10Ctx.getFormDisplay('view'), 'block', 'success opens view form');
});

test('11. missing existing memory ID — no API call, safe failure', async function(t) {
  var memNoId = { title: 'No ID', sourceUrl: 'https://www.youtube.com/embed/aaaa', sourceType: 'youtube', emotionTags: [] };
  var t11Ctx = await runSaveMemoryEdit({
    initialMemory: memNoId,
    domValues: { title: 'Should not call API', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbb' }
  });

  t11Ctx.actions.enterEditMode();
  assert.equal(t11Ctx.getFormDisplay('edit'), 'block', 'edit form opens');

  await t11Ctx.actions.saveMemoryEdit();
  assert.equal(t11Ctx.getCallCount(), 0, 'missing ID: 0 API calls');
  assert.equal(t11Ctx.getEditingMemory().title, 'No ID', 'editing memory unchanged');
  assert.equal(t11Ctx.getFormDisplay('edit'), 'block', 'edit form stays open after missing ID');
});

test('12. deferred pending: duplicate blocked → resolve → guard reset → second save', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube', emotionTags: []
  };
  var deferredResponse = {
    id: 'mem-1', title: 'Updated', sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    source: 'YouTube', emotionTags: [],
    updatedAt: new Date().toISOString()
  };

  var t12Ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa' },
    useDeferred: true,
  });

  // a. open edit form; enterEditMode fills form with current memory values ('Old')
  t12Ctx.actions.enterEditMode();
  assert.equal(t12Ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  // Inject changed values so the no-change guard does not block
  t12Ctx.setInputValue('editTitleInput', 'Updated');
  t12Ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');

  var p1 = t12Ctx.actions.saveMemoryEdit();

  // b. 첫 deferred API call count = 1
  assert.equal(t12Ctx.getCallCount(), 1, 'first save: 1 API call initiated');

  // c. 첫 Promise는 unresolved 상태

  // d. p2 = saveMemoryEdit() 실행 (blocked by isMemoryEditSaveInFlight)
  var p2 = t12Ctx.actions.saveMemoryEdit();

  // e. call count = 1 유지
  assert.equal(t12Ctx.getCallCount(), 1, 'duplicate submit p2 blocked: still 1 API call');

  // f. p3 = saveMemoryEdit() 실행
  var p3 = t12Ctx.actions.saveMemoryEdit();

  // g. call count = 1 유지
  assert.equal(t12Ctx.getCallCount(), 1, 'duplicate submit p3 blocked: still 1 API call');

  // h. pending 중 edit form = block, view form = none
  assert.equal(t12Ctx.getFormDisplay('edit'), 'block', 'edit form stays open while pending');
  assert.equal(t12Ctx.getFormDisplay('view'), 'none', 'view form stays hidden while pending');

  // i. resolveDeferred(matching ID + canonical same-video-ID + changed fields acknowledged response)
  t12Ctx.resolveDeferred(deferredResponse);

  // j. await Promise.all([p1, p2, p3])
  await Promise.all([p1, p2, p3]);

  // k. success 후 edit form = none, view form = block
  assert.equal(t12Ctx.getFormDisplay('edit'), 'none', 'success closes edit form');
  assert.equal(t12Ctx.getFormDisplay('view'), 'block', 'success opens view form');
  assert.equal(t12Ctx.getEditingMemory().title, 'Updated', 'title updated after deferred resolve');

  // l. 다시 saveMemoryEdit() 호출 (enterEditMode 후 두 번째 save 실행)
  //    enterEditMode fills form with current memory values ('Updated')
  //    Inject another changed value so no-change guard does not block
  t12Ctx.actions.enterEditMode();
  t12Ctx.setInputValue('editTitleInput', 'Updated Again');

  var pFinal = t12Ctx.actions.saveMemoryEdit();
  await pFinal;

  // m. call count = 2 확인
  assert.equal(t12Ctx.getCallCount(), 2, 'second save: 2 API calls — guard reset');
});

// =============================================================================
// A. stale thumbnail video identity — server returns thumbnail for old video
// =============================================================================
test('A. stale thumbnail video identity — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  // New sourceUrl has video ID bbb, but server responds with thumbnail for aaa
  var staleThumbnailResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: staleThumbnailResponse
  });

  // Open edit form first (so form display checks are meaningful)
  ctx.actions.enterEditMode();
  // Re-set DOM values after enterEditMode resets them from currentMemory
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/aaaaaaaaaaa',
    'stale thumbnail response must NOT update sourceUrl');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getDetailPanelUpdated(), null, 'detail panel must NOT be updated');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
  assert.equal(ctx.getFormDisplay('view'), 'none', 'view form must stay hidden');
});

// =============================================================================
// B. mismatched sourceType — server returns non-youtube sourceType
// =============================================================================
test('B. mismatched sourceType — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  var wrongSourceTypeResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'other',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: wrongSourceTypeResponse
  });

  // Open edit form first
  ctx.actions.enterEditMode();
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceType, 'youtube',
    'wrong sourceType response must NOT update sourceType');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
});

// =============================================================================
// C. mismatched source label — server returns non-YouTube source
// =============================================================================
test('C. mismatched source label — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  var wrongSourceResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    source: 'Vimeo',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: wrongSourceResponse
  });

  // Open edit form first
  ctx.actions.enterEditMode();
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.source, 'YouTube',
    'wrong source label response must NOT update source');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
});

// =============================================================================
// D. coherent canonical response — different thumbnail rendition accepted
// =============================================================================
test('D. coherent canonical response — different thumbnail rendition accepted', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  // Same video ID bbb, sourceType youtube, source YouTube, but different thumbnail resolution
  var coherentResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/hqdefault.jpg',
    source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: coherentResponse
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/bbbbbbbbbbb',
    'coherent response must update sourceUrl');
  assert.equal(editingMem.sourceType, 'youtube',
    'sourceType must be youtube');
  assert.equal(editingMem.source, 'YouTube',
    'source must be YouTube');
  assert.ok(editingMem.thumbnail.includes('bbbbbbbbbbb'),
    'thumbnail must reference new video ID, not old');
  assert.equal(ctx.getToast().type, 'success', 'must show success toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 1, 'cache must be written once');
  assert.equal(ctx.getRenderedCanvas(), true, 'canvas must rerender');
  assert.ok(ctx.getDetailPanelUpdated() !== null, 'detail panel must be updated');
  assert.equal(ctx.getFormDisplay('edit'), 'none', 'success closes edit form');
  assert.equal(ctx.getFormDisplay('view'), 'block', 'success opens view form');
});

// =============================================================================
// E. all derived fields omitted — thumbnail/sourceType/source undefined in response
// =============================================================================
test('E. derived fields all omitted — payload canonical values preserved', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  // Response has sourceUrl, but NO thumbnail/sourceType/source
  var omittedFieldsResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: omittedFieldsResponse
  });

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/bbbbbbbbbbb',
    'sourceUrl must update when response acknowledges it');
  assert.equal(editingMem.sourceType, 'youtube',
    'sourceType must be payload canonical (youtube), not lost');
  assert.equal(editingMem.source, 'YouTube',
    'source must be payload canonical (YouTube), not lost');
  assert.ok(editingMem.thumbnail.includes('bbbbbbbbbbb') || editingMem.thumbnail === '',
    'thumbnail must reference new video ID or be empty');
  assert.equal(ctx.getToast().type, 'success', 'must show success toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 1, 'cache must be written once');
  assert.equal(ctx.getRenderedCanvas(), true, 'canvas must rerender');
  assert.ok(ctx.getDetailPanelUpdated() !== null, 'detail panel must be updated');
  assert.equal(ctx.getFormDisplay('edit'), 'none', 'success closes edit form');
  assert.equal(ctx.getFormDisplay('view'), 'block', 'success opens view form');
});

// =============================================================================
// F. empty thumbnail in response — rejected
// =============================================================================
test('F. empty thumbnail in response — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  var emptyThumbnailResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: '',
    source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: emptyThumbnailResponse
  });

  ctx.actions.enterEditMode();
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceUrl, 'https://www.youtube.com/embed/aaaaaaaaaaa',
    'empty thumbnail response must NOT update sourceUrl');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
});

// =============================================================================
// G. empty sourceType in response — rejected
// =============================================================================
test('G. empty sourceType in response — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  var emptySourceTypeResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: '',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    source: 'YouTube',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: emptySourceTypeResponse
  });

  ctx.actions.enterEditMode();
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.sourceType, 'youtube',
    'empty sourceType response must NOT update sourceType');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
});

// =============================================================================
// H. empty source label in response — rejected
// =============================================================================
test('H. empty source label in response — rejected', { timeout: 3000 }, async function(t) {
  var mem = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/aaaaaaaaaaa', sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/aaaaaaaaaaa/mqdefault.jpg',
    source: 'YouTube', emotionTags: []
  };
  var emptySourceResponse = {
    id: 'mem-1', title: 'Old',
    sourceUrl: 'https://www.youtube.com/embed/bbbbbbbbbbb',
    sourceType: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/bbbbbbbbbbb/mqdefault.jpg',
    source: '',
    emotionTags: [], updatedAt: new Date().toISOString()
  };
  var ctx = await runSaveMemoryEdit({
    initialMemory: mem,
    domValues: { title: 'Old', memo: '', tags: '', sourceUrl: 'https://www.youtube.com/shorts/bbbbbbbbbbb' },
    apiResponse: emptySourceResponse
  });

  ctx.actions.enterEditMode();
  ctx.setInputValue('editSourceUrlInput', 'https://www.youtube.com/shorts/bbbbbbbbbbb');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form is open');

  await ctx.actions.saveMemoryEdit();

  var editingMem = ctx.getEditingMemory();
  assert.equal(editingMem.source, 'YouTube',
    'empty source label response must NOT update source');
  assert.equal(ctx.getToast().type, 'error', 'must show error toast');
  assert.equal(ctx.getCallCount(), 1, 'API was called exactly once');
  assert.equal(ctx.getCacheWriteCount(), 0, 'cache must NOT be written');
  assert.equal(ctx.getRenderedCanvas(), false, 'canvas must NOT rerender');
  assert.equal(ctx.getFormDisplay('edit'), 'block', 'edit form must stay open');
});
