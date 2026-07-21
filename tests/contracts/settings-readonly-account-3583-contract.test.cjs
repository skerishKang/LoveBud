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

// --- Profile Section ---

test('Profile section exists in settings.html', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settingsProfileSection'), 'Profile section element must exist');
  assert.ok(html.includes('settingsProfileAvatar'), 'Profile avatar element must exist');
  assert.ok(html.includes('settingsProfileName'), 'Profile name element must exist');
  assert.ok(html.includes('settingsProfileEmail'), 'Profile email element must exist');
});

test('Account section exists in settings.html', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settingsAccountSection'), 'Account section element must exist');
  assert.ok(html.includes('settingsAccountEmailValue'), 'Account email value must exist');
  assert.ok(html.includes('settingsAccountIdValue'), 'Account ID value must exist');
  assert.ok(html.includes('settingsAccountSignInValue'), 'Account sign-in value must exist');
  assert.ok(html.includes('settingsAccountPasswordValue'), 'Account password value must exist');
});

// --- display name fallback ---

test('resolveDisplayName uses displayName when available', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveDisplayName({ displayName: 'QA User', email: 'qa@example.com' });
  assert.equal(result, 'QA User');
});

test('resolveDisplayName falls back to email prefix when no displayName', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveDisplayName({ displayName: '', email: 'test-user@example.com' });
  assert.equal(result, 'test-user');
});

test('resolveDisplayName falls back to default when no email', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveDisplayName({ displayName: '', email: '' });
  assert.equal(result, 'LoveBud 사용자');
});

test('resolveDisplayName handles null user', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveDisplayName(null);
  assert.equal(result, 'LoveBud 사용자');
});

// --- initials fallback ---

test('resolveProfileInitials returns two-letter initials for multi-word names', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveProfileInitials({ displayName: 'QA User', email: 'qa@example.com' });
  assert.equal(result, 'QU');
});

test('resolveProfileInitials returns single letter for single-word names', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveProfileInitials({ displayName: 'Chulwon', email: 'c@example.com' });
  assert.equal(result, 'C');
});

test('resolveProfileInitials returns L for empty name', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveProfileInitials({ displayName: '', email: '' });
  // When displayName is empty and email is empty, displayName resolves to 'LoveBud 사용자'
  // which splits to ['LoveBud', '사용자'] → initials = 'L' + '사' = 'L사'
  assert.equal(result, 'L사');
});

// --- provider detection ---

test('resolveSignInMethods returns google for Google provider', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({ providerData: [{ providerId: 'google.com' }] });
  assert.equal(JSON.stringify(result), JSON.stringify(['google']));
});

test('resolveSignInMethods returns password for email provider', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({ providerData: [{ providerId: 'password' }] });
  assert.equal(JSON.stringify(result), JSON.stringify(['password']));
});

test('resolveSignInMethods returns multiple methods for multiple providers', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({
    providerData: [
      { providerId: 'google.com' },
      { providerId: 'password' }
    ]
  });
  assert.equal(JSON.stringify(result), JSON.stringify(['google', 'password']));
});

test('resolveSignInMethods returns ["unknown"] for empty providerData', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({ providerData: [] });
  assert.equal(JSON.stringify(result), JSON.stringify(['unknown']));
});

test('resolveSignInMethods returns ["unknown"] for null user', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods(null);
  assert.equal(JSON.stringify(result), JSON.stringify(['unknown']));
});

// --- full view model ---

test('resolveSettingsAccountViewModel produces correct Google account model', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'qa@example.com',
    uid: 'qa-owner-3583',
    displayName: 'QA User',
    photoURL: 'https://example.com/photo.jpg',
    providerData: [{ providerId: 'google.com' }]
  });
  assert.equal(vm.email, 'qa@example.com');
  assert.equal(vm.uid, 'qa-owner-3583');
  assert.equal(vm.displayName, 'QA User');
  assert.equal(vm.photoURL, 'https://example.com/photo.jpg');
  assert.equal(JSON.stringify(vm.signInMethods), JSON.stringify(['google']));
  assert.equal(vm.passwordInfo, 'google');
});

