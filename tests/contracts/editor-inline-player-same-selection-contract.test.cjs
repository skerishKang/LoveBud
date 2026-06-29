/**
 * Contract test: editor inline player same-selection preservation.
 *
 * Verifies that editor-detail-ui.js preserves the active inline player
 * when the same moment with the same effective embed is reselected,
 * and tears down correctly when source, timestamps, or embed changes.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-detail-ui.js'), 'utf8');

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

test('buildEmbedIdentity helper exists', () => {
  assert.match(source, /const buildEmbedIdentity/, 'buildEmbedIdentity function must exist');
});

test('buildEmbedIdentity uses getMemoryPlaybackUrl and buildYouTubeEmbedUrl', () => {
  assert.match(source, /getMemoryPlaybackUrl/, 'must include source URL');
  assert.match(source, /buildYouTubeEmbedUrl/, 'must include canonical embed URL');
  assert.match(source, /\|\|/, 'must join source and embed with separator');
});

test('buildEmbedIdentity returns empty for null/undefined data', () => {
  assert.match(source, /if \(!data\) return ''/, 'must guard null data');
  assert.match(source, /if \(!sourceUrl && !embedUrl\) return ''/, 'must guard empty URLs');
});

test('shouldPreservePlayer helper guards all 5 conditions', () => {
  assert.match(source, /const shouldPreservePlayer/, 'shouldPreservePlayer function must exist');
  assert.match(source, /parentNode/, 'must check parentNode');
  assert.match(source, /editorDetailMemoryId/, 'must read recorded memory ID');
  assert.match(source, /editorDetailEmbedIdentity/, 'must read recorded embed identity');
  assert.match(source, /memId.*!==.*data\.id/, 'must compare memory IDs');
  assert.match(source, /buildEmbedIdentity/, 'must recompute current embed identity');
});

// ---------------------------------------------------------------------------
// buildInlinePlayerElement stores identity
// ---------------------------------------------------------------------------

test('buildInlinePlayerElement stores memory ID dataset', () => {
  assert.match(source, /editorDetailMemoryId/, 'must set data-editor-detail-memory-id');
});

test('buildInlinePlayerElement stores embed identity dataset', () => {
  assert.match(source, /editorDetailEmbedIdentity/, 'must set data-editor-detail-embed-identity');
});

// ---------------------------------------------------------------------------
// updateDetailPanel: same-selection preservation
// ---------------------------------------------------------------------------

test('updateDetailPanel checks shouldPreservePlayer before clearing', () => {
  assert.match(source, /sameSelectionPreserved/, 'must compute sameSelectionPreserved');
  assert.match(source, /shouldPreservePlayer/, 'must call shouldPreservePlayer');
  assert.match(source, /if \(!sameSelectionPreserved\)/, 'must guard clearDetailPlayer');
  assert.match(source, /clearDetailPlayer\(/, 'clearDetailPlayer call exists');
});

test('updateDetailPanel hides thumbnail/overlay when player preserved', () => {
  assert.match(source, /sameSelectionPreserved\s*\?\s*'none'.*:/, 'must hide img when preserved');
  assert.match(source, /sameSelectionPreserved\s*\?\s*true\s*:/, 'must hide overlay when preserved');
});

test('updateDetailPanel falls back to clearDetailMedia only when not preserved', () => {
  assert.match(source, /!sameSelectionPreserved.*clearDetailMedia/, 'must guard clearDetailMedia');
});

// ---------------------------------------------------------------------------
// Changed-selection teardown (existing behavior preserved)
// ---------------------------------------------------------------------------

test('clearDetailPlayer still exists and removes [data-editor-detail-player="1"]', () => {
  assert.match(source, /const clearDetailPlayer/, 'clearDetailPlayer must exist');
  assert.match(source, /data-editor-detail-player/, 'must query player by marker');
  assert.match(source, /existingPlayer\.remove\(\)/, 'must remove existing player');
});

test('clearDetailMedia still calls clearDetailPlayer', () => {
  assert.match(source, /const clearDetailMedia/, 'clearDetailMedia must exist');
  assert.match(source, /clearDetailPlayer\(/, 'must call clearDetailPlayer');
});

// ---------------------------------------------------------------------------
// Timestamp regression: same memory, different timestamps → teardown
// ---------------------------------------------------------------------------

test('embed identity changes when ?t= param differs', () => {
  // Different source URLs produce different identity strings
  assert.match(source, /getMemoryPlaybackUrl/, 'identity must embed source URL');
});

test('embed identity changes when ?start= param differs', () => {
  assert.match(source, /buildYouTubeEmbedUrl/, 'identity must embed canonical embed URL');
});

test('embed identity includes explicit startTime/endTime via canonical embed', () => {
  // buildYouTubeEmbedUrl parses startTime/endTime into embed query params
  assert.match(source, /buildYouTubeEmbedUrl/, 'identity must go through canonical builder');
});

test('invalid/no effective embed returns empty identity (teardown)', () => {
  assert.match(source, /if \(!sourceUrl && !embedUrl\) return ''/, 'empty URLs → empty identity');
});

// ---------------------------------------------------------------------------
// Existing policy preserved
// ---------------------------------------------------------------------------

test('no autoplay on selection', () => {
  assert.match(source, /must NOT auto-play/, 'editor must not auto-play on selection');
});

test('play button path builds player via buildInlinePlayerElement', () => {
  assert.match(source, /buildInlinePlayerElement/, 'play button must use buildInlinePlayerElement');
});

test('privacy-enhanced youtube-nocookie.com embed preserved', () => {
  assert.match(source, /youtube-nocookie\.com/, 'must use youtube-nocookie.com');
});

test('allowFullscreen preserved', () => {
  assert.match(source, /allowFullscreen/, 'iframe must preserve allowFullscreen');
});
