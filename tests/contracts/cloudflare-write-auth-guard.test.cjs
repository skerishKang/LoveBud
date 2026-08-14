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

// ─── HELPER PRESENCE ────────────────────────────────────────────────────────

test('Cloudflare gateway defines hasAuthorizationHeader helper', () => {
  const source = gateway();
  assert.match(source, /function hasAuthorizationHeader/);
  assert.match(source, /request\.headers\.get\('authorization'\)/);
  assert.match(source, /request\.headers\.get\('Authorization'\)/);
});

test('Cloudflare gateway defines buildMissingAuthorizationResponse', () => {
  const source = gateway();
  assert.match(source, /function buildMissingAuthorizationResponse/);
  assert.match(source, /missing-authorization/);
  assert.match(source, /Authorization required/);
  assert.match(source, /status: 401/);
});

// ─── AUTH CHECK IN tryModalWrite ────────────────────────────────────────────

test('Cloudflare gateway checks authorization before body read in tryModalWrite', () => {
  const source = gateway();
  const writeFn = extractFunctionBlock('tryModalWrite');
  const authCheckIndex = writeFn.indexOf('hasAuthorizationHeader');
  const bodyReadIndex = writeFn.indexOf('readBoundedRequestBody');
  assert.notEqual(authCheckIndex, -1, 'tryModalWrite should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIndex, -1, 'tryModalWrite should call readBoundedRequestBody');
  assert.ok(authCheckIndex < bodyReadIndex,
    'hasAuthorizationHeader check should appear before readBoundedRequestBody');
});

test('Cloudflare gateway early-returns missing-authorization when auth missing in tryModalWrite', () => {
  const source = gateway();
  const writeFn = extractFunctionBlock('tryModalWrite');
  assert.match(writeFn, /buildMissingAuthorizationResponse/);
  assert.match(writeFn, /Missing auth/);
});

// ─── ROUTE-SPECIFIC WRITE AUTH GUARDS ───────────────────────────────────────

test('Cloudflare gateway guards POST /api/trees with auth check', () => {
  const source = gateway();
  assert.match(source, /isModalOwnedWriteRoute/);
  assert.match(source, /\/modal\/private\/trees/);
  assert.match(source, /POST.*\/api\/trees/);
});

test('Cloudflare gateway guards POST /api/memories with auth check', () => {
  const source = gateway();
  const memorySource = memoryProxy();
  assert.match(source, /'POST', 'PUT', 'DELETE'/);
  assert.match(source, /isMemoryWriteRequest\(request\)/);
  assert.match(source, /prepareMemoryWriteProxyRequest\(request, env \|\| \{\}, \{ requestId \}\)/);
  assert.match(memorySource, /method === 'POST' && isMemoryCollectionRequest\(request\)/);
  assert.match(memorySource, /buildMemoryMissingAuthorizationResponse/);
  assert.match(memorySource, /readBoundedMemoryWriteBody/);
});

test('Cloudflare gateway guards PUT/DELETE detail writes with auth check', () => {
  const source = gateway();
  const memorySource = memoryProxy();
  assert.match(source, /'PUT', 'DELETE']/);
  assert.match(source, /isMemoryWriteRequest\(request\)/);
  assert.match(memorySource, /\['PUT', 'DELETE'\]\.includes\(method\) && isMemoryDetailRequest\(request\)/);
  assert.match(memorySource, /\/modal\/private\/memories/);
  assert.match(source, /\/modal\/private\/trees/);
});

test('Cloudflare gateway guards POST /api/trees/:id/fork with auth check', () => {
  const source = gateway();
  assert.match(source, /\/modal\/private\/trees.*fork/);
  assert.match(source, /method === 'POST'/);
});

// ─── READ ROUTES STILL UNCHANGED ────────────────────────────────────────────

test('Cloudflare gateway still preserves GET community read routes', () => {
  const source = gateway();
  assert.match(source, /\/api\/community\/trees/);
  assert.match(source, /\/modal\/browse\/latest/);
  assert.match(source, /\/api\/community\/growing-trees/);
  assert.match(source, /\/modal\/browse\/growing/);
  assert.match(source, /get\('view'\) === 'summary'/);
});

test('Cloudflare gateway still forwards authorization header for reads', () => {
  const source = gateway();
  assert.match(source, /request\.headers\.get\('authorization'\)/);
  assert.match(source, /authorization: request\.headers\.get\('authorization'\)/);
});

// ─── HELPER ─────────────────────────────────────────────────────────────────

function extractBraceBlock(content, openBraceIndex, label) {
  assert.ok(
    Number.isInteger(openBraceIndex) && openBraceIndex >= 0 && openBraceIndex < content.length,
    `${label} should have a valid opening brace index`
  );
  assert.equal(content[openBraceIndex], '{', `${label} should start at an opening brace`);

  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openBraceIndex, index + 1);
  }

  assert.fail(`${label} should be closed`);
}

function extractFunctionBlock(functionName) {
  const content = gateway();
  const start = content.indexOf(`async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const openBrace = content.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} should have body`);

  return extractBraceBlock(content, openBrace, `${functionName} body`);
}
