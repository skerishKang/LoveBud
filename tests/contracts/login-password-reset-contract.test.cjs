const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Login Password Reset Contract', async (t) => {
  const loginHtml = read('pages/login.html');
  const authLoginPageJs = read('js/auth/auth-login-page.js');
  const i18nLogin = read('js/i18n/i18n-login.js');
  const loginDom = read('js/login/login-dom.js');
  const formsCss = read('css/login/forms.css');

  // 1. login.html has reset button/wrapper/type="button"
  await t.test('login.html contains email-auth-reset button with type="button"', () => {
    assert.ok(loginHtml.includes('id="email-auth-reset"'),
      'login.html must have email-auth-reset button');
    assert.ok(loginHtml.includes('type="button"'),
      'reset button must be type="button" to avoid form submit');
    assert.ok(loginHtml.includes('id="email-auth-reset-wrap"'),
      'login.html must have email-auth-reset-wrap wrapper');
    assert.ok(loginHtml.includes('login-form-reset-link'),
      'reset button must use login-form-reset-link class');
  });

  // 2. reset button positioned after password, before submit
  await t.test('reset button appears after password input and before submit', () => {
    const pwdIdx = loginHtml.indexOf('email-auth-password');
    const resetIdx = loginHtml.indexOf('email-auth-reset');
    const submitIdx = loginHtml.indexOf('email-auth-submit');
    assert.ok(pwdIdx > 0 && resetIdx > 0 && submitIdx > 0, 'all elements must exist');
    assert.ok(resetIdx > pwdIdx, 'reset must appear after password input');
    assert.ok(submitIdx > resetIdx, 'submit must appear after reset');
  });

  // 3. i18n keys exist
  await t.test('i18n login has password reset keys in KO and EN', () => {
    const required = ['password_reset_link', 'password_reset_sending',
      'password_reset_confirmation', 'password_reset_email_required'];
    for (const key of required) {
      assert.ok(i18nLogin.includes("'" + key + "'"),
        'i18n-login.js must define "' + key + '"');
      assert.ok(i18nLogin.includes("ko: '"),
        key + ' must have Korean text');
      assert.ok(i18nLogin.includes("en: '"),
        key + ' must have English text');
    }
  });

  // 4. selector inventory has reset button/wrapper
  await t.test('login-dom.js SELECTORS includes emailAuthReset and emailAuthResetWrap', () => {
    assert.ok(loginDom.includes("emailAuthReset: 'email-auth-reset'"),
      'login-dom.js must have emailAuthReset selector');
    assert.ok(loginDom.includes("emailAuthResetWrap: 'email-auth-reset-wrap'"),
      'login-dom.js must have emailAuthResetWrap selector');
  });

  // 5. setupEmailAuthForm calls sendPasswordResetEmail
  await t.test('auth-login-page.js setupEmailAuthForm calls sendPasswordResetEmail', () => {
    assert.ok(authLoginPageJs.includes('sendPasswordResetEmail(email)'),
      'setupEmailAuthForm must call sendPasswordResetEmail');
  });

  // 6. email required guard + focus
  await t.test('reset handler validates email and restores focus', () => {
    assert.ok(authLoginPageJs.includes('emailInput.focus()'),
      'reset handler must focus email input when empty');
    assert.ok(authLoginPageJs.includes("password_reset_email_required"),
      'reset handler must reference email_required i18n key');
  });

  // 6b. email format validation guard before Firebase call
  await t.test('reset handler validates email format before calling Firebase', () => {
    assert.ok(authLoginPageJs.includes("checkValidity") || authLoginPageJs.includes("emailRegex"),
      'reset handler must validate email format');
    assert.ok(authLoginPageJs.includes("auth/invalid-email"),
      'reset handler must reference auth/invalid-email for format errors');
    const resetHandler = authLoginPageJs.match(/resetBtn\.addEventListener[\s\S]*?sendPasswordResetEmail/);
    if (resetHandler) {
      const beforeFirebase = resetHandler[0].split('sendPasswordResetEmail')[0];
      assert.ok(beforeFirebase.includes('checkValidity') || beforeFirebase.includes('emailRegex'),
        'email format validation must appear before sendPasswordResetEmail call');
    }
  });

  // 7. login mode visibility / signup mode hidden
  await t.test('reset button has syncResetVisibility for login/signup mode', () => {
    assert.ok(authLoginPageJs.includes('resetWrap.hidden = !isLogin'),
      'reset wrap must be hidden in signup mode');
    assert.ok(authLoginPageJs.includes('resetBtn.disabled = !isLogin'),
      'reset button must be disabled in signup mode');
    assert.ok(authLoginPageJs.includes('syncResetVisibility'),
      'syncResetVisibility function must be defined');
  });

  // 8. sending disabled → mode-safe finally restore via syncResetVisibility
  await t.test('reset handler disables button while sending, restores via syncResetVisibility in finally', () => {
    assert.ok(authLoginPageJs.includes('resetBtn.disabled = true'),
      'reset handler must disable button while sending');
    // finally no longer uses raw disabled=false — uses mode-safe syncResetVisibility
    assert.ok(!authLoginPageJs.match(/finally[\s\S]{0,80}resetBtn\.disabled\s*=\s*false/),
      'finally must NOT blindly re-enable reset button — must use syncResetVisibility instead');
    assert.ok(authLoginPageJs.includes('syncResetVisibility();'),
      'finally must call syncResetVisibility() for mode-safe restore');
    assert.ok(authLoginPageJs.includes('password_reset_sending'),
      'reset handler must show sending text');
  });

  // 9. auth/user-not-found uses generic confirmation
  await t.test('auth/user-not-found handled as generic confirmation (privacy-safe)', () => {
    assert.ok(authLoginPageJs.includes("error.code === 'auth/user-not-found'") ||
              authLoginPageJs.includes('user-not-found'),
      'reset handler must handle auth/user-not-found');
    assert.ok(authLoginPageJs.includes('password_reset_confirmation'),
      'user-not-found must show same generic confirmation');
  });

  // 10. No redirect, persistence, Admin SDK, fetch, API, test-account in handler
  await t.test('reset handler does not use redirect, persistence, Admin SDK, fetch, API, test accounts', () => {
    const handlerRegion = authLoginPageJs.match(/resetBtn\.addEventListener[\s\S]*?\}\)\s*\n\s*\}/);
    if (handlerRegion) {
      const body = handlerRegion[0];
      const forbidden = ['redirect', 'redirectTarget', 'persistConfirmedAuthSession',
        'signOut', 'api/', '/api', 'fetch(', 'firebase-admin', 'admin'];
      for (const pattern of forbidden) {
        assert.ok(!body.includes(pattern),
          'reset handler must not contain "' + pattern + '"');
      }
    }
  });

  // 11. CSS reset text-link + :focus-visible
  await t.test('CSS has .login-form-reset-link with :focus-visible', () => {
    assert.ok(formsCss.includes('.login-form-reset-link'),
      'CSS must define .login-form-reset-link');
    assert.ok(formsCss.includes('.login-form-reset-link:focus-visible'),
      'CSS must define .login-form-reset-link:focus-visible');
    assert.ok(formsCss.includes('.login-form-reset-link:hover'),
      'CSS must define .login-form-reset-link:hover');
    assert.ok(formsCss.includes('.login-form-reset-link:disabled'),
      'CSS must define .login-form-reset-link:disabled');
    assert.ok(formsCss.includes('.login-form-reset-wrap'),
      'CSS must define .login-form-reset-wrap');
  });

  // 12. Existing signInWithEmailAndPassword / createUserWithEmailAndPassword intact
  await t.test('existing auth flows are preserved unchanged', () => {
    assert.ok(authLoginPageJs.includes('signInWithEmailAndPassword'),
      'setupEmailAuthForm must still signInWithEmailAndPassword');
    assert.ok(authLoginPageJs.includes('createUserWithEmailAndPassword'),
      'setupEmailAuthForm must still createUserWithEmailAndPassword');
  });
});
