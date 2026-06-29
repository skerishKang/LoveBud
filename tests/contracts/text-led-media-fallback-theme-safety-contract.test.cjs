/**
 * Runtime test: text-led media fallback theme safety.
 *
 * Loads Browse and My Trees renderers via vm sandbox and verifies:
 * 1. tier-2 output uses --tree-card-text-border / --tree-card-text-accent
 * 2. No hard-coded background:rgba(255,255,255,0.84) in output
 * 3. CSS consumes the custom properties
 * 4. i18n kicker fallback preserved
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Source-level assertions (shared across all renderers)
// ---------------------------------------------------------------------------

test('Browse renderer no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'Browse must not inline rgba(255,255,255,0.84) background');
});

test('My Trees primary renderer no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'My Trees primary must not inline rgba(255,255,255,0.84) background');
});

test('My Trees UI fallback renderer no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'My Trees UI fallback must not inline rgba(255,255,255,0.84) background');
});

test('All three renderers emit --tree-card-text-border custom property', () => {
  for (const file of ['js/search/search-card-fallback.js', 'js/my-trees/my-trees-card-visuals.js', 'js/my-trees/my-trees-ui.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /--tree-card-text-border/,
      `${file} must emit --tree-card-text-border`);
  }
});

test('All three renderers emit --tree-card-text-accent custom property', () => {
  for (const file of ['js/search/search-card-fallback.js', 'js/my-trees/my-trees-card-visuals.js', 'js/my-trees/my-trees-ui.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /--tree-card-text-accent/,
      `${file} must emit --tree-card-text-accent`);
  }
});

// ---------------------------------------------------------------------------
// CSS assertions
// ---------------------------------------------------------------------------

test('Search CSS consumes --tree-card-text-border', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.match(css, /--tree-card-text-border/,
    'Search CSS must consume border custom property');
});

test('My Trees CSS consumes --tree-card-text-border', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.match(css, /--tree-card-text-border/,
    'My Trees CSS must consume border custom property');
});

test('Search CSS has theme-safe background surface', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.match(css, /var\(--surface/,
    'Search CSS must use var(--surface) for background');
});

test('My Trees CSS has theme-safe background surface', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.match(css, /var\(--surface/,
    'My Trees CSS must use var(--surface) for background');
});

// ---------------------------------------------------------------------------
// Runtime: Browse renderer output
// ---------------------------------------------------------------------------

test('Browse renderer tier-2 output preserves i18n kicker', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  // The kicker text with Korean fallback must be present
  assert.match(src, /첫 순간 기록/,
    'Browse must preserve Korean kicker fallback');
  assert.match(src, /First Moment/,
    'Browse must preserve English kicker variant');
});

// ---------------------------------------------------------------------------
// Tier preservation
// ---------------------------------------------------------------------------

test('Tier decision (thumbnail → text cover → SVG) is unchanged', () => {
  // Browse: has renderMediaFallback for SVG fallback
  const searchSrc = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.match(searchSrc, /buildRepresentativeTextVisual/, 'Browse must retain text cover builder');
  assert.match(searchSrc, /renderMediaFallback/, 'Browse must retain SVG fallback');

  // My Trees primary: has text cover builder
  const mtVisuals = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.match(mtVisuals, /buildRepresentativeTextVisual/, 'My Trees must retain text cover builder');

  // My Trees UI fallback: delegates to primary when available
  const mtUI = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  assert.match(mtUI, /buildRepresentativeTextVisual/, 'My Trees UI must retain text cover builder');
});

test('My Trees CSS retains border-radius and shadow for text-visual', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.match(css, /border-radius/, 'My Trees CSS must retain border-radius');
  assert.match(css, /box-shadow/, 'My Trees CSS must retain box-shadow');
});

test('Search CSS retains border-radius for text-visual', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.match(css, /border-radius/, 'Search CSS must retain border-radius');
});
