const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('Modal public reads preserve parent tree visibility guards', () => {
  const publicReads = readRepoFile('modal_compute/public_reads.py');

  assert.match(publicReads, /fetch_public_memories/);
  assert.match(publicReads, /m\.visibility = 'public'/);
  assert.match(publicReads, /t\.visibility = 'public'/);
  assert.match(publicReads, /fetch_public_memory/);
  assert.match(publicReads, /fetch_public_tree/);
});

test('Modal browse summary preserves public tree and public memory count filters', () => {
  const publicReads = readRepoFile('modal_compute/public_reads.py');

  assert.match(publicReads, /fetch_latest_public_tree_snapshots/);
  assert.match(publicReads, /HAVING count\(\*\) >= 3/);
  assert.match(publicReads, /WHERE t\.visibility = 'public'/);
  assert.match(publicReads, /fetch_growing_public_tree_snapshots/);
  assert.match(publicReads, /HAVING count\(\*\) BETWEEN 1 AND 2/);
});

test('Modal owner writes preserve tree owner write boundary', () => {
  const ownerWrites = readRepoFile('modal_compute/owner_writes.py');

  assert.match(ownerWrites, /def require_tree_owner/);
  assert.match(ownerWrites, /fetch_tree_for_owner_check/);
  assert.match(ownerWrites, /tree\.get\("owner_id"\)/);
  assert.match(ownerWrites, /WHERE id = %s\n\s+AND owner_id = %s/);
  assert.match(ownerWrites, /DELETE FROM trees WHERE id = %s AND owner_id = %s/);
});

test('Modal owner writes preserve memory owner precheck and write boundary', () => {
  const ownerWrites = readRepoFile('modal_compute/owner_writes.py');

  assert.match(ownerWrites, /def require_memory_owner/);
  assert.match(ownerWrites, /t\.owner_id AS tree_owner_id/);
  assert.match(ownerWrites, /memory\.get\("tree_owner_id"\)/);
  assert.match(ownerWrites, /EXISTS \(\n\s+SELECT 1\n\s+FROM trees t\n\s+WHERE t\.id = memories\.tree_id\n\s+AND t\.owner_id = %s/);
});

test('Modal owner writes preserve private storage entitlement guard', () => {
  const ownerWrites = readRepoFile('modal_compute/owner_writes.py');
  const app = readRepoFile('modal_compute/app.py');

  assert.match(ownerWrites, /require_plus_for_private_storage\(owner_id, visibility\)/);
  assert.match(app, /PlusRequiredError/);
  assert.match(app, /PLUS_REQUIRED_PRIVATE_STORAGE/);
  assert.match(app, /upgradeRequired/);
});

test('Modal fork preserves public-only source and copied public memories', () => {
  const ownerWrites = readRepoFile('modal_compute/owner_writes.py');

  assert.match(ownerWrites, /def fork_public_tree/);
  assert.match(ownerWrites, /Only public trees can be forked/);
  assert.match(ownerWrites, /forked_from_tree_id/);
  assert.match(ownerWrites, /AND visibility = 'public'/);
  assert.match(ownerWrites, /id_map/);
  assert.match(ownerWrites, /new_parent_id/);
  assert.match(ownerWrites, /'public', NOW\(\), NOW\(\)/);
});
