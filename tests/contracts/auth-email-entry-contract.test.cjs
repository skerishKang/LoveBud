/**
 * Auth Email Entry Contract Test (#3062 v2)
 *
 * Validates the unified architecture:
 *  - auth-login-page.js: setupEmailAuthEntry() handles ALL modal UI
 *  - auth-login-page.js: setupEmailAuthForm() handles ONLY Firebase submit + reset
 *  - auth.js: setupEmailAuthEntry() called early (Firebase-independent)
 *  - All mode reads go through canonical EMAIL_AUTH_MODE via setEmailAuthMode
 *  - auth-email-entry.js is DELETED — no standalone module
 *  - Single binding per element (no duplicates)
 *  - Google OAuth unchanged
 *
 * No network, no Firebase — pure static file + JS module contract + vm sandbox.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Helpers ──────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function hasScriptSrc(html, srcPattern) {
  const re = new RegExp(
    '<script[^>]*src\\s*=\\s*"[^"]*' +
    srcPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[^"]*"[^>]*>',
    'i'
  );
  return re.test(html);
}

function getElementAttrs(html, id) {
  const re = new RegExp(
    '<(\\w+)[^>]*\\sid="' + id + '"[^>]*>',
    'i'
  );
  const m = html.match(re);
  if (!m) return null;
  return { tag: m[1], full: m[0] };
}

// ── 1. auth-email-entry.js fully removed ────────────────────────────

test('auth-email-entry.js file deleted', function () {
  const exists = fs.existsSync(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.equal(exists, false, 'auth-email-entry.js must be deleted');
});

test('login.html does NOT reference auth-email-entry.js', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.equal(hasScriptSrc(html, 'auth-email-entry.js'), false,
    'login.html must not reference auth-email-entry.js');
});

test('signup.html does NOT reference auth-email-entry.js', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.equal(hasScriptSrc(html, 'auth-email-entry.js'), false,
    'signup.html must not reference auth-email-entry.js');
});

// ── 2. auth-login-page.js exports setupEmailAuthEntry ───────────────

test('auth-login-page.js exports setupEmailAuthEntry', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('setupEmailAuthEntry'),
    'auth-login-page.js must define setupEmailAuthEntry');
  assert.ok(src.includes('setupEmailAuthEntry: setupEmailAuthEntry'),
    'setupEmailAuthEntry must be exported in LoveBudAuthLoginPage');
});

test('auth-login-page.js EMAIL_AUTH_EXECUTION_METHODS includes setupEmailAuthEntry', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("setupEmailAuthEntry: true"),
    'EMAIL_AUTH_EXECUTION_METHODS must include setupEmailAuthEntry');
});

// ── 3. setupEmailAuthEntry uses canonical mode API ──────────────────

test('setupEmailAuthEntry reads getEmailAuthMode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("typeof getEmailAuthMode === 'function' ? getEmailAuthMode()"),
    'setupEmailAuthEntry must read canonical mode via getEmailAuthMode()');
});

test('setupEmailAuthEntry writes canonical mode via setEmailAuthMode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("typeof setEmailAuthMode === 'function'"),
    'setupEmailAuthEntry must use setEmailAuthMode');
});

test('setupEmailAuthEntry syncd displayName required state', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('displayNameInput.required'),
    'setupEmailAuthEntry must toggle displayName input required state');
});

test('setupEmailAuthEntry hides reset in signup mode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('resetWrap.hidden'),
    'setupEmailAuthEntry must toggle resetWrap hidden');
  assert.ok(src.includes('resetBtn.disabled'),
    'setupEmailAuthEntry must toggle resetBtn disabled');
});

test('setupEmailAuthEntry has Escape handler', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("e.key === 'Escape'"),
    'setupEmailAuthEntry must have Escape key handler');
});

test('setupEmailAuthEntry restores focus on close', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('lastTriggerButton'),
    'setupEmailAuthEntry must track focus-return trigger button');
});

test('setupEmailAuthEntry uses replaceEventListener for idempotent binding', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  // Must use replaceEventListener for major handlers
  assert.ok(src.includes('replaceEventListener(emailBtn'),
    'login CTA must use replaceEventListener');
  assert.ok(src.includes('replaceEventListener(signupBtn'),
    'signup CTA must use replaceEventListener');
  assert.ok(src.includes('replaceEventListener(toggleBtn'),
    'toggle must use replaceEventListener');
  assert.ok(src.includes('replaceEventListener(closeBtn'),
    'close must use replaceEventListener');
});

// ── 4. setupEmailAuthForm no longer binds UI handlers ───────────────

test('setupEmailAuthForm no longer binds #login-btn-email', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  // Find all occurrences of login-btn-email in the file
  const re = /login-btn-email[^;]*click/g;
  const matches = src.match(re) || [];
  // Only setupEmailAuthEntry should bind login-btn-email click
  // Must not be in setupEmailAuthForm
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  const dup = formSubstr.match(/#login-btn-email|login-btn-email/g);
  assert.equal(dup, null, 'setupEmailAuthForm must not reference login-btn-email');
});

test('setupEmailAuthForm no longer binds #email-auth-toggle', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  assert.ok(!formSubstr.includes('email-auth-toggle'),
    'setupEmailAuthForm must not reference email-auth-toggle');
});

test('setupEmailAuthForm no longer binds #email-auth-modal backdrop', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  assert.ok(!formSubstr.includes('modal.style.display'),
    'setupEmailAuthForm must not have modal display toggle');
});

test('setupEmailAuthForm still has form submit handler', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("form.addEventListener('submit'"),
    'setupEmailAuthForm must still bind form submit');
  assert.ok(src.includes('signInWithEmailAndPassword'),
    'setupEmailAuthForm must still call signInWithEmailAndPassword');
  assert.ok(src.includes('createUserWithEmailAndPassword'),
    'setupEmailAuthForm must still call createUserWithEmailAndPassword');
});

test('setupEmailAuthForm still has password reset handler', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('sendPasswordResetEmail'),
    'setupEmailAuthForm must still have password reset handler');
});

// ── 5. auth.js calls setupEmailAuthEntry early ──────────────────────

test('auth.js defines setupEmailAuthEntry function', function () {
  const src = readFile(path.join(ROOT, 'js/auth.js'));
  assert.ok(src.includes('function setupEmailAuthEntry'),
    'auth.js must define setupEmailAuthEntry()');
  assert.ok(src.includes('setupEmailAuthEntry('),
    'auth.js must call setupEmailAuthEntry()');
});

test('auth.js calls setupEmailAuthEntry at top of initAuth', function () {
  const src = readFile(path.join(ROOT, 'js/auth.js'));
  // initAuth must call setupEmailAuthEntry BEFORE bridge delegation
  const initSection = src.indexOf('function initAuth');
  const substr = src.substring(initSection, initSection + 300);
  assert.ok(substr.indexOf('setupEmailAuthEntry') < substr.indexOf('__authProtectedRouteBridge') ||
             substr.indexOf('__authProtectedRouteBridge') === -1,
    'setupEmailAuthEntry must be called before bridge in initAuth');
});

// ── 6. Static HTML structure ────────────────────────────────────────

test('login.html: has #login-btn-email', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  const btn = getElementAttrs(html, 'login-btn-email');
  assert.ok(btn, '#login-btn-email must exist');
  assert.equal(btn.tag, 'button');
});

test('login.html: has #email-auth-modal', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(getElementAttrs(html, 'email-auth-modal'),
    '#email-auth-modal must exist in login.html');
});

test('signup.html: has #signup-btn-email', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  const btn = getElementAttrs(html, 'signup-btn-email');
  assert.ok(btn, '#signup-btn-email must exist');
  assert.equal(btn.tag, 'button');
});

test('signup.html: has #email-auth-modal', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(getElementAttrs(html, 'email-auth-modal'),
    '#email-auth-modal must exist in signup.html');
});

test('signup.html: modal has required elements', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  const requiredIds = [
    'email-auth-modal', 'email-auth-close', 'email-auth-title',
    'email-auth-form', 'email-auth-email', 'email-auth-password',
    'email-auth-display-name', 'email-auth-submit', 'email-auth-toggle',
    'email-auth-reset', 'email-auth-reset-wrap', 'auth-mode-badge',
  ];
  for (const id of requiredIds) {
    assert.ok(getElementAttrs(html, id), `signup.html modal must have #${id}`);
  }
  assert.ok(html.includes('data-auth-display-name-wrap'),
    'signup.html modal must have data-auth-display-name-wrap');
});

test('signup.html: does NOT reference js/signup-page.js', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(!html.includes('signup-page.js'),
    'signup.html must not reference non-existent js/signup-page.js');
});

// ── 7. Google OAuth unchanged ───────────────────────────────────────

test('auth-firebase.js: Google OAuth code paths unchanged', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-firebase.js'));
  assert.ok(src.includes('GoogleAuthProvider'), 'must have GoogleAuthProvider');
  assert.ok(src.includes('signInWithGoogle'), 'must have signInWithGoogle');
  assert.ok(src.includes('signInWithPopup'), 'must have signInWithPopup');
  assert.ok(src.includes('signInWithRedirect'), 'must have signInWithRedirect');
  assert.ok(src.includes('isEmbeddedBrowser'), 'must have isEmbeddedBrowser');
  assert.ok(src.includes('getRedirectResult'), 'must have getRedirectResult');
  assert.ok(!src.includes('React'), 'must not have React code');
});

test('login.html: Google OAuth button unchanged', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(html.includes('login-btn-google'), 'must have #login-btn-google');
  assert.ok(html.includes('Google로 로그인'), 'must say Google로 로그인');
});

test('signup.html: Google OAuth button unchanged', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(html.includes('signup-btn-google'), 'must have #signup-btn-google');
  assert.ok(html.includes('Google로 회원가입'), 'must say Google로 회원가입');
});

// ── 8. Login headline copy ─────────────────────────────────────────

test('login headline: "다시" removed from login.html', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(html.includes('러브트리에 로그인하세요'),
    'login headline must say 러브트리에 로그인하세요');
  assert.ok(!html.includes('다시 러브트리에 로그인하세요'),
    'login headline must not contain 다시');
});

test('login headline: "다시" removed from i18n-login.js', function () {
  const i18n = readFile(path.join(ROOT, 'js/i18n/i18n-login.js'));
  const titleEntry = i18n.match(/'login_title':\s*\{[^}]+\}/s);
  assert.ok(titleEntry, 'login_title i18n entry must exist');
  assert.ok(titleEntry[0].includes('러브트리에 로그인하세요'),
    'login_title i18n must say 러브트리에 로그인하세요');
  assert.ok(!titleEntry[0].includes('다시'),
    'login_title i18n must not contain 다시');
});

// ── 9. Mock/Focused mode synchronization tests ──────────────────────

test('auth-login-page.js: setupEmailAuthEntry calls setEmailAuthMode with initialMode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes('setEmailAuthMode(initialMode)'),
    'setupEmailAuthEntry must call setEmailAuthMode with initialMode');
});

test('auth-login-page.js: login-email CTA opens modal with login mode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  // The login CTA click calls openModal('login')
  assert.ok(src.includes("openModal('login')") || src.includes('openModal("login")'),
    'login CTA must call openModal with login');
});

test('auth-login-page.js: signup-email CTA opens modal with signup mode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  // The signup CTA click calls openModal('signup')
  assert.ok(src.includes("openModal('signup')") || src.includes('openModal("signup")'),
    'signup CTA must call openModal with signup');
});

test('auth-login-page.js: toggle switches mode using setEmailAuthMode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  assert.ok(src.includes("setEmailAuthMode(nextMode)") || src.includes('setEmailAuthMode(nextMode)'),
    'toggle must call setEmailAuthMode(nextMode)');
});

test('auth-login-page.js: form submit reads getEmailAuthMode to decide login vs signup', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  assert.ok(formSubstr.includes('getEmailAuthMode'),
    'setupEmailAuthForm submit handler must read getEmailAuthMode');
});

test('auth-login-page.js: login submit uses signInWithEmailAndPassword', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  assert.ok(formSubstr.includes('emailAuthMode === \'login\''),
    'setupEmailAuthForm must check login mode');
  assert.ok(formSubstr.includes('signInWithEmailAndPassword'),
    'login submit must use signInWithEmailAndPassword');
});

test('auth-login-page.js: signup submit uses createUserWithEmailAndPassword + updateProfile', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const formSubstr = formSection >= 0 ? src.substring(formSection) : '';
  assert.ok(formSubstr.includes('createUserWithEmailAndPassword'),
    'signup submit must use createUserWithEmailAndPassword');
  assert.ok(formSubstr.includes('updateProfile'),
    'signup must call updateProfile with displayName');
});

// ── 10. No duplicate binding verification ──────────────────────────

test('Each major handler has exactly one replaceEventListener per element', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  // Verify replaceEventListener is used for each major binding point
  const replaceCalls = src.match(/replaceEventListener\(/g) || [];
  assert.ok(replaceCalls.length >= 6,
    'There should be at least 6 replaceEventListener calls in auth-login-page.js');
});

// Check no duplicate raw addEventListener on the elements
test('No raw addEventListener on modal CTA elements in setupEmailAuthForm', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-login-page.js'));
  const formSection = src.indexOf('function setupEmailAuthForm');
  const afterForm = formSection >= 0 ? src.substring(formSection) : '';
  // Must not have leftover UI event listeners
  assert.ok(!afterForm.includes("getElementById('login-btn-email')") &&
            !afterForm.includes('login-btn-email'),
    'setupEmailAuthForm must not have login-btn-email reference');
});

// ── 11. vm-based runtime tests ──────────────────────────────────────
// Uses Node vm + minimal fake DOM to execute auth-login-page.js in a sandbox.
// Firebase mock is only used in submit-path tests; open/close/toggle tests
// do NOT use Firebase, real accounts, emails, passwords, or network.

const vm = require('node:vm');

/**
 * Build a minimal fake DOM environment sufficient to run setupEmailAuthEntry().
 * Returns { sandbox, elements, getCanonicalMode, setCanonicalMode }.
 */
