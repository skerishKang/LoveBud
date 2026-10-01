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
// Route mapping moved out of the gateway in #4535 Slice 1; the gateway imports it.
const routeMapping = () => readRepoFile('functions/_shared/catchall-modal-route-mapping.js');
// #4535 Slice 3: the catch-all no longer defines the bounded request-id
// policy inline; it consumes the single canonical module, exactly as the
// dedicated routes already do.
const requestIdPolicy = () => readRepoFile('functions/_shared/request-id.js');
// #4535 Slice 4: the catch-all no longer shapes its own terminal responses; the
// pure 401/404/405/413/503/504 taxonomy now has a single owner that the gateway
// imports. Header propagation (withUpstreamHeader) stays in the gateway.
const responsePolicy = () => readRepoFile('functions/_shared/catchall-response-policy.js');

test('Cloudflare gateway preserves community read route mappings to Modal', () => {
  const source = routeMapping();

  assert.match(source, /path === '\/api\/community\/trees'/);
  assert.match(source, /view'\) === 'summary'/);
  assert.match(source, /target\.pathname = '\/modal\/browse\/latest'/);
  assert.match(source, /path === '\/api\/community\/growing-trees'/);
  assert.match(source, /target\.pathname = '\/modal\/browse\/growing'/);
  assert.match(source, /path === '\/api\/community\/memories'/);
  assert.match(source, /target\.pathname = '\/modal\/community\/memories'/);
});

test('Cloudflare gateway preserves private collection route mappings to Modal', () => {
  const source = routeMapping();
  const memorySource = memoryProxy();

  assert.match(source, /path === '\/api\/trees'/);
  assert.match(source, /target\.pathname = '\/modal\/private\/trees'/);
  assert.match(source, /buildMemoryModalUrl\(request, env\)/);
  assert.match(memorySource, /path === '\/api\/memories'/);
  assert.match(memorySource, /new URL\('\/modal\/private\/memories', modalBaseUrl\)/);
});

test('Cloudflare gateway preserves detail route public-private split', () => {
  const source = routeMapping();
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
  const source = routeMapping();

  assert.match(source, /treeForkMatch/);
  assert.match(source, /method === 'POST'/);
  assert.match(source, /`\/modal\/private\/trees\/\$\{treeId\}\/fork`/);
  assert.match(source, /isModalOwnedWriteRoute/);
  assert.match(source, /\['POST', 'PUT', 'DELETE'\]/);
});

test('Cloudflare gateway preserves request id and upstream response headers', () => {
  const source = gateway();
  const policy = requestIdPolicy();

  // The gateway still derives one request id per request and still propagates
  // it, but the policy definition now has a single canonical authority.
  assert.match(source, /getOrCreateRequestId\(request\)/, 'gateway must derive the request id at its boundary');
  assert.match(
    source,
    /import\s*\{[^}]*REQUEST_ID_HEADER[^}]*getOrCreateRequestId[^}]*\}\s*from\s*['"][^'"]*_shared\/request-id\.js['"]/,
    'gateway must consume the canonical request-id policy'
  );
  assert.doesNotMatch(source, /function\s+generateRequestId\s*\(/, 'gateway must not redefine the id generator');
  assert.doesNotMatch(source, /const\s+REQUEST_ID_HEADER\s*=/, 'gateway must not redeclare the id header');

  // The canonical module owns the header name and the generator.
  assert.match(policy, /x-lovebud-request-id/);
  assert.match(policy, /generateRequestId/);

  assert.match(source, /x-lovebud-upstream/);

  // #4535 Slice 4: the route-status taxonomy those assertions guard moved with
  // the response shape. The gateway must consume it, not redeclare it.
  assert.match(
    source,
    /import\s*\{[^}]*buildBodyReadFailedResponse[^}]*buildPayloadTooLargeResponse[^}]*\}\s*from\s*['"][^'"]*_shared\/catchall-response-policy\.js['"]/,
    'gateway must consume the shared response policy'
  );
  assert.doesNotMatch(source, /function\s+buildNotFoundResponse\s*\(/, 'gateway must not redefine the 404 response');
  assert.doesNotMatch(source, /function\s+buildMethodNotAllowedResponse\s*\(/, 'gateway must not redefine the 405 response');

  const response = responsePolicy();
  assert.match(response, /x-lovebud-route-status/);
  assert.match(response, /method-not-allowed/);
  assert.match(response, /unhandled/);
});
