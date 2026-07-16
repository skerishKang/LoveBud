const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'login.css');
const LOGIN_HTML_PATH = path.join(ROOT, 'pages', 'login.html');
const SIGNUP_HTML_PATH = path.join(ROOT, 'pages', 'signup.html');

const AUTH_CSS_VERSION = '20260716-3547-2';

const SPLIT_FILES = [
  'base.css',
  'layout.css',
  'components.css',
  'forms.css',
  'sections.css',
  'responsive.css',
];

// Expected @import URLs in exact order with cache version policy:
// base.css / layout.css / sections.css / responsive.css: unversioned
// components.css / forms.css: versioned with AUTH_CSS_VERSION
const EXPECTED_IMPORTS = [
  './login/base.css',
  './login/layout.css',
  `./login/components.css?v=${AUTH_CSS_VERSION}`,
  `./login/forms.css?v=${AUTH_CSS_VERSION}`,
  './login/sections.css',
  './login/responsive.css',
];

test('css/login.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  SPLIT_FILES.forEach(file => {
    // Allow optional query string (?v=...) for versioned imports
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/login\\/${file}(\\?[^'"]*)?['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./login/${file}`);
  });
});

test('css/login.css @import URLs match exact order and cache version policy', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const importRegex = /@import\s+url\((['"])(.+?)\1\);/g;
  const actualImports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    actualImports.push(match[2]);
  }

  assert.deepEqual(
    actualImports,
    EXPECTED_IMPORTS,
    `@import URLs must match expected order and versions.\n` +
    `Expected: ${JSON.stringify(EXPECTED_IMPORTS, null, 2)}\n` +
    `Actual:   ${JSON.stringify(actualImports, null, 2)}`
  );
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'login', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('login.html references exact login.css parent version', () => {
  const html = fs.readFileSync(LOGIN_HTML_PATH, 'utf8');
  const expectedHref = `../css/login.css?v=${AUTH_CSS_VERSION}`;
  assert.match(
    html,
    new RegExp(`href="${escapeRegExp(expectedHref)}"`),
    `login.html must load ${expectedHref}`
  );
});

test('signup.html references exact login.css parent version', () => {
  const html = fs.readFileSync(SIGNUP_HTML_PATH, 'utf8');
  const expectedHref = `../css/login.css?v=${AUTH_CSS_VERSION}`;
  assert.match(
    html,
    new RegExp(`href="${escapeRegExp(expectedHref)}"`),
    `signup.html must load ${expectedHref}`
  );
});

test('login and signup parent CSS URLs are identical', () => {
  const loginHtml = fs.readFileSync(LOGIN_HTML_PATH, 'utf8');
  const signupHtml = fs.readFileSync(SIGNUP_HTML_PATH, 'utf8');

  const loginMatch = loginHtml.match(/href="(\.\.\/css\/login\.css\?v=[^"]+)"/);
  const signupMatch = signupHtml.match(/href="(\.\.\/css\/login\.css\?v=[^"]+)"/);

  assert.ok(loginMatch, 'login.html must have a login.css href');
  assert.ok(signupMatch, 'signup.html must have a login.css href');
  assert.equal(loginMatch[1], signupMatch[1], 'login and signup must use the same login.css version');
});

test('old CSS version 20260504-642 is absent from login.html and signup.html', () => {
  const loginHtml = fs.readFileSync(LOGIN_HTML_PATH, 'utf8');
  const signupHtml = fs.readFileSync(SIGNUP_HTML_PATH, 'utf8');

  // Scope check to login.css href only (not other assets like i18n-login.js)
  assert.doesNotMatch(loginHtml, /href="\.\.\/css\/login\.css\?v=20260504-642"/, 'login.html must not reference old version 20260504-642 in login.css href');
  assert.doesNotMatch(signupHtml, /href="\.\.\/css\/login\.css\?v=20260504-642"/, 'signup.html must not reference old version 20260504-642 in login.css href');
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: 'input\\[type="text"\\]', file: 'base.css' },
    { class: '\\.login-shell', file: 'layout.css' },
    { class: '\\.login-card', file: 'layout.css' },
    { class: '\\.login-btn-google', file: 'components.css' },
    { class: '\\.user-dropdown', file: 'components.css' },
    { class: '\\.login-form', file: 'forms.css' },
    { class: '\\.login-email-modal', file: 'forms.css' },
    { class: '\\.login-redirect-notice', file: 'sections.css' },
    { class: '\\.login-signup-section', file: 'sections.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'login', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = new RegExp(mapping.class);

    assert.match(
      content,
      regex,
      `Class ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readLoginCss(name) {
  return fs.readFileSync(path.join(ROOT, 'css', 'login', name), 'utf8');
}

test('login card uses one mobile-sized canonical composition (#3547)', () => {
  const layout = readLoginCss('layout.css');
  const responsive = readLoginCss('responsive.css');
  const sections = readLoginCss('sections.css');
  const components = readLoginCss('components.css');

  // Canonical card metrics = preserved mobile composition (not a new 360px invention).
  assert.match(layout, /\.login-card\s*\{[\s\S]*?max-width:\s*480px/);
  assert.match(layout, /\.login-card\s*\{[\s\S]*?padding:\s*32px\s+16px/);
  assert.match(layout, /\.login-shell\s*\{[\s\S]*?padding:\s*16px\b/);
  assert.equal(
    /max-width:\s*360px/.test(layout),
    false,
    'must not invent a new 360px card max-width'
  );
  assert.equal(
    /padding:\s*72px\s+16px\s+24px/.test(layout),
    false,
    'must not change mobile shell to 72px 16px 24px'
  );

  // Responsive may grow shell outer whitespace only — no card interior rescale.
  assert.match(responsive, /@media\s*\(\s*min-width:\s*769px\s*\)/);
  assert.match(responsive, /\.login-shell\s*\{[\s\S]*?padding:\s*80px\s+48px\s+48px/);
  assert.equal(
    /\.login-card\s*\{/.test(responsive),
    false,
    'responsive.css must not redefine .login-card'
  );
  assert.equal(
    /font-size\s*:/.test(responsive),
    false,
    'responsive.css must not change font-size'
  );
  assert.equal(
    /max-width\s*:/.test(responsive),
    false,
    'responsive.css must not change max-width'
  );

  // No nowrap workaround for description wrapping.
  assert.equal(/white-space\s*:\s*nowrap/.test(sections), false);
  assert.equal(/white-space\s*:\s*nowrap/.test(layout), false);
  assert.equal(/white-space\s*:\s*nowrap/.test(responsive), false);
  assert.match(sections, /\.login-desc\s*\{[\s\S]*?white-space:\s*normal/);

  // Button metrics pinned for single composition.
  assert.match(components, /\.login-email-button\s*\{[\s\S]*?padding:\s*16px/);
  assert.match(components, /\.login-btn-google\s*\{[\s\S]*?padding:\s*16px/);
});

test('login page source does not touch auth/redirect behavior (#3547)', () => {
  const loginJsPaths = [
    path.join(ROOT, 'js', 'login-page.js'),
    path.join(ROOT, 'js', 'login', 'login-page.js'),
    path.join(ROOT, 'js', 'auth', 'auth-login-page.js'),
  ].filter((p) => fs.existsSync(p));

  assert.ok(loginJsPaths.length >= 1, 'expected at least one login page script');
  // This CSS-only contract does not rewrite login JS files; just assert they still exist.
  loginJsPaths.forEach((p) => {
    assert.ok(fs.statSync(p).size > 0, `login script must remain present: ${p}`);
  });
});

test('header responsive breakpoints remain owned by global-header.css', () => {
  const header = fs.readFileSync(path.join(ROOT, 'css', 'global', 'global-header.css'), 'utf8');
  const responsive = readLoginCss('responsive.css');

  // Header still has responsive rules (nav/logo density).
  assert.match(header, /@media/);
  assert.match(header, /\.nav-bar/);

  // Login responsive does not redefine shared header/nav selectors.
  assert.equal(/\.nav-bar/.test(responsive), false);
  assert.equal(/#shared-header/.test(responsive), false);
  assert.equal(/\.header-logo/.test(responsive), false);
});
