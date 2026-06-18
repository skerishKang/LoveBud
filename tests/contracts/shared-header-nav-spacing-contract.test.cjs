/**
 * Shared Header / Nav spacing contract.
 *
 * Source of truth: css/global/global-header.css (the single shared header CSS).
 * Contract: every page (Home, Intro, Search, My Trees, Settings, ...) uses the
 * same shared header CSS, the same #auth-nav min-width, the same nav link rhythm,
 * the same Scout AI button and profile avatar spacing.
 *
 * This contract:
 * - Scans all CSS files for `#shared-header` selectors.
 * - Allows only `css/global/global-header.css` (and its sub-imports) to define
 *   `#shared-header` rules. Any other CSS file with a `#shared-header` rule is
 *   a page-specific override and must fail this contract.
 * - Locks the global header rhythm values (min-width for #auth-nav, header
 *   height, nav link min-height, etc.) so future drift is caught.
 * - Verifies the shared-header.js script is loaded with the same cache version
 *   on all in-scope pages.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CSS_DIR = path.join(ROOT, 'css');

// In-scope pages
const IN_SCOPE_PAGES = [
  'index.html',
  'pages/intro.html',
  'pages/search.html',
  'pages/my-trees.html',
  'pages/settings.html',
];

// Shared header cache version (bumped on each shared-header change)
const SHARED_HEADER_JS_VERSION = '20260421-2';
const GLOBAL_CSS_VERSION = '20260618-2700-1';
const INDEX_CSS_VERSION = '20260618-2700-1';

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function listCssFiles(dir) {
  const out = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.css')) out.push(full);
    }
  }
  walk(dir);
  return out;
}

function findSharedHeaderRules(cssPath, content) {
  // Match any CSS rule whose selector chain includes `#shared-header`.
  // Examples:
  //   #shared-header .cached-avatar-initial { ... }
  //   #shared-header #auth-nav { ... }
  //   .nav-bar #shared-header .x { ... }
  const rules = [];
  const re = /#shared-header\s*[\w.:\[\]"=,>\s~+*()#.&-]*/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    // Find the opening brace after this selector position
    let i = m.index + m[0].length;
    while (i < content.length && content[i] !== '{') i++;
    if (i >= content.length) continue;
    // Find matching close brace
    let depth = 1;
    const start = i + 1;
    i++;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) continue;
    const decls = content.slice(start, i - 1).trim();
    rules.push({ selector: m[0].trim(), declarations: decls });
  }
  return rules;
}

// ── 1. Page-specific shared-header CSS overrides are forbidden ──

test('shared-header: no page-specific CSS file defines a #shared-header rule', () => {
  const cssFiles = listCssFiles(CSS_DIR);
  const offenders = [];
  for (const f of cssFiles) {
    // Allow only css/global/global-header.css to define #shared-header rules
    const rel = path.relative(ROOT, f);
    if (rel === path.join('css', 'global', 'global-header.css')) continue;
    const content = readFile(f);
    const rules = findSharedHeaderRules(f, content);
    if (rules.length > 0) {
      offenders.push({ file: rel, count: rules.length, sample: rules[0].selector });
    }
  }
  assert.deepStrictEqual(offenders, [],
    `Page-specific CSS must not override shared header. Offenders: ${JSON.stringify(offenders, null, 2)}`);
});

// ── 2. #auth-nav min-width is consistent across the shared header ──

test('shared-header: #auth-nav desktop min-width is consistent (no Home-only override)', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  // Find the @media (min-width: 769px) block that sets #auth-nav min-width
  const mediaRe = /@media\s*\(\s*min-width:\s*769px\s*\)\s*\{([\s\S]*?)\n\}/;
  const m = css.match(mediaRe);
  assert.ok(m, 'global-header.css must contain @media (min-width:769px) block');
  const block = m[1];
  // Find #auth-nav rule
  const authRe = /#auth-nav[\s\S]*?\{([^}]*)\}/;
  const am = block.match(authRe);
  assert.ok(am, '@media (min-width:769px) must contain #auth-nav rule');
  const decls = am[1];
  // min-width must be 100px (not 46px or 88px)
  const minWidthMatch = decls.match(/min-width:\s*(\d+)px/);
  assert.ok(minWidthMatch, '#auth-nav must have min-width');
  assert.strictEqual(minWidthMatch[1], '100', `#auth-nav min-width must be 100px (got ${minWidthMatch[1]}px)`);
  // No !important on min-width
  assert.ok(!/min-width:\s*100px\s*!important/.test(decls), '#auth-nav min-width must not be !important (allows page-specific inline min-width to win)');
});

