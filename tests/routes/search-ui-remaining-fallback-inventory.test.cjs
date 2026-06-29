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
// #1379 Final Fallback Inventory Audit
//
// Purpose: Catalog every remaining fallback/guard in search-ui.js
// and determine whether it is:
//   KEEP         — product stability, out of #1379 scope, or intentional
//   NEXT CANDIDATE — same pattern as already-removed guards, could be removed
//   REMOVED      — already eliminated during #1379 (verified frozen)
//
// This file is a STATIC CONTRACT freeze — not a runtime test.
// ============================================================

// ────────────────────────────────────────────────────────────
// Section 1: REMOVED — ensure previously-removed fallbacks
//            do not reappear
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMOVED: markScrollLoadIntent no else scheduleScrollLoadCheck fallback (PR #1419)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'markScrollLoadIntent');

  assert.doesNotMatch(body, /else\s*\{\s*scheduleScrollLoadCheck\(\)/);
});

test('[INVENTORY] REMOVED: syncScrollLoadSentinel no typeof guard or return false (PR #1422)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'syncScrollLoadSentinel');

  assert.match(body, /ScrollLoad\.syncScrollLoadSentinel\(scrollLoadSentinel,\s*state\)/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.syncScrollLoadSentinel\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return\s+false/);
});

test('[INVENTORY] REMOVED: isSentinelNearViewport no typeof guard or return false (PR #1423)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'isSentinelNearViewport');

  assert.match(body, /return ScrollLoad\.isSentinelNearViewport\(scrollLoadSentinel,\s*window\)/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.isSentinelNearViewport\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return false/);
});

test('[INVENTORY] REMOVED: canLoadMorePublicTrees no typeof guard or return false (PR #1425)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'canLoadMorePublicTrees');

  assert.match(body, /ScrollLoad\.canLoadMorePublicTrees/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.canLoadMorePublicTrees\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return\s+false/);
});

test('[INVENTORY] REMOVED: requestScrollLoadMore no local requestCallbacks fallback (PR #1421)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'requestScrollLoadMore');

  assert.doesNotMatch(body, /const requestCallbacks\s*=\s*scrollLoadHelperContext\.requestCallbacks/);
  assert.doesNotMatch(body, /requestCallbacks\.isNearViewport\s*\(/);
  assert.doesNotMatch(body, /requestCallbacks\.canLoadMore\s*\(/);
  assert.doesNotMatch(body, /requestCallbacks\.loadMore\s*\(/);
  assert.doesNotMatch(body, /await requestCallbacks\.loadMore\s*\(/);
  assert.doesNotMatch(body, /requestCallbacks\.syncSentinel\s*\(/);
  assert.doesNotMatch(body, /try\s*\{/);
  assert.doesNotMatch(body, /finally\s*\{/);
  assert.doesNotMatch(body, /isScrollLoadQueued\s*=\s*true/);
  // Only remains: flags.isQueued = isScrollLoadQueued, isScrollLoadQueued = Boolean(flags.isQueued)
  assert.match(body, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  assert.match(body, /flags\.isQueued = isScrollLoadQueued/);
  // Direct delegation: no return false fallback, no typeof guard
  assert.match(body, /return didRequest;/);
  assert.doesNotMatch(body, /return false/);
  assert.doesNotMatch(body, /typeof ScrollLoad\.requestScrollLoadMoreWithContext/);
});

test('[INVENTORY] REMOVED: no legacy internal request path in search-scroll-load.js (PR #1417)', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.doesNotMatch(helperModule, /requestScrollLoadMore\s*=\s*function\b/);
});

// ────────────────────────────────────────────────────────────
// Section 2: REMAINING — Scroll-load related guards
//
// These are the last typeof guards in search-ui.js that
// follow the same pattern as already-removed guards.
// Listed here for awareness — they are candidates for a
// FOLLOW-UP issue, NOT immediate removal.
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMOVED: requestScrollLoadMore no typeof guard or return false fallback (current PR)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'requestScrollLoadMore');

  assert.match(body, /await ScrollLoad\.requestScrollLoadMoreWithContext\(scrollLoadHelperContext\)/);
  assert.match(body, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
  assert.match(body, /return didRequest;/);
  assert.doesNotMatch(body, /typeof ScrollLoad\.requestScrollLoadMoreWithContext === 'function'/);
  assert.doesNotMatch(body, /return false/);
  // Context creation and flags sync still preserved
  assert.match(body, /const scrollLoadHelperContext = createScrollLoadHelperContext\(state,\s*callbacks\)/);
  assert.match(body, /flags\.isQueued = isScrollLoadQueued/);
});

test('[INVENTORY] REMOVED: scheduleScrollLoadCheck no typeof guard (current PR)', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'scheduleScrollLoadCheck');

  assert.match(body, /ScrollLoad\.scheduleScrollLoadCheckWrapper\(/);
  assert.doesNotMatch(body, /typeof ScrollLoad\.scheduleScrollLoadCheckWrapper === 'function'/);
  assert.doesNotMatch(body, /typeof ScrollLoad\.scheduleScrollLoadCheckWrapper !== 'undefined'/);
});

test('[INVENTORY] REMOVED: requestController is created directly without typeof/null fallback', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /const requestController = ScrollLoad\.createScrollLoadRequestController\(\{/);
  assert.doesNotMatch(uiModule, /typeof ScrollLoad\.createScrollLoadRequestController === 'function'/);
  assert.doesNotMatch(uiModule, /const requestController =[\s\S]*?:\s*null;/);
});

// ────────────────────────────────────────────────────────────
// Section 3: REMAINING — Scroll-load related early-return
//            guards (different pattern — KEEP or reconsider)
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMAINING (KEEP): handleScrollLoadKeydown early-return guard', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'handleScrollLoadKeydown');

  // Early return if helper isScrollIntentKey unavailable — KEEP because
  // this is a callback guard pattern, not a fallback replacement.
  assert.match(body, /typeof ScrollLoad\.isScrollIntentKey !== 'function'/);
  assert.match(body, /return;/);
});

test('[INVENTORY] REMAINING (KEEP): ensureScrollLoadSentinel early-return guards', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'ensureScrollLoadSentinel');

  // Guard at line 233: if (!resultsList || scrollLoadSentinel) return;
  assert.match(body, /!resultsList \|\| scrollLoadSentinel/);
  // Guard at line 234: if (typeof ScrollLoad.ensureScrollLoadSentinel !== 'function') return;
  assert.match(body, /typeof ScrollLoad\.ensureScrollLoadSentinel !== 'function'/);
});

