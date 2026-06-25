const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const publicReads = fs.readFileSync(path.join(ROOT, 'modal_compute', 'public_reads.py'), 'utf8');

test('Tolerate missing tree_social_counts dynamically inside fetch_latest_public_tree_snapshots', () => {
  // Verify that has_like_count_column is defined safely using has_social_counts_table guard
  assert.match(
    publicReads,
    /has_like_count_column\s*=\s*_table_has_column\(cur,\s*["']tree_social_counts["'],\s*["']like_count["']\)\s+if\s+has_social_counts_table\s+else\s+False/
  );
  
  // Verify that the query replaces FROM tree_social_counts dynamically to dummy values when missing
  assert.match(
    publicReads,
    /if\s+not\s+\(\s*has_social_counts_table\s+and\s+has_like_count_column\s+and\s+has_view_count_column\s*\):/
  );
  assert.match(
    publicReads,
    /modern_query\s*=\s*modern_query\.replace\(/
  );
  assert.match(
    publicReads,
    /["']FROM tree_social_counts["']/
  );
  assert.match(
    publicReads,
    /["']FROM \(SELECT NULL::uuid as tree_id, 0 as like_count, 0 as view_count WHERE FALSE\) s_dummy["']/
  );
});
