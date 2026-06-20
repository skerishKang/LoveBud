'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('My Trees loads the shared Browse media helper before its media adapter', () => {
  const html = read('pages/my-trees.html');
  const helperIndex = html.indexOf('js/search/search-preview-media-helper.js');
  const hubIndex = html.indexOf('js/my-trees/my-trees-preview-hub.js');
  const stateIndex = html.indexOf('js/my-trees/my-trees-preview-state.js');
  const adapterIndex = html.indexOf('js/my-trees/my-trees-preview-media.js');

  assert.ok(helperIndex >= 0, 'My Trees must load Browse media helper');
  assert.ok(hubIndex > helperIndex, 'hub must load after the shared media helper');
  assert.ok(stateIndex > hubIndex, 'state patch must load after the hub');
  assert.ok(adapterIndex > stateIndex, 'media adapter must load after state patching');
  assert.match(html, /id=["']myTreesHubMedia["'][^>]*hidden/, 'hub markup must retain a hidden conditional media mount');
});

test('My Trees hub media uses the existing safe Browse media helper boundary', () => {
  const media = read('js/my-trees/my-trees-preview-media.js');

  assert.match(media, /LoveBudSearchPreviewMediaHelper/, 'adapter must reuse the Browse media helper');
  assert.match(media, /helper\.getPreviewMediaMemory\(getMediaCandidates\(tree\)\)/, 'adapter must select only helper-approved media candidates');
  assert.match(media, /helper\.renderPreviewIframe\(sourceUrl, displayTitle, mediaTitle\)/, 'safe source URLs must render through the shared iframe helper');
  assert.match(media, /helper\.renderPreviewThumbnailMedia\(thumbnail, escapeHtml\(mediaTitle\), escapeHtml\(displayTitle\)\)/, 'thumbnail-only media must reuse shared thumbnail rendering');
  assert.doesNotMatch(media, /autoplay=1/, 'adapter must not enable autoplay');
  assert.doesNotMatch(media, /<iframe\b/i, 'adapter must not hand-roll iframe markup');
});

test('My Trees hub does not leave an empty selected media frame', () => {
  const css = read('css/my-trees.css');
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  const media = read('js/my-trees/my-trees-preview-media.js');

  assert.match(css, /#myTreesHubPanel\.is-loaded\s+#myTreesHubVideoContainer\s*\{\s*display:\s*none;/s, 'loaded state keeps the compact no-media default');
  assert.match(css, /#myTreesHubPanel\.is-loaded\.has-media\s+#myTreesHubVideoContainer\s*\{\s*display:\s*block;/s, 'selected trees with actual media must opt back into the visible frame');
  assert.match(content, /\.my-trees-hub-panel\.is-loaded:not\(\.has-media\)\s+#myTreesHubVideoContainer\s*\{\s*display:\s*none;/s, 'no-media selected state must hide its media region');
  assert.match(media, /function clearMedia\(\)[\s\S]*?els\.media\.innerHTML = '';/, 'switching/no-media paths must clear prior markup');
  assert.match(media, /els\.container\.hidden = true;/, 'no-media selected state must hide the media container');
  assert.match(media, /function showPlaceholder\(\)[\s\S]*?els\.container\.hidden = false;/, 'unselected state must restore only the intentional placeholder');
});
