'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function createSettingsSandbox() {
  var sandbox = {
    window: {},
    document: {
      getElementById: function() { return null; },
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {}
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    localStorage: { getItem: function() { return null; } },
    URL: URL,
    URLSearchParams: URLSearchParams
  };
  sandbox.window = sandbox;
  sandbox.window.console = console;
  sandbox.window.setTimeout = setTimeout;
  sandbox.window.clearTimeout = clearTimeout;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.URL = URL;
  sandbox.window.URLSearchParams = URLSearchParams;
  sandbox.window.location = { origin: 'http://localhost', pathname: '/pages/settings.html', search: '', hash: '' };
  vm.createContext(sandbox);
  var settingsJs = read('js/settings.js');
  vm.runInContext(settingsJs, sandbox);
  return sandbox;
}

// --- provider matrix via resolvePasswordResetMode ---

test('resolvePasswordResetMode: password provider with email → reset', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'pw@example.com', uid: 'pw-1',
    providerData: [{ providerId: 'password' }]
  });
  assert.equal(sandbox._settingsResolvePasswordResetMode(vm), 'reset');
});

test('resolvePasswordResetMode: google+password with email → reset', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'linked@example.com', uid: 'linked-1',
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }]
  });
  assert.equal(sandbox._settingsResolvePasswordResetMode(vm), 'reset');
});

test('resolvePasswordResetMode: password provider without email → missingEmail', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: '', uid: 'noemail-1',
    providerData: [{ providerId: 'password' }]
  });
  assert.equal(sandbox._settingsResolvePasswordResetMode(vm), 'missingEmail');
});

test('resolvePasswordResetMode: google only → googleManaged', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'g@example.com', uid: 'g-1',
    providerData: [{ providerId: 'google.com' }]
  });
  assert.equal(sandbox._settingsResolvePasswordResetMode(vm), 'googleManaged');
});

test('resolvePasswordResetMode: unknown provider → unavailable', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'u@example.com', uid: 'u-1',
    providerData: [{ providerId: 'unknown.provider' }]
  });
  assert.equal(sandbox._settingsResolvePasswordResetMode(vm), 'unavailable');
});

test('resolvePasswordResetMode: null vm → unavailable', () => {
  const sandbox = createSettingsSandbox();
  assert.equal(sandbox._settingsResolvePasswordResetMode(null), 'unavailable');
});

// --- state model ---

test('passwordResetState has correct initial shape', () => {
  const sandbox = createSettingsSandbox();
  var state = sandbox._settingsPasswordResetState;
  assert.equal(state.sending, false);
  assert.equal(state.statusKind, 'none');
  assert.equal(state.mode, 'none');
});

// --- DOM contract IDs in settings.js ---

test('settings.js references required password reset DOM IDs', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('settingsPasswordResetMessage'), 'must reference settingsPasswordResetMessage');
  assert.ok(js.includes('settingsPasswordResetBtn'), 'must reference settingsPasswordResetBtn');
  assert.ok(js.includes('settingsPasswordResetStatus'), 'must reference settingsPasswordResetStatus');
  assert.ok(js.includes('settingsPasswordResetBtnLabel'), 'must reference settingsPasswordResetBtnLabel');
});

test('settings.js sets button type=button', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes("btnEl.type = 'button'"), 'reset button must have type=button');
});

test('settings.js sets status role=status and aria-live=polite', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes("'role', 'status'") || js.includes('"role", "status"'), 'status must have role=status');
  assert.ok(js.includes("'aria-live', 'polite'") || js.includes('"aria-live", "polite"'), 'status must have aria-live=polite');
});

// --- guard patterns ---

test('settings.js guards firebase existence before sendPasswordResetEmail', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes("typeof firebase === 'undefined'") || js.includes('typeof firebase === "undefined"'),
    'must guard typeof firebase');
  assert.ok(js.includes("typeof firebase.auth !== 'function'") || js.includes('typeof firebase.auth !== "function"'),
    'must guard firebase.auth callable');
  assert.ok(js.includes("typeof authInstance.sendPasswordResetEmail !== 'function'") ||
    js.includes('typeof authInstance.sendPasswordResetEmail !== "function"'),
    'must guard sendPasswordResetEmail callable');
});

