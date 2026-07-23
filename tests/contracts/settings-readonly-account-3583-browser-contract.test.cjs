/**
 * #3583 Chromium browser contract — read-only Profile / Account settings.
 *
 * Loads the real settings page, i18n, shared-header, auth, and settings scripts.
 * Firebase SDK transport is replaced with a controlled local fixture; no real
 * Firebase or Production account is used.
 */
'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const ACCOUNTS = {
  koGoogle: {
    displayName: 'QA User', email: 'qa@example.com', uid: 'qa-owner-3583',
    providerData: [{ providerId: 'google.com' }], photoURL: null
  },
  enPassword: {
    displayName: '', email: 'password-user@example.com', uid: 'password-owner-3583',
    providerData: [{ providerId: 'password' }], photoURL: null
  },
  enLinked: {
    displayName: 'Linked User', email: 'linked@example.com', uid: 'linked-owner-3583',
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }], photoURL: null
  },
  enUnknown: {
    displayName: '', email: 'unknown@example.com', uid: 'unknown-owner-3583',
    providerData: [{ providerId: 'unknown.provider' }], photoURL: null
  }
};

const CSP = "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; media-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://relovetree.firebaseapp.com; connect-src 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";

let server;
let browser;
let baseUrl;

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise(function(resolve, reject) {
    const local = http.createServer(function(req, res) {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (pathname === '/__avatar.png') {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': PNG_1X1.length });
        res.end(PNG_1X1);
        return;
      }
      if (pathname === '/__broken-avatar.png') {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': 3 });
        res.end(Buffer.from('bad'));
        return;
      }
      const normalized = pathname === '/' ? '/pages/settings.html' : pathname;
      const filePath = path.resolve(ROOT, '.' + normalized);
      if (!filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      try {
        const data = fs.readFileSync(filePath);
        const headers = { 'Content-Type': contentType(filePath) };
        if (filePath.endsWith('.html')) {
          headers['Content-Security-Policy'] = CSP;
        }
        res.writeHead(200, headers);
        res.end(data);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      }
    });
    local.once('error', reject);
    local.listen(0, '127.0.0.1', function() { resolve(local); });
  });
}

function authFixtureScript(user, lang) {
  return function fixture(payload) {
    const fixtureUser = payload.user;
    localStorage.setItem('lovebud_lang', payload.lang);
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem('lovebud_auth_cache', JSON.stringify(fixtureUser));

    const authInstance = {
      currentUser: fixtureUser,
      onAuthStateChanged: function(callback) {
        Promise.resolve().then(function() { callback(fixtureUser); });
        return function() {};
      },
      signOut: function() { return Promise.resolve(); },
      setPersistence: function() { return Promise.resolve(); },
      getRedirectResult: function() { return Promise.resolve({ user: null }); }
    };
    function auth() { return authInstance; }
    auth.Auth = { Persistence: { LOCAL: 'local' } };
    window.firebase = {
      apps: [{}],
      auth: auth,
      initializeApp: function() { return {}; }
    };

    window.LoveBudProtectedRoute = {
      getAuthState: function() { return { ready: true, user: fixtureUser }; },
      getAuthenticatedUser: function() { return fixtureUser; },
      requireAuthenticatedPage: function(options) {
        if (options && typeof options.onAuthenticated === 'function') {
          options.onAuthenticated(fixtureUser);
        }
      }
    };
  };
}

