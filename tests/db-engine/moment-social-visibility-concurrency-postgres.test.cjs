'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { withDisposableDb, baseClientConfig } = require('./helpers/postgres-disposable-harness.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const VALIDATION = path.join(ROOT, 'modal_compute', 'write_validation.py');

function readSource(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function functionBody(source, name) {
  const match = source.match(new RegExp(`def\\s+${name}\\s*\\([\\s\\S]*?(?=\\n\\ndef\\s+|$)`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

test('Moment social cursor guard locks both visibility authorities with FOR SHARE', () => {
  const guard = functionBody(readSource(VALIDATION), 'require_memory_visible_or_owner_cursor');
  assert.match(guard, /INNER JOIN trees t ON t\.id = m\.tree_id/);
  assert.match(guard, /FOR\s+SHARE\s+OF\s+m,\s*t/i);
  assert.doesNotMatch(guard, /FOR\s+KEY\s+SHARE/i);
  assert.match(guard, /is_explicit_public\(row\["mem_visibility"\]\)/);
  assert.match(guard, /is_explicit_public\([\s\S]*row\["tree_visibility"\]/);
});

async function installFixture(client) {
  await client.query(`
    CREATE TABLE trees (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      visibility text NULL
    );
    CREATE TABLE memories (
      id text PRIMARY KEY,
      tree_id text NOT NULL REFERENCES trees(id),
      visibility text NULL
    );
    CREATE TABLE comments (
      id text PRIMARY KEY,
      memory_id text NOT NULL,
      owner_id text NOT NULL
    );
    CREATE TABLE reactions (
      id text PRIMARY KEY,
      memory_id text NOT NULL,
      owner_id text NOT NULL,
      type text NOT NULL
    );
  `);
}

async function resetTarget(client, suffix, memoryVisibility = 'public', treeVisibility = 'public') {
  await client.query('TRUNCATE reactions, comments, memories, trees');
  const treeId = `tree-${suffix}`;
  const memoryId = `memory-${suffix}`;
  await client.query(
    'INSERT INTO trees (id, owner_id, visibility) VALUES ($1, $2, $3)',
    [treeId, 'tree-owner', treeVisibility],
  );
  await client.query(
    'INSERT INTO memories (id, tree_id, visibility) VALUES ($1, $2, $3)',
    [memoryId, treeId, memoryVisibility],
  );
  return { treeId, memoryId };
}

async function lockedAuth(client, memoryId) {
  return client.query(
    `SELECT m.id, m.visibility AS mem_visibility,
            t.visibility AS tree_visibility
     FROM memories m
     INNER JOIN trees t ON t.id = m.tree_id
     WHERE m.id = $1
     LIMIT 1
     FOR SHARE OF m, t`,
    [memoryId],
  );
}

function explicitlyPublic(row) {
  return row && row.mem_visibility === 'public' && row.tree_visibility === 'public';
}

async function privateFirstNoMutation(client, targetTable, revokeKind) {
  const ids = await resetTarget(client, `${targetTable}-${revokeKind}-private-first`);
  if (revokeKind === 'memory') {
    await client.query('UPDATE memories SET visibility = $2 WHERE id = $1', [ids.memoryId, 'private']);
  } else {
    await client.query('UPDATE trees SET visibility = $2 WHERE id = $1', [ids.treeId, 'private']);
  }

  await client.query('BEGIN');
  try {
    const auth = await lockedAuth(client, ids.memoryId);
    assert.equal(auth.rowCount, 1);
    assert.equal(explicitlyPublic(auth.rows[0]), false, `${revokeKind}-private-first must fail closed`);
    if (explicitlyPublic(auth.rows[0])) {
      if (targetTable === 'comments') {
        await client.query(
          'INSERT INTO comments (id, memory_id, owner_id) VALUES ($1, $2, $3)',
          ['comment-private-first', ids.memoryId, 'actor'],
        );
      } else {
        await client.query(
          'INSERT INTO reactions (id, memory_id, owner_id, type) VALUES ($1, $2, $3, $4)',
          ['reaction-private-first', ids.memoryId, 'actor', 'like'],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const count = await client.query(`SELECT count(*)::int AS count FROM ${targetTable}`);
  assert.equal(count.rows[0].count, 0, `${targetTable} must not mutate after ${revokeKind} revocation wins`);
}

async function socialFirstBlocksUpdate(ctx, targetTable, revokeKind) {
  const { cfg, dbName, client: social } = ctx;
  const ids = await resetTarget(social, `${targetTable}-${revokeKind}-social-first`);
  const owner = new Client(baseClientConfig(cfg, dbName));
  await owner.connect();
  try {
    await social.query('BEGIN');
    const auth = await lockedAuth(social, ids.memoryId);
    assert.equal(auth.rowCount, 1);
    assert.equal(explicitlyPublic(auth.rows[0]), true);

    if (targetTable === 'comments') {
      await social.query(
        'INSERT INTO comments (id, memory_id, owner_id) VALUES ($1, $2, $3)',
        ['comment-social-first', ids.memoryId, 'actor'],
      );
    } else {
      await social.query(
        'INSERT INTO reactions (id, memory_id, owner_id, type) VALUES ($1, $2, $3, $4)',
        ['reaction-social-first', ids.memoryId, 'actor', 'like'],
      );
    }

    await owner.query('BEGIN');
    await owner.query("SET LOCAL lock_timeout = '200ms'");
    const update = revokeKind === 'memory'
      ? owner.query('UPDATE memories SET visibility = $2 WHERE id = $1', [ids.memoryId, 'private'])
      : owner.query('UPDATE trees SET visibility = $2 WHERE id = $1', [ids.treeId, 'private']);
    await assert.rejects(
      update,
      error => error && error.code === '55P03',
      `${revokeKind} visibility UPDATE must block behind social FOR SHARE`,
    );
    await owner.query('ROLLBACK');

    await social.query('COMMIT');

    await owner.query('BEGIN');
    await owner.query("SET LOCAL lock_timeout = '1s'");
    if (revokeKind === 'memory') {
      await owner.query('UPDATE memories SET visibility = $2 WHERE id = $1', [ids.memoryId, 'private']);
    } else {
      await owner.query('UPDATE trees SET visibility = $2 WHERE id = $1', [ids.treeId, 'private']);
    }
    await owner.query('COMMIT');

    const count = await social.query(`SELECT count(*)::int AS count FROM ${targetTable}`);
    assert.equal(count.rows[0].count, 1, `${targetTable} must commit before later ${revokeKind} privacy transition`);
  } finally {
    try { await social.query('ROLLBACK'); } catch {}
    try { await owner.query('ROLLBACK'); } catch {}
    await owner.end();
  }
}

test('PostgreSQL 17.4 serializes Moment Comment/Reaction writes against Memory and Tree revocation', async () => {
  await withDisposableDb('moment_social_visibility', null, async ctx => {
    await installFixture(ctx.client);

    for (const table of ['comments', 'reactions']) {
      await privateFirstNoMutation(ctx.client, table, 'memory');
      await privateFirstNoMutation(ctx.client, table, 'tree');
      await socialFirstBlocksUpdate(ctx, table, 'memory');
      await socialFirstBlocksUpdate(ctx, table, 'tree');
    }

    const ids = await resetTarget(ctx.client, 'null-negative', null, 'public');
    const nullMemory = await lockedAuth(ctx.client, ids.memoryId);
    assert.equal(explicitlyPublic(nullMemory.rows[0]), false, 'NULL Memory visibility must fail closed');

    const ids2 = await resetTarget(ctx.client, 'null-tree-negative', 'public', null);
    const nullTree = await lockedAuth(ctx.client, ids2.memoryId);
    assert.equal(explicitlyPublic(nullTree.rows[0]), false, 'NULL Tree visibility must fail closed');
  });
});
