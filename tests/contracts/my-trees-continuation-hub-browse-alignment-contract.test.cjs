'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('My Trees hub preserves its runtime ids and owner actions', () => {
  const html = read('pages/my-trees.html');
  const requiredIds = [
    'myTreesHubPanel',
    'myTreesHubContent',
    'myTreesHubFlow',
    'myTreesHubSummary',
    'myTreesHubOpenBtn',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `My Trees hub must retain #${id}`);
  }

  assert.match(html, /id=["']myTreesHubOpenBtn["'][^>]*>\s*[\s\S]*?감상하기/, 'primary owner action must be 감상하기');
  assert.equal(html.includes('편집하기'), false, '#3578 Phase 1: 편집하기 removed from static HTML');

  // Verify rep block removal
  assert.ok(!html.includes('id="myTreesHubRep"'), 'myTreesHubRep must be removed from the HTML');
  assert.ok(!html.includes('myTreesHubRepTitle'), 'myTreesHubRepTitle must be removed from the HTML');
  assert.ok(!html.includes('myTreesHubRepMemo'), 'myTreesHubRepMemo must be removed from the HTML');
  assert.ok(!html.includes('첫 순간 기록'), '“첫 순간 기록” label must be removed from the HTML');

  // Verify getRepTextMeta is not in the js codebase
  const js = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(!js.includes('getRepTextMeta'), 'getRepTextMeta must not be used or defined');
});

test('My Trees continuation flow uses Browse-like single-column desktop rhythm (shared via preview-flow-* classes)', () => {
  // The grid, stage, and stage-label baseline moved to Browse flow.css.
  // My Trees inherits via shared preview-flow-list / preview-flow-stage classes.
  const browseFlow = read('css/search/search-preview-sidebar/flow.css');
  assert.match(
    browseFlow,
    /\.preview-flow-list[^{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*gap:\s*7px;/s,
    'Browse flow.css .preview-flow-list must define grid-template-columns and gap'
  );
  assert.match(
    browseFlow,
    /\.preview-flow-stage\s*\{[^}]*padding:\s*8px\s+10px\s*!important;[^}]*border-radius:\s*12px\s*!important;/s,
    'Browse flow.css .preview-flow-stage must define padding and border-radius'
  );
  assert.match(
    browseFlow,
    /\.preview-flow-stage\s*\{[^}]*(?:min-)?height:\s*42px\s*!important/,
    'Browse flow.css .preview-flow-stage must define 42px height'
  );
});

test('My Trees continuation flow stays one-column at narrow breakpoints (inherited from Browse responsive)', () => {
  // The 1024px .my-trees-hub-flow-list override removed from My Trees responsive.css.
  // The single-column collapse is now inherited from .preview-flow-list base rule.
  const browseResp = read('css/search/search-preview-sidebar/responsive.css');
  assert.match(
    browseResp,
    /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.preview-flow-list[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'Browse responsive.css must collapse flow list to single column at narrow widths'
  );
});

test('My Trees hub preserves owner-specific flow padding deltas at 768px and 375px', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');
  assert.match(
    responsive,
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.my-trees-hub-flow\s*\{[^}]*padding:\s*16px\s*!important;/,
    'responsive.css must preserve .my-trees-hub-flow padding: 16px !important at <=768px'
  );
  assert.match(
    responsive,
    /@media\s*\(max-width:\s*375px\)[\s\S]*?\.my-trees-hub-flow\s*\{[^}]*padding:\s*12px\s*!important;/,
    'responsive.css must preserve .my-trees-hub-flow padding: 12px !important at <=375px'
  );
});

test('My Trees hub keeps its non-media focus surface and shared visual rhythm', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');
  const cssFiles = [
    'css/my-trees/my-trees-preview-hub/layout.css',
    'css/my-trees/my-trees-preview-hub/content.css',
    'css/my-trees/my-trees-preview-hub/flow.css',
    'css/my-trees/my-trees-preview-hub/states.css',
    'css/my-trees/my-trees-preview-hub/actions.css',
    'css/my-trees/my-trees-preview-hub/responsive.css',
  ];

  assert.match(content, /\.my-trees-hub-rep\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*8px;\s*margin-top:\s*16px;\s*padding:\s*0;\s*border-radius:\s*0;\s*background:\s*transparent;\s*border:\s*none;\s*box-shadow:\s*none;\s*\}/s, 'first-moment block card decorations must be removed for a unified focus surface');
  assert.match(actions, /\.my-trees-hub-open-btn\s*\{[^}]*min-height:\s*50px;[^}]*border-radius:\s*999px;/s, '트리 열기 primary action rhythm');
  // #3578 Phase 1: the edit secondary action is removed; share/visibility retain rhythm.
  assert.doesNotMatch(actions, /\.my-trees-hub-edit-btn\b/, 'obsolete edit-btn CSS must be absent (#3578)');
  assert.match(actions, /\.my-trees-hub-share-btn[\s\S]*?min-height: 44px;[\s\S]*?border-radius:\s*999px;/, '감상 링크 복사 tertiary action rhythm');
  assert.match(actions, /\.my-trees-hub-visibility-btn[\s\S]*?min-height: 44px;[\s\S]*?border-radius:\s*999px;/, '공개 범위 quaternary action rhythm');

  for (const file of cssFiles) {
    if (file === 'css/my-trees/my-trees-preview-hub/content.css') continue;
    assert.ok(!read(file).includes('aspect-ratio'), `${file} must not introduce an artificial media frame`);
  }
});

