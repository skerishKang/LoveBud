const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const publicReads = fs.readFileSync(path.join(ROOT, 'modal_compute', 'public_reads.py'), 'utf8');

test('Tolerate missing tree_social_counts dynamically inside fetch_latest_public_tree_snapshots', () => {
  // 1. helper 또는 source selector가 table 없음 / like-only / view-only / complete의 4개 source를 구분함
  assert.match(
    publicReads,
    /def _build_social_counts_source\(\s*has_table:\s*bool,\s*has_like_count:\s*bool,\s*has_view_count:\s*bool,\s*\)/
  );

  // 2. like-only source는 실제 like_count를 읽고 view_count는 literal 0
  assert.match(
    publicReads,
    /has_like_count\s+and\s+not\s+has_view_count:[\s\S]*?SELECT\s+tree_id(::text)?\s+as\s+tree_id,\s+like_count,\s+0\s+as\s+view_count\s+FROM\s+tree_social_counts/
  );

  // 3. view-only source는 실제 view_count를 읽고 like_count는 literal 0
  assert.match(
    publicReads,
    /not\s+has_like_count\s+and\s+has_view_count:[\s\S]*?SELECT\s+tree_id(::text)?\s+as\s+tree_id,\s+0\s+as\s+like_count,\s+view_count\s+FROM\s+tree_social_counts/
  );

  // table 없음 또는 두 column 모두 없을 때
  assert.match(
    publicReads,
    /not\s+has_table\s+or\s+\(\s*not\s+has_like_count\s+and\s+not\s+has_view_count\s*\):[\s\S]*?SELECT\s+NULL::text\s+as\s+tree_id,\s+0\s+as\s+like_count,\s+0\s+as\s+view_count\s+WHERE\s+FALSE/
  );

  // 4. likes fallback은 has_like_count_column 부재에만 반응
  assert.match(
    publicReads,
    /if\s+sort\s*==\s*["']likes["']\s+and\s+not\s*\(\s*has_social_counts_table\s+and\s+has_like_count_column\s*\):[\s\S]*?effective_order_clause\s*=\s*["']t\.created_at\s+DESC["']/
  );

  // 5. views fallback은 has_view_count_column 부재에만 반응
  assert.match(
    publicReads,
    /elif\s+sort\s*==\s*["']views["']\s+and\s+not\s*\(\s*has_social_counts_table\s+and\s+has_view_count_column\s*\):[\s\S]*?effective_order_clause\s*=\s*["']t\.created_at\s+DESC["']/
  );

  // 6. latest/popular이 incomplete social schema에서 여전히 실행 가능한 source를 사용함
  assert.match(
    publicReads,
    /social_counts_source\s*=\s*_build_social_counts_source\(\s*has_social_counts_table,\s*has_like_count_column,\s*has_view_count_column,\s*\)/
  );

  // 7. tree_social_counts table 부재 시 생성되는 SQL에 raw FROM tree_social_counts가 남지 않음
  // (modern_query_template uses FROM {social_counts_source})
  assert.match(
    publicReads,
    /FROM\s+\{\s*social_counts_source\s*\}/
  );

  // 8. public payload privacy 경계는 유지 (no ownerId, UID, token, or private field)
  assert.doesNotMatch(publicReads, /"ownerId"/);
  assert.doesNotMatch(publicReads, /"UID"/);
  assert.doesNotMatch(publicReads, /"token"/);
});
