const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// ============================================================
// Runtime Reachability Audit: requestScrollLoadMore()
//
// Summary:
// search-ui.js의 requestScrollLoadMore()는 두 경로로 구성된다:
//
//   1. Helper adapter path (우선):
//      if (typeof ScrollLoad.requestScrollLoadMoreWithContext === 'function') {
//          return await ScrollLoad.requestScrollLoadMoreWithContext(context);
//      }
//
//   2. Local fallback path (adapter가 없을 때):
//      if (!hasUserScrolledTowardFeed || ...) return;
//      isScrollLoadQueued = true;
//      await requestCallbacks.loadMore();
//      ...
//
// Runtime load order 보장:
//   search.html script 태그 순서:
//     1. search-ui.js           → defines LoveBudSearchUI
//     2. search-scroll-load.js   → defines LoveBudSearchScrollLoad + patchSearchUIFactory()
//     3. index.js                → DOMContentLoaded → createSearchUI()
//
//   index.js의 createSearchUI() 호출은 DOMContentLoaded 내에서 발생하므로,
//   search-ui.js, search-scroll-load.js 등 모든 blocking script가
//   이미 실행 완료된 상태다.
//
// 결론:
//   - ScrollLoad (LoveBudSearchScrollLoad)는 createSearchUI() 호출 시점에
//     항상 완전히 초기화되어 있다.
//   - requestScrollLoadMoreWithContext, createScrollLoadRequestController,
//     scheduleScrollLoadCheckWrapper 등 helper adapter 함수는 항상 존재한다.
//   - Local fallback path는 이론적으로만 존재하며 실제 runtime에서는
//     helper adapter path가 먼저 실행되어 return하므로 절대 도달하지 않는다.
//   - Local fallback path의 제거는 충분한 smoke 이후 별도 PR에서 진행.
// ============================================================

// --- 1. helper namespace availability at createSearchUI call time ---

