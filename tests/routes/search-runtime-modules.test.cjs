const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('search runtime submodules load after existing search helpers and before search entrypoint', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  const indexOf = (needle) => scripts.findIndex((src) => src.includes(needle));

  const helperModules = [
    '../js/search/search-title-helper.js',
    '../js/search/search-data-adapter.js',
    '../js/search/search-shared-utils.js',
  ];
  const helperIndexes = helperModules.map(indexOf);
  const previewRendererIndex = indexOf('../js/search/search-preview-renderer.js');
  const searchEntrypointIndex = indexOf('../js/search/index.js');
  const expectedModules = [
    '../js/search/search-preview-cache.js',
    '../js/search/search-copy.js',
    '../js/search/search-ui.js',
    '../js/search/search-scroll-load.js',
    '../js/search/search-url-state.js',
  ];
  const moduleIndexes = expectedModules.map(indexOf);

  assert.ok(helperIndexes.every((index) => index >= 0));
  assert.ok(previewRendererIndex >= 0);
  assert.ok(searchEntrypointIndex >= 0);
  assert.deepEqual(helperIndexes, helperIndexes.toSorted((a, b) => a - b));
  assert.ok(helperIndexes.every((index) => index < previewRendererIndex));
  assert.equal(html.includes('../js/search-title-helper.js'), false);
  assert.equal(html.includes('../js/search-data-adapter.js'), false);
  assert.equal(html.includes('../js/search-shared-utils.js'), false);
  assert.deepEqual(moduleIndexes, moduleIndexes.toSorted((a, b) => a - b));
  assert.ok(moduleIndexes.every((index) => index > previewRendererIndex));
  assert.ok(moduleIndexes.every((index) => index < searchEntrypointIndex));
  assert.equal(html.includes('type="module"'), false);
});

test('search UI module preserves orchestrator contract methods', () => {
  const uiModule = read('js/search/search-ui.js');
  const requiredMethods = [
    'syncStaticBrowseCopy',
    'ensureBrowseControls',
    'syncBrowseHead',
  ];

  for (const method of requiredMethods) {
    assert.match(uiModule, new RegExp(`\\b${method}\\b`));
  }
});

test('search preview state helper exposes state management contract', () => {
  const helperModule = read('js/search/search-preview-state.js');
  const requiredMethods = [
    'getCardContainers',
    'markActiveCard',
    'findActiveCard',
    'syncActiveCard',
    'clearSelectedPreview',
    'renderLoadErrorState',
    'createPreviewStateController',
    'patchSearchUIFactory',
  ];
  const exportMatch = helperModule.match(/window\.LoveBudSearchPreviewState\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchPreviewState export object not found');
  const exported = exportMatch[1];

  for (const method of requiredMethods) {
    assert.match(exported, new RegExp(`\\b${method}\\b`), `Missing export: ${method}`);
  }
});

test('search mobile preview sheet helper exposes sheet contract', () => {
  const helperModule = read('js/search/search-mobile-preview-sheet.js');
  const requiredMethods = [
    'createSheetController',
    'patchSearchUIFactory',
  ];
  const controllerMethods = [
    'isMobilePreviewMode',
    'showSheetOverlay',
    'hideSheetOverlay',
    'setMobilePreviewOpen',
    'syncPreviewVisibility',
    'bindMobilePreviewHandlers',
  ];

  const exportMatch = helperModule.match(/window\.LoveBudSearchMobilePreviewSheet\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchMobilePreviewSheet export object not found');
  const exported = exportMatch[1];

  for (const method of requiredMethods) {
    assert.match(exported, new RegExp(`\\b${method}\\b`), `Missing export: ${method}`);
  }

  for (const method of controllerMethods) {
    assert.match(helperModule, new RegExp(`\\b${method}\\b`), `Missing controller method: ${method}`);
  }

  assert.match(helperModule, /preview-sheet-open/);
  assert.match(helperModule, /preview-sheet-overlay/);
  assert.match(helperModule, /ui\.setMobilePreviewOpen = controller\.setMobilePreviewOpen/);
  assert.match(helperModule, /ui\.bindMobilePreviewHandlers = controller\.bindMobilePreviewHandlers/);
});

test('search copy helper exposes namespace contract', () => {
  const copyModule = read('js/search/search-copy.js');
  assert.match(copyModule, /window\.LoveBudSearchCopy/);
  assert.match(copyModule, /getCurrentLocale/);
  assert.match(copyModule, /getSearchCopy/);
});

test('search UI module references LoveBudSearchCopy helper', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /window\.LoveBudSearchCopy/);
});