// ────────────────────────────────────────────────────────────
// Section 4: REMAINING — Non-scroll-load fallbacks
//            (OUT OF #1379 SCOPE — product stability)
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMAINING (OUT OF SCOPE): getCurrentLocale i18n chain fallback', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'getCurrentLocale');

  // SearchCopy guard + window.i18n chain fallback
  assert.match(body, /typeof SearchCopy\.getCurrentLocale === 'function'/);
  assert.match(body, /window\.i18n\?\.currentLang/);
  assert.match(body, /window\.getCurrentLang\?\.\(\)/);
  // Intentionally kept — multi-layer i18n stability, not scroll-load related
});

test('[INVENTORY] REMAINING (OUT OF SCOPE): getSearchCopy SearchCopy guard + i18n fallback', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'getSearchCopy');

  assert.match(body, /typeof SearchCopy\.getSearchCopy === 'function'/);
  assert.match(body, /window\.i18nSearch\?\.\[key\]/);
  // Intentionally kept — i18n stability, not scroll-load related
});

test('[INVENTORY] REMAINING (OUT OF SCOPE): syncStaticBrowseCopy applyI18n guard', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /typeof window\.applyI18n === 'function'/);
  // Intentionally kept — i18n stabilization guard
});

test('[INVENTORY] REMAINING (OUT OF SCOPE): renderPreviewLoadingState PreviewRenderer guard', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'renderPreviewLoadingState');

  assert.match(body, /typeof PreviewRenderer\.renderLoadingPreview === 'function'/);
  // Full fallback rendering is intentional — PreviewRenderer is a separate module
  // with its own loading state. This is not a scroll-load concern.
});

// ────────────────────────────────────────────────────────────
// Section 5: REMAINING — Defensive guards IN helper modules
//            (module's own responsibility — KEEP)
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMAINING (KEEP — helper internal): canLoadMorePublicTrees null-safety guards', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /state = state \|\| \{\}/);
  assert.match(helperModule, /callbacks = callbacks \|\| \{\}/);
  assert.match(helperModule, /flags = flags \|\| \{\}/);
  // These are the helper's OWN defensive guards — not fallbacks.
});

test('[INVENTORY] REMAINING (KEEP — helper internal): requestScrollLoadMoreWithContext context guards', () => {
  const helperModule = read('js/search/search-scroll-load.js');
  const body = extractFunctionBody(helperModule, 'requestScrollLoadMoreWithContext');

  assert.match(body, /context = context \|\| \{\}/);
  assert.match(body, /flags = context\.flags \|\| \{\}/);
  assert.match(body, /requestCallbacks = context\.requestCallbacks \|\| \{\}/);
  assert.match(body, /typeof context\.setQueued === 'function'/);
  assert.match(body, /typeof context\.getIntent === 'function'/);
});

test('[INVENTORY] REMAINING (KEEP — helper internal): ensureScrollLoadSentinel option guards', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /options = options \|\| \{\}/);
  assert.match(helperModule, /typeof options\.scheduleScrollLoadCheck === 'function'/);
  assert.match(helperModule, /typeof options\.bindScrollLoadIntentHandlers === 'function'/);
});

// ────────────────────────────────────────────────────────────
// Section 6: REMAINING — Cross-module guards in other helpers
//            (KEEP — each module's own boundary)
// ────────────────────────────────────────────────────────────

test('[INVENTORY] REMAINING (KEEP — card events): resolveViewerHref cross-module guard', () => {
  const cardModule = read('js/search/search-card-events.js');

  assert.match(cardModule, /typeof cardRenderer\.getTreeViewerHref === 'function'/);
  // LoveBudSearchCardRenderer is a separate module — cross-boundary guard is intentional.
});

