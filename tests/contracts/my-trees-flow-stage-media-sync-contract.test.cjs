'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const hubFile = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');
const mediaFile = path.join(ROOT, 'js/my-trees/my-trees-preview-media.js');
const helperFile = path.join(ROOT, 'js/search/search-preview-media-helper.js');

const hubSource = fs.readFileSync(hubFile, 'utf8');
const mediaSource = fs.readFileSync(mediaFile, 'utf8');
const helperSource = fs.readFileSync(helperFile, 'utf8');

test('my-trees-preview-hub click handler re-renders media via LoveBudMyTreesPreviewMedia.renderMediaForMoment (#2825)', () => {
  assert.match(
    hubSource,
    /LoveBudMyTreesPreviewMedia/,
    'flow stage click handler must reference window.LoveBudMyTreesPreviewMedia'
  );
  assert.match(
    hubSource,
    /renderMediaForMoment\s*\(\s*tree\s*,\s*index\s*\)/,
    'flow stage click handler must call renderMediaForMoment(tree, index) so the active stage matches the media preview (#2825)'
  );
  assert.match(
    hubSource,
    /swapToMomentIframe/,
    'click handler must keep swapToMomentIframe as a fallback when preview-media is unavailable'
  );
});

test('my-trees-preview-media exposes renderMediaForMoment and forwards the moment index (#2825)', () => {
  assert.match(
    mediaSource,
    /function\s+renderMediaForMoment\s*\(\s*tree\s*,\s*momentIndex\s*\)/,
    'renderMediaForMoment(tree, momentIndex) must be defined in my-trees-preview-media.js'
  );
  assert.match(
    mediaSource,
    /renderMediaForMoment\s*:\s*renderMediaForMoment\b/,
    'renderMediaForMoment must be exported on window.LoveBudMyTreesPreviewMedia'
  );
  assert.match(
    mediaSource,
    /function\s+renderMediaForMoment\s*\([\s\S]*?return\s+renderMedia\s*\(\s*tree\s*,\s*momentIndex\s*\)/,
    'renderMediaForMoment must forward the moment index to renderMedia(tree, momentIndex)'
  );
  assert.match(
    mediaSource,
    /function\s+renderMedia\s*\(\s*tree\s*,\s*preferredMomentIndex\s*\)/,
    'renderMedia must accept (tree, preferredMomentIndex)'
  );
});

test('my-trees-preview-media preserves helper.getPreviewMediaMemory(getMediaCandidates(tree)) literal call (#2825 + #continuation-hub-media)', () => {
  // The My Trees continuation-hub-media contract locks the adapter to
  // select only helper-approved media candidates. We must NOT bypass
  // the helper by indexing candidates[preferredMomentIndex] directly.
  // renderMedia() must keep the literal helper.getPreviewMediaMemory(
  // getMediaCandidates(tree)) call (default path) and route the
  // explicit-moment path through helper.getPreviewMediaMemoryAt() so
  // the helper-approved-candidate principle is preserved in both.
  assert.match(
    mediaSource,
    /helper\.getPreviewMediaMemory\(\s*getMediaCandidates\(\s*tree\s*\)\s*\)/,
    'renderMedia default path must keep the literal helper.getPreviewMediaMemory(getMediaCandidates(tree)) call (locked by continuation-hub-media contract)'
  );
  assert.match(
    mediaSource,
    /helper\.getPreviewMediaMemoryAt\s*\(\s*getMediaCandidates\(\s*tree\s*\)\s*,\s*preferredMomentIndex\s*\)/,
    'renderMedia explicit-moment path must go through helper.getPreviewMediaMemoryAt(getMediaCandidates(tree), preferredMomentIndex)'
  );
  // Check that the actual renderMedia body (not comments) does not index
  // candidates[preferredMomentIndex] directly — must go through the
  // helper's getPreviewMediaMemoryAt. Match only the assignment lines
  // (i.e. lines that actually USE the value), not explanatory comments.
  assert.doesNotMatch(
    mediaSource,
    /=\s*candidates\s*\[\s*preferredMomentIndex\s*\]/,
    'renderMedia must NOT assign from candidates[preferredMomentIndex] directly — must go through helper.getPreviewMediaMemoryAt'
  );
});

test('LoveBudSearchPreviewMediaHelper exposes getPreviewMediaMemoryAt with the same approval predicate as getPreviewMediaMemory', () => {
  // The new getPreviewMediaMemoryAt must apply the same sanitizeUrl-
  // based approval as getPreviewMediaMemory so a memory with no
  // sourceUrl / no thumbnail cannot slip through.
  assert.match(
    helperSource,
    /function\s+getPreviewMediaMemoryAt\s*\(\s*memories\s*,\s*momentIndex\s*\)/,
    'getPreviewMediaMemoryAt(memories, momentIndex) must be defined in search-preview-media-helper.js'
  );
  assert.match(
    helperSource,
    /getPreviewMediaMemoryAt\s*:\s*getPreviewMediaMemoryAt\b/,
    'getPreviewMediaMemoryAt must be exported on window.LoveBudSearchPreviewMediaHelper'
  );
  assert.match(
    helperSource,
    /function\s+getPreviewMediaMemoryAt\s*\([\s\S]*?sanitizeUrl\(candidate\s*(?:&&\s*candidate)?\.sourceUrl/,
    'getPreviewMediaMemoryAt must sanitizeUrl-check sourceUrl (same predicate as getPreviewMediaMemory)'
  );
  assert.match(
    helperSource,
    /function\s+getPreviewMediaMemoryAt\s*\([\s\S]*?sanitizeUrl\(candidate\s*(?:&&\s*candidate)?\.thumbnail/,
    'getPreviewMediaMemoryAt must sanitizeUrl-check thumbnail (same predicate as getPreviewMediaMemory)'
  );
});