async function newSettingsPage(options) {
  const opts = options || {};
  const user = Object.assign({}, opts.user || ACCOUNTS.koGoogle);
  const lang = opts.lang || 'ko';
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = { page: [], console: [] };
  page.on('pageerror', function(error) { errors.page.push(error.message); });
  page.on('console', function(message) {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  await page.route('https://www.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* controlled Firebase fixture */' });
  });
  await page.route('https://fonts.googleapis.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.addInitScript(authFixtureScript(user, lang), { user, lang });
  const suffix = opts.returnTo
    ? '?returnTo=' + encodeURIComponent(opts.returnTo) + '&lang=' + lang
    : '?lang=' + lang;
  await page.goto(baseUrl + '/pages/settings.html' + suffix, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function(expected) {
    const email = document.getElementById('settingsProfileEmail');
    const accountEmail = document.getElementById('settingsAccountEmailValue');
    return email && accountEmail && email.textContent === expected && accountEmail.textContent === expected;
  }, user.email, { timeout: 10000 });
  return { context, page, errors, user };
}

async function closeFixture(fixture) {
  await fixture.context.close();
}

function assertNoErrors(fixture, label) {
  assert.deepEqual(fixture.errors.page, [], label + ' pageerror must be 0');
  assert.deepEqual(fixture.errors.console, [], label + ' console error must be 0');
}

before(async function() {
  server = await startServer();
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
});

after(async function() {
  if (browser) await browser.close();
  if (server) await new Promise(function(resolve) { server.close(resolve); });
});

test('Korean Google account renders exact read-only values', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko' });
  try {
    const values = await fixture.page.evaluate(function() {
      return {
        title: document.getElementById('settingsTitle').textContent,
        subtitle: document.getElementById('settingsSubtitle').textContent,
        name: document.getElementById('settingsProfileName').textContent,
        profileEmail: document.getElementById('settingsProfileEmail').textContent,
        accountEmail: document.getElementById('settingsAccountEmailValue').textContent,
        uid: document.getElementById('settingsAccountIdValue').textContent,
        methods: document.getElementById('settingsAccountSignInValue').textContent,
        password: document.getElementById('settingsAccountPasswordValue').textContent
      };
    });
    assert.deepEqual(values, {
      title: '설정', subtitle: '프로필과 로그인 정보를 확인합니다', name: 'QA User',
      profileEmail: 'qa@example.com', accountEmail: 'qa@example.com', uid: 'qa-owner-3583',
      methods: 'Google', password: '비밀번호는 Google 계정에서 관리됩니다.'
    });
    assertNoErrors(fixture, 'ko Google');
  } finally { await closeFixture(fixture); }
});

test('English password account shows reset button with repository i18n label', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.enPassword, lang: 'en' });
  try {
    const values = await fixture.page.evaluate(function() {
      return {
        title: document.getElementById('settingsTitle').textContent,
        subtitle: document.getElementById('settingsSubtitle').textContent,
        name: document.getElementById('settingsProfileName').textContent,
        methods: document.getElementById('settingsAccountSignInValue').textContent,
        resetBtnExists: !!document.getElementById('settingsPasswordResetBtn'),
        resetBtnType: (document.getElementById('settingsPasswordResetBtn') || {}).type || '',
        resetLabel: (document.getElementById('settingsPasswordResetBtnLabel') || {}).textContent || ''
      };
    });
    assert.equal(values.title, 'Settings');
    assert.equal(values.subtitle, 'Review your profile and sign-in information');
    assert.equal(values.name, 'password-user');
    assert.equal(values.methods, 'Email and password');
    assert.equal(values.resetBtnExists, true, 'password account must show reset button');
    assert.equal(values.resetBtnType, 'button');
    assert.equal(values.resetLabel, 'Send password reset email');
    assertNoErrors(fixture, 'en password');
  } finally { await closeFixture(fixture); }
});

test('English linked account renders canonical methods and reset button', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.enLinked, lang: 'en' });
  try {
    assert.equal(await fixture.page.locator('#settingsAccountSignInValue').textContent(), 'Google, Email and password');
    const resetBtnExists = await fixture.page.evaluate(function() {
      return !!document.getElementById('settingsPasswordResetBtn');
    });
    assert.equal(resetBtnExists, true, 'linked account must show reset button');
    assert.equal(await fixture.page.locator('#settingsPasswordResetBtnLabel').textContent(), 'Send password reset email');
    assertNoErrors(fixture, 'en linked');
  } finally { await closeFixture(fixture); }
});

