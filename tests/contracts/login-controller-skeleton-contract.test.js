const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('login controller skeleton defines the LoveBudAuthLoginPage-compatible method shape without runtime wiring', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.match(source, /LoveBudLoginPageController/, 'skeleton must expose the isolated login page controller namespace');
  assert.doesNotMatch(source, /LoveBudAuthLoginPage\s*=/, 'skeleton must not replace the active auth-login-page provider before wiring is approved');

  for (const methodName of [
    'syncEmailAuthModeUi',
    'setupLoginPageAuthUi',
    'setupGoogleBtn',
    'setupSignupGoogleBtn',
    'setupEmailAuthForm',
    'setupSignupForm',
  ]) {
    assert.match(source, new RegExp(`${methodName}\\s*:`), `skeleton must define ${methodName}`);
  }
});

test('login controller remains isolated from auth core and redirect/session policy', () => {
  const source = readRepoFile('js/login/login-page.js');

  assert.doesNotMatch(source, /LoveBudLoginPageController\s*=\s*[^;]*LoveBudAuthLoginPage/, 'inactive controller must not alias the active provider');
  assert.doesNotMatch(source, /LoveBudAuthLoginPage\s*=/, 'inactive controller must not assign the active provider');
  assert.doesNotMatch(source, /firebase\.auth\(\)\.onAuthStateChanged/, 'inactive controller must not install auth state listeners');
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
