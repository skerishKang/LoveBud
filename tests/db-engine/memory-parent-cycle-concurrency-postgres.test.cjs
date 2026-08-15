'use strict';

/**
 * Issue #3951 — Memory parent cycle validation must be atomic with the
 * parent UPDATE under real PostgreSQL concurrency.
 *
 * Three parts:
 *
 * 1. Source-contract proof: `update_owner_memory` rereads source Memory +
 *    owning Tree inside ONE `get_db_connection()` transaction to obtain the
 *    authoritative tree_id, acquires a tree-scoped pg_advisory_xact_lock
 *    (domain-separated key "memory-parent-graph:<tree_id>"), then rereads
 *    source and target before graph validation. Different Trees derive
 *    different advisory keys and do not serialize behind one global lock.
 *
 * 2. Real PostgreSQL concurrency regression: A and B in the same Tree start
 *    with parent_id NULL. Two independent pg.Client transactions are
 *    synchronized by a barrier so "set A.parent=B" (TX1) and "set B.parent=A"
 *    (TX2) actually overlap. The advisory lock serializes same-Tree writes;
 *    exactly one commits and the other re-validates against the committed
 *    hierarchy and gets a bounded cycle rejection. BOTH COMMIT is proven
 *    impossible and the final reread is acyclic.
 *
 * 3. Different-Tree concurrency: two independent Trees derive different
 *    advisory lock keys and do not serialize. Both reparents commit
 *    concurrently.
 *
 * The exact SQL mirrored here is the SQL emitted by
 * modal_compute/memory_writes.py (single transaction, source+Tree reread,
 * pg_advisory_xact_lock, post-lock reread, ancestor walk, UPDATE). Reads
 * only LB_TEST_PG* synthetic env; never DATABASE_URL.
 *
 * Refs: #3951, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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

/**
 * Mirrors modal_compute/memory_writes.py::_memory_parent_advisory_lock.
 * SHA-256 of "memory-parent-graph:<tree_id>", first 8 bytes as signed int64.
 * Returns a BigInt so the exact int8 key (no JS Number precision loss past
 * 2^53) is sent to pg_advisory_xact_lock — identical to the Python value.
 */
function memoryParentAdvisoryLock(treeId) {
  const hash = crypto.createHash('sha256').update(`memory-parent-graph:${treeId}`).digest();
  return hash.subarray(0, 8).readBigInt64BE();
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
  const validateCall = update.indexOf('_validate_reparent_atomic(cur, safe_memory_id, reparent_target, owner_id)');
  const updateExec = update.indexOf('cur.execute(query, tuple(params + [safe_memory_id, owner_id]))');
  assert.ok(validateCall > connOpen, 'validation must be inside the transaction');
  assert.ok(updateExec > validateCall, 'UPDATE must run after validation in the same txn');
});

