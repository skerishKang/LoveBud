const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('login controller defines LoveBudLoginPageController as active boundary with LoveBudAuthLoginPage-compatible method shape', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.match(source, /LoveBudLoginPageController/, 'controller must expose LoveBudLoginPageController as active boundary');
  assert.doesNotMatch(source, /LoveBudAuthLoginPage\s*=/, 'controller must not assign LoveBudAuthLoginPage (it is compatibility/fallback only)');

  for (const methodName of [
    'syncEmailAuthModeUi',
    'setupLoginPageAuthUi',
    'setupGoogleBtn',
    'setupSignupGoogleBtn',
    'setupEmailAuthForm',
    'setupSignupForm',
  ]) {
    assert.match(source, new RegExp(`${methodName}\\s*:`), `controller must define ${methodName}`);
  }

  assert.match(source, /setupSignupForm\s*:\s*noop/, 'controller signup form auth execution must remain noop (auth execution delegated to auth.js via injected callbacks)');
});

test('login controller remains isolated from auth core and redirect/session policy', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.doesNotMatch(source, /LoveBudLoginPageController\s*=\s*[^;]*LoveBudAuthLoginPage/, 'inactive controller must not alias the active provider');
  assert.doesNotMatch(source, /LoveBudAuthLoginPage\s*=/, 'inactive controller must not assign the active provider');
  assert.doesNotMatch(source, /firebase\.auth\(\)/, 'inactive controller must not call Firebase auth directly');
  assert.doesNotMatch(source, /firebase\.auth\(\)\.onAuthStateChanged/, 'inactive controller must not install auth state listeners');
  assert.doesNotMatch(source, /signInWithEmailAndPassword|createUserWithEmailAndPassword|updateProfile/, 'inactive controller must not implement email auth execution');
  assert.doesNotMatch(source, /persistConfirmedAuthSession|preloadRedirectTargetData|getRedirectTarget/, 'inactive controller must not move session or redirect execution');
  assert.doesNotMatch(source, /localStorage|sessionStorage/, 'inactive controller must not touch auth/session cache');
  assert.doesNotMatch(source, /lovebud_auth_cache|lovebud_auth_confirmed|lovebud_auth_token/, 'inactive controller must not reference auth cache keys');
  assert.doesNotMatch(source, /location\.href|location\.assign|location\.replace/, 'inactive controller must not perform redirects');
  assert.doesNotMatch(source, /clearConfirmedAuthCache|clearStaleFirebaseAuthState/, 'inactive controller must not clear auth state');
});

test('login controller inactive parity covers UI selectors and i18n contracts', () => {
  const source = readRepoFile('js/login/login-page.js');

  for (const token of [
    'email_modal_title_signup',
    'email_modal_title_login',
    'email_modal_desc_signup',
    'email_modal_desc_login',
    'signup_btn',
    'login_btn',
    'switch_to_login',
    'switch_to_signup',
    'loginGoogleButton',
    'signupGoogleButton',
    'redirectNotice',
    'emailAuthTitle',
    'emailAuthHelper',
    'emailAuthSubmit',
    'authModeBadge',
  ]) {
    assert.match(source, new RegExp(token), `inactive controller must include ${token}`);
  }
});

test('login controller redirect notice is gated by explicit redirect query param', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.match(source, /new URLSearchParams\(global\.location \? global\.location\.search : ''\)/, 'controller must parse query params without performing navigation');
  assert.match(source, /params\.get\('redirect'\)/, 'redirect notice must use the explicit redirect query param');
  assert.match(source, /noticeEl\.style\.display\s*=\s*redirect \? 'block' : 'none'/, 'redirect notice display must depend on redirect param only');
  assert.doesNotMatch(source, /noticeEl\.style\.display\s*=\s*global\.location\s*&&\s*global\.location\.search/, 'redirect notice must not depend on any query string presence');
});

test('login controller uses idempotent binding guards for UI-only listeners', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.match(source, /function\s+replaceEventListener\s*\(/, 'controller must centralize idempotent listener replacement');
  assert.match(source, /removeEventListener\(eventName, element\[handlerKey\]\)/, 'controller must remove prior listener before re-binding');

  for (const key of [
    '__lovebudLoginControllerGoogleClick',
    '__lovebudLoginControllerSignupGoogleClick',
    '__lovebudLoginControllerEmailToggleClick',
    '__lovebudLoginControllerEmailOpenClick',
    '__lovebudLoginControllerEmailCloseClick',
    '__lovebudLoginControllerEmailBackdropClick',
  ]) {
    assert.match(source, new RegExp(key), `controller must keep idempotent binding guard ${key}`);
  }
});

test('login DOM skeleton stays isolated from auth core and records login page selector contracts', () => {
  const source = readRepoFile('js/login/login-dom.js');

  for (const selector of [
    'login-btn-google',
    'signup-btn-google',
    'email-auth-form',
    'signup-form',
    'email-auth-modal',
    'email-auth-toggle',
    'signup-display-name',
    'login-btn-email',
    'email-auth-close',
    'email-auth-title',
    'email-auth-helper',
    'email-auth-submit',
    'email-auth-display-name',
    'auth-mode-badge',
    'redirect-notice',
    '[data-auth-display-name-wrap]',
  ]) {
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `login DOM skeleton must keep selector ${selector}`);
  }

  assert.match(source, /query\s*:/, 'login DOM skeleton must expose a DOM-only query helper');
  assert.doesNotMatch(source, /firebase/i, 'login DOM skeleton must not depend on Firebase');
  assert.doesNotMatch(source, /localStorage|sessionStorage/, 'login DOM skeleton must not touch auth/session cache');
  assert.doesNotMatch(source, /location\.href|location\.assign|location\.replace/, 'login DOM skeleton must not perform redirects');
});
