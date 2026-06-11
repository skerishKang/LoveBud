const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const migrationPath = path.join(ROOT, 'scripts', 'migration-add-tree-view-tracking.sql');
const policyPath = path.join(ROOT, 'docs', 'product', 'lovebud-browse-tree-view-count-policy.md');
const routerPath = path.join(ROOT, 'functions', 'api', '[[path]].js');
const modalBrowsePath = path.join(ROOT, 'modal_compute', 'browse_latest.py');

const sql = fs.readFileSync(migrationPath, 'utf8');
const policy = fs.readFileSync(policyPath, 'utf8');
const router = fs.readFileSync(routerPath, 'utf8');
const modalBrowse = fs.readFileSync(modalBrowsePath, 'utf8');

test('tree view tracking migration creates narrow dedup table', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tree_view_dedup_events/i);
  assert.match(sql, /tree_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+trees\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(sql, /actor_key\s+VARCHAR\(128\)\s+NOT\s+NULL/i);
  assert.match(sql, /actor_kind\s+VARCHAR\(32\)\s+NOT\s+NULL/i);
  assert.match(sql, /counted_window_start\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL/i);
  assert.match(sql, /created_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i);
});

test('tree view tracking migration restricts actor kinds and countable sources', () => {
  assert.match(sql, /actor_kind\s+IN\s+\('authenticated',\s*'anonymous'\)/i);
  assert.match(sql, /source\s+VARCHAR\(64\)\s+NOT\s+NULL/i);
  assert.match(sql, /'public_tree_detail'/i);
  assert.match(sql, /'public_tree_card_open'/i);
  assert.match(policy, /Public tree detail page open/);
  assert.match(policy, /Explicit public tree card open/);
});

test('tree view tracking migration enforces one actor tree window row', () => {
  assert.match(sql, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tree_view_dedup_tree_actor_window/i);
  assert.match(sql, /ON\s+tree_view_dedup_events\(tree_id,\s*actor_key,\s*counted_window_start\)/i);
  assert.match(sql, /rolling\s+24-hour\s+window/i);
  assert.match(policy, /rolling 24-hour window/);
});

test('tree view tracking migration avoids raw network and device identifier storage fields', () => {
  assert.match(sql, /Privacy guardrails/i);
  assert.match(sql, /Do not store raw IP addresses/i);
  assert.match(sql, /raw user-agent strings/i);
  assert.match(sql, /full device\s+fingerprints/i);
  assert.match(sql, /referrer URLs/i);
  assert.match(sql, /request headers/i);
  assert.doesNotMatch(sql, /ip_address\s+/i);
  assert.doesNotMatch(sql, /user_agent\s+/i);
  assert.doesNotMatch(sql, /fingerprint\s+VARCHAR/i);
  assert.doesNotMatch(sql, /headers\s+JSON/i);
  assert.doesNotMatch(sql, /request_headers\s+/i);
  assert.doesNotMatch(sql, /referrer_url\s+/i);
});

test('tree view tracking migration keeps aggregate and runtime behavior held', () => {
  assert.match(sql, /does not enable runtime view counting/i);
  assert.match(sql, /sort=views, sort=likes/i);
  assert.match(sql, /Browse UI labels/i);
  assert.match(sql, /Browse viewCount payloads/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+trees\s+ADD/i);
  assert.doesNotMatch(sql, /UPDATE\s+tree_social_counts/i);
  assert.doesNotMatch(sql, /CREATE\s+TRIGGER/i);
});

test('current router and Browse summary still do not expose views sort or payload', () => {
  assert.match(router, /url\.searchParams\.get\('sort'\) === 'popular' \? 'popular' : 'latest'/);
  assert.doesNotMatch(router, /sort'\) === 'views'/);
  assert.doesNotMatch(router, /sort'\) === 'likes'/);
  assert.match(modalBrowse, /"memoryCount": memory_count/);
  assert.doesNotMatch(modalBrowse, /"viewCount"/);
});
