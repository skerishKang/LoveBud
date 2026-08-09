const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const treeViews = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_views.py'), 'utf8');
const publicReads = fs.readFileSync(path.join(ROOT, 'modal_compute', 'public_reads.py'), 'utf8');
const treeLikes = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_likes.py'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

test('Public tree detail read boundary: viewCount implemented in detail, not in Browse summary', () => {
  // modal_app imports fetch_public_tree_view_count
  assert.match(modalApp, /from\s+modal_compute\.tree_views\s+import\s+[^\n]*fetch_public_tree_view_count/);

  // Detail endpoint exists and returns likeCount (pattern for viewCount)
  assert.match(modalApp, /@web_app\.get\("\/modal\/trees\/\{tree_id\}"\)/);
  assert.match(modalApp, /fetch_public_tree_like_count/);
  assert.match(modalApp, /tree\["likeCount"\]\s*=\s*fetch_public_tree_like_count/);

  // Public detail route now sets tree["viewCount"] = fetch_public_tree_view_count(safe_tree_id)
  assert.match(modalApp, /tree\["viewCount"\]\s*=\s*fetch_public_tree_view_count/);
});

test('fetch_public_tree_view_count helper exists with table and column missing fallbacks', () => {
  // Helper function exists
  assert.match(treeViews, /def\s+fetch_public_tree_view_count\(/);

  // Helper checks _table_exists(cur, "tree_social_counts")
  assert.match(treeViews, /_table_exists\(cur,\s*["']tree_social_counts["']\)/);

  // Helper checks _table_has_column(cur, "tree_social_counts", "view_count")
  assert.match(treeViews, /_table_has_column\(cur,\s*["']tree_social_counts["'],\s*["']view_count["']\)/);

  // Helper returns safe zero when table missing
  assert.match(treeViews, /if not _table_exists.*tree_social_counts[\s\S]*?return\s*\{\s*["']view_count["']\s*:\s*0\s*\}/);

  // Helper returns safe zero when column missing
  assert.match(treeViews, /if not _table_has_column.*view_count[\s\S]*?return\s*\{\s*["']view_count["']\s*:\s*0\s*\}/);

  // Helper validates public tree boundary
  assert.match(treeViews, /_fetch_public_tree_for_view_count/);
  assert.match(treeViews, /visibility\s*=\s*'public'/);
});

test('Browse summary must not include viewCount in payload', () => {
  // Browse latest snapshot normalizes rows without viewCount
  assert.doesNotMatch(browseSnapshot, /"viewCount"/);
  assert.doesNotMatch(browseSnapshot, /view_count/);
  assert.doesNotMatch(browseSnapshot, /viewCount/);

  // Browse growing snapshot normalizes rows without viewCount
  // (browse_latest.py handles both latest and growing via imports)
});

test('Browse/Search sort supports latest/popular/likes; sort=views still falls back', () => {
  // sort=views must still be unsupported
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);
  // sort=likes is now supported (Unit C, multiline ternary)
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
});

test('Public tree detail boundary: private trees must not leak viewCount', () => {
  // Public reads enforces visibility = 'public' for tree detail
  assert.match(publicReads, /t\.visibility\s*=\s*'public'/);
  assert.match(publicReads, /visibility\s*=\s*'public'/);

  // Tree likes also enforces public tree boundary (exact public predicate only)
  assert.match(treeLikes, /is_explicit_public\(tree\.get\("visibility"\)\)/);
  assert.match(treeLikes, /HTTPException\(status_code=404,\s*detail="Tree not found"\)/);

  // Tree views enforces public tree boundary
  assert.match(treeViews, /visibility\s*=\s*'public'/);
  assert.match(treeViews, /is_public\s*=\s*%s/);
});

test('View count infrastructure exists for detail read exposure', () => {
  // Aggregate table column exists in tree_views
  assert.match(treeViews, /tree_social_counts/);
  assert.match(treeViews, /view_count/);
  assert.match(treeViews, /SET\s+view_count\s*=\s*view_count\s*\+\s*1/i);

  // Dedup table enforces 24h window per actor/tree
  assert.match(treeViews, /tree_view_dedup_events/);
  assert.match(treeViews, /ON\s+CONFLICT\s+\(tree_id,\s*actor_key,\s*counted_window_start\)\s+DO\s+NOTHING/i);

  // Allowed sources are bounded
  assert.match(treeViews, /_ALLOWED_VIEW_SOURCES\s*=\s*\{"public_tree_detail",\s*"public_tree_card_open"\}/);
});

test('No broad analytics fields in view tracking', () => {
  const normalized = compact(treeViews);
  assert.doesNotMatch(normalized, /raw_ip/);
  assert.doesNotMatch(normalized, /user_agent/);
  assert.doesNotMatch(normalized, /fingerprint/);
  assert.doesNotMatch(normalized, /referrer/);
  assert.doesNotMatch(normalized, /request_headers/);
});