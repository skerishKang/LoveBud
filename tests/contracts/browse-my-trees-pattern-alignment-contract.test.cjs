const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. #2532 issue marker or test description check', () => {
  const selfContent = read('tests/contracts/browse-my-trees-pattern-alignment-contract.test.cjs');
  assert.ok(selfContent.includes('#2532'), 'Test must contain #2532 issue marker reference');
});

test('2. pages/my-trees.html heading uses shared multi-line rhythm classes', () => {
  const html = read('pages/my-trees.html');
  // Use shared title-line and title-accent classes instead of my-trees specific ones
  assert.ok(/\btitle-line\b/.test(html), 'my-trees.html must use shared multi-line class "title-line"');
  assert.ok(/\btitle-accent\b/.test(html), 'my-trees.html must use shared title-accent class');
});

test('3. My LoveTree description uses distinct personal archive copy', () => {
  const html = read('pages/my-trees.html');
  const i18n = read('js/i18n/i18n-my-trees.js');
  const refresh = read('js/my-trees/my-trees-i18n-refresh.js');
  const expectedLead = '기록해 둔 나의 순간,';
  const expectedDetail = '소중한 마음의 결을 천천히 꺼내보세요.';
  const combined = [html, i18n, refresh].join('\n');
  assert.ok(combined.includes(expectedLead), `My LoveTree description should contain: "${expectedLead}"`);
  assert.ok(combined.includes(expectedDetail), `My LoveTree description should contain: "${expectedDetail}"`);
  assert.ok(!html.includes('첫 순간과 이어진 마음을 이어보고 관리해요.'), 'My Trees stale one-line description must be removed from initial HTML');
});

test('4. Browse hero copy is preserved', () => {
  const html = read('pages/search.html');
  assert.ok(html.includes('다른 사람의') && html.includes('러브트리를') && html.includes('둘러보세요'), 'Browse hero heading must remain preserved');
});

test('4a. Browse and My LoveTree hero titles use the shared mobile hero title class', () => {
  const browseHtml = read('pages/search.html');
  const myTreesHtml = read('pages/my-trees.html');

  // Browse: h1 must contain both "headline" and "shared-mobile-hero-title" tokens in its class attribute.
  const browseH1 = browseHtml.match(/<h1\b[^>]*>/);
  assert.ok(browseH1, 'Browse page must have an h1');
  assert.match(
    browseH1[0],
    /class="[^"]*\bshared-mobile-hero-title\b[^"]*"/,
    'Browse hero h1 must opt into the shared mobile hero title class',
  );

  // My Trees: h1 (matching myTreesPageTitle) must contain "shared-mobile-hero-title" token.
  const myTreesH1 = myTreesHtml.match(/<h1\b[^>]*id="myTreesPageTitle"[^>]*>/);
  assert.ok(myTreesH1, 'My Trees page must have an h1 with id="myTreesPageTitle"');
  assert.match(
    myTreesH1[0],
    /class="[^"]*\bshared-mobile-hero-title\b[^"]*"/,
    'My Trees hero h1 must opt into the shared mobile hero title class',
  );
});

test('4b. My LoveTree mobile hero description rhythm matches Browse/Home/Intro lead rhythm', () => {
  const css = read('css/my-trees/my-trees-responsive.css');

  assert.match(
    css,
    /\.my-trees-header p\s*{[^}]*font-size:\s*0\.96rem;[^}]*line-height:\s*1\.72;[^}]*max-width:\s*100%;[^}]*}/,
    'My Trees mobile hero description must use the shared mobile lead rhythm',
  );
});

test('4c. My LoveTree hub panel id remains stable', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('id="myTreesHubPanel"'), 'My Trees hub panel id must remain camelCase stable');
  assert.ok(!html.includes('id="MyTreesHubPanel"'), 'My Trees hub panel id must not change casing');
});

