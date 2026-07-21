/**
 * #3617 Chromium browser contract — display name edit write flow under strict CSP.
 *
 * Controlled Firebase fixture only. No real Firebase / Production account mutation.
 */
'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

const CSP =
  "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; media-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://relovetree.firebaseapp.com; connect-src 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";

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
      const normalized = pathname === '/' ? '/pages/settings.html' : pathname;
      const filePath = path.resolve(ROOT, '.' + normalized);
      if (!filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
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
    local.listen(0, '127.0.0.1', function() {
      resolve(local);
    });
  });
}

/**
 * Auth fixture with controllable updateProfile implementation.
 * updateProfileMode: 'resolve' | 'reject' | 'delay' | 'syncThrow' | 'missing' | 'nonFunction'
 */
function authFixtureScript() {
  return function fixture(payload) {
    const fixtureUser = Object.assign({}, payload.user);
    const mode = payload.updateProfileMode || 'resolve';
    const delayMs = payload.delayMs || 400;

    window.__lbUpdateProfileCalls = [];
    window.__lbRenderSharedHeaderCalls = 0;
    window.__lbInitSettingsCalls = 0;
    window.__lbPersistCacheCalls = [];
    window.__lbUpdateNavUICalls = [];

    localStorage.setItem('lovebud_lang', payload.lang || 'ko');
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem(
      'lovebud_auth_cache',
      JSON.stringify({
        uid: fixtureUser.uid,
        displayName: fixtureUser.displayName || '',
        email: fixtureUser.email || ''
      })
    );

    function makeUpdateProfile() {
      if (mode === 'missing') return undefined;
      if (mode === 'nonFunction') return { not: 'callable' };
      if (mode === 'syncThrow') {
        return function() {
          window.__lbUpdateProfileCalls.push(arguments[0]);
          throw new Error('sync boom');
        };
      }
      if (mode === 'reject') {
        return function(payloadArg) {
          window.__lbUpdateProfileCalls.push(payloadArg);
          return Promise.reject(new Error('async boom'));
        };
      }
      if (mode === 'delay') {
        return function(payloadArg) {
          window.__lbUpdateProfileCalls.push(payloadArg);
          return new Promise(function(resolve) {
            setTimeout(function() {
              fixtureUser.displayName = payloadArg.displayName;
              resolve();
            }, delayMs);
          });
        };
      }
      // resolve (default)
      return function(payloadArg) {
        window.__lbUpdateProfileCalls.push(payloadArg);
        fixtureUser.displayName = payloadArg.displayName;
        return Promise.resolve();
      };
    }

    Object.defineProperty(fixtureUser, 'updateProfile', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: makeUpdateProfile()
    });

    const authInstance = {
      currentUser: fixtureUser,
      onAuthStateChanged: function(callback) {
        Promise.resolve().then(function() {
          callback(fixtureUser);
        });
        return function() {};
      },
      signOut: function() {
        return Promise.resolve();
      },
      setPersistence: function() {
        return Promise.resolve();
      },
      getRedirectResult: function() {
        return Promise.resolve({ user: null });
      }
    };
    function auth() {
      return authInstance;
    }
    auth.Auth = { Persistence: { LOCAL: 'local' } };
    window.firebase = {
      apps: [{}],
      auth: auth,
      initializeApp: function() {
        return {};
      }
    };

    window.LoveBudProtectedRoute = {
      getAuthState: function() {
        return { ready: true, user: fixtureUser };
      },
      getAuthenticatedUser: function() {
        return fixtureUser;
      },
      requireAuthenticatedPage: function(options) {
        if (options && typeof options.onAuthenticated === 'function') {
          options.onAuthenticated(fixtureUser);
        }
      }
    };

    window.persistConfirmedAuthSession = function(user) {
      window.__lbPersistCacheCalls.push({
        uid: user && user.uid,
        displayName: user && user.displayName
      });
      localStorage.setItem(
        'lovebud_auth_cache',
        JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || '',
          email: user.email || ''
        })
      );
      localStorage.setItem('lovebud_auth_confirmed', 'true');
    };

    // Minimal header stubs so updateNavUI can paint without full auth UI module.
    window.updateNavUI = function(user) {
      window.__lbUpdateNavUICalls.push({
        displayName: user && user.displayName
      });
      var host = document.getElementById('shared-header') || document.body;
      var container = document.getElementById('auth-nav-container') || document.getElementById('auth-nav');
      if (!container) {
        container = document.createElement('div');
        container.id = 'auth-nav-container';
        host.appendChild(container);
      }
      var name = (user && (user.displayName || user.email)) || '';
      var initial = name ? String(name).charAt(0).toUpperCase() : '?';
      container.innerHTML =
        '<div class="user-menu">' +
        '<button type="button" class="user-menu-trigger" id="user-menu-trigger" aria-label="Account">' +
        '<span class="user-avatar-initial" data-testid="header-avatar-initial">' +
        initial +
        '</span>' +
        '<span class="user-display-name" data-testid="header-display-name">' +
        name +
        '</span></button></div>';
    };

    // Guard against full re-init
    var origDescriptor = Object.getOwnPropertyDescriptor(window, 'initSettings');
    Object.defineProperty(window, 'initSettings', {
      configurable: true,
      enumerable: true,
      get: function() {
        return function wrappedInitSettings() {
          window.__lbInitSettingsCalls += 1;
          if (typeof window.__lbRealInitSettings === 'function') {
            return window.__lbRealInitSettings.apply(this, arguments);
          }
        };
      },
      set: function(fn) {
        window.__lbRealInitSettings = fn;
      }
    });

    window.renderSharedHeader = function() {
      window.__lbRenderSharedHeaderCalls += 1;
    };
  };
}