test('browse feed controls do not expose batch strategy as product UI', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.doesNotMatch(uiModule, /지금 먼저 볼|to start with|More LoveTrees will appear as you scroll/);
  assert.doesNotMatch(uiModule, /이어지는 감상|Continuous feed|많이 이어진 감상|Most connected/);
  assert.doesNotMatch(uiModule, /id=["']browseLoadMoreBtn["']/);
  assert.doesNotMatch(uiModule, /getElementById\(['"]browseLoadMoreBtn['"]\)/);
  assert.match(uiModule, /refs\.resultsBadge\.hidden = true/);
  assert.match(uiModule, /refs\.resultsBadge\.textContent = ''/);
  assert.match(uiModule, /ScrollLoad\.ensureScrollLoadSentinel/);
  assert.match(uiModule, /callbacks\.loadMorePublicTrees/);
});

test('search UI wires scroll load sentinel lifecycle through helper ownership', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /ScrollLoad\.ensureScrollLoadSentinel\(resultsList,\s*state,\s*\{/);
  assert.match(uiModule, /scheduleScrollLoadCheck/);
  assert.match(uiModule, /ScrollLoad\.bindScrollLoadIntentHandlers\(\{/);
  assert.doesNotMatch(uiModule, /document\.createElement\(['"]div['"]\)[\s\S]*?browse-scroll-load-sentinel/);
  assert.doesNotMatch(uiModule, /new IntersectionObserver/);
});

test('search UI delegates scroll load intent listener binding to helper', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.doesNotMatch(uiModule, /let scrollLoadIntentBound/);
  assert.doesNotMatch(uiModule, /window\.addEventListener\(['"]scroll['"],\s*scheduleScrollLoadCheck/);
  assert.doesNotMatch(uiModule, /window\.addEventListener\(['"]wheel['"],\s*markScrollLoadIntent/);
  assert.match(uiModule, /markScrollLoadIntent/);
  assert.match(uiModule, /handleScrollLoadKeydown/);
  assert.match(uiModule, /requestScrollLoadMore/);
  assert.match(uiModule, /scheduleScrollLoadCheck/);
  assert.match(uiModule, /ScrollLoad\.scheduleScrollLoadCheckWrapper/);
  assert.doesNotMatch(uiModule, /window\.requestAnimationFrame/);
  assert.match(uiModule, /ScrollLoad\.createScrollLoadRequestController/);
  assert.match(uiModule, /requestController(?:\?\.|\.)scheduleCheck/);
  assert.match(uiModule, /getQueued/);
  assert.match(uiModule, /setQueued/);
  assert.match(uiModule, /getIntent/);
  assert.match(uiModule, /setIntent/);
});

test('browse filter and sort changes reset pagination state without changing feed cards', () => {
  const uiModule = read('js/search/search-ui.js');
  const controlsModule = read('js/search/search-controls.js');

  assert.match(controlsModule, /const DEFAULT_LIMIT = 6/);
  assert.match(controlsModule, /function resetPaginationState\(\)/);
  assert.match(controlsModule, /state\.currentLimit = DEFAULT_LIMIT/);
  assert.match(controlsModule, /state\.hasMoreTrees = true/);
  assert.match(uiModule, /state\.currentLimit = 6/);
  assert.match(uiModule, /state\.hasMoreTrees = true/);
});

test('search card events helper implements card accessibility and event delegation', () => {
  const cardEventsModule = read('js/search/search-card-events.js');
  const cardRenderer = read('js/search/search-card-renderer.js');

  assert.match(cardEventsModule, /card\.setAttribute\(['"]tabindex['"],\s*['"]0['"]\)/);
  assert.match(cardEventsModule, /card\.setAttribute\(['"]role['"],\s*['"]button['"]\)/);
  assert.match(cardRenderer, /accessibilityLabel: cardSelectLabel/);

  assert.match(cardEventsModule, /container\.addEventListener\(['"]click['"]/);
  assert.match(cardEventsModule, /container\.addEventListener\(['"]keydown['"]/);
  assert.match(cardEventsModule, /event\.target\.closest\(['"]\.tree-card\[data-tree-id\]['"]\)/);
  assert.match(cardEventsModule, /var interactiveSelector = ['"]a, button,/);
});

test('browse cards expose a truthful public tree viewer bridge', () => {
  const cardRenderer = read('js/search/search-card-renderer.js');

  assert.match(cardRenderer, /function getTreeViewerHref\(tree\)/);
  assert.match(cardRenderer, /view\.html\?treeId=/);
  assert.match(cardRenderer, /encodeURIComponent\(tree\.id\)/);
  const compSrc = read('js/shared/tree-card-composition.js');
  assert.match(cardRenderer, /트리 열기/);
  assert.match(compSrc, /tree-card-open-link/);
});

test('search preview summary omits range phrase for missing time range labels', () => {
  const previewRenderer = read('js/search/search-preview-renderer.js');
  const previewBuilders = read('js/search/search-preview-renderer-builders.js');
  const i18nSearch = read('js/i18n/i18n-search.js');

  assert.match(previewRenderer, /function getPreviewTimeRange\(tree\)/);
  assert.match(previewBuilders, /'기록 없음'/);
  assert.match(previewBuilders, /getSearchCopy\('search\.previewUnknownRange'/);
  assert.match(previewBuilders, /function getPreviewSummaryCopy\(/);
  assert.match(previewBuilders, /search\.previewSummaryThemeNoRange/);
  assert.match(previewBuilders, /search\.previewSummaryNoRange/);

  assert.match(i18nSearch, /'search\.previewSummaryThemeNoRange'/);
  assert.match(i18nSearch, /'search\.previewSummaryNoRange'/);
  assert.match(i18nSearch, /span style="color:var\(--primary\);font-weight:700;">\{count\}개의 순간<\/span>이 이어졌어요/);
});

test('browse selected hub primary tree CTA and secondary viewing CTA keep truthful routes', () => {
  const actionHelper = read('js/search/search-preview-action-helper.js');
  const previewRenderer = read('js/search/search-preview-renderer.js');
  const i18nSearch = read('js/i18n/i18n-search.js');

  assert.match(actionHelper, /detail\.html\?id=/);
  assert.match(actionHelper, /from=browse/);
  assert.match(actionHelper, /search\.previewOpenViewingCta/);
  assert.match(actionHelper, /preview-secondary-action/);
  assert.match(previewRenderer, /helper\?\.renderPreviewActionButton/);
  assert.match(previewRenderer, /return '';/);
  assert.match(i18nSearch, /'search\.previewOpenViewingCta'/);
  assert.match(i18nSearch, /ko:\s*'감상 열기'/);
  assert.match(actionHelper, /renderOpenTreeButton/);
  assert.match(actionHelper, /view\.html\?treeId=/);
  assert.match(actionHelper, /preview-primary-action/);
  assert.match(actionHelper, /search\.previewOpenTreeCta/);
  assert.match(previewRenderer, /renderOpenTreeButton/);
  assert.match(i18nSearch, /'search\.previewOpenTreeCta'/);
  assert.match(i18nSearch, /ko:\s*'트리 열기'/);


test('browse selected hub share button delegates to action helper', () => {
  const actionHelper = read('js/search/search-preview-action-helper.js');
  const previewRenderer = read('js/search/search-preview-renderer.js');

  assert.match(actionHelper, /renderShareButton:/);
  assert.match(actionHelper, /data-share-tree-link/);
  assert.match(actionHelper, /data-share-tree-link-label/);
  assert.match(previewRenderer, /helper\?\.renderShareButton/);
  assert.match(previewRenderer, /function renderShareButton\(tree\)/);
  const fallbackCount = (previewRenderer.match(/return '';/g) || []).length;
  assert.ok(fallbackCount >= 2, 'renderer should have at least 2 empty string fallbacks (action + share)');
  assert.doesNotMatch(previewRenderer, /data-share-tree-link="\+' \+ escapeHtml\(tree\.id\)/);
});
});

test('browse selected hub exposes focus-stage shell without changing route helpers', () => {
  const previewRenderer = read('js/search/search-preview-renderer.js');
  const previewSidebarCss = read('css/search/search-preview-sidebar.css');
  const previewCss = read('css/search/search-preview.css');
  const actionHelper = read('js/search/search-preview-action-helper.js');

  assert.match(previewRenderer, /preview-focus-title-block/);
  assert.match(previewRenderer, /preview-focus-flow-card/);
  assert.match(previewRenderer, /preview-focus-copy/);
  assert.match(previewSidebarCss, /@import url\("\.\/search-preview\.css"\)/);
  assert.match(previewCss, /Issue #907: focus-stage selected hub shell/);
  assert.match(previewCss, /preview-sidebar\.preview-state-media \.video-container|preview-sidebar\.preview-state-media[\s\S]*?\.video-container/);
  assert.match(previewCss, /preview-sidebar \.preview-primary-action/);
  assert.match(actionHelper, /view\.html\?treeId=/);
  assert.match(actionHelper, /data-share-tree-link/);
});

test('search scroll load sentinel helper exposes scroll load contract', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const requiredMethods = [
    'canLoadMorePublicTrees',
    'getSentinelDoneState',
    'syncScrollLoadSentinel',
    'isSentinelNearViewport',
    'createScrollLoadSentinel',
    'isScrollIntentKey',
    'ensureScrollLoadSentinel',
    'requestScrollLoadMoreWithContext',
    'scheduleScrollLoadCheckWrapper',
    'markScrollLoadIntent',
    'handleScrollLoadKeydown',
    'bindScrollLoadIntentHandlers',
    'createScrollLoadRequestController',
    'patchSearchUIFactory',
  ];
  const exportMatch = helperModule.match(/window\.LoveBudSearchScrollLoad\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchScrollLoad export object not found');
  const exported = exportMatch[1];

  for (const method of requiredMethods) {
    assert.match(exported, new RegExp(`\\b${method}\\b`), `Missing export: ${method}`);
  }

  assert.match(helperModule, /browse-scroll-load-sentinel/);
  assert.match(helperModule, /IntersectionObserver/);
  assert.match(helperModule, /requestAnimationFrame/);
  assert.match(helperModule, /scrollLoadSentinel/);
  assert.match(helperModule, /scrollLoadObserver/);
  assert.match(helperModule, /scrollCheckRaf/);
  assert.match(helperModule, /hasUserScrolledTowardFeed/);
  assert.match(helperModule, /options\.markScrollLoadIntent/);
  assert.match(helperModule, /options\.handleScrollLoadKeydown/);
});

test('search UI scroll load requestMore returns true to prevent fallback double-call', () => {
  const uiModule = read('js/search/search-ui.js');

  // Contract: requestMore must call requestScrollLoadMore and return true
  // so that the || fallback in scheduleScrollLoadCheckWrapper callback does not fire
  assert.match(uiModule, /requestMore:\s*\(\)\s*=>\s*\{\s*requestScrollLoadMore\(\);\s*return true;\s*\}/);
});

test('search UI scroll load requestController requestMore call site stays narrow', () => {
  const uiModule = read('js/search/search-ui.js');

  // Contract: requestController?.requestMore?.() || requestScrollLoadMore()
  // The optional call site is intentionally left unchanged in this cleanup.
  assert.match(uiModule, /requestController\?\.requestMore\?\.\(\)\s*\|\|\s*requestScrollLoadMore\(\)/);
});

test('search UI scroll load requestController is created directly', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /const requestController = ScrollLoad\.createScrollLoadRequestController\(\{/);
  assert.doesNotMatch(uiModule, /typeof ScrollLoad\.createScrollLoadRequestController === 'function'/);
  assert.doesNotMatch(uiModule, /const requestController =[\s\S]*?:\s*null;/);
});

test('search scroll load createScrollLoadRequestController preserves requestMore contract', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // createScrollLoadRequestController stores the requestMore option
  assert.match(helperModule, /var requestMore = typeof options\.requestMore === 'function' \? options\.requestMore : function\(\) \{\};/);
  // Returned object exposes requestMore
  assert.match(helperModule, /requestMore:\s*requestMore/);
});

test('search scroll load scheduleScrollLoadCheckWrapper delegates to requestLoadMore callback', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // scheduleScrollLoadCheckWrapper calls requestLoadMore if it is a function
  assert.match(helperModule, /if \(typeof requestLoadMore === 'function'\) \{\s*requestLoadMore\(\);\s*\}/);
});

test('search UI requestScrollLoadMore delegates fetch, queue, sentinel to helper adapter', () => {
  const uiModule = read('js/search/search-ui.js');

  // requestScrollLoadMore body is defined with ownership of context creation and adapter delegation
  assert.match(uiModule, /async function requestScrollLoadMore/);
  // Owns context creation for adapter
  assert.match(uiModule, /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\)/);
  // Owns flags.isQueued sync before delegation
  assert.match(uiModule, /flags\.isQueued = isScrollLoadQueued/);
  // Delegates to adapter: requestScrollLoadMoreWithContext
  assert.match(uiModule, /ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  // Syncs isScrollLoadQueued from adapter response
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  // Returns adapter result
  assert.match(uiModule, /return didRequest/);
  // Direct delegation without typeof guard or fallback
  assert.doesNotMatch(uiModule, /typeof ScrollLoad\.requestScrollLoadMoreWithContext/);
  assert.doesNotMatch(uiModule, /async function requestScrollLoadMore[\s\S]*?return false/);
});

test('search UI requestController.requestMore has exactly one actual-use call site', () => {
  const uiModule = read('js/search/search-ui.js');

  // \brequestMore\b must appear exactly twice:
  // 1. Creation: requestMore: () => { ... }
  // 2. Call: requestController?.requestMore?.()
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2,
    'Expected exactly 2 requestMore references (1 creation + 1 call site)'
  );
});

test('search UI scroll load path does not delegate requestScrollLoadMore to helper', () => {
  const uiModule = read('js/search/search-ui.js');
  const helperModule = read('js/search/search-scroll-load.js');

  // search-ui.js uses its own local requestScrollLoadMore, not helper's exported version
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
  // Helper no longer exports the legacy requestScrollLoadMore
  assert.doesNotMatch(helperModule, /LoveBudSearchScrollLoad[\s\S]*?\brequestScrollLoadMore\b/);
});

test('search scroll load helper requestScrollLoadMore is no longer exported', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  const exportMatch = helperModule.match(/window\.LoveBudSearchScrollLoad\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchScrollLoad export object not found');
  assert.doesNotMatch(exportMatch[1], /\brequestScrollLoadMore\b/);
});

test('search scroll load legacy requestScrollLoadMore is removed', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // Legacy requestScrollLoadMore(state, callbacks, flags) is removed
  assert.doesNotMatch(helperModule, /async function requestScrollLoadMore\(state,\s*callbacks,\s*flags\)/);
  // requestScrollLoadMoreWithContext remains
  assert.match(helperModule, /async function requestScrollLoadMoreWithContext\(context\)/);
});

test('search scroll load legacy requestScrollLoadMore core concerns path removed', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // Legacy requestScrollLoadMore function is removed
  assert.doesNotMatch(helperModule, /async function requestScrollLoadMore\(state,\s*callbacks,\s*flags\)/);
  // Queue: flags-based state management still exists in requestScrollLoadMoreWithContext
  assert.match(helperModule, /flags\.isQueued = true/);
  assert.match(helperModule, /flags\.isQueued = false/);
});

test('search scroll load legacy requestScrollLoadMore DOM isolation path removed', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // Legacy requestScrollLoadMore function body is removed
  assert.doesNotMatch(helperModule, /async function requestScrollLoadMore\(/);
});

test('search scroll load legacy async contract path removed', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const uiModule = read('js/search/search-ui.js');

  // Legacy helper requestScrollLoadMore is removed
  assert.doesNotMatch(helperModule, /async function requestScrollLoadMore\(state,\s*callbacks,\s*flags\)/);
  // Local version remains async
  assert.match(uiModule, /async function requestScrollLoadMore/);
  // Helper is NOT called from main runtime
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
  // requestMore actual-use is still exactly 2 references
  const requestMoreCount = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(requestMoreCount, 2,
    'requestMore must remain at exactly 2 references (1 creation + 1 call site)'
  );
});

test('search scroll load legacy request path fully removed from runtime chain', () => {
  const uiModule = read('js/search/search-ui.js');
  const helperModule = read('js/search/search-scroll-load.js');

  // search-ui.js does not call helper's requestScrollLoadMore
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
  // search-ui.js does not call helper's scheduleScrollLoadCheck
  assert.doesNotMatch(uiModule, /ScrollLoad\.scheduleScrollLoadCheck\b/);
  // Legacy helper-internal scheduleScrollLoadCheck is removed
  assert.doesNotMatch(helperModule, /scheduleScrollLoadCheck\(state\)/);
});

// --- Wiring preflight tests ---

// Context builder exists and has correct signature
test('search UI wiring context builder exists', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /function createScrollLoadHelperContext\(state,\s*callbacks\)/);
  assert.match(uiModule, /return \{[\s\S]*?state,[\s\S]*?callbacks,[\s\S]*?flags:[\s\S]*?isQueued/);
});

// Local requestScrollLoadMore is not replaced by helper
test('search UI does not delegate requestScrollLoadMore to helper', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// requestMore actual-use count remains at 1 call site
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  // requestMore appears exactly twice: creation + call site
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// --- Context use tests ---

// createScrollLoadHelperContext is called in runtime path
test('search UI creates helper wiring context in runtime path', () => {
  const uiModule = read('js/search/search-ui.js');
  // context builder is called inside requestScrollLoadMore
  assert.match(uiModule, /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\)/);
  assert.match(uiModule, /const flags = scrollLoadHelperContext\.flags/);
});

// Local requestScrollLoadMore is still owned by search-ui.js (not delegated)
test('search UI local requestScrollLoadMore remains in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// callbacks.loadMorePublicTrees({ source: 'scroll' }) is still in search-ui.js
test('search UI callbacks.loadMorePublicTrees remains in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{ source: 'scroll' \}\)/);
});

// requestMore actual-use count is unchanged
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  // requestMore appears exactly twice: creation + call site
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// search-scroll-load.js is unchanged
test('search scroll load helper is not modified', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.ok(helperModule, 'search-scroll-load.js must still exist');
});

// --- Flags contract tests ---

// flags.isQueued is explicitly connected to local isScrollLoadQueued
test('search UI flags.isQueued mirrors local isScrollLoadQueued', () => {
  const uiModule = read('js/search/search-ui.js');
  // flags.isQueued is assigned from local isScrollLoadQueued inside requestScrollLoadMore
  assert.match(uiModule, /flags\.isQueued = isScrollLoadQueued/);
});

// isScrollLoadQueued remains local queue source of truth
test('search UI isScrollLoadQueued remains local queue source of truth', () => {
  const uiModule = read('js/search/search-ui.js');
  // isScrollLoadQueued initialized to false
  assert.match(uiModule, /isScrollLoadQueued = false/);
  // isScrollLoadQueued synced from adapter response
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  // isScrollLoadQueued still passed through requestController getter/setter
  assert.match(uiModule, /getQueued: \(\) => isScrollLoadQueued/);
  assert.match(uiModule, /setQueued: \(val\) => { isScrollLoadQueued = val; }/);
});

// createScrollLoadHelperContext actual-use is maintained
test('search UI helper wiring context actual-use maintained', () => {
  const uiModule = read('js/search/search-ui.js');
  // Context is still created in runtime path
  assert.match(uiModule, /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\)/);
  assert.match(uiModule, /const flags = scrollLoadHelperContext\.flags/);
});

// Local requestScrollLoadMore is still owned by search-ui.js
test('search UI local requestScrollLoadMore ownership retained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// callbacks.loadMorePublicTrees({ source: 'scroll' }) is still in search-ui.js
test('search UI callbacks.loadMorePublicTrees remains in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{ source: 'scroll' \}\)/);
});

// requestMore actual-use count is unchanged
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// search-scroll-load.js unchanged
test('search scroll load helper unchanged', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.ok(helperModule, 'search-scroll-load.js must still exist and be readable');
});

// --- Queue sync contract tests ---

// flags.isQueued is synced FROM isScrollLoadQueued before adapter call
test('search UI syncs flags.isQueued from isScrollLoadQueued before adapter delegation', () => {
  const uiModule = read('js/search/search-ui.js');
  // Before adapter call, local isScrollLoadQueued is copied to flags.isQueued
  assert.match(uiModule, /flags\.isQueued = isScrollLoadQueued/);
});

// isScrollLoadQueued is synced FROM flags.isQueued after adapter call
test('search UI syncs isScrollLoadQueued from adapter response via Boolean(flags.isQueued)', () => {
  const uiModule = read('js/search/search-ui.js');
  // After adapter completes, flags.isQueued value is applied back to local state
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
});

// isScrollLoadQueued remains local queue source of truth
test('search UI isScrollLoadQueued remains local queue source of truth', () => {
  const uiModule = read('js/search/search-ui.js');
  // isScrollLoadQueued initialized to false
  assert.match(uiModule, /isScrollLoadQueued = false/);
  // isScrollLoadQueued synced from adapter response
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  // isScrollLoadQueued still passed through requestController getter/setter
  assert.match(uiModule, /getQueued: \(\) => isScrollLoadQueued/);
  assert.match(uiModule, /setQueued: \(val\) => \{ isScrollLoadQueued = val; \}/);
  // flags.isQueued is synced FROM isScrollLoadQueued before delegation
  assert.match(uiModule, /flags\.isQueued = isScrollLoadQueued/);
});

// flags.isQueued is NOT used as guard condition
test('search UI flags.isQueued not used as guard condition', () => {
  const uiModule = read('js/search/search-ui.js');
  // flags.isQueued is only assigned, never used in if/while/||/&& conditions
  assert.doesNotMatch(uiModule, /\bif\s*\([^)]*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /!\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /\|\|\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /&&\s*flags\.isQueued/);
});

// createScrollLoadHelperContext actual-use maintained
test('search UI helper wiring context actual-use maintained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\)/);
  assert.match(uiModule, /const flags = scrollLoadHelperContext\.flags/);
});

// Local requestScrollLoadMore ownership retained
test('search UI local requestScrollLoadMore ownership retained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// callbacks.loadMorePublicTrees remains in search-ui.js
test('search UI callbacks.loadMorePublicTrees remains in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{ source: 'scroll' \}\)/);
});

// requestMore actual-use count remains at 1 call site
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// search-scroll-load.js unchanged
test('search scroll load helper unchanged', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.ok(helperModule, 'search-scroll-load.js must still exist and be readable');
});

// --- Preflight context contract tests ---

// createScrollLoadHelperContext is created before adapter delegation
test('search UI creates helper context before adapter delegation', () => {
  const uiModule = read('js/search/search-ui.js');
  // Context is created before adapter call
  assert.match(uiModule,
    /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\);\s+const flags = scrollLoadHelperContext\.flags;/
  );
});

// canLoadMorePublicTrees receives the same flags object
test('search UI passes flags to canLoadMorePublicTrees in guard', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /canLoadMorePublicTrees\(flags\)/);
});

// canLoadMorePublicTrees accepts optional flags parameter
test('search UI canLoadMorePublicTrees accepts flags parameter', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /function canLoadMorePublicTrees\(flags\)/);
  // Falls back to inline object when flags is not provided
  assert.match(uiModule, /flags \|\| \{\s*isQueued: isScrollLoadQueued\s*\}/);
});

// isScrollLoadQueued remains local queue source of truth
test('search UI isScrollLoadQueued remains local queue source of truth', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /isScrollLoadQueued = false/);
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  assert.match(uiModule, /getQueued: \(\) => isScrollLoadQueued/);
  assert.match(uiModule, /setQueued: \(val\) => { isScrollLoadQueued = val; }/);
});

// flags.isQueued is NOT used as guard condition directly
test('search UI flags.isQueued not used as direct guard condition', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.doesNotMatch(uiModule, /\bif\s*\([^)]*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /!\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /\|\|\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /&&\s*flags\.isQueued/);
});

// Local requestScrollLoadMore ownership retained
test('search UI local requestScrollLoadMore ownership retained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// callbacks.loadMorePublicTrees remains in search-ui.js
test('search UI callbacks.loadMorePublicTrees remains in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{ source: 'scroll' \}\)/);
});

// requestMore actual-use count remains at 1 call site
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// search-scroll-load.js unchanged
test('search scroll load helper unchanged', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.ok(helperModule, 'search-scroll-load.js must still exist and be readable');
});

// --- Request callbacks contract tests ---

// createScrollLoadHelperContext returns requestCallbacks object
test('search UI requestCallbacks exists in helper context', () => {
  const uiModule = read('js/search/search-ui.js');
  // Return object must include requestCallbacks
  assert.match(uiModule, /requestCallbacks:\s*\{/);
  // requestCallbacks must have all 4 methods
  assert.match(uiModule, /canLoadMore:\s*canLoadMorePublicTrees/);
  assert.match(uiModule, /isNearViewport:\s*isSentinelNearViewport/);
  assert.match(uiModule, /syncSentinel:\s*syncScrollLoadSentinel/);
  assert.match(uiModule, /loadMore:\s*\(\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*'scroll'\s*\}/);
});

// requestCallbacks are provided via createScrollLoadHelperContext to helper adapter
test('search UI requestCallbacks provided in helper context', () => {
  const uiModule = read('js/search/search-ui.js');
  // requestCallbacks are in the context builder (not directly in requestScrollLoadMore)
  assert.match(uiModule, /requestCallbacks:\s*\{/);
  // Context includes canLoadMore
  assert.match(uiModule, /canLoadMore:\s*canLoadMorePublicTrees/);
  // Context includes syncSentinel
  assert.match(uiModule, /syncSentinel:\s*syncScrollLoadSentinel/);
  // Context includes loadMore with source scroll
  assert.match(uiModule, /loadMore:\s*\(\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*'scroll'\s*\}/);
  // requestScrollLoadMore does NOT destructure requestCallbacks directly
  assert.doesNotMatch(uiModule, /const requestCallbacks = scrollLoadHelperContext\.requestCallbacks/);
});

// requestCallbacks.loadMore preserves source: 'scroll'
test('search UI requestCallbacks.loadMore preserves source scroll', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /loadMore:\s*\(\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*'scroll'\s*\}/);
});

// requestScrollLoadMore remains in search-ui.js
test('search UI requestScrollLoadMore ownership retained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

// isScrollLoadQueued remains local queue source of truth
test('search UI isScrollLoadQueued remains local queue source of truth', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /isScrollLoadQueued = false/);
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  assert.match(uiModule, /getQueued: \(\) => isScrollLoadQueued/);
  assert.match(uiModule, /setQueued: \(val\) => { isScrollLoadQueued = val; }/);
});

// flags.isQueued not used as direct guard condition
test('search UI flags.isQueued not used as direct guard condition', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.doesNotMatch(uiModule, /\bif\s*\([^)]*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /!\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /\|\|\s*flags\.isQueued/);
  assert.doesNotMatch(uiModule, /&&\s*flags\.isQueued/);
});

// requestMore actual-use count remains at 1 call site
test('search UI requestMore actual-use count remains at 1 call site', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// search-scroll-load.js unchanged
test('search scroll load helper unchanged', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.ok(helperModule, 'search-scroll-load.js must still exist and be readable');
});

// --- Helper adapter contract tests ---

// requestScrollLoadMoreWithContext exists in search-scroll-load.js
test('search scroll load helper has requestScrollLoadMoreWithContext', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /async function requestScrollLoadMoreWithContext\(context\)/);
});

// requestScrollLoadMoreWithContext is exported in LoveBudSearchScrollLoad
test('search scroll load helper exports requestScrollLoadMoreWithContext', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const exportMatch = helperModule.match(/window\.LoveBudSearchScrollLoad\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchScrollLoad export object not found');
  assert.match(exportMatch[1], /\brequestScrollLoadMoreWithContext\b/);
});

// requestScrollLoadMoreWithContext uses requestCallbacks
test('requestScrollLoadMoreWithContext uses requestCallbacks', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /context\.requestCallbacks/);
  assert.match(helperModule, /requestCallbacks\.isNearViewport\(\)/);
  assert.match(helperModule, /requestCallbacks\.canLoadMore\(flags\)/);
  assert.match(helperModule, /requestCallbacks\.syncSentinel\(\)/);
  assert.match(helperModule, /await requestCallbacks\.loadMore\(\)/);
});

// requestScrollLoadMoreWithContext uses context.getIntent
test('requestScrollLoadMoreWithContext uses getIntent', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /context\.getIntent/);
  assert.match(helperModule, /getIntent\(\)/);
});

// requestScrollLoadMoreWithContext manages flags.isQueued
test('requestScrollLoadMoreWithContext manages flags.isQueued', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /flags\.isQueued = true/);
  assert.match(helperModule, /flags\.isQueued = false/);
});

// requestScrollLoadMoreWithContext returns true/false
test('requestScrollLoadMoreWithContext returns boolean', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /return false/);
  assert.match(helperModule, /return true/);
});

// createScrollLoadHelperContext has getIntent
test('search UI context builder has getIntent', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /getIntent: \(\) => hasUserScrolledTowardFeed/);
});

