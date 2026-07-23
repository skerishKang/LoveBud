/**
 * #3635 Chromium browser contract — password reset email action under strict CSP.
 *
 * Controlled Firebase fixture only. No real Firebase / Production reset emails sent.
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
 * Auth fixture with controllable sendPasswordResetEmail implementation.
 * resetMode: 'resolve' | 'reject' | 'delay' | 'syncThrow' | 'missingDep' | 'nonFunctionDep'
 */
function authFixtureScript() {
  return function fixture(payload) {
    const fixtureUser = Object.assign({}, payload.user);
    const resetMode = payload.resetMode || 'resolve';
    const delayMs = payload.delayMs || 400;

    window.__lbResetCalls = [];
    window.__lbRenderSharedHeaderCalls = 0;
    window.__lbInitSettingsCalls = 0;

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

    function makeSendPasswordResetEmail() {
      if (resetMode === 'missingDep') return undefined;
      if (resetMode === 'nonFunctionDep') return { not: 'callable' };
      if (resetMode === 'syncThrow') {
        return function(email) {
          window.__lbResetCalls.push(email);
          throw new Error('sync boom');
        };
      }
      if (resetMode === 'reject') {
        return function(email) {
          window.__lbResetCalls.push(email);
          return Promise.reject(new Error('async boom'));
        };
      }
      if (resetMode === 'delay') {
        return function(email) {
          window.__lbResetCalls.push(email);
          return new Promise(function(resolve) {
            setTimeout(resolve, delayMs);
          });
        };
      }
      return function(email) {
        window.__lbResetCalls.push(email);
        return Promise.resolve();
      };
    }

    const authInstance = {
      currentUser: fixtureUser,
      sendPasswordResetEmail: makeSendPasswordResetEmail(),
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

    window.persistConfirmedAuthSession = function() {};

    window.updateNavUI = function() {};

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
      uid: 'qa-owner-3635',
      providerData: [{ providerId: 'password' }],
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
    resetMode: opts.resetMode || 'resolve',
    delayMs: opts.delayMs || 500
  });

  await page.goto(baseUrl + '/pages/settings.html?lang=' + lang, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    function(expected) {
      const el = document.getElementById('settingsAccountEmailValue');
      return el && el.textContent === expected;
    },
    user.email,
    { timeout: 15000 }
  );
  await page.evaluate(function() {
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
  const unexpected = (fixture.errors.requestfailed || []).filter(function(u) {
    return !/gstatic\.com|fonts\.googleapis|fonts\.gstatic/.test(u);
  });
  assert.deepEqual(unexpected, [], label + ' unexpected requestfailed must be 0');
}

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
  await page.waitForTimeout(50);
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

// --- password provider: button visible, success flow ---

test('#3635 password provider shows reset button; success sends one email', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'pw@example.com', uid: 'pw-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    const btn = page.locator('#settingsPasswordResetBtn');
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await btn.getAttribute('type'), 'button');
    const labelText = await page.locator('#settingsPasswordResetBtnLabel').textContent();
    assert.equal(labelText, '비밀번호 재설정 이메일 보내기');

    await btn.click();
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /보냈습니다|sent/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        calls: window.__lbResetCalls.slice(),
        statusText: (document.getElementById('settingsPasswordResetStatus') || {}).textContent || '',
        btnDisabled: document.getElementById('settingsPasswordResetBtn').disabled,
        ariaDisabled: document.getElementById('settingsPasswordResetBtn').getAttribute('aria-disabled'),
        statusKind: window._settingsPasswordResetState.statusKind,
        sending: window._settingsPasswordResetState.sending
      };
    });
    assert.deepEqual(state.calls, ['pw@example.com']);
    assert.match(state.statusText, /보냈습니다/);
    assert.equal(state.btnDisabled, true);
    assert.equal(state.ariaDisabled, 'true');
    assert.equal(state.statusKind, 'sent');
    assert.equal(state.sending, false);
    assertCleanRuntime(fixture, 'pw-success-ko');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 password provider EN: success status in English', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'pw-en@example.com', uid: 'pw-en-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    const labelText = await page.locator('#settingsPasswordResetBtnLabel').textContent();
    assert.equal(labelText, 'Send password reset email');
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /sent/i.test(s.textContent || '');
    });
    const statusText = await page.locator('#settingsPasswordResetStatus').textContent();
    assert.match(statusText, /Password reset email sent/);
    assertCleanRuntime(fixture, 'pw-success-en');
  } finally {
    await closeFixture(fixture);
  }
});

// --- linked google+password: same as password ---

