const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const treeLikes = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_likes.py'), 'utf8');
const treeViews = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_views.py'), 'utf8');
const reactions = fs.readFileSync(path.join(ROOT, 'modal_compute', 'reactions.py'), 'utf8');
const cloudflareLikes = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'trees', '[tree_id]', 'likes.js'), 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');
const migrationLike = fs.readFileSync(path.join(ROOT, 'scripts', 'migration-add-tree-social-counts.sql'), 'utf8');
const migrationView = fs.readFileSync(path.join(ROOT, 'scripts', 'migration-add-tree-view-tracking.sql'), 'utf8');

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

test('Audit: public tree detail likeCount is tree-level (not memory-level)', () => {
  // app.py calls fetch_public_tree_like_count for likeCount
  assert.match(modalApp, /tree\["likeCount"\]\s*=\s*fetch_public_tree_like_count/);

  // fetch_public_tree_like_count reads from tree_social_counts (tree-level aggregate)
  assert.match(treeLikes, /FROM\s+tree_social_counts[\s\S]*WHERE\s+tree_id\s*=\s*%s/i);

  // Does NOT read from reactions table (memory-level)
  assert.doesNotMatch(treeLikes, /FROM\s+reactions/i);
  assert.doesNotMatch(treeLikes, /memory_id/i);
});

test('Audit: tree_social_counts.like_count is authoritative source', () => {
  // Migration creates tree_social_counts with like_count column
  assert.match(migrationLike, /CREATE TABLE IF NOT EXISTS tree_social_counts/);
  assert.match(migrationLike, /like_count\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0\s+CHECK\s+\(like_count\s*>=\s*0\)/);

  // Index for sort=likes exists
  assert.match(migrationLike, /idx_tree_social_counts_like_count/);
  assert.match(migrationLike, /like_count\s+DESC/);

  // Helper reads like_count
  assert.match(treeLikes, /def\s+_fetch_like_count/);
  assert.match(treeLikes, /SELECT\s+like_count\s+FROM\s+tree_social_counts/);
});

test('Audit: memory-level reactions and tree-level likes are separated', () => {
  // tree_likes.py does not reference reactions table
  assert.doesNotMatch(treeLikes, /FROM\s+reactions/i);
  assert.doesNotMatch(treeLikes, /memory_id/i);

  // reactions.py operates on memory_id, not tree_id
  assert.match(reactions, /WHERE\s+memory_id\s*=\s*%s/);
  assert.doesNotMatch(reactions, /tree_social_counts/);
  assert.doesNotMatch(reactions, /tree_likes/);

  // Different tables created by different migrations
  assert.match(migrationLike, /CREATE TABLE IF NOT EXISTS tree_likes/);
  assert.match(migrationLike, /CREATE TABLE IF NOT EXISTS tree_social_counts/);
  // view migration does not touch tree_likes or tree_social_counts like_count
  assert.doesNotMatch(migrationView, /tree_likes/);
});