test('English unknown provider never exposes the raw provider ID', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.enUnknown, lang: 'en' });
  try {
    assert.equal(await fixture.page.locator('#settingsAccountSignInValue').textContent(), 'Sign-in method unknown');
    assert.equal(await fixture.page.locator('#settingsAccountPasswordValue').textContent(),
      'Password management is not available for the current sign-in method.');
    assert.equal((await fixture.page.locator('body').innerText()).includes('unknown.provider'), false);
    assertNoErrors(fixture, 'en unknown');
  } finally { await closeFixture(fixture); }
});

test('localized initials avatar matrix: Korean and English', async function() {
  for (const entry of [{ lang: 'ko', expected: 'QA User님의 프로필' }, { lang: 'en', expected: 'Profile for QA User' }]) {
    const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: entry.lang });
    try {
      const avatar = fixture.page.locator('#settingsProfileAvatar');
      assert.equal(await avatar.getAttribute('role'), 'img');
      assert.equal(await avatar.getAttribute('aria-label'), entry.expected);
      assert.equal(await avatar.locator('img').count(), 0);
      assert.equal((await avatar.textContent()).trim(), 'QU');
      assert.equal(await avatar.locator('.settings-profile-avatar-initials').count(), 0);
      assertNoErrors(fixture, entry.lang + ' initials');
    } finally { await closeFixture(fixture); }
  }
});

test('localized valid photo avatar matrix has one accessible-name owner', async function() {
  for (const entry of [{ lang: 'ko', expected: 'QA User님의 프로필 사진' }, { lang: 'en', expected: 'Profile photo for QA User' }]) {
    const user = Object.assign({}, ACCOUNTS.koGoogle, { photoURL: baseUrl + '/__avatar.png' });
    const fixture = await newSettingsPage({ user, lang: entry.lang });
    try {
      const avatar = fixture.page.locator('#settingsProfileAvatar');
      await avatar.locator('img').waitFor({ state: 'attached' });
      assert.equal(await avatar.getAttribute('aria-label'), entry.expected);
      assert.equal(await avatar.locator('img.settings-profile-avatar-img').count(), 1);
      assert.equal(await avatar.locator('img').getAttribute('alt'), '');
      assert.equal(await avatar.locator('img').getAttribute('aria-label'), null);
      assertNoErrors(fixture, entry.lang + ' valid photo');
    } finally { await closeFixture(fixture); }
  }
});

test('localized broken photo avatar matrix falls back once and removes image state', async function() {
  for (const entry of [{ lang: 'ko', expected: 'QA User님의 프로필' }, { lang: 'en', expected: 'Profile for QA User' }]) {
    const user = Object.assign({}, ACCOUNTS.koGoogle, { photoURL: baseUrl + '/__broken-avatar.png' });
    const fixture = await newSettingsPage({ user, lang: entry.lang });
    try {
      const avatar = fixture.page.locator('#settingsProfileAvatar');
      await fixture.page.waitForFunction(function() {
        const node = document.getElementById('settingsProfileAvatar');
        return node && node.querySelectorAll('img').length === 0 && node.textContent.trim() === 'QU';
      });
      assert.equal(await avatar.getAttribute('aria-label'), entry.expected);
      assert.equal(await avatar.locator('img').count(), 0);
      assert.equal(await avatar.locator('.settings-profile-avatar-img').count(), 0);
      assert.equal(await avatar.evaluate(function(node) { return node.classList.contains('settings-profile-avatar-img-wrap'); }), false);
      assert.equal((await avatar.textContent()).trim(), 'QU');
      assertNoErrors(fixture, entry.lang + ' broken photo');
    } finally { await closeFixture(fixture); }
  }
});

