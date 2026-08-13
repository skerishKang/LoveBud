'use strict';

/**
 * DB_ENGINE_EXECUTION: public Tree fork atomicity, privacy, and idempotency.
 *
 * Proves the SQL-level concurrency contract implemented by
 * modal_compute/tree_writes.py::fork_public_tree using real pg.Client
 * connections against disposable loopback PostgreSQL only.
 *
 * Reads only LB_TEST_PG* synthetic connection vars. Never reads DATABASE_URL.
 *
 * Refs: #3952, #3956, #3925, #3924, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');

const harness = require('./helpers/postgres-disposable-harness.cjs');
const { withDisposableDb, baseClientConfig } = harness;

const LOCK_SOURCE_SQL = `
  SELECT id, title, visibility
  FROM trees
  WHERE id = $1
  FOR SHARE;
`;

const DUPLICATE_CHECK_SQL = `
  SELECT id FROM trees
  WHERE owner_id = $1
    AND forked_from_tree_id = $2
  ORDER BY created_at DESC
  LIMIT 1;
`;

const INSERT_TREE_SQL = `
  INSERT INTO trees (id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at)
  VALUES ($1, $2, $3, 'public', $4, NOW(), NOW())
  RETURNING id;
`;

// #3924: the single bounded LIMIT 201 FOR SHARE snapshot is the completeness
// authority. created_at ties are broken by id so boundary membership is
// deterministic; a 201st row proves the source exceeds the supported max of
// 200 and the whole fork is rejected before any destination write.
const FETCH_SOURCE_MEMORIES_SQL = `
  SELECT id, parent_id, title, memo, artist, source, source_url, source_type,
         thumbnail, emotion_tags, timestamp, channel_id, channel_name, channel_url
  FROM memories
  WHERE tree_id = $1
    AND visibility = 'public'
  ORDER BY created_at ASC, id ASC
  LIMIT 201
  FOR SHARE;
`;

const INSERT_MEMORY_SQL = `
  INSERT INTO memories (
    id, tree_id, parent_id, title, memo, artist, source, source_url,
    source_type, thumbnail, emotion_tags, timestamp, visibility,
    channel_id, channel_name, channel_url, created_at, updated_at
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'public', $13, $14, $15, NOW(), NOW());
`;

const SCHEMA_SQL = `
  CREATE TABLE public.trees (
    id text NOT NULL PRIMARY KEY,
    owner_id text,
    title text,
    visibility text,
    forked_from_tree_id text,
    created_at timestamptz,
    updated_at timestamptz
  );
  CREATE TABLE public.memories (
    id text NOT NULL PRIMARY KEY,
    tree_id text NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
    parent_id text NULL,
    title text, memo text, artist text, source text, source_url text,
    source_type text, thumbnail text, emotion_tags jsonb, timestamp text,
    visibility text, channel_id text, channel_name text, channel_url text,
    created_at timestamptz, updated_at timestamptz
  );
`;

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function uuid() {
  return crypto.randomUUID();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function forkLockKey(sourceTreeId, ownerId) {
  const digest = crypto
    .createHash('sha256')
    .update(`tree-fork:v1:${sourceTreeId}\x1f${ownerId}`, 'utf8')
    .digest();
  const unsigned = BigInt(`0x${digest.subarray(0, 8).toString('hex')}`);
  return BigInt.asIntN(64, unsigned).toString();
}

async function countRows(client, sql, params = []) {
  const res = await client.query(sql, params);
  return Number(res.rows[0].count);
}

async function settledWithin(promise, ms) {
  let settled = false;
  promise.then(
    () => { settled = true; },
    () => { settled = true; }
  );
  await sleep(ms);
  return settled;
}

function openPeerClient(cfg, dbName) {
  return new Client({
    ...baseClientConfig(cfg, dbName),
    statement_timeout: 8000,
  });
}

async function seedSource(client, sourceId, ownerId, publicCount = 3, privateCount = 1, opts = {}) {
  await client.query(SCHEMA_SQL);
  await client.query(
    `INSERT INTO public.trees (id, owner_id, title, visibility, created_at, updated_at)
     VALUES ($1, $2, 'Source Tree', 'public', NOW(), NOW())`,
    [sourceId, ownerId]
  );
  const publicIds = [];
  const baseTs = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < publicCount; i++) {
    const id = uuid();
    publicIds.push(id);
    // Distinct per-row created_at (with a small cycle so ties exist), unless
    // opts.sameCreatedAt forces an exact tie for determinism checks.
    const created = opts.sameCreatedAt
      ? baseTs
      : new Date(baseTs.getTime() + (i % 60) * 1000);
    await client.query(
      `INSERT INTO public.memories (id, tree_id, visibility, title, created_at, updated_at)
       VALUES ($1, $2, 'public', $3, $4, NOW())`,
      [id, sourceId, `public-memory-${i}`, created]
    );
  }
  const privateId = uuid();
  for (let i = 0; i < privateCount; i++) {
    await client.query(
      `INSERT INTO public.memories (id, tree_id, visibility, title, created_at, updated_at)
       VALUES ($1, $2, 'private', $3, NOW(), NOW())`,
      [uuid(), sourceId, `private-memory-${i}`]
    );
  }
  return { publicIds, privateId };
}

async function insertMemoryCopy(client, destId, parentId, mem, forcedId = null) {
  await client.query(INSERT_MEMORY_SQL, [
    forcedId || uuid(),
    destId,
    parentId,
    mem.title,
    mem.memo,
    mem.artist,
    mem.source,
    mem.source_url,
    mem.source_type,
    mem.thumbnail,
    mem.emotion_tags,
    mem.timestamp,
    mem.channel_id,
    mem.channel_name,
    mem.channel_url,
  ]);
}

async function runSerializedFork(client, sourceId, ownerId, candidateDestId) {
  await client.query('BEGIN');
  try {
    // #3925 authority: fork-identity serialization happens before source row lock.
    await client.query(
      'SELECT pg_advisory_xact_lock($1::bigint)',
      [forkLockKey(sourceId, ownerId)]
    );

    const sourceRows = await client.query(LOCK_SOURCE_SQL, [sourceId]);
    if (sourceRows.rows.length !== 1) {
      const err = new Error('SOURCE_NOT_FOUND');
      err.code = 'SOURCE_NOT_FOUND';
      throw err;
    }
    if (sourceRows.rows[0].visibility !== 'public') {
      const err = new Error('SOURCE_NOT_PUBLIC');
      err.code = 'SOURCE_NOT_PUBLIC';
      throw err;
    }

    const dup = await client.query(DUPLICATE_CHECK_SQL, [ownerId, sourceId]);
    if (dup.rows.length) {
      await client.query('COMMIT');
      return { id: String(dup.rows[0].id), created: false, duplicate: true };
    }

    // #3924 authority: the bounded LIMIT 201 FOR SHARE snapshot is taken
    // BEFORE any destination write. More than 200 public Memories reject the
    // whole fork (zero destination rows) instead of silently copying 200.
    const memories = await client.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
    if (memories.rows.length > 200) {
      const err = new Error('FORK_SOURCE_TOO_LARGE');
      err.code = 'FORK_SOURCE_TOO_LARGE';
      throw err;
    }

    await client.query(
      INSERT_TREE_SQL,
      [candidateDestId, ownerId, 'Source Tree (복사본)', sourceId]
    );

    // Parent rewriting: a child whose parent is inside the copied snapshot
    // must point at the copied parent's new id.
    const idMap = new Map();
    for (const mem of memories.rows) {
      idMap.set(String(mem.id), uuid());
    }
    for (const mem of memories.rows) {
      const parentId = mem.parent_id ? idMap.get(String(mem.parent_id)) || null : null;
      await insertMemoryCopy(client, candidateDestId, parentId, mem, idMap.get(String(mem.id)));
    }
    await client.query('COMMIT');
    return { id: candidateDestId, created: true, duplicate: false };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

test('fork Case A: revocation-first sees private and creates zero destination rows', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_revoke_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    await seedSource(client, sourceId, 'source-owner');

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await client.query(`UPDATE public.trees SET visibility='private' WHERE id=$1`, [sourceId]);
      await assert.rejects(
        runSerializedFork(forkConn, sourceId, 'fork-owner', uuid()),
        /SOURCE_NOT_PUBLIC/
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id=$1`, [sourceId]),
        0
      );
      pass('fork Case A revocation-first');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('fork Case B: source FOR SHARE still blocks visibility revocation after advisory authority', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_visibility_lock', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-b';
    await seedSource(client, sourceId, 'source-owner');

    const forkConn = openPeerClient(cfg, dbName);
    const revokeConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await revokeConn.connect();
      await forkConn.query('BEGIN');
      await forkConn.query('SELECT pg_advisory_xact_lock($1::bigint)', [forkLockKey(sourceId, ownerId)]);
      const src = await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      assert.equal(src.rows[0].visibility, 'public');

      const revoke = revokeConn.query(`UPDATE public.trees SET visibility='private' WHERE id=$1`, [sourceId]);
      revoke.catch(() => {});
      assert.equal(await settledWithin(revoke, 700), false, 'revocation must wait on source FOR SHARE');

      const destId = uuid();
      await forkConn.query(INSERT_TREE_SQL, [destId, ownerId, 'Source Tree (복사본)', sourceId]);
      const memories = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      for (const mem of memories.rows) {
        await insertMemoryCopy(forkConn, destId, null, mem);
      }
      await forkConn.query('COMMIT');
      await revoke;

      const vis = await client.query(`SELECT visibility FROM public.trees WHERE id=$1`, [sourceId]);
      assert.equal(vis.rows[0].visibility, 'private');
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [destId]),
        3
      );
      pass('fork Case B visibility serialization');
    } finally {
      await forkConn.end().catch(() => {});
      await revokeConn.end().catch(() => {});
    }
  });
});

test('fork Case C: mid-copy failure rolls back destination tree and memories', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_rollback', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-c';
    await seedSource(client, sourceId, 'source-owner');

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const destId = uuid();
      await forkConn.query('BEGIN');
      await forkConn.query('SELECT pg_advisory_xact_lock($1::bigint)', [forkLockKey(sourceId, ownerId)]);
      await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      await forkConn.query(INSERT_TREE_SQL, [destId, ownerId, 'Source Tree (복사본)', sourceId]);
      const memories = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      const forced = uuid();
      await insertMemoryCopy(forkConn, destId, null, memories.rows[0], forced);
      await assert.rejects(
        insertMemoryCopy(forkConn, destId, null, memories.rows[1], forced),
        /duplicate key/i
      );
      await forkConn.query('ROLLBACK');

      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id=$1`, [sourceId]),
        0
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [destId]),
        0
      );
      pass('fork Case C rollback');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('fork Case D: selected public Memory FOR SHARE blocks its visibility revocation', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_memory_lock', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-d';
    const { publicIds } = await seedSource(client, sourceId, 'source-owner');

    const forkConn = openPeerClient(cfg, dbName);
    const revokeConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await revokeConn.connect();
      await forkConn.query('BEGIN');
      await forkConn.query('SELECT pg_advisory_xact_lock($1::bigint)', [forkLockKey(sourceId, ownerId)]);
      await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      const memories = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      assert.equal(memories.rows.length, 3);

      const revoke = revokeConn.query(`UPDATE public.memories SET visibility='private' WHERE id=$1`, [publicIds[0]]);
      revoke.catch(() => {});
      assert.equal(await settledWithin(revoke, 700), false, 'memory revocation must wait on FOR SHARE');

      const destId = uuid();
      await forkConn.query(INSERT_TREE_SQL, [destId, ownerId, 'Source Tree (복사본)', sourceId]);
      for (const mem of memories.rows) {
        await insertMemoryCopy(forkConn, destId, null, mem);
      }
      await forkConn.query('COMMIT');
      await revoke;

      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [destId]),
        3
      );
      pass('fork Case D memory visibility serialization');
    } finally {
      await forkConn.end().catch(() => {});
      await revokeConn.end().catch(() => {});
    }
  });
});

test('fork Case E: memory revoked first is excluded while remaining public rows copy', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_memory_revoke_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-e';
    const { publicIds } = await seedSource(client, sourceId, 'source-owner');
    await client.query(`UPDATE public.memories SET visibility='private' WHERE id=$1`, [publicIds[0]]);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, true);
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [result.id]),
        2
      );
      pass('fork Case E memory-private-first');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3925: simultaneous same-owner/source forks create one canonical destination and loser reuses it', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_idempotency_same_identity', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-f';
    await seedSource(client, sourceId, 'source-owner');

    const a = openPeerClient(cfg, dbName);
    const b = openPeerClient(cfg, dbName);
    try {
      await a.connect();
      await b.connect();

      const [ra, rb] = await Promise.all([
        runSerializedFork(a, sourceId, ownerId, uuid()),
        runSerializedFork(b, sourceId, ownerId, uuid()),
      ]);

      const created = [ra, rb].filter((r) => r.created);
      const duplicate = [ra, rb].filter((r) => r.duplicate);
      assert.equal(created.length, 1, 'exactly one request creates');
      assert.equal(duplicate.length, 1, 'exactly one request returns duplicate');
      assert.equal(created[0].id, duplicate[0].id, 'loser returns winner canonical destination');

      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE owner_id=$1 AND forked_from_tree_id=$2`, [ownerId, sourceId]),
        1,
        'only one destination Tree exists'
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [created[0].id]),
        3,
        'only one complete copied Memory set exists'
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id<>$1`, [sourceId]),
        3,
        'loser leaves no orphan/partial copied Memories'
      );
      pass('#3925 same-identity concurrency');
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
  });
});

test('#3925: different fork identities use distinct advisory keys and do not serialize', { timeout: 30000 }, async () => {
  await withDisposableDb('fork_idempotency_distinct_identity', null, async ({ cfg, dbName }) => {
    const sourceId = uuid();
    const keyA = forkLockKey(sourceId, 'owner-a');
    const keyB = forkLockKey(sourceId, 'owner-b');
    const keyC = forkLockKey(uuid(), 'owner-a');
    assert.notEqual(keyA, keyB, 'different owner changes the lock identity');
    assert.notEqual(keyA, keyC, 'different source changes the lock identity');

    const a = openPeerClient(cfg, dbName);
    const b = openPeerClient(cfg, dbName);
    try {
      await a.connect();
      await b.connect();
      await a.query('BEGIN');
      await b.query('BEGIN');
      await a.query('SELECT pg_advisory_xact_lock($1::bigint)', [keyA]);

      const otherLock = b.query('SELECT pg_advisory_xact_lock($1::bigint)', [keyB]);
      otherLock.catch(() => {});
      assert.equal(
        await settledWithin(otherLock, 700),
        true,
        'different fork identity must not wait on the first advisory lock'
      );
      await otherLock;
      await a.query('ROLLBACK');
      await b.query('ROLLBACK');
      pass('#3925 distinct-identity non-serialization');
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
  });
});

test('#3924 Case A: 199 public Memories copy in full', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_199', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-199';
    await seedSource(client, sourceId, 'source-owner', 199, 0);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, true);
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [result.id]),
        199
      );
      pass('#3924 Case A 199');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case B: exactly 200 public Memories copy in full', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_200', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-200';
    await seedSource(client, sourceId, 'source-owner', 200, 0);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, true);
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [result.id]),
        200
      );
      pass('#3924 Case B exactly 200');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case C: exactly 201 public Memories reject with zero destination rows', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_201', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-201';
    await seedSource(client, sourceId, 'source-owner', 201, 0);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await assert.rejects(
        runSerializedFork(forkConn, sourceId, ownerId, uuid()),
        /FORK_SOURCE_TOO_LARGE/
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id=$1`, [sourceId]),
        0,
        'over-limit must leave zero destination Trees'
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id<>$1`, [sourceId]),
        0,
        'over-limit must leave zero destination Memories'
      );
      pass('#3924 Case C exactly 201 reject');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case D: >201 public Memories reject with the same bounded LIMIT 201 proof', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_over', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-over';
    await seedSource(client, sourceId, 'source-owner', 205, 0);

    // The snapshot itself stays bounded: a direct query returns exactly 201
    // rows for a 205-row source, proving no unbounded fetch.
    const snapshot = await client.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
    assert.equal(snapshot.rows.length, 201, 'snapshot must remain bounded at LIMIT 201');

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await assert.rejects(
        runSerializedFork(forkConn, sourceId, ownerId, uuid()),
        /FORK_SOURCE_TOO_LARGE/
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id=$1`, [sourceId]),
        0
      );
      pass('#3924 Case D >201 bounded reject');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case E: private Memories do not count toward the limit', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_private_not_counted', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-private';
    // 200 public + 30 private must still fork successfully: only public rows count.
    await seedSource(client, sourceId, 'source-owner', 200, 30);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, true);
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [result.id]),
        200,
        'exactly the 200 public Memories copy; private ones never count or copy'
      );
      pass('#3924 Case E private excluded from count');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case F: 201 public + arbitrary private still rejects', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_201_with_private', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-201p';
    await seedSource(client, sourceId, 'source-owner', 201, 5);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await assert.rejects(
        runSerializedFork(forkConn, sourceId, ownerId, uuid()),
        /FORK_SOURCE_TOO_LARGE/
      );
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id=$1`, [sourceId]),
        0
      );
      pass('#3924 Case F 201 + private reject');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case G: same-created_at rows keep a deterministic (created_at, id) boundary', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_tie', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    await seedSource(client, sourceId, 'source-owner', 210, 0, { sameCreatedAt: true });

    const snap1 = await client.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
    const snap2 = await client.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
    assert.equal(snap1.rows.length, 201);
    assert.equal(snap2.rows.length, 201);
    assert.deepEqual(
      snap1.rows.map((r) => String(r.id)),
      snap2.rows.map((r) => String(r.id)),
      'identical tie set must produce an identical snapshot across runs'
    );
    // The full row set is ordered by (created_at, id); the snapshot must be a
    // prefix of that deterministic order, not an arbitrary 201.
    const all = await client.query(
      `SELECT id FROM public.memories WHERE tree_id=$1 AND visibility='public' ORDER BY created_at ASC, id ASC`,
      [sourceId]
    );
    assert.deepEqual(
      snap1.rows.map((r) => String(r.id)),
      all.rows.slice(0, 201).map((r) => String(r.id)),
      'LIMIT 201 must be the deterministic (created_at, id) prefix'
    );
    pass('#3924 Case G deterministic tie boundary');
  });
});

test('#3924 Case H: accepted snapshot rewrites parent ids inside the copy', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_parent_rewrite', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-parent';
    const { publicIds } = await seedSource(client, sourceId, 'source-owner', 20, 0);
    // Link memory[1] as a child of memory[0] inside the copied snapshot.
    await client.query(
      `UPDATE public.memories SET parent_id=$1 WHERE id=$2`,
      [publicIds[0], publicIds[1]]
    );

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, true);
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.memories WHERE tree_id=$1`, [result.id]),
        20
      );
      // Exactly one parent-child relation exists in the source (memory[1] is
      // the child of memory[0]); it must survive the copy with rewritten ids.
      const rel = await client.query(
        `SELECT c.parent_id AS child_parent, p.id AS parent_id
         FROM public.memories c
         JOIN public.memories p ON p.id = c.parent_id
         WHERE c.tree_id=$1`,
        [result.id]
      );
      assert.equal(rel.rows.length, 1, 'copied child must resolve to the copied parent');
      assert.equal(String(rel.rows[0].child_parent), String(rel.rows[0].parent_id));
      assert.notEqual(String(rel.rows[0].parent_id), String(publicIds[0]), 'parent id must be rewritten to a new destination id');
      pass('#3924 Case H parent rewrite integrity');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});

test('#3924 Case I: duplicate guard precedes the limit - canonical fork returned for an over-limit source', { timeout: 60000 }, async () => {
  await withDisposableDb('fork_completeness_duplicate_overlimit', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'fork-owner-dup';
    await seedSource(client, sourceId, 'source-owner', 250, 0);
    // A canonical destination already exists for this over-limit source.
    const canonicalId = uuid();
    await client.query(INSERT_TREE_SQL, [canonicalId, ownerId, 'Source Tree (복사본)', sourceId]);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      const result = await runSerializedFork(forkConn, sourceId, ownerId, uuid());
      assert.equal(result.created, false, 'must not create a second destination');
      assert.equal(result.duplicate, true, 'must return the canonical destination as duplicate');
      assert.equal(result.id, canonicalId, 'duplicate must be the canonical destination');
      assert.equal(
        await countRows(client, `SELECT count(*)::int AS count FROM public.trees WHERE owner_id=$1 AND forked_from_tree_id=$2`, [ownerId, sourceId]),
        1
      );
      pass('#3924 Case I duplicate precedes limit');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});
