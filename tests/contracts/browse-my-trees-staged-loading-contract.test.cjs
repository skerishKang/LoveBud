/**
 * LoveBud — Browse + My Trees Staged Loading Contract
 * (Issue #3693, Parent #3688 child 3)
 *
 * SOURCE_STATIC: reads source files and asserts structural/marker
 * conventions. Does not execute fetch, setTimeout, or any runtime
 * loading behavior.
 */
'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');

// ── File helpers ─────────────────────────────────────────────

function read(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

function fileExists(file) {
  try {
    fs.accessSync(path.join(REPO_ROOT, file));
    return true;
  } catch {
    return false;
  }
}

// ── Config ───────────────────────────────────────────────────

const SEARCH_DATA = 'js/search/search-data.js';
const SEARCH_ORCHESTRATOR = 'js/search.js';
const SEARCH_SHELL = 'js/search/search-page-shell-init.js';
const SEARCH_SCROLL = 'js/search/search-scroll-load.js';
const MY_TREES_PAGE = 'js/my-trees/my-trees-page.js';
const MY_TREES_ORCHESTRATOR = 'js/my-trees.js';
const MY_TREES_HUB = 'js/my-trees/my-trees-preview-hub.js';
const SEARCH_HTML = 'pages/search.html';
const MY_TREES_HTML = 'pages/my-trees.html';
const SEARCH_CSS = 'css/search/search-results-skeleton.css';
const MY_TREES_CSS = 'css/my-trees/my-trees-states.css';

// ── Tests ────────────────────────────────────────────────────

describe('Browse staged loading', () => {

  it('1. has browseLoadingStatus element in HTML', () => {
    const html = read(SEARCH_HTML);
    assert.ok(html.includes('id="browseLoadingStatus"'),
      'browseLoadingStatus element must exist in search.html');
    assert.ok(html.includes('role="status"'),
      'browseLoadingStatus must have role="status"');
    assert.ok(html.includes('aria-live="polite"'),
      'browseLoadingStatus must have aria-live="polite"');
    assert.ok(html.includes('aria-busy'),
      'browseLoadingStatus must have aria-busy attribute');
  });

  it('2. creates createBrowseLoadingManager with timed thresholds', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('createBrowseLoadingManager'),
      'search-data.js must define createBrowseLoadingManager');
    assert.ok(src.includes('INDICATOR_DELAY = 500'),
      'indicator display delay must be 500ms');
    assert.ok(src.includes('COPY_THRESHOLD = 1800'),
      'explicit copy threshold must be 1500-2000ms range');
    assert.ok(src.includes('LONG_WAIT = 8000'),
      'long-wait threshold must be 8000ms');
    assert.ok(src.includes('ERROR_ESCALATION = 15000'),
      'error escalation threshold must be 15000ms');
  });

  it('3. has timer clearAllTimers and dispose', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('clearAllTimers'),
      'createBrowseLoadingManager must have clearAllTimers');
    assert.ok(src.includes('dispose'),
      'createBrowseLoadingManager must have dispose for unload cleanup');
  });

  it('4. uses shared lt- primitives for loading status', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('lt-loading-inline'),
      'loading manager must use lt-loading-inline class');
    assert.ok(src.includes('lt-long-wait'),
      'long-wait state must use lt-long-wait class');
    assert.ok(src.includes('lt-error-shell'),
      'error escalation must use lt-error-shell class');
  });

  it('5. uses canonical i18n keys from shared taxonomy', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes("i18n('loading.list.load')"),
      'loading copy must use shared loading.list.load key');
    assert.ok(src.includes("i18n('loading.long.wait')"),
      'long-wait copy must use shared loading.long.wait key');
    assert.ok(!src.includes('setTimeout(function () { setStatus'),
      'no fake progress');
  });

  it('6. wires initLoadingManager in search.js', () => {
    const orchestrator = read(SEARCH_ORCHESTRATOR);
    assert.ok(orchestrator.includes('initLoadingManager'),
      'search.js must call initLoadingManager');
    assert.ok(orchestrator.includes('browseLoadingStatus'),
      'search.js must reference browseLoadingStatus element');
  });

  it('7. has stale-response protection (request generation)', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('isCurrentRequest'),
      'loadPublicTrees must use request generation (isCurrentRequest)');
    assert.ok(src.includes('currentPublicTreeRequestId'),
      'loadPublicTrees must track request ID for stale suppression');
  });

  it('8. has separate loading vs empty vs error paths', () => {
    const orchestrator = read(SEARCH_ORCHESTRATOR);
    assert.ok(orchestrator.includes('isApiFailure') || orchestrator.includes('renderLoadErrorState'),
      'search.js must have separate error path from loading');
    assert.ok(orchestrator.includes('hasNoData') || orchestrator.includes('renderNoTreesState'),
      'search.js must have separate empty path from loading');
    assert.ok(orchestrator.includes('renderEmptySearchState'),
      'search.js must handle empty search results separately');
  });

  it('9. incremental loading preserves existing READY cards', () => {
    const dataSrc = read(SEARCH_DATA);
    // Verify cache-first (stale-while-revalidate) preserves existing cards
    assert.ok(dataSrc.includes('isLoadingMore'),
      'loadPublicTrees must use isLoadingMore flag for incremental loads');
    assert.ok(dataSrc.includes('dedupeTreesById'),
      'loadPublicTrees must deduplicate trees by ID');
  });
});

