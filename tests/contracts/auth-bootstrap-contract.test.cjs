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
    firstAuthModuleIndex < editorRuntimeIndex,
    'pages/editor.html currently loads auth bootstrap before editor runtime'
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
  const callbacksSource = readRepoFile('js/auth/auth-callbacks.js');
  const compatibilitySource = `${source}\n${callbacksSource}`;

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
    assertIncludesAny(compatibilitySource, contract.label, contract.needles);
  }

  assert.match(
    callbacksSource,
    /createAuthReadyCallbackBridge/,
    'auth callbacks helper must expose the auth-ready compatibility bridge'
  );
  assert.match(
    source,
    /createAuthReadyCallbackBridge\s*\(/,
    'root auth must create the auth-ready callback bridge from LoveBudAuthCallbacks'
  );
  assert.match(
    source,
    /window\.registerOnAuthReady\s*=\s*function\s*\(callback\)\s*\{[\s\S]*__authReadyCallbackBridge\.registerOnAuthReady\(callback\)/,
    'root auth must keep the public registerOnAuthReady export delegated through the bridge'
  );
});

test('root auth delegates login page helpers through method-aware provider selection', () => {
  const source = readRepoFile('js/auth.js');
  const loginPageSource = readRepoFile('js/auth/auth-login-page.js');

  assert.match(source, /window\.LoveBudAuthLoginPage/, 'root auth must keep LoveBudAuthLoginPage as compatibility/fallback namespace');
  assert.match(source, /function\s+callLoginPageModule\s*\(/, 'root auth must keep a thin login page module call helper');
  assert.match(loginPageSource, /window\.LoveBudLoginPageController/, 'login page boundary must reference LoveBudLoginPageController as primary active provider');
  assert.match(loginPageSource, /window\.LoveBudAuthLoginPage/, 'login page boundary must keep LoveBudAuthLoginPage as compatibility/fallback namespace');
  assert.match(loginPageSource, /function\s+getLoginPageModule\s*\(/, 'login page boundary must own module lookup helper');
  assert.match(loginPageSource, /function\s+callLoginPageModule\s*\(/, 'login page boundary must own module call helper');
  assert.match(loginPageSource, /EMAIL_AUTH_EXECUTION_METHODS/, 'login page boundary must define method-to-auth-provider mapping');
  assert.match(loginPageSource, /setupEmailAuthForm[\s\S]*setupSignupForm|setupSignupForm[\s\S]*setupEmailAuthForm/, 'method mapping must include setupEmailAuthForm and setupSignupForm');

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
  const source = readRepoFile('js/auth/auth-login-page.js');

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

test('root auth delegates protected route bridge through auth firebase boundary', () => {
  const source = readRepoFile('js/auth.js');
  const firebaseSource = readRepoFile('js/auth/auth-firebase.js');

  assert.match(
    firebaseSource,
    /createProtectedRouteBridge/,
    'auth firebase boundary must expose protected route bridge factory'
  );
  assert.match(
    source,
    /__authProtectedRouteBridge/,
    'root auth must keep a protected route bridge handle'
  );
  assert.match(
    source,
    /createProtectedRouteBridge\s*\(/,
    'root auth must create the protected route bridge from LoveBudAuthFirebase'
  );
  assert.match(
    firebaseSource,
    /signInWithGoogle[\s\S]*persistConfirmedAuthSession[\s\S]*preloadRedirectTargetData[\s\S]*getRedirectTarget/,
    'protected route bridge must preserve login session, preload, and redirect dependencies'
  );
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

test('login page redirects confirmed authenticated users away from login state', () => {
  const source = readRepoFile('js/auth/auth-firebase.js');
  const session = readRepoFile('js/auth/auth-session.js');
  const loginPage = readRepoFile('js/auth/auth-login-page.js');

  assert.match(source, /user\s*&&\s*typeof\s+isLoginPage\s*===\s*'function'\s*&&\s*isLoginPage\(\)/, 'auth-firebase must detect signed-in login-page state');
  assert.match(source, /window\.location\.replace\(typeof getRedirectTarget === 'function' \? getRedirectTarget\(\) : 'my-trees\.html'\)/, 'signed-in login page must redirect to the resolved auth target');
  // auth-session.js: raw search parsing for nested query preservation
  assert.match(session, /var\s+rawSearch\s*=\s*window\.location\.search/, 'auth-session must read raw location.search for nested query support');
  assert.match(session, /function\s+extractParam/, 'auth-session must provide raw query parameter extractor');
  assert.match(session, /returnToResult\.found/, 'auth-session must distinguish returnTo presence from value');
  assert.match(session, /new\s+URL\s*\(\s*rawTarget\s*,\s*window\.location\.origin\s*\)/, 'auth-session must normalize target URL against current origin');
  assert.match(session, /parsed\.origin\s*!==\s*window\.location\.origin/, 'auth-session must validate same-origin target');
  assert.match(session, /my-trees\.html/, 'auth-session must fallback to My Trees on invalid or cross-origin target');
  assert.match(session, /canonicalizeRoute/, 'auth-session must canonicalize legacy routes before URL validation');
  // login-page auth observer delegates to session module for redirect target resolution
  assert.match(loginPage, /LoveBudAuthSession\.getRedirectTarget\(\)/, 'login-page auth observer must delegate to auth-session for redirect target');
  assert.match(loginPage, /return\s+'my-trees\.html'/, 'login-page fallback when session module unavailable must be my-trees.html');
  // resolveLoginRedirectTarget must not use URLSearchParams for target resolution
  assert.match(loginPage, /function\s+resolveLoginRedirectTarget/, 'login-page must have resolveLoginRedirectTarget function');
});

test('settings page uses protected route helper and stable returnTo login target', () => {
  const source = readRepoFile('js/settings.js');

  assert.match(source, /LoveBudProtectedRoute\.requireAuthenticatedPage/, 'settings must use protected-route helper when available');
  assert.match(source, /allowCachedUser:\s*false/, 'settings must not unlock from stale confirmed cache alone');
  assert.match(source, /onAuthenticated:\s*startSettings/, 'settings authenticated path must start settings content');
  assert.match(source, /onUnauthenticated:\s*recoverSettingsAuthOrRedirect/, 'settings unauthenticated path must recover live auth before redirecting');
  assert.match(source, /function\s+waitForRecoverableAuthUser\s*\(/, 'settings must have a bounded live-auth recovery path for returnTo after login');
  assert.match(source, /firebase\.auth\(\)\.currentUser/, 'settings recovery must check live Firebase currentUser');
  assert.match(source, /firebase\.auth\(\)\.onAuthStateChanged/, 'settings recovery must wait for the live Firebase auth observer before redirecting');
  assert.match(source, /SETTINGS_AUTH_RECOVERY_TIMEOUT_MS/, 'settings live-auth recovery must be bounded');
  assert.match(source, /startSettings\(user\)/, 'settings recovery must start settings after live authenticated user is observed');
  assert.match(source, /return 'login\.html\?returnTo='/, 'settings login redirect must use stable returnTo target');
  assert.doesNotMatch(source, /login\.html\?redirect=/, 'settings must not use legacy redirect query for protected-route login target');
  assert.doesNotMatch(source, /allowCachedUser:\s*true/, 'settings must not fix the returnTo loop by unlocking from cached auth alone');
});

test('auth UI logout uses delegated data attribute and blocks inline signOut onclick regression', () => {
  const source = readRepoFile('js/auth/auth-ui.js');

  assert.match(source, /data-auth-action=\\?["']logout\\?["']/, 'logout control must keep delegated data-auth-action contract');
  assert.match(source, /closest\(\s*["']\[data-auth-action=\\?["']logout\\?["']\]["']\s*\)/, 'auth-ui must keep delegated logout click handling');
  assert.doesNotMatch(source, /onclick\s*=\s*\\?["']signOut\s*\(\s*\)\\?["']/i, 'auth-ui must not reintroduce inline onclick="signOut()"');
});

test('getRedirectTarget canonicalizes legacy routes, preserves pages paths, and blocks unsafe/login-loop targets', () => {
  const vm = require('node:vm');
  const sessionSource = readRepoFile('js/auth/auth-session.js');

  function runWithParams(search) {
    const sandbox = {
      URLSearchParams: URLSearchParams,
      URL: URL,
      RegExp: RegExp,
      decodeURIComponent: decodeURIComponent,
      window: {
        location: {
          search: search || '',
          origin: 'http://localhost'
        },
        LoveBudAuthSession: {}
      },
      console: console,
    };
    vm.runInNewContext(sessionSource, sandbox);
    return sandbox.window.LoveBudAuthSession.getRedirectTarget();
  }

  const redirectScenarios = [
    // Bare route → /pages/<route>
    ['bare my-trees', '?redirect=my-trees', '/pages/my-trees'],
    ['bare search', '?redirect=search', '/pages/search'],
    ['bare intro', '?redirect=intro', '/pages/intro'],
    ['bare detail', '?redirect=detail', '/pages/detail'],
    ['bare editor', '?redirect=editor', '/pages/editor'],
    ['bare settings', '?redirect=settings', '/pages/settings'],

    // pages/<route> without leading slash → /pages/<route>
    ['pages/editor without leading slash', '?returnTo=pages/editor?treeId=t1', '/pages/editor?treeId=t1'],

    // /pages/<route> preserved as-is
    ['pages/editor with leading slash', '?returnTo=/pages/editor?treeId=t1', '/pages/editor?treeId=t1'],

    // Nested query preserved through canonicalization
    ['nested query encoded', '?redirect=editor%3FtreeId%3Dt1%26memoryId%3Dm1', '/pages/editor?treeId=t1&memoryId=m1'],
    // Non-encoded bare route with simple query
    ['non-encoded bare route with query', '?redirect=editor?treeId=t1', '/pages/editor?treeId=t1'],

    // returnTo wins over redirect
    ['returnTo wins over redirect', '?returnTo=/pages/settings&redirect=my-trees', '/pages/settings'],

    // .html legacy form → /pages/<route>
    ['legacy my-trees.html', '?redirect=my-trees.html', '/pages/my-trees'],
    ['legacy search.html', '?redirect=search.html', '/pages/search'],
    ['legacy detail.html with query', '?redirect=detail.html?treeId=t1', '/pages/detail?treeId=t1'],

    // External/unsafe targets → default fallback
    ['https external target blocked', '?redirect=https://evil.example', 'my-trees.html'],
    ['protocol-relative external blocked', '?redirect=//evil.example', 'my-trees.html'],
    ['javascript: URI blocked', '?redirect=javascript:alert(1)', 'my-trees.html'],
    ['data: URI blocked', '?redirect=data:text/html,<script>alert(1)</script>', 'my-trees.html'],

    // Login loop prevention → default fallback
    ['login bare blocked', '?redirect=login', 'my-trees.html'],
    ['login.html legacy blocked', '?redirect=login.html', 'my-trees.html'],
    ['/pages/login blocked', '?redirect=/pages/login', 'my-trees.html'],

    // No params → default fallback
    ['empty search fallback', '', 'my-trees.html'],
  ];

  for (const [name, search, expected] of redirectScenarios) {
    const actual = runWithParams(search);
    assert.equal(actual, expected, `${name} (search=${JSON.stringify(search)}): expected ${expected}, got ${actual}`);
  }
});

test('signInWithGoogle success popup sets canonical href and activates editor preload with canonical redirect', async () => {
  const vm = require('node:vm');
  const sessionSource = readRepoFile('js/auth/auth-session.js');
  const firebaseSource = readRepoFile('js/auth/auth-firebase.js');

  async function runSignInFlow(search) {
    const store = {};
    const sandbox = {
      Object, Array, String, Number, Boolean, Promise, JSON, Math, Date, RegExp,
      Error, TypeError, RangeError, parseInt, parseFloat, isNaN,
      setTimeout, clearTimeout, setInterval, clearInterval, decodeURIComponent,
      URL, URLSearchParams, console,
      alert: function () {},
      navigator: { userAgent: 'Mozilla/5.0' },
      localStorage: {
        getItem: function (k) { return store[k] || null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; },
      },
      window: {
        location: { search: search || '', origin: 'http://localhost', href: '' },
        self: null,
        top: null,
      },
      firebase: {
        apps: ['mock-app'],
        auth: Object.assign(
          function () {
            return { signInWithPopup: async function () { return { user: { uid: 'test-uid' } }; } };
          },
          { GoogleAuthProvider: function GoogleAuthProvider() {} }
        ),
      },
    };
    sandbox.window.self = sandbox.window;
    sandbox.window.top = sandbox.window;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(sessionSource, ctx);
    vm.runInContext(firebaseSource, ctx);

    const preloadCalls = [];

    await ctx.window.LoveBudAuthFirebase.signInWithGoogle({
      getEnvironmentCheckError: function () { return null; },
      isLoginPage: function () { return false; },
      persistConfirmedAuthSession: async function () {},
      preloadRedirectTargetData: function () {
        preloadCalls.push('preload-called');
        ctx.window.LoveBudAuthSession.preloadRedirectTargetData({
          getRedirectTarget: function () {
            return ctx.window.LoveBudAuthSession.getRedirectTarget();
          },
          apiClient: {
            getTrees: async function () { return [{ id: 'tree-1' }]; },
            getTree: async function (id) { preloadCalls.push('getTree:' + id); return { id: id }; },
            getMemoriesByTree: async function () { preloadCalls.push('getMemoriesByTree'); return []; },
          },
        });
      },
      getRedirectTarget: function () {
        return ctx.window.LoveBudAuthSession.getRedirectTarget();
      },
    });

    // Allow async preload chain (getTrees → getTree) to complete
    await new Promise(function (resolve) { setTimeout(resolve, 10); });

    return {
      href: ctx.window.location.href,
      preloadCalls: preloadCalls,
    };
  }

  const signInScenarios = [
    ['bare my-trees redirect → canonical href + preload', '?redirect=my-trees', '/pages/my-trees', ['preload-called']],
    ['editor redirect with query → canonical href + editor preload', '?redirect=editor?treeId=t1', '/pages/editor?treeId=t1', ['preload-called', 'getTree:tree-1']],
  ];

  for (const [name, search, expectedHref, expectedPreloadCalls] of signInScenarios) {
    const result = await runSignInFlow(search);
    assert.equal(result.href, expectedHref, `${name} (search=${JSON.stringify(search)}): href expected ${expectedHref}, got ${result.href}`);
    for (const expectedCall of expectedPreloadCalls) {
      assert.ok(result.preloadCalls.indexOf(expectedCall) !== -1,
        `${name}: preload must include ${expectedCall}`);
    }
  }
}); // end of signInWithGoogle success popup test

test('redirect-initiation branch must not call preloadRedirectTargetData before setPersistence/signInWithRedirect', () => {
  const source = readRepoFile('js/auth/auth-firebase.js');

  // Validate that the redirect-initiation try block immediately
  // enters the setPersistence check — no preloadRedirectTargetData in between.
  assert.match(
    source,
    /try\s*\{\s*\n\s+if\s*\(\s*firebase\.auth\.Auth\s*&&\s*firebase\.auth\.Auth\.Persistence\s*\)/,
    'redirect-initiation try must jump directly into setPersistence, not preloadRedirectTargetData'
  );

  // Ensure no preloadRedirectTargetData() call exists between the redirect
  // try block opener and the setPersistence guard.
  assert.doesNotMatch(
    source,
    /try\s*\{\s*\n\s*if\s*\(\s*typeof\s+preloadRedirectTargetData\s*===\s*['"]function['"]\s*\)/,
    'redirect-initiation try must not contain preloadRedirectTargetData before setPersistence'
  );

  // Confirm signInWithRedirect still follows setPersistence in the redirect path
  assert.match(
    source,
    /setPersistence[\s\S]*?signInWithRedirect\s*\(/,
    'redirect path must preserve setPersistence before signInWithRedirect'
  );
});

test('popup success path preserves persistConfirmedAuthSession → preloadRedirectTargetData → navigation', () => {
  const source = readRepoFile('js/auth/auth-firebase.js');

  assert.match(
    source,
    /persistConfirmedAuthSession\s*\([\s\S]*?preloadRedirectTargetData\s*\([\s\S]*?window\.location\.href\s*=/,
    'popup success path must keep persistConfirmedAuthSession → preloadRedirectTargetData → navigation order'
  );
  assert.match(
    source,
    /preloadRedirectTargetData[\s\S]*window\.location\.href/,
    'preloadRedirectTargetData must be followed by navigation assignment in popup success'
  );
});
