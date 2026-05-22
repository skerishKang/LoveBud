const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');

function readCatchallSource() {
  return fs.readFileSync(CATCHALL_JS, 'utf8');
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

test('cloudflare request id policy defines a single canonical header and bounded max length', () => {
  const content = readCatchallSource();

  assert.match(content, /const\s+REQUEST_ID_HEADER\s*=\s*'x-lovebud-request-id'/);
  assert.match(content, /const\s+MAX_REQUEST_ID_LENGTH\s*=\s*80/);
  assert.match(content, /const\s+SAFE_REQUEST_ID_PATTERN\s*=\s*\/\^\[A-Za-z0-9\._:-\]\+\$\//);
});

test('normalizeRequestId accepts only trimmed trace-safe request ids', () => {
  const content = readCatchallSource();
  const normalizeBlock = extractFunctionBlock(content, 'normalizeRequestId');

  assert.match(normalizeBlock, /typeof\s+value\s*!==\s*'string'/, 'non-string values must be rejected');
  assert.match(normalizeBlock, /value\.trim\(\)/, 'request id values must be trimmed before reuse');
  assert.match(normalizeBlock, /trimmed\.length\s*>\s*MAX_REQUEST_ID_LENGTH/, 'oversized request ids must be rejected');
  assert.match(normalizeBlock, /!SAFE_REQUEST_ID_PATTERN\.test\(trimmed\)/, 'unsafe characters must be rejected');
  assert.match(normalizeBlock, /return\s+trimmed/, 'safe request ids should remain usable for tracing');
});

test('getOrCreateRequestId reuses only normalized request ids and otherwise generates a boundary id', () => {
  const content = readCatchallSource();
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