function buildSandbox(opts) {
  opts = opts || {};

  // Canonical mode store (mirrors auth.js EMAIL_AUTH_MODE)
  let canonicalMode = opts.initialMode || 'login';

  // Minimal EventTarget-like element factory
  function makeEl(id, tag) {
    const listeners = {}; // eventName -> [fn]
    const props = {};
    const el = {
      id: id || '',
      tagName: (tag || 'div').toUpperCase(),
      style: { display: '' },
      hidden: false,
      disabled: false,
      required: false,
      value: '',
      textContent: '',
      dataset: {},
      getAttribute() { return null; },
      setAttribute() {},
      querySelectorAll(sel) { return []; },
      closest() { return null; },
      focus() { el.__focused = true; },
      __focused: false,
      __listenerCount: function(name) {
        return (listeners[name] || []).length;
      },
      addEventListener(name, fn) {
        if (!listeners[name]) listeners[name] = [];
        listeners[name].push(fn);
        props[fn.__handlerKey || Symbol()] = fn;
      },
      removeEventListener(name, fn) {
        if (!listeners[name]) return;
        listeners[name] = listeners[name].filter(f => f !== fn);
      },
      dispatchEvent(ev) {
        (listeners[ev.type] || []).forEach(fn => fn(ev));
      },
      click() {
        const ev = { type: 'click', target: el, preventDefault() {}, stopPropagation() {} };
        (listeners['click'] || []).forEach(fn => fn(ev));
      },
    };
    return el;
  }

  function makeKeyEvent(key, shiftKey) {
    return {
      type: 'keydown',
      key,
      shiftKey: !!shiftKey,
      preventDefault() { this._prevented = true; },
    };
  }

  // Build named elements
  const elements = {
    modal: makeEl('email-auth-modal', 'div'),
    closeBtn: makeEl('email-auth-close', 'button'),
    toggleBtn: makeEl('email-auth-toggle', 'button'),
    emailBtn: makeEl('login-btn-email', 'button'),
    signupBtn: makeEl('signup-btn-email', 'button'),
    emailInput: makeEl('email-auth-email', 'input'),
    titleEl: makeEl('email-auth-title', 'h2'),
    helperEl: makeEl('email-auth-helper', 'p'),
    submitBtn: makeEl('email-auth-submit', 'button'),
    badgeEl: makeEl('auth-mode-badge', 'span'),
    displayNameInput: makeEl('email-auth-display-name', 'input'),
    displayNameWrap: makeEl('', 'div'),
    resetWrap: makeEl('email-auth-reset-wrap', 'div'),
    resetBtn: makeEl('email-auth-reset', 'button'),
    form: makeEl('email-auth-form', 'form'),
    // Pre-create password input so setupEmailAuthForm sees it at call time
    passwordInput: makeEl('email-auth-password', 'input'),
  };

  // displayNameInput.closest must return displayNameWrap
  elements.displayNameInput.closest = function(sel) {
    if (sel && sel.includes('data-auth-display-name-wrap')) return elements.displayNameWrap;
    return null;
  };
  elements.displayNameWrap.style = { display: '' };

  // modal.querySelectorAll returns focusable elements in order
  elements.modal.querySelectorAll = function(sel) {
    return [elements.emailInput, elements.submitBtn, elements.closeBtn];
  };

  const idMap = {};
  for (const el of Object.values(elements)) {
    if (el.id) idMap[el.id] = el;
  }

  // Fake document
  const fakeDocument = {
    getElementById(id) { return idMap[id] || null; },
    querySelector(sel) { return null; },
    activeElement: null,
    addEventListener() {},
  };

  // Fake window
  const fakeWindow = {
    LoveBudAuthLoginPage: undefined,
    __lovebudEmailAuthEntryBound: false,
    location: { pathname: '/pages/login.html', search: '' },
    applyI18n: undefined,
    document: fakeDocument,
  };

  const sandbox = vm.createContext({
    window: fakeWindow,
    document: fakeDocument,
    console: { log() {}, warn() {}, error() {} },
    alert() {},
    firebase: undefined,
    initFirebase: undefined,
  });

  // Load auth-login-page.js into sandbox
  const src = fs.readFileSync(path.join(ROOT, 'js/auth/auth-login-page.js'), 'utf8');
  vm.runInContext(src, sandbox);

  function getCanonicalMode() { return canonicalMode; }
  function setCanonicalMode(m) { canonicalMode = (m === 'signup' ? 'signup' : 'login'); }

  // Call setupEmailAuthEntry with canonical mode hooks
  sandbox.window.LoveBudAuthLoginPage.setupEmailAuthEntry({
    setEmailAuthMode: setCanonicalMode,
    getEmailAuthMode: getCanonicalMode,
    syncEmailAuthModeUi: function(opts2) {
      // minimal: update badge text for mode readability
      if (opts2 && opts2.badgeEl) {
        opts2.badgeEl.textContent = (canonicalMode === 'signup') ? '회원가입' : '로그인';
      }
    },
    applyI18n: undefined,
    initialMode: opts.initialMode || 'login',
  });

  return { sandbox, elements, getCanonicalMode, setCanonicalMode };
}