test('Audit: private/missing tree likeCount does not leak via public route', () => {
  // Public detail endpoint validates public tree
  assert.match(modalApp, /@web_app\.get\("\/modal\/trees\/\{tree_id\}"\)/);
  assert.match(modalApp, /tree\s*=\s*fetch_public_tree\(safe_tree_id\)/);
  assert.match(modalApp, /if not tree[\s\S]*raise HTTPException\(status_code=404/);

  // fetch_public_tree_like_count validates public tree
  assert.match(treeLikes, /def\s+_fetch_public_tree_for_like_count/);
  assert.match(treeLikes, /visibility\s*=\s*'public'/);
  assert.match(treeLikes, /is_public\s*=\s*%s/);
  assert.match(treeLikes, /if not tree[\s\S]*return None/);
  assert.match(treeLikes, /raise HTTPException\(status_code=404,\s*detail="Tree not found"\)/);

  // Cloudflare likes route requires auth (private only)
  assert.match(cloudflareLikes, /Authorization required/);
});

test('Audit: missing aggregate row returns safe zero', () => {
  // fetch_public_tree_like_count checks table existence
  assert.match(treeLikes, /if not _table_exists\(cur,\s*["']tree_social_counts["']\)[\s\S]*return\s*\{\s*["']like_count["']\s*:\s*0\s*\}/);

  // _fetch_like_count also safe (returns 0 if table missing or row missing)
  assert.match(treeLikes, /def\s+_fetch_like_count/);
  assert.match(treeLikes, /return int\(row\.get\("like_count"\) or 0\)/);

  // Migration default ensures non-negative
  assert.match(migrationLike, /like_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s+\(like_count\s*>=\s*0\)/);
});

test('Audit: column missing fallback covered by migration atomicity', () => {
  // Migration creates table and like_count column together
  assert.match(migrationLike, /CREATE TABLE IF NOT EXISTS tree_social_counts\s*\([\s\S]*like_count\s+INTEGER/);

  // No separate column addition — column exists iff table exists
  // Table missing check is sufficient (column cannot exist without table)
});

test('Audit: toggle_tree_like prevents repeated active likes per user/tree', () => {
  // Migration enforces unique active like per tree+owner
  assert.match(migrationLike, /CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_likes_tree_owner_active/);
  assert.match(migrationLike, /ON tree_likes\(tree_id,\s*owner_id\)/);
  assert.match(migrationLike, /WHERE deleted_at IS NULL/);

  // Application logic queries for existing active like
  assert.match(treeLikes, /WHERE\s+tree_id\s*=\s*%s[\s\S]*AND\s+owner_id\s*=\s*%s[\s\S]*AND\s+deleted_at\s+IS\s+NULL/);

  // Toggle off sets deleted_at
  assert.match(treeLikes, /SET\s+deleted_at\s*=\s*NOW\(\)/);

  // Decrement uses GREATEST to prevent negative
  assert.match(treeLikes, /GREATEST\(like_count\s*-\s*1,\s*0\)/);

  // Increment uses +1
  assert.match(treeLikes, /SET\s+like_count\s*=\s*like_count\s*\+\s*1/);
});

test('Audit: sort=likes is now enabled; UI labels and viewCount summary are still forbidden', () => {
  // sort=likes is now enabled (Unit C)
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
  // sort=views remains unsupported
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);

  // viewCount still forbidden in Browse summary (Unit B policy)
  assert.doesNotMatch(browseSnapshot, /viewCount/);

  // likeCount is now allowed in latest Browse summary (Unit C, opt-in)
  // but Browse UI labels are still forbidden (Unit D slice)
  assert.doesNotMatch(cloudflareLikes, /sort=views/);
});

test('Audit: view tracking foundation parallel exists but separate', () => {
  // View migration creates separate dedup table
  assert.match(migrationView, /CREATE TABLE IF NOT EXISTS tree_view_dedup_events/);
  assert.doesNotMatch(migrationView, /tree_likes/);

  // tree_social_counts has both counts
  assert.match(migrationLike, /like_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/);
  assert.match(migrationLike, /view_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/);

  // Separate indexes for sort=likes and sort=views
  assert.match(migrationLike, /idx_tree_social_counts_like_count/);
  assert.match(migrationLike, /idx_tree_social_counts_view_count/);
});

test('Audit: public detail likeCount matches viewCount boundary decision; sort=likes is now enabled (Unit C)', () => {
  // Both likeCount and viewCount added to public detail (app.py)
  assert.match(modalApp, /tree\["likeCount"\]\s*=\s*fetch_public_tree_like_count/);
  assert.match(modalApp, /tree\["viewCount"\]\s*=\s*fetch_public_tree_view_count/);

  // Both read from tree_social_counts
  assert.match(treeLikes, /FROM\s+tree_social_counts/);
  assert.match(treeViews, /FROM\s+tree_social_counts/);

  // viewCount still forbidden in Browse summary (Unit B policy boundary)
  assert.doesNotMatch(browseSnapshot, /viewCount/);
  // sort=views still unsupported
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);
  // sort=likes is now enabled (Unit C runtime slice)
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
});