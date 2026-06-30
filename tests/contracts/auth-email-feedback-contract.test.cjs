/**
 * Auth Email Feedback Contract Test (#3064)
 *
 * Tests the inline status/error UX for email auth submit.
 * Uses Node vm + fake DOM + Firebase mock — no network, no browser.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_LOGIN_PAGE_SRC = fs.readFileSync(
  path.join(ROOT, 'js/auth/auth-login-page.js'), 'utf8'
);

// ── Helpers ──────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

/**
 * Build a sandbox with fake DOM + Firebase mock.
 * Returns { sandbox, elMap, metrics, doc }.
 *   - metrics.signInCalls / createUserCalls / updateProfileCalls track calls
 *   - metrics.setThrow(method) makes the next call throw
 *   - Use metrics.getSubmitHandler() to trigger form submit
 */
function buildSandbox(opts) {
  opts = opts || {};
  var elMap = {};

  // Call metrics — attached to sandbox for test access
  var metrics = {
    signInCalls: 0,
    createUserCalls: 0,
    updateProfileCalls: 0,
    _throwOn: null,
    setThrow: function (method) { metrics._throwOn = method; },
    _resolveSignIn: null,
    _makeSlowPromise: function () {
      return new Promise(function (resolve) {
        metrics._resolveSignIn = resolve;
      });
    }
  };

  function makeEl(id, tag) {
    tag = tag || 'div';
    var attrs = {};
    var listeners = {};
    var el = {
      id: id,
      tagName: tag.toUpperCase(),
      nodeType: 1,
      textContent: '',
      value: '',
      disabled: false,
      required: false,
      hidden: true,
      style: { display: '' },
      dataset: {},
      closest: function () { return null; },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      removeAttribute: function (k) { delete attrs[k]; },
      getAttribute: function (k) { return attrs[k] || null; },
      focus: function () {},
      addEventListener: function (ev, fn) {
        if (!listeners[ev]) listeners[ev] = [];
        listeners[ev].push(fn);
      },
      removeEventListener: function () {},
      dispatchEvent: function () {},
      _listeners: listeners,
      _attrs: attrs
    };
    elMap[id] = el;
    return el;
  }

  // Build modal DOM elements
  makeEl('email-auth-modal', 'div');
  makeEl('email-auth-close', 'button');
  makeEl('auth-mode-badge', 'div');
  makeEl('email-auth-title', 'h2');
  makeEl('email-auth-helper', 'p');
  var form = makeEl('email-auth-form', 'form');
  form._listeners.submit = []; // ensure array
  makeEl('email-auth-email', 'input');
  makeEl('email-auth-password', 'input');
  makeEl('email-auth-display-name', 'input');
  makeEl('email-auth-submit', 'button');
  makeEl('email-auth-error', 'p');
  makeEl('email-auth-status', 'p');
  makeEl('email-auth-reset', 'button');
  makeEl('email-auth-reset-wrap', 'div');
  makeEl('email-auth-toggle', 'button');

  // closest() mock for display name wrap
  elMap['email-auth-display-name'].closest = function () {
    return { style: { display: '' } };
  };

  // Firebase mock
  function createFirebaseAuth() {
    return {
      signInWithEmailAndPassword: async function (email, pwd) {
        metrics.signInCalls++;
        if (metrics._throwOn === 'signIn') throw { code: 'auth/wrong-password', message: 'wrong password' };
        return { user: { uid: 'mock-uid', email: email } };
      },
      createUserWithEmailAndPassword: async function (email, pwd) {
        metrics.createUserCalls++;
        if (metrics._throwOn === 'createUser') throw { code: 'auth/email-already-in-use', message: 'email in use' };
        return { user: { uid: 'mock-uid-new', email: email, updateProfile: async function (p) {
          metrics.updateProfileCalls++;
        }}};
      },
      sendPasswordResetEmail: async function () {},
      signOut: async function () {},
      onAuthStateChanged: function () {},
      getRedirectResult: function () { return Promise.resolve({ user: null }); },
      currentUser: null
    };
  }

  var firebaseRef = {
    apps: opts.firebaseReady === false ? [] : [{}],
    auth: createFirebaseAuth
  };

  function querySelector(sel) {
    if (sel.charAt(0) === '#') return elMap[sel.slice(1)] || null;
    return null;
  }

  var doc = {
    getElementById: function (id) { return elMap[id] || null; },
    querySelector: querySelector,
    querySelectorAll: function () { return []; },
    documentElement: {},
    createElement: makeEl,
    body: {},
    addEventListener: function () {},
    removeEventListener: function () {}
  };

  var sandbox = {
    document: doc,
    location: { href: '', pathname: opts.pathname || '/pages/login' },
    setTimeout: function (fn) { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout: function () {},
    alert: function () {},
    console: { log: function () {}, warn: function () {}, error: function () {} },
    addEventListener: function () {},
    removeEventListener: function () {},
    LoveBudAuthLoginPage: null,
    LoveBudLoginPageController: null,
    applyI18n: function () {},
    getCurrentLang: function () { return 'ko'; },
    __initialAuthMode: opts.initialMode || 'login',
    __authMetrics: metrics,
    firebase: firebaseRef,
    Object: Object, Array: Array, String: String, Number: Number,
    Boolean: Boolean, Promise: Promise, RegExp: RegExp, Error: Error,
    Date: Date, Math: Math, NaN: NaN,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN,
    JSON: JSON,
    navigator: { userAgent: '' },
    URLSearchParams: URLSearchParams
  };
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.window = sandbox;

  return { sandbox: sandbox, elMap: elMap, metrics: metrics, doc: doc };
}

function setupForm(sandbox, elMap, metrics, extraOptions) {
  extraOptions = extraOptions || {};
  var emailAuthMode = extraOptions.initialMode || sandbox.__initialAuthMode || 'login';

  // Run the IIFE in the sandbox
  vm.runInNewContext(
    AUTH_LOGIN_PAGE_SRC.replace(
      /if \(window\.LoveBudAuthLoginPage\) return;/,
      ''
    ),
    sandbox,
    { filename: 'auth-login-page.js' }
  );

  var mod = sandbox.LoveBudAuthLoginPage;

  mod.setupEmailAuthEntry({
    setEmailAuthMode: function (m) { emailAuthMode = m; sandbox.__initialAuthMode = m; },
    getEmailAuthMode: function () { return emailAuthMode; },
    syncEmailAuthModeUi: function () {},
    applyI18n: function () {},
    initialMode: emailAuthMode
  });

  mod.setupEmailAuthForm({
    firebase: sandbox.firebase,
    initFirebase: function () {},
    getEnvironmentCheckError: extraOptions.envError
      ? function () { return extraOptions.envError; }
      : function () { return null; },
    getFriendlyErrorMessage: extraOptions.getFriendlyErrorMessage || function () { return null; },
    getEmailAuthMode: function () { return emailAuthMode; },
    setEmailAuthMode: function (m) { emailAuthMode = m; },
    persistConfirmedAuthSession: function () {},
    preloadRedirectTargetData: function () {},
    getRedirectTarget: extraOptions.getRedirectTarget || function () { return 'pages/my-trees.html'; },
    isInvalidAuthSessionError: function () { return false; },
    clearStaleFirebaseAuthState: function () {}
  });

  return { mod: mod, getEmailAuthMode: function () { return emailAuthMode; } };
}

async function triggerSubmit(elMap, values) {
  values = values || {};
  if (elMap['email-auth-email']) elMap['email-auth-email'].value = values.email || '';
  if (elMap['email-auth-password']) elMap['email-auth-password'].value = values.password || '';
  if (elMap['email-auth-display-name']) elMap['email-auth-display-name'].value = values.displayName || '';

  var form = elMap['email-auth-form'];
  if (form && form._listeners && form._listeners.submit) {
    for (var i = 0; i < form._listeners.submit.length; i++) {
      await form._listeners.submit[i]({ preventDefault: function () {} });
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────

test('login submit shows success status (clear error, submitting→success)', async function () {
  var ctx = buildSandbox({ pathname: '/pages/login' });
  ctx.elMap['email-auth-error'].hidden = false;
  ctx.elMap['email-auth-error'].textContent = 'old error';
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  await triggerSubmit(ctx.elMap, { email: 'test@example.com', password: 'password123' });

  // Error cleared
  assert.ok(ctx.elMap['email-auth-error'].hidden, 'error must be hidden after submit');
  assert.equal(ctx.elMap['email-auth-error'].textContent, '', 'error text must be cleared');
  // Status shows success text
  assert.ok(!ctx.elMap['email-auth-status'].hidden, 'status must be visible');
  assert.ok(ctx.elMap['email-auth-status'].textContent.includes('로그인되었습니다'),
    'status must say 로그인되었습니다');
  // Button disabled with success text
  assert.ok(ctx.elMap['email-auth-submit'].disabled, 'submit must be disabled');
  assert.ok(ctx.elMap['email-auth-submit'].textContent.includes('로그인되었습니다'),
    'button must show success text');
});

test('signup submit shows success status', async function () {
  var ctx = buildSandbox({ pathname: '/pages/signup', initialMode: 'signup' });
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics, { initialMode: 'signup' });

  await triggerSubmit(ctx.elMap, { email: 'test@example.com', password: 'password123', displayName: '테스트' });

  // Error cleared
  assert.ok(ctx.elMap['email-auth-error'].hidden, 'error must be hidden');
  // Status shows success text
  assert.ok(!ctx.elMap['email-auth-status'].hidden, 'status must be visible');
  assert.ok(ctx.elMap['email-auth-status'].textContent.includes('회원가입이 완료되었습니다'),
    'status must say 회원가입 완료');
  // Button disabled
  assert.ok(ctx.elMap['email-auth-submit'].disabled, 'submit must be disabled');
});

test('login success: signInExactlyOnce, no createUser', async function () {
  var ctx = buildSandbox({});
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  await triggerSubmit(ctx.elMap, { email: 'user@test.com', password: 'pass1234' });

  assert.equal(ctx.metrics.signInCalls, 1, 'signIn must be called exactly once');
  assert.equal(ctx.metrics.createUserCalls, 0, 'createUser must NOT be called for login');
  assert.equal(ctx.metrics.updateProfileCalls, 0, 'updateProfile must NOT be called for login');
});

test('signup success: createUser 1, updateProfile 1, no signIn', async function () {
  var ctx = buildSandbox({});
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics, { initialMode: 'signup' });

  await triggerSubmit(ctx.elMap, { email: 'new@test.com', password: 'newpass1234', displayName: 'NewUser' });

  assert.equal(ctx.metrics.createUserCalls, 1, 'createUser must be called exactly once');
  assert.equal(ctx.metrics.updateProfileCalls, 1, 'updateProfile must be called');
  assert.equal(ctx.metrics.signInCalls, 0, 'signIn must NOT be called for signup');
});

test('validation error: inline error, no alert dependency', async function () {
  var ctx = buildSandbox({});
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  await triggerSubmit(ctx.elMap, { email: '', password: '' });

  assert.ok(!ctx.elMap['email-auth-error'].hidden, 'error must be visible');
  assert.ok(ctx.elMap['email-auth-error'].textContent.length > 0, 'error must have text');
  assert.ok(ctx.elMap['email-auth-status'].hidden, 'status must be hidden on error');
  assert.ok(!ctx.elMap['email-auth-submit'].disabled, 'submit must be re-enabled');
});

test('Firebase init failure: inline error, button restored', async function () {
  var ctx = buildSandbox({ firebaseReady: false });
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  await triggerSubmit(ctx.elMap, { email: 'test@test.com', password: 'pass1234' });

  assert.ok(!ctx.elMap['email-auth-error'].hidden, 'error must be visible');
  assert.ok(ctx.elMap['email-auth-error'].textContent.includes('Firebase'),
    'error must mention Firebase');
  assert.ok(!ctx.elMap['email-auth-submit'].disabled, 'submit must be re-enabled');
});

test('Firebase mapped error: safe friendly message shown', async function () {
  var ctx = buildSandbox({});
  var safeMessage = '비밀번호가 올바르지 않습니다.';
  ctx.metrics.setThrow('signIn');
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics, {
    getFriendlyErrorMessage: function () { return safeMessage; }
  });

  await triggerSubmit(ctx.elMap, { email: 'user@test.com', password: 'wrongpass' });

  assert.ok(!ctx.elMap['email-auth-error'].hidden, 'error must be visible');
  assert.equal(ctx.elMap['email-auth-error'].textContent, safeMessage,
    'error must show the safe friendly message, not raw Firebase error');
  assert.ok(!ctx.elMap['email-auth-submit'].disabled, 'submit must be re-enabled');
  assert.ok(ctx.elMap['email-auth-status'].hidden, 'status must be hidden on error');
});

test('duplicate submit: guard mechanism exists and prevents re-entry', async function () {
  var ctx = buildSandbox({});
  var signInCount = 0;
  var releasePromise;
  var pendingPromise = new Promise(function (resolve) { releasePromise = resolve; });

  // Use a never-resolving first call so second submit can't pass
  ctx.sandbox.firebase.auth = function () {
    return {
      signInWithEmailAndPassword: async function () {
        signInCount++;
        // First call: wait forever (simulates pending)
        if (signInCount === 1) {
          await pendingPromise;
        }
        return { user: { uid: 'mock', email: 'a@b.com' } };
      },
      createUserWithEmailAndPassword: async function () { return { user: null }; },
      sendPasswordResetEmail: async function () {},
      signOut: async function () {},
      onAuthStateChanged: function () {},
      getRedirectResult: function () { return Promise.resolve({ user: null }); },
      currentUser: null
    };
  };

  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  // First submit starts and awaits pendingPromise (never resolves in this test)
  var firstPromise = triggerSubmit(ctx.elMap, { email: 'a@b.com', password: 'pass1234' });

  // Second submit should be blocked by _submitting guard
  await triggerSubmit(ctx.elMap, { email: 'a@b.com', password: 'pass1234' });

  // Release the first call's promise
  if (releasePromise) releasePromise();
  await firstPromise;

  // Even after release, only 1 call should have happened
  assert.equal(signInCount, 1, 'signIn must be called exactly once despite 2 submits');
});

test('state transition: hidden/aria-hidden/textContent consistency', async function () {
  var ctx = buildSandbox({});
  setupForm(ctx.sandbox, ctx.elMap, ctx.metrics);

  // Empty submit → error state
  await triggerSubmit(ctx.elMap, { email: '', password: '' });

  // Error: visible, no aria-hidden, has text
  assert.ok(!ctx.elMap['email-auth-error'].hidden, 'error must be visible');
  assert.equal(ctx.elMap['email-auth-error'].getAttribute('aria-hidden'), null,
    'error aria-hidden must be removed');
  assert.ok(ctx.elMap['email-auth-error'].textContent.length > 0, 'error must have text');

  // Status: hidden, aria-hidden true, no text
  assert.ok(ctx.elMap['email-auth-status'].hidden, 'status must be hidden');
  assert.equal(ctx.elMap['email-auth-status'].getAttribute('aria-hidden'), 'true',
    'status aria-hidden must be true');
  assert.equal(ctx.elMap['email-auth-status'].textContent, '', 'status must have no text');
});

test('HTML: #email-auth-status exists in login.html with role/aria', function () {
  var html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(html.includes('email-auth-status'), 'login.html must have email-auth-status');
  assert.ok(html.includes('role="status"'), 'status must have role="status"');
  assert.ok(html.includes('aria-live="polite"'), 'status must have aria-live="polite"');
});

test('HTML: #email-auth-status exists in signup.html', function () {
  var html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(html.includes('email-auth-status'), 'signup.html must have email-auth-status');
});

test('CSS: .login-form-status defined in forms.css', function () {
  var css = readFile(path.join(ROOT, 'css/login/forms.css'));
  assert.ok(css.includes('.login-form-status'), 'forms.css must have .login-form-status');
  assert.ok(css.includes('[hidden]'), 'CSS must handle hidden state');
});

test('Google OAuth code unchanged', function () {
  var src = readFile(path.join(ROOT, 'js/auth/auth-firebase.js'));
  assert.ok(src.includes('GoogleAuthProvider'));
  assert.ok(src.includes('signInWithPopup'));
});
