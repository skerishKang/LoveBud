const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('search UI scroll key inline fallback removed', () => {
  const uiModule = read('js/search/search-ui.js');

  // Inline fallback key list must be removed.
  // The old code had: [' ', 'PageDown', 'End', 'ArrowDown'].includes(event.key)
  assert.ok(!uiModule.includes("'PageDown'"),
    'should not contain PageDown fallback key');
  assert.ok(!uiModule.includes("'ArrowDown'"),
    'should not contain ArrowDown fallback key');
});

test('search UI handleScrollLoadKeydown delegates to helper only', () => {
  const uiModule = read('js/search/search-ui.js');

  // handleScrollLoadKeydown must still exist
  assert.ok(uiModule.includes('function handleScrollLoadKeydown'));
  // Must reference ScrollLoad.isScrollIntentKey
  assert.ok(uiModule.includes('ScrollLoad.isScrollIntentKey'));
  // Must guard against missing helper: early return
  assert.ok(uiModule.includes("typeof ScrollLoad.isScrollIntentKey !== 'function'"));
  assert.ok(uiModule.includes('return;'));
});

test('search UI scroll key fallback returns early when helper unavailable', () => {
  const uiModule = read('js/search/search-ui.js');

  // Must return early if helper not available
  assert.ok(uiModule.includes("typeof ScrollLoad.isScrollIntentKey !== 'function'"));
  assert.ok(uiModule.includes('return;'));
});