test('#3635 google+password linked shows reset button; success sends one email', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'linked@example.com', uid: 'linked-1', providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.locator('#settingsPasswordResetBtn').waitFor({ state: 'visible', timeout: 5000 });
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /sent/i.test(s.textContent || '');
    });
    const calls = await page.evaluate(function() { return window.__lbResetCalls.slice(); });
    assert.deepEqual(calls, ['linked@example.com']);
    assertCleanRuntime(fixture, 'linked-success');
  } finally {
    await closeFixture(fixture);
  }
});

// --- google only: notice, no button, 0 calls ---

test('#3635 google-only shows managed notice; no button; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'gonly@example.com', uid: 'g-1', providerData: [{ providerId: 'google.com' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.waitForFunction(function() {
      return !!document.getElementById('settingsPasswordResetNote');
    }, null, { timeout: 5000 });
    const state = await page.evaluate(function() {
      return {
        noteText: (document.getElementById('settingsPasswordResetNote') || {}).textContent || '',
        btnExists: !!document.getElementById('settingsPasswordResetBtn'),
        calls: window.__lbResetCalls.length
      };
    });
    assert.match(state.noteText, /Google 계정에서 관리/);
    assert.equal(state.btnExists, false);
    assert.equal(state.calls, 0);
    assertCleanRuntime(fixture, 'google-only-ko');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 google-only EN shows managed notice in English', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'gonly-en@example.com', uid: 'g-en-1', providerData: [{ providerId: 'google.com' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.waitForFunction(function() {
      return !!document.getElementById('settingsPasswordResetNote');
    }, null, { timeout: 5000 });
    const noteText = await page.locator('#settingsPasswordResetNote').textContent();
    assert.match(noteText, /managed by your Google account/i);
    assertCleanRuntime(fixture, 'google-only-en');
  } finally {
    await closeFixture(fixture);
  }
});

// --- unknown provider: unsupported notice, no button, 0 calls ---

test('#3635 unknown provider shows unavailable notice; no button; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'unk@example.com', uid: 'unk-1', providerData: [{ providerId: 'unknown.provider' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.waitForFunction(function() {
      return !!document.getElementById('settingsPasswordResetNote');
    }, null, { timeout: 5000 });
    const state = await page.evaluate(function() {
      return {
        noteText: (document.getElementById('settingsPasswordResetNote') || {}).textContent || '',
        btnExists: !!document.getElementById('settingsPasswordResetBtn'),
        calls: window.__lbResetCalls.length
      };
    });
    assert.match(state.noteText, /비밀번호 관리 기능을 확인할 수 없습니다/);
    assert.equal(state.btnExists, false);
    assert.equal(state.calls, 0);
    assertCleanRuntime(fixture, 'unknown-ko');
  } finally {
    await closeFixture(fixture);
  }
});

// --- password provider without email: missingEmail, no enabled button ---

test('#3635 password provider without email shows missingEmail; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: '', uid: 'noemail-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.waitForFunction(function() {
      const el = document.getElementById('settingsAccountIdValue');
      return el && el.textContent === 'noemail-1';
    }, null, { timeout: 5000 });
    const state = await page.evaluate(function() {
      const btn = document.getElementById('settingsPasswordResetBtn');
      return {
        btnExists: !!btn,
        btnDisabled: btn ? btn.disabled : null,
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.btnExists, false, 'no button for missingEmail mode');
    assert.equal(state.statusKind, 'missingEmail');
    assert.equal(state.calls, 0);
    assertCleanRuntime(fixture, 'missing-email');
  } finally {
    await closeFixture(fixture);
  }
});

// --- rejected promise: sendFailed, retry allowed ---

test('#3635 rejected promise shows sendFailed; retry allowed after failure', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'fail@example.com', uid: 'fail-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'reject'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    let state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        sending: window._settingsPasswordResetState.sending,
        btnDisabled: document.getElementById('settingsPasswordResetBtn').disabled,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.sending, false);
    assert.equal(state.btnDisabled, false, 'button re-enabled after failure');
    assert.equal(state.calls, 1);

    // Retry: redefine to resolve
    await page.evaluate(function() {
      firebase.auth().sendPasswordResetEmail = function(email) {
        window.__lbResetCalls.push(email);
        return Promise.resolve();
      };
    });
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /sent/i.test(s.textContent || '');
    });
    state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sent');
    assert.equal(state.calls, 2);
    assertCleanRuntime(fixture, 'reject-retry');
  } finally {
    await closeFixture(fixture);
  }
});

// --- synchronous throw: sendFailed, no pageerror ---

