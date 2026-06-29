/**
 * Contract test: My Trees image fallback container boundary.
 *
 * Verifies that bindMyTreesCardImageHandlers resolves broken-image
 * fallback through the owning media container instead of relying on
 * immediate sibling order.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-events.js'), 'utf8');

test('handler uses closest container boundary, not nextElementSibling', () => {
  assert.match(source, /\.closest\(/, 'must use closest() for container lookup');
  assert.doesNotMatch(source, /nextElementSibling/, 'must NOT rely on nextElementSibling');
});

test('handler queries fallback inside container, not globally', () => {
  assert.match(source, /container\.querySelector\(/, 'must query within container');
  assert.doesNotMatch(source, /document\.querySelector\(/, 'must NOT use document-level query');
});

test('handler hides image on error', () => {
  assert.match(source, /this\.style\.display\s*=\s*'none'/, 'must hide broken image');
});

test('fallback hidden removed and display flex set', () => {
  assert.match(source, /removeAttribute\('hidden'\)/, 'must unhide fallback');
  assert.match(source, /style\.display\s*=\s*'flex'/, 'must set fallback display flex');
});

test('handler guards against missing container', () => {
  assert.match(source, /if\s*\(container\)\s*\{/, 'must guard container existence');
});

test('handler guards against missing fallback marker', () => {
  assert.match(source, /if\s*\(fallback\)\s*\{/, 'must guard fallback existence');
});

test('one-time binding via imageHandlerBound preserved', () => {
  assert.match(source, /imageHandlerBound/, 'duplicate binding guard must exist');
  assert.match(source, /img\.dataset\.imageHandlerBound\s*===\s*'true'/, 'must check bound flag');
  assert.match(source, /img\.dataset\.imageHandlerBound\s*=\s*'true'/, 'must set bound flag');
});

test('existing media fallback contract not changed', () => {
  // The data-media-fallback marker must be preserved
  assert.match(source, /data-media-fallback/, 'must reference data-media-fallback marker');
});
