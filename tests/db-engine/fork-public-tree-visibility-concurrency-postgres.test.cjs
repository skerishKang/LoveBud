'use strict';

/**
 * DB_ENGINE_EXECUTION: public Tree fork atomicity vs visibility revocation.
 *
 * Proves the SQL-level concurrency contract implemented by
 * modal_compute/tree_writes.py::fork_public_tree (#3952) using two real
 * pg.Client connections against one disposable loopback database:
 *
 *   Case A (revocation-first): a public -> private UPDATE commits before the
 *     fork transaction begins; the fork's FOR SHARE source read observes
 *     `private` and the fork aborts with zero destination rows.
 *
 *   Case B (fork-lock-first):  the fork transaction locks the source row with
 *     SELECT ... FOR SHARE and copies; a concurrent public -> private UPDATE
 *     blocks on that lock until the fork commits, then proceeds. The outcome is
 *     deterministic by transaction ordering — never a stale pre-check.
 *
 *   Case C (failure rollback): a mid-copy failure inside the fork transaction
 *     rolls back the destination tree AND the copied memories (no partial fork).
 *
 *   Case D (memory fork-lock-first, #3956): the fork transaction reads AND
 *     locks the selected public source memory rows with FOR SHARE; a concurrent
 *     memory-level public -> private UPDATE blocks until the fork commits, so a
 *     memory cannot flip private after being read and still end up in a durable
 *     public destination copy.
 *
 *   Case E (memory private-first, #3956): a memory revoked before the fork's
 *     read is excluded by the WHERE clause; remaining public memories copy fine.
 *
 * The fork SQL below mirrors tree_writes.py::fork_public_tree exactly; keep it
 * in sync if that function changes.
 *
 * Reads only LB_TEST_PG* synthetic connection vars (loopback). Never reads
 * DATABASE_URL / Neon / secrets / production hosts.
 *
 * Refs: #3956, #3952, #3924, #3925, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');

const harness = require('./helpers/postgres-disposable-harness.cjs');

const { withDisposableDb, baseClientConfig } = harness;

// ─── Fork SQL (mirrors modal_compute/tree_writes.py::fork_public_tree) ───────

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

const FETCH_SOURCE_MEMORIES_SQL = `
  SELECT id, parent_id, title, memo, artist, source, source_url, source_type,
         thumbnail, emotion_tags, timestamp, channel_id, channel_name, channel_url
  FROM memories
  WHERE tree_id = $1
    AND visibility = 'public'
  ORDER BY created_at ASC
  LIMIT 200
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function uuid() {
  return crypto.randomUUID();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function seedSource(client, sourceId, ownerId) {
  await client.query(SCHEMA_SQL);
  await client.query(
    `INSERT INTO public.trees (id, owner_id, title, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, 'public', NOW(), NOW())`,
    [sourceId, ownerId, 'Source Tree']
  );
  const publicIds = [];
  for (let i = 0; i < 3; i++) {
    const memId = uuid();
    publicIds.push(memId);
    await client.query(
      `INSERT INTO public.memories (id, tree_id, visibility, title, created_at, updated_at)
       VALUES ($1, $2, 'public', $3, NOW(), NOW())`,
      [memId, sourceId, `public-memory-${i}`]
    );
  }
  const privateId = uuid();
  await client.query(
    `INSERT INTO public.memories (id, tree_id, visibility, title, created_at, updated_at)
     VALUES ($1, $2, 'private', $3, NOW(), NOW())`,
    [privateId, sourceId, 'private-memory']
  );
  return { publicIds, privateId };
}

async function countRows(client, sql, params) {
  const res = await client.query(sql, params);
  return Number(res.rows[0].count);
}

async function insertMemoryCopy(client, destId, parentId, mem) {
  await client.query(INSERT_MEMORY_SQL, [
    uuid(),
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

/**
 * Wait up to `ms` and report whether `promise` settled (resolved or rejected).
 * A no-op rejection handler is attached to avoid unhandled-rejection noise
 * while the promise is deliberately still pending.
 */
