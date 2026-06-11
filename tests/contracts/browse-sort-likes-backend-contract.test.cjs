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
  assert.match(catchAllRoute, /sourceUrl\.searchParams\.get\(["']sort["']\).*===.*popular/);
  assert.match(catchAllRoute, /sourceUrl\.searchParams\.get\(["']sort["']\).*===.*likes/);
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

  // Join with tree_social_counts
  assert.match(publicReads, /LEFT JOIN\s+\(\s*--\s*Social counts/);
  assert.match(publicReads, /SELECT\s+tree_id,\s+like_count,\s+view_count/);
  assert.match(publicReads, /FROM\s+tree_social_counts/);
  assert.match(publicReads, /s\s+ON\s+t\.id\s*=\s*s\.tree_id/);

  // Select like_count and view_count in modern query
  assert.match(publicReads, /s\.like_count,/);
  assert.match(publicReads, /s\.view_count,/);
});

test('Normalize row includes likeCount and viewCount from modern query', () => {
  // validation.py normalize_row includes likeCount/viewCount
  const validation = fs.readFileSync(path.join(ROOT, 'modal_compute', 'validation.py'), 'utf8');
  assert.match(validation, /"likeCount":\s*row\.get\(["']like_count["'],\s*0\)\s+or\s+0/);
  assert.match(validation, /"viewCount":\s*row\.get\(["']view_count["'],\s*0\)\s+or\s+0/);
});

test('Growing public tree snapshots also includes likeCount/viewCount', () => {
  // Growing modern query joins tree_social_counts
  assert.match(publicReads, /def\s+fetch_growing_public_tree_snapshots/);
  assert.match(publicReads, /s\.like_count,/);
  assert.match(publicReads, /s\.view_count,/);
  assert.match(publicReads, /LEFT JOIN\s+\(\s*--\s*Social counts/);
  assert.match(publicReads, /SELECT\s+tree_id,\s+like_count,\s+view_count/);
  assert.match(publicReads, /FROM\s+tree_social_counts/);

  // Growing legacy fallback includes likeCount/viewCount
  assert.match(publicReads, /"likeCount":\s*0,/);
  assert.match(publicReads, /"viewCount":\s*0,/);
});

test('Browse sort=views remains unsupported (falls back to latest)', () => {
  // Catch-all still only accepts popular and likes as non-latest
  assert.match(catchAllRoute, /===.*popular/);
  assert.match(catchAllRoute, /===.*likes/);
  
  // No views handling
  assert.doesNotMatch(catchAllRoute, /===.*views/);
  assert.doesNotMatch(catchAllRoute, /\?\s*['"]views['"]/);

  // Modal app still rejects views
  assert.doesNotMatch(modalApp, /["']views["']/);
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