test('search entrypoint calls createSearchUI inside DOMContentLoaded', () => {
  const indexModule = read('js/search/index.js');

  // createSearchUI must be called inside DOMContentLoaded handler
  assert.match(indexModule,
    /document\.addEventListener\(['"]DOMContentLoaded['"],\s*async\s*\(\)\s*=>\s*\{/);
  // SearchUI.createSearchUI is called inside the handler
  assert.match(indexModule,
    /window\.LoveBudSearchUI\.createSearchUI\(/);
  // The createSearchUI call is BEFORE the DOMContentLoaded closing brace
  // (not in a nested event handler)
  const dclMatch = indexModule.match(
    /document\.addEventListener\(['"]DOMContentLoaded['"],\s*async\s*\(\)\s*=>\s*\{([\s\S]*)\}\);/
  );
  assert.ok(dclMatch, 'DOMContentLoaded handler body not found');
  assert.ok(dclMatch[1].includes('LoveBudSearchUI.createSearchUI'),
    'createSearchUI must be called within DOMContentLoaded handler');
});

test('search-scroll-load.js executes before index.js in search.html', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);

  const scrollLoadIdx = scripts.findIndex((src) => src.includes('search-scroll-load.js'));
  const indexIdx = scripts.findIndex((src) => src.includes('index.js'));

  assert.ok(scrollLoadIdx >= 0, 'search-scroll-load.js script tag must exist');
  assert.ok(indexIdx >= 0, 'index.js script tag must exist');
  assert.ok(scrollLoadIdx < indexIdx,
    'search-scroll-load.js must be loaded BEFORE index.js');
});

test('search-scroll-load.js executes after search-ui.js in search.html', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);

  const uiIdx = scripts.findIndex((src) => src.includes('search-ui.js'));
  const scrollLoadIdx = scripts.findIndex((src) => src.includes('search-scroll-load.js'));

  assert.ok(uiIdx >= 0, 'search-ui.js script tag must exist');
  assert.ok(scrollLoadIdx >= 0, 'search-scroll-load.js script tag must exist');
  assert.ok(uiIdx < scrollLoadIdx,
    'search-ui.js must be loaded BEFORE search-scroll-load.js');
});

// --- 2. patchSearchUIFactory contract ---

test('scroll load helper patcher wraps LoveBudSearchUI.createSearchUI at load time', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const uiModule = read('js/search/search-ui.js');

  // patchSearchUIFactory function exists in helper
  assert.match(helperModule, /function patchSearchUIFactory\(\)/);
  // It wraps SearchUI.createSearchUI
  assert.match(helperModule, /originalCreateSearchUI\s*=\s*SearchUI\.createSearchUI/);
  // It sets __scrollLoadHelperPatched on the wrapped factory
  assert.match(helperModule, /SearchUI\.__scrollLoadHelperPatched\s*=\s*true/);
  // It attaches scrollLoadHelpers to the returned ui
  assert.match(helperModule, /ui\.scrollLoadHelpers\s*=\s*window\.LoveBudSearchScrollLoad/);
  // patchSearchUIFactory is called at module load time (not inside a function/event)
  assert.match(helperModule, /patchSearchUIFactory\(\);$/m);
});

// --- 3. requestScrollLoadMore() adapter priority ---

test('requestScrollLoadMore uses helper adapter with requestScrollLoadMoreWithContext first', () => {
  const uiModule = read('js/search/search-ui.js');

  // Helper adapter check exists
  assert.match(uiModule,
    /typeof ScrollLoad\.requestScrollLoadMoreWithContext\s*===\s*['"]function['"]/);
  // Adapter is called with scrollLoadHelperContext
  assert.match(uiModule,
    /ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  // Adapter path returns early (does not fall through to local fallback)
  assert.match(uiModule,
    /return didRequest;/);
});

// --- 4. Local fallback path freeze contract (do not remove without separate PR + smoke) ---

test('requestScrollLoadMore local fallback path still exists (freeze contract)', () => {
  const uiModule = read('js/search/search-ui.js');

  // scroll intent guard
  assert.match(uiModule, /!hasUserScrolledTowardFeed/);
  // near viewport check
  assert.match(uiModule, /requestCallbacks\.isNearViewport\(\)/);
  // can load more check
  assert.match(uiModule, /requestCallbacks\.canLoadMore\(flags\)/);
  // Queue toggle before fetch
  assert.match(uiModule, /isScrollLoadQueued\s*=\s*true/);
  // local load via requestCallbacks.loadMore
  assert.match(uiModule, /requestCallbacks\.loadMore\(\)/);
  // try/finally with queue cleanup
  assert.match(uiModule, /finally\s*\{[\s\S]*?isScrollLoadQueued\s*=\s*false/);
});

test('requestScrollLoadMore local fallback path does NOT call helper adapter again within it', () => {
  const uiModule = read('js/search/search-ui.js');

  // Inside the local fallback (after adapter check), verify no double adapter call
  // The local callbacks use requestCallbacks.loadMore() not ScrollLoad.requestScrollLoadMoreWithContext
  assert.match(uiModule, /requestCallbacks\.loadMore\(\)/);
  // The fallback path does not reference ScrollLoad.requestScrollLoadMoreWithContext again
  const localFallbackAdapterRefs = (
    uiModule.match(
      /if\s*\(!hasUserScrolledTowardFeed[\s\S]*?requestCallbacks\.loadMore\(\)[\s\S]*?\}/
    ) || []
  );
  // The local fallback block should not contain ScrollLoad
  if (localFallbackAdapterRefs.length > 0) {
    assert.ok(!localFallbackAdapterRefs[0].includes('requestScrollLoadMoreWithContext'),
      'local fallback must not call adapter again');
  }
});

test('requestScrollLoadMore helper adapter path returns on success', () => {
  const uiModule = read('js/search/search-ui.js');

  // After adapter call, the function returns (does not fall through to local path)
  assert.match(uiModule,
    /const didRequest = await ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\);[\s\S]*?return didRequest;/);
});

// --- 5. createScrollLoadHelperContext contract ---

test('createScrollLoadHelperContext provides full contract for helper adapter', () => {
  const uiModule = read('js/search/search-ui.js');

  // state and callbacks are passed through
  assert.match(uiModule, /state,\s*callbacks,/);
  // flags.isQueued initialized
  assert.match(uiModule, /flags:\s*\{[\s\S]*?isQueued/);
  // requestCallbacks with all required methods
  assert.match(uiModule, /canLoadMore:\s*canLoadMorePublicTrees/);
  assert.match(uiModule, /isNearViewport:\s*isSentinelNearViewport/);
  assert.match(uiModule, /syncSentinel:\s*syncScrollLoadSentinel/);
  // loadMore preserves { source: 'scroll' }
  assert.match(uiModule,
    /loadMore:\s*\(\s*\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*['"]scroll['"]\s*\}\)/);
  // getIntent and setQueued provided
  assert.match(uiModule, /getIntent:\s*\(\s*\)\s*=>\s*hasUserScrolledTowardFeed/);
  assert.match(uiModule, /setQueued:\s*\(\s*val\s*\)\s*=>\s*\{[\s\S]*?isScrollLoadQueued\s*=\s*val/);
});

// --- 6. createScrollLoadRequestController contract (from helper) ---

test('createScrollLoadRequestController provides scheduleCheck that calls scheduleScrollLoadCheck', () => {
  const uiModule = read('js/search/search-ui.js');

  // requestController is created with scheduleCheck
  assert.match(uiModule,
    /scheduleCheck:\s*\(\s*\)\s*=>\s*scheduleScrollLoadCheck\(\)/);
  // requestController.requestMore calls requestScrollLoadMore and returns true
  assert.match(uiModule,
    /requestMore:\s*\(\s*\)\s*=>\s*\{[\s\S]*?requestScrollLoadMore\(\);[\s\S]*?return\s*true;[\s\S]*?\}/);
});

// --- 7. requestMore count, loadMore source, queue flags preserved ---

test('requestMore count remains at 2 references', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2,
    'requestMore must remain at exactly 2 references (1 creation + 1 call site)');
});

test('loadMore source scroll preserved', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule,
    /callbacks\.loadMorePublicTrees\(\s*\{\s*source:\s*['"]scroll['"]\s*\}\s*\)/);
});

test('flags.isQueued mirrors local isScrollLoadQueued', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /flags\.isQueued\s*=\s*isScrollLoadQueued/);
});

test('isScrollLoadQueued remains local queue source of truth', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /isScrollLoadQueued\s*=\s*true/);
  assert.match(uiModule, /isScrollLoadQueued\s*=\s*false/);
});