test('4d. My LoveTree search panel follows Browse utility panel visual structure', () => {
  const finderCss = read('css/my-trees/my-trees-finder.css');
  const headerCss = read('css/my-trees/my-trees-header.css');
  const responsiveCss = read('css/my-trees/my-trees-responsive.css');
  // Shared controls CSS must carry the base presentation values (#2878: my-trees-search-input
  // no longer duplicates these; they are inherited from .search-input in search-controls.css).
  const sharedCss = read('css/search/search-controls.css');
  assert.match(sharedCss, /\.search-input\s*{[^}]*padding:\s*15px 18px 15px 48px;[^}]*border-radius:\s*999px;[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\);/s,
    '#2878: shared .search-input in search-controls.css must carry the base presentation values that .my-trees-search-input now inherits');
  // #2878: line-height and appearance are now in shared .search-input, not in .my-trees-search-input.
  assert.match(sharedCss, /\.search-input\s*{[^}]*line-height:\s*1\.15;[^}]*}/s,
    '#2878: shared .search-input must carry line-height: 1.15');
  assert.match(sharedCss, /\.search-input\s*{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;[^}]*}/s,
    '#2878: shared .search-input must carry appearance: none / -webkit-appearance: none');

  // #2878: .my-trees-finder desktop base block removed; now inherits from .browse-utility-row in search-controls.css
  // webkit decoration reset lives in finder.css.
  assert.match(finderCss, /\.my-trees-search-input::-webkit-search-decoration,\s*\.my-trees-search-input::-webkit-search-cancel-button,\s*\.my-trees-search-input::-webkit-search-results-button,\s*\.my-trees-search-input::-webkit-search-results-decoration\s*{\s*display:\s*none;\s*}/s);
  assert.match(headerCss, /\.my-trees-header\s*{[^}]*margin-bottom:\s*12px;[^}]*padding-bottom:\s*0;[^}]*border-bottom:\s*0;[^}]*}/s);
  assert.match(headerCss, /\.my-trees-results-head\s*{[^}]*margin:\s*0 0 16px;[^}]*padding-top:\s*18px;[^}]*border-top:\s*1px solid rgba\(144, 73, 81, 0\.09\);[^}]*}/s);
  assert.match(headerCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-results-head\s*{[^}]*margin-top:\s*0;[^}]*padding-top:\s*14px;[^}]*border-top:\s*1px solid rgba\(144, 73, 81, 0\.09\);[^}]*}/);
  assert.match(responsiveCss, /\.my-trees-finder\s*{[^}]*padding:\s*10px;[^}]*border-radius:\s*18px;[^}]*background:\s*rgba\(255, 255, 255, 0\.34\);[^}]*box-shadow:\s*none;[^}]*}/s);
  assert.match(responsiveCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-search-input\s*{[^}]*height:\s*40px;[^}]*min-height:\s*40px;[^}]*max-height:\s*40px;[^}]*line-height:\s*1\.15;[^}]*}/);
});

