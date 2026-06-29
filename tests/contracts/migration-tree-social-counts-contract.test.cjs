const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const migrationPath = path.join(ROOT, 'scripts', 'migration-add-tree-social-counts.sql');
const memoryReactionMigrationPath = path.join(ROOT, 'scripts', 'migration-add-reactions-comments.sql');
const routerPath = path.join(ROOT, 'functions', 'api', '[[path]].js');
const sql = fs.readFileSync(migrationPath, 'utf8');
const memoryReactionSql = fs.readFileSync(memoryReactionMigrationPath, 'utf8');
const router = fs.readFileSync(routerPath, 'utf8');

test('tree social counts migration creates tree_likes separately from memory reactions', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tree_likes/i);
  assert.match(sql, /tree_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+trees\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(sql, /owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL/i);
  assert.match(sql, /deleted_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NULL/i);
  assert.doesNotMatch(sql, /memory_id\s+UUID/i);
  assert.match(memoryReactionSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+reactions/i);
  assert.match(memoryReactionSql, /memory_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+memories\(id\)/i);
});

test('tree_likes migration enforces one active like per account per tree', () => {
  assert.match(sql, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tree_likes_tree_owner_active/i);
  assert.match(sql, /ON\s+tree_likes\(tree_id,\s*owner_id\)/i);
  assert.match(sql, /WHERE\s+deleted_at\s+IS\s+NULL/i);
});

test('tree social counts migration creates aggregate counts table', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tree_social_counts/i);
  assert.match(sql, /tree_id\s+TEXT\s+PRIMARY\s+KEY\s+REFERENCES\s+trees\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(sql, /like_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(like_count\s+>=\s+0\)/i);
  assert.match(sql, /view_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(view_count\s+>=\s+0\)/i);
  assert.match(sql, /updated_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
});

test('tree social counts migration prepares count indexes (sort=likes is now supported as Unit C)', () => {
  assert.match(sql, /idx_tree_social_counts_like_count/i);
  assert.match(sql, /ON\s+tree_social_counts\(like_count\s+DESC,\s*updated_at\s+DESC\)/i);
  assert.match(sql, /idx_tree_social_counts_view_count/i);
  assert.match(sql, /ON\s+tree_social_counts\(view_count\s+DESC,\s*updated_at\s+DESC\)/i);
  // sort=likes is now supported in router (Unit C runtime slice, multiline ternary)
  assert.match(router, /'likes'\s*\?\s*'likes'/);
  // sort=views must remain unsupported
  assert.doesNotMatch(router, /sort'\)\s*===\s*'views'/);
});

test('tree social counts migration keeps scope narrow', () => {
  assert.match(sql, /does not enable sort=likes, sort=views, Browse UI labels/i);
  assert.match(sql, /runtime view tracking, or broad analytics/i);
  assert.doesNotMatch(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tree_views/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+trees\s+ADD/i);
});
