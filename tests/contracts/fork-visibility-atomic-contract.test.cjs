'use strict';

/**
 * Source contract: public Tree fork atomicity vs visibility revocation (#3952).
 *
 * Reads modal_compute/tree_writes.py and asserts that fork_public_tree()
 * authorizes the source tree INSIDE its own transaction via SELECT ... FOR
 * SHARE (not via the pre-transaction fetch_tree_for_owner_check DTO), so a
 * concurrent public -> private revocation can never land between the
 * authorization read and the durable copy. Also guards against the weakened
 * FOR KEY SHARE and table-level LOCK alternatives.
 *
 * Static source read only. No network / DB / browser / deployment.
 *
 * Refs: #3952, #3924, #3925, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TREE_WRITES_PATH = path.join(ROOT, 'modal_compute', 'tree_writes.py');

const source = fs.readFileSync(TREE_WRITES_PATH, 'utf8');

function forkBlock() {
  const parts = source.split('def fork_public_tree');
  assert.ok(parts.length >= 2, 'fork_public_tree must be defined in tree_writes.py');
  return parts[1].split('\ndef ')[0];
}

test('fork authorizes the source inside the transaction with FOR SHARE', () => {
  const block = forkBlock();
  assert.match(block, /FOR SHARE/, 'fork must lock the source row with FOR SHARE');
  assert.match(
    block,
    /SELECT id, title, visibility\s+FROM trees\s+WHERE id = %s\s+FOR SHARE/,
    'source read must carry id/title/visibility with FOR SHARE'
  );
});

test('fork does not rely on a pre-transaction fetch_tree_for_owner_check DTO', () => {
  const block = forkBlock();
  assert.doesNotMatch(block, /fetch_tree_for_owner_check/, 'fork must not pre-check via fetch_tree_for_owner_check');
  assert.doesNotMatch(block, /run_db_with_retry/, 'fork must not route the duplicate check through run_db_with_retry');
});

test('fork never weakens the lock or uses a table-level LOCK', () => {
  const block = forkBlock();
  // The source code may explain why the weaker lock is not used; what matters
  // is that no actual `FOR KEY SHARE;` statement is issued.
  assert.doesNotMatch(block, /FOR KEY SHARE\s*;/, 'FOR KEY SHARE is forbidden: it does not conflict with a visibility UPDATE');
  assert.doesNotMatch(block, /LOCK TABLE/, 'table-level LOCK is forbidden');
});

test('fork authorizes before any destination write and keeps public-only copy', () => {
  const block = forkBlock();
  // SQL query constants are declared above the control flow, so the ordering
  // gate uses the execution site (the destination INSERT call), which must
  // follow the leak-safe 403 authorization branch.
  const authIdx = block.indexOf('Only public trees can be forked');
  const destExecIdx = block.indexOf('# 5. Destination tree insert happens only after authorization.');
  assert.ok(authIdx >= 0, 'leak-safe 403 detail must remain');
  assert.ok(destExecIdx >= 0, 'destination tree INSERT execution site must exist');
  assert.match(block, /insert_tree_query/, 'destination tree INSERT must exist');
  assert.ok(
    authIdx < destExecIdx,
    'source public authorization must precede the destination tree INSERT'
  );
  assert.match(block, /AND visibility = 'public'/, 'only public source memories may be copied');
  assert.match(block, /parent_id/, 'parent_id rewriting must be preserved');
  assert.match(block, /conn\.rollback/, 'failed forks must roll back (no partial destination)');
});

test('fork locks the copied public memory rows with FOR SHARE (#3956)', () => {
  const block = forkBlock();
  // Isolate the source-memory SELECT query (declared between the destination
  // tree INSERT and the memory INSERT) and require a row lock on the selected
  // public rows.
  const memBlock = block.split('FROM memories')[1].split('INSERT INTO memories')[0];
  assert.ok(memBlock, 'source memory SELECT must exist in the fork');
  assert.match(memBlock, /AND visibility = 'public'/, 'private memories must remain excluded');
  assert.match(memBlock, /LIMIT 200/, '#3924 200-row boundary must remain untouched');
  assert.match(memBlock, /FOR SHARE;/, 'selected public memory rows must be locked FOR SHARE');
});
