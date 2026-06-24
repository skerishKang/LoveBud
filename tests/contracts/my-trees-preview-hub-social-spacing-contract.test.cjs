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

/* ── My Trees target files ── */
const MY_TREES_SOCIAL_BAR = 'css/my-trees/my-trees-preview-hub/social-bar.css';
const MY_TREES_HUB_MANIFEST = 'css/my-trees/my-trees-preview-hub.css';

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

test('3. My Trees preview hub manifest imports social-bar with correct relative path', () => {
  const manifest = read(MY_TREES_HUB_MANIFEST);
  assert.match(
    manifest,
    /@import\s+url\(["']\.\.\/search\/search-preview-social-bar\.css["']\)/,
    'my-trees-preview-hub.css must import social-bar via ../search/... (one level up from css/my-trees/)'
  );
  assert.doesNotMatch(
    manifest,
    /@import\s+url\(["']\.\.\/\.\.\/search\/search-preview-social-bar\.css["']\)/,
    'my-trees-preview-hub.css must NOT import social-bar via ../../search/... (wrong relative path causes MIME type error)'
  );
});

test('4. My Trees social bar gap matches Browse base value 0.5rem (parity)', () => {
  const browse = read(BROWSE_SOCIAL_BAR);
  const myTrees = read(MY_TREES_SOCIAL_BAR);

  const browseGapMatch = browse.match(/\.preview-social-bar\s*\{[^}]*gap:\s*([^;}]+)/);
  assert.ok(browseGapMatch, 'Browse .preview-social-bar must declare gap');
  const browseGap = browseGapMatch[1].trim();
  assert.strictEqual(browseGap, '0.5rem', 'Browse social bar base gap must be 0.5rem');

  assert.match(
    myTrees,
    /#myTreesHubPanel\s+\.preview-social-shell\[data-my-trees-social-shell\]\s+\.preview-social-bar[^}]*\{[^}]*gap:\s*0\.5rem/,
    'My Trees social bar gap must match Browse base gap 0.5rem'
  );
});

test('5. My Trees social bar has 480px breakpoint parity with Browse (gap 0.38rem)', () => {
  const myTrees = read(MY_TREES_SOCIAL_BAR);

  assert.match(
    myTrees,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?gap:\s*0\.38rem/,
    'My Trees social bar must have @media (max-width:480px) with gap 0.38rem (Browse parity)'
  );

  assert.match(
    myTrees,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?min-height:\s*2\.25rem/,
    'My Trees social action at 480px must have min-height 2.25rem (Browse parity)'
  );

  assert.match(
    myTrees,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?padding-inline:\s*0\.35rem/,
    'My Trees social action at 480px must have padding-inline 0.35rem (Browse parity)'
  );

  assert.match(
    myTrees,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?font-size:\s*0\.68rem/,
    'My Trees social action at 480px must have font-size 0.68rem (Browse parity)'
  );

  assert.match(
    myTrees,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?font-size:\s*0\.95rem/,
    'My Trees social action icon at 480px must have font-size 0.95rem (Browse parity)'
  );
});