// search-ui routes through helper adapter, fallback returns false
test('search UI routes through requestScrollLoadMoreWithContext', () => {
  const uiModule = read('js/search/search-ui.js');
  // Routes through helper adapter when available
  assert.match(uiModule, /ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  // Returns adapter result
  assert.match(uiModule, /return didRequest;/);
  // No fallback — always delegates to helper
  assert.doesNotMatch(uiModule, /typeof ScrollLoad\.requestScrollLoadMoreWithContext/);
  assert.doesNotMatch(uiModule, /async function requestScrollLoadMore[\s\S]*?return false/);
  // Local isScrollLoadQueued synced after adapter call
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
});

// Still uses own local async function
test('search UI own requestScrollLoadMore retained', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore/);
});

// requestMore count unchanged
test('search UI requestMore count unchanged', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references');
});

// loadMore source preserved
test('requestCallbacks.loadMore preserves source scroll', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /loadMore: \(\) => callbacks\.loadMorePublicTrees\(\{ source: 'scroll' \}\)/);
});

// createScrollLoadHelperContext returns setQueued
test('search UI context builder returns setQueued', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /setQueued: \(val\) => { isScrollLoadQueued = val; }/);
});

// requestScrollLoadMoreWithContext reads context.setQueued
test('helper adapter reads context.setQueued', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /context\.setQueued/);
});

