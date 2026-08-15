'use strict';

/**
 * Issue #3951 — Memory parent cycle validation must be atomic with the
 * parent UPDATE under real PostgreSQL concurrency.
 *
 * Two parts:
 *
 * 1. Source-contract proof: `update_owner_memory` runs the reparent
 *    validation and the parent_id UPDATE inside ONE `get_db_connection()`
 *    transaction, and `_validate_reparent_atomic` acquires FOR UPDATE locks
 *    on the source memory AND the target parent's ancestor chain (single
 *    ANY(...) statement, deterministic ascending-id order) before the write.
 *
 * 2. Real PostgreSQL concurrency regression: A and B in the same Tree start
 *    with parent_id NULL. Two independent pg.Client transactions are
 *    synchronized by a barrier so "set A.parent=B" (TX1) and "set B.parent=A"
 *    (TX2) actually overlap. The locking serializes them; exactly one commits
 *    and the other re-validates against the committed hierarchy and gets a
 *    bounded cycle rejection. BOTH COMMIT is proven impossible and the final
 *    reread is acyclic.
 *
 * The exact SQL mirrored here is the SQL emitted by
 * modal_compute/memory_writes.py::_validate_reparent_atomic +
 * update_owner_memory (single transaction, FOR UPDATE via
 * `WHERE id = ANY(%s::uuid[]) FOR UPDATE`, locked ancestor re-walk, then the
 * UPDATE). Reads only LB_TEST_PG* synthetic env; never DATABASE_URL.
 *
 * Refs: #3951, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { withDisposableDb, baseClientConfig } = require('./helpers/postgres-disposable-harness.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_WRITES = path.join(ROOT, 'modal_compute', 'memory_writes.py');

function readSource(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function functionBody(source, name) {
  const match = source.match(new RegExp(`def\\s+${name}\\s*\\([\\s\\S]*?(?=\\n\\ndef\\s+|$)`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

test('Memory parent reparent validation shares ONE transaction with the UPDATE', () => {
  const src = readSource(MEMORY_WRITES);
  const update = functionBody(src, 'update_owner_memory');

  // Exactly one connection acquisition; the validation + UPDATE share it.
  const opens = (update.match(/with get_db_connection\(\) as conn:/g) || []).length;
  assert.equal(opens, 1, 'update_owner_memory must open exactly ONE DB connection');

  // The parentId branch must NOT open a separate connection.
  const branchStart = update.indexOf('if "parentId" in payload:');
  const branchEnd = update.indexOf('query = f', branchStart);
  const branch = update.slice(branchStart, branchEnd);
  assert.equal(branch.includes('with get_db_connection()'), false,
    'parentId branch must not open a separate connection (single txn)');

  // Validation runs inside the transaction before the UPDATE.
  assert.match(update, /with get_db_connection\(\) as conn:/);
  const connOpen = update.indexOf('with get_db_connection() as conn:');
  const validateCall = update.indexOf('_validate_reparent_atomic(cur, safe_memory_id, reparent_target');
  const updateExec = update.indexOf('cur.execute(query, tuple(params + [safe_memory_id, owner_id]))');
  assert.ok(validateCall > connOpen, 'validation must be inside the transaction');
  assert.ok(updateExec > validateCall, 'UPDATE must run after validation in the same txn');
});

test('_validate_reparent_atomic locks source + ancestor chain deterministically', () => {
  const src = readSource(MEMORY_WRITES);
  const validator = functionBody(src, '_validate_reparent_atomic');

  assert.match(validator, /FOR UPDATE/, 'validator must acquire row locks');
  assert.match(validator, /ANY\(%s::uuid\[\]\)/, 'lock must be a single ANY(...)::uuid[] FOR UPDATE');
  assert.match(validator, /sorted\(/, 'lock set must be acquired in deterministic order');
  assert.match(validator, /_assert_no_ancestor_cycle_locked\(/, 'locked ancestor re-walk must be used');
  assert.match(validator, /INVALID_PARENT_ID/, 'bounded missing-parent code must exist');
  assert.match(validator, /PARENT_MEMORY_TREE_MISMATCH/, 'bounded cross-tree code must exist');
  assert.match(validator, /PARENT_CYCLE/, 'bounded cycle code must exist');
  assert.doesNotMatch(validator, /deadlock/i, 'raw deadlock text must not be surfaced');
});

// ---------------------------------------------------------------------------
// Fixture + exact-SQL mirror of the production fix
// ---------------------------------------------------------------------------

async function installFixture(client) {
  await client.query(`
    CREATE TABLE trees (
      id uuid PRIMARY KEY,
      owner_id text NOT NULL,
      visibility text NULL
    );
    CREATE TABLE memories (
      id uuid PRIMARY KEY,
      tree_id uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
      parent_id uuid NULL REFERENCES memories(id) ON DELETE SET NULL,
      title text NOT NULL DEFAULT '',
      visibility text NOT NULL DEFAULT 'public',
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
}

async function seedTree(client, treeId, aId, bId, owner = 'owner-1') {
  await client.query('INSERT INTO trees (id, owner_id, visibility) VALUES ($1, $2, $3)', [
    treeId, owner, 'public',
  ]);
  await client.query(
    'INSERT INTO memories (id, tree_id, parent_id) VALUES ($1, $2, NULL), ($3, $2, NULL)',
    [aId, treeId, bId],
  );
}

/**
 * Mirrors modal_compute/memory_writes.py::_validate_reparent_atomic +
 * update_owner_memory for a single transaction:
 *   1. collect the target's ancestor chain (read-only)
 *   2. lock source + full ancestor chain via a single ANY(...) FOR UPDATE
 *   3. re-walk the locked chain; if the source reappears -> PARENT_CYCLE
 *   4. otherwise UPDATE parent_id and COMMIT.
 * Returns { committed: boolean, rejection: string|null }.
 */
