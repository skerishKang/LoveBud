/**
 * Contract test: Search preview iframe referrer policy standardization.
 *
 * Validates that all 5 iframe creation paths in the search preview system
 * explicitly specify `referrerpolicy="strict-origin-when-cross-origin"`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. search-preview-media-helper.js — direct fallback markup (thumbnail-less)
// ---------------------------------------------------------------------------

test('media-helper direct fallback markup has referrerpolicy', () => {
  const src = read('js/search/search-preview-media-helper.js');
  // Thumbnail-less branch returns iframe markup with referrerpolicy
  const match = src.match(/return `<div class="preview-media-frame preview-media-frame-iframe"[\s\S]*?<\/div>`/m);
  assert.ok(match, 'thumbnail-less iframe fallback markup must exist');
  assert.match(match[0], /referrerpolicy="strict-origin-when-cross-origin"/,
    'thumbnail-less direct iframe markup must include referrerpolicy="strict-origin-when-cross-origin"');
});

// ---------------------------------------------------------------------------
// 2. search-preview-media-helper.js — DOM-created iframe (click-to-play)
// ---------------------------------------------------------------------------

test('media-helper bindPreviewOverlayEvents sets referrerpolicy via setAttribute', () => {
  const src = read('js/search/search-preview-media-helper.js');
  // Inside bindPreviewOverlayEvents, iframe is created via document.createElement
  assert.match(src, /iframe\.setAttribute\('referrerpolicy', 'strict-origin-when-cross-origin'\)/,
    'bindPreviewOverlayEvents must call iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")');
});

// ---------------------------------------------------------------------------
// 3. search-preview-media-embed-patch.js — direct fallback markup (thumbnail-less)
// ---------------------------------------------------------------------------

test('embed-patch direct fallback markup has referrerpolicy', () => {
  const src = read('js/search/search-preview-media-embed-patch.js');
  // Find the thumbnail-less fallback iframe
  const match = src.match(/return `<div class="preview-media-frame preview-media-frame-iframe"[\s\S]*?<\/div>`/m);
  assert.ok(match, 'thumbnail-less iframe fallback markup must exist in embed-patch');
  assert.match(match[0], /referrerpolicy="strict-origin-when-cross-origin"/,
    'embed-patch thumbnail-less direct iframe markup must include referrerpolicy="strict-origin-when-cross-origin"');
});

// ---------------------------------------------------------------------------
// 4. search-preview-media-embed-patch.js — DOM-created iframe (click-to-play)
// ---------------------------------------------------------------------------

test('embed-patch bindPreviewOverlayEvents sets referrerpolicy via setAttribute', () => {
  const src = read('js/search/search-preview-media-embed-patch.js');
  assert.match(src, /iframe\.setAttribute\('referrerpolicy', 'strict-origin-when-cross-origin'\)/,
    'embed-patch bindPreviewOverlayEvents must call iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")');
});

// ---------------------------------------------------------------------------
// 5. search-preview-renderer.js — helper-absent fallback markup
// ---------------------------------------------------------------------------

test('renderer helper-absent fallback markup has referrerpolicy', () => {
  const src = read('js/search/search-preview-renderer.js');
  // Helper-absent fallback iframe in updatePreview() — lines ~422-433
  // This is the template literal starting with `<div class="preview-media-frame preview-media-frame-iframe"`
  // and containing the iframe with allow/allowfullscreen
  assert.match(src, /iframeSrc && !hideEagerVideo \? `[\s\S]*?<div class="preview-media-frame preview-media-frame-iframe"/,
    'renderer must have helper-absent iframe fallback template');

  // The iframe inside that template must have referrerpolicy attribute
  const fallbackSection = src.slice(src.indexOf('iframeSrc && !hideEagerVideo'));
  const iframeMarkup = fallbackSection.slice(0, fallbackSection.indexOf('` : (safeThumbnail'));
  assert.match(iframeMarkup, /allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/,
    'renderer fallback iframe must have correct allow attribute');
  assert.match(iframeMarkup, /allowfullscreen referrerpolicy="strict-origin-when-cross-origin"/,
    'renderer fallback iframe must have referrerpolicy="strict-origin-when-cross-origin" immediately before style attribute');
});

// ---------------------------------------------------------------------------
// 6. Source URL contract — no new query manipulation in renderer
// ---------------------------------------------------------------------------

test('renderer does not manipulate iframe source URL beyond existing logic', () => {
  const src = read('js/search/search-preview-renderer.js');
  // iframeSrc is built as: safeSourceUrl + (includes('?') ? '&' : '?') + 'autoplay=0&mute=1'
  // No additional referrer policy related URL manipulation should exist
  assert.ok(!src.includes('referrerpolicy') || src.match(/referrerpolicy/g).length === 1,
    'renderer must not have referrerpolicy manipulation beyond the single iframe attribute');
  // No new URLSearchParams or search manipulation for referrer policy
  assert.ok(!src.match(/new URLSearchParams.*referrer/i),
    'renderer must not construct URL with referrer policy query params');
});

// ---------------------------------------------------------------------------
// 7. All paths use the exact same policy string
// ---------------------------------------------------------------------------

test('all paths use exact policy string "strict-origin-when-cross-origin"', () => {
  const files = [
    'js/search/search-preview-media-helper.js',
    'js/search/search-preview-media-embed-patch.js',
    'js/search/search-preview-renderer.js'
  ];
  const expected = 'strict-origin-when-cross-origin';
  for (const f of files) {
    const src = read(f);
    const matches = src.match(/referrerpolicy\s*[=:]\s*['"]?([^'"\s>]+)['"]?/g);
    assert.ok(matches, `File ${f} must have at least one referrerpolicy reference`);
    for (const m of matches) {
      assert.ok(m.includes(expected),
        `File ${f} must use exact policy "${expected}"; found: ${m}`);
    }
  }
});