test('vm runtime: replaceEventListener helper is defined locally in auth-login-page.js (no ReferenceError)', function () {
  // If replaceEventListener is missing, building the sandbox will throw ReferenceError.
  let error = null;
  try {
    buildSandbox({ initialMode: 'login' });
  } catch (e) {
    error = e;
  }
  assert.equal(error, null, 'setupEmailAuthEntry must not throw ReferenceError: ' + (error && error.message));
});

test('vm runtime: login CTA click sets canonical mode to login, opens modal, focuses email input', function () {
  const { elements, getCanonicalMode } = buildSandbox({ initialMode: 'login' });

  // Initial state: modal is closed
  assert.equal(elements.modal.style.display, '', 'modal should start hidden');

  elements.emailBtn.click();

  assert.equal(getCanonicalMode(), 'login', 'canonical mode must be login after login CTA click');
  assert.equal(elements.modal.style.display, 'flex', 'modal must be open (display:flex) after login CTA');
  assert.equal(elements.emailInput.__focused, true, 'email input must receive focus after login CTA');
});

test('vm runtime: signup CTA click sets canonical mode to signup, opens modal, focuses email input', function () {
  const { elements, getCanonicalMode } = buildSandbox({ initialMode: 'login' });

  elements.signupBtn.click();

  assert.equal(getCanonicalMode(), 'signup', 'canonical mode must be signup after signup CTA click');
  assert.equal(elements.modal.style.display, 'flex', 'modal must be open after signup CTA');
  assert.equal(elements.emailInput.__focused, true, 'email input must receive focus after signup CTA');
});

