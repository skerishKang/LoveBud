const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function normalizeScriptSrc(src) {
  return src
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/|\.\.\/)+/, '');
}

function getScriptSrcs(htmlRelativePath) {
  const html = readRepoFile(htmlRelativePath);
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi))
    .map((match) => normalizeScriptSrc(match[1]));
}

function findScriptIndex(scripts, expected) {
  const normalizedExpected = normalizeScriptSrc(expected);
  return scripts.findIndex((src) => src === normalizedExpected || src.endsWith(normalizedExpected));
}

function assertHasScript(scripts, htmlRelativePath, expected) {
  const index = findScriptIndex(scripts, expected);
  assert.notEqual(index, -1, `${htmlRelativePath} must load ${expected}`);
  return index;
}

function assertOrderedScripts(htmlRelativePath, expectedScripts) {
  const scripts = getScriptSrcs(htmlRelativePath);
  let previousIndex = -1;

  for (const expected of expectedScripts) {
    const index = assertHasScript(scripts, htmlRelativePath, expected);
    assert.ok(
      index > previousIndex,
      `${htmlRelativePath} must load ${expected} after ${scripts[previousIndex] || 'the previous auth dependency'}`
    );
    previousIndex = index;
  }
}

function assertIncludesAny(source, label, needles) {
  assert.ok(
    needles.some((needle) => source.includes(needle)),
    `expected ${label} contract in source`
  );
}

const AUTH_MODULE_ORDER = [
  'js/auth/auth-state.js',
  'js/auth/auth-callbacks.js',
  'js/auth/auth-cache.js',
  'js/auth/auth-ui.js',
  'js/auth/auth-session.js',
  'js/auth/auth-firebase.js',
];

const LOGIN_CONTROLLER_LOAD_ORDER = [
  ...AUTH_MODULE_ORDER,
  'js/login/login-dom.js',
  'js/login/login-page.js',
  'js/auth/auth-login-page.js',
];

const AUTH_MODULE_ORDER_WITH_LOGIN_PAGE = [
  ...AUTH_MODULE_ORDER,
  'js/auth/auth-login-page.js',
];

test('login page preserves firebase/config/i18n/shared-header before auth submodules and root auth.js', () => {
  assertOrderedScripts('pages/login.html', [
    'firebase-app.js',
    'firebase-auth.js',
    'js/firebase-config.js',
    'js/i18n/i18n-core.js',
    'js/i18n.js',
    'js/shared-header.js',
    ...LOGIN_CONTROLLER_LOAD_ORDER,
    'js/auth.js',
    'js/login-page.js',
  ]);
});

test('my-trees page preserves auth submodule bootstrap order', () => {
  assertOrderedScripts('pages/my-trees.html', [
    'js/shared-header.js',
    ...AUTH_MODULE_ORDER_WITH_LOGIN_PAGE,
    'js/auth.js',
  ]);
});

test('editor page preserves auth submodule bootstrap order and current editor-before-auth boundary', () => {
  const scripts = getScriptSrcs('pages/editor.html');
  const editorRuntimeIndex = assertHasScript(scripts, 'pages/editor.html', 'js/editor.js');
  const firstAuthModuleIndex = assertHasScript(scripts, 'pages/editor.html', 'js/auth/auth-state.js');

  assert.ok(
    editorRuntimeIndex < firstAuthModuleIndex,
    'pages/editor.html currently loads editor runtime before auth bootstrap; keep this boundary explicit until intentionally redesigned'
  );

  assertOrderedScripts('pages/editor.html', [
    'js/shared-header.js',
    ...AUTH_MODULE_ORDER,
    'js/auth.js',
  ]);
});

