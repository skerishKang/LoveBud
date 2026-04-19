const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('postgres client keeps community endpoints outside auth-required classification', () => {
  const client = read('js/postgres-client.js');

  assert.match(client, /function endpointLikelyRequiresAuth\(endpoint\)/);
  assert.match(client, /startsWith\('\/community\/'\)/);
});

test('private api usage remains present for trees and memories flows', () => {
  const client = read('js/postgres-client.js');

  assert.match(client, /apiFetch\('\/trees'\)/);
  assert.match(client, /apiFetch\(`\/memories\/\$\{memoryId\}`\)/);
});