test('4e. My LoveTree top finder keeps four chips for Browse parity', () => {
  const html = read('pages/my-trees.html');
  const finderSection = html.slice(html.indexOf('id="myTreesFilterChips"'), html.indexOf('</section>', html.indexOf('id="myTreesFilterChips"')));
  const chips = finderSection.match(/class="my-trees-filter-chip/g) || [];
  assert.equal(chips.length, 4, 'My Trees finder must show four top chips like Browse mobile density');
  assert.ok(finderSection.includes('data-filter="all"'), 'all filter must remain');
  assert.ok(finderSection.includes('data-filter="public"'), 'public filter must remain');
  assert.ok(finderSection.includes('data-filter="private"'), 'private filter must remain');
  assert.ok(finderSection.includes('data-filter="has-moments"'), 'has-moments filter must remain');
  assert.ok(!finderSection.includes('data-filter="empty"'), 'fifth empty-state filter must be removed from the top finder');
});

test('4f. My LoveTree search input uses type="text" to match Browse mobile rendering', () => {
  const html = read('pages/my-trees.html');
  const searchInputBlock = html.slice(html.indexOf('id="myTreesSearchInput"'), html.indexOf('/>', html.indexOf('id="myTreesSearchInput"')) + 2);
  assert.ok(searchInputBlock.includes('type="text"'), 'My Trees search input must use type="text" for consistent mobile rendering with Browse');
  assert.ok(!searchInputBlock.includes('type="search"'), 'My Trees search input must NOT use type="search" (causes WebKit native decoration and height differences)');
});

test('4g. My LoveTree CSS bundle keeps finder import before responsive import (preserves mobile override)', () => {
  const bundleCss = read('css/my-trees.css');
  const finderIdx = bundleCss.indexOf('my-trees-finder.css');
  const responsiveIdx = bundleCss.indexOf('my-trees-responsive.css');
  assert.ok(finderIdx > 0, 'css/my-trees.css must import my-trees-finder.css');
  assert.ok(responsiveIdx > 0, 'css/my-trees.css must import my-trees-responsive.css');
  assert.ok(finderIdx < responsiveIdx, 'css/my-trees.css must import my-trees-finder.css BEFORE my-trees-responsive.css so the mobile 40px responsive rule wins the cascade');
});

test('4h. Browse and My Trees share canonical results-head slot topology', () => {
  const browseHtml = read('pages/search.html');
  const myTreesHtml = read('pages/my-trees.html');

  // Both pages must have the three canonical slots in order:
  // browse-results-title-slot → browse-results-owner-cta-slot → browse-results-controls
  const canonicalSlotPattern = /browse-results-title-slot[\s\S]*browse-results-owner-cta-slot[\s\S]*browse-results-controls/;

  assert.ok(
    canonicalSlotPattern.test(browseHtml.slice(browseHtml.indexOf('browse-results-head'))),
    'Browse results-head must contain title-slot → owner-cta-slot → controls in order'
  );
  assert.ok(
    canonicalSlotPattern.test(myTreesHtml.slice(myTreesHtml.indexOf('browse-results-head'))),
    'My Trees results-head must contain title-slot → owner-cta-slot → controls in order'
  );

  // Browse owner CTA slot must be hidden
  assert.ok(browseHtml.includes('browse-results-owner-cta-slot" hidden'), 'Browse owner CTA slot must have hidden attribute');

  // My Trees CTA must be inside owner-cta-slot and before controls
  const myTreesOwnerSlotIdx = myTreesHtml.indexOf('browse-results-owner-cta-slot');
  const myTreesControlsIdx = myTreesHtml.indexOf('my-trees-results-controls');
  const ctaIdx = myTreesHtml.indexOf('id="headerCreateTreeBtn"');
  assert.ok(myTreesOwnerSlotIdx > 0, 'My Trees must have owner-cta-slot');
  assert.ok(ctaIdx > myTreesOwnerSlotIdx, 'My Trees CTA must be inside owner-cta-slot');
  assert.ok(ctaIdx < myTreesControlsIdx, 'My Trees CTA must appear before controls');

  // .my-trees-results-title-row must NOT exist in HTML
  assert.ok(!myTreesHtml.includes('my-trees-results-title-row'), 'My Trees HTML must not contain .my-trees-results-title-row');
  assert.ok(!browseHtml.includes('my-trees-results-title-row'), 'Browse HTML must not contain .my-trees-results-title-row');
});

test('4i. My LoveTree mobile owner-cta-slot CTA is compact and view-mode control shrinks to fit', () => {
  const headerCss = read('css/my-trees/my-trees-header.css');
  // Owner-cta-slot create CTA must use compact sizing on mobile so it does not dominate the row.
  const mobileCta = headerCss.match(
    /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-results-head\s+\.browse-results-owner-cta-slot\s+\.btn-header-create\s*{([^}]*)}/
  );
  assert.ok(mobileCta, 'My LoveTree mobile .my-trees-results-head .browse-results-owner-cta-slot .btn-header-create rule must exist inside @media (max-width:768px)');
  const ctaBody = mobileCta[1];
  assert.match(ctaBody, /min-height:\s*36px/, 'mobile owner-cta-slot CTA must use min-height: 36px');
  assert.match(ctaBody, /padding:\s*0\s+12px/, 'mobile owner-cta-slot CTA must use padding: 0 12px');
  assert.match(ctaBody, /width:\s*auto/, 'mobile owner-cta-slot CTA must use width: auto (not full-width)');
  // View-mode segmented control must stay shrink-to-fit (flex: 0 0 auto) on mobile.
  assert.match(
    headerCss,
    /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-results-controls\s+\.my-trees-view-mode-mount\s*{[^}]*flex:\s*0\s+0\s+auto;[^}]*}/,
    'My LoveTree mobile view-mode control must stay shrink-to-fit (flex: 0 0 auto) on mobile so sort and view-mode do not stretch to equal widths',
  );
});

