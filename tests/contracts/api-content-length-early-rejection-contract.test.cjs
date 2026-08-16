const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');

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

test('static contract: functions/api/[[path]].js delegates Content-Length early rejection to the shared bounded reader', () => {
  const source = readFile(CATCHALL_JS);

  assert.match(source, /import\s*\{\s*readBoundedRequestBody\s*\}\s*from\s*['"]\.\.\/_shared\/bounded-request-body\.js['"]/);
  assert.doesNotMatch(source, /function\s+getContentLengthBytes\s*\(/);
  assert.doesNotMatch(source, /function\s+isWriteContentLengthTooLarge\s*\(/);
  assert.doesNotMatch(source, /const\s+MAX_WRITE_BODY_BYTES\s*=/);
  assert.doesNotMatch(source, /async\s+function\s+readBoundedWriteBody\s*\(/);

  const writeBlock = sliceBetween(
    source,
    /async\s+function\s+tryModalWrite\s*\(/,
    /export\s+async\s+function\s+onRequest\s*\(/
  );

  assert.match(writeBlock, /await\s+readBoundedRequestBody\(request\)/);
  assert.match(writeBlock, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(writeBlock, /return\s+buildBodyReadFailedResponse\(requestId\)/);
});

test('runtime: early rejection returns 413 without reading the body when content-length is too large', { timeout: 10_000 }, async () => {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;

  let textWasRead = false;

  const request = {
    method: 'POST',
    url: 'https://test5.lovebud.pages.dev/api/trees',
    headers: {
      get(name) {
        const hdrs = {
          'content-type': 'application/json',
          'content-length': String((128 * 1024) + 1),
          'authorization': 'mock-auth-token',
          'x-lovebud-request-id': 'content-length-test'
        };
        return hdrs[name.toLowerCase()] || null;
      }
    },
    async text() {
      textWasRead = true;
      throw new Error('Should not read body');
    }
  };

  const env = {
    MODAL_BASE_URL: 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run'
  };

  const response = await onRequest({ request, env });

  assert.equal(response.status, 413);
  assert.equal(textWasRead, false);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'payload-too-large');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'content-length-test');
});