test('#3635 synchronous throw fails closed with sendFailed; no pageerror', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'sync@example.com', uid: 'sync-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'syncThrow'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        sending: window._settingsPasswordResetState.sending,
        btnDisabled: document.getElementById('settingsPasswordResetBtn').disabled
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.sending, false);
    assert.equal(state.btnDisabled, false);
    assert.deepEqual(fixture.errors.page, [], 'sync throw must not leak as pageerror');
  } finally {
    await closeFixture(fixture);
  }
});

// --- missing sendPasswordResetEmail dependency: sendFailed, 0 real calls ---

test('#3635 missing sendPasswordResetEmail dependency shows sendFailed; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'nodep@example.com', uid: 'nodep-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'missingDep'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.calls, 0);
    assertCleanRuntime(fixture, 'missing-dep');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 non-function sendPasswordResetEmail shows sendFailed; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'nonfn@example.com', uid: 'nonfn-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'nonFunctionDep'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.calls, 0);
    assertCleanRuntime(fixture, 'non-function-dep');
  } finally {
    await closeFixture(fixture);
  }
});

// --- double click: single call ---

test('#3635 double click sends only one email', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'dbl@example.com', uid: 'dbl-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'delay',
    delayMs: 600
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.click('#settingsPasswordResetBtn', { force: true }).catch(function() {});
    const mid = await page.evaluate(function() {
      return {
        sending: window._settingsPasswordResetState.sending,
        statusKind: window._settingsPasswordResetState.statusKind,
        btnDisabled: document.getElementById('settingsPasswordResetBtn').disabled,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(mid.sending, true);
    assert.equal(mid.statusKind, 'sending');
    assert.equal(mid.btnDisabled, true);
    assert.equal(mid.calls, 1, 'double click must call sendPasswordResetEmail once');

    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sent';
    }, null, { timeout: 5000 });
    const finalCalls = await page.evaluate(function() { return window.__lbResetCalls.length; });
    assert.equal(finalCalls, 1);
    assertCleanRuntime(fixture, 'double-click');
  } finally {
    await closeFixture(fixture);
  }
});

// --- sent state prevents repeat in same session ---

test('#3635 sent state prevents repeat click in same session', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'repeat@example.com', uid: 'repeat-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sent';
    });
    await page.click('#settingsPasswordResetBtn', { force: true }).catch(function() {});
    await page.waitForTimeout(100);
    const calls = await page.evaluate(function() { return window.__lbResetCalls.length; });
    assert.equal(calls, 1, 'sent state must prevent repeat call');
    assertCleanRuntime(fixture, 'sent-no-repeat');
  } finally {
    await closeFixture(fixture);
  }
});

// --- language change retranslates button label and status ---

test('#3635 language change KO→EN retranslates button label', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'i18n@example.com', uid: 'i18n-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.locator('#settingsPasswordResetBtn').waitFor({ state: 'visible', timeout: 5000 });
    let label = await page.locator('#settingsPasswordResetBtnLabel').textContent();
    assert.equal(label, '비밀번호 재설정 이메일 보내기');

    await switchProductLang(page, 'en');
    label = await page.locator('#settingsPasswordResetBtnLabel').textContent();
    assert.equal(label, 'Send password reset email');

    await switchProductLang(page, 'ko');
    label = await page.locator('#settingsPasswordResetBtnLabel').textContent();
    assert.equal(label, '비밀번호 재설정 이메일 보내기');
    assertCleanRuntime(fixture, 'i18n-label');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 language change retranslates sent status', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'i18n-sent@example.com', uid: 'i18n-sent-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sent';
    });
    let statusText = await page.locator('#settingsPasswordResetStatus').textContent();
    assert.match(statusText, /보냈습니다/);

    await switchProductLang(page, 'en');
    statusText = await page.locator('#settingsPasswordResetStatus').textContent();
    assert.match(statusText, /Password reset email sent/);
    assertCleanRuntime(fixture, 'i18n-sent-status');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 language change retranslates sendFailed status', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'i18n-fail@example.com', uid: 'i18n-fail-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'reject'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sendFailed';
    });
    let statusText = await page.locator('#settingsPasswordResetStatus').textContent();
    assert.match(statusText, /Could not send/);

    await switchProductLang(page, 'ko');
    statusText = await page.locator('#settingsPasswordResetStatus').textContent();
    assert.match(statusText, /보내지 못했습니다/);
    assertCleanRuntime(fixture, 'i18n-fail-status');
  } finally {
    await closeFixture(fixture);
  }
});

// --- language change during pending does not break state ---

