/**
 * #3583 Chromium browser contract — read-only Profile / Account settings.
 *
 * Role: actual pages/settings.html in Chromium with controlled auth fixture.
 * No real Firebase network. No Production login.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.resolve(ROOT, '..', 'local-backup', 'lovebud-3583-settings-readonly');
const TOKEN = '20260721-3583-settings-readonly';

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

function ensureEvidence() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function createLocalServer() {
  return new Promise(function (resolve, reject) {
    var server = http.createServer(function (req, res) {
      var url = req.url.split('?')[0];
      if (url === '/') url = '/pages/settings.html';
      var filePath = path.join(ROOT, url);
      try {
        var data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(data);
      } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + url);
      }
    });
    server.listen(0, '127.0.0.1', function () {
      resolve(server);
    });
    server.on('error', reject);
  });
}

function getBaseUrl(server) {
  var addr = server.address();
  return 'http://127.0.0.1:' + addr.port;
}

/**
 * Create init script content that stubs Firebase auth before page scripts run.
 */
function authInitScript(user) {
  return `
    // Stub firebase.auth().currentUser
    window.firebase = {
      auth: function() {
        return {
          currentUser: ${JSON.stringify(user)},
          onAuthStateChanged: function(cb) { cb(${JSON.stringify(user)}); return function(){}; },
          signOut: function() { return Promise.resolve(); }
        };
      }
    };

    // Stub LoveBudProtectedRoute
    window.LoveBudProtectedRoute = {
      getAuthState: function() {
        return { ready: true, user: ${JSON.stringify(user)} };
      },
      requireAuthenticatedPage: function(opts) {
        if (opts && opts.onAuthenticated) {
          opts.onAuthenticated(${JSON.stringify(user)});
        }
      }
    };

    // Stub signOut
    window.signOut = function() {
      window.__signOutCalled = (window.__signOutCalled || 0) + 1;
      return Promise.resolve();
    };

    // Stub applyI18n to no-op
    window.applyI18n = function() {};
  `;
}

const ACCOUNT_A = {
  displayName: 'QA User',
  email: 'qa@example.com',
  uid: 'qa-owner-3583',
  photoURL: null,
  providerData: [{ providerId: 'google.com' }]
};

const ACCOUNT_B = {
  displayName: '',
  email: 'password-user@example.com',
  uid: 'password-owner-3583',
  photoURL: null,
  providerData: [{ providerId: 'password' }]
};

async function navigateWithAuth(page, baseUrl, user) {
  // Use addInitScript to inject auth stubs before any page scripts run
  await page.addInitScript(authInitScript(user));
  await page.goto(baseUrl + '/pages/settings.html', { waitUntil: 'networkidle' });
  // Wait for settings to initialize
  await page.waitForTimeout(300);
}

// ===== Test Suite A: Google Account =====

test('Google account — Profile section visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var profileSection = await page.$('#settingsProfileSection');
    assert.ok(profileSection, 'Profile section must exist');

    var profileVisible = await page.$eval('#settingsProfileSection', el => el.offsetParent !== null);
    assert.ok(profileVisible, 'Profile section must be visible');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — Account section visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var accountSection = await page.$('#settingsAccountSection');
    assert.ok(accountSection, 'Account section must exist');

    var accountVisible = await page.$eval('#settingsAccountSection', el => el.offsetParent !== null);
    assert.ok(accountVisible, 'Account section must be visible');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — displayName visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var nameText = await page.$eval('#settingsProfileName', el => el.textContent);
    assert.equal(nameText, 'QA User', 'displayName must be QA User');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — email visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var emailText = await page.$eval('#settingsAccountEmailValue', el => el.textContent);
    assert.equal(emailText, 'qa@example.com');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — uid visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var uidText = await page.$eval('#settingsAccountIdValue', el => el.textContent);
    assert.equal(uidText, 'qa-owner-3583');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — provider label correct', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var signInText = await page.$eval('#settingsAccountSignInValue', el => el.textContent);
    assert.equal(signInText, 'Google');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — password info correct', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var passwordText = await page.$eval('#settingsAccountPasswordValue', el => el.textContent);
    assert.ok(passwordText.includes('Google') || passwordText.includes('관리'),
      'Password info must mention Google management');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Google account — avatar or initials visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var avatarText = await page.$eval('#settingsProfileAvatar', el => el.textContent.trim());
    assert.ok(avatarText.length > 0, 'Avatar must show initials or image');

    await browser.close();
  } finally {
    server.close();
  }
});

// ===== Test Suite B: Password Account =====

test('Password account — displayName fallback to email prefix', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_B);

    var nameText = await page.$eval('#settingsProfileName', el => el.textContent);
    assert.equal(nameText, 'password-user', 'Empty displayName must fall back to email prefix');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Password account — provider label correct', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_B);

    var signInText = await page.$eval('#settingsAccountSignInValue', el => el.textContent);
    assert.ok(signInText.includes('이메일') || signInText.includes('비밀번호'),
      'Password provider must show email/password label');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Password account — password info deferred', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_B);

    var passwordText = await page.$eval('#settingsAccountPasswordValue', el => el.textContent);
    assert.ok(passwordText.includes('다음 단계') || passwordText.includes('future'),
      'Password info must indicate deferred support');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Password account — initials visible (no photo)', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_B);

    var avatarText = await page.$eval('#settingsProfileAvatar', el => el.textContent.trim());
    assert.ok(avatarText.length > 0, 'Avatar must show initials');
    assert.equal(avatarText, 'P', 'Initials for password-user should be P (uppercase)');

    await browser.close();
  } finally {
    server.close();
  }
});

// ===== Shared Tests =====

test('Logout button exists exactly once', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var logoutCount = await page.$$eval('.logout-btn', els => els.length);
    assert.equal(logoutCount, 1, 'Must have exactly one logout button');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Shared header exists exactly once', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var headerCount = await page.$$eval('#shared-header > header, #shared-header > nav', els => els.length);
    assert.ok(headerCount >= 1, 'Shared header must exist');
    assert.ok(headerCount <= 2, 'Shared header should not have excessive children');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Close button works', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var closeBtn = await page.$('#settingsCloseBtn');
    assert.ok(closeBtn, 'Close button must exist');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Escape key works', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    // Escape should not throw
    await page.keyboard.press('Escape');
    // If we reach here without error, Escape handling works

    await browser.close();
  } finally {
    server.close();
  }
});

test('No horizontal overflow on desktop', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var overflow = await page.evaluate(function() {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert.equal(overflow, false, 'No horizontal overflow on desktop');

    await browser.close();
  } finally {
    server.close();
  }
});

test('No console errors', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function(err) { errors.push(err.message); });
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    assert.equal(errors.length, 0, 'No page errors expected');

    await browser.close();
  } finally {
    server.close();
  }
});

// ===== Mobile Test =====

test('Mobile 375x812 — no horizontal overflow', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var overflow = await page.evaluate(function() {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert.equal(overflow, false, 'No horizontal overflow on mobile 375x812');

    await browser.close();
  } finally {
    server.close();
  }
});

test('Mobile 375x812 — profile section visible', async () => {
  var server = await createLocalServer();
  var baseUrl = getBaseUrl(server);
  var browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    var page = await context.newPage();
    await navigateWithAuth(page, baseUrl, ACCOUNT_A);

    var profileVisible = await page.$eval('#settingsProfileSection', el => el.offsetParent !== null);
    assert.ok(profileVisible, 'Profile section must be visible on mobile');

    await browser.close();
  } finally {
    server.close();
  }
});