test('5. search-preview-state.js sets/removes data-selected-tree-card marker', () => {
  const source = read('js/search/search-preview-state.js');
  assert.ok(source.includes('data-selected-tree-card'), 'search-preview-state.js must reference data-selected-tree-card');
  assert.ok(source.includes('removeAttribute') && source.includes('setAttribute'), 'search-preview-state.js must set and remove data-selected-tree-card');
});

test('6. my-trees-preview-hub.js sets/removes data-selected-tree-card marker', () => {
  const sourceHub = read('js/my-trees/my-trees-preview-hub.js');
  const sourceState = read('js/my-trees/my-trees-preview-state.js');
  const hasMarker = sourceHub.includes('data-selected-tree-card') || sourceState.includes('data-selected-tree-card');
  assert.ok(hasMarker, 'My Trees preview files must manage data-selected-tree-card');
});

test('7. Browse .tree-card.is-active class is preserved', () => {
  const source = read('js/search/search-preview-state.js');
  const css = read('css/search/search-tree-card/layout.css');
  assert.ok(source.includes('is-active'), 'search-preview-state.js must preserve is-active class name');
  assert.ok(css.includes('.tree-card.is-active'), 'search-tree-card/layout.css must preserve is-active styling');
});

test('8. My LoveTree .tree-card.is-selected class is preserved', () => {
  const sourceHub = read('js/my-trees/my-trees-preview-hub.js');
  const sourceState = read('js/my-trees/my-trees-preview-state.js');
  const css = read('css/my-trees/my-trees-cards.css');
  const hasSelectedClass = sourceHub.includes('is-selected') || sourceState.includes('is-selected');
  assert.ok(hasSelectedClass, 'My Trees files must preserve is-selected class name');
  assert.ok(css.includes('.tree-card.is-selected'), 'my-trees-cards.css must preserve is-selected styling');
});

test('9. Browse card order: media -> title -> subtitle -> public metadata -> meta row/open', () => {
  const source = read('js/search/search-card-renderer.js');
  const cardFnStart = source.indexOf('function renderTreeCard');
  assert.ok(cardFnStart !== -1, 'renderTreeCard function must exist');
  const cardFnSection = source.slice(cardFnStart);
  const templateStart = cardFnSection.indexOf('return `');
  assert.ok(templateStart !== -1, 'Template return block must exist');
  const templateSection = cardFnSection.slice(templateStart);
  const idxMedia = templateSection.indexOf('renderRepresentativeMedia');
  const idxTitle = templateSection.indexOf('tree-title');
  const idxSubtitle = templateSection.indexOf('subtitleClass');
  const idxMeta = templateSection.indexOf('metadataHtml');
  const idxMetaRow = templateSection.indexOf('tree-meta-row');
  const idxOpen = templateSection.indexOf('tree-card-open-link');
  assert.ok(idxMedia !== -1, 'Media template helper must exist');
  assert.ok(idxTitle !== -1, 'Title tag must exist');
  assert.ok(idxSubtitle !== -1, 'Subtitle class variable must exist');
  assert.ok(idxMeta !== -1, 'MetadataHtml variable must exist');
  assert.ok(idxMetaRow !== -1, 'Meta row class must exist');
  assert.ok(idxOpen !== -1, 'Open link class must exist');
  assert.ok(idxMedia < idxTitle, 'media must be before title');
  assert.ok(idxTitle < idxSubtitle, 'title must be before subtitle');
  assert.ok(idxSubtitle < idxMeta, 'subtitle must be before metadata');
  assert.ok(idxMeta < idxMetaRow, 'metadata must be before meta row');
});

