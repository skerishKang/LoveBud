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
    'myTreesHubEditBtn',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `My Trees hub must retain #${id}`);
  }

  assert.match(html, /id=["']myTreesHubOpenBtn["'][^>]*>\s*[\s\S]*?트리\s*열기/, 'primary owner action must be 트리 열기 (Browse parity, Step 5)');
  assert.match(html, /id=["']myTreesHubEditBtn["'][^>]*>\s*[\s\S]*?편집하기/, 'secondary owner action must remain 편집하기');

  // Verify rep block removal
  assert.ok(!html.includes('id="myTreesHubRep"'), 'myTreesHubRep must be removed from the HTML');
  assert.ok(!html.includes('myTreesHubRepTitle'), 'myTreesHubRepTitle must be removed from the HTML');
  assert.ok(!html.includes('myTreesHubRepMemo'), 'myTreesHubRepMemo must be removed from the HTML');
  assert.ok(!html.includes('첫 순간 기록'), '“첫 순간 기록” label must be removed from the HTML');

  // Verify getRepTextMeta is not in the js codebase
  const js = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(!js.includes('getRepTextMeta'), 'getRepTextMeta must not be used or defined');
});

test('My Trees continuation flow uses Browse-like single-column desktop rhythm', () => {
  const flow = read('css/my-trees/my-trees-preview-hub/flow.css');

  // PR #2750: realign desktop flow to match Browse's .preview-flow-list (single column).
  assert.match(
    flow,
    /\.my-trees-hub-flow-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*\}/,
    'desktop continuation flow must use a single-column grid matching Browse'
  );
  // Step 6 follow-up: flow stage now uses the same compact, transparent
  // inline-style treatment as Browse (.preview-flow-stage). The legacy
  // card-density overrides (min-height 42px, padding 8px 10px, border-
  // radius 12px, background, border, shadow) are retired.
  assert.match(
    flow,
    /\.my-trees-hub-flow-stage\s*\{[^}]*padding:\s*8px\s+10px\s*!important;[^}]*border-radius:\s*12px\s*!important;/s,
    'flow stage must use Browse inline-style compact rhythm (padding 8px 10px, border-radius 12px, min-height 42px)'
  );
  assert.match(
    flow,
    /\.my-trees-hub-flow-stage\s*\{[^}]*(?:min-)?height:\s*42px\s*!important/,
    'flow stage must use Browse 42px height rhythm'
  );
});

test('My Trees continuation flow stays one-column at narrow breakpoints', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');

  assert.match(
    responsive,
    /@media\s*\(max-width:\s*1024px\)\s*\{[\s\S]*?\.my-trees-hub-flow-list\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/,
    '≤1024px continuation flow must collapse to one column'
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
  assert.match(actions, /\.my-trees-hub-edit-btn\s*\{[^}]*min-height:\s*44px;[^}]*border-radius:\s*999px;/s, '편집하기 secondary action rhythm (Browse auxiliary)');
  assert.match(actions, /\.my-trees-hub-share-btn[\s\S]*?min-height:\s*40px;[\s\S]*?border-radius:\s*999px;/, '감상 링크 복사 tertiary action rhythm');
  assert.match(actions, /\.my-trees-hub-visibility-btn[\s\S]*?min-height:\s*40px;[\s\S]*?border-radius:\s*999px;/, '공개 범위 quaternary action rhythm');

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

test('My Trees hub summary uses Browse-parity typography', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  assert.match(
    content,
    /\.my-trees-hub-summary\s*\{[^}]*font-size:\s*14px;[^}]*\}/,
    '.my-trees-hub-summary font-size must be 14px matching Browse'
  );
  assert.match(
    content,
    /\.my-trees-hub-summary\s*\{[^}]*line-height:\s*1\.6;[^}]*\}/,
    '.my-trees-hub-summary line-height must be 1.6 matching Browse'
  );
  assert.match(
    content,
    /\.my-trees-hub-summary\s*\{[^}]*padding:\s*0\s+4px;[^}]*\}/,
    '.my-trees-hub-summary padding must be 0 4px matching Browse'
  );
  // margin-top: 0 to align with Browse summary which has no top margin
  assert.match(content, /\.my-trees-hub-summary\s*\{[^}]*margin-top:\s*0;[^}]*\}/);
});

test('My Trees hub actions use Browse-parity heading font and share/visibility font-size', () => {
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');

  // All four action types must share font-family: var(--font-heading)
  assert.match(
    actions,
    /\.my-trees-hub-open-btn,\s*\.my-trees-hub-edit-btn,\s*\.my-trees-hub-share-btn,\s*\.my-trees-hub-visibility-btn\s*\{[^}]*font-family:\s*var\(--font-heading\);[^}]*\}/s,
    'all hub action buttons must use var(--font-heading)'
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
  assert.match(html, /id=["']myTreesHubEditBtn["']/, 'myTreesHubEditBtn must exist');
  assert.match(html, /id=["']myTreesHubShareBtn["']/, 'myTreesHubShareBtn must exist');

  // Action gap and social shell spacing must remain unchanged
  assert.match(actions, /\.my-trees-hub-actions\s*\{[^}]*gap:\s*10px;[^}]*\}/, 'action gap must remain 10px');
  assert.match(actions, /\.my-trees-hub-actions\s*\{[^}]*margin-top:\s*18px;[^}]*\}/, 'actions margin-top must remain 18px');
  const content = read('css/my-trees/my-trees-preview-hub/social-bar.css');
  assert.match(content, /margin-top:\s*1rem;/, 'social shell margin-top must remain unchanged');
  assert.match(content, /padding-top:\s*0\.95rem;/, 'social shell padding-top must remain unchanged');
});

test('My Trees flow controls line-height matches Browse parity', () => {
    const flow = read('css/my-trees/my-trees-preview-hub/flow.css');

    // .my-trees-hub-flow-controls must have line-height: 1.4 (Browse parity)
    assert.match(
        flow,
        /\.my-trees-hub-flow-controls\s*\{[^}]*line-height:\s*1\.4;[^}]*\}/,
        '.my-trees-hub-flow-controls must have line-height: 1.4 matching Browse controls line-height'
    );
    // margin-top: 11px must be preserved
    assert.match(
        flow,
        /\.my-trees-hub-flow-controls\s*\{[^}]*margin-top:\s*11px;[^}]*\}/,
        '.my-trees-hub-flow-controls margin-top must remain 11px'
    );
    // .my-trees-hub-flow-toggle own line-height: 1.2 must remain unchanged
    assert.match(
        flow,
        /\.my-trees-hub-flow-toggle\s*\{[^}]*line-height:\s*1\.2;[^}]*\}/,
        '.my-trees-hub-flow-toggle own line-height must remain 1.2'
    );
    // flow card geometry must not be changed
    assert.match(
        flow,
        /\.my-trees-hub-flow\s*\{[^}]*padding:\s*20px;/s,
        'flow card padding must remain 20px'
    );
    assert.match(
        flow,
        /\.my-trees-hub-flow\s*\{[^}]*margin-bottom:\s*16px;/s,
        'flow card margin-bottom must remain 16px'
    );
    assert.match(
        flow,
        /\.my-trees-hub-flow-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*gap:\s*7px;/s,
        'flow list grid and gap must remain unchanged'
    );
    assert.match(
        flow,
        /\.my-trees-hub-flow-stage\s*\{[^}]*(?:min-)?height:\s*42px\s*!important/,
        'flow stage height must remain unchanged'
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