test('[INVENTORY] REMAINING (KEEP — preview state): clearSelectedPreview mobile check guards', () => {
  const previewModule = read('js/search/search-preview-state.js');
  const body = extractFunctionBody(previewModule, 'clearSelectedPreview');

  assert.match(body, /typeof ui\.isMobilePreviewMode === 'function'/);
  assert.match(body, /typeof ui\.setMobilePreviewOpen === 'function'/);
  // These check for methods injected by search-mobile-preview-sheet.js patch.
  // Runtime guard ensuring sheet methods exist before calling.
});

test('[INVENTORY] REMOVED (clean): share link module no longer has getSearchCopy guard or getStatusText', () => {
  const shareModule = read('js/search/search-share-link.js');

  // The old getSearchCopy guard and getStatusText are removed — share-link
  // now has a simplified API with clipboard-first approach.
  assert.ok(!shareModule.includes('getStatusText'),
    'getStatusText must be removed from share-link');
  assert.ok(!shareModule.includes('typeof getSearchCopy ==='),
    'getSearchCopy guard must be removed from share-link');
  assert.ok(!shareModule.includes('patchSearchUIFactory'),
    'patchSearchUIFactory must be removed from share-link');
  // New API exports clean helpers
  assert.match(shareModule, /buildReadOnlyTreeUrl/);
  assert.match(shareModule, /renderPreviewSocialShell/);
  assert.match(shareModule, /bindPreviewShareHandler/);
});

test('[INVENTORY] REMAINING (KEEP — mobile sheet): bindMobilePreviewHandlers mediaQuery guard', () => {
  const sheetModule = read('js/search/search-mobile-preview-sheet.js');
  const body = extractFunctionBody(sheetModule, 'bindMobilePreviewHandlers');

  assert.match(body, /typeof mobilePreviewMediaQuery\.addEventListener === 'function'/);
  // Legacy mediaQuery.addListener fallback for older browser support.
  // Not scroll-load related — keep as-is.
});

// ────────────────────────────────────────────────────────────
// Section 7: Contract integrity — key contracts that must
//            remain stable across #1379
// ────────────────────────────────────────────────────────────

test('[INVENTORY] CONTRACT: requestMore count remains 2 in search-ui.js', () => {
  const uiModule = read('js/search/search-ui.js');
  const count = (uiModule.match(/\brequestMore\b/g) || []).length;
  assert.equal(count, 2, 'requestMore must remain at exactly 2 references (1 creation + 1 call site)');
});

test('[INVENTORY] CONTRACT: createScrollLoadHelperContext provides full adapter contract', () => {
  const uiModule = read('js/search/search-ui.js');
  const ctxModule = read('js/search/search-scroll-load.js');

  // search-ui.js provides context with requestCallbacks
  assert.match(uiModule, /requestCallbacks:\s*\{/);
  assert.match(uiModule, /canLoadMore:\s*canLoadMorePublicTrees/);
  assert.match(uiModule, /isNearViewport:\s*isSentinelNearViewport/);
  assert.match(uiModule, /syncSentinel:\s*syncScrollLoadSentinel/);
  assert.match(uiModule, /loadMore:\s*\(\)\s*=>\s*callbacks\.loadMorePublicTrees\(\{\s*source:\s*'scroll'\s*\}\)/);
  assert.match(uiModule, /getIntent:\s*\(\)\s*=>\s*hasUserScrolledTowardFeed/);
  assert.match(uiModule, /setQueued:\s*\(val\)\s*=>\s*\{ isScrollLoadQueued = val; \}/);

  // search-scroll-load.js uses those requestCallbacks
  assert.match(ctxModule, /context\.requestCallbacks/);
  assert.match(ctxModule, /requestCallbacks\.isNearViewport\(\)/);
  assert.match(ctxModule, /requestCallbacks\.canLoadMore\(flags\)/);
  assert.match(ctxModule, /requestCallbacks\.syncSentinel\(\)/);
  assert.match(ctxModule, /await requestCallbacks\.loadMore\(\)/);
});

test('[INVENTORY] CONTRACT: flags.isQueued sync pattern preserved', () => {
  const uiModule = read('js/search/search-ui.js');

  // Before adapter: local → flags
  assert.match(uiModule, /flags\.isQueued = isScrollLoadQueued/);
  // After adapter: flags → local
  assert.match(uiModule, /isScrollLoadQueued = Boolean\(flags\.isQueued\)/);
});

test('[INVENTORY] CONTRACT: source scroll preserved in loadMore callback', () => {
  const uiModule = read('js/search/search-ui.js');

  assert.match(uiModule, /callbacks\.loadMorePublicTrees\(\{\s*source:\s*'scroll'\s*\}\)/);
});

test('[INVENTORY] CONTRACT: helper patch must be active', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /patchSearchUIFactory\(\);\s*$/m);
  assert.match(helperModule, /SearchUI\.__scrollLoadHelperPatched = true/);
});
