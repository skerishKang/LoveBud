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
  ]) {
    assert.match(source, new RegExp(selector), `login DOM skeleton must keep selector ${selector}`);
  }

  assert.doesNotMatch(source, /firebase/i, 'login DOM skeleton must not depend on Firebase');
  assert.doesNotMatch(source, /localStorage|sessionStorage/, 'login DOM skeleton must not touch auth/session cache');
  assert.doesNotMatch(source, /location\.href|location\.assign|location\.replace/, 'login DOM skeleton must not perform redirects');
});