test('resolveSettingsAccountViewModel produces correct password account model', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'password-user@example.com',
    uid: 'password-owner-3583',
    displayName: '',
    photoURL: null,
    providerData: [{ providerId: 'password' }]
  });
  assert.equal(vm.email, 'password-user@example.com');
  assert.equal(vm.uid, 'password-owner-3583');
  assert.equal(vm.displayName, 'password-user');
  assert.equal(vm.photoURL, '');
  assert.equal(JSON.stringify(vm.signInMethods), JSON.stringify(['password']));
  assert.equal(vm.passwordInfo, 'deferred');
});

test('resolveSettingsAccountViewModel handles unknown provider', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'x@y.com',
    uid: 'uid-1',
    providerData: [{ providerId: 'unknown.provider' }]
  });
  assert.equal(vm.passwordInfo, 'unavailable');
});

// --- innerHTML safety ---

test('settings.js does not use innerHTML for user data rendering', () => {
  const js = read('js/settings.js');
  // Check that renderProfileSection and renderAccountSection use textContent
  assert.ok(js.includes('nameEl.textContent = vm.displayName'), 'displayName must use textContent');
  assert.ok(js.includes('emailEl.textContent = vm.email'), 'profile email must use textContent');
  assert.ok(js.includes('emailValueEl.textContent = vm.email'), 'account email must use textContent');
  assert.ok(js.includes('idValueEl.textContent = vm.uid'), 'account ID must use textContent');
});

// --- write API prohibition ---

test('settings.js does not call user.updateProfile', () => {
  const js = read('js/settings.js');
  assert.ok(!js.includes('updateProfile'), 'settings.js must not call updateProfile');
});

test('settings.js does not call sendPasswordResetEmail', () => {
  const js = read('js/settings.js');
  assert.ok(!js.includes('sendPasswordResetEmail'), 'settings.js must not call sendPasswordResetEmail');
});

// --- logout production path ---

test('handleLogout uses window.signOut first', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes("window.signOut"), 'handleLogout must use window.signOut');
  assert.ok(js.includes("window.LoveBudAuthFirebase"), 'handleLogout must use LoveBudAuthFirebase fallback');
});

// --- shared header no duplicate ---

test('settings.js does not call renderSharedHeader', () => {
  const js = read('js/settings.js');
  assert.ok(!js.includes('renderSharedHeader'), 'settings.js must not call renderSharedHeader (called from HTML)');
});

// --- i18n keys exist ---

test('i18n-shared.js contains settings.profile.* keys', () => {
  const i18n = read('js/i18n/i18n-shared.js');
  assert.ok(i18n.includes("'settings.profile.title'"), 'settings.profile.title key must exist');
  assert.ok(i18n.includes("'settings.profile.displayName'"), 'settings.profile.displayName key must exist');
  assert.ok(i18n.includes("'settings.profile.email'"), 'settings.profile.email key must exist');
  assert.ok(i18n.includes("'settings.profile.changeDeferred'"), 'settings.profile.changeDeferred key must exist');
});

test('i18n-shared.js contains settings.account.* keys', () => {
  const i18n = read('js/i18n/i18n-shared.js');
  assert.ok(i18n.includes("'settings.account.title'"), 'settings.account.title key must exist');
  assert.ok(i18n.includes("'settings.account.email'"), 'settings.account.email key must exist');
  assert.ok(i18n.includes("'settings.account.id'"), 'settings.account.id key must exist');
  assert.ok(i18n.includes("'settings.account.signInMethod'"), 'settings.account.signInMethod key must exist');
  assert.ok(i18n.includes("'settings.account.password'"), 'settings.account.password key must exist');
  assert.ok(i18n.includes("'settings.account.provider.google'"), 'settings.account.provider.google key must exist');
  assert.ok(i18n.includes("'settings.account.provider.password'"), 'settings.account.provider.password key must exist');
  assert.ok(i18n.includes("'settings.account.provider.unknown'"), 'settings.account.provider.unknown key must exist');
  assert.ok(i18n.includes("'settings.account.password.googleManaged'"), 'settings.account.password.googleManaged key must exist');
  assert.ok(i18n.includes("'settings.account.password.deferred'"), 'settings.account.password.deferred key must exist');
  assert.ok(i18n.includes("'settings.account.password.unavailable'"), 'settings.account.password.unavailable key must exist');
});

