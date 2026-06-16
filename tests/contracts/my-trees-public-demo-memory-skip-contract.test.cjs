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

  assert.match(source, /function\s+isPublicDemoTreeId\s*\(treeId\)\s*{/);
  assert.match(source, /String\(treeId \|\| ''\)\.trim\(\)/);
  assert.match(source, /\/\^public-\[a-z0-9-\]\+\$\/i\.test\(value\)/);
});

test('getMemoriesByTree returns an empty list before calling memories API for public demo ids', () => {
  const source = readPostgresClient();
  const guardIndex = source.indexOf('if (isPublicDemoTreeId(normalizedTreeId))');
  const emptyReturnIndex = source.indexOf('return [];', guardIndex);
  const apiFetchIndex = source.indexOf('BaseApiFetch.apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`)', guardIndex);

  assert.ok(guardIndex > -1, 'expected public-demo guard inside getMemoriesByTree');
  assert.ok(emptyReturnIndex > guardIndex, 'expected public-demo guard to return an empty list');
  assert.ok(apiFetchIndex > emptyReturnIndex, 'expected private memories API call to remain after the guard');
});

test('getMemoriesByTree still preserves normal private tree memory endpoint shape', () => {
  const source = readPostgresClient();

  assert.match(source, /const\s+normalizedTreeId\s*=\s*String\(treeId \|\| ''\)\.trim\(\);/);
  assert.match(source, /if\s*\(isPublicDemoTreeId\(normalizedTreeId\)\)/);
  assert.match(source, /`\/memories\?treeId=\$\{encodeURIComponent\(treeId\)\}`/);
});