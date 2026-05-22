const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `${functionName} function not found`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(braceStart + 1, index);
    }
  }
  throw new Error(`${functionName} body not closed`);
}

// ============================================================
// Runtime Reachability Audit: requestScrollLoadMore()
//
// Summary:
// search-ui.js의 requestScrollLoadMore()는 helper adapter path로 위임된다.
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
//     초기화되어 있다.
//   - requestScrollLoadMoreWithContext, createScrollLoadRequestController,
//     scheduleScrollLoadCheckWrapper 등 helper adapter 함수가 현재 runtime path다.
//   - Local requestCallbacks fallback 실행 블록은 제거되었고,
//     helper adapter가 없으면 false를 반환한다.
// ============================================================

// --- 1. helper namespace availability at createSearchUI call time ---

test('search entrypoint calls createSearchUI inside DOMContentLoaded', () => {
  const indexModule = read('js/search/index.js');

  assert.match(indexModule,
    /document\.addEventListener\(['"]DOMContentLoaded['"],\s*async\s*\(\)\s*=>\s*\{/);
  assert.match(indexModule,
    /window\.LoveBudSearchUI\.createSearchUI\(/);
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

  assert.match(helperModule, /function patchSearchUIFactory\(\)/);
  assert.match(helperModule, /originalCreateSearchUI\s*=\s*SearchUI\.createSearchUI/);
  assert.match(helperModule, /SearchUI\.__scrollLoadHelperPatched\s*=\s*true/);
  assert.match(helperModule, /ui\.scrollLoadHelpers\s*=\s*window\.LoveBudSearchScrollLoad/);
  assert.match(helperModule, /patchSearchUIFactory\(\);$/m);
});

// --- 3. requestScrollLoadMore() adapter priority ---

test('requestScrollLoadMore delegates directly to helper adapter without guard', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule,
    /ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  assert.match(uiModule,
    /return didRequest;/);
  assert.doesNotMatch(uiModule,
    /typeof ScrollLoad\.requestScrollLoadMoreWithContext\s*===\s*['"]function['"]/);
  assert.doesNotMatch(uiModule,
    /return false[\s\S]*?}\s*}\s*\)/);
});

// --- 4. Local fallback path removal contract ---

test('requestScrollLoadMore executable local fallback path is removed', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'requestScrollLoadMore');

  assert.doesNotMatch(body, /const requestCallbacks\s*=\s*scrollLoadHelperContext\.requestCallbacks\s*;/);
  assert.doesNotMatch(body, /if \(!hasUserScrolledTowardFeed \|\| !requestCallbacks\.isNearViewport\(\) \|\| !requestCallbacks\.canLoadMore\(flags\)\) return;/);
  assert.doesNotMatch(body, /await requestCallbacks\.loadMore\(\)/);
  assert.doesNotMatch(body, /requestCallbacks\.syncSentinel\(\)/);
  assert.doesNotMatch(body, /return false/);
  assert.doesNotMatch(body, /typeof ScrollLoad\.requestScrollLoadMoreWithContext/);
});

test('requestScrollLoadMore helper adapter path returns on success', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule,
    /const didRequest = await ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\);[\s\S]*?return didRequest;/);
});

// --- 5. createScrollLoadHelperContext contract ---

test('createScrollLoadHelperContext provides full contract for helper adapter', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /state,\s*callbacks,/);
  assert.match(uiModule, /flags:\s*\{[\s\S]*?isQueued/);
  assert.match(uiModule, /canLoadMore:\s*canLoadMorePublicTrees/);
  assert.match(uiModule, /isNearViewport:\s*isSentinelNearViewport/);
  assert.match(uiModule, /syncSentinel:\s*syncScrollLoadSentinel/);
  assert.match(uiModule,
    /loadMore:\s*\(\s*\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*['"]scroll['"]\s*\}\)/);
  assert.match(uiModule, /getIntent:\s*\(\s*\)\s*=>\s*hasUserScrolledTowardFeed/);
  assert.match(uiModule, /setQueued:\s*\(\s*val\s*\)\s*=>\s*\{[\s\S]*?isScrollLoadQueued\s*=\s*val/);
});

// --- 6. createScrollLoadRequestController contract (from helper) ---

test('createScrollLoadRequestController provides scheduleCheck that calls scheduleScrollLoadCheck', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule,
    /scheduleCheck:\s*\(\s*\)\s*=>\s*scheduleScrollLoadCheck\(\)/);
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

test('loadMore source scroll preserved in helper context', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule,
    /callbacks\.loadMorePublicTrees\(\s*\{\s*source:\s*['"]scroll['"]\s*\}\s*\)/);
});

test('flags.isQueued mirrors local isScrollLoadQueued', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /flags\.isQueued\s*=\s*isScrollLoadQueued/);
});

test('isScrollLoadQueued remains local queue source of truth via controller and adapter sync', () => {
  const uiModule = read('js/search/search-ui.js');
  assert.match(uiModule, /getQueued:\s*\(\) => isScrollLoadQueued/);
  assert.match(uiModule, /setQueued:\s*\(val\) => \{ isScrollLoadQueued = val; \}/);
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
});
