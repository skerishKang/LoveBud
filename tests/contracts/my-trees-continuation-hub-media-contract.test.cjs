'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('My Trees loads the canonical sanitizer and Browse media helper before its media adapter', () => {
  const html = read('pages/my-trees.html');
  const securityIndex = html.indexOf('js/utils/security.js');
  const helperIndex = html.indexOf('js/search/search-preview-media-helper.js');
  const hubIndex = html.indexOf('js/my-trees/my-trees-preview-hub.js');
  const stateIndex = html.indexOf('js/my-trees/my-trees-preview-state.js');
  const adapterIndex = html.indexOf('js/my-trees/my-trees-preview-media.js');

  assert.ok(securityIndex >= 0, 'My Trees must load the canonical URL sanitizer');
  assert.ok(helperIndex > securityIndex, 'Browse media helper must load after the sanitizer');
  assert.ok(hubIndex > helperIndex, 'hub must load after the shared media helper');
  assert.ok(stateIndex > hubIndex, 'state patch must load after the hub');
  assert.ok(adapterIndex > stateIndex, 'media adapter must load after state patching');
  assert.match(html, /id=["']myTreesHubMedia["'][^>]*hidden/, 'hub markup must retain a hidden conditional media mount');
});

test('My Trees hub media uses Browse helpers and canonical safe URLs', () => {
  const media = read('js/my-trees/my-trees-preview-media.js');

  assert.match(media, /LoveBudSearchPreviewMediaHelper/, 'adapter must reuse the Browse media helper');
  assert.match(media, /LoveBudSecurity/, 'adapter must use the canonical security utility');
  assert.match(media, /security\.sanitizeUrl\(value \|\| ''\)/, 'adapter must delegate URL validation to canonical sanitizer');
  assert.match(media, /helper\.getPreviewMediaMemory\(getMediaCandidates\(tree\)\)/, 'adapter must select only helper-approved media candidates');
  assert.match(media, /var sourceUrl = sanitizeUrl\(mediaMemory\.sourceUrl\);/, 'source URL must be sanitized before helper rendering');
  assert.match(media, /var thumbnail = sanitizeUrl\(mediaMemory\.thumbnail\);/, 'thumbnail URL must be sanitized before helper rendering');
  assert.match(media, /helper\.renderPreviewIframe\(sourceUrl, displayTitle, mediaTitle\)/, 'safe source URLs must render through the shared iframe helper');
  assert.match(media, /helper\.renderPreviewThumbnailMedia\(thumbnail, mediaTitle, displayTitle\)/, 'thumbnail-only media must reuse shared thumbnail rendering');
  assert.match(media, /createContextualFragment\(markup\)/, 'approved helper markup must be attached as a DOM fragment');
  assert.doesNotMatch(media, /autoplay=1/, 'adapter must not enable autoplay');
  assert.doesNotMatch(media, /<iframe\b/i, 'adapter must not hand-roll iframe markup');
  assert.doesNotMatch(media, /\.innerHTML\s*=/, 'adapter must not add a direct HTML sink outside the signed renderer boundary');
});

test('My Trees card selection preserves hydrated source memories for media rendering', () => {
  const media = read('js/my-trees/my-trees-preview-media.js');

  assert.match(media, /function patchRendererSelection\(\)/, 'adapter must patch card-selection handoff');
  assert.match(media, /var rawById = Object\.create\(null\);/, 'adapter must retain raw rendered trees by id');
  assert.match(media, /rawById\[String\(tree\.id\)\] = tree;/, 'adapter must map hydrated raw tree records');
  assert.match(media, /originalOnSelect\(rawById\[selectedId\] \|\| selectedTree\)/, 'manual card selection must pass the hydrated raw tree when available');
});