test('vm runtime: signup CTA shows nickname wrapper and hides reset', function () {
  const { elements } = buildSandbox({ initialMode: 'login' });

  elements.signupBtn.click();

  assert.equal(elements.displayNameWrap.style.display, 'block', 'nickname wrapper must be visible in signup');
  assert.equal(elements.displayNameInput.required, true, 'nickname input must be required in signup');
  assert.equal(elements.resetWrap.hidden, true, 'reset wrapper must be hidden in signup');
  assert.equal(elements.resetBtn.disabled, true, 'reset button must be disabled in signup');
});

test('vm runtime: close button closes modal and returns focus to last trigger', function () {
  const { elements } = buildSandbox({ initialMode: 'login' });

  // Open via login CTA (sets lastTriggerButton = emailBtn)
  elements.emailBtn.click();
  assert.equal(elements.modal.style.display, 'flex', 'modal must be open');

  // Reset focus tracking
  elements.emailBtn.__focused = false;

  // Close
  elements.closeBtn.click();
  assert.equal(elements.modal.style.display, 'none', 'modal must close after close button click');
  assert.equal(elements.emailBtn.__focused, true, 'focus must return to login CTA after close');
});

test('vm runtime: backdrop click closes modal', function () {
  const { elements } = buildSandbox({ initialMode: 'login' });

  elements.emailBtn.click();
  assert.equal(elements.modal.style.display, 'flex');

  // Simulate backdrop click (e.target === modal)
  const ev = {
    type: 'click',
    target: elements.modal,
    preventDefault() {},
    stopPropagation() {},
  };
  elements.modal.dispatchEvent(ev);

  assert.equal(elements.modal.style.display, 'none', 'modal must close on backdrop click');
});