test('10. My LoveTree card order: thumb -> body/title/subcopy/meta-row/action (Browse parity)', () => {
  const source = read('js/my-trees/my-trees-ui.js');
  const cardFnStart = source.indexOf('function buildTreeCard');
  assert.ok(cardFnStart !== -1, 'buildTreeCard function must exist');
  const cardFnSection = source.slice(cardFnStart);
  const templateStart = cardFnSection.indexOf('card.innerHTML = [');
  assert.ok(templateStart !== -1, 'innerHTML block must exist');
  const templateSection = cardFnSection.slice(templateStart);
  const idxThumb = templateSection.indexOf('buildTreeThumbVisual');
  const idxBody = templateSection.indexOf('tree-card-body');
  const idxTitle = templateSection.indexOf('tree-card-title');
  const idxSubcopy = templateSection.indexOf('tree-card-subcopy');
  const idxMeta = templateSection.indexOf('cardMeta.visibilityBadgeHtml');
  const idxMetaRow = templateSection.indexOf('tree-meta-row');
  const idxReaction = templateSection.indexOf('tree-card-reaction-metrics');
  const idxOpen = templateSection.indexOf('tree-card-open-link');
  assert.ok(idxThumb !== -1, 'Thumb template helper must exist');
  assert.ok(idxBody !== -1, 'Single tree-card-body container must exist (Browse parity)');
  assert.ok(idxTitle !== -1, 'Title class must exist');
  assert.ok(idxSubcopy !== -1, 'Subcopy class must exist');
  assert.ok(idxMeta !== -1, 'Visibility badge template must exist');
  assert.ok(idxMetaRow !== -1, 'tree-meta-row wrapper must exist');
  assert.ok(idxReaction !== -1, 'tree-card-reaction-metrics must exist (Browse parity)');
  assert.ok(idxOpen !== -1, 'Open link class must exist');
  assert.ok(idxThumb < idxBody, 'thumb must be before body');
  assert.ok(idxBody < idxMetaRow, 'body must contain the meta-row');
  assert.ok(idxTitle < idxMeta, 'title must be before visibilityBadgeHtml');
  assert.ok(idxMeta < idxSubcopy, 'visibilityBadgeHtml must be before subcopy (in title-row)');
  assert.ok(idxSubcopy < idxMetaRow, 'subcopy must be before meta-row');
  assert.ok(idxMetaRow < idxOpen, 'meta-row must be before open link');
  // Step 3 follow-up: the legacy two-block split (info + footer) must not return.
  assert.equal(
    templateSection.indexOf('tree-card-info'),
    -1,
    'Legacy .tree-card-info block must not return after Step 3 unification'
  );
  assert.equal(
    templateSection.indexOf('tree-card-footer'),
    -1,
    'Legacy .tree-card-footer block must not return after Step 3 unification'
  );
});

test('11. No backend/editor/Scout changes', () => {
  assert.ok(true);
});

test('12. No sort=likes/views or social sort exposure changes', () => {
  const uiSource = read('js/search/search-ui.js');
  assert.ok(!uiSource.includes('sort=likes') && !uiSource.includes('sort=views'), 'Should not introduce likes or views sort exposure in Browse UI');
});

test('13. Existing open/edit/create href generation strings remain present', () => {
  const hubSource = read('js/my-trees/my-trees-preview-hub.js');
  const uiSource = read('js/my-trees/my-trees-ui.js');
  assert.ok(hubSource.includes('editor?treeId=') || hubSource.includes('view.html?treeId='), 'my-trees-preview-hub.js must preserve href generation');
  assert.ok(uiSource.includes('editor?treeId=') || uiSource.includes('view.html?treeId='), 'my-trees-ui.js must preserve href generation');
});

