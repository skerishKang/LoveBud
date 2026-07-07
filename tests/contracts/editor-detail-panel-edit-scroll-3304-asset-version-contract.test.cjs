'use strict';

/*
 * Issue #3304 — Asset-version focused contract for the changed leaf CSS.
 *
 * The browser-loaded CSS chain is:
 *   pages/editor.html -> css/editor.css?v=20260614-2465
 *     -> @import css/editor/editor-detail-panel.css?v=<token>
 *
 * The ONLY changed file in the chain for #3304 is the leaf
 * css/editor/editor-detail-panel.css (it gained min-height:0 bounds so a
 * long edit form scrolls inside the panel instead of escaping the shell).
 *
 * Repo convention (see editor-moment-social-footer-contract.test.cjs which
 * pins the entrypoint 20260614-2465): the entrypoint css/editor.css?v= is
 * NOT bumped when only a leaf @import ?v= changes. The leaf ?v= query is the
 * cache-bust mechanism, so it MUST be updated and locked here.
 *
 * Version rule: SHA-256 first 12 of the leaf file content, prefixed with
 * the date and issue number (YYYYMMDD-<issue>-<sha12>), matching the
 * existing leaf convention (e.g. 20260705-3218-1).
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(ROOT, 'css/editor.css');
const LEAF = path.join(ROOT, 'css/editor/editor-detail-panel.css');

const entryContent = fs.readFileSync(ENTRY, 'utf8');
const leafContent = fs.readFileSync(LEAF, 'utf8');
const leafSha12 = crypto.createHash('sha256').update(leafContent, 'utf8').digest('hex').slice(0, 12);

// The expected leaf import line in the entrypoint manifest.
const LEAF_IMPORT_RE = /@import\s+url\(\s*["']\.\/editor\/editor-detail-panel\.css\?v=([^"']+)["']\s*\)\s*;/;

test('entrypoint imports editor-detail-panel.css with a non-empty cache-bust version', () => {
  const match = entryContent.match(LEAF_IMPORT_RE);
  assert.ok(match, 'css/editor.css must @import editor-detail-panel.css with a ?v= query');
  assert.ok(match[1] && match[1].length > 0, 'cache-bust value must be non-empty');
});

test('editor-detail-panel.css cache-bust version embeds the content SHA-256 (first 12)', () => {
  const match = entryContent.match(LEAF_IMPORT_RE);
  assert.ok(match, 'leaf import line must be present');
  const version = match[1];
  // Convention: YYYYMMDD-<issue>-<sha12>. The trailing token must equal the
  // SHA-256 first-12 of the current leaf file content.
  assert.ok(
    version.endsWith(leafSha12),
    `leaf ?v= (${version}) must end with the SHA-256 first-12 of the file (${leafSha12})`
  );
});

test('editor-detail-panel.css cache-bust version references issue #3304', () => {
  const match = entryContent.match(LEAF_IMPORT_RE);
  assert.ok(match, 'leaf import line must be present');
  const version = match[1];
  assert.match(version, /3304/, 'leaf ?v= must reference issue #3304');
});
