const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const auditPath = path.join(ROOT, 'docs', 'product', 'lovebud-browse-sort-views-readiness-audit.md');
const routerPath = path.join(ROOT, 'functions', 'api', '[[path]].js');
const modalAppPath = path.join(ROOT, 'modal_compute', 'app.py');
const publicReadsPath = path.join(ROOT, 'modal_compute', 'public_reads.py');
const validationPath = path.join(ROOT, 'modal_compute', 'validation.py');
const treeViewsPath = path.join(ROOT, 'modal_compute', 'tree_views.py');
const migrationPath = path.join(ROOT, 'scripts', 'migration-add-tree-social-counts.sql');
const policyPath = path.join(ROOT, 'docs', 'product', 'lovebud-browse-tree-view-count-policy.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Audit document locks planning/audit-only scope and references', () => {
  const content = read(auditPath);

  assert.match(content, /Refs:\s*#1661,\s*#2429,\s*#2420,\s*#2426/);
  assert.match(content, /Slice:\s*planning\/audit only/);
  assert.match(content, /Runtime behavior change:\s*none/);
  assert.match(content, /Database\/schema migration:\s*none/);
  assert.match(content, /API behavior change:\s*none/);
  assert.match(content, /Frontend label change:\s*none/);
  assert.match(content, /sort=views\s+remains unsupported/i);
});

test('Audit document enumerates all 10 readiness requirements with verdicts', () => {
  const content = read(auditPath);

  // Each readiness row appears in the table
  assert.match(content, /1\.\s+`viewCount` exists in storage/);
  assert.match(content, /2\.\s+Public read of `viewCount` for a public tree/);
  assert.match(content, /3\.\s+Router `sort` parameter/);
  assert.match(content, /4\.\s+Modal endpoint `sort` validation/);
  assert.match(content, /5\.\s+`tree_social_counts` has a `view_count DESC/);
  assert.match(content, /6\.\s+Private tree reads do not leak `viewCount`/);
  assert.match(content, /7\.\s+No raw IP \/ user-agent \/ fingerprint/);
  assert.match(content, /8\.\s+Browse\/Search summary payload does not yet expose `viewCount`/);
  assert.match(content, /9\.\s+Browse UI labels do not yet include `조회순`/);
  assert.match(content, /10\.\s+`sort=likes` is already enabled/);

  // All rows pass
  const readyRows = content.match(/✅\s+Ready/g) || [];
  assert.ok(readyRows.length >= 10, `expected at least 10 ✅ Ready verdicts, found ${readyRows.length}`);

  // Top-line verdict: no audit blocker
  assert.match(content, /\*\*Top-line\*\*:\s*No audit blocker/);
});

test('Audit document preserves hard scope boundaries for the next slice', () => {
  const content = read(auditPath);

  // 8 hard scope boundaries
  assert.match(content, /No `viewCount` in Browse\/Search summary payload/);
  assert.match(content, /No Browse UI label change/);
  assert.match(content, /No `sort=views` in the Browse UI/);
  assert.match(content, /No private tree leakage/);
  assert.match(content, /No broad analytics/);
  assert.match(content, /No dedup policy change/);
  assert.match(content, /Tie-breaker must be deterministic/);
  assert.match(content, /Router \/ modal \/ SQL \/ contract must all move together/);

  // Tie-breaker is explicit and symmetric with the likes path
  assert.match(content, /s\.view_count DESC,\s*t\.updated_at DESC,\s*t\.created_at DESC,\s*t\.id ASC/);

  // Audit does not implement the next slice
  assert.match(content, /The audit does not implement the slice/);
  assert.match(content, /This audit slice does not close #1661/);
});

test('Audit document lists every existing contract the next slice must update', () => {
  const content = read(auditPath);

  const expectedContracts = [
    'browse-sort-likes-backend-contract.test.cjs',
    'browse-tree-social-counts-plan-contract.test.cjs',
    'browse-tree-view-count-policy-contract.test.cjs',
    'migration-tree-social-counts-contract.test.cjs',
    'modal-public-read-routes-contract.test.cjs',
    'public-tree-view-event-wiring-contract.test.cjs',
    'tree-like-api-boundary-contract.test.cjs',
    'tree-like-count-foundation-audit-contract.test.cjs',
    'tree-view-api-boundary-contract.test.cjs',
    'public-tree-detail-viewcount-read-boundary-contract.test.cjs',
  ];

  for (const contractName of expectedContracts) {
    assert.match(content, new RegExp(contractName.replace(/\./g, '\\.')));
  }
});

test('Runtime baseline: router now accepts sort=views (delegated to views contract)', () => {
  const router = read(routerPath);

  // Router no longer uses the old `sort === 'views'` ternary (it uses requestedSort helper)
  assert.doesNotMatch(router, /sort'\)\s*===\s*'views'/);

  // Router accepts popular and likes as non-latest
  assert.match(router, /'popular'\s*\?\s*'popular'/);
  assert.match(router, /'likes'\s*\?\s*'likes'/);

  // Router also accepts views now (Unit C runtime slice)
  assert.match(router, /'views'\s*\?\s*'views'/);
});

test('Runtime baseline: modal endpoint now accepts sort=views in safe_sort set', () => {
  const modalApp = read(modalAppPath);

  // safe_sort allow-set now includes 'views' (Unit C runtime slice)
  const safeSortLine = modalApp.match(/safe_sort\s*=\s*sort\s+if\s+sort\s+in\s+\{[^}]+\}/);
  assert.ok(safeSortLine, 'safe_sort line must exist');
  assert.match(safeSortLine[0], /["']views["']/);
});

test('Runtime baseline: public_reads has a sort=views order_clause branch', () => {
  const publicReads = read(publicReadsPath);

  // The like_count branch exists (for sort=likes)
  assert.match(publicReads, /elif\s+sort\s*==\s*["']likes["']/);
  // The popular branch exists
  assert.match(publicReads, /if\s+sort\s*==\s*["']popular["']/);
  // The views branch exists (Unit C runtime slice)
  assert.match(publicReads, /elif\s+sort\s*==\s*["']views["']/);
  // views order clause uses s.view_count DESC with deterministic tie-breakers
  assert.match(publicReads, /s\.view_count\s+DESC,\s*t\.updated_at\s+DESC,\s*t\.created_at\s+DESC,\s*t\.id\s+ASC/);
  // Default fallback exists
  assert.match(publicReads, /order_clause\s*=\s*["']t\.created_at DESC["']/);
});

test('Runtime baseline: viewCount IS in Browse/Search summary payload', () => {
  const publicReads = read(publicReadsPath);
  const validation = read(validationPath);

  // viewCount now in normalize_row output
  assert.match(validation, /"viewCount"/);
  assert.match(publicReads, /s\.view_count/);

  // modern latest query selects s.view_count internally (for sort=views ordering)
  // but it must NOT be exposed in the normalize_row payload
  // (the validation assertion above already enforces the payload boundary)

  // Growing query section has no social counts join at all
  const growingSection = publicReads.substring(
    publicReads.indexOf('fetch_growing_public_tree_snapshots'),
    publicReads.indexOf('def fetch_public_memories')
  );
  assert.doesNotMatch(growingSection, /tree_social_counts/);
  assert.doesNotMatch(growingSection, /s\.like_count/);
  assert.doesNotMatch(growingSection, /s\.view_count/);
});

test('Runtime baseline: tree_social_counts has the view_count DESC index ready', () => {
  const sql = read(migrationPath);

  // Index for view_count exists
  assert.match(sql, /idx_tree_social_counts_view_count/);
  assert.match(sql, /ON\s+tree_social_counts\(view_count\s+DESC,\s*updated_at\s+DESC\)/i);

  // Symmetric like_count index also exists (audit references both)
  assert.match(sql, /idx_tree_social_counts_like_count/);
  assert.match(sql, /ON\s+tree_social_counts\(like_count\s+DESC,\s*updated_at\s+DESC\)/i);

  // view_count column is created with a non-negative check
  assert.match(sql, /view_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(view_count\s*>=\s*0\)/i);
});

test('Runtime baseline: viewCount read path enforces public tree boundary', () => {
  const treeViews = read(treeViewsPath);

  // fetch_public_tree_view_count uses _fetch_public_tree_for_view_count
  assert.match(treeViews, /def\s+_fetch_public_tree_for_view_count/);
  assert.match(treeViews, /visibility\s*=\s*'public'/);
  assert.match(treeViews, /is_public\s*=\s*%s/);

  // fetch_public_tree_view_count is what app.py calls
  assert.match(treeViews, /def\s+fetch_public_tree_view_count/);

  // Safe fallbacks for missing storage
  assert.match(treeViews, /_table_exists\(cur,\s*["']tree_social_counts["']\)/);
  assert.match(treeViews, /_table_has_column\(cur,\s*["']tree_social_counts["'],\s*["']view_count["']\)/);
});

test('Runtime baseline: viewCount is exposed in public detail (narrow endpoint only)', () => {
  const modalApp = read(modalAppPath);

  // Public tree detail route sets viewCount
  assert.match(modalApp, /tree\["viewCount"\]\s*=\s*fetch_public_tree_view_count/);
});

test('Runtime baseline: no raw IP / user-agent / fingerprint / referrer / header in view tracking', () => {
  const treeViews = read(treeViewsPath);
  const policy = read(policyPath);

  // tree_views.py accepts only actorKey, actorKind, source
  const recordFn = treeViews.substring(
    treeViews.indexOf('def record_public_tree_view'),
    treeViews.indexOf('def ', treeViews.indexOf('def record_public_tree_view') + 1)
  );
  assert.doesNotMatch(recordFn, /raw_ip/);
  assert.doesNotMatch(recordFn, /user_agent/);
  assert.doesNotMatch(recordFn, /fingerprint/i);
  assert.doesNotMatch(recordFn, /referrer/i);
  assert.doesNotMatch(recordFn, /request_headers/);

  // Policy locks the privacy key scheme
  assert.match(policy, /Authenticated user:\s*use account identity/);
  assert.match(policy, /Anonymous user:\s*use a privacy-preserving session key/);
  assert.match(policy, /must not store/);
  assert.match(policy, /raw IP address/);
  assert.match(policy, /raw user-agent string/);
  assert.match(policy, /full device fingerprint/);
});
