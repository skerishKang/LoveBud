const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

const auditPath = path.join(ROOT, 'docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md');

test('Audit document locks closure scope, references, and no-runtime-change boundary', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /Refs:\s*#2451,\s*#1661/);
  assert.match(content, /Parent epic:\s*#1661/);
  assert.match(content, /Depends on:\s*#2436/);
  assert.match(content, /Scope:\s*closure audit \/ assessment only/);
  assert.match(content, /Runtime behavior change:\s*none/);
  assert.match(content, /Database\/schema migration:\s*none/);
  assert.match(content, /API behavior change:\s*none/);
  assert.match(content, /Frontend label change:\s*none/);
  assert.match(content, /Browse\/Search scope only:/);
  assert.match(content, /Verdict:\s*#1661 is ready to close completed/);
});

test('Audit document records tree-level like/view semantics', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /tree-level likes are separate from memory-level reactions/);
  assert.match(content, /`tree_likes` is the per-tree active like record table/);
  assert.match(content, /`tree_social_counts` is the aggregate table/);
  assert.match(content, /tree-level views are qualified public-tree exposure events/);
  assert.match(content, /duplicate suppression/);
  assert.match(content, /no raw identifiers/);
});

test('Audit document records backend sort maintenance for likes and views', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /`sort=likes` backend maintained/);
  assert.match(content, /`sort=views` backend maintained/);
  assert.match(content, /`s\.like_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC`/);
  assert.match(content, /`s\.view_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC`/);
  assert.match(content, /`idx_tree_social_counts_like_count/);
  assert.match(content, /`idx_tree_social_counts_view_count/);
});

test('Audit document records final Browse labels and control mapping', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /`최신순` \/ `조회순` \/ `좋아요순`/);
  assert.match(content, /`data-browse-sort="latest"`/);
  assert.match(content, /`data-browse-sort="views"`/);
  assert.match(content, /`data-browse-sort="likes"`/);
  assert.match(content, /`state\.currentSort`/);
  assert.match(content, /`sort: state\.currentSort`/);
});

test('Audit document records Browse/Search summary payload boundary', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /persisted `viewCount`/);
  assert.match(content, /`normalize_row\(row, include_like_count=True\)`/);
  assert.match(content, /Missing or null `view_count`/);
});

test('Audit document records private/public boundary preservation', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /`WHERE t\.visibility = 'public'`/);
  assert.match(content, /public-tree-only reads/);
  assert.match(content, /404/);
  assert.match(content, /private tree engagement data is not exposed/);
});

test('Audit document records no raw analytics or Scout live work', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));

  assert.match(content, /No raw analytics storage or Scout live work is mixed in/);
  assert.match(content, /raw IP, raw user-agent, referrer URLs, full request headers, device fingerprint/);
  assert.match(content, /`tree_id`, opaque `actor_key`, `actor_kind`, `counted_window_start`, `source`, and `created_at`/);
  assert.match(content, /Scout live-provider work/);
});

test('Audit document lists related docs and contract coverage', () => {
  const content = read(path.join('docs', 'product', 'lovebud-browse-tree-social-counts-completion-audit.md'));
  const expectedDocs = [
    'lovebud-browse-tree-social-counts-plan.md',
    'lovebud-tree-like-count-foundation-audit.md',
    'lovebud-browse-tree-view-count-policy.md',
    'lovebud-browse-sort-views-readiness-audit.md',
    'lovebud-public-tree-detail-viewcount-read-boundary.md',
    'lovebud-browse-final-social-sort-labels-decision.md',
    'BROWSE_POPULAR_SORT_SEMANTICS.md',
    'browse-tree-social-counts-plan-contract.test.cjs',
    'browse-sort-likes-backend-contract.test.cjs',
    'browse-sort-views-readiness-contract.test.cjs',
    'browse-final-social-sort-labels-implementation-contract.test.cjs',
  ];

  for (const doc of expectedDocs) {
    assert.match(content, new RegExp(doc.replace(/\./g, '\\.')));
  }
});

test('Runtime locking: router accepts latest/popular/likes/views and falls back to latest', () => {
  const router = read(path.join('functions', 'api', '[[path]].js'));

  assert.match(router, /function buildBrowseCacheRequest/);
  assert.match(router, /function buildModalUrl/);
  assert.match(router, /requestedSort === 'popular'/);
  assert.match(router, /requestedSort === 'likes'/);
  assert.match(router, /requestedSort === 'views'/);
  assert.match(router, /: 'latest'/);
});

