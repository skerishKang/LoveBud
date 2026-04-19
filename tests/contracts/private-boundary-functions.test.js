const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('memory-detail keeps private memory owner boundary checks', () => {
  const src = read('netlify/functions/memory-detail.js');
  assert.match(src, /Access denied: private memory/);
  assert.match(src, /ownerId === optionalUser\.uid/);
});

test('tree-detail keeps non-owner forbidden checks', () => {
  const src = read('netlify/functions/tree-detail.js');
  assert.match(src, /Forbidden: not your tree/);
  assert.match(src, /Access denied/);
});

test('memories function keeps own-tree access checks', () => {
  const src = read('netlify/functions/memories.js');
  assert.match(src, /Access denied: not your tree/);
  assert.match(src, /owner_id !== user\.uid/);
});