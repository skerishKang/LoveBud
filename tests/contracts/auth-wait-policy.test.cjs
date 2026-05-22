const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('auth wait policy uses shared global wait constant in auth and policy layers', () => {
  const authFirebase = read('js/auth/auth-firebase.js');
  const authPolicy = read('js/api/auth-policy.js');

  // Both should reference __LOVEBUD_AUTH_WAIT_MS
  assert.match(authFirebase, /__LOVEBUD_AUTH_WAIT_MS/);
  assert.match(authPolicy, /__LOVEBUD_AUTH_WAIT_MS/);
  
  // auth-policy should have poll interval defined
  assert.match(authPolicy, /AUTH_POLL_INTERVAL_MS/);
});