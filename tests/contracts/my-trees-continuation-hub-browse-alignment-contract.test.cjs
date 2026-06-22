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

test('My Trees hub keeps its multi-line hero original styling and hierarchy', () => {
  const html = read('pages/my-trees.html');
  const header = read('css/my-trees/my-trees-header.css');

  // Verify multi-line structure is intact
  assert.match(html, /<h1 class="headline shared-mobile-hero-title" id="myTreesPageTitle">/);
  // Verify original classes styling in css/my-trees/my-trees-header.css is restored (original color, font-weight, margin)
  assert.match(header, /\.my-trees-header h1\s*\{\s*font-size:\s*clamp\(3\.45rem,\s*5\.8vw,\s*5\.15rem\);/);
  assert.match(header, /\.my-trees-title-line\s*\{\s*display:\s*block;\s*\}/);
  assert.match(header, /\.my-trees-title-line:nth-child\(1\)\s*\{\s*color:\s*var\(--on-surface-variant\);\s*font-weight:\s*700;\s*opacity:\s*0\.9;\s*\}/);
  assert.match(header, /\.my-trees-title-accent\s*\{\s*color:\s*var\(--hero-warm-color,\s*var\(--primary\)\);\s*font-weight:\s*780;\s*letter-spacing:\s*-0\.03em;\s*\}/);
  assert.match(header, /\.my-trees-title-line:nth-child\(3\)\s*\{\s*color:\s*#b85c66;\s*font-weight:\s*900;\s*\}/);
});

test('My Trees hub HTML structure hierarchy follows Browse parity', () => {
  const html = read('pages/my-trees.html');

  // Order assertion: header -> videoContainer -> content (inside has details/title/badge/flow/no-moments/summary) -> actions
  const idxHeader = html.indexOf('class="my-trees-hub-header');
  const idxVideo = html.indexOf('id="myTreesHubVideoContainer"');
  const idxContent = html.indexOf('id="myTreesHubContent"');
  const idxDetails = html.indexOf('id="myTreesHubDetails"');
  const idxTitle = html.indexOf('id="myTreesHubTreeTitle"');
  const idxMetaBadge = html.indexOf('id="myTreesHubMetaBadge"');
  const idxFlow = html.indexOf('id="myTreesHubFlow"');
  const idxNoMoments = html.indexOf('id="myTreesHubNoMoments"');
  const idxSummary = html.indexOf('id="myTreesHubSummary"');
  const idxActions = html.indexOf('id="myTreesHubActions"');

  assert.ok(idxHeader !== -1, 'hub header must exist');
  assert.ok(idxVideo > idxHeader, 'video container must be after header');
  assert.ok(idxContent > idxVideo, 'content container must be after video container');
  assert.ok(idxDetails > idxContent, 'details wrapper must be inside content container');
  assert.ok(idxTitle > idxDetails, 'tree title must be inside details');
  assert.ok(idxMetaBadge > idxTitle, 'meta badge must be after tree title');
  assert.ok(idxFlow > idxMetaBadge, 'flow must be after meta badge');
  assert.ok(idxNoMoments > idxFlow, 'no-moments block must be after flow');
  assert.ok(idxSummary > idxNoMoments, 'summary must be after no-moments');
  assert.ok(idxActions > idxContent, 'actions block must be after content');
});
