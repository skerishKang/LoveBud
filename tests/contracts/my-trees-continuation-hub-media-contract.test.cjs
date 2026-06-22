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
  assert.match(content, /#myTreesHubMedia\s+\.preview-media-frame-iframe\s*>\s*div\s*\{\s*display:\s*none\s*!important;?\s*\}/s, 'My Trees hub iframe overlay div must be display: none !important');
});

test('My Trees hub uses localized 내 트리 미리보기 and Selected tree tags', () => {
  const i18n = read('js/i18n/i18n-my-trees.js');
  const refresh = read('js/my-trees/my-trees-i18n-refresh.js');
  const html = read('pages/my-trees.html');
  const hub = read('js/my-trees/my-trees-preview-hub.js');

  assert.match(i18n, /'myTrees\.hub_title':\s*\{\s*ko:\s*'내 러브트리 미리보기',\s*en:\s*'My LoveTree Preview'\s*\}/, 'hub_title must be in i18n-my-trees.js');
  assert.match(i18n, /'myTrees\.hub_badge':\s*\{\s*ko:\s*'선택한 내 트리',\s*en:\s*'Selected tree'\s*\}/, 'hub_badge must be in i18n-my-trees.js');
  assert.match(refresh, /setText\('myTreesHubTitle',\s*'myTrees\.hub_title',\s*'내 러브트리 미리보기'\);/, 'refresh script must update myTreesHubTitle');
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
  // PR #2750: secondary button is a quieter outline style — transparent
  // background, muted color (not the bold primary color). The semantic
  // check is the transparent background; color is intentionally flexible.
  assert.match(actions, /\.my-trees-hub-edit-btn\s*\{[^}]*background:\s*transparent;[^}]*\}/s, '편집하기 (editBtn) must be styled as a secondary outline (transparent background)');
});