test('My Trees hub uses shared hero styling from search-hero-controls.css', () => {
  const html = read('pages/my-trees.html');
  const heroControls = read('css/search/search-hero-controls.css');

  // Verify multi-line structure is intact
  assert.match(html, /<h1 class="headline shared-mobile-hero-title" id="myTreesPageTitle">/);
  // After #2878 structure parity, My Trees uses shared hero styles from search-hero-controls.css
  assert.ok(heroControls.includes('.search-panel-header h1,'), 'shared hero controls must have .search-panel-header h1 selector');
  assert.ok(heroControls.includes('.search-panel-header h2'), 'shared hero controls must have .search-panel-header h2 selector');
  assert.ok(heroControls.includes('font-size: clamp(3.45rem, 5.8vw, 5.15rem)'), 'shared hero controls must have font-size clamp');
  assert.ok(heroControls.includes('.search-panel-header h1 .title-line'), 'shared hero controls must have .search-panel-header h1 .title-line selector');
  assert.ok(heroControls.includes('display: block'), 'shared hero controls must have display: block for title-line');
  assert.match(html, /id="myTreesPageDesc">/);
});
test('My Trees hub tree title uses Browse-parity heading font', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  assert.match(
    content,
    /\.my-trees-hub-tree-title\s*\{[^}]*font-family:\s*var\(--font-heading\);[^}]*\}/,
    '.my-trees-hub-tree-title must use var(--font-heading) to match Browse'
  );
  // font-size, font-weight, line-height must remain unchanged
  assert.match(content, /\.my-trees-hub-tree-title\s*\{[^}]*font-size:\s*1\.34rem;[^}]*\}/);
  assert.match(content, /\.my-trees-hub-tree-title\s*\{[^}]*font-weight:\s*900;[^}]*\}/);
  assert.match(content, /\.my-trees-hub-tree-title\s*\{[^}]*line-height:\s*1\.18;[^}]*\}/);
});

test('My Trees hub summary uses Browse-parity typography (via shared CSS)', () => {
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.match(
    shared,
    /\.preview-summary-slot\s*\{[^}]*font-size:\s*14px;[^}]*\}/,
    '.preview-summary-slot font-size must be 14px matching Browse'
  );
  assert.match(
    shared,
    /\.preview-summary-slot\s*\{[^}]*line-height:\s*1\.6;[^}]*\}/,
    '.preview-summary-slot line-height must be 1.6 matching Browse'
  );
  assert.match(
    shared,
    /\.preview-summary-slot\s*\{[^}]*padding: 0;[^}]*\}/,
    '.preview-summary-slot padding must be 0 matching Browse'
  );
  assert.match(
    shared,
    /\.preview-summary-slot\s*\{[^}]*margin-top:\s*0;[^}]*\}/,
    '.preview-summary-slot margin-top must be 0 matching Browse'
  );
  // My Trees shared class is added alongside owner class
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  assert.ok(
    !content.includes('.my-trees-hub-summary'),
    'content.css must no longer own .my-trees-hub-summary shared presentation'
  );
});

