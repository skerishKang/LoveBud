const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const POSTGRES_CLIENT_PATH = path.join(ROOT, 'js', 'postgres-client.js');

function readPostgresClient() {
  return fs.readFileSync(POSTGRES_CLIENT_PATH, 'utf8');
}

test('postgres client defines a private public-demo tree id guard', () => {
  const source = readPostgresClient();

  assert.ok(source.includes('function isPublicDemoTreeId(treeId)'));
  assert.ok(source.includes("const value = String(treeId || '').trim();"));
  assert.ok(source.includes('return /^public-[a-z0-9-]+$/i.test(value);'));
});

test('getMemoriesByTree returns an empty list before calling memories API for public demo ids', () => {
  const source = readPostgresClient();
  const guardIndex = source.indexOf('if (isPublicDemoTreeId(normalizedTreeId))');
  const emptyReturnIndex = source.indexOf('return [];', guardIndex);
  const apiFetchIndex = source.indexOf('BaseApiFetch.apiFetch(`/memories?treeId=', guardIndex);

  assert.ok(guardIndex > -1, 'expected public-demo guard inside getMemoriesByTree');
  assert.ok(emptyReturnIndex > guardIndex, 'expected public-demo guard to return an empty list');
  assert.ok(apiFetchIndex > emptyReturnIndex, 'expected private memories API call to remain after the guard');
});

test('getMemoriesByTree still preserves normal private tree memory endpoint shape', () => {
  const source = readPostgresClient();

  assert.ok(source.includes("const normalizedTreeId = String(treeId || '').trim();"));
  assert.ok(source.includes('if (isPublicDemoTreeId(normalizedTreeId))'));
  assert.ok(source.includes('encodeURIComponent(treeId)'));
});
