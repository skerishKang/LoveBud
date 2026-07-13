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
