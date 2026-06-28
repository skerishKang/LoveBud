'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PROTECTED_ROUTE = path.join(ROOT, 'js/auth/auth-protected-route.js');

function loadRoute(overrides) {
  const ctx = {
    window: {},
    console: { log() {}, error() {}, warn() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    firebase: undefined,
    Promise: globalThis.Promise,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  ctx.window = ctx;
  if (overrides) {
    Object.keys(overrides).forEach(function(k) { ctx[k] = overrides[k]; });
    if (overrides.window) {
      Object.keys(overrides.window).forEach(function(k) { ctx.window[k] = overrides.window[k]; });
    }
  }
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(PROTECTED_ROUTE, 'utf8'), ctx);
  return {
    LoveBudProtectedRoute: ctx.window.LoveBudProtectedRoute,
    window: ctx.window,
  };
}

test('LoveBudAuthFirebase null callback yields confirmed signed-out state', function() {
  const { window } = loadRoute({
    window: { LoveBudAuthFirebase: { onAuthStateChanged(cb) { cb(null); } } },
  });

  const state = window.LoveBudProtectedRoute.getAuthState();
  assert.equal(state.ready, true);
  assert.equal(state.user, null);
  assert.equal(window.__lovebudAuthReady, true);
  assert.equal(window.__lastAuthUser, null);
});

test('subscribeAuth captures transition from initial ready:false to confirmed ready:true/null', function() {
  var capturedCallback;
  const { window } = loadRoute({
    window: {
      LoveBudAuthFirebase: {
        onAuthStateChanged: function(cb) {
          capturedCallback = cb;
        }
      }
    }
  });

  // Module loaded but callback not yet fired. Subscribe to capture transition.
  var calls = [];
  window.LoveBudProtectedRoute.subscribeAuth(function(s) {
    calls.push(s);
  });

  // First notification is the initial ready:false snapshot
  assert.equal(calls.length, 1, 'initial snapshot delivered');
  assert.equal(calls[0].ready, false, 'initial is ready:false');
  assert.equal(calls[0].user, null, 'initial user is null');

  // Fire the null callback — triggers transition to signed-out
  capturedCallback(null);

  // Now we have 2 events: initial + confirmed transition
  assert.equal(calls.length, 2, 'two events total: initial + confirmed transition');
  assert.equal(calls[1].ready, true, 'confirmed is ready:true');
  assert.equal(calls[1].user, null, 'confirmed user is null');

  // No duplicate ready:true/null notification
  var readyCount = calls.filter(function(c) { return c.ready === true; }).length;
  assert.equal(readyCount, 1, 'ready:true emitted exactly once');
  assert.equal(window.__lovebudAuthReady, true);
  assert.equal(window.__lastAuthUser, null);
});

test('requireAuthenticatedPage calls onUnauthenticated for confirmed null', function() {
  const { window } = loadRoute({
    window: { LoveBudAuthFirebase: { onAuthStateChanged(cb) { cb(null); } } },
  });

  var unauth = 0;
  var auth = 0;

  window.LoveBudProtectedRoute.requireAuthenticatedPage({
    allowCachedUser: false,
    onAuthenticated: function() { auth += 1; },
    onUnauthenticated: function() { unauth += 1; },
  });

  assert.equal(unauth, 1);
  assert.equal(auth, 0);
});

test('user object callback preserves ready:true and user', function() {
  var user = { uid: 'u1' };
  const { window } = loadRoute({
    window: { LoveBudAuthFirebase: { onAuthStateChanged(cb) { cb(user); } } },
  });

  const state = window.LoveBudProtectedRoute.getAuthState();
  assert.equal(state.ready, true);
  assert.equal(state.user, user);
  assert.equal(window.__lastAuthUser, user);
});

test('fallback firebase auth null callback yields confirmed signed-out', function() {
  const { window } = loadRoute({
    window: { LoveBudAuthFirebase: undefined },
    firebase: { auth() { return { onAuthStateChanged(cb) { cb(null); } }; } },
  });

  const state = window.LoveBudProtectedRoute.getAuthState();
  assert.equal(state.ready, true);
  assert.equal(state.user, null);
  assert.equal(window.__lovebudAuthReady, true);
  assert.equal(window.__lastAuthUser, null);
});

test('fallback firebase auth user callback preserves ready:true and user', function() {
  var user = { uid: 'u2' };
  const { window } = loadRoute({
    window: { LoveBudAuthFirebase: undefined },
    firebase: { auth() { return { onAuthStateChanged(cb) { cb(user); } }; } },
  });

  const state = window.LoveBudProtectedRoute.getAuthState();
  assert.equal(state.ready, true);
  assert.equal(state.user, user);
  assert.equal(window.__lastAuthUser, user);
});