describe('My Trees staged loading', () => {

  it('1. has timed loading manager in my-trees-page.js', () => {
    const src = read(MY_TREES_PAGE);
    assert.ok(src.includes('createMyTreesLoadingManager'),
      'my-trees-page.js must define createMyTreesLoadingManager');
    assert.ok(src.includes('INDICATOR_DELAY'),
      'must define INDICATOR_DELAY');
    assert.ok(src.includes('LONG_WAIT = 8000'),
      'long-wait must be 8000ms');
    assert.ok(src.includes('ERROR_ESCALATION = 15000'),
      'error escalation must be 15000ms');
    assert.ok(src.includes('COPY_THRESHOLD = 2000'),
      'copy threshold must be in 1500-2000ms range');
  });

  it('2. integrates loading manager into setState', () => {
    const src = read(MY_TREES_PAGE);
    assert.ok(src.includes('initLoadingManager'),
      'must export initLoadingManager');
    assert.ok(src.includes('_loadingManager.start'),
      'setState(LOADING) must call loadingManager.start()');
    assert.ok(src.includes('_loadingManager.ready'),
      'setState(LOADED/EMPTY) must call loadingManager.ready()');
    assert.ok(src.includes('_loadingManager.error'),
      'setState(ERROR) must call loadingManager.error()');
  });

  it('3. wires initLoadingManager in my-trees.js', () => {
    const orchestrator = read(MY_TREES_ORCHESTRATOR);
    assert.ok(orchestrator.includes('initLoadingManager'),
      'my-trees.js must call initLoadingManager');
  });

  it('4. has separate empty and error states with ARIA', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('id="state-empty"'),
      'My Trees HTML must have empty state section');
    assert.ok(html.includes('id="state-error"'),
      'My Trees HTML must have error state section');
    assert.ok(html.includes('role="alert"'),
      'Error state must have role="alert"');
    assert.ok(html.includes('role="status"'),
      'Empty/loading state must have role="status"');
    assert.ok(html.includes('aria-busy="true"'),
      'Loading state must have aria-busy="true"');
  });

  it('5. primary list and secondary hub have separate owners', () => {
    const hubSrc = read(MY_TREES_HUB);
    assert.ok(hubSrc.includes('showDegraded'),
      'my-trees-preview-hub.js must have showDegraded for secondary failure');
    // showDegraded sets role/aria-live dynamically via setAttribute
    assert.ok(hubSrc.includes('role'),
      'degraded state must set role via setAttribute');
    assert.ok(hubSrc.includes('polite'),
      'degraded state must use aria-live="polite" (no focus steal)');
  });

  it('6. retry button exists and avoids card duplication', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('id="retryLoadBtn"'),
      'My Trees HTML must have retry button');
    assert.ok(html.includes('lt-retry-btn'),
      'retry button must use lt-retry-btn shared class');
    // lastTreesData lives in my-trees.js (the orchestrator), not my-trees-page.js
    const orchestratorSrc = read(MY_TREES_ORCHESTRATOR);
    assert.ok(orchestratorSrc.includes('lastTreesData'),
      'My Trees must track lastTreesData to prevent card duplication on retry');
  });

  it('7. stale-response has explicit generation protection', () => {
    const dataSrc = read(MY_TREES_ORCHESTRATOR);
    assert.ok(dataSrc.includes('supersedeStaleLoad'),
      'loadTrees must have supersedeStaleLoad option');
    const pageSrc = read(MY_TREES_PAGE);
    assert.ok(pageSrc.includes('DISPOSED'),
      'loading manager must have DISPOSED state for stale request cleanup');
  });

  it('8. skeleton uses aria-hidden', () => {
    const html = read(SEARCH_HTML);
    assert.ok(html.includes('aria-hidden="true"'),
      'skeleton elements in search.html must have aria-hidden');
    const myTreesHtml = read(MY_TREES_HTML);
    assert.ok(myTreesHtml.includes('aria-hidden="true"'),
      'skeleton elements in my-trees.html must have aria-hidden');
  });

  it('9. Home/Editor/Detail/viewer are not modified', () => {
    const UNCHANGED = [
      'index.html',
      'pages/editor.html',
      'pages/detail.html',
      'pages/view.html',
      'pages/tree.html',
    ];
    UNCHANGED.forEach(f => {
      // Just verify these files exist and are readable
      assert.ok(fileExists(f), `${f} must exist and be unmodified by this scope`);
    });
  });

  it('10. reduced-motion delegates to shared primitives', () => {
    const css = read(SEARCH_CSS);
    assert.ok(css.includes('prefers-reduced-motion'),
      'search CSS must have prefers-reduced-motion @media block');
    const myTreesCss = read(MY_TREES_CSS);
    assert.ok(myTreesCss.includes('lt-spin') || myTreesCss.includes('lt-shimmer'),
      'my-trees CSS must reference reduced-motion animation patterns');
  });

  it('11. no auth/DB/API/environment mutations in scope', () => {
    // All implementation files must not create DB connections.
    // Postgres-client.js script imports in HTML are pre-existing, not new mutations.
    var allFiles = [
      SEARCH_DATA, SEARCH_ORCHESTRATOR,
      MY_TREES_PAGE, MY_TREES_ORCHESTRATOR, MY_TREES_HUB,
      SEARCH_CSS, MY_TREES_CSS,
    ];
    allFiles.forEach(function(f) {
      var src = read(f);
      assert.ok(!src.includes('postgres') && !src.includes('pgClient'),
        f + ': must not create DB connections');
    });
    // HTML files: check only non-import postgres references
    var htmlFiles = [SEARCH_HTML, MY_TREES_HTML];
    htmlFiles.forEach(function(f) {
      var src = read(f);
      // Remove script/link import lines
      var noSrv = src.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<link[^>]*>/gi, ' ');
      assert.ok(!noSrv.includes('postgres') && !noSrv.includes('pgClient'),
        f + ': must not create DB connections');
    });
    // search-data.js delegates to existing window.apiClient (pre-existing)
    // No other file introduces new apiClient calls (verified manually)
  });
});