test('i18n keys have both ko and en values', () => {
  const i18n = read('js/i18n/i18n-shared.js');
  var keys = [
    'settings.profile.title', 'settings.profile.displayName', 'settings.profile.email',
    'settings.profile.changeDeferred', 'settings.account.title', 'settings.account.email',
    'settings.account.id', 'settings.account.signInMethod', 'settings.account.password',
    'settings.account.provider.google', 'settings.account.provider.password',
    'settings.account.provider.unknown', 'settings.account.password.googleManaged',
    'settings.account.password.deferred', 'settings.account.password.unavailable'
  ];
  for (var key of keys) {
    assert.ok(i18n.includes("'" + key + "'"), 'key ' + key + ' must exist');
    // Find the key and check ko/en are present nearby
    var idx = i18n.indexOf("'" + key + "'");
    var chunk = i18n.substring(idx, idx + 300);
    assert.ok(chunk.includes('ko:'), key + ' must have ko value');
    assert.ok(chunk.includes('en:'), key + ' must have en value');
  }
});

// --- HTML accessibility ---

test('settings.html uses semantic section elements', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('<section'), 'settings.html must use section elements');
  assert.ok(html.includes('aria-labelledby'), 'settings.html must use aria-labelledby');
});

test('settings.html logout button has type=button', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('type="button"'), 'logout button must have type=button');
});

test('settings.html avatar has role=img and aria-label', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('role="img"'), 'avatar must have role=img');
  assert.ok(html.includes('aria-label="프로필 이미지"'), 'avatar must have aria-label');
});

// --- deferred note exists ---

test('settings.html has deferred profile change note', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settingsProfileDeferredNote'), 'deferred note element must exist');
});

// --- new tests from spec ---

test('resolveDisplayName falls back to email prefix for whitespace-only displayName', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveDisplayName({ displayName: '   ', email: 'space-user@example.com' });
  assert.equal(result, 'space-user');
});

test('resolveSignInMethods returns ["google", "password"] for linked account', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }]
  });
  assert.equal(JSON.stringify(result), JSON.stringify(['google', 'password']));
});

test('resolveSettingsAccountViewModel: google+password → passwordInfo deferred', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'linked@example.com',
    uid: 'linked-1',
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }]
  });
  assert.equal(vm.passwordInfo, 'deferred');
  assert.equal(JSON.stringify(vm.signInMethods), JSON.stringify(['google', 'password']));
});

test('resolveSettingsAccountViewModel: google only → passwordInfo google', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'g@example.com',
    uid: 'g-1',
    providerData: [{ providerId: 'google.com' }]
  });
  assert.equal(vm.passwordInfo, 'google');
});

test('resolveSettingsAccountViewModel: password only → passwordInfo deferred', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'p@example.com',
    uid: 'p-1',
    providerData: [{ providerId: 'password' }]
  });
  assert.equal(vm.passwordInfo, 'deferred');
});

test('resolveSettingsAccountViewModel: unknown only → passwordInfo unavailable', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'u@example.com',
    uid: 'u-1',
    providerData: [{ providerId: 'unknown.provider' }]
  });
  assert.equal(vm.passwordInfo, 'unavailable');
  assert.equal(JSON.stringify(vm.signInMethods), JSON.stringify(['unknown']));
});

test('resolveSignInMethods deduplicates google.com entries', () => {
  const sandbox = createSettingsSandbox();
  var result = sandbox.resolveSignInMethods({
    providerData: [{ providerId: 'google.com' }, { providerId: 'google.com' }]
  });
  assert.equal(JSON.stringify(result), JSON.stringify(['google']));
});

test('resolveSettingsAccountViewModel has no providerLabel property', () => {
  const sandbox = createSettingsSandbox();
  var vm = sandbox.resolveSettingsAccountViewModel({
    email: 'test@example.com',
    uid: 'uid-1',
    providerData: [{ providerId: 'google.com' }]
  });
  assert.equal(vm.providerLabel, undefined, 'providerLabel must not exist on view model');
});

