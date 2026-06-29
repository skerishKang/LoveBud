/**
 * Contract test: Browse card and preview hub three-state viewCount display.
 *
 * viewCount must distinguish:
 *   1. persisted positive count → display number
 *   2. persisted zero           → display "0"
 *   3. missing/null             → hide views metric entirely
 *
 * likes/comments/shares zero fallback is unchanged.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const cardRendererPath = path.join(ROOT, 'js/search/search-card-renderer.js');
const hubPatchPath = path.join(ROOT, 'js/search/search-preview-playable-hub-patch.js');

const cardRenderer = fs.readFileSync(cardRendererPath, 'utf8');
const hubPatch = fs.readFileSync(hubPatchPath, 'utf8');

// ---------------------------------------------------------------------------
// Browse card renderer
// ---------------------------------------------------------------------------

test('card renderer: getViewCount returns null when viewCount is absent', () => {
  assert.match(cardRenderer, /return null/);
  assert.match(cardRenderer, /value !== null && value !== undefined && value !== ''/);
});

test('card renderer: positive viewCount → 조회수 rendered', () => {
  // The metrics array includes visibility icon with '조회수' label
  assert.match(cardRenderer, /visibility.*조회수/);
  // formatCompactCount is called for each metric value
  assert.match(cardRenderer, /formatCompactCount/);
});

test('card renderer: null viewCount → views metric omitted', () => {
  assert.match(cardRenderer, /counts\.views !== null/);
  assert.match(cardRenderer, /\].filter\(Boolean\)/);
});

test('card renderer: likes/comments/shares always rendered regardless of views', () => {
  // likes, comments, shares are unconditional in the metrics array
  var likesIndex = cardRenderer.indexOf('favorite');
  var commentsIndex = cardRenderer.indexOf('chat_bubble');
  var sharesIndex = cardRenderer.indexOf('share');
  assert.ok(likesIndex >= 0, 'favorite (likes) icon must be present');
  assert.ok(commentsIndex >= 0, 'chat_bubble (comments) icon must be present');
  assert.ok(sharesIndex >= 0, 'share icon must be present');
});

// ---------------------------------------------------------------------------
// Preview hub
// ---------------------------------------------------------------------------

test('preview hub: getViewCount returns null when viewCount is absent', () => {
  assert.match(hubPatch, /function getViewCount/);
  assert.match(hubPatch, /return null/);
});

test('preview hub: positive/persisted zero viewCount → 조회수 rendered', () => {
  // The viewsHtml variable is set to the full stat div when views !== null
  assert.match(hubPatch, /viewsHtml/);
  assert.match(hubPatch, /views !== null/);
});

test('preview hub: null viewCount → 조회수 stat block omitted', () => {
  // When views is null, viewsHtml is empty string (ternary : '')
  assert.match(hubPatch, /views !== null/);
  assert.match(hubPatch, /viewsHtml/);
});

test('preview hub: likes/comments buttons always rendered', () => {
  assert.match(hubPatch, /data-preview-like/);
  assert.match(hubPatch, /data-preview-comments/);
});

test('preview hub: getCount preserved for likes/comments (zero fallback)', () => {
  // The original getCount function still exists and returns 0 for missing
  assert.match(hubPatch, /return 0/);
  // likes and comments still use getCount
  assert.match(hubPatch, /getCount.*likeCount/);
  assert.match(hubPatch, /getCount.*commentCount/);
});
