/**
 * Source + pure-function contracts for Browse selected-tree URL sync (#3482).
 *
 * Verifies:
 * - URL state reads/writes `tree` query
 * - selection historyMode separation (push/replace/none)
 * - popstate does not push
 * - unknown deep-link is not substituted with first card
 * - metric truthfulness helpers hide unknown counts
 * - scope stays within Browse/Search
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const urlStateSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-url-state.js'), 'utf8');
const previewSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-preview-controller.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'js/search/index.js'), 'utf8');
const cardSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-card-renderer.js'), 'utf8');
const shareSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-share-link.js'), 'utf8');

test('url-state source reads and writes tree query parameter', () => {
  assert.match(urlStateSrc, /params\.get\('tree'\)/);
  assert.match(urlStateSrc, /params\.set\('tree'/);
  assert.match(urlStateSrc, /params\.delete\('tree'\)/);
  assert.match(urlStateSrc, /historyMode/);
  assert.match(urlStateSrc, /history\.pushState/);
  assert.match(urlStateSrc, /history\.replaceState/);
});

test('preview controller supports historyMode and force deep-link apply', () => {
  assert.match(previewSrc, /historyMode/);
  assert.match(previewSrc, /force/);
  assert.match(previewSrc, /pendingUnknownTreeDeepLink/);
  assert.match(previewSrc, /updateUrlState/);
  assert.equal(/selectTree\([\s\S]*firstTree/.test(previewSrc), false);
});

test('index popstate forces tree re-apply with historyMode none', () => {
  assert.match(indexSrc, /popstate/);
  assert.match(indexSrc, /applySelectedTreeFromUrl\(\{\s*[\s\S]*force:\s*true/);
  assert.match(indexSrc, /historyMode:\s*'none'/);
  assert.match(indexSrc, /pendingUnknownTreeDeepLink/);
  assert.match(indexSrc, /blockAutoSelect/);
});

test('card renderer does not coerce unknown metrics to zero', () => {
  assert.match(cardSrc, /return null/);
  assert.equal(/return 0;\s*\n\s*\}/.test(cardSrc.match(/function getFirstFiniteCount[\s\S]*?\n    \}/)[0]), false);
  assert.match(cardSrc, /counts\.likes !== null/);
  assert.match(cardSrc, /counts\.views !== null/);
  assert.equal(cardSrc.includes("value || 0"), false);
});

test('share shell hides unavailable likes/comments (no em-dash placeholder)', () => {
  assert.equal(shareSrc.includes('&mdash;'), false);
  assert.equal(shareSrc.includes('좋아요 정보 없음'), false);
  assert.equal(shareSrc.includes('댓글 정보 없음'), false);
});

function loadUrlStateModule() {
  const historyCalls = [];
  const location = {
    pathname: '/pages/search.html',
    search: '',
    get href() {
      return this.pathname + this.search;
    }
  };
  function applyUrl(url) {
    if (!url || !url.startsWith('/')) return;
    const q = url.indexOf('?');
    location.pathname = q >= 0 ? url.slice(0, q) : url;
    location.search = q >= 0 ? url.slice(q) : '';
  }
  const history = {
    pushState: (_s, _t, url) => {
      historyCalls.push({ type: 'push', url });
      applyUrl(url);
    },
    replaceState: (_s, _t, url) => {
      historyCalls.push({ type: 'replace', url });
      applyUrl(url);
    }
  };
  const sandbox = {
    URLSearchParams,
    URL,
    history,
    location
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(urlStateSrc, sandbox, { filename: 'search-url-state.js' });

  const state = {
    currentQuery: '',
    currentCategory: '전체',
    currentSort: 'latest',
    currentLimit: 6,
    selectedTreeId: null,
    isRestoringUrlState: false,
    urlStateReady: true
  };
  const api = sandbox.window.LoveBudSearchUrlState.createSearchUrlState({
    refs: { searchInput: null, tagChips: null },
    state,
    ui: {}
  });
  return { api, state, location, historyCalls };
}

test('writeUrlState sets tree on selection and preserves sort', () => {
  const { api, state, location, historyCalls } = loadUrlStateModule();
  location.search = '?sort=popular';
  state.currentSort = 'popular';
  state.selectedTreeId = 'tree-abc';
  api.updateUrlState({ historyMode: 'push' });
  assert.equal(historyCalls.length, 1);
  assert.equal(historyCalls[0].type, 'push');
  assert.match(historyCalls[0].url, /sort=popular/);
  assert.match(historyCalls[0].url, /tree=tree-abc/);
});

test('writeUrlState does not push when URL already matches (duplicate select)', () => {
  const { api, state, location, historyCalls } = loadUrlStateModule();
  location.search = '?tree=tree-abc';
  state.selectedTreeId = 'tree-abc';
  api.updateUrlState({ historyMode: 'push' });
  assert.equal(historyCalls.length, 0, 'identical URL must not create history');
});

test('writeUrlState deletes tree when selection cleared', () => {
  const { api, state, location, historyCalls } = loadUrlStateModule();
  location.search = '?sort=popular&tree=tree-abc';
  state.currentSort = 'popular';
  state.selectedTreeId = null;
  api.updateUrlState({ historyMode: 'replace' });
  assert.equal(historyCalls.length, 1);
  assert.equal(historyCalls[0].type, 'replace');
  assert.match(historyCalls[0].url, /sort=popular/);
  assert.equal(/tree=/.test(historyCalls[0].url), false);
});

test('writeUrlState historyMode none never mutates history', () => {
  const { api, state, historyCalls } = loadUrlStateModule();
  state.selectedTreeId = 'tree-x';
  api.updateUrlState({ historyMode: 'none' });
  assert.equal(historyCalls.length, 0);
});

test('readUrlState returns tree query', () => {
  const { api, location } = loadUrlStateModule();
  location.search = '?q=hello&tree=tid-1';
  const read = api.readUrlState();
  assert.equal(read.tree, 'tid-1');
  assert.equal(read.query, 'hello');
});

test('buildReadOnlyTreeUrl uses selected tree id (share contract)', () => {
  const sandbox = { window: {}, document: {}, URL, URLSearchParams };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(shareSrc, sandbox, { filename: 'search-share-link.js' });
  const url = sandbox.window.LoveBudSearchShareLink.buildReadOnlyTreeUrl(
    'sel-99',
    { origin: 'https://lovebud.pages.dev' }
  );
  assert.equal(url, 'https://lovebud.pages.dev/pages/view.html?treeId=sel-99');
  assert.equal(
    sandbox.window.LoveBudSearchShareLink.buildReadOnlyTreeUrl('', { origin: 'https://lovebud.pages.dev' }),
    ''
  );
});

test('search-controls reconcilies selection on query/category change (renderResults true)', () => {
  const controlsSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-controls.js'), 'utf8');
  assert.match(controlsSrc, /callbacks\.renderResults\(true\)/);
  assert.equal(controlsSrc.includes('callbacks.renderResults(false)'), false);
  assert.match(controlsSrc, /historyMode:\s*'replace'/);
});

test('index always clears filtered-out selection without first-card substitution', () => {
  assert.match(indexSrc, /state\.selectedTreeId && !selectedTree/);
  assert.match(indexSrc, /clearStaleSelection|historyMode:\s*'replace'/);
  assert.match(indexSrc, /treePassesCurrentFilter|filterTrees\(\[tree\]/);
});

// ── Behavioral controller tests ─────────────────────────────────────────────

function loadPreviewControllerHarness(initial) {
  const historyCalls = [];
  const location = {
    pathname: '/pages/search.html',
    search: initial.search || '',
  };
  function applyUrl(url) {
    if (!url || !url.startsWith('/')) return;
    const q = url.indexOf('?');
    location.pathname = q >= 0 ? url.slice(0, q) : url;
    location.search = q >= 0 ? url.slice(q) : '';
  }
  const history = {
    pushState: (_s, _t, url) => {
      historyCalls.push({ type: 'push', url });
      applyUrl(url);
    },
    replaceState: (_s, _t, url) => {
      historyCalls.push({ type: 'replace', url });
      applyUrl(url);
    }
  };

  const previewCalls = [];
  const clearCalls = [];
  const hydrateCalls = [];
  const fetchCalls = [];

  const state = {
    allTrees: initial.allTrees || [],
    growingTrees: initial.growingTrees || [],
    selectedTreeId: initial.selectedTreeId || null,
    currentQuery: initial.currentQuery || '',
    currentCategory: initial.currentCategory || '전체',
    initialTreeDeepLinkApplied: initial.initialTreeDeepLinkApplied || false,
    pendingUnknownTreeDeepLink: initial.pendingUnknownTreeDeepLink || false,
    urlStateReady: true,
    isRestoringUrlState: false
  };

  const sandbox = {
    URLSearchParams,
    URL,
    console,
    history,
    location,
    window: null,
    apiClient: {
      getPublicTreePreview: async ({ id }) => {
        fetchCalls.push(id);
        if (initial.fetchTree && initial.fetchTree.id === id) return initial.fetchTree;
        throw new Error('not found');
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.window.location = location;
  sandbox.window.history = history;
  sandbox.window.LoveBudSearchAdapter = {
    filterTrees(trees, query, category) {
      if (!Array.isArray(trees)) return [];
      return trees.filter((t) => {
        const qOk = !query || String(t.title || '').toLowerCase().includes(String(query).toLowerCase());
        const cOk = !category || category === '전체' || category === '전체 경로' || t.stage === category;
        return qOk && cOk;
      });
    }
  };

  // URL writer matching production semantics used by the controller.
  sandbox.window.updateUrlState = function updateUrlState(options) {
    const historyMode = options && options.historyMode ? options.historyMode : 'push';
    if (historyMode === 'none') return;
    if (state.isRestoringUrlState || !state.urlStateReady) return;
    const params = new URLSearchParams(location.search);
    if (state.selectedTreeId) params.set('tree', String(state.selectedTreeId));
    else params.delete('tree');
    const newSearch = params.toString();
    const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    const currentUrl = location.pathname + location.search;
    if (newUrl === currentUrl) return;
    if (historyMode === 'replace') history.replaceState(null, '', newUrl);
    else history.pushState(null, '', newUrl);
  };

  vm.createContext(sandbox);
  vm.runInContext(previewSrc, sandbox, { filename: 'search-preview-controller.js' });

  const ui = {
    markActiveCard() {},
    isMobilePreviewMode() { return false; },
    setMobilePreviewOpen() {},
    clearSelectedPreview() {
      clearCalls.push(true);
      state.selectedTreeId = null;
    }
  };
  const previewCacheApi = {
    writePreviewCache() {},
  };
  const dataApi = {
    hydrateSelectedTreePreview(tree) {
      hydrateCalls.push(tree && tree.id);
    }
  };
  const PreviewRenderer = {
    updatePreview(tree) {
      previewCalls.push(tree && tree.id);
    }
  };

  const controller = sandbox.window.LoveBudSearchPreviewController.createSearchPreviewController({
    refs: { resultsList: null, growingList: null },
    state,
    ui,
    previewCacheApi,
    dataApi,
    PreviewRenderer
  });

  return {
    controller,
    state,
    historyCalls,
    clearCalls,
    hydrateCalls,
    fetchCalls,
    previewCalls,
    location
  };
}

test('selection survives query filter when tree still matches', async () => {
  const treeA = { id: 'a', title: 'alpha heart', stage: '입덕', memories: [{ id: 'm1' }] };
  const treeB = { id: 'b', title: 'beta path', stage: '성장', memories: [{ id: 'm2' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA, treeB],
    selectedTreeId: 'a',
    currentQuery: 'alpha',
    search: '?tree=a'
  });
  h.state.initialTreeDeepLinkApplied = false;
  await h.controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.equal(h.state.selectedTreeId, 'a');
  assert.equal(h.clearCalls.length, 0);
  assert.ok(h.previewCalls.includes('a') || h.hydrateCalls.includes('a') || h.state.selectedTreeId === 'a');
});

test('query filter excluding selected tree clears selection and tree query via replace', async () => {
  const treeA = { id: 'a', title: 'alpha', stage: '입덕', memories: [{ id: 'm1' }] };
  const treeB = { id: 'b', title: 'beta', stage: '성장', memories: [{ id: 'm2' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA, treeB],
    selectedTreeId: 'a',
    currentQuery: 'zzzz-no-match',
    search: '?tree=a',
    initialTreeDeepLinkApplied: false
  });
  // Simulate filter reconciliation: tree is loaded but fails filter.
  await h.controller.applySelectedTreeFromUrl({ force: true, historyMode: 'none' });
  assert.equal(h.state.selectedTreeId, null);
  assert.ok(h.clearCalls.length >= 1);
  assert.equal(h.historyCalls.some((c) => c.type === 'push'), false, 'must not push');
  assert.ok(h.historyCalls.some((c) => c.type === 'replace'), 'must replace to drop tree');
  assert.equal(/tree=/.test(h.location.search), false);
  assert.equal(h.state.pendingUnknownTreeDeepLink, false);
});

test('category filter excluding selected tree clears selection', async () => {
  const treeA = { id: 'a', title: 'alpha', stage: '입덕', memories: [{ id: 'm1' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA],
    selectedTreeId: 'a',
    currentCategory: '성장',
    search: '?tree=a',
    initialTreeDeepLinkApplied: false
  });
  await h.controller.applySelectedTreeFromUrl({ force: true, historyMode: 'none' });
  assert.equal(h.state.selectedTreeId, null);
  assert.equal(/tree=/.test(h.location.search), false);
  assert.equal(h.historyCalls.some((c) => c.type === 'push'), false);
});

test('loaded but filtered-out URL tree is not selected and not replaced by first card', async () => {
  const treeA = { id: 'a', title: 'alpha', stage: '입덕', memories: [{ id: 'm1' }] };
  const treeB = { id: 'b', title: 'beta', stage: '성장', memories: [{ id: 'm2' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA, treeB],
    currentQuery: 'beta',
    search: '?tree=a',
    initialTreeDeepLinkApplied: false
  });
  await h.controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.equal(h.state.selectedTreeId, null);
  assert.equal(h.state.selectedTreeId === 'b', false, 'must not substitute first/other card');
  assert.equal(h.fetchCalls.length, 0, 'must not fetch when tree is already loaded');
});

test('no-filter unloaded deep link may fetch preview', async () => {
  const fetched = { id: 'far', title: 'far tree', stage: '입덕', memories: [{ id: 'm9' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [],
    currentQuery: '',
    currentCategory: '전체',
    search: '?tree=far',
    fetchTree: fetched,
    initialTreeDeepLinkApplied: false
  });
  await h.controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.deepEqual(h.fetchCalls, ['far']);
  assert.equal(h.state.selectedTreeId, 'far');
  assert.equal(h.state.pendingUnknownTreeDeepLink, false);
});

test('active filter blocks unloaded deep-link fetch bypass', async () => {
  const fetched = { id: 'far', title: 'far tree', stage: '입덕', memories: [{ id: 'm9' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [],
    currentQuery: 'something',
    currentCategory: '전체',
    search: '?tree=far',
    fetchTree: fetched,
    initialTreeDeepLinkApplied: false
  });
  await h.controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.equal(h.fetchCalls.length, 0, 'must not fetch when client filter is active');
  assert.equal(h.state.selectedTreeId, null);
  assert.equal(h.state.pendingUnknownTreeDeepLink, true);
});

test('fetched tree that fails post-fetch filter recheck is not selected', async () => {
  const fetched = { id: 'far', title: 'zzz', stage: '입덕', memories: [{ id: 'm9' }] };
  const location = { pathname: '/pages/search.html', search: '?tree=far' };
  function applyUrl(url) {
    const q = url.indexOf('?');
    location.pathname = q >= 0 ? url.slice(0, q) : url;
    location.search = q >= 0 ? url.slice(q) : '';
  }
  const historyCalls = [];
  const history = {
    pushState: (_s, _t, url) => { historyCalls.push({ type: 'push' }); applyUrl(url); },
    replaceState: (_s, _t, url) => { historyCalls.push({ type: 'replace' }); applyUrl(url); }
  };
  const state = {
    allTrees: [],
    growingTrees: [],
    selectedTreeId: null,
    currentQuery: '',
    currentCategory: '전체',
    initialTreeDeepLinkApplied: false,
    pendingUnknownTreeDeepLink: false,
    urlStateReady: true,
    isRestoringUrlState: false
  };
  const sandbox = {
    URLSearchParams,
    URL,
    console,
    history,
    location,
    apiClient: { getPublicTreePreview: async () => fetched },
    // No active client filter (전체 + empty query) so fetch is allowed, but post-fetch recheck fails.
    LoveBudSearchAdapter: { filterTrees: () => [] }
  };
  sandbox.window = sandbox;
  sandbox.window.updateUrlState = (options) => {
    const mode = options && options.historyMode ? options.historyMode : 'push';
    if (mode === 'none') return;
    const params = new URLSearchParams(location.search);
    if (state.selectedTreeId) params.set('tree', String(state.selectedTreeId));
    else params.delete('tree');
    const newSearch = params.toString();
    const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    if (newUrl === location.pathname + location.search) return;
    if (mode === 'replace') history.replaceState(null, '', newUrl);
    else history.pushState(null, '', newUrl);
  };
  vm.createContext(sandbox);
  vm.runInContext(previewSrc, sandbox, { filename: 'search-preview-controller.js' });
  const controller = sandbox.window.LoveBudSearchPreviewController.createSearchPreviewController({
    refs: { resultsList: null },
    state,
    ui: {
      markActiveCard() {},
      isMobilePreviewMode() { return false; },
      setMobilePreviewOpen() {},
      clearSelectedPreview() { state.selectedTreeId = null; }
    },
    previewCacheApi: { writePreviewCache() {} },
    dataApi: { hydrateSelectedTreePreview() {} },
    PreviewRenderer: { updatePreview() {} }
  });
  await controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.equal(state.selectedTreeId, null, 'post-fetch filter failure must not select');
  assert.equal(state.pendingUnknownTreeDeepLink, true);
  assert.equal(historyCalls.some((c) => c.type === 'push'), false);
});

test('popstate filtered-out tree is not selected and does not push', async () => {
  const treeA = { id: 'a', title: 'alpha', stage: '입덕', memories: [{ id: 'm1' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA],
    currentQuery: 'zzz',
    search: '?tree=a',
    selectedTreeId: 'a',
    initialTreeDeepLinkApplied: true
  });
  await h.controller.applySelectedTreeFromUrl({ force: true, historyMode: 'none' });
  assert.equal(h.state.selectedTreeId, null);
  assert.equal(h.historyCalls.some((c) => c.type === 'push'), false);
  assert.ok(h.historyCalls.every((c) => c.type === 'replace' || c.type === 'push'));
  assert.equal(h.historyCalls.filter((c) => c.type === 'push').length, 0);
});

test('valid card selection clears pendingUnknownTreeDeepLink', () => {
  const treeA = { id: 'a', title: 'alpha', stage: '입덕', memories: [{ id: 'm1' }] };
  const h = loadPreviewControllerHarness({
    allTrees: [treeA],
    pendingUnknownTreeDeepLink: true,
    search: ''
  });
  h.controller.selectTree(treeA, null, { historyMode: 'push' });
  assert.equal(h.state.pendingUnknownTreeDeepLink, false);
  assert.equal(h.state.selectedTreeId, 'a');
});

test('missing tree query clears pendingUnknownTreeDeepLink', async () => {
  const h = loadPreviewControllerHarness({
    allTrees: [],
    search: '',
    pendingUnknownTreeDeepLink: true,
    initialTreeDeepLinkApplied: false
  });
  await h.controller.applySelectedTreeFromUrl({ historyMode: 'none' });
  assert.equal(h.state.pendingUnknownTreeDeepLink, false);
});