test('settings.js uses Promise.resolve().then for async reset call', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('Promise.resolve()'), 'must use Promise.resolve() chain');
  assert.ok(js.includes('authInstance.sendPasswordResetEmail(email)'), 'must call sendPasswordResetEmail with email');
});

test('settings.js prevents double-click via sending guard', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('passwordResetState.sending || passwordResetState.statusKind'),
    'must guard sending/sent state before call');
});

// --- i18n keys ---

test('i18n-shared.js contains password reset keys with ko and en', () => {
  const i18n = read('js/i18n/i18n-shared.js');
  var keys = [
    'settings.account.password.resetAction',
    'settings.account.password.resetSending',
    'settings.account.password.resetSent',
    'settings.account.password.resetSendFailed',
    'settings.account.password.resetMissingEmail'
  ];
  for (var key of keys) {
    assert.ok(i18n.includes("'" + key + "'"), 'key ' + key + ' must exist');
    var idx = i18n.indexOf("'" + key + "'");
    var chunk = i18n.substring(idx, idx + 300);
    assert.ok(chunk.includes('ko:'), key + ' must have ko value');
    assert.ok(chunk.includes('en:'), key + ' must have en value');
  }
});

// --- no inline bootstrap / no forbidden changes ---

test('settings.html has no inline executable script', () => {
  const html = read('pages/settings.html');
  const inlineScriptRegex = /<script>(?!<\/script>)[^<]*(?:<[^/][^<]*)*<\/script>/g;
  const matches = html.match(inlineScriptRegex) || [];
  assert.equal(matches.length, 0, 'settings.html must not contain inline executable scripts');
});

test('firebase-config.js does not contain sendPasswordResetEmail', () => {
  const src = read('js/firebase-config.js');
  assert.ok(!src.includes('sendPasswordResetEmail'), 'firebase-config.js must not contain sendPasswordResetEmail');
});

test('shared-header.js does not contain sendPasswordResetEmail', () => {
  const src = read('js/shared-header.js');
  assert.ok(!src.includes('sendPasswordResetEmail'), 'shared-header.js must not contain sendPasswordResetEmail');
});

test('settings-bootstrap.js does not contain sendPasswordResetEmail', () => {
  const src = read('js/settings-bootstrap.js');
  assert.ok(!src.includes('sendPasswordResetEmail'), 'settings-bootstrap.js must not contain sendPasswordResetEmail');
});

test('settings.js does not call initializeApp or reference apiKey', () => {
  const js = read('js/settings.js');
  assert.ok(!js.includes('initializeApp'), 'settings.js must not call initializeApp');
  assert.ok(!js.includes('apiKey'), 'settings.js must not reference apiKey');
});

test('settings.js has exactly one onAuthStateChanged occurrence', () => {
  const js = read('js/settings.js');
  var count = (js.match(/onAuthStateChanged\(/g) || []).length;
  assert.equal(count, 1, 'settings.js must have exactly 1 onAuthStateChanged( occurrence, got ' + count);
});

// --- cache token chain ---

test('settings.html references settings.css with token 20260724-3635-1', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settings.css?v=20260724-3635-1'), 'settings.css token must be 20260724-3635-1');
});

test('settings.html references settings.js with token 20260724-3635-1', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settings.js?v=20260724-3635-1'), 'settings.js token must be 20260724-3635-1');
});

test('settings.html references i18n-shared.js with token 20260724-3635-1', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('i18n-shared.js?v=20260724-3635-1'), 'i18n-shared.js token must be 20260724-3635-1');
});

test('settings.css imports components.css with token 20260724-3635-1', () => {
  const css = read('css/settings.css');
  assert.ok(css.includes('components.css?v=20260724-3635-1'), 'components.css import token must be 20260724-3635-1');
});

// --- settings.js uses sendPasswordResetEmail via compat boundary ---

test('settings.js calls sendPasswordResetEmail via firebase.auth() compat', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('sendPasswordResetEmail'), 'settings.js must call sendPasswordResetEmail');
  assert.ok(js.includes('firebase.auth()'), 'settings.js must use firebase.auth() compat boundary');
});
