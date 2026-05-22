const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `${functionName} function not found`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(braceStart + 1, index);
    }
  }
  throw new Error(`${functionName} body not closed`);
}

test('search UI delegates scroll sentinel sync directly to helper', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'syncScrollLoadSentinel');

  assert.match(body, /ScrollLoad\.syncScrollLoadSentinel\(scrollLoadSentinel,\s*state\)/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.syncScrollLoadSentinel\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return\s+false/);
  assert.doesNotMatch(body, /return\s+null/);
});

test('scroll helper owns syncScrollLoadSentinel implementation and export', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /function syncScrollLoadSentinel\(sentinel,\s*state\)/);
  assert.match(helperModule, /syncScrollLoadSentinel:\s*syncScrollLoadSentinel/);
  assert.match(helperModule, /sentinel\.classList\.toggle\(['"]is-loading['"]/);
  assert.match(helperModule, /sentinel\.setAttribute\(['"]aria-hidden['"]/);
});

test('search UI delegates sentinel viewport check directly to helper', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'isSentinelNearViewport');

  assert.match(body, /return ScrollLoad\.isSentinelNearViewport\(scrollLoadSentinel,\s*window\)/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.isSentinelNearViewport\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return false/);
});

test('scroll helper owns isSentinelNearViewport implementation and export', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /function isSentinelNearViewport\(sentinel,\s*win\)/);
  assert.match(helperModule, /isSentinelNearViewport:\s*isSentinelNearViewport/);
  assert.match(helperModule, /getBoundingClientRect/);
  assert.match(helperModule, /innerHeight\s*\+?\s*720/);
});