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
  assert.match(cardRenderer, /aria-label="\$\{escapeHtml\(cardSelectLabel\)\}"/);

  assert.match(cardEventsModule, /container\.addEventListener\(['"]click['"]/);
  assert.match(cardEventsModule, /container\.addEventListener\(['"]keydown['"]/);
  assert.match(cardEventsModule, /event\.target\.closest\(['"]\.tree-card\[data-tree-id\]['"]\)/);
  assert.match(cardEventsModule, /var interactiveSelector = ['"]a, button,/);
});

test('browse cards expose a truthful public tree viewer bridge', () => {
  const cardRenderer = read('js/search/search-card-renderer.js');

  assert.match(cardRenderer, /function getTreeViewerHref\(tree\)/);
  assert.match(cardRenderer, /tree\?treeId=/);
  assert.match(cardRenderer, /encodeURIComponent\(tree\.id\)/);
  assert.match(cardRenderer, /tree-card-open-link/);
  assert.match(cardRenderer, /트리 열기/);
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
  assert.match(actionHelper, /tree\?treeId=/);
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
  assert.match(actionHelper, /tree\?treeId=/);
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
    'requestScrollLoadMore',
    'scheduleScrollLoadCheck',
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

test('search UI scroll load requestController fallback path uses optional chaining', () => {
  const uiModule = read('js/search/search-ui.js');

  // Contract: requestController?.requestMore?.() || requestScrollLoadMore()
  // When requestController is null or requestMore is missing, fallback fires
  assert.match(uiModule, /requestController\?\.requestMore\?\.\(\)\s*\|\|\s*requestScrollLoadMore\(\)/);
});

test('search UI scroll load requestController is created when createScrollLoadRequestController exists', () => {
  const uiModule = read('js/search/search-ui.js');

  // requestController is created conditionally
  assert.match(uiModule, /const requestController = typeof ScrollLoad\.createScrollLoadRequestController === 'function'/);
  // Falls back to null when factory is missing
  assert.match(uiModule, /:\s*null;/);
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

test('search UI requestScrollLoadMore retains full ownership of fetch, queue, and sentinel sync', () => {
  const uiModule = read('js/search/search-ui.js');

  // requestScrollLoadMore body is defined with full implementation in search-ui.js
  assert.match(uiModule, /async function requestScrollLoadMore/);
  // Owns scroll intent guard check
  assert.match(uiModule, /if \(!hasUserScrolledTowardFeed/);
  // Owns queue state toggle (true before fetch, false after)
  assert.match(uiModule, /isScrollLoadQueued = true/);
  assert.match(uiModule, /isScrollLoadQueued = false/);
  // Owns sentinel rendering sync before and after fetch
  assert.match(uiModule, /syncScrollLoadSentinel\(\)/);
  // Owns API fetch via callback
  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{/);
  // Uses try/finally for queue cleanup (isScrollLoadQueued inside finally block)
  assert.match(uiModule, /try \{[\s\S]*?\} finally \{[\s\S]*?isScrollLoadQueued/);
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
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore/);
  // Helper does export requestScrollLoadMore but it is not reached from the main runtime chain
  assert.match(helperModule, /LoveBudSearchScrollLoad[\s\S]*?requestScrollLoadMore/);
});

test('search scroll load helper requestScrollLoadMore is exported in LoveBudSearchScrollLoad', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  const exportMatch = helperModule.match(/window\.LoveBudSearchScrollLoad\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchScrollLoad export object not found');
  assert.match(exportMatch[1], /\brequestScrollLoadMore\b/);
});

test('search scroll load helper requestScrollLoadMore uses state/callback/flags parameter signature', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // Takes (state, callbacks, flags) for parameter-driven injection (not closure-scoped)
  assert.match(helperModule, /async function requestScrollLoadMore\(state,\s*callbacks,\s*flags\)/);
  // Uses flags.isQueued for queue state
  assert.match(helperModule, /flags\.isQueued = true/);
  assert.match(helperModule, /flags\.isQueued = false/);
  // Uses callbacks parameter for fetch delegation
  assert.match(helperModule, /callbacks\.loadMorePublicTrees\(\{/);
});

test('search scroll load helper requestScrollLoadMore handles core concerns through callback delegation', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  // Guard: scroll intent + sentinel viewport + canLoadMore
  assert.match(helperModule, /!hasUserScrolledTowardFeed.*!isSentinelNearViewport.*!canLoadMorePublicTrees/);
  // Queue: flags-based state management
  assert.match(helperModule, /flags\.isQueued = true/);
  assert.match(helperModule, /flags\.isQueued = false/);
  // Sentinel sync: delegated with explicit params
  assert.match(helperModule, /syncScrollLoadSentinel\(scrollLoadSentinel,\s*state\)/);
  // API fetch: delegated to callbacks parameter
  assert.match(helperModule, /callbacks\.loadMorePublicTrees\(\{/);
  // Cleanup: try/finally guards the fetch with await
  assert.match(helperModule, /try \{[\s\S]*?await callbacks\.loadMorePublicTrees[\s\S]*?\} finally/);
});

test('search scroll load helper requestScrollLoadMore does not directly own DOM or API endpoint strings', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  const fnMatch = helperModule.match(/(?:async )?function requestScrollLoadMore\([^)]*\) \{([\s\S]*?)\n    \}/);
  assert.ok(fnMatch, 'requestScrollLoadMore function body not found');
  const fnBody = fnMatch[1];

  // No direct DOM manipulation
  assert.doesNotMatch(fnBody, /\.innerHTML\s*=/);
  assert.doesNotMatch(fnBody, /textContent\s*=/);
  assert.doesNotMatch(fnBody, /insertAdjacentHTML/);
  // No hardcoded API endpoint strings
  assert.doesNotMatch(fnBody, /\/api\//);
  assert.doesNotMatch(fnBody, /https?:\/\//);
  // DOM work is delegated to syncScrollLoadSentinel
  assert.match(fnBody, /syncScrollLoadSentinel\(/);
});

test('search scroll load helper requestScrollLoadMore async contract matches local counterpart', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const uiModule = read('js/search/search-ui.js');

  // Helper is now async (parity with local version)
  assert.match(helperModule, /async function requestScrollLoadMore\(state,\s*callbacks,\s*flags\)/);
  // Helper awaits loadMorePublicTrees callback
  assert.match(helperModule, /await callbacks\.loadMorePublicTrees\(\{/);
  // Local version remains async
  assert.match(uiModule, /async function requestScrollLoadMore/);
  // Helper is NOT yet connected to runtime chain
  assert.doesNotMatch(uiModule, /ScrollLoad\.requestScrollLoadMore/);
  // requestMore actual-use is still exactly 1 call site
  const requestMoreCount = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(requestMoreCount, 2,
    'requestMore must remain at exactly 2 references (1 creation + 1 call site)'
  );
});

test('search UI wiring context builder exists for helper migration', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /createScrollLoadHelperContext/);
});

test('search UI local requestScrollLoadMore remains owned by search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /async function requestScrollLoadMore\(\)/);
  // Ensure requestScrollLoadMore is not called via ScrollLoad in search-ui.js runtime
  assert.doesNotMatch(uiModule, /\.requestScrollLoadMore\(/);
});

test('search UI wiring context does not connect to runtime chain', () => {
  const uiModule = read('js/search/search-ui.js');
  // createScrollLoadHelperContext should exist
  assert.match(uiModule, /createScrollLoadHelperContext/);
  // But it should not be called from scheduleScrollLoadCheck or other runtime methods
  assert.doesNotMatch(uiModule, /scheduleScrollLoadCheck.*createScrollLoadHelperContext/);
  assert.doesNotMatch(uiModule, /createScrollLoadHelperContext.*scheduleScrollLoadCheck/);
});