test('My Trees hub does not leave an empty selected media frame', () => {
  const css = read('css/my-trees.css');
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  const media = read('js/my-trees/my-trees-preview-media.js');

  assert.match(css, /#myTreesHubPanel\.is-loaded\s+#myTreesHubVideoContainer\s*\{\s*display:\s*none;/s, 'loaded state keeps the compact no-media default');
  assert.match(css, /#myTreesHubPanel\.is-loaded\.has-media\s+#myTreesHubVideoContainer\s*\{\s*display:\s*block;/s, 'selected trees with actual media must opt back into the visible frame');
  assert.match(content, /\.my-trees-hub-panel\.is-loaded:not\(\.has-media\)\s+#myTreesHubVideoContainer\s*\{\s*display:\s*none;/s, 'no-media selected state must hide its media region');
  assert.match(media, /function replaceMediaMarkup\(media, markup\)[\s\S]*?media\.replaceChildren\(\);/, 'switching/no-media paths must clear prior media nodes');
  assert.match(media, /els\.container\.hidden = true;/, 'no-media selected state must hide the media container');
  assert.match(media, /function showPlaceholder\(\)[\s\S]*?els\.container\.hidden = false;/, 'unselected state must restore only the intentional placeholder');
});

test('My Trees hub removes non-functional media overlays', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');

  assert.match(content, /#myTreesHubVideoContainer::before\s*\{\s*content:\s*none;?\s*\}/s, 'My Trees hub video container must have content: none override');
  assert.match(content, /#myTreesHubMedia\s+\.preview-media-frame-thumbnail\s+\[data-preview-overlay\]\s*\{\s*display:\s*none\s*!important;?\s*\}/s, 'My Trees hub thumbnail overlay must be display: none !important');

  // Broad iframe direct-child div suppression is intentionally removed:
  // it hides the click-to-play wrapper/media-title and breaks click interaction.
  assert.doesNotMatch(content, /#myTreesHubMedia\s+\.preview-media-frame-iframe\s*>\s*div\s*\{\s*display:\s*none\s*!important/s, 'My Trees hub must not suppress iframe direct-child divs globally');
});

test('My Trees hub uses localized 내 트리 미리보기 and Selected tree tags', () => {
  const i18n = read('js/i18n/i18n-my-trees.js');
  const refresh = read('js/my-trees/my-trees-i18n-refresh.js');
  const html = read('pages/my-trees.html');
  const hub = read('js/my-trees/my-trees-preview-hub.js');

  assert.match(i18n, /'myTrees\.hub_title':\s*\{\s*ko:\s*'내 러브트리',\s*en:\s*'My LoveTree'\s*\}/, 'hub_title must be in i18n-my-trees.js');
  assert.match(i18n, /'myTrees\.hub_badge':\s*\{\s*ko:\s*'선택한 내 트리',\s*en:\s*'Selected tree'\s*\}/, 'hub_badge must be in i18n-my-trees.js');
  assert.match(refresh, /setText\('myTreesHubTitle',\s*'myTrees\.hub_title',\s*'내 러브트리'\);/, 'refresh script must update myTreesHubTitle');
  assert.match(refresh, /setText\('myTreesHubBadge',\s*'myTrees\.hub_badge',\s*'선택한 내 트리'\);/, 'refresh script must update myTreesHubBadge');
  assert.match(html, /id="myTreesHubTitle"\s+data-i18n="myTrees\.hub_title"/, 'HTML must have data-i18n attribute for hub title');
  assert.match(html, /id="myTreesHubBadge"\s+data-i18n="myTrees\.hub_badge"/, 'HTML must have data-i18n attribute for hub badge');

  assert.match(hub, /showPlaceholder\(\)[\s\S]*?i18nHub\('myTrees\.hub_badge'/, 'showPlaceholder must update badge using myTrees.hub_badge key');
  assert.match(hub, /showContent\([\s\S]*?i18nHub\('myTrees\.hub_badge'/, 'showContent must update badge using myTrees.hub_badge key');

  // Verify no empty string keys are used for the hub badge in runtime rendering
  const lines = hub.split('\n');
  for (const line of lines) {
    if (line.includes('els.badge.textContent') && line.includes('i18nHub')) {
      assert.ok(line.includes("'myTrees.hub_badge'"), `Badge update line "${line.trim()}" must use 'myTrees.hub_badge' key`);
    }
  }
});

test('My Trees hub visually simplifies representative blocks and differentiates actions', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');

  assert.match(content, /\.my-trees-hub-rep\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*8px;\s*margin-top:\s*16px;\s*padding:\s*0;\s*border-radius:\s*0;\s*background:\s*transparent;\s*border:\s*none;\s*box-shadow:\s*none;\s*\}/s, 'representative block card decorations must be removed');
  assert.match(actions, /\.my-trees-hub-open-btn\s*\{[^}]*background:\s*var\(--primary\);[^}]*color:\s*white;[^}]*\}/s, '감상 열기 (openBtn) must be primary colored');
  // #3578 Phase 1: the Edit secondary button is removed from the hub.
  // Appreciation (openBtn) is the only external entry; verify the obsolete
  // edit-btn secondary outline style is gone.
  assert.doesNotMatch(actions, /\.my-trees-hub-edit-btn\b/, 'obsolete edit-btn secondary style must be absent (#3578)');
});

// ─── Issue #3944: participant continuation authority ────────────────────────

test('My Trees server-page append preserves local batch authority and truthful partial counts', () => {
  const batch = read('js/my-trees/my-trees-batch-render.js');
  const appendStart = batch.indexOf('function appendTrees(');
  const renderStart = batch.indexOf('function renderTrees(', appendStart);
  const appendBlock = batch.slice(appendStart, renderStart);

  assert.ok(appendStart >= 0, 'batch renderer must define appendTrees');
  assert.match(appendBlock, /allTreesData = Array\.isArray\(allTrees\) \? allTrees : \[\];/, 'server page must extend the in-memory authority');
  assert.match(appendBlock, /renderNextBatch\(/, 'server page append must continue through the bounded local batch renderer');
  assert.doesNotMatch(appendBlock, /grid\.innerHTML\s*=/, 'server page append must never clear the existing grid');
  assert.doesNotMatch(appendBlock, /newItems\.forEach\(/, 'server page append must not dump the full fetched page directly into the DOM');
  assert.match(batch, /summary\.textContent = '현재 ' \+ totalTreesCount \+ '개 로드됨';/, 'non-terminal cursor state must say the currently loaded count');
  assert.match(batch, /\(i18n\.myTrees_count \|\| '총 \{count\}개'\)/, 'terminal cursor state may restore the authoritative total label');
});

test('My Trees Tree continuation keeps stale finalizers from clearing a newer request and restores retry UI', () => {
  const render = read('js/my-trees/my-trees-render.js');

  assert.match(render, /value === false[\s\S]*?dataModule\.isLoadMoreInFlight\(\)/, 'loading=false must be rejected while the generation-owned request guard is still active');
  assert.match(render, /callerOptions\.appendTrees = function/, 'loadMoreTrees bridge must inject append semantics even for legacy callers');
  assert.match(render, /callerOptions\.onSettled = function/, 'loadMoreTrees bridge must inject a settlement hook');
  assert.match(render, /refreshPaginationControls\(\);/, 'settlement must refresh the retry/load-more control');
  assert.match(render, /onLoadMore: requestNextTreePage/, 'refreshed control must call the same bounded continuation authority');
});

test('My Trees Memory hydration uses the bounded owner page contract instead of the legacy capped list', () => {
  const render = read('js/my-trees/my-trees-render.js');
  const client = read('js/postgres-client.js');

  assert.match(client, /getMemoriesPage: async \(options = \{\}\)/, 'canonical client must expose owner Memory cursor paging');
  assert.match(render, /var MEMORY_PAGE_LIMIT = 100;/, 'participant Memory reads must remain bounded per request');
  assert.match(render, /client\.getMemoriesByTree = function \(treeId\)/, 'legacy hydration call must be bridged without changing preview-state API shape');
  assert.match(render, /client\.getMemoriesPage\(\{ treeId: authority\.treeId, limit: MEMORY_PAGE_LIMIT \}\)/, 'initial hydration must consume exactly one bounded cursor page');
  assert.match(render, /entry\.nextCursor = page\.nextCursor;/, 'initial hydration must retain the continuation cursor');
  assert.match(render, /return entry\.items\.slice\(\);/, 'legacy hydration consumer must still receive an array-compatible first page');
});

test('My Trees Memory continuation is explicit-demand, one-page-at-a-time, retryable, and authority-bound', () => {
  const render = read('js/my-trees/my-trees-render.js');
  const start = render.indexOf('function fetchNextMemoryPage(');
  const end = render.indexOf('function isExpandedFlowToggle(', start);
  const block = render.slice(start, end);

  assert.ok(start >= 0 && end > start, 'fetchNextMemoryPage participant path must exist');
  assert.match(block, /entry\.initialized && !entry\.nextCursor/, 'terminal Memory cursor must stop further reads');
  assert.match(block, /var requestCursor = entry\.initialized \? entry\.nextCursor : null;/, 'retry must reuse the retained cursor authority');
  assert.match(block, /client\.getMemoriesPage\(\{[\s\S]*?cursor: requestCursor \|\| undefined/, 'one participant demand must issue one bounded page request');
  assert.match(block, /isMemoryAuthorityCurrent\(authority, true\)/, 'late page completion must re-check current account/generation/selected-tree authority');
  assert.match(block, /requestSeq !== entry\.requestSeq/, 'superseded Memory requests must be discarded');
  assert.match(block, /entry\.nextCursor = page\.nextCursor;/, 'cursor may advance only on a valid successful completion');
  assert.match(block, /Cursor is intentionally not advanced on failure/, 'failure path must preserve the retry cursor');
  assert.doesNotMatch(block, /while\s*\(/, 'Memory continuation must never auto-drain pages');
  assert.doesNotMatch(block, /for\s*\([^;]*;[^;]*nextCursor/, 'Memory continuation must not loop on cursor exhaustion');

  assert.match(render, /getConfirmedOwnerUid\(\) !== authority\.uid/, 'Memory page state must be bound to the authenticated owner');
  assert.match(render, /getOwnerListGeneration\(\) !== authority\.generation/, 'Memory page state must be bound to the owner-list epoch');
  assert.match(render, /getTreeId\(selected\) !== authority\.treeId/, 'participant continuation must reject a late response after tree selection changes');
  assert.match(render, /data-my-trees-memory-continuation/, 'expanded flow must expose a dedicated demand control when another server page exists');
  assert.match(render, /setTimeout\(function \(\) \{\s*fetchNextMemoryPage\(selectedTree\);\s*\}, 0\);/, 'first flow expansion must request at most one additional page after the existing toggle runs');
});