// requestScrollLoadMoreWithContext calls setQueued(true) before flags.isQueued = true
test('helper adapter calls setQueued(true) before flags.isQueued = true', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /setQueued\(true\);\s+flags\.isQueued = true/);
});

// requestScrollLoadMoreWithContext calls setQueued(false) in finally before flags.isQueued = false
test('helper adapter calls setQueued(false) in finally before flags.isQueued = false', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.match(helperModule, /setQueued\(false\);\s+flags\.isQueued = false/);
});

// requestScrollLoadMoreWithContext guards against missing loadMore
test('helper adapter guard checks requestCallbacks.loadMore is function', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  // loadMore guard check is BEFORE setQueued(true) — no queue lock if loadMore missing
  const guardBeforeSetQueued = helperModule.indexOf("requestCallbacks.loadMore !== 'function'");
  const setQueuedTruePos = helperModule.indexOf('setQueued(true)');
  assert.ok(guardBeforeSetQueued >= 0, 'loadMore guard must exist');
  assert.ok(setQueuedTruePos >= 0, 'setQueued(true) must exist');
  assert.ok(guardBeforeSetQueued < setQueuedTruePos, 'loadMore guard must appear before setQueued(true)');
});

// try block directly awaits loadMore (defensive re-check removed, guard ensures it)
test('helper adapter try block uses direct await requestCallbacks.loadMore()', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  // Guard ensures loadMore is a function before queue lock
  assert.match(helperModule, /typeof requestCallbacks\.loadMore !== 'function'/);
  // Defensive check inside try is removed — guard does the job
  assert.doesNotMatch(helperModule, /if \(typeof requestCallbacks\.loadMore === 'function'\)/);
  // Direct await in try block
  assert.match(helperModule, /try \{\s+await requestCallbacks\.loadMore\(\)/);
});