// ── 3. Cached avatar initial size is consistent (no 36px Home override) ──

test('shared-header: .cached-avatar-initial is 32px globally (no Home-only 36px override)', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  // Find the .cached-avatar-initial rule
  const re = /\.cached-avatar-initial\s*\{([^}]*)\}/;
  const m = css.match(re);
  assert.ok(m, 'global-header.css must define .cached-avatar-initial');
  const decls = m[1];
  const wMatch = decls.match(/width:\s*(\d+)px/);
  const hMatch = decls.match(/height:\s*(\d+)px/);
  assert.ok(wMatch, '.cached-avatar-initial must have width');
  assert.ok(hMatch, '.cached-avatar-initial must have height');
  assert.strictEqual(wMatch[1], '32', `.cached-avatar-initial width must be 32px (got ${wMatch[1]}px)`);
  assert.strictEqual(hMatch[1], '32', `.cached-avatar-initial height must be 32px (got ${hMatch[1]}px)`);
});

// ── 4. shared-header.js cache version is consistent across in-scope pages ──

test('shared-header: shared-header.js cache version is consistent across Home/Intro/Search/My Trees/Settings', () => {
  const versions = new Set();
  for (const rel of IN_SCOPE_PAGES) {
    const html = readFile(path.join(ROOT, rel));
    const m = html.match(/shared-header\.js\?v=([\w-]+)/);
    assert.ok(m, `${rel} must include shared-header.js?v=...`);
    versions.add(m[1]);
  }
  assert.strictEqual(versions.size, 1, `shared-header.js version must be the same across all in-scope pages; got ${[...versions].join(', ')}`);
  assert.ok(versions.has(SHARED_HEADER_JS_VERSION), `shared-header.js version must be ${SHARED_HEADER_JS_VERSION}; got ${[...versions][0]}`);
});

// ── 5. Global CSS cache version is consistent across in-scope pages ──

test('shared-header: global.css cache version is consistent across in-scope pages', () => {
  const versions = new Set();
  for (const rel of IN_SCOPE_PAGES) {
    const html = readFile(path.join(ROOT, rel));
    const m = html.match(/global\.css\?v=([\w-]+)/);
    assert.ok(m, `${rel} must include global.css?v=...`);
    versions.add(m[1]);
  }
  assert.strictEqual(versions.size, 1, `global.css version must be the same across all in-scope pages; got ${[...versions].join(', ')}`);
  assert.ok(versions.has(GLOBAL_CSS_VERSION), `global.css version must be ${GLOBAL_CSS_VERSION}; got ${[...versions][0]}`);
});

// ── 6. Index CSS cache version is locked to the shared-header change ──

test('shared-header: index.css cache version is locked (ensures Home picks up the unified header)', () => {
  const html = readFile(path.join(ROOT, 'index.html'));
  const m = html.match(/index\.css\?v=([\w-]+)/);
  assert.ok(m, 'index.html must include index.css?v=...');
  assert.strictEqual(m[1], INDEX_CSS_VERSION, `index.css version must be ${INDEX_CSS_VERSION} (got ${m[1]})`);
});

// ── 7. Header rhythm values (shared-header lock) ──

