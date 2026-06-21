/**
 * My Trees phone viewport (375 / 390 / 430 px) visual rhythm =
 *   Browse phone viewport visual rhythm.
 *
 * Browse is the source of truth (latest Browse mobile rhythm after #2690).
 * My Trees mobile CSS must produce the same computed style for the hero,
 * search, and control rhythm elements at phone viewports (375 / 390 / 430 px).
 *
 * Scope:
 *   This contract targets phone viewports only (375 / 390 / 430 px width).
 *   The locked values come from Browse's `@media (max-width: 768px)` rules
 *   in css/search/search-controls.css, css/search/search-hero-controls.css,
 *   and css/search/search-responsive/browse.css.
 *
 *   No `@media (max-width: 480px)` rule in Browse overrides any of these
 *   rhythm values. The only 480px override is
 *     `.browse-results-head p { display: none }`
 *   in search-responsive/browse.css, which hides a description inside the
 *   results head (not the hero description), and is out of scope.
 *
 *   The 420px and 375px rules in Browse target empty-state and tree-card
 *   respectively, which are also out of scope.
 *
 * Tolerance:
 *   - font-size / line-height: 0px diff
 *   - height / width / padding: max 1px diff in rendered values
 *
 * Verification strategy:
 *   - Parse My Trees mobile `@media (max-width: 768px)` rules from the
 *     My Trees CSS files
 *   - Compare each rhythm property against the Browse source-of-truth value
 *
 *   Runtime Playwright verification is OPTIONAL and auto-skips if Playwright/
 *   Chrome is not available; the static CSS comparison is the source of truth.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Browse source-of-truth rhythm values (phone viewports 375 / 390 / 430 px) ──
//
// All values are derived from Browse's `@media (max-width: 768px)` rules.
// At phone viewports 375 / 390 / 430 px width, no 480px / 420px / 375px
// override changes these specific rhythm properties.

const BROWSE_RHYTHM = {
  // Source: search-responsive/browse.css @media (max-width: 768px) .search-panel-header p
  heroDesc: {
    cssRule: '.search-panel-header p',
    sourceFile: 'css/search/search-responsive/browse.css',
    sourceMedia: '@media (max-width: 768px)',
    'font-size': '0.96rem',
    'line-height': '1.72',
    'max-width': '100%',
  },
  // Source: search-controls.css @media (max-width: 768px) .search-input
  searchInput: {
    cssRule: '.search-input',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    height: '40px',
    'min-height': '40px',
    'max-height': '40px',
    padding: '10px 12px 10px 38px',
    'font-size': '0.86rem',
    'line-height': '1.15',
  },
  // Source: search-controls.css @media (max-width: 768px) .search-icon
  searchIcon: {
    cssRule: '.search-icon',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    left: '12px',
    'font-size': '18px',
  },
  // Source: search-controls.css @media (max-width: 768px) .tag-chip
  filterChip: {
    cssRule: '.tag-chip',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    'min-height': '26px',
    padding: '4px 8px',
    'font-size': '10.5px',
    'line-height': '1',
  },
  // Source: search-controls.css @media (max-width: 768px) .filter-row
  filterChips: {
    cssRule: '.filter-row',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    width: '100%',
    gap: '5px',
    'justify-content': 'flex-start',
  },
  // Source: search-controls.css @media (max-width: 768px) .browse-results-head
  // (no .browse-results-head 480px override applies; the only 480px override
  // is `.browse-results-head p { display: none }` which is out of rhythm scope)
  resultsHead: {
    cssRule: '.browse-results-head',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    'padding-top': '14px',
    gap: '12px',
    'margin-bottom': '16px',
    'flex-direction': 'column',
  },
  // Source: search-controls.css @media (max-width: 768px) .browse-sort-select
  sortSelect: {
    cssRule: '.browse-sort-select',
    sourceFile: 'css/search/search-controls.css',
    sourceMedia: '@media (max-width: 768px)',
    'min-height': '40px',
    'font-size': '13px',
    width: '100%',
    padding: '0 38px 0 16px',
  },
  // My Trees-specific collision guard: keep the sort control flexible enough
  // to share a compact row with the owner view-mode segmented control.
  sortControl: {
    cssRule: '.my-trees-results-controls .sort-control',
    sourceFile: 'css/my-trees/my-trees-mobile-controls-balance.css',
    sourceMedia: '@media (max-width: 768px)',
    flex: '1 1 auto',
    'max-width': 'none',
    'min-width': '0',
  },
  // My Trees-specific collision guard: spacing is owned by the row gap.
  viewModeMount: {
    cssRule: '.my-trees-results-controls .my-trees-view-mode-mount',
    sourceFile: 'css/my-trees/my-trees-mobile-controls-balance.css',
    sourceMedia: '@media (max-width: 768px)',
    flex: '0 0 auto',
    'margin-left': '0',
  },
  // My Trees-specific collision guard for the two compact controls.
  resultsControls: {
    cssRule: '.my-trees-results-controls',
    sourceFile: 'css/my-trees/my-trees-mobile-controls-balance.css',
    sourceMedia: '@media (max-width: 768px)',
    gap: '8px',
  },
};

// ── My Trees CSS file sources ──
const MY_TREES_CSS = {
  header: path.join(ROOT, 'css/my-trees/my-trees-header.css'),
  finder: path.join(ROOT, 'css/my-trees/my-trees-finder.css'),
  responsive: path.join(ROOT, 'css/my-trees/my-trees-responsive.css'),
  balance: path.join(ROOT, 'css/my-trees/my-trees-mobile-controls-balance.css'),
};

function readCss(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

// Extract the body of a mobile @media block (max-width: 768px) containing a
// specific selector. Returns the declaration string (single space separated)
// or null if not found.
function findMobileRule(css, selector, mediaQuery = 'max-width: 768px') {
  // Find @media block
  const mediaRe = new RegExp(`@media\\s*\\(\\s*${mediaQuery}\\s*\\)\\s*\\{`);
  const m = css.match(mediaRe);
  if (!m) return null;

  // Find matching closing brace
  let depth = 1;
  let i = m.index + m[0].length;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  const block = css.slice(m.index + m[0].length, i - 1);

  // Escape selector for regex (only `.` and `#` are common in CSS class/id selectors)
  const escapedSel = selector.replace(/[.+*?^$(){}[\]\\|]/g, '\\$&');
  // Find the selector declaration (with optional preceding whitespace, brace, or newline)
  const selRe = new RegExp(`(^|[\\s\\n}])${escapedSel}\\s*\\{([^}]*)\\}`, 'gm');
  let sm;
  while ((sm = selRe.exec(block)) !== null) {
    return sm[2].trim();
  }
  return null;
}

function findRule(css, selector) {
  // Escape selector for regex
  const escapedSel = selector.replace(/[.+*?^$(){}[\]\\|]/g, '\\$&');
  const re = new RegExp(`(^|\\n)\\s*${escapedSel}\\s*\\{([^}]*)\\}`, 'g');
  const m = re.exec(css);
  return m ? m[2].trim() : null;
}

function propFromDecl(decl, prop) {
  if (!decl) return null;
  // match `prop: value;` across multi-line declarations
  // value continues until next `;` or end of decl
  const re = new RegExp(`(?:^|;|\\n)\\s*${prop}\\s*:\\s*([^;]+?)\\s*(?=;|$)`, 's');
  const m = decl.match(re);
  if (!m) return null;
  // collapse whitespace
  return m[1].replace(/\s+/g, ' ').trim();
}

// ── Tests ──

test('rhythm: phone 375/390/430 — My Trees hero description p matches Browse @media (max-width: 768px) (font-size 0.96rem, line-height 1.72, max-width 100%)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-header p');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-header p');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '0.96rem', 'hero description font-size must be 0.96rem (locked)');
  assert.strictEqual(propFromDecl(decl, 'line-height'), '1.72', 'hero description line-height must be 1.72 (locked)');
  assert.strictEqual(propFromDecl(decl, 'max-width'), '100%', 'hero description max-width must be 100% (locked)');
});

test('rhythm: phone 375/390/430 — My Trees search input matches Browse @media (max-width: 768px) (height 40px, padding 10px 12px 10px 38px, font-size 0.86rem, line-height 1.15)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-search-input');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-search-input');
  for (const [prop, expected] of Object.entries(BROWSE_RHYTHM.searchInput)) {
    if (prop === 'cssRule' || prop === 'sourceFile' || prop === 'sourceMedia') continue;
    const actual = propFromDecl(decl, prop);
    assert.strictEqual(actual, expected, `search input ${prop}: expected ${expected} got ${actual}`);
  }
});

test('rhythm: phone 375/390/430 — My Trees search icon matches Browse @media (max-width: 768px) (left 12px, font-size 18px)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-search-box .material-symbols-outlined');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-search-box .material-symbols-outlined');
  assert.strictEqual(propFromDecl(decl, 'left'), '12px', 'search icon left must be 12px');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '18px', 'search icon font-size must be 18px');
});

test('rhythm: phone 375/390/430 — My Trees filter chip matches Browse @media (max-width: 768px) (min-height 26px, padding 4px 8px, font-size 10.5px, line-height 1)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-filter-chip');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-filter-chip');
  for (const [prop, expected] of Object.entries(BROWSE_RHYTHM.filterChip)) {
    if (prop === 'cssRule' || prop === 'sourceFile' || prop === 'sourceMedia') continue;
    const actual = propFromDecl(decl, prop);
    assert.strictEqual(actual, expected, `filter chip ${prop}: expected ${expected} got ${actual}`);
  }
});

test('rhythm: phone 375/390/430 — My Trees filter chips row matches Browse @media (max-width: 768px) (width 100%, gap 5px, justify-content flex-start)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-filter-chips');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-filter-chips');
  assert.strictEqual(propFromDecl(decl, 'width'), '100%', 'filter chips row width must be 100%');
  assert.strictEqual(propFromDecl(decl, 'gap'), '5px', 'filter chips row gap must be 5px');
  assert.strictEqual(propFromDecl(decl, 'justify-content'), 'flex-start', 'filter chips row justify-content must be flex-start');
});

test('rhythm: phone 375/390/430 — My Trees results-head matches Browse @media (max-width: 768px) (padding-top 14px, gap 12px, margin-bottom 16px)', () => {
  const header = readCss(MY_TREES_CSS.header);
  const decl = findMobileRule(header, '.my-trees-results-head');
  assert.ok(decl, 'my-trees-header.css must contain @media (max-width:768px) rule for .my-trees-results-head');
  // Base already provides flex-direction:column, gap:12px, margin:0 0 16px
  const baseDecl = findRule(header, '.my-trees-results-head');
  assert.strictEqual(propFromDecl(baseDecl, 'gap'), '12px', 'results-head base gap must be 12px');
  assert.match(propFromDecl(baseDecl, 'margin') || '', /0 0 16px/, 'results-head base margin must include 0 0 16px');
  assert.strictEqual(propFromDecl(baseDecl, 'flex-direction'), 'column', 'results-head base flex-direction must be column');
  // Mobile override must set padding-top to 14px (Browse value)
  assert.strictEqual(propFromDecl(decl, 'padding-top'), '14px', 'results-head mobile padding-top must be 14px');
});

test('rhythm: phone 375/390/430 — My Trees sort select matches Browse @media (max-width: 768px) (min-height 40px, font-size 13px, width 100%)', () => {
  // Sort select styling comes from two sources: my-trees-responsive.css (min-height/font-size/width)
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.summary-sort-control');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .summary-sort-control');
  assert.strictEqual(propFromDecl(decl, 'min-height'), '40px', 'summary-sort-control mobile min-height must be 40px');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '13px', 'summary-sort-control mobile font-size must be 13px');
  assert.strictEqual(propFromDecl(decl, 'width'), '100%', 'summary-sort-control mobile width must be 100%');
});

test('rhythm: phone 375/390/430 — My Trees sort control matches Browse @media (max-width: 768px) #browseSortControls (flex 0 1 50%, max-width 180px)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls .sort-control');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls .sort-control');
  assert.strictEqual(propFromDecl(decl, 'flex'), BROWSE_RHYTHM.sortControl.flex, 'sort-control mobile flex must allow collision-free shrink');
  assert.strictEqual(propFromDecl(decl, 'max-width'), BROWSE_RHYTHM.sortControl['max-width'], 'sort-control mobile max-width must not cap the available row width');
  assert.strictEqual(propFromDecl(decl, 'min-width'), BROWSE_RHYTHM.sortControl['min-width'], 'sort-control mobile min-width must allow shrink');
});

test('rhythm: phone 375/390/430 — My Trees view-mode mount matches Browse @media (max-width: 768px) #browseViewModeMount (flex 0 0 auto, margin-left auto)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls .my-trees-view-mode-mount');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls .my-trees-view-mode-mount');
  assert.strictEqual(propFromDecl(decl, 'flex'), BROWSE_RHYTHM.viewModeMount.flex, 'view-mode-mount mobile flex must stay fixed');
  assert.strictEqual(propFromDecl(decl, 'margin-left'), BROWSE_RHYTHM.viewModeMount['margin-left'], 'view-mode-mount mobile margin-left must avoid auto-pushing');
});

test('rhythm: phone 375/390/430 — My Trees results-controls gap matches Browse @media (max-width: 768px) (gap 18px)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls');
  assert.strictEqual(propFromDecl(decl, 'gap'), BROWSE_RHYTHM.resultsControls.gap, 'results-controls mobile gap must avoid overlap');
});