async function newSettingsPage(options) {
  const opts = options || {};
  const user = Object.assign(
    {
      displayName: 'QA User',
      email: 'qa@example.com',
      uid: 'qa-owner-3617',
      providerData: [{ providerId: 'google.com' }],
      photoURL: null
    },
    opts.user || {}
  );
  const lang = opts.lang || 'ko';
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = { page: [], console: [], requestfailed: [], csp: [] };
  page.on('pageerror', function(error) {
    errors.page.push(String(error && error.message ? error.message : error));
  });
  page.on('console', function(message) {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('requestfailed', function(req) {
    errors.requestfailed.push(req.url());
  });
  page.on('console', function(message) {
    const text = message.text() || '';
    if (/Content Security Policy|Refused to execute/i.test(text)) {
      errors.csp.push(text);
    }
  });

  await page.route('https://www.gstatic.com/**', async function(route) {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* controlled Firebase fixture */'
    });
  });
  await page.route('https://fonts.googleapis.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.route('https://fonts.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'font/woff2', body: Buffer.alloc(0) });
  });

  await page.addInitScript(authFixtureScript(), {
    user: user,
    lang: lang,
    updateProfileMode: opts.updateProfileMode || 'resolve',
    delayMs: opts.delayMs || 500
  });

  await page.goto(baseUrl + '/pages/settings.html?lang=' + lang, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    function(expected) {
      const email = document.getElementById('settingsProfileEmail');
      return email && email.textContent === expected;
    },
    user.email,
    { timeout: 15000 }
  );
  // auth.js / shared-header may overwrite updateNavUI after initScript — re-wrap for header assertions.
  await page.evaluate(function() {
    window.__lbUpdateNavUICalls = window.__lbUpdateNavUICalls || [];
    window.updateNavUI = function(user) {
      window.__lbUpdateNavUICalls.push({ displayName: user && user.displayName });
      var host = document.getElementById('shared-header') || document.body;
      var container = document.getElementById('auth-nav-container') || document.getElementById('auth-nav');
      if (!container) {
        container = document.createElement('div');
        container.id = 'auth-nav-container';
        host.appendChild(container);
      }
      var name = (user && (user.displayName || user.email)) || '';
      var initial = name ? String(name).charAt(0).toUpperCase() : '?';
      // Do not call the previous production updateNavUI — it would overwrite our markers.
      container.innerHTML =
        '<div class="user-menu">' +
        '<button type="button" class="user-menu-trigger" id="user-menu-trigger" aria-label="Account">' +
        '<span class="user-avatar-initial" data-testid="header-avatar-initial">' +
        initial +
        '</span>' +
        '<span class="user-display-name" data-testid="header-display-name">' +
        name +
        '</span></button></div>';
    };
    window.__lbRenderSharedHeaderCalls = window.__lbRenderSharedHeaderCalls || 0;
    window.renderSharedHeader = function() {
      window.__lbRenderSharedHeaderCalls += 1;
    };
  });
  return { context, page, errors, user };
}

