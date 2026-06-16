/**
 * Shared Header Alignment Invariants Contract Tests
 * v20260617-1
 *
 * Locks the shared header logo/nav alignment and CSS metrics across main pages.
 *
 * Slice issue: #2583
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CSS_PATH = path.join(ROOT, 'css/global/global-header.css');
const JS_PATH = path.join(ROOT, 'js/shared-header.js');

const PAGES = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'pages/intro.html'),
  path.join(ROOT, 'pages/search.html'),
  path.join(ROOT, 'pages/my-trees.html'),
  path.join(ROOT, 'pages/settings.html'),
];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

const cssContent = readFile(CSS_PATH);
const jsContent = readFile(JS_PATH);

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── shared-header.js and page markup checks ───────────────────────────────

push('shared-header.js generates the nav-bar header tag', () => {
  assert.ok(
    jsContent.includes('<header class="nav-bar">'),
    'shared-header.js must generate <header class="nav-bar">',
  );
});

push('Main pages use #shared-header and do not duplicate raw header tag', () => {
  for (const pagePath of PAGES) {
    const content = readFile(pagePath);
    assert.ok(
      content.includes('id="shared-header"'),
      `${path.basename(pagePath)} must include id="shared-header"`,
    );
    // Ensure no raw duplicate <header class="nav-bar"> tag in the HTML itself
    assert.ok(
      !content.includes('<header class="nav-bar">'),
      `${path.basename(pagePath)} must not duplicate raw <header class="nav-bar"> markup`,
    );
  }
});

// ─── CSS Invariants: #shared-header & .nav-bar ─────────────────────────────

push('#shared-header has full-width layout protection and min-height', () => {
  assert.ok(
    cssContent.includes('width: 100%'),
    '#shared-header must specify width: 100%',
  );
  assert.ok(
    cssContent.includes('box-sizing: border-box'),
    '#shared-header must specify box-sizing: border-box',
  );
  assert.ok(
    cssContent.includes('flex: 0 0 auto'),
    '#shared-header must specify flex: 0 0 auto',
  );
  assert.ok(
    cssContent.includes('min-height: 81px'),
    '#shared-header must preserve desktop min-height: 81px',
  );
});

push('.nav-bar specifies desktop min-height', () => {
  assert.ok(
    cssContent.includes('min-height: 81px'),
    '.nav-bar must specify min-height: 81px to prevent CLS and preserve height invariants',
  );
});

push('.nav-bar specifies mobile min-height', () => {
  assert.ok(
    cssContent.includes('min-height: 65px'),
    '.nav-bar must specify mobile min-height: 65px in max-width: 768px media query',
  );
});

// ─── CSS Invariants: Nav Link Box Metrics ──────────────────────────────────

push('Nav links (.nav-links a) use inline-flex centering and min-height 36px', () => {
  assert.ok(
    cssContent.includes('display: inline-flex'),
    '.nav-links a must use inline-flex',
  );
  assert.ok(
    cssContent.includes('align-items: center'),
    '.nav-links a must use align-items: center',
  );
  assert.ok(
    cssContent.includes('justify-content: center'),
    '.nav-links a must use justify-content: center',
  );
  assert.ok(
    cssContent.includes('min-height: 36px'),
    '.nav-links a must have min-height: 36px',
  );
  assert.ok(
    cssContent.includes('padding: 0 16px'),
    '.nav-links a must have padding: 0 16px (not top/bottom padding)',
  );
  assert.ok(
    cssContent.includes('box-sizing: border-box'),
    '.nav-links a must specify box-sizing: border-box',
  );
});

push('Nav highlight (.nav-links a.nav-highlight) box metrics match nav links', () => {
  assert.ok(
    cssContent.includes('min-height: 36px'),
    '.nav-links a.nav-highlight must have min-height: 36px',
  );
  assert.ok(
    cssContent.includes('padding: 0 16px'),
    '.nav-links a.nav-highlight must have padding: 0 16px',
  );
  assert.ok(
    cssContent.includes('margin: 0'),
    '.nav-links a.nav-highlight must have margin: 0 to match alignment',
  );
  assert.ok(
    cssContent.includes('box-sizing: border-box'),
    '.nav-links a.nav-highlight must specify box-sizing: border-box',
  );
});

push('Active states do not increase font-weight to prevent layout shift', () => {
  const activeSelectors = cssContent.match(/\.nav-links a\.active\s*\{([^}]+)\}/g) || [];
  for (const selectorBlock of activeSelectors) {
    if (selectorBlock.includes('font-weight')) {
      assert.ok(
        selectorBlock.includes('font-weight: 600'),
        'active selector must restrict font-weight to 600 to prevent layout shift',
      );
    }
  }
});

// ─── Media Query Constraints ───────────────────────────────────────────────

push('Nav links in responsive media query override padding and margin cleanly', () => {
  // Check (min-width: 769px) and (max-width: 1360px) overrides
  assert.ok(
    cssContent.includes('padding: 0 10px;'),
    'media query must normalize nav link padding to 0 10px',
  );
  assert.ok(
    cssContent.includes('margin: 0;'),
    'media query must override nav-highlight margin to 0',
  );
});

(async () => {
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✓ ' + t.name);
      passed++;
    } catch (err) {
      console.log('  ✗ ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
