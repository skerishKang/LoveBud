const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const migrationPath = path.join(ROOT, 'scripts', 'migration-add-reactions-comments.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('reactions migration creates memories before memory-level foreign keys', () => {
  const createMemoriesIndex = sql.indexOf('CREATE TABLE IF NOT EXISTS memories');
  const createReactionsIndex = sql.indexOf('CREATE TABLE IF NOT EXISTS reactions');
  const createCommentsIndex = sql.indexOf('CREATE TABLE IF NOT EXISTS comments');

  assert.notEqual(createMemoriesIndex, -1, 'migration must create memories table first');
  assert.notEqual(createReactionsIndex, -1, 'migration must create reactions table');
  assert.notEqual(createCommentsIndex, -1, 'migration must create comments table');
  assert.ok(createMemoriesIndex < createReactionsIndex, 'memories table must exist before reactions FK');
  assert.ok(createMemoriesIndex < createCommentsIndex, 'memories table must exist before comments FK');
});

test('reactions migration keeps backend-compatible memory-level schema', () => {
  assert.match(sql, /memory_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+memories\(id\)/i);
  assert.match(sql, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_reactions_memory_owner_type\s+ON\s+reactions\(memory_id,\s*owner_id,\s*type\)/i);
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_comments_memory_id\s+ON\s+comments\(memory_id\)/i);
});

test('memories table includes columns required by owner read and write handlers', () => {
  const requiredColumns = [
    'tree_id',
    'parent_id',
    'title',
    'memo',
    'artist',
    'source',
    'source_url',
    'source_type',
    'thumbnail',
    'emotion_tags',
    'timestamp',
    'visibility',
    'channel_id',
    'channel_name',
    'channel_url',
    'created_at',
    'updated_at'
  ];

  for (const column of requiredColumns) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'), `missing memories.${column}`);
  }
});