async function closeFixture(fixture) {
  await fixture.context.close();
}

function assertCleanRuntime(fixture, label) {
  assert.deepEqual(fixture.errors.page, [], label + ' pageerror must be 0');
  assert.deepEqual(fixture.errors.console, [], label + ' console error must be 0');
  assert.deepEqual(fixture.errors.csp, [], label + ' CSP violation must be 0');
  // requestfailed may include aborted third-party font stubs; allow only known gstatic/fonts
  const unexpected = (fixture.errors.requestfailed || []).filter(function(u) {
    return !/gstatic\.com|fonts\.googleapis|fonts\.gstatic/.test(u);
  });
  assert.deepEqual(unexpected, [], label + ' unexpected requestfailed must be 0');
}

before(async function() {
  server = await startServer();
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
});

after(async function() {
  if (browser) await browser.close();
  if (server) {
    await new Promise(function(resolve) {
      server.close(resolve);
    });
  }
});

test('#3617 success save updates profile, cache, header; visible success status', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Original Name', email: 'qa@example.com', uid: 'u-success' },
    lang: 'en',
    updateProfileMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.waitForSelector('#settingsProfileEditForm:not([hidden])');
    const focused = await page.evaluate(function() {
      return document.activeElement && document.activeElement.id === 'settingsProfileNameInput';
    });
    assert.equal(focused, true, 'input receives focus');
    assert.equal(await page.inputValue('#settingsProfileNameInput'), 'Original Name');

    await page.fill('#settingsProfileNameInput', '  New Name  ');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /updated/i.test(result.textContent || '');
    });

    const state = await page.evaluate(function() {
      const form = document.getElementById('settingsProfileEditForm');
      const result = document.getElementById('settingsProfileResultStatus');
      const style = result ? getComputedStyle(result) : null;
      const cache = JSON.parse(localStorage.getItem('lovebud_auth_cache') || '{}');
      return {
        formHidden: !!(form && form.hidden),
        resultText: result ? result.textContent : '',
        resultVisible: !!(result && style && style.display !== 'none' && style.visibility !== 'hidden' && (result.textContent || '').trim()),
        resultRole: result ? result.getAttribute('role') : null,
        profileName: (document.getElementById('settingsProfileName') || {}).textContent || '',
        avatarLabel: (document.getElementById('settingsProfileAvatar') || {}).getAttribute('aria-label') || '',
        avatarText: (document.getElementById('settingsProfileAvatar') || {}).textContent || '',
        calls: window.__lbUpdateProfileCalls.slice(),
        cacheDisplayName: cache.displayName,
        headerName: (document.querySelector('[data-testid="header-display-name"]') || {}).textContent || '',
        headerInitial: (document.querySelector('[data-testid="header-avatar-initial"]') || {}).textContent || '',
        renderSharedHeaderCalls: window.__lbRenderSharedHeaderCalls,
        initSettingsCalls: window.__lbInitSettingsCalls
      };
    });

    assert.equal(state.formHidden, true, 'edit form closes on success');
    assert.equal(state.resultVisible, true, 'success status remains visible after form closes');
    assert.match(state.resultText, /updated/i);
    assert.equal(state.resultRole, 'status');
    assert.equal(state.profileName, 'New Name');
    assert.equal(state.calls.length, 1);
    assert.deepEqual(state.calls[0], { displayName: 'New Name' });
    assert.equal(state.cacheDisplayName, 'New Name');
    assert.equal(state.headerName, 'New Name');
    assert.equal(state.headerInitial, 'N');
    assert.ok(/New Name/i.test(state.avatarLabel) || state.avatarText === 'N');
    assert.equal(state.renderSharedHeaderCalls, 0);
    // initSettings may run once at boot via assignment; post-save path must not re-enter startSettings.
    // We only require that save path did not increment beyond initial boot wraps.
    assert.ok(state.initSettingsCalls <= 1, 'initSettings must not re-run on save');
    assertCleanRuntime(fixture, 'success');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 unchanged value makes zero Firebase calls; visible no-change status', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Same Name', email: 'qa@example.com', uid: 'u-same' },
    lang: 'en',
    updateProfileMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', '  Same Name  ');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /not changed/i.test(result.textContent || '');
    });
    const state = await page.evaluate(function() {
      const form = document.getElementById('settingsProfileEditForm');
      const result = document.getElementById('settingsProfileResultStatus');
      const style = result ? getComputedStyle(result) : null;
      return {
        formHidden: !!(form && form.hidden),
        resultVisible: !!(result && style && style.display !== 'none' && (result.textContent || '').trim()),
        resultText: result ? result.textContent : '',
        resultRole: result ? result.getAttribute('role') : null,
        calls: window.__lbUpdateProfileCalls.length
      };
    });
    assert.equal(state.calls, 0);
    assert.equal(state.formHidden, true);
    assert.equal(state.resultVisible, true);
    assert.match(state.resultText, /not changed/i);
    assert.equal(state.resultRole, 'status');
    assertCleanRuntime(fixture, 'unchanged');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 Unicode 50 emoji accepted; 51 emoji rejected without Firebase call', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Base', email: 'qa@example.com', uid: 'u-emoji' },
    lang: 'en',
    updateProfileMode: 'resolve'
  });
  try {
    const page = fixture.page;
    const fifty = '😀'.repeat(50);
    const fiftyOne = '😀'.repeat(51);

    await page.click('#settingsProfileEditBtn');
    // Native maxlength must not block code-point input
    await page.evaluate(function(v) {
      document.getElementById('settingsProfileNameInput').value = v;
    }, fiftyOne);
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsProfileEditStatus');
      return s && /50/i.test(s.textContent || '');
    });
    let calls = await page.evaluate(function() {
      return window.__lbUpdateProfileCalls.length;
    });
    assert.equal(calls, 0, '51 emoji must not call updateProfile');
    const formStillOpen = await page.evaluate(function() {
      return !document.getElementById('settingsProfileEditForm').hidden;
    });
    assert.equal(formStillOpen, true);

    await page.evaluate(function(v) {
      document.getElementById('settingsProfileNameInput').value = v;
    }, fifty);
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /updated/i.test(result.textContent || '');
    });
    calls = await page.evaluate(function() {
      return window.__lbUpdateProfileCalls.length;
    });
    assert.equal(calls, 1);
    const payload = await page.evaluate(function() {
      return window.__lbUpdateProfileCalls[0];
    });
    assert.equal(Array.from(payload.displayName).length, 50);
    assertCleanRuntime(fixture, 'unicode');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 double submit and Escape while saving keep a single write', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Slow', email: 'qa@example.com', uid: 'u-slow' },
    lang: 'en',
    updateProfileMode: 'delay',
    delayMs: 800
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Slow New');
    await page.click('#settingsProfileSaveBtn');
    // Immediate double click + Enter
    await page.click('#settingsProfileSaveBtn', { force: true }).catch(function() {});
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    const mid = await page.evaluate(function() {
      return {
        saving: window._settingsEditState.saving,
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        saveDisabled: document.getElementById('settingsProfileSaveBtn').disabled,
        cancelDisabled: document.getElementById('settingsProfileCancelBtn').disabled,
        inputDisabled: document.getElementById('settingsProfileNameInput').disabled,
        status: (document.getElementById('settingsProfileEditStatus') || {}).textContent || '',
        calls: window.__lbUpdateProfileCalls.length
      };
    });
    assert.equal(mid.saving, true);
    assert.equal(mid.formHidden, false, 'Escape while saving must not hide form');
    assert.equal(mid.saveDisabled, true);
    assert.equal(mid.cancelDisabled, true);
    assert.equal(mid.inputDisabled, true);
    assert.match(mid.status, /Saving/i);
    assert.equal(mid.calls, 1, 'double submit must call updateProfile once');

    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /updated/i.test(result.textContent || '');
    }, null, { timeout: 5000 });
    const finalCalls = await page.evaluate(function() {
      return window.__lbUpdateProfileCalls.length;
    });
    assert.equal(finalCalls, 1);
    assertCleanRuntime(fixture, 'double-submit');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 rejected Promise fails closed and allows retry', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Keep Me', email: 'qa@example.com', uid: 'u-reject' },
    lang: 'en',
    updateProfileMode: 'reject'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Should Fail');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsProfileEditStatus');
      return s && /Could not update|다시 시도/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        inputValue: document.getElementById('settingsProfileNameInput').value,
        profileName: document.getElementById('settingsProfileName').textContent,
        cache: JSON.parse(localStorage.getItem('lovebud_auth_cache') || '{}').displayName,
        role: document.getElementById('settingsProfileEditStatus').getAttribute('role'),
        saving: window._settingsEditState.saving,
        calls: window.__lbUpdateProfileCalls.length
      };
    });
    assert.equal(state.formHidden, false);
    assert.equal(state.inputValue, 'Should Fail');
    assert.equal(state.profileName, 'Keep Me');
    assert.equal(state.cache, 'Keep Me');
    assert.equal(state.role, 'alert');
    assert.equal(state.saving, false);
    assert.equal(state.calls, 1);

    // Retry possible: switch fixture path by redefining updateProfile to resolve
    await page.evaluate(function() {
      const user = firebase.auth().currentUser;
      user.updateProfile = function(payload) {
        window.__lbUpdateProfileCalls.push(payload);
        user.displayName = payload.displayName;
        return Promise.resolve();
      };
    });
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /updated/i.test(result.textContent || '');
    });
    assert.equal(await page.locator('#settingsProfileName').textContent(), 'Should Fail');
    assertCleanRuntime(fixture, 'reject-retry');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 synchronous throw fails closed', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Sync Keep', email: 'qa@example.com', uid: 'u-sync' },
    lang: 'en',
    updateProfileMode: 'syncThrow'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Boom Name');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsProfileEditStatus');
      return s && /Could not update|다시 시도/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        inputValue: document.getElementById('settingsProfileNameInput').value,
        profileName: document.getElementById('settingsProfileName').textContent,
        cache: JSON.parse(localStorage.getItem('lovebud_auth_cache') || '{}').displayName,
        saving: window._settingsEditState.saving
      };
    });
    assert.equal(state.formHidden, false);
    assert.equal(state.inputValue, 'Boom Name');
    assert.equal(state.profileName, 'Sync Keep');
    assert.equal(state.cache, 'Sync Keep');
    assert.equal(state.saving, false);
    // pageerror may capture the sync throw if not fully swallowed — Promise.resolve().then should catch it
    assert.deepEqual(fixture.errors.page, [], 'sync throw must not leak as pageerror');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 missing/non-function updateProfile fails closed with zero write side effects', async function() {
  for (const mode of ['missing', 'nonFunction']) {
    const fixture = await newSettingsPage({
      user: { displayName: 'Guard Keep', email: 'qa@example.com', uid: 'u-' + mode },
      lang: 'en',
      updateProfileMode: mode
    });
    try {
      const page = fixture.page;
      await page.click('#settingsProfileEditBtn');
      await page.fill('#settingsProfileNameInput', 'No Call');
      await page.click('#settingsProfileSaveBtn');
      await page.waitForFunction(function() {
        const s = document.getElementById('settingsProfileEditStatus');
        return s && /Could not update|다시 시도/i.test(s.textContent || '');
      });
      const state = await page.evaluate(function() {
        return {
          formHidden: document.getElementById('settingsProfileEditForm').hidden,
          inputValue: document.getElementById('settingsProfileNameInput').value,
          profileName: document.getElementById('settingsProfileName').textContent,
          cache: JSON.parse(localStorage.getItem('lovebud_auth_cache') || '{}').displayName,
          calls: window.__lbUpdateProfileCalls.length
        };
      });
      assert.equal(state.formHidden, false, mode);
      assert.equal(state.inputValue, 'No Call', mode);
      assert.equal(state.profileName, 'Guard Keep', mode);
      assert.equal(state.cache, 'Guard Keep', mode);
      assert.equal(state.calls, 0, mode);
    } finally {
      await closeFixture(fixture);
    }
  }
});

