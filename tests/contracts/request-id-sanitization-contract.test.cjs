const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');
const REQUEST_ID_HELPER_JS = path.join(ROOT, 'functions/_shared/request-id.js');
const DEDICATED_SOCIAL_ROUTES = [
  'functions/api/trees/[tree_id]/comments.js',
  'functions/api/trees/[tree_id]/likes.js',
  'functions/api/trees/[tree_id]/views.js',
  'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js',
  'functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js',
];

function readCatchallSource() {
  return fs.readFileSync(CATCHALL_JS, 'utf8');
}

// #4535 Slice 3 removed the catch-all's byte-identical local copy of the
// bounded request-id policy. The single authority is now
// functions/_shared/request-id.js, so the policy-body assertions read that
// module instead of the gateway. Propagation assertions still read the gateway.
function readCanonicalRequestIdSource() {
  return fs.readFileSync(REQUEST_ID_HELPER_JS, 'utf8');
}

function extractFunctionBlock(content, functionName) {
  const start = content.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const openBrace = content.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} should have body`);

  let depth = 0;
  for (let index = openBrace; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openBrace, index + 1);
  }

  assert.fail(`${functionName} body should be closed`);
}

test('cloudflare request id policy has a single canonical authority, not a per-route copy', () => {
  const content = readCatchallSource();

  // The catch-all must consume the shared policy rather than redefining it.
  assert.match(
    content,
    /import\s*\{[^}]*REQUEST_ID_HEADER[^}]*getOrCreateRequestId[^}]*\}\s*from\s*['"][^'"]*_shared\/request-id\.js['"]/,
    'catch-all should import the canonical request-id policy'
  );
  assert.doesNotMatch(
    content,
    /const\s+REQUEST_ID_HEADER\s*=\s*'x-lovebud-request-id'/,
    'catch-all must not redeclare the request id header'
  );
  assert.doesNotMatch(content, /const\s+MAX_REQUEST_ID_LENGTH\s*=\s*80/, 'catch-all must not redeclare the max length');
  assert.doesNotMatch(content, /const\s+SAFE_REQUEST_ID_PATTERN\s*=/, 'catch-all must not redeclare the safe pattern');

  // The canonical module still defines exactly that policy.
  const canonical = readCanonicalRequestIdSource();
  assert.match(canonical, /REQUEST_ID_HEADER\s*=\s*'x-lovebud-request-id'/);
  assert.match(canonical, /MAX_REQUEST_ID_LENGTH\s*=\s*80/);
  assert.match(canonical, /SAFE_REQUEST_ID_PATTERN\s*=\s*\/\^\[A-Za-z0-9\._:-\]\+\$\//);
});

test('normalizeRequestId accepts only trimmed trace-safe request ids', () => {
  const content = readCanonicalRequestIdSource();
  const normalizeBlock = extractFunctionBlock(content, 'normalizeRequestId');

  assert.match(normalizeBlock, /typeof\s+value\s*!==\s*'string'/, 'non-string values must be rejected');
  assert.match(normalizeBlock, /value\.trim\(\)/, 'request id values must be trimmed before reuse');
  assert.match(normalizeBlock, /trimmed\.length\s*>\s*MAX_REQUEST_ID_LENGTH/, 'oversized request ids must be rejected');
  assert.match(normalizeBlock, /!SAFE_REQUEST_ID_PATTERN\.test\(trimmed\)/, 'unsafe characters must be rejected');
  assert.match(normalizeBlock, /return\s+trimmed/, 'safe request ids should remain usable for tracing');
});

test('getOrCreateRequestId reuses only normalized request ids and otherwise generates a boundary id', () => {
  const content = readCanonicalRequestIdSource();
  const requestIdBlock = extractFunctionBlock(content, 'getOrCreateRequestId');

  assert.match(requestIdBlock, /normalizeRequestId\(request\.headers\.get\(REQUEST_ID_HEADER\)\)/);
  assert.match(requestIdBlock, /if\s*\(existingRequestId\)/);
  assert.match(requestIdBlock, /return\s+existingRequestId/);
  assert.match(requestIdBlock, /return\s+generateRequestId\(\)/);
  assert.doesNotMatch(requestIdBlock, /return\s+request\.headers\.get\('x-lovebud-request-id'\)/, 'raw client request id must not be returned directly');
});

test('sanitized/generated request id is the only value forwarded to Modal and response headers', () => {
  const content = readCatchallSource();
  const readBlock = extractFunctionBlock(content, 'tryModalRead');
  const writeBlock = extractFunctionBlock(content, 'tryModalWrite');
  const upstreamBlock = extractFunctionBlock(content, 'withUpstreamHeader');

  assert.match(readBlock, /headers\[REQUEST_ID_HEADER\]\s*=\s*requestId/, 'read proxy should forward sanitized/generated request id');
  assert.match(writeBlock, /headers\[REQUEST_ID_HEADER\]\s*=\s*requestId/, 'write proxy should forward sanitized/generated request id');
  assert.match(upstreamBlock, /headers\.set\(REQUEST_ID_HEADER,\s*requestId\)/, 'response should expose sanitized/generated request id');
  assert.doesNotMatch(readBlock, /request\.headers\.get\('x-lovebud-request-id'\)/, 'read proxy must not re-read raw request id');
  assert.doesNotMatch(writeBlock, /request\.headers\.get\('x-lovebud-request-id'\)/, 'write proxy must not re-read raw request id');
});

test('#3949 shared request-id helper mirrors the canonical bounded policy', () => {
  const content = fs.readFileSync(REQUEST_ID_HELPER_JS, 'utf8');

  assert.match(content, /REQUEST_ID_HEADER\s*=\s*'x-lovebud-request-id'/);
  assert.match(content, /MAX_REQUEST_ID_LENGTH\s*=\s*80/);
  assert.match(content, /SAFE_REQUEST_ID_PATTERN\s*=\s*\/\^\[A-Za-z0-9\._:-\]\+\$\//);
  assert.match(content, /const\s+trimmed\s*=\s*value\.trim\(\)/);
  assert.match(content, /trimmed\.length\s*>\s*MAX_REQUEST_ID_LENGTH/);
  assert.match(content, /!SAFE_REQUEST_ID_PATTERN\.test\(trimmed\)/);
  assert.match(content, /normalizeRequestId\(request\.headers\.get\(REQUEST_ID_HEADER\)\)/);
  assert.match(content, /return\s+'req-'\s*\+\s*crypto\.randomUUID\(\)/);
});

test('#3949 dedicated social routes consume the shared request-id boundary', () => {
  for (const relativePath of DEDICATED_SOCIAL_ROUTES) {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(content, /import\s*\{[^}]*REQUEST_ID_HEADER[^}]*getOrCreateRequestId[^}]*\}\s*from\s*['"][^'"]*_shared\/request-id\.js['"]/, `${relativePath}: must import shared request-id policy`);
    assert.match(content, /getOrCreateRequestId\(/, `${relativePath}: must normalize/generate once at route boundary`);
    assert.doesNotMatch(content, /function\s+generateRequestId\s*\(/, `${relativePath}: local generator must be removed`);
    assert.doesNotMatch(content, /function\s+getOrCreateRequestId\s*\(/, `${relativePath}: local raw policy must be removed`);
    assert.doesNotMatch(content, /const\s+existing\s*=\s*request\.headers\.get\(REQUEST_ID_HEADER\)/, `${relativePath}: raw caller ID must not bypass shared normalization`);
  }
});
// #4535 Slice 3: the catch-all gateway consumes the shared request-id boundary
// exactly as the #3949 dedicated social routes do. The gateway keeps every
// propagation site (upstream request headers, response headers, expose-headers);
// only the duplicate policy definition moved to the one canonical module.
test('#4535 slice 3: the catch-all gateway consumes the shared request-id boundary', () => {
  const content = readCatchallSource();

  assert.match(
    content,
    /import\s*\{[^}]*REQUEST_ID_HEADER[^}]*getOrCreateRequestId[^}]*\}\s*from\s*['"][^'"]*_shared\/request-id\.js['"]/,
    'catch-all must import the shared request-id policy'
  );
  assert.match(content, /getOrCreateRequestId\(request\)/, 'catch-all must normalize/generate once at the route boundary');
  assert.doesNotMatch(content, /function\s+generateRequestId\s*\(/, 'catch-all local generator must be removed');
  assert.doesNotMatch(content, /function\s+normalizeRequestId\s*\(/, 'catch-all local normalizer must be removed');
  assert.doesNotMatch(content, /function\s+getOrCreateRequestId\s*\(/, 'catch-all local raw policy must be removed');
  assert.doesNotMatch(
    content,
    /const\s+existing\s*=\s*request\.headers\.get\(REQUEST_ID_HEADER\)/,
    'catch-all raw caller ID must not bypass shared normalization'
  );
});

test('#4535 slice 3: the catch-all still normalizes once and propagates the sanitized id', () => {
  const content = readCatchallSource();
  const onRequestBlock = extractFunctionBlock(content, 'onRequest');

  assert.match(onRequestBlock, /const\s+requestId\s*=\s*getOrCreateRequestId\(request\)/,
    'onRequest must derive the request id once per request');
  assert.equal((content.match(/getOrCreateRequestId\(request\)/g) || []).length, 1,
    'the request id must be derived exactly once in the gateway');

  // Propagation is unchanged: the same header name still reaches the Modal
  // request, the response, and the exposed header list.
  const readBlock = extractFunctionBlock(content, 'tryModalRead');
  const writeBlock = extractFunctionBlock(content, 'tryModalWrite');
  const upstreamBlock = extractFunctionBlock(content, 'withUpstreamHeader');
  assert.match(readBlock, /headers\[REQUEST_ID_HEADER\]\s*=\s*requestId/);
  assert.match(writeBlock, /headers\[REQUEST_ID_HEADER\]\s*=\s*requestId/);
  assert.match(upstreamBlock, /headers\.set\(REQUEST_ID_HEADER,\s*requestId\)/);
  assert.match(upstreamBlock, /Access-Control-Expose-Headers/);
});

// Behavioural parity: the shared policy must accept and reject exactly what the
// removed catch-all copy accepted and rejected.
test('#4535 slice 3: the shared request-id policy behaves identically at the gateway boundary', async () => {
  const requestId = await import('../../functions/_shared/request-id.js');

  assert.equal(requestId.REQUEST_ID_HEADER, 'x-lovebud-request-id');
  assert.equal(requestId.MAX_REQUEST_ID_LENGTH, 80);
  assert.equal(requestId.SAFE_REQUEST_ID_PATTERN.source, '^[A-Za-z0-9._:-]+$');

  for (const safe of ['req-abc', '  req-abc  ', 'req-abc.def_1:2-3', 'a'.repeat(80)]) {
    const normalized = requestId.normalizeRequestId(safe);
    assert.ok(normalized, `safe id should be accepted: ${JSON.stringify(safe)}`);
    assert.equal(normalized, String(safe).trim(), 'accepted ids are returned trimmed');
  }

  for (const unsafe of ['', '   ', 'bad id', 'a'.repeat(81), 'req-é', '<script>', 'req;drop', '../../etc', null, undefined, 12345, {}, ['req-abc']]) {
    assert.equal(requestId.normalizeRequestId(unsafe), null,
      `unsafe id must be rejected: ${JSON.stringify(unsafe)}`);
  }

  assert.match(requestId.generateRequestId(), /^req-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    'generated boundary ids keep the req- prefix and UUID shape');

  // getOrCreateRequestId reuses only a normalized client id.
  const reused = new Request('https://test5.lovebud.pages.dev/api/trees/t', {
    headers: { 'x-lovebud-request-id': '  req-pinned-1  ' }
  });
  assert.equal(requestId.getOrCreateRequestId(reused), 'req-pinned-1', 'a safe client id is reused, trimmed');

  const rejected = new Request('https://test5.lovebud.pages.dev/api/trees/t', {
    headers: { 'x-lovebud-request-id': 'req-<script>' }
  });
  assert.match(requestId.getOrCreateRequestId(rejected), /^req-[0-9a-f-]{36}$/,
    'an unsafe client id must never be echoed back');
});

// The canonical module is the authority and must not drift during this slice.
test('#4535 slice 3: the canonical request-id module is unchanged by this extraction', async () => {
  const requestId = await import('../../functions/_shared/request-id.js');

  for (const exported of ['REQUEST_ID_HEADER', 'MAX_REQUEST_ID_LENGTH', 'SAFE_REQUEST_ID_PATTERN', 'generateRequestId', 'normalizeRequestId', 'getOrCreateRequestId']) {
    assert.ok(exported in requestId, `canonical module must still export ${exported}`);
  }

  const canonical = readCanonicalRequestIdSource();
  assert.match(canonical, /export function normalizeRequestId/);
  assert.match(canonical, /export function getOrCreateRequestId/);
  assert.match(canonical, /return\s+'req-'\s*\+\s*crypto\.randomUUID\(\)/);
});