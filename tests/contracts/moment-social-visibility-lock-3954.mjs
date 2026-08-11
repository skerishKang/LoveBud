import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const validationSource = fs.readFileSync('modal_compute/write_validation.py', 'utf8');
const commentsSource = fs.readFileSync('modal_compute/comments.py', 'utf8');
const reactionsSource = fs.readFileSync('modal_compute/reactions.py', 'utf8');

function cursorGuardBody(source) {
  const start = source.indexOf('def require_memory_visible_or_owner_cursor(');
  assert.notEqual(start, -1, 'cursor guard must exist');
  const tail = source.slice(start);
  const nextDef = tail.indexOf('\ndef ', 4);
  return nextDef === -1 ? tail : tail.slice(0, nextDef);
}

function hasRequiredVisibilityLocks(source) {
  const guard = cursorGuardBody(source);
  return /INNER JOIN trees t ON t\.id = m\.tree_id[\s\S]*FOR SHARE OF m, t/.test(guard)
    && !/FOR KEY SHARE/.test(guard);
}

test('Moment social cursor guard locks both Memory and Tree rows with FOR SHARE', () => {
  assert.equal(hasRequiredVisibilityLocks(validationSource), true);
  const guard = cursorGuardBody(validationSource);
  assert.match(guard, /m\.visibility AS mem_visibility/);
  assert.match(guard, /t\.visibility AS tree_visibility/);
  assert.match(guard, /is_explicit_public\(row\["mem_visibility"\]\)/);
  assert.match(guard, /is_explicit_public\([\s\S]*row\["tree_visibility"\]/);
});

test('comment and reaction writes both authorize through the transaction-local locked guard', () => {
  assert.match(commentsSource, /def create_comment\([\s\S]*with conn\.cursor\(\) as cur:[\s\S]*require_memory_visible_or_owner_cursor\(cur, safe_memory_id, owner_id\)/);
  assert.match(reactionsSource, /def toggle_reaction\([\s\S]*with conn\.cursor\(\) as cur:[\s\S]*require_memory_visible_or_owner_cursor\(cur, safe_memory_id, owner_id\)/);
});

test('negative control: the pre-fix unlocked guard fails the required lock contract', () => {
  const unlocked = validationSource.replace(/\n\s*FOR SHARE OF m, t/, '');
  assert.equal(hasRequiredVisibilityLocks(unlocked), false);
});

test('negative control: FOR KEY SHARE is insufficient for visibility UPDATE serialization', () => {
  const weakLock = validationSource.replace('FOR SHARE OF m, t', 'FOR KEY SHARE OF m, t');
  assert.equal(hasRequiredVisibilityLocks(weakLock), false);
});
