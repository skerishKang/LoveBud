const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const publicReads = fs.readFileSync(path.join(ROOT, 'modal_compute', 'public_reads.py'), 'utf8');
const validation = fs.readFileSync(path.join(ROOT, 'modal_compute', 'validation.py'), 'utf8');
const treeViews = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_views.py'), 'utf8');
const policy = fs.readFileSync(path.join(ROOT, 'docs', 'product', 'lovebud-browse-tree-view-count-policy.md'), 'utf8');

test('Catch-all route accepts sort=views and maps to modal', () => {
  // buildBrowseCacheRequest handles views (multiline ternary with requestedSort helper)
  assert.match(catchAllRoute, /requestedSort\s*===\s*['"]popular['"]/);
  assert.match(catchAllRoute, /requestedSort\s*===\s*['"]likes['"]/);
  assert.match(catchAllRoute, /requestedSort\s*===\s*['"]views['"]/);
  assert.match(catchAllRoute, /\?\s*['"]popular['"]/);
  assert.match(catchAllRoute, /\?\s*['"]likes['"]/);
  assert.match(catchAllRoute, /\?\s*['"]views['"]/);

  // Final fallback is : 'latest' (unknown sorts still fall back)
  assert.match(catchAllRoute, /:\s*['"]latest['"]/);
});

test('Modal app safe_sort set includes views', () => {
  assert.match(modalApp, /safe_sort\s*=\s*sort\s+if\s+sort\s+in\s+\{[\s\S]*"latest"[\s\S]*"popular"[\s\S]*"likes"[\s\S]*"views"[\s\S]*\}/);
});

test('Public reads fetch_latest_public_tree_snapshots supports sort=views', () => {
  // Function signature and docstring
  assert.match(publicReads, /def\s+fetch_latest_public_tree_snapshots\(/);
  assert.match(publicReads, /sort=["']views["']/);

  // Order clause for views
  assert.match(publicReads, /elif\s+sort\s*==\s*["']views["']/);
  assert.match(publicReads, /s\.view_count\s+DESC/);

  // Tie-breakers: updated_at DESC, created_at DESC, id ASC (deterministic, symmetric to likes)
  assert.match(publicReads, /t\.updated_at\s+DESC/);
  assert.match(publicReads, /t\.created_at\s+DESC/);
  assert.match(publicReads, /t\.id\s+ASC/);

  // Join with tree_social_counts (subquery now selects like_count AND view_count)
  assert.match(publicReads, /LEFT JOIN\s+\(\s*--\s*Social counts/);
  assert.match(publicReads, /SELECT\s+tree_id,\s+like_count,\s+view_count/);
  assert.match(publicReads, /FROM\s+\{\s*social_counts_source\s*\}/);
  assert.match(publicReads, /s\s+ON\s+t\.id\s*=\s*s\.tree_id/);

  // Select like_count and view_count (COALESCE for safe pre-migration envs)
  assert.match(publicReads, /s\.like_count/);
  assert.match(publicReads, /s\.view_count/);
  assert.match(publicReads, /COALESCE\(s\.view_count/);
});

test('Browse sort=views order_clause is symmetric with sort=likes', () => {
  // Both branches use identical tie-breaker shape
  const likesOrder = 's.like_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC';
  const viewsOrder = 's.view_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC';

  assert.match(publicReads, new RegExp(likesOrder.replace(/\./g, '\\.')));
  assert.match(publicReads, new RegExp(viewsOrder.replace(/\./g, '\\.')));
});

test('sort=views has safe fallback to latest when tree_social_counts view_count is missing', () => {
  // Pre-migration envs (table missing or column missing) must not crash the endpoint
  assert.match(publicReads, /has_social_counts_table\s*=\s*_table_exists\(cur,\s*["']tree_social_counts["']\)/);
  assert.match(
    publicReads,
    /has_view_count_column\s*=\s*_table_has_column\(cur,\s*["']tree_social_counts["'],\s*["']view_count["']\)/
  );
  assert.match(
    publicReads,
    /elif\s+sort\s*==\s*["']views["']\s+and\s+not\s*\(\s*has_social_counts_table\s+and\s+has_view_count_column\s*\)/
  );

  // Fallback path sets effective_order_clause to the latest order
  assert.match(publicReads, /effective_order_clause\s*=\s*["']t\.created_at DESC["']/);
  // modern_query_template is the source query and gets formatted with the order clause
  assert.match(publicReads, /modern_query_template/);
  assert.match(
    publicReads,
    /modern_query\s*=\s*modern_query_template\.format\([\s\S]*?order_clause=effective_order_clause[\s\S]*?\)/
  );
});

test('Browse/Search summary payload does NOT include viewCount (boundary preserved)', () => {
  // No viewCount in any normalize_row output
  assert.doesNotMatch(validation, /"viewCount"/);
  assert.doesNotMatch(publicReads, /"viewCount"/);

  // No "viewCount" key in legacy fallback dictionaries
  const latestHelper = publicReads.substring(
    publicReads.indexOf('fetch_latest_public_tree_snapshots'),
    publicReads.indexOf('fetch_growing_public_tree_snapshots')
  );
  assert.doesNotMatch(latestHelper, /"viewCount":\s*0,/);
  assert.doesNotMatch(latestHelper, /"viewCount":\s*row\.get/);

  // Growing helper must NOT include viewCount
  const growingHelper = publicReads.substring(
    publicReads.indexOf('fetch_growing_public_tree_snapshots'),
    publicReads.indexOf('def fetch_public_memories')
  );
  assert.doesNotMatch(growingHelper, /"viewCount"/);
  assert.doesNotMatch(growingHelper, /s\.view_count/);
});

test('Browse UI labels remain unchanged (조회순 / 좋아요순 still forbidden)', () => {
  // Catch-all and modal app must not include any UI label change for views
  assert.doesNotMatch(catchAllRoute, /조회순/);
  assert.doesNotMatch(modalApp, /조회순/);
  assert.doesNotMatch(publicReads, /조회순/);

  // sort=views is backend-only; the frontend control is Unit D work
  // and must not be wired up by this slice
  assert.doesNotMatch(catchAllRoute, /sort.*조회순/);
});

test('Latest, popular, and likes sorts still work (no regression)', () => {
  // latest branch
  assert.match(publicReads, /order_clause\s*=\s*["']t\.created_at DESC["']/);
  // popular branch
  assert.match(publicReads, /if\s+sort\s*==\s*["']popular["']/);
  assert.match(publicReads, /c\.memory_count\s+DESC,\s*t\.created_at\s+DESC/);
  // likes branch
  assert.match(publicReads, /elif\s+sort\s*==\s*["']likes["']/);
  assert.match(publicReads, /s\.like_count\s+DESC/);

  // safe_sort in modal still includes all four
  assert.match(modalApp, /safe_sort\s*=\s*sort\s+if\s+sort\s+in\s+\{[\s\S]*"latest"[\s\S]*"popular"[\s\S]*"likes"[\s\S]*"views"[\s\S]*\}/);
});

test('sort=views only ranks public trees (private tree boundary preserved)', () => {
  // The modern_query for fetch_latest_public_tree_snapshots must still
  // filter to t.visibility = 'public' before the ORDER BY s.view_count DESC
  const latestHelper = publicReads.substring(
    publicReads.indexOf('fetch_latest_public_tree_snapshots'),
    publicReads.indexOf('fetch_growing_public_tree_snapshots')
  );
  assert.match(latestHelper, /t\.visibility\s*=\s*'public'/);
  assert.match(latestHelper, /WHERE\s+t\.visibility\s*=\s*'public'/);

  // viewCount read path on the public detail also enforces visibility
  assert.match(treeViews, /visibility\s*=\s*'public'/);
  assert.match(treeViews, /is_public\s*=\s*%s/);
});

test('No raw IP / user-agent / fingerprint / referrer / header in view tracking (no broad analytics)', () => {
  // tree_views.py record_public_tree_view only takes actorKey/actorKind/source
  const recordFn = treeViews.substring(
    treeViews.indexOf('def record_public_tree_view'),
    treeViews.indexOf('def ', treeViews.indexOf('def record_public_tree_view') + 1)
  );
  assert.doesNotMatch(recordFn, /raw_ip/);
  assert.doesNotMatch(recordFn, /user_agent/);
  assert.doesNotMatch(recordFn, /fingerprint/i);
  assert.doesNotMatch(recordFn, /referrer/i);
  assert.doesNotMatch(recordFn, /request_headers/);

  // Policy doc still locks the privacy key scheme
  assert.match(policy, /Authenticated user:\s*use account identity/);
  assert.match(policy, /Anonymous user:\s*use a privacy-preserving session key/);
  assert.match(policy, /must not store/);
  assert.match(policy, /raw IP address/);
  assert.match(policy, /raw user-agent string/);
  assert.match(policy, /full device fingerprint/);
});

test('viewCount is still exposed only on the narrow public detail endpoint (not Browse/Search)', () => {
  // modal app public tree detail route sets viewCount
  assert.match(modalApp, /tree\["viewCount"\]\s*=\s*fetch_public_tree_view_count/);

  // but Browse/Search summary sources do NOT include viewCount (boundary preserved)
  assert.doesNotMatch(publicReads, /"viewCount"/);
  assert.doesNotMatch(validation, /"viewCount"/);
});

test('Scout live provider/fetch/network is not touched (boundary preserved)', () => {
  // No Scout/network/fetch changes in any modified file
  assert.doesNotMatch(publicReads, /Scout/);
  assert.doesNotMatch(publicReads, /provider\/fetch/);
  assert.doesNotMatch(modalApp, /Scout/);
  assert.doesNotMatch(catchAllRoute, /Scout/);
});
