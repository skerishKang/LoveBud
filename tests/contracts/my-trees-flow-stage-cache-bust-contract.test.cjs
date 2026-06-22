'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const myTreesHtmlFile = path.join(ROOT, 'pages/my-trees.html');

const myTreesHtml = fs.readFileSync(myTreesHtmlFile, 'utf8');

// Post-#2825 / #2829 cache-bust follow-up: the production HTML must
// reference the three #2829-fixed JS files with the new cache-bust
// version string, otherwise the browser will keep loading the
// pre-#2829 (broken) scripts from cache. The exact version string is
// not pinned in the contract (intentionally — future cache-bust bumps
// should not require updating this test). We assert the three scripts
// are present with a non-empty ?v= query string and that they all
// share the same cache-bust version (so we know the page is on a
// consistent production load).
test('My Trees page loads #2829-fixed script trio (post-merge cache-bust follow-up)', () => {
  // helper, preview-hub, preview-media — these three were edited in
  // #2829 to wire the flow stage click to
  // LoveBudMyTreesPreviewMedia.renderMediaForMoment(). Without the
  // cache-bust bump, browsers keep loading the pre-#2829 copy from
  // disk cache and the bug recurs in production even after the fix
  // shipped.
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
    /<script\s+src="\.\.\/js\/my-trees\/my-trees-preview-media\.js\?v=[^"'\s>]+"><\/script>/,
    'My Trees must load my-trees-preview-media.js with a cache-bust query'
  );
});

test('My Trees #2829 script trio uses a single shared cache-bust version', () => {
  // Pull the ?v= value off each of the three scripts and assert they
  // are equal — proves the page is on a consistent production load and
  // the three #2829-fixed files ship together. Also asserts the value
  // is non-empty (regression guard: no ?v= dangling).
  const triple = (myTreesHtml.match(
    /\.\.\/js\/(?:search\/search-preview-media-helper|my-trees\/my-trees-preview-hub|my-trees\/my-trees-preview-media)\.js\?v=([^"'\s>]+)/g
  ) || []);
  assert.equal(triple.length, 3, 'all three #2829-fixed scripts must be present');
  const versions = triple.map((entry) => entry.split('?v=')[1]);
  assert.ok(versions.every((v) => v && v.length > 0), 'every cache-bust value must be non-empty');
  assert.equal(
    versions[0],
    versions[1],
    'preview-hub and preview-media must share the same cache-bust version (single coordinated bump)'
  );
  assert.equal(
    versions[0],
    versions[2],
    'search-preview-media-helper must share the same cache-bust version as the other two'
  );
});

test('My Trees page no longer ships the pre-#2829 cache-bust values', () => {
  // Regression guard: the pre-#2829 values must be gone so production
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
});
