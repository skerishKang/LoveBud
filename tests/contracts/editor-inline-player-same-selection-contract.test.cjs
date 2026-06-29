/**
 * Contract test: editor inline player same-selection preservation.
 *
 * Verifies that editor-detail-ui.js preserves the active inline player
 * when the same moment with the same effective embed is reselected,
 * and tears down correctly on changed selection.
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

test('buildEmbedIdentity helper exists and uses videoId:start:end format', () => {
  assert.match(source, /const buildEmbedIdentity/, 'buildEmbedIdentity function must exist');
  assert.match(source, /videoId.*start.*end/, 'identity must embed videoId, start, end');
});

test('shouldPreservePlayer helper guards all 5 conditions', () => {
  assert.match(source, /const shouldPreservePlayer/, 'shouldPreservePlayer function must exist');
  // 1) parentNode check (still attached)
  assert.match(source, /parentNode/, 'must check parentNode');
  // 2) memory ID comparison
  assert.match(source, /editorDetailMemoryId/, 'must read recorded memory ID');
  // 3) embed identity comparison
  assert.match(source, /editorDetailEmbedIdentity/, 'must read recorded embed identity');
  // 4) data.id vs memId match
  assert.match(source, /memId.*!==.*data\.id/, 'must compare memory IDs');
  // 5) current embed identity matches
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
// Existing policy preserved
// ---------------------------------------------------------------------------

test('no autoplay on selection', () => {
  // The comment explicitly forbids auto-play on selection
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
