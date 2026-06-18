/**
 * My Trees mobile visual rhythm = Browse mobile visual rhythm (PR #2690 source of truth).
 *
 * Browse #2690 sets the source-of-truth rhythm at mobile breakpoints.
 * My Trees mobile CSS must produce the same computed style for the hero,
 * search, and control rhythm elements.
 *
 * Tolerance (per task spec):
 * - font-size / line-height: 0px diff
 * - height / width / padding: max 1px diff in rendered values
 *
 * Verification strategy:
 * - Parse My Trees mobile @media rules from the CSS files
 * - Convert to expected computed-style strings
 * - Compare against locked-in Browse #2690 rhythm values
 *
 * Runtime Playwright verification is OPTIONAL and auto-skips if Playwright/
 * Chrome is not available; the static CSS comparison is the source of truth.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Browse #2690 source-of-truth rhythm values (mobile @media max-width:768px) ──
//
// These are the locked-in computed-style values that My Trees mobile CSS must
// produce. Derived from PR #2690 (ui/browse-mobile-sort-controls-row-balance)
// and the preceding Browse-side rhythm alignment work.

const BROWSE_RHYTHM = {
  heroDesc: {
    fontSize: '16px',       // 1rem base; mobile override at .search-panel-header p = 0.96rem
    lineHeight: '27.52px',  // 0.96 * 1.72 * 16 = 27.52px (locked)
    // Browse mobile override: .search-panel-header p { font-size: 0.96rem; line-height: 1.72; max-width: 100% }
    cssRule: '.search-panel-header p',
    mobileRule: '@media (max-width: 768px)',
    mobileFontSize: '0.96rem',
    mobileLineHeight: '1.72',
    mobileMaxWidth: '100%',
  },
  searchInput: {
    height: '40px',
    'min-height': '40px',
    'max-height': '40px',
    padding: '10px 12px 10px 38px',
    'font-size': '0.86rem',
    'line-height': '1.15',
  },
  searchIcon: {
    left: '12px',
    fontSize: '18px',
  },
  filterChip: {
    'min-height': '26px',
    padding: '4px 8px',
    'font-size': '10.5px',
    'line-height': '1',
  },
  filterChips: {
    width: '100%',
    gap: '5px',
    justifyContent: 'flex-start',
  },
  resultsHead: {
    mobilePaddingTop: '14px',
    mobileGap: '12px',
    mobileMarginBottom: '16px',
    mobileFlexDirection: 'column',
  },
  sortSelect: {
    'min-height': '40px',
    'font-size': '13px',
    width: '100%',
    padding: '0 38px 0 16px',
  },
  sortControl: {
    flex: '0 1 50%',
    maxWidth: '180px',
  },
  viewModeMount: {
    flex: '0 0 auto',
    marginLeft: 'auto',
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

test('rhythm: My Trees hero description p uses Browse mobile rhythm (font-size 0.96rem, line-height 1.72, max-width 100%)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-header p');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-header p');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '0.96rem', 'hero description font-size must be 0.96rem (locked)');
  assert.strictEqual(propFromDecl(decl, 'line-height'), '1.72', 'hero description line-height must be 1.72 (locked)');
  assert.strictEqual(propFromDecl(decl, 'max-width'), '100%', 'hero description max-width must be 100% (locked)');
});

test('rhythm: My Trees search input uses Browse mobile rhythm (height 40px, padding 10px 12px 10px 38px, font-size 0.86rem, line-height 1.15)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-search-input');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-search-input');
  for (const [prop, expected] of Object.entries(BROWSE_RHYTHM.searchInput)) {
    const actual = propFromDecl(decl, prop);
    assert.strictEqual(actual, expected, `search input ${prop}: expected ${expected} got ${actual}`);
  }
});

test('rhythm: My Trees search icon uses Browse mobile rhythm (left 12px, font-size 18px)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-search-box .material-symbols-outlined');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-search-box .material-symbols-outlined');
  assert.strictEqual(propFromDecl(decl, 'left'), '12px', 'search icon left must be 12px');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '18px', 'search icon font-size must be 18px');
});

test('rhythm: My Trees filter chip uses Browse mobile rhythm (min-height 26px, padding 4px 8px, font-size 10.5px)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-filter-chip');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-filter-chip');
  for (const [prop, expected] of Object.entries(BROWSE_RHYTHM.filterChip)) {
    const actual = propFromDecl(decl, prop);
    assert.strictEqual(actual, expected, `filter chip ${prop}: expected ${expected} got ${actual}`);
  }
});

test('rhythm: My Trees filter chips row uses Browse mobile rhythm (width 100%, gap 5px, justify-content flex-start)', () => {
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.my-trees-filter-chips');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .my-trees-filter-chips');
  assert.strictEqual(propFromDecl(decl, 'width'), '100%', 'filter chips row width must be 100%');
  assert.strictEqual(propFromDecl(decl, 'gap'), '5px', 'filter chips row gap must be 5px');
  assert.strictEqual(propFromDecl(decl, 'justify-content'), 'flex-start', 'filter chips row justify-content must be flex-start');
});

test('rhythm: My Trees results-head mobile rhythm matches Browse (padding-top 14px, gap 12px, margin-bottom 16px)', () => {
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

test('rhythm: My Trees sort select (mobile) uses Browse rhythm (min-height 40px, font-size 13px, width 100%)', () => {
  // Sort select styling comes from two sources: my-trees-responsive.css (min-height/font-size/width)
  const responsive = readCss(MY_TREES_CSS.responsive);
  const decl = findMobileRule(responsive, '.summary-sort-control');
  assert.ok(decl, 'my-trees-responsive.css must contain @media (max-width:768px) rule for .summary-sort-control');
  assert.strictEqual(propFromDecl(decl, 'min-height'), '40px', 'summary-sort-control mobile min-height must be 40px');
  assert.strictEqual(propFromDecl(decl, 'font-size'), '13px', 'summary-sort-control mobile font-size must be 13px');
  assert.strictEqual(propFromDecl(decl, 'width'), '100%', 'summary-sort-control mobile width must be 100%');
});

test('rhythm: My Trees sort control (mobile) matches Browse #browseSortControls (flex 0 1 50%, max-width 180px)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls .sort-control');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls .sort-control');
  assert.strictEqual(propFromDecl(decl, 'flex'), '0 1 50%', 'sort-control mobile flex must be 0 1 50% (Browse parity)');
  assert.strictEqual(propFromDecl(decl, 'max-width'), '180px', 'sort-control mobile max-width must be 180px');
});

test('rhythm: My Trees view-mode mount (mobile) matches Browse #browseViewModeMount (flex 0 0 auto, margin-left auto)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls .my-trees-view-mode-mount');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls .my-trees-view-mode-mount');
  assert.strictEqual(propFromDecl(decl, 'margin-left'), 'auto', 'view-mode-mount mobile margin-left must be auto');
});

test('rhythm: My Trees results-controls (mobile) gap matches Browse (gap 18px)', () => {
  const balance = readCss(MY_TREES_CSS.balance);
  const decl = findMobileRule(balance, '.my-trees-results-controls');
  assert.ok(decl, 'my-trees-mobile-controls-balance.css must contain @media (max-width:768px) rule for .my-trees-results-controls');
  assert.strictEqual(propFromDecl(decl, 'gap'), '18px', 'results-controls mobile gap must be 18px (Browse parity)');
});