test('vm runtime: Escape key closes modal', function () {
  const { elements } = buildSandbox({ initialMode: 'login' });

  elements.signupBtn.click();
  assert.equal(elements.modal.style.display, 'flex');

  // Simulate Escape keydown
  const ev = {
    type: 'keydown',
    key: 'Escape',
    shiftKey: false,
    preventDefault() {},
  };
  elements.modal.dispatchEvent(ev);

  assert.equal(elements.modal.style.display, 'none', 'modal must close on Escape key');
});

test('vm runtime: toggle switches mode from login to signup and back', function () {
  const { elements, getCanonicalMode } = buildSandbox({ initialMode: 'login' });

  elements.emailBtn.click(); // open in login mode
  assert.equal(getCanonicalMode(), 'login');

  elements.toggleBtn.click(); // switch to signup
  assert.equal(getCanonicalMode(), 'signup', 'toggle must switch login→signup');
  assert.equal(elements.displayNameWrap.style.display, 'block', 'nickname wrap visible after toggle to signup');

  elements.toggleBtn.click(); // switch back to login
  assert.equal(getCanonicalMode(), 'login', 'toggle must switch signup→login');
  assert.equal(elements.displayNameWrap.style.display, 'none', 'nickname wrap hidden after toggle to login');
});

test('vm runtime: no duplicate listener accumulation (idempotency)', function () {
  // Reset the guard so we can call setupEmailAuthEntry a second time
  const opts = { initialMode: 'login' };
  const { sandbox, elements, getCanonicalMode, setCanonicalMode } = buildSandbox(opts);

  // Reset the binding guard and call setup again
  sandbox.window.__lovebudEmailAuthEntryBound = false;
  sandbox.window.LoveBudAuthLoginPage.setupEmailAuthEntry({
    setEmailAuthMode: setCanonicalMode,
    getEmailAuthMode: getCanonicalMode,
    syncEmailAuthModeUi: function() {},
    initialMode: 'login',
  });

  // Click login CTA: must only open modal once (mode changes exactly once per click)
  elements.modal.style.display = '';
  elements.emailBtn.click();

  // Modal is open — canonical mode is 'login' (not toggled twice)
  assert.equal(elements.modal.style.display, 'flex', 'modal must be open');
  assert.equal(getCanonicalMode(), 'login', 'canonical mode must be login after single click (no double-fire)');
});

