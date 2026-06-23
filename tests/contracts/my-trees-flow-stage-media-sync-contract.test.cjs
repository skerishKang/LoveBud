'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const hubFile = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');
const stateFile = path.join(ROOT, 'js/my-trees/my-trees-preview-state.js');
const mediaFile = path.join(ROOT, 'js/my-trees/my-trees-preview-media.js');
const helperFile = path.join(ROOT, 'js/search/search-preview-media-helper.js');
const myTreesHtmlFile = path.join(ROOT, 'pages/my-trees.html');

const hubSource = fs.readFileSync(hubFile, 'utf8');
const stateSource = fs.readFileSync(stateFile, 'utf8');
const mediaSource = fs.readFileSync(mediaFile, 'utf8');
const helperSource = fs.readFileSync(helperFile, 'utf8');
const myTreesHtml = fs.readFileSync(myTreesHtmlFile, 'utf8');

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

test('my-trees-preview-hub exposes rebindFlowStages on the public API (#2825 post-cache-bust)', () => {
  assert.match(
    hubSource,
    /rebindFlowStages\s*:\s*function\s*\(\s*tree\s*\)/,
    'hub public API must expose rebindFlowStages(tree) so the state module can re-bind stage click handlers after hydrated DOM replacement'
  );
});

test('my-trees-preview-hub rebindFlowStages delegates to the private enhanceMyTreesFlowStages (#2825 post-cache-bust)', () => {
  assert.match(
    hubSource,
    /rebindFlowStages\s*:\s*function\s*\([\s\S]*?enhanceMyTreesFlowStages\s*\(\s*tree\s*\)/,
    'rebindFlowStages must delegate to the existing private enhanceMyTreesFlowStages(tree) without duplicating click binding logic'
  );
});

test('my-trees-preview-state rebinds stage handlers after hydrated flowList.innerHTML replacement (#2825 post-cache-bust)', () => {
  assert.match(
    stateSource,
    /flowList\.innerHTML\s*=\s*buildHydratedFlowStages[\s\S]*?rebindFlowStages\s*\(\s*tree\s*\)/,
    'after buildHydratedFlowStages replaces flowList.innerHTML, patchHubForCreatedMoments must call hub.rebindFlowStages(tree) so the newly created stage DOM elements get click handlers bound'
  );
  assert.match(
    stateSource,
    /LoveBudMyTreesPreviewHub\s*\|\|\s*window\.LoveTreeMyTreesPreviewHub/,
    'rebind call must look up the hub from either window.LoveBudMyTreesPreviewHub or window.LoveTreeMyTreesPreviewHub for backward compatibility'
  );
  assert.doesNotMatch(
    stateSource,
    /flowList\.innerHTML[\s\S]{0,20}?rebindFlowStages/,
    'rebindFlowStages must be called AFTER flowList.innerHTML assignment, not before or inline — the new DOM must exist before event binding'
  );
});

test('my-trees-preview-state rebind uses clean typeof-based guard pattern (#2835)', () => {
  assert.match(
    stateSource,
    /typeof\s+previewHub\.rebindFlowStages\s*===\s*['"]function['"]/,
    'rebind call must guard with typeof previewHub.rebindFlowStages === "function" instead of double global lookup'
  );
});

test('pages/my-trees.html hub and state scripts carry the same new cache-bust token (#2835)', () => {
  const hubMatch = myTreesHtml.match(/src="\.\.\/js\/my-trees\/my-trees-preview-hub\.js\?v=([^"'\s>]+)"/);
  const stateMatch = myTreesHtml.match(/src="\.\.\/js\/my-trees\/my-trees-preview-state\.js\?v=([^"'\s>]+)"/);
  assert.ok(hubMatch, 'my-trees-preview-hub.js must have a cache-bust query');
  assert.ok(stateMatch, 'my-trees-preview-state.js must have a cache-bust query');
  assert.ok(hubMatch[1] && hubMatch[1].length > 0, 'hub cache-bust token must be non-empty');
  assert.ok(stateMatch[1] && stateMatch[1].length > 0, 'state cache-bust token must be non-empty');
  assert.equal(
    hubMatch[1],
    stateMatch[1],
    'hub and state scripts must share the same cache-bust token'
  );
});

test('pages/my-trees.html no longer pins old hub token #2829 or old state token step9 (#2835)', () => {
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-state\.js\?v=20260622-step9-1/,
    'state script must not still pin the pre-#2835 cache-bust 20260622-step9-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-hub\.js\?v=20260623-2825-1/,
    'hub script must not still pin the #2829 cache-bust 20260623-2825-1'
  );
});