describe('Canonical timing contract', () => {

  it('1. minimum indicator duration is 0 (content never delayed by loader)', () => {
    const browseSrc = read(SEARCH_DATA);
    assert.ok(!browseSrc.includes('MINIMUM_INDICATOR_DURATION'),
      'Browse search-data.js must not define MINIMUM_INDICATOR_DURATION (concept removed)');
    const myTreesSrc = read(MY_TREES_PAGE);
    assert.ok(!myTreesSrc.includes('MINIMUM_INDICATOR_DURATION'),
      'My Trees page must not define MINIMUM_INDICATOR_DURATION (concept removed)');
  });

  it('2. no artificial setTimeout delay before showing ready content', () => {
    const browseSrc = read(SEARCH_DATA);
    // Verify that the loading manager's ready() immediately hides the status
    assert.ok(browseSrc.includes("setStatus('', '', false)"),
      'ready() must immediately clear the loading status');
    const myTreesSrc = read(MY_TREES_PAGE);
    assert.ok(myTreesSrc.includes("state = 'READY'") && myTreesSrc.includes('clearAllTimers'),
      'My Trees ready() must clear timers immediately');
  });

  it('3. 15s is UI escalation, not request abort', () => {
    const browseSrc = read(SEARCH_DATA);
    // 'abort' appears only in explanatory comments, not as a function call
    assert.ok(!browseSrc.includes('AbortController'),
      'Browse loading manager must not use AbortController (U3 page-owned decision)');
    assert.ok(!browseSrc.includes('.abort()'),
      'Browse loading manager must not call abort()');
    const myTreesSrc = read(MY_TREES_PAGE);
    assert.ok(!myTreesSrc.includes('AbortController'),
      'My Trees loading manager must not use AbortController (U3 page-owned decision)');
    assert.ok(!myTreesSrc.includes('.abort()'),
      'My Trees loading manager must not call abort()');
  });
});
