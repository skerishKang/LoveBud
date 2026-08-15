'use strict';

/**
 * Source contract: public Tree fork completeness vs silent truncation (#3924).
 *
 * Reads modal_compute/tree_writes.py and asserts that fork_public_tree()
 * snapshots public source Memories with a single bounded
 * `ORDER BY created_at ASC, id ASC LIMIT 201 FOR SHARE` read BEFORE any
 * destination write. 200 supported rows copy in full; a 201st row is the
 * bounded proof that the source exceeds the supported max, and the fork is
 * rejected with 409 FORK_SOURCE_TOO_LARGE before the destination Tree INSERT
 * (no silent truncation, no partial fork, no COUNT(*) preflight, no unbounded
 * fetch). Also guards the #3925/#3952/#3956 ordering: advisory lock before
 * source FOR SHARE, and a single transaction connection.
 *
 * Static source read only. No network / DB / browser / deployment.
 *
 * Refs: #3924, #3925, #3952, #3956, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'modal_compute', 'tree_writes.py'),
  'utf8'
);

function forkBlock() {
  const start = SOURCE.indexOf('def fork_public_tree(');
  assert.notEqual(start, -1, 'fork_public_tree must exist');
  return SOURCE.slice(start);
}

test('#3924 source snapshot is a single bounded deterministic LIMIT 201 FOR SHARE read', () => {
  const block = forkBlock();
  const memBlock = block.split('FROM memories')[1].split('INSERT INTO memories')[0];
  assert.ok(memBlock, 'source Memory SELECT must exist in the fork');
  assert.match(memBlock, /ORDER BY created_at ASC, id ASC/, 'created_at ties must be broken by id for a deterministic boundary');
  assert.match(memBlock, /LIMIT 201/, 'bounded LIMIT 201 snapshot is required');
  assert.match(memBlock, /FOR SHARE;/, 'selected public Memory rows must stay locked FOR SHARE');
  assert.doesNotMatch(block, /LIMIT\s+200/, 'the old truncating LIMIT 200 must not be restored');
  assert.doesNotMatch(memBlock, /COUNT\s*\(\s*\*\s*\)/, 'COUNT(*) preflight is forbidden');
});

test('#3924 snapshot and over-limit rejection both precede the destination INSERT', () => {
  const block = forkBlock();
  const snapshotExec = block.indexOf('cur.execute(fetch_source_memories_query');
  const overLimit = block.indexOf('FORK_SOURCE_TOO_LARGE');
  const destInsert = block.indexOf('cur.execute(\n                        insert_tree_query');

  assert.ok(snapshotExec >= 0, 'bounded snapshot execution must exist');
  assert.ok(overLimit >= 0, 'over-limit rejection branch must exist');
  assert.ok(destInsert >= 0, 'destination Tree INSERT execution site must exist');
  assert.ok(snapshotExec < destInsert, 'Memory snapshot must precede the destination INSERT');
  assert.ok(overLimit < destInsert, 'over-limit rejection must precede the destination INSERT');
});

test('#3924 over-limit failure is a stable machine-identifiable 409 with supportedMax 200', () => {
  const block = forkBlock();
  assert.match(block, /status_code=409/, 'over-limit must use HTTP 409');
  assert.match(block, /"code": "FORK_SOURCE_TOO_LARGE"/, 'stable machine-identifiable error code required');
  assert.match(block, /"supportedMax": 200/, 'supported max 200 must be machine-identifiable');
});

test('#3924 no unbounded copy and no separate-connection preflight', () => {
  const block = forkBlock();
  const memBlock = block.split('FROM memories')[1].split('INSERT INTO memories')[0];
  assert.doesNotMatch(memBlock, /LIMIT\s*(?!201)\d+/, 'only the LIMIT 201 bound is allowed on the source Memory snapshot');
  // The whole fork must run on the single transaction connection.
  assert.equal(
    (block.match(/get_db_connection\(\)/g) || []).length,
    1,
    'fork must use exactly one DB connection (no separate preflight connection)'
  );
});

test('#3925/#3952 ordering is preserved under the #3924 snapshot reorder', () => {
  const block = forkBlock();
  const advisory = block.indexOf('pg_advisory_xact_lock');
  const sourceLock = block.indexOf('cur.execute(lock_source_query');
  const publicCheck = block.indexOf('if str(source_tree.get("visibility") or "") != "public"');
  const duplicateLookup = block.indexOf('cur.execute(existing_fork_query');
  const snapshotExec = block.indexOf('cur.execute(fetch_source_memories_query');

  assert.ok(advisory >= 0 && advisory < sourceLock, 'advisory lock must precede the source FOR SHARE lock');
  assert.ok(sourceLock < publicCheck, 'source lock must precede explicit-public authorization');
  assert.ok(publicCheck < duplicateLookup, 'authorization must precede the duplicate lookup');
  assert.ok(duplicateLookup < snapshotExec, 'duplicate lookup must precede the Memory snapshot (duplicate wins without any snapshot)');
});
