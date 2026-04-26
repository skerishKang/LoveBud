const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Note: endpointLikelyRequiresAuth was historically defined inline in
// postgres-client.js but has since been extracted to js/api/auth-policy.js.
// postgres-client.js now imports AuthPolicy from window.LoveTreeAuthPolicy.
test('postgres client keeps community endpoints outside auth-required classification', () => {
  const authPolicy = read('js/api/auth-policy.js');

  // The auth policy module defines the endpoint classification function
  assert.match(authPolicy, /function endpointLikelyRequiresAuth\(endpoint\)/);
  assert.match(authPolicy, /startsWith\('\/community\/'\)/);
});

test('private api usage remains present for trees and memories flows', () => {
  const client = read('js/postgres-client.js');

  assert.match(client, /apiFetch\('\/trees'\)/);
  assert.match(client, /apiFetch\(`\/memories\/\$\{memoryId\}`\)/);
});