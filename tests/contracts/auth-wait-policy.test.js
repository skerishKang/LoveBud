const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('auth wait policy uses shared global wait constant in auth and api layers', () => {
  const authFirebase = read('js/auth/auth-firebase.js');
  const postgresClient = read('js/postgres-client.js');

  // Both should reference __LOVEBUD_AUTH_WAIT_MS
  assert.match(authFirebase, /__LOVEBUD_AUTH_WAIT_MS/);
  assert.match(postgresClient, /__LOVEBUD_AUTH_WAIT_MS/);
  
  // postgres-client should have poll interval defined
  assert.match(postgresClient, /AUTH_POLL_INTERVAL_MS/);
});