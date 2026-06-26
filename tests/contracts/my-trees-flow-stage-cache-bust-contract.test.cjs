'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const myTreesHtmlFile = path.join(ROOT, 'pages/my-trees.html');

const myTreesHtml = fs.readFileSync(myTreesHtmlFile, 'utf8');

// Post-#2825 / #2835 cache-bust follow-up: the production HTML must
// reference the four compact flow runtime JS files with the same new
// cache-bust version, otherwise the browser will keep loading the
// pre-fix scripts from cache. The exact version string is not pinned
// in the contract (intentionally — future cache-bust bumps should not
// require updating this test). We assert the four scripts are present
// with a non-empty ?v= query string, that they all share the same
// cache-bust version, and that old vulnerable tokens are gone.
const RUNTIME_BUNDLE_PATTERN =
  /\.\.\/js\/(?:search\/search-preview-media-helper|my-trees\/my-trees-preview-hub|my-trees\/my-trees-preview-state|my-trees\/my-trees-preview-media)\.js\?v=([^"'\s>]+)/g;

test('My Trees page loads compact flow runtime script quartet (#2835)', () => {
  assert.match(
    myTreesHtml,
    /<script\s+src="\.\.\/js\/search\/search-preview-media-helper\.js\?v=[^"'\s>]+"><\/script>/,
    'My Trees must load search-preview-media-helper.js with a cache-bust query'
  );
  assert.match(
    myTreesHtml,
    /<script\s+src="\.\.\/js\/my-trees\/my-trees-preview-hub\.js\?v=[^"'\s>]+"><\/script>/,
    'My Trees must load my-trees-preview-hub.js with a cache-bust query'
  );
  assert.match(
    myTreesHtml,
    /<script\s+src="\.\.\/js\/my-trees\/my-trees-preview-state\.js\?v=[^"'\s>]+"><\/script>/,
    'My Trees must load my-trees-preview-state.js with a cache-bust query'
  );
  assert.match(
    myTreesHtml,
    /<script\s+src="\.\.\/js\/my-trees\/my-trees-preview-media\.js\?v=[^"'\s>]+"><\/script>/,
    'My Trees must load my-trees-preview-media.js with a cache-bust query'
  );
});

test('compact flow runtime quartet has non-empty cache-bust versions (#2835, #2923)', () => {
  // Hub must carry a non-empty cache-bust (independent version)
  assert.match(
    myTreesHtml,
    /my-trees-preview-hub\.js\?v=[^"'\s>]+/,
    'my-trees-preview-hub.js must carry a non-empty cache-bust'
  );
  // Trio (media-helper, state, media) must all share the same non-empty version
  const trioPattern = /\.\.\/js\/(?:search\/search-preview-media-helper|my-trees\/my-trees-preview-state|my-trees\/my-trees-preview-media)\.js\?v=([^"'\s>]+)/g;
  const trio = (myTreesHtml.match(trioPattern) || []);
  assert.equal(trio.length, 3, 'all three trio scripts must be present');
  const trioVersions = trio.map((entry) => entry.split('?v=')[1]);
  assert.ok(trioVersions.every((v) => v && v.length > 0), 'every trio cache-bust value must be non-empty');
  assert.equal(
    trioVersions[0],
    trioVersions[1],
    'preview-hub and preview-media must share the same cache-bust version'
  );
  assert.equal(
    trioVersions[0],
    trioVersions[2],
    'search-preview-media-helper must share the same cache-bust version'
  );
});

test('My Trees page no longer ships the pre-#2835 cache-bust values', () => {
  // Regression guard: the pre-#2835 values must be gone so production
  // never serves the broken cached copy. Pin the exact old values so
  // a future accidental restore is caught.
  assert.doesNotMatch(
    myTreesHtml,
    /\.\.\/js\/search\/search-preview-media-helper\.js\?v=20260620-2731-1/,
    'search-preview-media-helper.js must not still pin the pre-#2829 cache-bust 20260620-2731-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /\.\.\/js\/my-trees\/my-trees-preview-hub\.js\?v=20260622-parity-1/,
    'my-trees-preview-hub.js must not still pin the pre-#2829 cache-bust 20260622-parity-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /\.\.\/js\/my-trees\/my-trees-preview-media\.js\?v=20260620-2731-1/,
    'my-trees-preview-media.js must not still pin the pre-#2829 cache-bust 20260620-2731-1'
  );
  // Pre-#2835 values that must be gone after this PR's coordinated bump
  assert.doesNotMatch(
    myTreesHtml,
    /search-preview-media-helper\.js\?v=20260623-2825-1/,
    'search-preview-media-helper.js must not still pin the #2829 cache-bust 20260623-2825-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-hub\.js\?v=20260623-2825-1/,
    'my-trees-preview-hub.js must not still pin the #2829 cache-bust 20260623-2825-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-media\.js\?v=20260623-2825-1/,
    'my-trees-preview-media.js must not still pin the #2829 cache-bust 20260623-2825-1'
  );
  assert.doesNotMatch(
    myTreesHtml,
    /my-trees-preview-state\.js\?v=20260622-step9-1/,
    'my-trees-preview-state.js must not still pin the pre-#2835 cache-bust 20260622-step9-1'
  );
  // New hydrated-flow token must be present in the trio
  assert.match(
    myTreesHtml,
    /search-preview-media-helper\.js\?v=20260626-2929-hydrated-flow-1/,
    'search-preview-media-helper.js must use the new hydrated-flow token'
  );
  assert.match(
    myTreesHtml,
    /my-trees-preview-state\.js\?v=20260626-2929-hydrated-flow-1/,
    'my-trees-preview-state.js must use the new hydrated-flow token'
  );
  assert.match(
    myTreesHtml,
    /my-trees-preview-media\.js\?v=20260626-2929-hydrated-flow-1/,
    'my-trees-preview-media.js must use the new hydrated-flow token'
  );
});
