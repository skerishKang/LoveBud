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
  // The thumbnail-less direct iframe fallback is NOT the first
  // `return <div class="preview-media-frame preview-media-frame-iframe">` — that one
  // is the click-to-play thumbnail branch. The actual thumbnail-less direct iframe
  // fallback is marked by a comment and ends before toAutoplayIframeSource.
  const fallbackStart = src.indexOf('// 썸네일 없는 경우 바로 iframe (기존 방식 폴백)');
  assert.ok(fallbackStart >= 0, 'media-helper direct iframe fallback comment marker must exist');
  const fallbackEnd = src.indexOf('function toAutoplayIframeSource', fallbackStart);
  assert.ok(fallbackEnd > fallbackStart, 'media-helper fallback section must end before toAutoplayIframeSource');
  const fallbackSection = src.slice(fallbackStart, fallbackEnd);

  // This section must contain the iframe markup with the policy
  assert.match(fallbackSection, /<iframe/,
    'media-helper fallback section must contain iframe element');
  assert.match(fallbackSection, /allowfullscreen/,
    'media-helper fallback section must contain allowfullscreen attribute');
  assert.match(fallbackSection, /referrerpolicy="strict-origin-when-cross-origin"/,
    'media-helper thumbnail-less direct iframe markup must include referrerpolicy="strict-origin-when-cross-origin"');
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
  // The fallback uses string concatenation, not a template literal.
  // Locate the fallback section by the comment marker.
  const fallbackStart = src.indexOf('// 썸네일 없는 경우 바로 iframe (폴백)');
  assert.ok(fallbackStart >= 0, 'embed-patch fallback comment marker must exist');
  // Extract from the comment to the end of the function body (next '};').
  const fallbackSection = src.slice(fallbackStart, src.indexOf('};', fallbackStart));
  assert.ok(fallbackSection, 'embed-patch fallback section must be extractable');
  // The fallback uses string concatenation and includes referrerpolicy attribute.
  assert.match(fallbackSection, /referrerpolicy="strict-origin-when-cross-origin"/,
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