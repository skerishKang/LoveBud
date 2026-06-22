'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const hubFile = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');
const mediaFile = path.join(ROOT, 'js/my-trees/my-trees-preview-media.js');

const hubSource = fs.readFileSync(hubFile, 'utf8');
const mediaSource = fs.readFileSync(mediaFile, 'utf8');

test('my-trees-preview-hub click handler re-renders media via LoveBudMyTreesPreviewMedia.renderMediaForMoment (#2825)', () => {
  // The flow stage click handler in enhanceMyTreesFlowStages must call
  // LoveBudMyTreesPreviewMedia.renderMediaForMoment(tree, index) so the
  // active stage and the rendered media preview always refer to the
  // same moment. The legacy swapToMomentIframe() only swapped the
  // existing iframe's src (returning false silently for thumbnail
  // media), which left compact flow stage clicks 1-4 visually inert.
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
  // The click must also keep swapToMomentIframe as a graceful fallback
  // for environments where the preview-media module has not loaded.
  assert.match(
    hubSource,
    /swapToMomentIframe/,
    'click handler must keep swapToMomentIframe as a fallback when preview-media is unavailable'
  );
});

test('my-trees-preview-media exposes renderMediaForMoment and forwards the moment index (#2825)', () => {
  // The new renderMediaForMoment function must be exported on
  // window.LoveBudMyTreesPreviewMedia so the hub flow stage click
  // handler can call it. It must also forward the moment index into
  // the existing renderMedia() so the media re-renders for that
  // specific moment.
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
  // renderMedia itself must accept the optional preferredMomentIndex
  // and pick the candidate at that index when present.
  assert.match(
    mediaSource,
    /function\s+renderMedia\s*\(\s*tree\s*,\s*preferredMomentIndex\s*\)/,
    'renderMedia must accept (tree, preferredMomentIndex)'
  );
  assert.match(
    mediaSource,
    /candidates\s*\[\s*preferredMomentIndex\s*\]/,
    'renderMedia must use candidates[preferredMomentIndex] to pick the clicked moment'
  );
});
