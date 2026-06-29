/**
 * Runtime test: text-led media fallback theme safety.
 *
 * Loads Browse and My Trees renderers via vm sandbox and verifies:
 * 1. tier-2 output uses --tree-card-text-border / --tree-card-text-accent
 * 2. No hard-coded background:rgba(255,255,255,0.84) in output
 * 3. No inline style="color:" on kicker elements
 * 4. CSS consumes the custom properties without legacy RGBA fallback
 * 5. i18n kicker fallback preserved
 * 6. Tier decision (thumbnail → text cover → SVG) unchanged
 * 7. My Trees UI fallback path produces same contract
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// VM sandbox helpers (shared with media-fallback-unification-contract)
// ---------------------------------------------------------------------------

function createMockWindow(base) {
  const security = {
    escapeHtml: function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    sanitizeUrl: function (value) {
      if (!value) return '';
      var raw = String(value).trim();
      if (!raw) return '';
      try {
        var parsed = new URL(raw, 'https://localhost/');
        var protocol = parsed.protocol;
        if (protocol === 'http:' || protocol === 'https:') {
          return parsed.href;
        }
        return '';
      } catch (e) {
        return '';
      }
    }
  };
  const sharedUtils = {
    escapeHtml: security.escapeHtml
  };
  const storage = {};
  const mockLocalStorage = {
    getItem: function(key) { return storage[key] || null; },
    setItem: function(key, value) { storage[key] = String(value); },
    removeItem: function(key) { delete storage[key]; },
    clear: function() { Object.keys(storage).forEach(function(k) { delete storage[k]; }); }
  };
  return Object.assign({
    LoveBudSecurity: security,
    LoveBudSearchSharedUtils: sharedUtils,
    LoveBudSearchCardFallback: null,
    LoveBudMyTreesCardVisuals: null,
    LoveBudMyTreesCardEvents: null,
    LoveBudMyTreesUtils: { escapeHtml: security.escapeHtml, sanitizeUrl: security.sanitizeUrl },
    localStorage: mockLocalStorage
  }, base || {});
}

function runInNewWindow(js, overrides) {
  const win = createMockWindow(overrides);
  const ctx = {
    window: win,
    document: {
      createElement: function () {
        return {
          setAttribute: function () {},
          appendChild: function () {}
        };
      }
    }
  };
  vm.runInNewContext(js, ctx);
  return win;
}

// ---------------------------------------------------------------------------
// Source-level assertions (regression guard)
// ---------------------------------------------------------------------------

test('Browse renderer source no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'Browse must not inline rgba(255,255,255,0.84) background');
});

test('My Trees primary renderer source no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'My Trees primary must not inline rgba(255,255,255,0.84) background');
});

test('My Trees UI fallback renderer source no longer emits inline background rgba', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  assert.doesNotMatch(src, /background:rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'My Trees UI fallback must not inline rgba(255,255,255,0.84) background');
});

test('All three renderers source emit --tree-card-text-border custom property', () => {
  for (const file of ['js/search/search-card-fallback.js', 'js/my-trees/my-trees-card-visuals.js', 'js/my-trees/my-trees-ui.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /--tree-card-text-border/,
      `${file} must emit --tree-card-text-border`);
  }
});

test('All three renderers source emit --tree-card-text-accent custom property', () => {
  for (const file of ['js/search/search-card-fallback.js', 'js/my-trees/my-trees-card-visuals.js', 'js/my-trees/my-trees-ui.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /--tree-card-text-accent/,
      `${file} must emit --tree-card-text-accent`);
  }
});

// ---------------------------------------------------------------------------
// CSS assertions
// ---------------------------------------------------------------------------

test('Search CSS has theme-safe background surface without RGBA fallback', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.match(css, /var\(--surface\)/,
    'Search CSS must use var(--surface) for background');
  // Extract the text-visual rule and verify no rgba(255,255,255,0.84) remains
  const textVisualMatch = css.match(/\.tree-card-text-visual\s*\{[^}]+background:\s*var\(--surface\)[^}]*\}/);
  assert.ok(textVisualMatch, 'Search CSS .tree-card-text-visual must use background: var(--surface)');
  assert.doesNotMatch(textVisualMatch[0], /rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'Search CSS .tree-card-text-visual must not have rgba fallback');
});

test('My Trees CSS has theme-safe background surface without RGBA fallback', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.match(css, /var\(--surface\)/,
    'My Trees CSS must use var(--surface) for background');
  const textVisualMatch = css.match(/\.tree-card-text-visual\s*\{[^}]+background:\s*var\(--surface\)[^}]*\}/);
  assert.ok(textVisualMatch, 'My Trees CSS .tree-card-text-visual must use background: var(--surface)');
  assert.doesNotMatch(textVisualMatch[0], /rgba\(255,\s*255,\s*255,\s*0\.84\)/,
    'My Trees CSS .tree-card-text-visual must not have rgba fallback');
});

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

test('Search CSS kicker consumes --tree-card-text-accent', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.match(css, /--tree-card-text-accent/,
    'Search CSS kicker must consume accent custom property');
});

test('My Trees CSS kicker consumes --tree-card-text-accent', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.match(css, /--tree-card-text-accent/,
    'My Trees CSS kicker must consume accent custom property');
});

// ---------------------------------------------------------------------------
// Runtime: Browse renderer -- buildRepresentativeTextVisual
// ---------------------------------------------------------------------------

test('Browse buildRepresentativeTextVisual output contains --tree-card-text-border', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.ok(html.includes('--tree-card-text-border'),
    'tier-2 HTML must contain --tree-card-text-border custom property');
});

test('Browse buildRepresentativeTextVisual output contains --tree-card-text-accent', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.ok(html.includes('--tree-card-text-accent'),
    'tier-2 HTML must contain --tree-card-text-accent custom property');
});

test('Browse buildRepresentativeTextVisual has no inline background style', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.doesNotMatch(html, /style="[^"]*background\s*:/,
    'tier-2 HTML must not have inline background style');
});

test('Browse buildRepresentativeTextVisual kicker has no inline color', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  // Kicker div must not have inline style="color:..."
  const kickerMatch = html.match(/<div\s+class="tree-card-text-kicker"[^>]*>/);
  assert.ok(kickerMatch, 'kicker div must exist');
  assert.doesNotMatch(kickerMatch[0], /style="[^"]*color\s*:/,
    'kicker must not have inline style="color:"');
});

test('Browse buildRepresentativeTextVisual preserves Korean kicker fallback', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.ok(html.includes('첫 순간 기록'),
    'Browse must preserve Korean kicker fallback when no i18n available');
});

test('Browse buildRepresentativeTextVisual output uses correct CSS class structure', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.ok(/<div\s+class="tree-card-text-visual"/.test(html),
    'Must start with tree-card-text-visual div');
  assert.ok(/<div\s+class="tree-card-text-kicker"/.test(html),
    'Must contain tree-card-text-kicker div');
  assert.ok(/<div\s+class="tree-card-text-title"/.test(html),
    'Must contain tree-card-text-title div');
  assert.ok(/<div\s+class="tree-card-text-memo"/.test(html),
    'Must contain tree-card-text-memo div');
});

// ---------------------------------------------------------------------------
// Runtime: My Trees primary renderer -- buildRepresentativeTextVisual
// ---------------------------------------------------------------------------

test('My Trees buildRepresentativeTextVisual output contains --tree-card-text-border', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    function(k) { return k; }
  );
  assert.ok(html.includes('--tree-card-text-border'),
    'My Trees tier-2 HTML must contain --tree-card-text-border');
});

test('My Trees buildRepresentativeTextVisual output contains --tree-card-text-accent', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    function(k) { return k; }
  );
  assert.ok(html.includes('--tree-card-text-accent'),
    'My Trees tier-2 HTML must contain --tree-card-text-accent');
});

test('My Trees buildRepresentativeTextVisual has no inline background style', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    function(k) { return k; }
  );
  assert.doesNotMatch(html, /style="[^"]*background\s*:/,
    'My Trees tier-2 HTML must not have inline background style');
});

test('My Trees buildRepresentativeTextVisual kicker has no inline color', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    function(k) { return k; }
  );
  const kickerMatch = html.match(/<div\s+class="tree-card-text-kicker"[^>]*>/);
  assert.ok(kickerMatch, 'kicker div must exist');
  assert.doesNotMatch(kickerMatch[0], /style="[^"]*color\s*:/,
    'kicker must not have inline style="color:"');
});

test('My Trees buildRepresentativeTextVisual preserves i18n kicker fallback', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  // Use an i18n function that returns the key itself (simulates no translation)
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    function(k) { return k; }
  );
  // When i18n returns the key, the function falls back to Korean
  assert.ok(html.includes('첫 순간 기록'),
    'My Trees must preserve Korean kicker fallback');
  assert.doesNotMatch(html, /style="[^"]*color\s*:/,
    'kicker must not have inline style="color:"');
});

// ---------------------------------------------------------------------------
// Runtime: My Trees UI fallback path (no LoveBudMyTreesCardVisuals)
// ---------------------------------------------------------------------------

test('My Trees UI fallback path (no Visuals) produces SVG fallback correctly', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  // Load without LoveBudMyTreesCardVisuals to exercise the inline fallback
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } },
    // No LoveBudMyTreesCardVisuals set deliberately — exercises the inline SVG fallback
  });

  // Tier 3: tree with no thumbnail and no text meta → SVG fallback
  const html = win.LoveBudMyTreesUI.buildTreeThumbVisual(
    { title: 'Empty Tree' },
    function(k) { return k; }
  );

  assert.ok(/tree-card-media-fallback/.test(html),
    'Fallback path must render SVG fallback when no thumbnail or text meta');
  assert.ok(/<svg/.test(html),
    'Fallback path must contain SVG element');
  assert.ok(!/tree-card-text-visual/.test(html),
    'Fallback path must NOT render text cover (only SVG fallback)');

  // Tier 1: tree with thumbnail → <img>
  const htmlThumb = win.LoveBudMyTreesUI.buildTreeThumbVisual(
    { representativeThumbnail: 'https://example.com/t.jpg', title: 'Test' },
    function(k) { return k; }
  );
  assert.ok(/<img\s/.test(htmlThumb),
    'Fallback path must render <img> when thumbnail provided');
});

test('My Trees UI fallback path (no Visuals) tier-2 text cover meets theme contract', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  // Load without LoveBudMyTreesCardVisuals to exercise the inline fallback
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } },
    // No LoveBudMyTreesCardVisuals set deliberately
  });

  const html = win.LoveBudMyTreesUI.buildTreeThumbVisual(
    {
      title: 'Fallback Tree',
      representativeTitle: 'Text-only moment',
      representativeMemo: 'No image, so this must use tier two.'
    },
    function(k) { return k; }
  );

  // Must render text-led cover (tier 2), not SVG-only fallback
  assert.ok(/tree-card-text-visual/.test(html),
    'Fallback path must render text-led cover when representative text exists');
  assert.ok(!/tree-card-media-fallback/.test(html),
    'Fallback path must NOT use SVG-only media-fallback when representative text exists');

  // Custom property contract
  assert.ok(html.includes('--tree-card-text-border'),
    'Fallback path tier-2 HTML must contain --tree-card-text-border');
  assert.ok(html.includes('--tree-card-text-accent'),
    'Fallback path tier-2 HTML must contain --tree-card-text-accent');

  // No inline background on the text-visual element
  const tvEl = html.match(/<div\s+class="tree-card-text-visual"[^>]*>/);
  assert.ok(tvEl, 'tree-card-text-visual element must exist');
  assert.doesNotMatch(tvEl[0], /style="[^"]*background\s*:/,
    'Fallback path text-visual must not inline background');

  // Kicker must not have inline style="color:"
  const kickerEl = html.match(/<div\s+class="tree-card-text-kicker"[^>]*>/);
  assert.ok(kickerEl, 'tree-card-text-kicker element must exist');
  assert.doesNotMatch(kickerEl[0], /style="[^"]*color\s*:/,
    'Fallback path kicker must not have inline style="color:"');

  // Korean fallback preserved
  assert.ok(html.includes('첫 순간 기록'),
    'Fallback path must preserve Korean kicker fallback');
});

// ---------------------------------------------------------------------------
// Runtime: Browse renderRepresentativeMedia tier 2 output contract
// ---------------------------------------------------------------------------

test('Browse tier 2 (text cover) via renderRepresentativeMedia meets theme contract', () => {
  const win = runInNewWindow(fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8'));
  const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    null,
    'Test Title'
  );
  assert.ok(/tree-card-text-visual/.test(html), 'tier 2 must render text cover');
  assert.ok(html.includes('--tree-card-text-border'), 'tier 2 must have border custom property');
  assert.ok(html.includes('--tree-card-text-accent'), 'tier 2 must have accent custom property');
  // Only check .tree-card-text-visual for no inline background (outer container may have palette bg)
  const tvEl = html.match(/<div\s+class="tree-card-text-visual"[^>]*>/);
  assert.ok(tvEl, 'tree-card-text-visual element must exist');
  assert.doesNotMatch(tvEl[0], /style="[^"]*background\s*:/,
    'tier 2 text-visual must not inline background');
  const innerKicker = html.match(/<div\s+class="tree-card-text-kicker"[^>]*>/);
  if (innerKicker) {
    assert.doesNotMatch(innerKicker[0], /style="[^"]*color\s*:/, 'tier 2 kicker must not inline color');
  }
});

// ---------------------------------------------------------------------------
// My Trees buildTreeThumbVisual tier 2 output contract
// ---------------------------------------------------------------------------

test('My Trees tier 2 (text cover) via buildTreeThumbVisual meets theme contract', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const win = runInNewWindow(src, {
    LoveBudMyTreesUtils: { escapeHtml: function(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
  });
  const html = win.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
    { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
    function(k) { return k; }
  );
  assert.ok(/tree-card-text-visual/.test(html), 'tier 2 must render text cover');
  assert.ok(html.includes('--tree-card-text-border'), 'tier 2 must have border custom property');
  assert.ok(html.includes('--tree-card-text-accent'), 'tier 2 must have accent custom property');
  // Only check .tree-card-text-visual for no inline background (outer thumb may have palette bg)
  const tvEl2 = html.match(/<div\s+class="tree-card-text-visual"[^>]*>/);
  assert.ok(tvEl2, 'tree-card-text-visual element must exist');
  assert.doesNotMatch(tvEl2[0], /style="[^"]*background\s*:/,
    'tier 2 text-visual must not inline background');
});

// ---------------------------------------------------------------------------
// Tier preservation
// ---------------------------------------------------------------------------

test('Browse tier decision (thumbnail → text cover → SVG) is unchanged', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.match(src, /buildRepresentativeTextVisual/, 'Browse must retain text cover builder');
  assert.match(src, /renderMediaFallback/, 'Browse must retain SVG fallback');

  const mtVisuals = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.match(mtVisuals, /buildRepresentativeTextVisual/, 'My Trees must retain text cover builder');

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

// ---------------------------------------------------------------------------
// Kicker text source presence checks
// ---------------------------------------------------------------------------

test('Browse kicker text "첫 순간 기록" preserved in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.match(src, /첫 순간 기록/,
    'Browse must preserve Korean kicker fallback');
  assert.match(src, /First Moment/,
    'Browse must preserve English kicker variant');
});

test('My Trees primary kicker text "첫 순간 기록" preserved in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.match(src, /첫 순간 기록/,
    'My Trees primary must preserve Korean kicker fallback');
});

test('My Trees UI fallback kicker text "첫 순간 기록" preserved in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  assert.match(src, /첫 순간 기록/,
    'My Trees UI fallback must preserve Korean kicker fallback');
});

// ---------------------------------------------------------------------------
// All three renderers no longer have inline kicker color in source
// ---------------------------------------------------------------------------

test('Browse kicker no longer uses inline style="color:" in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.doesNotMatch(src, /tree-card-text-kicker"\s*style="color:/,
    'Browse kicker must not use inline style="color:"');
});

test('My Trees primary kicker no longer uses inline style="color:" in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.doesNotMatch(src, /tree-card-text-kicker"\s*style="color:/,
    'My Trees primary kicker must not use inline style="color:"');
});

test('My Trees UI fallback kicker no longer uses inline style="color:" in source', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-ui.js'), 'utf8');
  assert.doesNotMatch(src, /tree-card-text-kicker"\s*style="color:/,
    'My Trees UI fallback kicker must not use inline style="color:"');
});
