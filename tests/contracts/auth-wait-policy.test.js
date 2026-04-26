const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Note: __LOVEBUD_AUTH_WAIT_MS is defined in auth-firebase.js and auth-policy.js.
// postgres-client.js was historically the auth+api layer but has since been
// refactored into a pure browser API client. The wait constant now lives in
// js/auth/auth-firebase.js and js/api/auth-policy.js.
test('auth wait policy uses shared global wait constant in auth and api layers', () => {
  const authFirebase = read('js/auth/auth-firebase.js');
  const authPolicy = read('js/api/auth-policy.js');

  // Both auth-firebase.js and auth-policy.js reference __LOVEBUD_AUTH_WAIT_MS
  assert.match(authFirebase, /__LOVEBUD_AUTH_WAIT_MS/);
  assert.match(authPolicy, /__LOVEBUD_AUTH_WAIT_MS/);

  // auth-policy.js defines the AUTH_WAIT_MS constant that powers wait attempts
  assert.match(authPolicy, /AUTH_WAIT_MS/);
});