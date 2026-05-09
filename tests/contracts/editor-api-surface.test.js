const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor-related api client methods remain available', () => {
  const client = read('js/postgres-client.js');

  assert.match(client, /createMemory:\s*async/);
  assert.match(client, /updateMemory:\s*async/);
  assert.match(client, /deleteMemory:\s*async/);
  assert.match(client, /createTree:\s*async/);
  assert.match(client, /updateTree:\s*async/);
  assert.match(client, /deleteTree:\s*async/);
});