async function settledWithin(promise, ms) {
  let settled = false;
  promise.then(
    () => { settled = true; },
    () => { settled = true; }
  );
  await sleep(ms);
  return settled;
}

/**
 * Open a second/third connection to the same disposable DB with a bounded
 * statement timeout so a wrongly-blocked lock cannot hang the suite.
 */
function openPeerClient(cfg, dbName) {
  return new Client({
    ...baseClientConfig(cfg, dbName),
    statement_timeout: 8000,
  });
}

// ─── Case A: revocation commits first → fork observes private, no destination ─

test('fork Case A: revocation-first — fork sees private and creates zero destination rows', { timeout: 30000 }, async () => {
  await withDisposableDb('caseA_revoke_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'owner-a';
    await seedSource(client, sourceId, ownerId);

    const forkConn = openPeerClient(cfg, dbName);
    const revokerConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await revokerConn.connect();

      // Revocation commits before the fork transaction starts.
      await revokerConn.query(
        `UPDATE public.trees SET visibility = 'private' WHERE id = $1`,
        [sourceId]
      );

      // Fork begins afterwards: FOR SHARE read must observe `private`.
      await forkConn.query('BEGIN');
      const sourceRows = await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      assert.equal(sourceRows.rows.length, 1, 'source row must exist');
      assert.equal(
        sourceRows.rows[0].visibility,
        'private',
        'fork must observe the already-revoked visibility (no stale precheck)'
      );
      await forkConn.query('ROLLBACK');

      // Destination must be empty.
      const destTrees = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id = $1`,
        [sourceId]
      );
      const destMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id <> $1`,
        [sourceId]
      );
      assert.equal(destTrees, 0, 'no destination tree after revoked fork');
      assert.equal(destMemories, 0, 'no destination memories after revoked fork');

      // Source tree + its own memories are untouched.
      const srcVisibility = await client.query(
        `SELECT visibility FROM public.trees WHERE id = $1`,
        [sourceId]
      );
      assert.equal(srcVisibility.rows[0].visibility, 'private');
      const srcMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id = $1`,
        [sourceId]
      );
      assert.equal(srcMemories, 4, 'source keeps its own 3 public + 1 private memories');
      pass('fork Case A revocation-first');
    } finally {
      await forkConn.end().catch(() => {});
      await revokerConn.end().catch(() => {});
    }
  });
});

// ─── Case B: fork lock wins → revocation blocks until the fork commits ───────

test('fork Case B: fork-lock-first — revocation blocks until fork commits', { timeout: 30000 }, async () => {
  await withDisposableDb('caseB_fork_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'owner-b';
    await seedSource(client, sourceId, ownerId);

    const forkConn = openPeerClient(cfg, dbName);
    const revokerConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await revokerConn.connect();

      // Fork transaction locks the source row FOR SHARE.
      await forkConn.query('BEGIN');
      const sourceRows = await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      assert.equal(sourceRows.rows.length, 1);
      assert.equal(sourceRows.rows[0].visibility, 'public');

      // Concurrent public -> private UPDATE must block on the FOR SHARE lock.
      const revokePromise = revokerConn.query(
        `UPDATE public.trees SET visibility = 'private' WHERE id = $1`,
        [sourceId]
      );
      revokePromise.catch(() => {}); // bound; result awaited below
      const blocked = await settledWithin(revokePromise, 700);
      assert.equal(blocked, false, 'visibility UPDATE must block while fork holds FOR SHARE');

      // Fork completes its copy and commits.
      const destId = uuid();
      const dupRows = await forkConn.query(DUPLICATE_CHECK_SQL, ['owner-b', sourceId]);
      assert.equal(dupRows.rows.length, 0, 'no prior fork for this owner');
      await forkConn.query(INSERT_TREE_SQL, [destId, 'owner-b', 'Source Tree (복사본)', sourceId]);
      const memRows = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      assert.equal(memRows.rows.length, 3, 'only public source memories are copied (private excluded)');
      for (const mem of memRows.rows) {
        await insertMemoryCopy(forkConn, destId, null, mem);
      }
      await forkConn.query('COMMIT');

      // After the fork commits, the blocked revocation proceeds and commits.
      const revokeOutcome = await Promise.race([
        revokePromise.then(() => 'committed'),
        sleep(6000).then(() => 'TIMEOUT'),
      ]);
      assert.equal(revokeOutcome, 'committed', 'revocation must complete after fork commits (no deadlock)');

      // Deterministic end state: fork exists, only public memories copied,
      // source is now private.
      const destTrees = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id = $1`,
        [sourceId]
      );
      assert.equal(destTrees, 1, 'fork destination tree exists');
      const destMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id = $1`,
        [destId]
      );
      assert.equal(destMemories, 3, 'fork holds exactly the 3 public memories');
      const srcVisibility = await client.query(
        `SELECT visibility FROM public.trees WHERE id = $1`,
        [sourceId]
      );
      assert.equal(srcVisibility.rows[0].visibility, 'private', 'revocation applied after fork commit');
      pass('fork Case B fork-lock-first');
    } finally {
      await forkConn.end().catch(() => {});
      await revokerConn.end().catch(() => {});
    }
  });
});

// ─── Case D (#3956): fork locks public memory rows — memory visibility UPDATE ─
// ─── blocks until the fork commits ────────────────────────────────────────────

test('fork memory Case D: fork-lock-first — memory visibility UPDATE blocks until fork commits', { timeout: 30000 }, async () => {
  await withDisposableDb('caseD_mem_fork_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'owner-d';
    const { publicIds } = await seedSource(client, sourceId, ownerId);
    const memM = publicIds[0];

    const forkConn = openPeerClient(cfg, dbName);
    const revokerConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();
      await revokerConn.connect();

      // Fork transaction locks the source tree and reads the public memories.
      await forkConn.query('BEGIN');
      await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      const memRows = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      assert.equal(memRows.rows.length, 3, 'three public memories selected');

      // Concurrent memory public -> private UPDATE must block on the memory
      // row lock held by the fork's read (FOR SHARE after the #3956 fix).
      const revokePromise = revokerConn.query(
        `UPDATE public.memories SET visibility = 'private' WHERE id = $1`,
        [memM]
      );
      revokePromise.catch(() => {}); // bound; result awaited below
      const blocked = await settledWithin(revokePromise, 700);
      assert.equal(
        blocked,
        false,
        'memory visibility UPDATE must block while fork holds memory FOR SHARE'
      );

      // Fork completes the copy and commits.
      const destId = uuid();
      await forkConn.query(INSERT_TREE_SQL, [destId, ownerId, 'Source Tree (복사본)', sourceId]);
      for (const mem of memRows.rows) {
        await insertMemoryCopy(forkConn, destId, null, mem);
      }
      await forkConn.query('COMMIT');

      // After the fork commits, the blocked memory revocation proceeds.
      const revokeOutcome = await Promise.race([
        revokePromise.then(() => 'committed'),
        sleep(6000).then(() => 'TIMEOUT'),
      ]);
      assert.equal(revokeOutcome, 'committed', 'memory revocation must complete after fork commits (no deadlock)');

      // Deterministic end state: the fork durably holds the memory that was
      // public at lock time; the source memory is now private.
      const destMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id = $1`,
        [destId]
      );
      assert.equal(destMemories, 3, 'fork copied the memories public at lock time');
      const srcMemVis = await client.query(
        `SELECT visibility FROM public.memories WHERE id = $1`,
        [memM]
      );
      assert.equal(srcMemVis.rows[0].visibility, 'private', 'source memory revoked after fork commit');
      pass('fork memory Case D fork-lock-first');
    } finally {
      await forkConn.end().catch(() => {});
      await revokerConn.end().catch(() => {});
    }
  });
});

