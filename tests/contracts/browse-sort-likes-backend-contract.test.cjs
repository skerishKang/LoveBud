const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const publicReads = fs.readFileSync(path.join(ROOT, 'modal_compute', 'public_reads.py'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

test('Catch-all route accepts sort=likes and maps to modal', () => {
  // buildBrowseCacheRequest handles likes - ternary operator uses ? value for true branches
  assert.match(catchAllRoute, /buildBrowseCacheRequest/);
  assert.match(catchAllRoute, /===.*popular/);
  assert.match(catchAllRoute, /===.*likes/);
  assert.match(catchAllRoute, /\?\s*['"]popular['"]/);
  assert.match(catchAllRoute, /\?\s*['"]likes['"]/);

  // buildModalUrl handles likes for community/trees - ternary with nested ternary
  // (uses requestedSort helper variable, also used for buildBrowseCacheRequest)
  assert.match(catchAllRoute, /requestedSort\s*===\s*['"]popular['"]/);
  assert.match(catchAllRoute, /requestedSort\s*===\s*['"]likes['"]/);
  assert.match(catchAllRoute, /\?\s*['"]popular['"]/);
  assert.match(catchAllRoute, /\?\s*['"]likes['"]/);

  // Final fallback is : 'latest'
  assert.match(catchAllRoute, /:\s*['"]latest['"]/);
});

test('Modal app validates sort=likes in browse/latest endpoint', () => {
  assert.match(modalApp, /safe_sort\s*=\s*sort\s+if\s+sort\s+in\s+\{[\s\S]*"latest"[\s\S]*"popular"[\s\S]*"likes"[\s\S]*\}/);
});

test('Public reads fetch_latest_public_tree_snapshots supports sort=likes', () => {
  // Function signature and docstring
  assert.match(publicReads, /def\s+fetch_latest_public_tree_snapshots\(/);
  assert.match(publicReads, /sort=["']likes["']/);

  // Order clause for likes
  assert.match(publicReads, /elif\s+sort\s*==\s*["']likes["']/);
  assert.match(publicReads, /s\.like_count\s+DESC/);

  // Tie-breakers: updated_at DESC, created_at DESC, id ASC
  assert.match(publicReads, /t\.updated_at\s+DESC/);
  assert.match(publicReads, /t\.created_at\s+DESC/);
  assert.match(publicReads, /t\.id\s+ASC/);

  // Join with tree_social_counts (likes subquery covers like_count)
  assert.match(publicReads, /LEFT JOIN\s+\(\s*--\s*Social counts/);
  assert.match(publicReads, /SELECT\s+tree_id,\s+like_count,\s+view_count/);
  assert.match(publicReads, /FROM\s+\{\s*social_counts_source\s*\}/);
  assert.match(publicReads, /s\s+ON\s+t\.id\s*=\s*s\.tree_id/);

  // Select like_count in modern query
  assert.match(publicReads, /s\.like_count,/);
});

test('Normalize row includes likeCount and viewCount from modern query', () => {
  // validation.py normalize_row includes likeCount and viewCount conditionally
  const validation = fs.readFileSync(path.join(ROOT, 'modal_compute', 'validation.py'), 'utf8');
  assert.match(validation, /result\["likeCount"\]\s*=\s*row\.get\(["']like_count["'],\s*0\)\s+or\s+0/);
  assert.match(validation, /"viewCount"/);

  // include_like_count parameter exists
  assert.match(validation, /include_like_count:\s*bool\s*=\s*False/);
});

test('Growing public tree snapshots does NOT include social counts join', () => {
  // Growing modern query does NOT join tree_social_counts
  assert.match(publicReads, /def\s+fetch_growing_public_tree_snapshots/);

  // The growing function's modern_query should NOT have s.like_count
  const growingSection = publicReads.substring(
    publicReads.indexOf('fetch_growing_public_tree_snapshots'),
    publicReads.indexOf('def fetch_public_memories')
  );
  assert.doesNotMatch(growingSection, /s\.like_count,/);
  assert.doesNotMatch(growingSection, /s\.view_count,/);
  assert.doesNotMatch(growingSection, /LEFT JOIN.*Social counts/);
  assert.doesNotMatch(growingSection, /FROM\s+tree_social_counts/);

  // Growing legacy fallback does NOT include likeCount/viewCount
  assert.doesNotMatch(growingSection, /"likeCount":\s*0,/);
  assert.doesNotMatch(growingSection, /"viewCount":\s*0,/);
});

test('Browse sort=views is now enabled (delegated to views contract)', () => {
  // Router now accepts sort=views (Unit C runtime slice). The actual
  // behavior contract is locked by browse-sort-views-backend-contract.
  assert.match(catchAllRoute, /===.*views/);
  assert.match(catchAllRoute, /\?\s*['"]views['"]/);

  // Modal app includes "views" in safe_sort set
  assert.match(modalApp, /["']views["']/);
});

test('Popular sort behavior preserved (memory_count)', () => {
  // Popular still uses memory_count
  assert.match(publicReads, /if\s+sort\s*==\s*["']popular["']/);
  assert.match(publicReads, /c\.memory_count\s+DESC/);
  assert.match(publicReads, /c\.memory_count\s+DESC,\s*t\.created_at\s+DESC/);

  // Catch-all still accepts popular
  assert.match(catchAllRoute, /===.*popular/);
  assert.match(catchAllRoute, /\?\s*['"]popular['"]/);
});

test('Latest sort behavior preserved (created_at)', () => {
  // Default latest uses created_at DESC
  assert.match(publicReads, /order_clause\s*=\s*["']t\.created_at\s+DESC["']/);
  assert.doesNotMatch(publicReads, /order_clause\s*=\s*["']t\.updated_at\s+DESC["']/);
});