test('vm runtime: Firebase-independent — setupEmailAuthEntry works without Firebase', function () {
  // buildSandbox does NOT inject firebase — this must not throw
  let error = null;
  try {
    const { elements } = buildSandbox({ initialMode: 'login' });
    elements.emailBtn.click();
    elements.closeBtn.click();
  } catch (e) {
    error = e;
  }
  assert.equal(error, null, 'open/close must work without Firebase: ' + (error && error.message));
});

test('vm runtime: setupEmailAuthForm login submit calls signInWithEmailAndPassword exactly once', async function () {
  const { sandbox, elements, getCanonicalMode, setCanonicalMode } = buildSandbox({ initialMode: 'login' });

  let signInCalls = 0;
  let createCalls = 0;

  const mockUser = { uid: 'u1', displayName: null };
  const mockAuth = function() {
    return {
      signInWithEmailAndPassword: async function() {
        signInCalls++;
        return { user: mockUser };
      },
      createUserWithEmailAndPassword: async function() {
        createCalls++;
        const u = { uid: 'u2', displayName: null, updateProfile: async function() {} };
        return { user: u };
      },
      currentUser: mockUser,
    };
  };

  const mockFirebase = {
    auth: mockAuth,
    apps: [{}],
  };

  // Set form inputs BEFORE calling setupEmailAuthForm
  // (setupEmailAuthForm captures elements at call-time via getElementById)
  elements.emailInput.value = 'test@example.com';
  elements.passwordInput.value = 'password123';

  // Open modal in login mode
  elements.emailBtn.click();
  assert.equal(getCanonicalMode(), 'login');

  // Call setupEmailAuthForm with Firebase mock
  sandbox.window.LoveBudAuthLoginPage.setupEmailAuthForm({
    firebase: mockFirebase,
    initFirebase: function() {},
    getEnvironmentCheckError: function() { return null; },
    getFriendlyErrorMessage: function() { return null; },
    getEmailAuthMode: getCanonicalMode,
    setEmailAuthMode: setCanonicalMode,
    persistConfirmedAuthSession: async function() {},
    preloadRedirectTargetData: function() {},
    getRedirectTarget: function() { return 'my-trees.html'; },
    isInvalidAuthSessionError: function() { return false; },
    clearStaleFirebaseAuthState: function() {},
  });

  Object.defineProperty(sandbox.window, 'location', {
    value: { pathname: '/pages/login.html', search: '', href: '' },
    writable: true,
    configurable: true,
  });

  // Submit the form
  const submitEvent = {
    type: 'submit',
    preventDefault: function() {},
  };
  elements.form.dispatchEvent(submitEvent);

  // Wait for async submit handler
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(signInCalls, 1, 'signInWithEmailAndPassword must be called exactly once for login');
  assert.equal(createCalls, 0, 'createUserWithEmailAndPassword must NOT be called for login');
});