test('_validate_reparent_atomic uses tree-scoped advisory lock + post-lock rereads', () => {
  const src = readSource(MEMORY_WRITES);
  const update = functionBody(src, 'update_owner_memory');
  const validator = functionBody(src, '_validate_reparent_atomic');

  // Source + Tree reread inside transaction for authoritative tree_id.
  assert.match(update, /FROM memories m/, 'source+Tree reread must exist in transaction');
  assert.match(update, /INNER JOIN trees t/, 'Tree join must exist in transaction');
  assert.match(update, /authoritative_tree_id/, 'authoritative tree_id must be obtained in-transaction');

  // Advisory lock acquisition (not FOR UPDATE row locks).
  assert.match(update, /pg_advisory_xact_lock/, 'advisory lock must be acquired');
  assert.match(update, /_memory_parent_advisory_lock/, 'advisory lock key must be derived from tree_id');

  // _validate_reparent_atomic called with (cur, source_id, parent_id, owner_id) — post-lock owner authority.
  assert.match(update, /_validate_reparent_atomic\(cur, safe_memory_id, reparent_target, owner_id\)/,
    'validator called with owner_id for post-lock owner authority');

  // No FOR UPDATE or ANY(...) FOR UPDATE (old architecture removed).
  assert.doesNotMatch(validator, /FOR UPDATE/, 'validator must NOT use row-level FOR UPDATE');
  assert.doesNotMatch(validator, /ANY\(/, 'validator must NOT use ANY(...) pattern');

  // Post-lock source reread includes owner_id authority (INNER JOIN trees).
  assert.match(validator, /SELECT m\.id, m\.tree_id, m\.parent_id, t\.owner_id AS tree_owner_id FROM memories m INNER JOIN trees t ON t\.id = m\.tree_id WHERE m\.id = %s/,
    'post-lock source reread must re-verify owner_id via tree join');
  assert.match(validator, /Access denied: not your memory/,
    'post-lock source reread must reject owner mismatch');

  // Bounded error codes.
  assert.match(validator, /INVALID_PARENT_ID/, 'bounded missing-parent code must exist');
  assert.match(validator, /PARENT_MEMORY_TREE_MISMATCH/, 'bounded cross-tree code must exist');
  const walker = functionBody(src, '_assert_no_ancestor_cycle_locked');
  assert.match(walker, /PARENT_CYCLE/, 'bounded cycle code must exist in the ancestor walker');
  assert.doesNotMatch(validator + walker, /40P01|55P03|2350[3-9]|25P02/,
    'raw PostgreSQL SQLSTATE / constraint codes must not be surfaced by the validator');
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
 * Mirrors modal_compute/memory_writes.py reparent logic for a single
 * transaction:
 *   1. reread source Memory + owning Tree to get authoritative tree_id
 *   2. acquire pg_advisory_xact_lock on tree-scoped key
 *   3. post-lock: reread source and target
 *   4. self-parent / existence / same-tree / ancestor-cycle validation
 *   5. UPDATE parent_id and COMMIT
 * Returns { committed: boolean, rejection: string|null }.
 */
async function reparentOnce(client, sourceId, targetParentId) {
  const rejection = await (async () => {
    // --- Self-parent check (no DB read needed) ---
    if (targetParentId === sourceId) return 'INVALID_PARENT_ID';

    // --- Reread source Memory + owning Tree inside transaction ---
    const { rows: sourceRows } = await client.query(
      `SELECT m.id, m.tree_id, m.parent_id, m.visibility,
              t.owner_id AS tree_owner_id
       FROM memories m
       INNER JOIN trees t ON t.id = m.tree_id
       WHERE m.id = $1
       LIMIT 1`,
      [sourceId],
    );
    if (!sourceRows.length) return 'MEMORY_NOT_FOUND';
    const authoritativeTreeId = String(sourceRows[0].tree_id);

    // --- Acquire tree-scoped advisory lock ---
    const lockKey = memoryParentAdvisoryLock(authoritativeTreeId);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // --- Post-lock: reread source and target (re-verify owner_id) ---
    const { rows: sourceRows2 } = await client.query(
      `SELECT m.id, m.tree_id, m.parent_id, t.owner_id AS tree_owner_id
       FROM memories m
       INNER JOIN trees t ON t.id = m.tree_id
       WHERE m.id = $1`,
      [sourceId],
    );
    if (!sourceRows2.length) return 'MEMORY_NOT_FOUND';
    // NOTE: the production code raises 403 here; for the concurrency test
    // we trust the fixture owner so this is a safety guard, not a regression
    // assertion. The source-contract proof validates the production path.
    if (String(sourceRows2[0].tree_owner_id) !== 'owner-1') return 'ACCESS_DENIED';

    const { rows: targetRows } = await client.query(
      'SELECT id, tree_id, parent_id FROM memories WHERE id = $1',
      [targetParentId],
    );
    if (!targetRows.length) return 'INVALID_PARENT_ID';

    // --- Same-tree check ---
    const sourceTreeId = String(sourceRows2[0].tree_id);
    if (String(targetRows[0].tree_id) !== sourceTreeId) return 'PARENT_MEMORY_TREE_MISMATCH';

    // --- Ancestor-chain walk + cycle check ---
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

    const upd = await client.query(
      'UPDATE memories SET parent_id = $2, updated_at = NOW() WHERE id = $1 AND tree_id = $3 RETURNING id',
      [sourceId, targetParentId, sourceTreeId],
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
          return await reparentOnce(client, sourceId, targetId);
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

test('PostgreSQL 17.4 different Trees derive different advisory keys and do not serialize', async () => {
  await withDisposableDb('memory_parent_cycle_diff_tree', null, async (ctx) => {
    await installFixture(ctx.client);

    const tree1 = '10000000-0000-0000-0000-000000000001';
    const tree2 = '20000000-0000-0000-0000-000000000002';
    const a1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
    const b1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
    const a2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
    const b2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

    await seedTree(ctx.client, tree1, a1, b1);
    await seedTree(ctx.client, tree2, a2, b2);

    // Verify advisory keys are different.
    const key1 = memoryParentAdvisoryLock(tree1);
    const key2 = memoryParentAdvisoryLock(tree2);
    assert.notEqual(key1, key2, 'different Trees must derive different advisory lock keys');

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
          await barrier.arrive();
          return await reparentOnce(client, sourceId, targetId);
        } finally {
          try { await client.query('ROLLBACK'); } catch { /* no-op */ }
        }
      };

      // TX1: a1.parent = b1 (tree1)   TX2: a2.parent = b2 (tree2) — different trees.
      const [r1, r2] = await Promise.all([
        run(t1, a1, b1)(),
        run(t2, a2, b2)(),
      ]);

      assert.equal(r1.committed, true, 'Tree1 reparent must commit (different lock key)');
      assert.equal(r2.committed, true, 'Tree2 reparent must commit concurrently (different lock key)');

      // Both hierarchies must be acyclic.
      const final1 = await readHierarchy(ctx.client, [a1, b1]);
      const final2 = await readHierarchy(ctx.client, [a2, b2]);
      assert.ok(isAcyclic(final1.rows), 'Tree1 final hierarchy must be acyclic');
      assert.ok(isAcyclic(final2.rows), 'Tree2 final hierarchy must be acyclic');
      assert.equal(String(final1.rows.find((r) => String(r.id) === a1).parent_id), b1,
        'Tree1 a1.parent must equal b1');
      assert.equal(String(final2.rows.find((r) => String(r.id) === a2).parent_id), b2,
        'Tree2 a2.parent must equal b2');
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
      const outcome = await reparentOnce(t1, aId, bId);
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