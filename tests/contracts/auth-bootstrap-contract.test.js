const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

function assertOrderedScripts(htmlRelativePath, expectedScripts) {
  const scripts = getScriptSrcs(htmlRelativePath);
  let previousIndex = -1;

  for (const expected of expectedScripts) {
    const index = scripts.findIndex((src) => src === expected || src.endsWith(expected));
    assert.notEqual(index, -1, `${htmlRelativePath} must load ${expected}`);
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

test('my-trees page preserves auth submodule bootstrap order', () => {
  assertOrderedScripts('pages/my-trees.html', [
    ...AUTH_MODULE_ORDER,
    'js/auth/auth-login-page.js',
    'js/auth.js',
  ]);
});

test('editor page preserves auth submodule bootstrap order', () => {
  assertOrderedScripts('pages/editor.html', [
    ...AUTH_MODULE_ORDER,
    'js/auth.js',
  ]);
});

test('settings page preserves auth submodule bootstrap order', () => {
  assertOrderedScripts('pages/settings.html', [
    ...AUTH_MODULE_ORDER,
    'js/auth.js',
  ]);
});

test('login page preserves current auth bootstrap order without auth-login-page module', () => {
  assertOrderedScripts('pages/login.html', [
    ...AUTH_MODULE_ORDER,
    'js/auth.js',
    'js/login-page.js',
  ]);

  const scripts = getScriptSrcs('pages/login.html');
  assert.equal(
    scripts.some((src) => src === 'js/auth/auth-login-page.js' || src.endsWith('js/auth/auth-login-page.js')),
    false,
    'login.html currently does not load js/auth/auth-login-page.js; keep this documented until intentionally changed'
  );
});

test('shared header keeps auth container and idempotent initAuth contracts', () => {
  const source = readRepoFile('js/shared-header.js');

  assert.match(source, /typeof\s+window\.initAuth\s*===\s*["']function["']/, 'shared header must guard initAuth as optional');
  assert.match(source, /window\.initAuth\s*\(\s*\)/, 'shared header must call initAuth after dynamic render when available');
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

test('auth UI logout uses delegated data attribute and no inline signOut onclick', () => {
  const source = readRepoFile('js/auth/auth-ui.js');

  assert.match(source, /data-auth-action=["']logout["']/, 'logout control must keep delegated data-auth-action contract');
  assert.doesNotMatch(source, /onclick\s*=\s*["']signOut\s*\(\s*\)["']/i, 'auth-ui must not reintroduce inline onclick="signOut()"');
});

test('settings inline logout is documented as a non-blocking follow-up cleanup candidate', () => {
  const source = readRepoFile('pages/settings.html');
  const hasInlineSettingsLogout = /onclick\s*=\s*["']handleLogout\s*\(\s*\)["']/i.test(source);

  // Current main may still keep a page-local inline handleLogout in settings.html.
  // That is a follow-up CSP cleanup candidate, not an auth bootstrap blocker.
  if (hasInlineSettingsLogout) {
    assert.match(source, /js\/settings\.js/, 'settings inline logout should remain page-local while it exists');
  } else {
    assert.equal(hasInlineSettingsLogout, false);
  }
});