test('#3635 language change during pending send preserves sending state', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'pending@example.com', uid: 'pending-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'delay',
    delayMs: 800
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.sending === true;
    });
    await switchProductLang(page, 'ko');
    const mid = await page.evaluate(function() {
      return {
        sending: window._settingsPasswordResetState.sending,
        statusKind: window._settingsPasswordResetState.statusKind,
        statusText: (document.getElementById('settingsPasswordResetStatus') || {}).textContent || '',
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(mid.sending, true, 'sending state preserved after lang change');
    assert.equal(mid.statusKind, 'sending');
    assert.match(mid.statusText, /보내는 중/);
    assert.equal(mid.calls, 1);

    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sent';
    }, null, { timeout: 5000 });
    assertCleanRuntime(fixture, 'lang-during-pending');
  } finally {
    await closeFixture(fixture);
  }
});

// --- missing firebase global: graceful sendFailed ---

test('#3635 missing firebase global shows sendFailed; 0 calls; no pageerror', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'nofb@example.com', uid: 'nofb-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.evaluate(function() {
      delete window.firebase;
    });
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.calls, 0);
    assert.deepEqual(fixture.errors.page, [], 'missing firebase must not cause pageerror');
  } finally {
    await closeFixture(fixture);
  }
});

test('#3635 firebase without auth function shows sendFailed; 0 calls', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'noauth@example.com', uid: 'noauth-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.evaluate(function() {
      window.firebase = { apps: [{}] };
    });
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      const s = document.getElementById('settingsPasswordResetStatus');
      return s && /Could not send/i.test(s.textContent || '');
    });
    const state = await page.evaluate(function() {
      return {
        statusKind: window._settingsPasswordResetState.statusKind,
        calls: window.__lbResetCalls.length
      };
    });
    assert.equal(state.statusKind, 'sendFailed');
    assert.equal(state.calls, 0);
    assert.deepEqual(fixture.errors.page, [], 'missing auth must not cause pageerror');
  } finally {
    await closeFixture(fixture);
  }
});

// --- shared header rendered exactly once ---

test('#3635 shared header rendered exactly once', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'hdr@example.com', uid: 'hdr-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.click('#settingsPasswordResetBtn');
    await page.waitForFunction(function() {
      return window._settingsPasswordResetState.statusKind === 'sent';
    });
    const headerCalls = await page.evaluate(function() {
      return window.__lbRenderSharedHeaderCalls;
    });
    assert.ok(headerCalls <= 1, 'renderSharedHeader must be called at most once, got ' + headerCalls);
    assertCleanRuntime(fixture, 'header-once');
  } finally {
    await closeFixture(fixture);
  }
});

// --- mobile 375×812: no horizontal overflow ---

test('#3635 mobile 375×812 password provider: no horizontal overflow', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'mobile@example.com', uid: 'mobile-1', providerData: [{ providerId: 'password' }] },
    lang: 'ko',
    viewport: { width: 375, height: 812 },
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    await page.locator('#settingsPasswordResetBtn').waitFor({ state: 'visible', timeout: 5000 });
    const overflow = await page.evaluate(function() {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    assert.equal(overflow, false, 'no horizontal overflow at 375px');
    assertCleanRuntime(fixture, 'mobile');
  } finally {
    await closeFixture(fixture);
  }
});

// --- status element has correct ARIA attributes ---

test('#3635 status element has role=status and aria-live=polite', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'aria@example.com', uid: 'aria-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    const attrs = await page.evaluate(function() {
      const el = document.getElementById('settingsPasswordResetStatus');
      return {
        role: el ? el.getAttribute('role') : null,
        ariaLive: el ? el.getAttribute('aria-live') : null
      };
    });
    assert.equal(attrs.role, 'status');
    assert.equal(attrs.ariaLive, 'polite');
    assertCleanRuntime(fixture, 'aria');
  } finally {
    await closeFixture(fixture);
  }
});

// --- empty status takes no space ---

test('#3635 empty status element takes no space', async function() {
  const fixture = await newSettingsPage({
    user: { email: 'empty@example.com', uid: 'empty-1', providerData: [{ providerId: 'password' }] },
    lang: 'en',
    resetMode: 'resolve'
  });
  try {
    const page = fixture.page;
    const display = await page.evaluate(function() {
      const el = document.getElementById('settingsPasswordResetStatus');
      return el ? getComputedStyle(el).display : null;
    });
    assert.equal(display, 'none', 'empty status must be display:none');
    assertCleanRuntime(fixture, 'empty-status');
  } finally {
    await closeFixture(fixture);
  }
});
