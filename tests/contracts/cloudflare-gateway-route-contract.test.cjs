const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const gateway = () => readRepoFile('functions/api/[[path]].js');
const memoryProxy = () => readRepoFile('functions/_shared/memory-route-proxy.js');

test('Cloudflare gateway preserves community read route mappings to Modal', () => {
  const source = gateway();

  assert.match(source, /path === '\/api\/community\/trees'/);
  assert.match(source, /view'\) === 'summary'/);
  assert.match(source, /target\.pathname = '\/modal\/browse\/latest'/);
  assert.match(source, /path === '\/api\/community\/growing-trees'/);
  assert.match(source, /target\.pathname = '\/modal\/browse\/growing'/);
  assert.match(source, /path === '\/api\/community\/memories'/);
  assert.match(source, /target\.pathname = '\/modal\/community\/memories'/);
});

test('Cloudflare gateway preserves private collection route mappings to Modal', () => {
  const source = gateway();
  const memorySource = memoryProxy();

  assert.match(source, /path === '\/api\/trees'/);
  assert.match(source, /target\.pathname = '\/modal\/private\/trees'/);
  assert.match(source, /buildMemoryModalUrl\(request, env\)/);
  assert.match(memorySource, /path === '\/api\/memories'/);
  assert.match(memorySource, /new URL\('\/modal\/private\/memories', modalBaseUrl\)/);
});

test('Cloudflare gateway preserves detail route public-private split', () => {
  const source = gateway();
  const memorySource = memoryProxy();

  assert.match(source, /buildMemoryModalUrl\(request, env\)/);
  assert.match(memorySource, /isMemoryDetailRequest\(request\)/);
  assert.match(memorySource, /\$\{isPrivate \? '\/modal\/private\/memories' : '\/modal\/memories'\}\/\$\{memoryId\}/);
  assert.match(source, /const treeMatch = path\.match/);
  assert.match(source, /const treeId = normalizeEncodedPathSegment\(treeMatch\[1\]\)/);
  assert.match(source, /`\/modal\/private\/trees\/\$\{treeId\}`/);
  assert.match(source, /`\/modal\/trees\/\$\{treeId\}`/);
});

test('Cloudflare gateway preserves fork route and method ownership', () => {
  const source = gateway();

  assert.match(source, /treeForkMatch/);
  assert.match(source, /method === 'POST'/);
  assert.match(source, /`\/modal\/private\/trees\/\$\{treeId\}\/fork`/);
  assert.match(source, /isModalOwnedWriteRoute/);
  assert.match(source, /\['POST', 'PUT', 'DELETE'\]/);
});

test('Cloudflare gateway preserves request id and upstream response headers', () => {
  const source = gateway();

  assert.match(source, /generateRequestId/);
  assert.match(source, /getOrCreateRequestId/);
  assert.match(source, /x-lovebud-request-id/);
  assert.match(source, /x-lovebud-upstream/);
  assert.match(source, /x-lovebud-route-status/);
  assert.match(source, /method-not-allowed/);
  assert.match(source, /unhandled/);
});
