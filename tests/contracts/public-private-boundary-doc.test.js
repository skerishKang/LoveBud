const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('auth policy keeps community endpoints outside auth-required classification', () => {
  const policy = read('js/api/auth-policy.js');

  assert.match(policy, /function endpointLikelyRequiresAuth\(endpoint\)/);
  assert.match(policy, /startsWith\('\/community\/'\)/);
});

test('private api usage remains present for trees and memories flows', () => {
  const client = read('js/postgres-client.js');

  assert.match(client, /apiFetch\('\/trees'\)/);
  assert.match(client, /apiFetch\(\`\/memories\/\$\{memoryId\}\`\)/);
});