test('shared-header: .nav-bar mobile min-height is 65px (locked)', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  const re = /@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\.nav-bar\s*\{([^}]*)\}/;
  const m = css.match(re);
  assert.ok(m, 'global-header.css must have @media (max-width:768px) .nav-bar rule');
  const decls = m[1];
  const hMatch = decls.match(/min-height:\s*(\d+)px/);
  assert.ok(hMatch, '.nav-bar mobile min-height must be set');
  assert.strictEqual(hMatch[1], '65', `.nav-bar mobile min-height must be 65px (got ${hMatch[1]}px)`);
});

test('shared-header: .nav-bar desktop min-height is 81px (locked)', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  const re = /\.nav-bar\s*\{([^}]*)\}/;
  const m = css.match(re);
  assert.ok(m, 'global-header.css must define .nav-bar');
  const hMatch = m[1].match(/min-height:\s*(\d+)px/);
  assert.ok(hMatch, '.nav-bar desktop min-height must be set');
  assert.strictEqual(hMatch[1], '81', `.nav-bar desktop min-height must be 81px (got ${hMatch[1]}px)`);
});

test('shared-header: .nav-links a min-height is 36px (consistent nav item height)', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  const re = /\.nav-links a\s*\{([^}]*)\}/;
  const m = css.match(re);
  assert.ok(m, 'global-header.css must define .nav-links a');
  const hMatch = m[1].match(/min-height:\s*(\d+)px/);
  assert.ok(hMatch, '.nav-links a min-height must be set');
  assert.strictEqual(hMatch[1], '36', `.nav-links a min-height must be 36px (got ${hMatch[1]}px)`);
});

// ── 8. Mobile nav toggle is hidden on desktop, visible on mobile ──

test('shared-header: .mobile-nav-toggle is hidden on desktop and shown on mobile', () => {
  const css = readFile(path.join(ROOT, 'css/global/global-header.css'));
  // Base: .mobile-nav-toggle { display: none; }
  const baseRe = /\.mobile-nav-toggle\s*\{([^}]*)\}/;
  const baseMatch = css.match(baseRe);
  assert.ok(baseMatch, '.mobile-nav-toggle base rule must exist');
  assert.match(baseMatch[1], /display:\s*none/, '.mobile-nav-toggle must be display:none on desktop');
  // @media (max-width: 768px): .mobile-nav-toggle { display: inline-flex; }
  const mediaRe = /@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\.mobile-nav-toggle\s*\{([^}]*)\}/;
  const mediaMatch = css.match(mediaRe);
  assert.ok(mediaMatch, '@media (max-width:768px) .mobile-nav-toggle rule must exist');
  assert.match(mediaMatch[1], /display:\s*inline-flex/, '.mobile-nav-toggle must be display:inline-flex on mobile');
});

// ── 9. Scout AI button uses shared header-ai-trigger class (no page-specific override) ──

test('shared-header: Scout AI button uses .header-ai-trigger class (no page override)', () => {
  const js = readFile(path.join(ROOT, 'js/shared-header.js'));
  assert.ok(js.includes('header-ai-trigger'), 'shared-header.js must use .header-ai-trigger class for Scout AI button');
  assert.ok(js.includes('Scout AI'), 'shared-header.js must label the button as "Scout AI"');
  // The mobile nav panel must include the AI button
  assert.ok(js.includes('buildAIPanelTriggerHTML'), 'shared-header.js must build AI panel trigger HTML');
});

// ── 10. Hamburger menu includes Scout AI on mobile (mobile accessibility) ──

test('shared-header: hamburger menu on mobile includes Scout AI button', () => {
  // The AI button is part of the .nav-actions group, which is inside the
  // .main-nav-panel. The mobile nav toggle reveals .main-nav-panel, so the
  // AI button is automatically accessible via the hamburger menu on mobile.
  const js = readFile(path.join(ROOT, 'js/shared-header.js'));
  // Verify that buildAIPanelTriggerHTML is called inside the nav panel
  const panelBlock = js.match(/main-nav-panel[\s\S]*?buildAIPanelTriggerHTML/);
  assert.ok(panelBlock, 'AI trigger HTML must be inside the .main-nav-panel so the hamburger menu reveals it on mobile');
});
