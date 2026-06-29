/**
 * Contract test: text-led media fallback visual rhythm.
 *
 * Verifies that Browse and My Trees tier-2 text-cover selectors are
 * page-root-scoped and share identical canonical declaration values,
 * preserving theme-safe surface and dynamic palette contracts.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a CSS rule block (selector + declarations) from raw CSS text.
 * Returns null if not found.
 */
function extractRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{([^}]+)\\}');
  const m = css.match(re);
  if (!m) return null;
  // Parse declarations into a map
  const decls = {};
  for (const decl of m[1].split(';')) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();
    decls[prop] = val;
  }
  return { raw: m[1], declarations: decls };
}

/**
 * Check that a selector exists as a bare (unscoped) rule.
 */
function hasBareSelector(css, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{');
  return re.test(css);
}

// ---------------------------------------------------------------------------
// Canonical declaration values
// ---------------------------------------------------------------------------

const CANONICAL = {
  visual: {
    'position': 'relative',
    'width': 'calc(100% - 20px)',
    'min-height': '126px',
    'display': 'flex',
    'flex-direction': 'column',
    'align-items': 'stretch',
    'justify-content': 'center',
    'gap': '8px',
    'padding': '16px 18px',
    'box-sizing': 'border-box',
    'border': '1px solid var(--tree-card-text-border, transparent)',
    'border-radius': '24px',
    'background': 'var(--surface)',
    'box-shadow': '0 14px 34px rgba(75, 64, 57, 0.07)',
    'backdrop-filter': 'blur(10px)',
    'z-index': '1',
    'text-align': 'left',
  },
  kicker: {
    'font-size': '10px',
    'font-weight': '900',
    'letter-spacing': '0.08em',
    'text-transform': 'uppercase',
    'opacity': '0.8',
    'margin-bottom': '4px',
    'color': 'var(--tree-card-text-accent, var(--primary))',
  },
  title: {
    'font-size': '1rem',
    'font-weight': '800',
    'line-height': '1.4',
    'color': 'var(--on-surface)',
    'word-break': 'keep-all',
  },
  memo: {
    'font-size': '12px',
    'line-height': '1.55',
    'color': 'var(--on-surface-variant)',
    'display': '-webkit-box',
    '-webkit-line-clamp': '3',
    '-webkit-box-orient': 'vertical',
    'overflow': 'hidden',
    'word-break': 'keep-all',
  },
};

// ---------------------------------------------------------------------------
// Selector isolation tests
// ---------------------------------------------------------------------------

test('Browse stylesheet scopes all four text-cover selectors under .search-container', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.ok(extractRule(css, '.search-container .tree-card-text-visual'),
    'Must have .search-container .tree-card-text-visual');
  assert.ok(extractRule(css, '.search-container .tree-card-text-kicker'),
    'Must have .search-container .tree-card-text-kicker');
  assert.ok(extractRule(css, '.search-container .tree-card-text-title'),
    'Must have .search-container .tree-card-text-title');
  assert.ok(extractRule(css, '.search-container .tree-card-text-memo'),
    'Must have .search-container .tree-card-text-memo');
});

test('My Trees stylesheet scopes all four text-cover selectors under .my-trees-container', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.ok(extractRule(css, '.my-trees-container .tree-card-text-visual'),
    'Must have .my-trees-container .tree-card-text-visual');
  assert.ok(extractRule(css, '.my-trees-container .tree-card-text-kicker'),
    'Must have .my-trees-container .tree-card-text-kicker');
  assert.ok(extractRule(css, '.my-trees-container .tree-card-text-title'),
    'Must have .my-trees-container .tree-card-text-title');
  assert.ok(extractRule(css, '.my-trees-container .tree-card-text-memo'),
    'Must have .my-trees-container .tree-card-text-memo');
});

test('Browse stylesheet has no bare .tree-card-text-* selector without page root', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  for (const cls of ['.tree-card-text-visual', '.tree-card-text-kicker', '.tree-card-text-title', '.tree-card-text-memo']) {
    assert.ok(!hasBareSelector(css, cls),
      `Browse must not have bare ${cls} selector`);
  }
});

