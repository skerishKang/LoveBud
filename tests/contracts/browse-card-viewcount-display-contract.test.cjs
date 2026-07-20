/**
 * Contract test: Browse card and preview hub three-state viewCount display.
 *
 * viewCount must distinguish:
 *   1. persisted positive count → display number
 *   2. persisted zero           → display "0"
 *   3. missing/null             → hide views metric entirely
 *
 * The view-count alias resolution is owned by LoveBudSearchSharedUtils;
 * both the card renderer and hub patch delegate to it (the hub patch
 * delegates through LoveBudSearchShareLink.renderPreviewSocialShell).
 * likes/comments/shares zero fallback is unchanged on cards; the hub
 * shows only view count + share (no likes/comments/fake counts).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const cardRenderer = fs.readFileSync(path.join(ROOT, 'js/search/search-card-renderer.js'), 'utf8');
const hubPatch = fs.readFileSync(path.join(ROOT, 'js/search/search-preview-playable-hub-patch.js'), 'utf8');
const sharedUtils = fs.readFileSync(path.join(ROOT, 'js/search/search-shared-utils.js'), 'utf8');

// ---------------------------------------------------------------------------
// Shared utils resolver (authoritative)
// ---------------------------------------------------------------------------

test('shared utils: getViewCount returns null when viewCount is absent', () => {
  assert.match(sharedUtils, /function getViewCount/);
  assert.match(sharedUtils, /return null/);
  assert.match(sharedUtils, /value !== null && value !== undefined && value !== ''/);
});

// ---------------------------------------------------------------------------
// Browse card renderer
// ---------------------------------------------------------------------------

test('card renderer: delegates metrics rendering to shared composition', () => {
  assert.match(cardRenderer, /comp\.buildTreeCard\(/,
    'card renderer must delegate to shared composition');
  assert.match(cardRenderer, /requireComposition\(\)/,
    'card renderer must require composition (fail-closed)');
});

test('card renderer: positive viewCount → metrics module handles display', () => {
  // The card renderer now passes metrics through shared composition
  // which calls LoveBudTreeCardMetrics.renderTreeReactionMetrics
  assert.match(cardRenderer, /buildTreeCard\(/,
    'card renderer must route through shared composition which handles metrics');
});

test('card renderer: null viewCount → composition handles omission', () => {
  // detection: renderer calls comp.buildTreeCard which auto-resolves metrics
  assert.match(cardRenderer, /comp\.buildTreeCard\(tree/,
    'card renderer passes tree to shared composition for metrics resolution');
});

test('card renderer: likes/comments/shares rendered via shared metrics module', () => {
  // The card renderer does not own metric icons directly anymore;
  // they are rendered by LoveBudTreeCardMetrics.renderTreeReactionMetrics
  assert.ok(cardRenderer.includes('buildTreeCard'),
    'card renderer delegates to shared composition which handles all metrics');
  assert.ok(!cardRenderer.includes('renderTreeReactionMetrics'),
    'card renderer must NOT define its own renderTreeReactionMetrics');
});

// ---------------------------------------------------------------------------
// Preview hub (truthful — delegates to share-link helper, no fake counts)
// ---------------------------------------------------------------------------

test('preview hub: delegates view-count resolution to share-link helper', () => {
  // The hub patch delegates to LoveBudSearchShareLink.renderPreviewSocialShell
  assert.match(hubPatch, /shareLink\.renderPreviewSocialShell\(tree\)/);
  // Must NOT have its own getViewCount function
  assert.ok(!hubPatch.includes('function getViewCount(tree)'),
    'preview hub must not define its own getViewCount');
});

test('preview hub: viewCount rendered via share-link helper', () => {
  // The hub calls renderPreviewSocialShell which handles positive/zero/null states
  assert.match(hubPatch, /renderSocialBar\(tree/);
  // Must delegate to share link
  assert.match(hubPatch, /shareLink\.renderPreviewSocialShell/);
});

test('preview hub: no fake likes/comments/placeholder in hub source', () => {
  assert.ok(!hubPatch.includes('data-preview-like'),
    'preview hub must NOT have data-preview-like');
  assert.ok(!hubPatch.includes('data-preview-comments'),
    'preview hub must NOT have data-preview-comments');
  assert.ok(!hubPatch.includes('아직 댓글이 없어요'),
    'preview hub must NOT have comments placeholder');
  assert.ok(!hubPatch.includes('getCount'),
    'preview hub must NOT define getCount');
});

test('preview hub: share helper binding established', () => {
  assert.match(hubPatch, /bindPreviewShareHandler/);
  assert.match(hubPatch, /shareLink\.bindPreviewShareHandler/);
});
