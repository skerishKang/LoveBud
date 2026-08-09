const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REACTIONS_PY = path.join(ROOT, 'modal_compute', 'reactions.py');

function reactionSummaryBlock(content) {
  const start = content.indexOf('def _compute_reaction_summary(');
  const end = content.indexOf('\ndef _make_reaction_dto(', start);
  assert.notEqual(start, -1, '_compute_reaction_summary must exist');
  assert.notEqual(end, -1, '_compute_reaction_summary block must be bounded');
  return content.slice(start, end);
}

test('#3941 authenticated reaction summary aggregates in SQL', () => {
  const content = fs.readFileSync(REACTIONS_PY, 'utf8');
  const block = reactionSummaryBlock(content);

  assert.match(block, /COUNT\(\*\)::int AS count/);
  assert.match(block, /BOOL_OR\(owner_id = %s\) AS requester_active/);
  assert.match(block, /GROUP BY type/);
  assert.match(block, /ORDER BY type/);
  assert.doesNotMatch(block, /SELECT\s+id,\s*memory_id,\s*owner_id,\s*type,\s*created_at/);
});

test('#3941 fetch path keeps canonical visibility guard and bounded helper', () => {
  const content = fs.readFileSync(REACTIONS_PY, 'utf8');
  const start = content.indexOf('def fetch_reaction_summary(');
  assert.notEqual(start, -1, 'fetch_reaction_summary must exist');
  const block = content.slice(start);

  assert.match(block, /require_memory_visible_or_owner\(safe_memory_id, owner_id\)/);
  assert.match(block, /_compute_reaction_summary\(cur, safe_memory_id, owner_id\)/);
  assert.doesNotMatch(block, /SELECT\s+id,\s*memory_id,\s*owner_id,\s*type,\s*created_at/);
  assert.doesNotMatch(block, /str\(r\["owner_id"\]\)\s*==\s*owner_id/);
});