test('My Trees stylesheet has no bare .tree-card-text-* selector without page root', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  for (const cls of ['.tree-card-text-visual', '.tree-card-text-kicker', '.tree-card-text-title', '.tree-card-text-memo']) {
    assert.ok(!hasBareSelector(css, cls),
      `My Trees must not have bare ${cls} selector`);
  }
});

// ---------------------------------------------------------------------------
// Declaration value parity tests
// ---------------------------------------------------------------------------

test('Browse .tree-card-text-visual declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  const rule = extractRule(css, '.search-container .tree-card-text-visual');
  assert.ok(rule, '.search-container .tree-card-text-visual must exist');
  for (const [prop, val] of Object.entries(CANONICAL.visual)) {
    assert.equal(rule.declarations[prop], val,
      `.search-container .tree-card-text-visual: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('My Trees .tree-card-text-visual declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  const rule = extractRule(css, '.my-trees-container .tree-card-text-visual');
  assert.ok(rule, '.my-trees-container .tree-card-text-visual must exist');
  for (const [prop, val] of Object.entries(CANONICAL.visual)) {
    assert.equal(rule.declarations[prop], val,
      `.my-trees-container .tree-card-text-visual: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('Browse .tree-card-text-kicker declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  const rule = extractRule(css, '.search-container .tree-card-text-kicker');
  assert.ok(rule, '.search-container .tree-card-text-kicker must exist');
  for (const [prop, val] of Object.entries(CANONICAL.kicker)) {
    assert.equal(rule.declarations[prop], val,
      `.search-container .tree-card-text-kicker: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('My Trees .tree-card-text-kicker declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  const rule = extractRule(css, '.my-trees-container .tree-card-text-kicker');
  assert.ok(rule, '.my-trees-container .tree-card-text-kicker must exist');
  for (const [prop, val] of Object.entries(CANONICAL.kicker)) {
    assert.equal(rule.declarations[prop], val,
      `.my-trees-container .tree-card-text-kicker: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('Browse .tree-card-text-title declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  const rule = extractRule(css, '.search-container .tree-card-text-title');
  assert.ok(rule, '.search-container .tree-card-text-title must exist');
  for (const [prop, val] of Object.entries(CANONICAL.title)) {
    assert.equal(rule.declarations[prop], val,
      `.search-container .tree-card-text-title: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('My Trees .tree-card-text-title declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  const rule = extractRule(css, '.my-trees-container .tree-card-text-title');
  assert.ok(rule, '.my-trees-container .tree-card-text-title must exist');
  for (const [prop, val] of Object.entries(CANONICAL.title)) {
    assert.equal(rule.declarations[prop], val,
      `.my-trees-container .tree-card-text-title: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('Browse .tree-card-text-memo declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  const rule = extractRule(css, '.search-container .tree-card-text-memo');
  assert.ok(rule, '.search-container .tree-card-text-memo must exist');
  for (const [prop, val] of Object.entries(CANONICAL.memo)) {
    assert.equal(rule.declarations[prop], val,
      `.search-container .tree-card-text-memo: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

test('My Trees .tree-card-text-memo declarations match canonical', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  const rule = extractRule(css, '.my-trees-container .tree-card-text-memo');
  assert.ok(rule, '.my-trees-container .tree-card-text-memo must exist');
  for (const [prop, val] of Object.entries(CANONICAL.memo)) {
    assert.equal(rule.declarations[prop], val,
      `.my-trees-container .tree-card-text-memo: ${prop} must be "${val}", got "${rule.declarations[prop]}"`);
  }
});

// ---------------------------------------------------------------------------
// Theme-safe custom property contract preservation
// ---------------------------------------------------------------------------

test('Both stylesheets consume --surface for background', () => {
  for (const file of ['css/search/search-tree-card/fallback.css', 'css/my-trees/my-trees-cards.css']) {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(css, /var\(--surface\)/,
      `${file} must use var(--surface) for background`);
  }
});

test('Both stylesheets consume --tree-card-text-border', () => {
  for (const file of ['css/search/search-tree-card/fallback.css', 'css/my-trees/my-trees-cards.css']) {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(css, /--tree-card-text-border/,
      `${file} must consume border custom property`);
  }
});

test('Both stylesheets kicker consumes --tree-card-text-accent', () => {
  for (const file of ['css/search/search-tree-card/fallback.css', 'css/my-trees/my-trees-cards.css']) {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(css, /--tree-card-text-accent/,
      `${file} kicker must consume accent custom property`);
  }
});

// ---------------------------------------------------------------------------
// Runtime tier-2 renderer output preserves class structure
// ---------------------------------------------------------------------------

test('Browse tier-2 renderer output preserves text-cover class structure', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  const vm = require('vm');
  const security = {
    escapeHtml: v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    sanitizeUrl: v => { if (!v) return ''; try { const p = new URL(v, 'https://localhost/'); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; } catch (e) { return ''; } }
  };
  const win = {
    LoveBudSecurity: security,
    LoveBudSearchSharedUtils: { escapeHtml: security.escapeHtml },
    localStorage: { getItem() {}, setItem() {}, removeItem() {}, clear() {} }
  };
  vm.runInNewContext(src, { window: win, document: { createElement() { return { setAttribute() {}, appendChild() {} }; } } });
  const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
    { representativeTitle: 'Test', representativeMemo: 'Test' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    null
  );
  assert.ok(/<div\s+class="tree-card-text-visual"/.test(html), 'Must have tree-card-text-visual');
  assert.ok(/<div\s+class="tree-card-text-kicker"/.test(html), 'Must have tree-card-text-kicker');
  assert.ok(/<div\s+class="tree-card-text-title"/.test(html), 'Must have tree-card-text-title');
  assert.ok(/<div\s+class="tree-card-text-memo"/.test(html), 'Must have tree-card-text-memo');
});

test('My Trees tier-2 renderer output preserves text-cover class structure', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  const vm = require('vm');
  const win = {
    LoveBudMyTreesUtils: { escapeHtml: v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') },
    localStorage: { getItem() {}, setItem() {}, removeItem() {}, clear() {} }
  };
  vm.runInNewContext(src, { window: win, document: { createElement() { return { setAttribute() {}, appendChild() {} }; } } });
  const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
    { representativeTitle: 'Test', representativeMemo: 'Test' },
    { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
    k => k
  );
  assert.ok(/<div\s+class="tree-card-text-visual"/.test(html), 'Must have tree-card-text-visual');
  assert.ok(/<div\s+class="tree-card-text-kicker"/.test(html), 'Must have tree-card-text-kicker');
  assert.ok(/<div\s+class="tree-card-text-title"/.test(html), 'Must have tree-card-text-title');
  assert.ok(/<div\s+class="tree-card-text-memo"/.test(html), 'Must have tree-card-text-memo');
});

// ---------------------------------------------------------------------------
// Tier policy unchanged: thumbnail → text cover → SVG fallback
// ---------------------------------------------------------------------------

test('Browse tier policy unchanged (thumbnail → text cover → SVG)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
  assert.match(src, /buildRepresentativeTextVisual/, 'Browse must retain text cover builder');
  assert.match(src, /renderMediaFallback/, 'Browse must retain SVG fallback');
});

test('My Trees tier policy unchanged (thumbnail → text cover → SVG)', () => {
  const mtVisuals = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
  assert.match(mtVisuals, /buildRepresentativeTextVisual/, 'My Trees must retain text cover builder');
  assert.match(mtVisuals, /buildTreeThumbVisual/, 'My Trees must retain thumb builder');
});

// ---------------------------------------------------------------------------
// Selector cross-contamination guard
// ---------------------------------------------------------------------------

test('Browse selectors do not match .my-trees-container root', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/fallback.css'), 'utf8');
  assert.doesNotMatch(css, /\.my-trees-container\s+\.tree-card-text-/,
    'Browse stylesheet must not contain .my-trees-container scoped rules');
});

test('My Trees selectors do not match .search-container root', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
  assert.doesNotMatch(css, /\.search-container\s+\.tree-card-text-/,
    'My Trees stylesheet must not contain .search-container scoped rules');
});
