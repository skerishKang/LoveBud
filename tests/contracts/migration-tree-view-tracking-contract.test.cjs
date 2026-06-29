const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const migrationPath = path.join(ROOT, 'scripts', 'migration-add-tree-view-tracking.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('tree view tracking migration creates privacy-preserving dedup table', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tree_view_dedup_events/);
  assert.match(sql, /tree_id TEXT NOT NULL REFERENCES trees\(id\) ON DELETE CASCADE/);
  assert.match(sql, /actor_key VARCHAR\(128\) NOT NULL/);
  assert.match(sql, /actor_kind VARCHAR\(32\) NOT NULL/);
  assert.match(sql, /counted_window_start TIMESTAMP WITH TIME ZONE NOT NULL/);
  assert.match(sql, /source VARCHAR\(64\) NOT NULL/);
  assert.match(sql, /created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW\(\)/);
});

test('tree view tracking migration locks dedup index and countable sources', () => {
  assert.match(sql, /actor_kind IN \('authenticated', 'anonymous'\)/);
  assert.match(sql, /source IN \('public_tree_detail', 'public_tree_card_open'\)/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_view_dedup_tree_actor_window/);
  assert.match(sql, /ON tree_view_dedup_events\(tree_id, actor_key, counted_window_start\)/);
});

test('tree view tracking migration remains non-runtime and privacy scoped', () => {
  assert.match(sql, /does not enable runtime view counting/);
  assert.match(sql, /sort=views, sort=likes/);
  assert.match(sql, /Browse UI labels/);
  assert.match(sql, /Browse viewCount payloads/);
  assert.match(sql, /Do not store raw IP addresses/);
  assert.match(sql, /raw user-agent strings/);
  assert.match(sql, /full device/);
  assert.match(sql, /request headers/);
});
