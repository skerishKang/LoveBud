const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');
const MODAL_HELPERS_PY = path.join(ROOT, 'modal_compute/api_response_helpers.py');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `${startPattern} should exist`);

  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `${endPattern} should exist after ${startPattern}`);

  return afterStart.slice(0, end);
}

test('Cloudflare write proxy reads and rebuilds a bounded write body without relying on content-length', () => {
  const source = readFile(CATCHALL_JS);

  assert.match(source, /const\s+MAX_WRITE_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(source, /function\s+getContentLengthBytes\s*\(/);
  assert.match(source, /async\s+function\s+readBoundedWriteBody\s*\(/);
  assert.match(source, /function\s+buildPayloadTooLargeResponse\s*\(/);

  const limitBlock = sliceBetween(
    source,
    /async\s+function\s+readBoundedWriteBody\s*\(/,
    /function\s+buildPayloadTooLargeResponse\s*\(/
  );
  assert.match(limitBlock, /contentLength\s*!==\s*null/);
  assert.match(limitBlock, /contentLength\s*>\s*MAX_WRITE_BODY_BYTES/);
  assert.match(limitBlock, /request\.body\.getReader\(\)/, 'Cloudflare guard must inspect the original body stream when content-length is missing');
  assert.doesNotMatch(limitBlock, /request\.clone\(\)/, 'Cloudflare guard must not tee the request body with request.clone()');
  assert.match(limitBlock, /totalBytes\s*\+=\s*value\.byteLength/);
  assert.match(limitBlock, /totalBytes\s*>\s*MAX_WRITE_BODY_BYTES/);
  assert.match(limitBlock, /tooLarge:\s*true,\s*body:\s*null/);
  assert.match(limitBlock, /new\s+Uint8Array\(totalBytes\)/);
  assert.match(limitBlock, /body\.set\(chunk,\s*offset\)/);
});

test('Cloudflare write proxy rejects oversized non-DELETE write requests before forwarding', () => {
  const source = readFile(CATCHALL_JS);
  const writeBlock = sliceBetween(
    source,
    /async\s+function\s+tryModalWrite\s*\(/,
    /export\s+async\s+function\s+onRequest\s*\(/
  );

  assert.match(writeBlock, /let\s+boundedBody\s*=\s*null/);
  assert.match(writeBlock, /const\s+bodyCheck\s*=\s*await\s+readBoundedWriteBody\(request\)/);
  assert.match(writeBlock, /if\s*\(bodyCheck\.tooLarge\)/);
  assert.match(writeBlock, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(writeBlock, /boundedBody\s*=\s*bodyCheck\.body/);
  assert.match(writeBlock, /body:\s*method\s*!==\s*'DELETE'\s*\?\s*boundedBody\s*:\s*null/);
});

test('Cloudflare oversized body response is safe JSON and does not echo request body', () => {
  const source = readFile(CATCHALL_JS);
  const responseBlock = sliceBetween(
    source,
    /function\s+buildPayloadTooLargeResponse\s*\(/,
    /function\s+isBrowseSummaryRequest\s*\(/
  );

  assert.match(responseBlock, /status:\s*413/);
  assert.match(responseBlock, /Request body too large/);
  assert.match(responseBlock, /application\/json/);
  assert.match(responseBlock, /payload-too-large/);
  assert.doesNotMatch(responseBlock, /request\.body/);
  assert.doesNotMatch(responseBlock, /await\s+request\.text/);
  assert.doesNotMatch(responseBlock, /await\s+request\.json/);
});

test('Modal JSON parser enforces the same body size limit while reading the stream', () => {
  const source = readFile(MODAL_HELPERS_PY);

  assert.match(source, /MAX_JSON_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(source, /def\s+_get_content_length\s*\(/);
  assert.match(source, /def\s+_raise_if_content_length_too_large\s*\(/);
  assert.match(source, /async\s+def\s+_read_bounded_body\s*\(/);
  assert.match(source, /async\s+for\s+chunk\s+in\s+request\.stream\(\)/);
  assert.match(source, /total_size\s*\+=\s*len\(chunk\)/);
  assert.match(source, /total_size\s*>\s*MAX_JSON_BODY_BYTES/);
  assert.match(source, /HTTPException\(status_code=413,\s*detail="Request body too large"\)/);

  const parseStart = source.indexOf('async def parse_json_body');
  assert.notEqual(parseStart, -1, 'parse_json_body should exist');
  const parseBody = source.slice(parseStart);
  assert.ok(
    parseBody.indexOf('body = await _read_bounded_body(request)') < parseBody.indexOf('json.loads(body)'),
    'Modal parser must enforce stream body size before JSON parsing'
  );
  assert.doesNotMatch(parseBody, /await\s+request\.json\(\)/, 'Modal parser must not call request.json() before size enforcement');
});