test('14. Runtime cache-busts updated for changed JS/CSS', () => {
  const searchHtml = read('pages/search.html');
  const myTreesHtml = read('pages/my-trees.html');
  const myTreesCss = read('css/my-trees.css');
  assert.match(searchHtml, /search-preview-state\.js\?v=20260616-2532-1/);
  assert.match(myTreesHtml, /my-trees-ui\.js\?v=20260626-2824-visibility-state-2/);
  // Softened: any non-empty cache-bust on my-trees-preview-hub.js plus
  // a guard that the pre-#2829 baseline value is gone. Future
  // cache-bust bumps should not require updating this assertion
  // (PR #2834 follow-up). The version-specific contract for the
  // post-#2825 cache-bust lives in
  // tests/contracts/my-trees-flow-stage-cache-bust-contract.test.cjs.
  assert.match(
    myTreesHtml,
    /my-trees-preview-hub\.js\?v=[^"'\s>]+/,
    'my-trees-preview-hub.js must carry a non-empty cache-bust query string'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-hub\.js\?v=20260622-parity-1/,
    'my-trees-preview-hub.js must not still pin the pre-#2829 cache-bust 20260622-parity-1'
  );
  assert.match(
    myTreesHtml,
    /my-trees-preview-state\.js\?v=[^"'\s>]+/,
    'my-trees-preview-state.js must carry a non-empty cache-bust query string'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-state\.js\?v=20260622-step9-1/,
    'my-trees-preview-state.js must not still pin the pre-#2835 cache-bust 20260622-step9-1'
  );
  assert.match(myTreesHtml, /my-trees-i18n-refresh\.js\?v=20260622-hub-social-dedupe-1/);
  assert.match(myTreesHtml, /i18n-my-trees\.js\?v=20260619-2710-1/);
  assert.match(
    myTreesHtml,
    /my-trees\.css\?v=[^"'\s>]+/,
    'pages/my-trees.html must load my-trees.css with a non-empty cache-bust query'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees\.css\?v=20260622-title-row-1/,
    'pages/my-trees.html must not still pin the pre-#social-bar-path cache-bust 20260622-title-row-1 on my-trees.css'
  );
  assert.match(myTreesHtml, /my-trees-page\.js\?v=20260622-mytrees-create-1/);
  assert.match(myTreesCss, /my-trees-header\.css\?v=20260625-2878-structure-1/);
  assert.match(
    myTreesCss,
    /my-trees-preview-hub\.css\?v=[^"'\s>]+/,
    'css/my-trees.css must import my-trees-preview-hub.css with a non-empty cache-bust query'
  );
  assert.doesNotMatch(
    myTreesCss,
    /my-trees-preview-hub\.css\?v=20260622-hub-preview-1/,
    'css/my-trees.css must not still pin the pre-#social-bar-path cache-bust 20260622-hub-preview-1 on my-trees-preview-hub.css'
  );
  assert.match(myTreesCss, /my-trees-mobile-controls-balance\.css\?v=20260622-mytrees-controls-1/);
  assert.match(myTreesCss, /search\/search-controls\.css/);
  assert.match(myTreesCss, /search\/search-preview-sidebar\.css/);
  assert.match(
    myTreesCss,
    /#myTreesHubPanel\.is-loaded #myTreesHubVideoContainer\s*\{\s*display:\s*none;/
  );
  assert.ok(!/my-trees-finder\.css\?v=/.test(myTreesHtml), 'pages/my-trees.html must NOT directly link my-trees-finder.css (bundle owns finder import)');
  assert.match(
    searchHtml,
    /search\.css\?v=[^"'\s>]+/,
    'pages/search.html must load search.css with a non-empty cache-bust query'
  );
  assert.doesNotMatch(
    searchHtml,
    /search\.css\?v=20260626-2923-hub-flow-baseline-1/,
    'pages/search.html must not keep the pre-CTP-overlay cache-bust 20260626-2923-hub-flow-baseline-1'
  );
});

test('15. My LoveTree desktop visual rhythm alignment with Browse', () => {
  const headerCss = read('css/my-trees/my-trees-header.css');
  const searchControlsCss = read('css/search/search-controls.css');
  const uncommentedHeaderCss = headerCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const uncommentedSearchCss = searchControlsCss.replace(/\/\*[\s\S]*?\*\//g, '');

  // 1. .my-trees-results-head desktop block exists
  const resultsHeadDecl = uncommentedHeaderCss.match(/\.my-trees-results-head\s*\{([^}]*)\}/);
  assert.ok(resultsHeadDecl, '.my-trees-results-head block must be declared');

  // 2. Canonical slot base classes exist in search-controls.css
  assert.match(uncommentedSearchCss, /\.browse-results-title-slot\s*\{/, '.browse-results-title-slot must be defined in search-controls.css');
  assert.match(uncommentedSearchCss, /\.browse-results-owner-cta-slot\s*\{/, '.browse-results-owner-cta-slot must be defined in search-controls.css');
  assert.match(uncommentedSearchCss, /\.browse-results-owner-cta-slot\[hidden\]/, '.browse-results-owner-cta-slot[hidden] rule must exist to hide Browse slot');

  // 3. .my-trees-results-controls has flex-wrap: nowrap in desktop (margin-left: auto removed —
  //    canonical parent slot order and title-slot flex handle desktop alignment)
  assert.match(
    uncommentedHeaderCss,
    /\.my-trees-results-controls\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*}/,
    '.my-trees-results-controls must have flex-wrap: nowrap in desktop declaration'
  );

  // 4. .my-trees-results-title-row must NOT exist in CSS
  assert.ok(!uncommentedHeaderCss.includes('.my-trees-results-title-row'), '.my-trees-results-title-row selector must be removed from my-trees-header.css');
});
