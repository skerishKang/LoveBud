const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const policyPath = path.join(ROOT, 'docs', 'product', 'lovebud-browse-tree-view-count-policy.md');
const routerPath = path.join(ROOT, 'functions', 'api', '[[path]].js');
const validationPath = path.join(ROOT, 'modal_compute', 'validation.py');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('tree view count policy locks policy-only Unit B scope', () => {
  const content = read(policyPath);

  assert.match(content, /Refs: #1661, #1660/);
  assert.match(content, /Unit: B — Tree-level views/);
  assert.match(content, /Scope: policy\/contract only before runtime implementation/);
  assert.match(content, /Runtime behavior change: none/);
  assert.match(content, /Database\/schema migration: none/);
  assert.match(content, /API behavior change: none/);
  assert.match(content, /Frontend label change: none/);
});

test('tree view count policy defines countable and non-countable events', () => {
  const content = read(policyPath);

  assert.match(content, /Public tree detail page open/);
  assert.match(content, /Explicit public tree card open/);
  assert.match(content, /must not count both card impression and detail open/);
  assert.match(content, /Browse summary fetch/);
  assert.match(content, /Search summary fetch/);
  assert.match(content, /Static card render without explicit open/);
  assert.match(content, /Client-side speculative prefetch/);
  assert.match(content, /Private owner\/editor reads/);
});

test('tree view count policy locks duplicate suppression and privacy keys', () => {
  const content = read(policyPath);

  assert.match(content, /rolling 24-hour window/);
  assert.match(content, /Authenticated user: use account identity/);
  assert.match(content, /Anonymous user: use a privacy-preserving session key/);
  assert.match(content, /tree id/);
  assert.match(content, /actor\/session key/);
  assert.match(content, /must not store/);
  assert.match(content, /raw IP address/);
  assert.match(content, /raw user-agent string/);
  assert.match(content, /full device fingerprint/);
});

test('tree view count policy forbids private tree leakage and broad analytics', () => {
  const content = read(policyPath);

  assert.match(content, /Public view counts may only be read for public trees/);
  assert.match(content, /Private trees must not/);
  assert.match(content, /increment public `view_count`/);
  assert.match(content, /appear in public view rankings/);
  assert.match(content, /Missing trees and private trees should continue to be hidden as not found/);
  assert.match(content, /It must not become broad analytics/);
});

test('tree view count policy holds sort and UI changes', () => {
  const content = read(policyPath);

  assert.match(content, /This policy does not enable `sort=views`/);
  assert.match(content, /adding `sort=views` to Browse\/Search API/);
  assert.match(content, /adding `viewCount` to public Browse summary payload/);
  assert.match(content, /changing Browse labels to `조회순`/);
  assert.match(content, /using memory count as a substitute for view count/);
  assert.match(content, /This Unit B policy slice does not close #1661/);
});

test('current router accepts latest, popular, and likes sort (views still rejected)', () => {
  const router = read(routerPath);

  // sort=likes is now supported (Unit C, multiline ternary)
  assert.match(router, /'likes'\s*\?\s*'likes'/);
  // sort=views must remain rejected (Unit B policy)
  assert.doesNotMatch(router, /sort'\)\s*===\s*'views'/);
});

test('current Browse summary now includes viewCount payload via normalize_row', () => {
  const validation = read(validationPath);

  assert.match(validation, /"memoryCount": memory_count/);
  assert.match(validation, /"viewCount"/);
});
