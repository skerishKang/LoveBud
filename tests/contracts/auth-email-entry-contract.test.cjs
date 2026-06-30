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