test('settings.js does not use innerHTML for user data', () => {
  const src = read('js/settings.js');
  const lines = src.split('\n');
  const unsafeLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('.innerHTML') && !line.includes('//') && !line.includes('/*')) {
      unsafeLines.push({ line: i + 1, content: line.trim() });
    }
  }
  assert.equal(unsafeLines.length, 0, 'settings.js must not use innerHTML');
});

test('settings.html has no Plus note', () => {
  const html = read('pages/settings.html');
  assert.ok(!html.includes('settingsPlusNote'), 'Plus note element must not exist');
  assert.ok(!html.includes('프라이빗 보관 기능은 Plus'), 'Plus note text must not exist');
});

// --- CSP Bootstrap Contract ---

test('settings.html has no inline executable script', () => {
  const html = read('pages/settings.html');
  // Match <script>...</script> WITHOUT src attribute (inline executable)
  const inlineScriptRegex = /<script>(?!<\/script>)[^<]*(?:<[^/][^<]*)*<\/script>/g;
  const matches = html.match(inlineScriptRegex) || [];
  assert.equal(matches.length, 0, 'settings.html must not contain inline executable scripts, got: ' + JSON.stringify(matches));
});

test('settings.html loads external settings-bootstrap.js', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('settings-bootstrap.js'), 'settings.html must reference settings-bootstrap.js');
  // Must be after settings.js
  const settingsIdx = html.indexOf('settings.js?');
  const bootstrapIdx = html.indexOf('settings-bootstrap.js?');
  assert.ok(bootstrapIdx > settingsIdx, 'settings-bootstrap.js must appear after settings.js');
});

test('settings-bootstrap.js exists and is CSP-safe', () => {
  const src = read('js/settings-bootstrap.js');
  assert.ok(src.includes('renderSharedHeader'), 'bootstrap must call renderSharedHeader');
  assert.ok(src.includes('initSettings'), 'bootstrap must call initSettings');
  assert.ok(src.includes('__lovebudSettingsBootstrapStarted'), 'bootstrap must have idempotency guard');
  // Must not contain inline script tags or eval
  assert.ok(!src.includes('eval('), 'bootstrap must not use eval');
});

test('bootstrap renders once on double evaluation', () => {
  const src = read('js/settings-bootstrap.js');
  const sandbox = {
    window: {},
    Error: Error,
    console: console
  };
  sandbox.window = sandbox;
  let renderCalls = 0;
  let initCalls = 0;
  sandbox.window.renderSharedHeader = function() { renderCalls++; };
  sandbox.window.initSettings = function() { initCalls++; };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(renderCalls, 1, 'renderSharedHeader must be called exactly once');
  assert.equal(initCalls, 1, 'initSettings must be called exactly once');
});

test('bootstrap throws when renderSharedHeader is missing', () => {
  const src = read('js/settings-bootstrap.js');
  const sandbox = { window: {}, Error: Error, console: console };
  sandbox.window = sandbox;
  sandbox.window.initSettings = function() {};
  vm.createContext(sandbox);
  assert.throws(() => vm.runInContext(src, sandbox), /renderSharedHeader/);
});

test('bootstrap throws when initSettings is missing', () => {
  const src = read('js/settings-bootstrap.js');
  const sandbox = { window: {}, Error: Error, console: console };
  sandbox.window = sandbox;
  sandbox.window.renderSharedHeader = function() {};
  vm.createContext(sandbox);
  assert.throws(() => vm.runInContext(src, sandbox), /initSettings/);
});

test('_headers CSP script-src has no unsafe-inline or unsafe-eval', () => {
  const headers = read('_headers');
  const m = headers.match(/script-src\s+([^;]+)/);
  assert.ok(m, '_headers must contain script-src directive');
  assert.ok(!m[1].includes("'unsafe-inline'"), 'script-src must not contain unsafe-inline');
  assert.ok(!m[1].includes("'unsafe-eval'"), 'script-src must not contain unsafe-eval');
});
