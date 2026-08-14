'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'modal_compute', 'tree_writes.py'),
  'utf8'
);

function forkLockKey(sourceTreeId, ownerId) {
  const digest = crypto
    .createHash('sha256')
    .update(`tree-fork:v1:${sourceTreeId}\x1f${ownerId}`, 'utf8')
    .digest();
  return digest.readBigInt64BE(0);
}

test('#3925 fork identity lock is acquired before source visibility lock and duplicate lookup', () => {
  const start = SOURCE.indexOf('def fork_public_tree(');
  assert.notEqual(start, -1, 'fork_public_tree must exist');
  const fn = SOURCE.slice(start);

  const advisory = fn.indexOf('pg_advisory_xact_lock');
  const sourceLock = fn.indexOf('cur.execute(lock_source_query');
  const publicCheck = fn.indexOf('if str(source_tree.get("visibility") or "") != "public"');
  const duplicateLookup = fn.indexOf('cur.execute(existing_fork_query');
  const destinationInsert = fn.indexOf('cur.execute(\n                        insert_tree_query');

  assert.ok(advisory >= 0, 'fork advisory lock must remain present');
  assert.ok(sourceLock > advisory, 'source FOR SHARE read must follow fork identity serialization');
  assert.ok(publicCheck > sourceLock, 'explicit-public check must follow source lock');
  assert.ok(duplicateLookup > publicCheck, 'duplicate lookup must follow both serialization and authorization');
  assert.ok(destinationInsert > duplicateLookup, 'destination insert must follow duplicate lookup');
});

test('#3925 fork lock key is stable, tuple-scoped, and signed-bigint compatible', () => {
  const sameA = forkLockKey('tree-a', 'owner-a');
  const sameB = forkLockKey('tree-a', 'owner-a');
  const otherOwner = forkLockKey('tree-a', 'owner-b');
  const otherTree = forkLockKey('tree-b', 'owner-a');

  assert.equal(sameA, sameB, 'same source/owner tuple must serialize on the same key');
  assert.notEqual(sameA, otherOwner, 'different owners must not share the fork lock key');
  assert.notEqual(sameA, otherTree, 'different source trees must not share the fork lock key');
  assert.ok(sameA >= -(2n ** 63n) && sameA < 2n ** 63n, 'key must fit PostgreSQL bigint');
});

test('#3925 negative control: process-local hashing or unlocked duplicate check is forbidden', () => {
  assert.match(SOURCE, /hashlib\.sha256\(/, 'stable cryptographic key derivation is required');
  assert.doesNotMatch(SOURCE, /\bhash\(/, 'Python process-randomized hash() must not back DB locking');

  const start = SOURCE.indexOf('def fork_public_tree(');
  const fn = SOURCE.slice(start);
  const advisory = fn.indexOf('pg_advisory_xact_lock');
  const sourceLock = fn.indexOf('cur.execute(lock_source_query');
  const duplicateLookup = fn.indexOf('cur.execute(existing_fork_query');
  assert.ok(advisory >= 0 && advisory < sourceLock, 'source lock may not precede fork identity serialization');
  assert.ok(sourceLock < duplicateLookup, 'duplicate check must stay after source authorization boundary');
});