async function reparentOnce(client, sourceId, targetParentId, treeId) {
  const rejection = await (async () => {
    const chain = [];
    const seen = new Set();
    let cursorId = targetParentId;
    while (cursorId) {
      if (seen.has(cursorId)) return 'PARENT_CYCLE';
      seen.add(cursorId);
      chain.push(cursorId);
      if (cursorId === sourceId) return 'PARENT_CYCLE';
      const { rows } = await client.query(
        'SELECT parent_id FROM memories WHERE id = $1',
        [cursorId],
      );
      if (!rows.length || !rows[0].parent_id) break;
      cursorId = rows[0].parent_id;
    }

    const lockIds = [...new Set([sourceId, ...chain])].sort();
    const { rows } = await client.query(
      `SELECT id, tree_id, parent_id FROM memories WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [lockIds],
    );
    const locked = new Map(rows.map((r) => [r.id, r]));

    // Locked ancestor re-walk (TOCTOU defense): chain cannot change now.
    let cur = targetParentId;
    const walked = new Set();
    while (cur) {
      if (walked.has(cur)) return 'PARENT_CYCLE';
      walked.add(cur);
      if (cur === sourceId) return 'PARENT_CYCLE';
      const { rows: nextRows } = await client.query(
        'SELECT parent_id FROM memories WHERE id = $1',
        [cur],
      );
      if (!nextRows.length || !nextRows[0].parent_id) break;
      cur = nextRows[0].parent_id;
    }

    const target = locked.get(targetParentId);
    if (!target) return 'INVALID_PARENT_ID';
    if (String(target.tree_id) !== String(treeId)) return 'PARENT_MEMORY_TREE_MISMATCH';

    const upd = await client.query(
      'UPDATE memories SET parent_id = $2, updated_at = NOW() WHERE id = $1 AND tree_id = $3 RETURNING id',
      [sourceId, targetParentId, treeId],
    );
    if (!upd.rowCount) return 'MEMORY_NOT_FOUND';
    return null;
  })();

  if (rejection) {
    await client.query('ROLLBACK');
    return { committed: false, rejection };
  }
  await client.query('COMMIT');
  return { committed: true, rejection: null };
}

/** Simple two-party barrier (returns a promise that resolves when n arrived). */
function makeBarrier(n) {
  let count = 0;
  const waiters = [];
  return {
    arrive: () =>
      new Promise((resolve) => {
        count += 1;
        if (count >= n) {
          waiters.forEach((w) => w());
          resolve();
        } else {
          waiters.push(resolve);
        }
      }),
  };
}

function readHierarchy(client, ids) {
  return client.query('SELECT id, parent_id FROM memories WHERE id = ANY($1::uuid[])', [ids]);
}

function isAcyclic(rows) {
  const parents = new Map(rows.map((r) => [String(r.id), r.parent_id ? String(r.parent_id) : null]));
  for (const id of parents.keys()) {
    const visited = new Set();
    let cur = id;
    while (cur) {
      if (visited.has(cur)) return false; // cycle
      visited.add(cur);
      cur = parents.get(cur);
      if (!cur) break;
    }
  }
  return true;
}

test('PostgreSQL 17.4 serializes concurrent A->B and B->A reparents: BOTH COMMIT is impossible', async () => {
  await withDisposableDb('memory_parent_cycle', null, async (ctx) => {
    await installFixture(ctx.client);

    const treeId = '00000000-0000-0000-0000-0000000000a1';
    const aId = '00000000-0000-0000-0000-0000000000aa';
    const bId = '00000000-0000-0000-0000-0000000000bb';
    await seedTree(ctx.client, treeId, aId, bId);

    const t1 = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    const t2 = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    await t1.connect();
    await t2.connect();
    try {
      const barrier = makeBarrier(2);

      const run = (client, sourceId, targetId) => async () => {
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL lock_timeout = '3s'");
          await barrier.arrive(); // both transactions are now in-flight
          return await reparentOnce(client, sourceId, targetId, treeId);
        } finally {
          try { await client.query('ROLLBACK'); } catch { /* no-op */ }
        }
      };

      // TX1: A.parent = B   TX2: B.parent = A  — genuinely overlapping.
      const [r1, r2] = await Promise.all([run(t1, aId, bId)(), run(t2, bId, aId)()]);

      const committed = [r1, r2].filter((r) => r.committed);
      const rejected = [r1, r2].filter((r) => !r.committed);

      assert.equal(committed.length, 1, 'exactly one of A->B / B->A must commit');
      assert.equal(rejected.length, 1, 'the other must be rejected');
      assert.equal(rejected[0].rejection, 'PARENT_CYCLE',
        'loser must get a bounded cycle rejection after re-validating the committed hierarchy');

      // Final reread must be acyclic (no A<->B cycle).
      const finalRows = await readHierarchy(ctx.client, [aId, bId]);
      assert.equal(finalRows.rowCount, 2);
      const parentOf = new Map(finalRows.rows.map((r) => [String(r.id), r.parent_id ? String(r.parent_id) : null]));
      const aParent = parentOf.get(aId);
      const bParent = parentOf.get(bId);
      // Exactly one edge may exist (the winner's), never both directions.
      assert.ok(aParent === null || bParent === null,
        `final reread must be acyclic (A.parent=${aParent}, B.parent=${bParent})`);
      assert.ok(isAcyclic(finalRows.rows), 'final hierarchy must be acyclic');
    } finally {
      try { await t1.query('ROLLBACK'); } catch { /* no-op */ }
      try { await t2.query('ROLLBACK'); } catch { /* no-op */ }
      await t1.end();
      await t2.end();
    }
  });
});

test('PostgreSQL 17.4 valid same-Tree reparent still commits once (no false rejection)', async () => {
  await withDisposableDb('memory_parent_cycle_valid', null, async (ctx) => {
    await installFixture(ctx.client);
    const treeId = '00000000-0000-0000-0000-0000000000b1';
    const aId = '00000000-0000-0000-0000-0000000000ba';
    const bId = '00000000-0000-0000-0000-0000000000bb';
    await seedTree(ctx.client, treeId, aId, bId);

    const t1 = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    await t1.connect();
    try {
      const outcome = await reparentOnce(t1, aId, bId, treeId);
      assert.equal(outcome.committed, true, 'valid same-Tree reparent must commit');
      const rows = await readHierarchy(ctx.client, [aId, bId]);
      const parentOf = new Map(rows.rows.map((r) => [String(r.id), r.parent_id ? String(r.parent_id) : null]));
      assert.equal(parentOf.get(aId), bId, 'A.parent must equal B after valid reparent');
      assert.equal(parentOf.get(bId), null, 'B must remain a root');
    } finally {
      try { await t1.query('ROLLBACK'); } catch { /* no-op */ }
      await t1.end();
    }
  });
});