test('#3617 Cancel and idle Escape cancel without Firebase calls; Edit focus restored', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Cancel Me', email: 'qa@example.com', uid: 'u-cancel' },
    lang: 'en'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Draft');
    await page.click('#settingsProfileCancelBtn');
    let state = await page.evaluate(function() {
      return {
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        activeId: document.activeElement && document.activeElement.id,
        calls: window.__lbUpdateProfileCalls.length
      };
    });
    assert.equal(state.formHidden, true);
    assert.equal(state.activeId, 'settingsProfileEditBtn');
    assert.equal(state.calls, 0);

    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Draft2');
    await page.keyboard.press('Escape');
    state = await page.evaluate(function() {
      return {
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        activeId: document.activeElement && document.activeElement.id,
        calls: window.__lbUpdateProfileCalls.length,
        stillOnSettings: /settings\.html/.test(location.pathname)
      };
    });
    assert.equal(state.formHidden, true);
    assert.equal(state.activeId, 'settingsProfileEditBtn');
    assert.equal(state.calls, 0);
    assert.equal(state.stillOnSettings, true);
    assertCleanRuntime(fixture, 'cancel-escape');
  } finally {
    await closeFixture(fixture);
  }
});

/**
 * Real product language path:
 *   setCurrentLang(lang) → applyI18n() → triggerLangChange(lang)
 * which dispatches lovebud-lang-change; settings listens via window.onLangChange.
 */
