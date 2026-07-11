const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'login.css');
const LOGIN_HTML_PATH = path.join(ROOT, 'pages', 'login.html');
const SIGNUP_HTML_PATH = path.join(ROOT, 'pages', 'signup.html');

const AUTH_CSS_VERSION = '20260712-3451-1';

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
