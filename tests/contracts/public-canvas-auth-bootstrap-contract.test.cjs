const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANVAS_HTML = path.join(ROOT, 'pages/public-canvas.html');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readPage() {
  return fs.readFileSync(CANVAS_HTML, 'utf8');
}

function countOccurrences(html, substr) {
  let count = 0;
  let idx = 0;
  while ((idx = html.indexOf(substr, idx)) !== -1) {
    count++;
    idx += substr.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('public-canvas.html loads Firebase SDK', () => {
  const html = readPage();
  assert.ok(html.indexOf('firebase-app.js') !== -1, 'must load firebase-app.js');
  assert.ok(html.indexOf('firebase-auth.js') !== -1, 'must load firebase-auth.js');
});

test('public-canvas.html loads Firebase config and auth bootstrap chain', () => {
  const html = readPage();
  const required = [
    'firebase-config.js',
    'auth-state.js',
    'auth-callbacks.js',
    'auth-cache.js',
    'auth-ui.js',
    'auth-session.js',
    'auth-firebase.js',
    'auth-ui-templates.js',
    '/auth.js',
  ];
  for (const script of required) {
    assert.ok(html.indexOf(script) !== -1, `must load ${script}`);
  }
});

test('Firebase/Auth bootstrap scripts appear in expected relative order', () => {
  const html = readPage();
  const sequence = [
    'firebase-app.js',
    'firebase-auth.js',
    'firebase-config.js',
    'auth-state.js',
    'auth-callbacks.js',
    'auth-cache.js',
    'auth-ui.js',
    'auth-session.js',
    'auth-firebase.js',
    'auth-ui-templates.js',
    '/auth.js',
  ];
  let lastIdx = -1;
  for (const script of sequence) {
    const idx = html.indexOf(script);
    assert.ok(idx !== -1, `"${script}" must exist`);
    assert.ok(idx > lastIdx, `"${script}" must follow previous script in the chain`);
    lastIdx = idx;
  }
});

test('auth.js appears before public-canvas-bridge.js', () => {
  const html = readPage();
  const authIdx = html.indexOf('/auth.js');
  const bridgeIdx = html.indexOf('public-canvas-bridge.js');
  assert.ok(authIdx !== -1, '/auth.js must exist');
  assert.ok(bridgeIdx !== -1, 'public-canvas-bridge.js must exist');
  assert.ok(authIdx < bridgeIdx, 'auth.js must load before public-canvas-bridge.js');
});

test('public-canvas-bridge.js appears before public-canvas-init.js', () => {
  const html = readPage();
  const bridgeIdx = html.indexOf('public-canvas-bridge.js');
  const initIdx = html.indexOf('public-canvas-init.js');
  assert.ok(bridgeIdx !== -1, 'public-canvas-bridge.js must exist');
  assert.ok(initIdx !== -1, 'public-canvas-init.js must exist');
  assert.ok(bridgeIdx < initIdx, 'bridge must load before init');
});

test('entire Firebase/Auth bootstrap chain completes before public canvas runtime', () => {
  const html = readPage();
  const authChainEnd = html.indexOf('/auth.js');
  const bridgeIdx = html.indexOf('public-canvas-bridge.js');
  const initIdx = html.indexOf('public-canvas-init.js');
  assert.ok(authChainEnd !== -1, 'auth.js must exist');
  assert.ok(bridgeIdx !== -1, 'public-canvas-bridge.js must exist');
  assert.ok(initIdx !== -1, 'public-canvas-init.js must exist');
  assert.ok(authChainEnd < bridgeIdx,
    'auth bootstrap (auth.js) must finish before public-canvas-bridge.js runs');
  assert.ok(authChainEnd < initIdx,
    'auth bootstrap (auth.js) must finish before public-canvas-init.js runs — the entire Firebase/Auth lifecycle completes before public runtime');
});

test('auth-protected-route.js is NOT loaded', () => {
  const html = readPage();
  assert.equal(html.indexOf('auth-protected-route'), -1,
    'must not load auth-protected-route.js');
});

test('each Firebase/Auth bootstrap script appears exactly once', () => {
  const html = readPage();
  const scripts = [
    'firebase-app.js',
    'firebase-auth.js',
    'firebase-config.js',
    'auth-state.js',
    'auth-callbacks.js',
    'auth-cache.js',
    'auth-ui.js',
    'auth-session.js',
    'auth-firebase.js',
    'auth-ui-templates.js',
    '/auth.js',
  ];
  for (const script of scripts) {
    assert.equal(countOccurrences(html, script), 1,
      `"${script}" must appear exactly once`);
  }
});

test('public entry dependencies appear exactly once — no duplicate loads', () => {
  const html = readPage();
  const deps = [
    'shared-header.js',
    'auth-policy.js',
    'base-api-fetch.js',
    'postgres-client.js',
    'public-canvas-bridge.js',
    'public-canvas-init.js',
  ];
  for (const script of deps) {
    assert.equal(countOccurrences(html, script), 1,
      `"${script}" must appear exactly once — no duplicate load`);
  }
});

test('public-canvas.html still loads all original critical scripts', () => {
  const html = readPage();
  const original = [
    'cache-utils.js',
    'editor-detail-ui.js',
    'shared-header.js',
    'public-canvas-bridge.js',
    'public-canvas-init.js',
  ];
  for (const script of original) {
    assert.ok(html.indexOf(script) !== -1, `"${script}" must still be present`);
  }
});

test('#1882 wording rule preserved', () => {
  const html = readPage();
  assert.ok(!html.includes('Fixes #1882'), 'must not use Fixes #1882');
  assert.ok(!html.includes('Closes #1882'), 'must not use Closes #1882');
  assert.ok(!html.includes('Resolves #1882'), 'must not use Resolves #1882');
});
