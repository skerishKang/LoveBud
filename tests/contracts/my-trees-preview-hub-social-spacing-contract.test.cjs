'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/* ── Browse source of truth ── */
const BROWSE_SOCIAL_BAR = 'css/search/search-preview-social-bar.css';

/* ── My Trees target file ── */
const MY_TREES_SOCIAL_BAR = 'css/my-trees/my-trees-preview-hub/social-bar.css';

test('1. Browse social shell has top spacing and border-top separator', () => {
  const css = read(BROWSE_SOCIAL_BAR);

  assert.match(css, /\.preview-social-shell\s*\{[^}]*margin-top:\s*1rem;?/, 'Browse .preview-social-shell must have margin-top: 1rem');
  assert.match(css, /\.preview-social-shell\s*\{[^}]*padding-top:\s*0\.95rem;?/, 'Browse .preview-social-shell must have padding-top: 0.95rem');
  assert.match(css, /\.preview-social-shell\s*\{[^}]*border-top:\s*1px\s+solid\s+var\(--outline-variant\);?/, 'Browse .preview-social-shell must have border-top: 1px solid var(--outline-variant)');
});

test('2. My Trees social shell mirrors Browse spacing and border-top', () => {
  const css = read(MY_TREES_SOCIAL_BAR);

  /* Multi-line selector: the rule lists both attribute and class forms on
     separate lines, so we allow any characters (including newlines) between
     the selector and the opening brace. */
  assert.match(
    css,
    /#myTreesHubPanel\s+\.preview-social-shell\[data-my-trees-social-shell\][^]*?\{[^}]*margin-top:\s*1rem;?/,
    'My Trees .preview-social-shell must have margin-top: 1rem'
  );
  assert.match(
    css,
    /#myTreesHubPanel\s+\.preview-social-shell\[data-my-trees-social-shell\][^]*?\{[^}]*padding-top:\s*0\.95rem;?/,
    'My Trees .preview-social-shell must have padding-top: 0.95rem'
  );
  assert.match(
    css,
    /#myTreesHubPanel\s+\.preview-social-shell\[data-my-trees-social-shell\][^]*?\{[^}]*border-top:\s*1px\s+solid\s+var\(--outline-variant\);?/,
    'My Trees .preview-social-shell must have border-top: 1px solid var(--outline-variant)'
  );
});