test('shared header reaches exactly one canonical final auth structure', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko' });
  try {
    await fixture.page.waitForSelector('#auth-nav .user-dropdown > .user-dropdown-trigger');
    const counts = await fixture.page.evaluate(function() {
      return {
        header: document.querySelectorAll('#shared-header > header.nav-bar').length,
        authNav: document.querySelectorAll('#auth-nav').length,
        dropdown: document.querySelectorAll('#auth-nav .user-dropdown').length,
        trigger: document.querySelectorAll('#auth-nav .user-dropdown > .user-dropdown-trigger').length,
        cached: document.querySelectorAll('#auth-nav .cached-avatar-link').length
      };
    });
    assert.deepEqual(counts, { header: 1, authNav: 1, dropdown: 1, trigger: 1, cached: 0 });
    assertNoErrors(fixture, 'shared header');
  } finally { await closeFixture(fixture); }
});

test('Close navigates to the exact returnTo pathname', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko', returnTo: '/pages/my-trees.html' });
  try {
    await Promise.all([
      fixture.page.waitForURL(function(url) { return url.pathname === '/pages/my-trees.html'; }),
      fixture.page.click('#settingsCloseBtn')
    ]);
    assert.equal(new URL(fixture.page.url()).pathname, '/pages/my-trees.html');
  } finally { await closeFixture(fixture); }
});

test('Escape navigates to the exact returnTo pathname', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko', returnTo: '/pages/my-trees.html' });
  try {
    await Promise.all([
      fixture.page.waitForURL(function(url) { return url.pathname === '/pages/my-trees.html'; }),
      fixture.page.keyboard.press('Escape')
    ]);
    assert.equal(new URL(fixture.page.url()).pathname, '/pages/my-trees.html');
  } finally { await closeFixture(fixture); }
});

test('Settings footer logout: one button, one click, one signOut call', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko' });
  try {
    assert.equal(await fixture.page.locator('#logout-btn.logout-btn').count(), 1);
    await fixture.page.evaluate(function() {
      window.__signOutCalled = 0;
      window.signOut = function() {
        window.__signOutCalled += 1;
        return new Promise(function() {});
      };
    });
    await fixture.page.click('#logout-btn');
    await fixture.page.waitForFunction(function() { return window.__signOutCalled === 1; });
    assert.equal(await fixture.page.evaluate(function() { return window.__signOutCalled; }), 1);
    assertNoErrors(fixture, 'logout');
  } finally { await closeFixture(fixture); }
});

test('Plus copy and its obsolete divider are absent', async function() {
  const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko' });
  try {
    const result = await fixture.page.evaluate(function() {
      return {
        plusNote: document.querySelectorAll('#settingsPlusNote').length,
        text: document.body.innerText,
        dividers: document.querySelectorAll('.settings-divider').length
      };
    });
    assert.equal(result.plusNote, 0);
    assert.equal(result.text.includes('프라이빗 보관 기능은 Plus에서 준비 중이에요.'), false);
    assert.equal(result.dividers, 2, 'Only Profile→Account and Account→Logout dividers remain');
    assertNoErrors(fixture, 'copy cleanup');
  } finally { await closeFixture(fixture); }
});

test('desktop and mobile have no document or body horizontal overflow', async function() {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const fixture = await newSettingsPage({ user: ACCOUNTS.koGoogle, lang: 'ko', viewport });
    try {
      const widths = await fixture.page.evaluate(function() {
        return {
          docScroll: document.documentElement.scrollWidth,
          docClient: document.documentElement.clientWidth,
          bodyScroll: document.body.scrollWidth,
          bodyClient: document.body.clientWidth
        };
      });
      assert.ok(widths.docScroll <= widths.docClient, JSON.stringify({ viewport, widths }));
      assert.ok(widths.bodyScroll <= widths.bodyClient, JSON.stringify({ viewport, widths }));
      assertNoErrors(fixture, viewport.width + 'x' + viewport.height);
    } finally { await closeFixture(fixture); }
  }
});