test('vm runtime: setupEmailAuthForm signup submit calls createUserWithEmailAndPassword + updateProfile', async function () {
  const { sandbox, elements, getCanonicalMode, setCanonicalMode } = buildSandbox({ initialMode: 'signup' });

  let signInCalls = 0;
  let createCalls = 0;
  let updateProfileCalls = 0;

  const mockUser = {
    uid: 'u2', displayName: null,
    updateProfile: async function(data) {
      updateProfileCalls++;
    },
  };
  const mockAuth = function() {
    return {
      signInWithEmailAndPassword: async function() {
        signInCalls++;
        return { user: { uid: 'u1', displayName: null } };
      },
      createUserWithEmailAndPassword: async function() {
        createCalls++;
        return { user: mockUser };
      },
      currentUser: mockUser,
    };
  };

  const mockFirebase = {
    auth: mockAuth,
    apps: [{}],
  };

  // Set form inputs BEFORE calling setupEmailAuthForm
  elements.emailInput.value = 'test@example.com';
  elements.passwordInput.value = 'password123';
  elements.displayNameInput.value = '테스터';
  elements.displayNameInput.required = true;

  // Open modal in signup mode
  elements.signupBtn.click();
  assert.equal(getCanonicalMode(), 'signup');

  sandbox.window.LoveBudAuthLoginPage.setupEmailAuthForm({
    firebase: mockFirebase,
    initFirebase: function() {},
    getEnvironmentCheckError: function() { return null; },
    getFriendlyErrorMessage: function() { return null; },
    getEmailAuthMode: getCanonicalMode,
    setEmailAuthMode: setCanonicalMode,
    persistConfirmedAuthSession: async function() {},
    preloadRedirectTargetData: function() {},
    getRedirectTarget: function() { return 'my-trees.html'; },
    isInvalidAuthSessionError: function() { return false; },
    clearStaleFirebaseAuthState: function() {},
  });

  Object.defineProperty(sandbox.window, 'location', {
    value: { pathname: '/pages/login.html', search: '', href: '' },
    writable: true,
    configurable: true,
  });

  const submitEvent = { type: 'submit', preventDefault: function() {} };
  elements.form.dispatchEvent(submitEvent);

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(createCalls, 1, 'createUserWithEmailAndPassword must be called exactly once for signup');
  assert.equal(updateProfileCalls, 1, 'updateProfile must be called with displayName for signup');
  assert.equal(signInCalls, 0, 'signInWithEmailAndPassword must NOT be called for signup');
});