test('settings page preserves auth submodules, root auth.js, then settings.js order', () => {
  assertOrderedScripts('pages/settings.html', [
    'js/shared-header.js',
    ...AUTH_MODULE_ORDER,
    'js/auth.js',
    'js/settings.js',
  ]);

  const source = readRepoFile('pages/settings.html');
  assert.match(
    source,
    /onclick\s*=\s*["']handleLogout\s*\(\s*\)["']/i,
    'settings.html currently has inline handleLogout(); observe only and do not clean it up in this auth contract PR'
  );
});

test('shared header keeps optional/idempotent initAuth handoff after dynamic auth container render', () => {
  const source = readRepoFile('js/shared-header.js');

  assert.match(source, /typeof\s+window\.initAuth\s*===\s*["']function["']/, 'shared header must guard initAuth as optional');
  assert.match(source, /window\.initAuth\s*\(\s*\)/, 'shared header must call initAuth after dynamic render when available');
  assert.match(source, /try\s*{[\s\S]*window\.initAuth\s*\(\s*\)[\s\S]*}\s*catch\s*\(/, 'shared header initAuth handoff must not hard-fail the page on auth bootstrap error');
  assert.match(source, /auth-nav-container/, 'shared header must preserve login-page auth container contract');
  assert.match(source, /auth-nav/, 'shared header must preserve non-login auth nav container contract');
  assert.match(source, /lovebud_auth_cache/, 'shared header must keep confirmed cached avatar key');
  assert.match(source, /lovebud_auth_confirmed/, 'shared header must keep confirmed session flag key');
});

test('root auth bootstrap exposes compatibility window APIs and flags', () => {
  const source = readRepoFile('js/auth.js');

  const contracts = [
    { label: 'window.initAuth', needles: ['window.initAuth'] },
    { label: 'window.registerOnAuthReady', needles: ['window.registerOnAuthReady'] },
    { label: 'window.signOut', needles: ['window.signOut'] },
    { label: 'window.signInWithGoogle', needles: ['window.signInWithGoogle'] },
    { label: 'window.getBasePath', needles: ['window.getBasePath'] },
    { label: 'window.__lovebudAuthReady', needles: ['window.__lovebudAuthReady', "'__lovebudAuthReady'", '"__lovebudAuthReady"'] },
    { label: 'window.__lovebudAuthInitialized', needles: ['window.__lovebudAuthInitialized', "'__lovebudAuthInitialized'", '"__lovebudAuthInitialized"'] },
    { label: 'window.__lastAuthUser', needles: ['window.__lastAuthUser'] },
    { label: 'window.LoveBudAuthBootstrap', needles: ['window.LoveBudAuthBootstrap'] },
  ];

  for (const contract of contracts) {
    assertIncludesAny(source, contract.label, contract.needles);
  }
});

test('root auth delegates login page helpers through method-aware provider selection', () => {
  const source = readRepoFile('js/auth.js');

  assert.match(source, /window\.LoveBudLoginPageController/, 'root auth must reference LoveBudLoginPageController as primary active provider');
  assert.match(source, /window\.LoveBudAuthLoginPage/, 'root auth must keep LoveBudAuthLoginPage as compatibility/fallback namespace');
  assert.match(source, /function\s+getLoginPageModule\s*\(/, 'root auth must keep a thin login page module lookup helper');
  assert.match(source, /function\s+callLoginPageModule\s*\(/, 'root auth must keep a thin login page module call helper');
  assert.match(source, /EMAIL_AUTH_EXECUTION_METHODS/, 'root auth must define method-to-auth-provider mapping for method-aware selection');
  assert.match(source, /setupEmailAuthForm[\s\S]*setupSignupForm|setupSignupForm[\s\S]*setupEmailAuthForm/, 'method mapping must include setupEmailAuthForm and setupSignupForm');

  for (const methodName of [
    'syncEmailAuthModeUi',
    'setupLoginPageAuthUi',
    'setupGoogleBtn',
    'setupEmailAuthForm',
    'setupSignupForm',
    'setupSignupGoogleBtn',
  ]) {
    assert.match(
      source,
      new RegExp(`callLoginPageModule\\(\\s*['"]${methodName}['"]`),
      `root auth must delegate ${methodName} when active login page module exposes it`
    );
  }
});

test('root auth uses LoveBudAuthLoginPage directly for email auth execution methods', () => {
  const source = readRepoFile('js/auth.js');

  assert.match(
    source,
    /EMAIL_AUTH_EXECUTION_METHODS\s*=\s*\{[\s\S]*setupEmailAuthForm[\s\S]*\}/,
    'setupEmailAuthForm must be in the email auth execution methods map'
  );
  assert.match(
    source,
    /EMAIL_AUTH_EXECUTION_METHODS\s*=\s*\{[\s\S]*setupSignupForm[\s\S]*\}/,
    'setupSignupForm must be in the email auth execution methods map'
  );
  assert.match(
    source,
    /getLoginPageModule\(methodName\)[\s\S]*EMAIL_AUTH_EXECUTION_METHODS\[methodName\][\s\S]*LoveBudAuthLoginPage/,
    'auth execution methods must bypass LoveBudLoginPageController and use LoveBudAuthLoginPage directly'
  );
  assert.match(
    source,
    /EMAIL_AUTH_EXECUTION_METHODS\[methodName\][\s\S]*LoveBudLoginPageController/,
    'UI methods must use LoveBudLoginPageController when available'
  );
});

test('root auth preserves LoveBudLoginPageController as primary for UI-only methods', () => {
  const source = readRepoFile('js/auth.js');

  for (const methodName of [
    'syncEmailAuthModeUi',
    'setupLoginPageAuthUi',
    'setupGoogleBtn',
    'setupSignupGoogleBtn',
  ]) {
    assert.match(
      source,
      new RegExp(`'${methodName}'`),
      `root auth must reference ${methodName} in login page delegation`
    );
  }
});

test('auth firebase fallback keeps protected-route-aware offline behavior', () => {
  const source = readRepoFile('js/auth/auth-firebase.js');

  assert.match(source, /function\s+isProtectedRoute\s*\(/, 'auth-firebase must keep protected-route detection helper');
  assert.match(source, /my-trees\|editor\|settings/, 'protected route detection must include my-trees, editor, and settings');
  assert.match(
    source,
    /var\s+user\s*=\s*!isProtectedRoute\s*\(\s*\)\s*&&\s*cachedUser\s*&&\s*cachedUser\.uid\s*\?\s*cachedUser\s*:\s*null/,
    'offline fallback must not unlock protected routes using cached user only'
  );
  assert.match(source, /Firebase SDK not loaded/, 'auth-firebase must keep Firebase unavailable fallback path');
  assert.match(source, /initOfflineAuth/, 'auth-firebase must keep offline auth fallback logic');
});

test('auth UI logout uses delegated data attribute and blocks inline signOut onclick regression', () => {
  const source = readRepoFile('js/auth/auth-ui.js');

  assert.match(source, /data-auth-action=\\?["']logout\\?["']/, 'logout control must keep delegated data-auth-action contract');
  assert.match(source, /closest\(\s*["']\[data-auth-action=\\?["']logout\\?["']\]["']\s*\)/, 'auth-ui must keep delegated logout click handling');
  assert.doesNotMatch(source, /onclick\s*=\s*\\?["']signOut\s*\(\s*\)\\?["']/i, 'auth-ui must not reintroduce inline onclick="signOut()"');
});