async function switchProductLang(page, lang) {
  await page.evaluate(function(nextLang) {
    if (typeof window.setCurrentLang !== 'function') {
      throw new Error('setCurrentLang missing');
    }
    if (typeof window.triggerLangChange !== 'function') {
      throw new Error('triggerLangChange missing');
    }
    window.setCurrentLang(nextLang);
    if (typeof window.applyI18n === 'function') {
      window.applyI18n();
    }
    window.triggerLangChange(nextLang);
  }, lang);
  // Allow settings onLangChange handler to run
  await page.waitForTimeout(50);
}

test('#3617 real language event KO→EN and EN→KO preserves edit input and labels', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'I18n User', email: 'qa@example.com', uid: 'u-i18n' },
    lang: 'ko'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    let labels = await page.evaluate(function() {
      return {
        editBtn: (document.getElementById('settingsProfileEditBtnLabel') || {}).textContent,
        nameLabel: (document.getElementById('settingsProfileEditLabel') || {}).textContent,
        save: (document.getElementById('settingsProfileSaveBtn') || {}).textContent,
        cancel: (document.getElementById('settingsProfileCancelBtn') || {}).textContent,
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        mode: window._settingsEditState.mode
      };
    });
    assert.equal(labels.editBtn, '이름 편집');
    assert.equal(labels.nameLabel, '표시 이름');
    assert.equal(labels.save, '저장');
    assert.equal(labels.cancel, '취소');
    assert.equal(labels.formHidden, false);
    assert.equal(labels.mode, 'editing');

    await page.fill('#settingsProfileNameInput', '입력중');

    // KO → EN via real product path
    await switchProductLang(page, 'en');
    let state = await page.evaluate(function() {
      return {
        input: document.getElementById('settingsProfileNameInput').value,
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        mode: window._settingsEditState.mode,
        saving: window._settingsEditState.saving,
        editBtn: (document.getElementById('settingsProfileEditBtnLabel') || {}).textContent,
        nameLabel: (document.getElementById('settingsProfileEditLabel') || {}).textContent,
        save: (document.getElementById('settingsProfileSaveBtn') || {}).textContent,
        cancel: (document.getElementById('settingsProfileCancelBtn') || {}).textContent,
        calls: window.__lbUpdateProfileCalls.length
      };
    });
    assert.equal(state.input, '입력중', 'KO→EN must preserve input');
    assert.equal(state.formHidden, false, 'edit form must stay visible');
    assert.equal(state.mode, 'editing');
    assert.equal(state.saving, false);
    assert.equal(state.calls, 0, 'language change must not write');
    assert.equal(state.nameLabel, 'Display name');
    assert.equal(state.save, 'Save');
    assert.equal(state.cancel, 'Cancel');
    assert.equal(state.editBtn, 'Edit name');

    // EN → KO in same edit session
    await switchProductLang(page, 'ko');
    state = await page.evaluate(function() {
      return {
        input: document.getElementById('settingsProfileNameInput').value,
        formHidden: document.getElementById('settingsProfileEditForm').hidden,
        mode: window._settingsEditState.mode,
        editBtn: (document.getElementById('settingsProfileEditBtnLabel') || {}).textContent,
        nameLabel: (document.getElementById('settingsProfileEditLabel') || {}).textContent,
        save: (document.getElementById('settingsProfileSaveBtn') || {}).textContent,
        cancel: (document.getElementById('settingsProfileCancelBtn') || {}).textContent
      };
    });
    assert.equal(state.input, '입력중', 'EN→KO must preserve input');
    assert.equal(state.formHidden, false);
    assert.equal(state.mode, 'editing');
    assert.equal(state.nameLabel, '표시 이름');
    assert.equal(state.save, '저장');
    assert.equal(state.cancel, '취소');
    assert.equal(state.editBtn, '이름 편집');
    assertCleanRuntime(fixture, 'i18n-labels');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3617 real language event retranslates saving, write error, and success status', async function() {
  // --- saving status: delayed write ---
  const savingFixture = await newSettingsPage({
    user: { displayName: 'Slow Lang', email: 'qa@example.com', uid: 'u-lang-save' },
    lang: 'en',
    updateProfileMode: 'delay',
    delayMs: 900
  });
  try {
    const page = savingFixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Lang Saving');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      return window._settingsEditState.saving === true;
    });
    let statusText = await page.locator('#settingsProfileEditStatus').textContent();
    assert.match(statusText, /Saving/i);
    await switchProductLang(page, 'ko');
    statusText = await page.locator('#settingsProfileEditStatus').textContent();
    assert.match(statusText, /저장 중/);
    assert.equal(await page.inputValue('#settingsProfileNameInput'), 'Lang Saving');
    assert.equal(
      await page.evaluate(function() {
        return window._settingsEditState.saving;
      }),
      true
    );
    // Wait for delayed success to settle so the page is not mid-write
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && (result.textContent || '').trim().length > 0;
    }, null, { timeout: 5000 });
  } finally {
    await closeFixture(savingFixture);
  }

  // --- write error retranslation ---
  const errorFixture = await newSettingsPage({
    user: { displayName: 'Err Keep', email: 'qa@example.com', uid: 'u-lang-err' },
    lang: 'en',
    updateProfileMode: 'reject'
  });
  try {
    const page = errorFixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', 'Will Fail');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsProfileEditStatus');
      return s && /Could not update/i.test(s.textContent || '');
    });
    await switchProductLang(page, 'ko');
    const errKo = await page.locator('#settingsProfileEditStatus').textContent();
    assert.match(errKo, /이름을 변경하지 못했습니다/);
    assert.equal(await page.inputValue('#settingsProfileNameInput'), 'Will Fail');
    assert.equal(
      await page.evaluate(function() {
        return document.getElementById('settingsProfileEditForm').hidden;
      }),
      false
    );
  } finally {
    await closeFixture(errorFixture);
  }

  // --- success result retranslation ---
  const successFixture = await newSettingsPage({
    user: { displayName: 'Ok Keep', email: 'qa@example.com', uid: 'u-lang-ok' },
    lang: 'ko',
    updateProfileMode: 'resolve'
  });
  try {
    const page = successFixture.page;
    await page.click('#settingsProfileEditBtn');
    await page.fill('#settingsProfileNameInput', '완료이름');
    await page.click('#settingsProfileSaveBtn');
    await page.waitForFunction(function() {
      const result = document.getElementById('settingsProfileResultStatus');
      return result && /변경되었습니다/i.test(result.textContent || '');
    });
    await switchProductLang(page, 'en');
    const okEn = await page.locator('#settingsProfileResultStatus').textContent();
    assert.match(okEn, /display name was updated/i);
    assert.equal(
      await page.evaluate(function() {
        return document.getElementById('settingsProfileEditForm').hidden;
      }),
      true
    );
    assertCleanRuntime(successFixture, 'i18n-status');
  } finally {
    await closeFixture(successFixture);
  }
});

test('#3617 mobile 375×812 no horizontal overflow during edit', async function() {
  const fixture = await newSettingsPage({
    user: { displayName: 'Mobile', email: 'qa@example.com', uid: 'u-mobile' },
    lang: 'ko',
    viewport: { width: 375, height: 812 }
  });
  try {
    const page = fixture.page;
    await page.click('#settingsProfileEditBtn');
    const overflow = await page.evaluate(function() {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    assert.equal(overflow, false);
    assertCleanRuntime(fixture, 'mobile');
  } finally {
    await closeFixture(fixture);
  }
});
