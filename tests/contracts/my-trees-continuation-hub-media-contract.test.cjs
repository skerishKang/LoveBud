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