// ─── Case E (#3956): memory private-first — revoked memory excluded, others copied ─

test('fork memory Case E: memory-private-first — revoked memory excluded, other public memories copied', { timeout: 30000 }, async () => {
  await withDisposableDb('caseE_mem_revoke_first', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'owner-e';
    const { publicIds } = await seedSource(client, sourceId, ownerId);
    const memM = publicIds[0];

    const revokerConn = openPeerClient(cfg, dbName);
    const forkConn = openPeerClient(cfg, dbName);
    try {
      await revokerConn.connect();
      await forkConn.connect();

      // Memory revocation commits before the fork reads memories.
      await revokerConn.query(
        `UPDATE public.memories SET visibility = 'private' WHERE id = $1`,
        [memM]
      );

      await forkConn.query('BEGIN');
      await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      const memRows = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      assert.equal(memRows.rows.length, 2, 'revoked memory is excluded at read time');
      const destId = uuid();
      await forkConn.query(INSERT_TREE_SQL, [destId, ownerId, 'Source Tree (복사본)', sourceId]);
      for (const mem of memRows.rows) {
        await insertMemoryCopy(forkConn, destId, null, mem);
      }
      await forkConn.query('COMMIT');

      const destMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id = $1`,
        [destId]
      );
      assert.equal(destMemories, 2, 'only the remaining public memories are copied');
      const srcMemVis = await client.query(
        `SELECT visibility FROM public.memories WHERE id = $1`,
        [memM]
      );
      assert.equal(srcMemVis.rows[0].visibility, 'private');
      pass('fork memory Case E memory-private-first');
    } finally {
      await revokerConn.end().catch(() => {});
      await forkConn.end().catch(() => {});
    }
  });
});

// ─── Case C: mid-copy failure rolls back — no partial destination ────────────

test('fork Case C: mid-copy failure rolls back destination tree and memories', { timeout: 30000 }, async () => {
  await withDisposableDb('caseC_rollback', null, async ({ cfg, client, dbName }) => {
    const sourceId = uuid();
    const ownerId = 'owner-c';
    await seedSource(client, sourceId, ownerId);

    const forkConn = openPeerClient(cfg, dbName);
    try {
      await forkConn.connect();

      await forkConn.query('BEGIN');
      await forkConn.query(LOCK_SOURCE_SQL, [sourceId]);
      const destId = uuid();
      await forkConn.query(INSERT_TREE_SQL, [destId, 'owner-c', 'Source Tree (복사본)', sourceId]);
      const memRows = await forkConn.query(FETCH_SOURCE_MEMORIES_SQL, [sourceId]);
      assert.ok(memRows.rows.length >= 1, 'public memories exist to copy');

      // Insert one copied memory, then force a duplicate-PK failure mid-copy.
      const dupMemId = uuid();
      await forkConn.query(INSERT_MEMORY_SQL, [
        dupMemId, destId, null, 'copy-1', null, null, null, null, null, null, null, null,
        null, null, null,
      ]);
      await assert.rejects(
        forkConn.query(INSERT_MEMORY_SQL, [
          dupMemId, destId, null, 'copy-2', null, null, null, null, null, null, null, null,
          null, null, null,
        ]),
        /duplicate key/i,
        'duplicate PK insert must fail'
      );
      await forkConn.query('ROLLBACK');

      // No partial destination may survive.
      const destTrees = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.trees WHERE forked_from_tree_id = $1`,
        [sourceId]
      );
      assert.equal(destTrees, 0, 'destination tree must be rolled back');
      const destMemories = await countRows(
        client,
        `SELECT count(*)::int AS count FROM public.memories WHERE tree_id = $1`,
        [destId]
      );
      assert.equal(destMemories, 0, 'destination memories must be rolled back');
      pass('fork Case C rollback no partial destination');
    } finally {
      await forkConn.end().catch(() => {});
    }
  });
});