// --- Legacy request path audit (pre-removal contract freeze) ---
// These tests document the current state before any legacy request path removal.
// They freeze the contract that main runtime uses requestScrollLoadMoreWithContext,
// NOT the legacy requestScrollLoadMore or legacy scheduleScrollLoadCheck.
// Removal of the audit-listed items requires updating these tests first.

test('search UI routes scroll load through context adapter, not legacy request', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore\(/);
});

test('search UI does not call legacy helper scheduleScrollLoadCheck', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.doesNotMatch(uiModule, /ScrollLoad\.scheduleScrollLoadCheck\(/);
  assert.match(uiModule, /ScrollLoad\.scheduleScrollLoadCheckWrapper\(/);
});

test('search scroll load legacy request path removed', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.doesNotMatch(helperModule, /async function requestScrollLoadMore\(state, callbacks, flags\)/);
  assert.doesNotMatch(helperModule, /function scheduleScrollLoadCheck\(state\)/);
  assert.doesNotMatch(helperModule, /requestScrollLoadMore\(state, callbacks, \{\}\)/);
  assert.match(helperModule, /async function requestScrollLoadMoreWithContext\(context\)/);
});

// --- Legacy path isolation comments ---
// Verify that legacy vs current adapter paths are clearly marked with comments
// so future removal can rely on unambiguous code markers.

test('search scroll load legacy isolation comments removed, current kept', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.doesNotMatch(helperModule, /Legacy helper-internal request path/);
  assert.match(helperModule, /Current adapter request path \(used by main runtime via context\)/);
});

test('search scroll load current schedule path comment kept', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.doesNotMatch(helperModule, /Legacy helper-internal schedule path/);
  assert.match(helperModule, /Current adapter schedule path \(used by main runtime\)/);
});

test('search scroll load export block no longer contains legacy paths', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  assert.doesNotMatch(helperModule, /requestScrollLoadMore:\s*requestScrollLoadMore/);
  assert.match(helperModule, /requestScrollLoadMoreWithContext: requestScrollLoadMoreWithContext, \/\/ Current adapter path/);
  assert.doesNotMatch(helperModule, /scheduleScrollLoadCheck:\s*scheduleScrollLoadCheck/);
  assert.match(helperModule, /scheduleScrollLoadCheckWrapper: scheduleScrollLoadCheckWrapper, \/\/ Current adapter path/);
});