test('Runtime locking: modal app safe_sort set includes latest/popular/likes/views', () => {
  const modalApp = read(path.join('modal_compute', 'app.py'));

  assert.match(modalApp, /safe_sort = sort if sort in \{\s*"latest",\s*"popular",\s*"likes",\s*"views"\s*\}/);
  assert.match(modalApp, /fetch_latest_public_tree_snapshots\(limit=limit, sort=safe_sort\)/);
});

test('Runtime locking: public_reads has likes/views order branches and public-tree filter', () => {
  const publicReads = read(path.join('modal_compute', 'public_reads.py'));

  assert.match(publicReads, /elif sort == "likes":/);
  assert.match(publicReads, /s\.like_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
  assert.match(publicReads, /elif sort == "views":/);
  assert.match(publicReads, /s\.view_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
  assert.match(publicReads, /WHERE t\.visibility = 'public'/);
  assert.match(publicReads, /normalize_row\(row, include_like_count=True\)/);
});

test('Runtime locking: validation exposes viewCount in Browse/Search summary', () => {
  const validation = read(path.join('modal_compute', 'validation.py'));

  assert.match(validation, /result\["viewCount"\]/);
  assert.match(validation, /"viewCount"/);
  assert.match(validation, /"memoryCount": memory_count/);
  assert.match(validation, /include_like_count/);
  assert.match(validation, /result\["likeCount"\]/);
});

test('Runtime locking: search-ui exposes latest/views/likes labels without popular button', () => {
  const searchUi = read(path.join('js', 'search', 'search-ui.js'));

  assert.match(searchUi, /data-browse-sort="latest"/);
  assert.match(searchUi, /data-browse-sort="views"/);
  assert.match(searchUi, /data-browse-sort="likes"/);
  assert.match(searchUi, /최신순/);
  assert.match(searchUi, /조회순/);
  assert.match(searchUi, /좋아요순/);
  assert.doesNotMatch(searchUi, /data-browse-sort="popular"/);
  assert.doesNotMatch(searchUi, /viewCount/);
  assert.doesNotMatch(searchUi, /likeCount/);
});

test('Runtime locking: search-index sends state.currentSort as sort param', () => {
  const searchIndex = read(path.join('js', 'search', 'search-index.js'));

  assert.match(searchIndex, /currentSort: 'latest'/);
  assert.match(searchIndex, /state\.currentSort/);
  assert.match(searchIndex, /sort:\s*state\.currentSort/);
});

test('Runtime locking: view tracking migrations and helpers preserve privacy boundary', () => {
  const migration = read(path.join('scripts', 'migration-add-tree-view-tracking.sql'));
  const treeViews = read(path.join('modal_compute', 'tree_views.py'));
  const recordFn = treeViews.substring(
    treeViews.indexOf('def record_public_tree_view'),
    treeViews.indexOf('def ', treeViews.indexOf('def record_public_tree_view') + 1)
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS tree_view_dedup_events/);
  assert.match(migration, /actor_key VARCHAR\(128\) NOT NULL/);
  assert.match(migration, /actor_kind VARCHAR\(32\) NOT NULL CHECK \(actor_kind IN \('authenticated', 'anonymous'\)\)/);
  assert.match(migration, /ON tree_view_dedup_events\(tree_id, actor_key, counted_window_start\)/);
  assert.match(migration, /Do not store raw IP addresses, raw user-agent strings, full device/);
  assert.match(treeViews, /def record_public_tree_view/);
  assert.match(treeViews, /def _fetch_public_tree_for_view_count/);
  assert.match(treeViews, /visibility\s*=\s*'public'/);
  assert.doesNotMatch(recordFn, /raw_ip/);
  assert.doesNotMatch(recordFn, /user_agent/);
  assert.doesNotMatch(recordFn, /fingerprint/i);
  assert.doesNotMatch(recordFn, /referrer/i);
  assert.doesNotMatch(recordFn, /request_headers/);
});

test('Runtime locking: audited Browse/Search files do not add Scout live-provider work', () => {
  const files = [
    path.join('functions', 'api', '[[path]].js'),
    path.join('modal_compute', 'app.py'),
    path.join('modal_compute', 'public_reads.py'),
    path.join('modal_compute', 'validation.py'),
    path.join('js', 'search', 'search-ui.js'),
    path.join('js', 'search', 'search-index.js'),
  ];
  const combined = files.map(read).join('\n');

  assert.doesNotMatch(combined, /Scout/);
  assert.doesNotMatch(combined, /scout/);
  assert.doesNotMatch(combined, /provider\/fetch/);
  assert.doesNotMatch(combined, /Scout live/);
});

test('Product index includes the completion audit document', () => {
  const productIndex = read(path.join('docs', 'product', 'product_index.md'));

  assert.match(productIndex, /lovebud-browse-tree-social-counts-completion-audit\.md/);
});