test('My Trees hub actions use Browse-parity heading font and share/visibility font-size', () => {
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');

  // All retained action types must share font-family: var(--font-heading)
  assert.match(
    actions,
    /\.my-trees-hub-open-btn,\s*\.my-trees-hub-share-btn,\s*\.my-trees-hub-visibility-btn\s*\{[^}]*font-family:\s*var\(--font-heading\);[^}]*\}/s,
    'all retained hub action buttons must use var(--font-heading)'
  );

  // share/visibility tertiary font-size must be 13px
  assert.match(
    actions,
    /\.my-trees-hub-share-btn,\s*\.my-trees-hub-visibility-btn\s*\{[^}]*font-size:\s*13px;[^}]*\}/s,
    '.my-trees-hub-share-btn and .my-trees-hub-visibility-btn font-size must be 13px matching Browse'
  );

  // Owner action ids must be preserved
  const html = read('pages/my-trees.html');
  assert.match(html, /id=["']myTreesHubOpenBtn["']/, 'myTreesHubOpenBtn must exist');
  assert.match(html, /id=["']myTreesHubShareBtn["']/, 'myTreesHubShareBtn must exist');
  // #3578 Phase 1: the obsolete Edit ID is intentionally removed from the hub
  assert.doesNotMatch(html, /id=["']myTreesHubEditBtn["']/, 'myTreesHubEditBtn must be absent (#3578)');

  // Action gap and margin now owned by shared CSS .preview-actions
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.match(shared, /\.preview-actions\s*\{[^}]*gap: 0;[^}]*\}/, 'action gap must be 0 matching Browse (in shared CSS)');
  assert.match(shared, /\.preview-actions\s*\{[^}]*margin-top:\s*18px;[^}]*\}/, 'actions margin-top must remain 18px (in shared CSS)');
  const content = read('css/my-trees/my-trees-preview-hub/social-bar.css');
  assert.match(content, /margin-top:\s*1rem;/, 'social shell margin-top must remain unchanged');
  assert.match(content, /padding-top:\s*0\.95rem;/, 'social shell padding-top must remain unchanged');
});

test('My Trees flow controls line-height matches Browse parity', () => {
    const flow = read('css/my-trees/my-trees-preview-hub/flow.css');
    const browseFlow = read('css/search/search-preview-sidebar/flow.css');
    const shared = read('css/shared/preview-hub-content-slots.css');

    // .my-trees-hub-flow-controls must have line-height: 1.2 (owner-specific)
    assert.match(
        flow,
        /\.my-trees-hub-flow-controls\s*\{[^}]*line-height: 1\.2;[^}]*\}/,
        '.my-trees-hub-flow-controls line-height must remain 1.2'
    );
    // margin-top now owned by Browse .preview-flow-controls
    assert.match(
        browseFlow,
        /\.preview-flow-controls\s*\{[^}]*margin-top:\s*11px;/,
        '.preview-flow-controls must own margin-top: 11px'
    );
    // .preview-flow-toggle owns line-height: 1.2
    assert.match(
        browseFlow,
        /\.preview-flow-toggle\s*\{[^}]*line-height:\s*1\.2;[^}]*\}/,
        '.preview-flow-toggle must own line-height: 1.2'
    );
    // flow card padding/margin-bottom now in shared CSS .preview-flow-slot
    // margin-bottom is on :not(.preview-flow-slot-loading) to exclude loading flow
    assert.match(
        shared,
        /\.preview-flow-slot\s*\{[^}]*padding:\s*20px;/s,
        '.preview-flow-slot must own padding: 20px'
    );
    assert.match(
        shared,
        /\.preview-flow-slot:not\(\.preview-flow-slot-loading\)\s*\{[^}]*margin-bottom:\s*16px;/s,
        '.preview-flow-slot:not(.preview-flow-slot-loading) must own margin-bottom: 16px'
    );
    // flow list grid must remain in Browse flow.css
    assert.match(
        browseFlow,
        /\.preview-flow-list[^{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*gap:\s*7px;/s,
        'Browse flow.css .preview-flow-list must own grid and gap'
    );
    // flow stage height must remain in Browse flow.css
    assert.match(
        browseFlow,
        /\.preview-flow-stage\s*\{[^}]*(?:min-)?height:\s*42px\s*!important/,
        'Browse flow.css .preview-flow-stage must own 42px height'
    );
});

test('My Trees hub HTML structure hierarchy follows Browse parity', () => {
  const html = read('pages/my-trees.html');

  // Order assertion: header -> videoContainer -> content (inside has title/badge/flow/no-moments/summary/actions/social)
  // Issue #2841: #myTreesHubDetails wrapper removed; actions and social moved inside #myTreesHubContent.
  const idxHeader = html.indexOf('class="my-trees-hub-header');
  const idxVideo = html.indexOf('id="myTreesHubVideoContainer"');
  const idxContent = html.indexOf('id="myTreesHubContent"');
  const idxNoDetails = html.indexOf('id="myTreesHubDetails"');
  const idxTitle = html.indexOf('id="myTreesHubTreeTitle"');
  const idxMetaBadge = html.indexOf('id="myTreesHubMetaBadge"');
  const idxFlow = html.indexOf('id="myTreesHubFlow"');
  const idxNoMoments = html.indexOf('id="myTreesHubNoMoments"');
  const idxSummary = html.indexOf('id="myTreesHubSummary"');
  const idxActions = html.indexOf('id="myTreesHubActions"');
  const idxSocialSlot = html.indexOf('id="myTreesHubSocialSlot"');

  assert.ok(idxHeader !== -1, 'hub header must exist');
  assert.ok(idxVideo > idxHeader, 'video container must be after header');
  assert.ok(idxContent > idxVideo, 'content container must be after video container');
  assert.ok(idxNoDetails === -1, '#myTreesHubDetails wrapper must be removed (Issue #2841)');
  assert.ok(idxTitle > idxContent, 'tree title must be inside content container');
  assert.ok(idxMetaBadge > idxTitle, 'meta badge must be after tree title');
  assert.ok(idxFlow > idxMetaBadge, 'flow must be after meta badge');
  assert.ok(idxNoMoments > idxFlow, 'no-moments block must be after flow');
  assert.ok(idxSummary > idxNoMoments, 'summary must be after no-moments');
  assert.ok(idxActions > idxSummary, 'actions must be after summary (moved inside content)');
  assert.ok(idxSocialSlot > idxActions, 'social slot must be after actions (last child of content)');
});
