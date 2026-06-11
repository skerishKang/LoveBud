const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const planPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-browse-tree-social-counts-plan.md');
const routerPath = path.join(__dirname, '..', '..', 'functions', 'api', '[[path]].js');
const modalBrowsePath = path.join(__dirname, '..', '..', 'modal_compute', 'browse_latest.py');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('browse tree social counts plan locks planning-only scope and baseline', () => {
  const content = read(planPath);

  assert.match(content, /Refs: #1661, #1660/);
  assert.match(content, /Scope: planning\/design only/);
  assert.match(content, /Runtime behavior change: none/);
  assert.match(content, /Database\/schema migration: none/);
  assert.match(content, /API behavior change: none/);
  assert.match(content, /Frontend label change: none/);
  assert.match(content, /Browse card redesign: none/);
  assert.match(content, /`latest` and `popular`/);
  assert.match(content, /`popular` means public memory-count proxy, not true popularity/);
  assert.match(content, /`sort=views` is not supported yet/);
  assert.match(content, /`sort=likes` is not supported yet/);
});

test('browse tree social counts plan separates memory-level and tree-level engagement', () => {
  const content = read(planPath);

  assert.match(content, /memory-level reactions are not tree-level likes/);
  assert.match(content, /A tree-level like is an engagement with the whole public tree/);
  assert.match(content, /It is separate from memory-level reactions/);
  assert.match(content, /memory reactions must not be counted as tree likes/);
  assert.match(content, /likes on private trees must not be exposed in public Browse results/);
});

test('browse tree social counts plan selects aggregate storage and likes-before-views order', () => {
  const content = read(planPath);

  assert.match(content, /`tree_likes` for per-tree active like records/);
  assert.match(content, /`tree_social_counts` for aggregate `like_count`, `view_count`, and `updated_at`/);
  assert.match(content, /separate aggregate table is preferred/);
  assert.match(content, /Implement likes before views/);
  assert.match(content, /Tree likes have clearer semantics and lower abuse risk/);
  assert.match(content, /Views require duplicate suppression, bot filtering, and route-level instrumentation/);
});

test('browse tree social counts plan defines duplicate view policy and public payload policy', () => {
  const content = read(planPath);

  assert.match(content, /count at most once per 24 hours/);
  assert.match(content, /privacy-preserving key/);
  assert.match(content, /cache\/prefetch routes must not increment views/);
  assert.match(content, /Public Browse summary may eventually expose/);
  assert.match(content, /`memoryCount`/);
  assert.match(content, /`likeCount`/);
  assert.match(content, /`viewCount`/);
  assert.match(content, /Public Browse summary must not expose/);
  assert.match(content, /private tree counts/);
  assert.match(content, /per-account engagement history/);
});

test('browse tree social counts plan splits follow-up units and preserves UI/API behavior', () => {
  const content = read(planPath);

  assert.match(content, /Unit A — Tree-level likes/);
  assert.match(content, /Unit B — Tree-level views/);
  assert.match(content, /Unit C — Browse sort API support/);
  assert.match(content, /Unit D — Final Browse UI update/);
  assert.match(content, /Add `sort=likes` only after `likeCount` exists/);
  assert.match(content, /Add `sort=views` only after `viewCount` exists/);
  assert.match(content, /Only after Units A-C are complete/);
  assert.match(content, /This planning slice does not close #1661/);
});

test('current router accepts latest, popular, likes, and views summary sort', () => {
  const router = read(routerPath);

  // sort=likes is supported (multiline ternary)
  assert.match(router, /'likes'\s*\?\s*'likes'/);
  // sort=popular is supported
  assert.match(router, /'popular'\s*\?\s*'popular'/);
  // sort=views is now supported (Unit C runtime slice)
  assert.match(router, /'views'\s*\?\s*'views'/);
});

test('current browse snapshot remains memory-count centered without tree social counts', () => {
  const modalBrowse = read(modalBrowsePath);

  assert.match(modalBrowse, /"memoryCount": memory_count/);
  assert.doesNotMatch(modalBrowse, /"viewCount"/);
  assert.doesNotMatch(modalBrowse, /"likeCount"/);
});
