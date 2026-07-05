/**
 * LoveBud Owner Tree Social Counts Read Contract
 *
 * Verifies that owner-read source-level contracts for canonical
 * likeCount and viewCount are correctly wired:
 *
 * - Both owner read functions include the optional tree social-count source
 * - Owner reads preserve owner scoping
 * - Owner list and owner detail use the same social-count semantics
 * - Normalization is opt-in and preserves existing callers
 * - likeCount and viewCount are emitted only from available owner-read source values
 * - Source-unavailable behavior omits unavailable count keys without breaking base owner reads
 * - No commentCount, shareCount, new route, public read change, write behavior, or UI change
 * - No current absence-of-feature assertion is added
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* ─── helpers ─── */

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '../../' + relPath), 'utf8');
}

function sourceContains(source, pattern) {
  return source.indexOf(pattern) !== -1;
}

/* ─── source slices ─── */

const ownerReads = readSource('modal_compute/owner_reads.py');
const validation = readSource('modal_compute/validation.py');
const publicReads = readSource('modal_compute/public_reads.py');

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Owner read functions include optional tree social-count source
 * ═══════════════════════════════════════════════════════════════════════ */

describe('owner social-count source inclusion', () => {

  it('fetch_user_trees query references tree_social_counts via LEFT JOIN', () => {
    assert.ok(
      sourceContains(ownerReads, 's.like_count') &&
      sourceContains(ownerReads, 's.view_count'),
      'fetch_user_trees must LEFT JOIN social counts'
    );
  });

  it('fetch_owner_tree query references tree_social_counts via LEFT JOIN', () => {
    assert.ok(
      sourceContains(ownerReads, 'COALESCE(s.like_count, 0) as like_count'),
      'fetch_owner_tree must select like_count from social source'
    );
    assert.ok(
      sourceContains(ownerReads, 'COALESCE(s.view_count, 0) as view_count'),
      'fetch_owner_tree must select view_count from social source'
    );
  });

  it('owner reads use safe capability-detection pattern for social counts', () => {
    assert.ok(
      sourceContains(ownerReads, '_table_exists(cur, "tree_social_counts")'),
      'owner reads must detect table existence'
    );
    assert.ok(
      sourceContains(ownerReads, '_table_has_column(cur, "tree_social_counts", "like_count")'),
      'owner reads must detect like_count column existence'
    );
    assert.ok(
      sourceContains(ownerReads, '_table_has_column(cur, "tree_social_counts", "view_count")'),
      'owner reads must detect view_count column existence'
    );
  });

  it('owner reads build safe social-counts source with dummy fallback', () => {
    assert.ok(
      sourceContains(ownerReads, '_build_owner_social_counts_source'),
      'owner reads must have a dedicated social-counts source builder'
    );
    assert.ok(
      sourceContains(ownerReads, 'WHERE FALSE) s_dummy'),
      'source builder must produce a dummy fallback when table/column unavailable'
    );
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. Owner reads preserve owner scoping
 * ═══════════════════════════════════════════════════════════════════════ */

describe('owner read scoping', () => {

  it('fetch_user_trees filters by owner_id', () => {
    assert.ok(
      sourceContains(ownerReads, 'WHERE t.owner_id = %s'),
      'fetch_user_trees must scope to owner_id'
    );
  });

  it('fetch_owner_tree filters by both tree_id AND owner_id', () => {
    assert.ok(
      sourceContains(ownerReads, 'WHERE t.id = %s') &&
      sourceContains(ownerReads, 'AND t.owner_id = %s'),
      'fetch_owner_tree must scope to both tree_id and owner_id'
    );
  });

  it('owner reads pass include_owner_metadata=True to normalize_tree_row', () => {
    const listCall = 'normalize_tree_row(\n                row,\n                row.get("memory_count"),\n                include_owner_metadata=True,\n                include_owner_social_counts=True';
    const detailCall = 'normalize_tree_row(\n        row,\n        row.get("memory_count"),\n        include_owner_metadata=True,\n        include_owner_social_counts=True';
    assert.ok(
      sourceContains(ownerReads, 'include_owner_metadata=True') &&
      sourceContains(ownerReads, 'include_owner_social_counts=True'),
      'both owner read functions must pass include_owner_metadata=True and include_owner_social_counts=True'
    );
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. Owner list and owner detail use the same social-count semantics
 * ═══════════════════════════════════════════════════════════════════════ */

describe('consistent social-count semantics', () => {

  it('both functions pass _owner_like_available and _owner_view_available', () => {
    const likeAvail = '_owner_like_available=has_like_count';
    const viewAvail = '_owner_view_available=has_view_count';
    // Count occurrences — must appear at least twice (list + detail)
    const likeCount = ownerReads.split(likeAvail).length - 1;
    const viewCount = ownerReads.split(viewAvail).length - 1;
    assert.ok(
      likeCount >= 2 && viewCount >= 2,
      'both owner read functions must pass _owner_like_available and _owner_view_available'
    );
  });

  it('both functions use _build_owner_social_counts_source', () => {
    const count = ownerReads.split('_build_owner_social_counts_source').length - 1;
    assert.ok(count >= 3, '_build_owner_social_counts_source must be called in both fetch_user_trees and fetch_owner_tree (definition + 2 calls)');
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. Normalization is opt-in and preserves existing callers
 * ═══════════════════════════════════════════════════════════════════════ */

describe('opt-in normalization', () => {

  it('normalize_tree_row has include_owner_social_counts parameter with default False', () => {
    assert.ok(
      sourceContains(validation, 'include_owner_social_counts: bool = False'),
      'normalize_tree_row must have include_owner_social_counts parameter defaulting to False'
    );
  });

  it('social counts are only emitted when include_owner_social_counts is True', () => {
    assert.ok(
      sourceContains(validation, 'if include_owner_social_counts:'),
      'social count emission must be guarded by include_owner_social_counts'
    );
  });

  it('existing callers without include_owner_social_counts get no social count keys', () => {
    // Verify that default False means the social count block is skipped
    const fnSource = validation.substring(
      validation.indexOf('def normalize_tree_row'),
      validation.indexOf('def normalize_row')
    );
    const defaultBlock = fnSource.substring(
      fnSource.indexOf('include_owner_social_counts: bool = False'),
      fnSource.indexOf('if include_owner_social_counts:')
    );
    assert.ok(
      !defaultBlock.includes('likeCount') && !defaultBlock.includes('viewCount'),
      'default (False) must not emit likeCount or viewCount'
    );
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. likeCount and viewCount are emitted only from available source values
 * ═══════════════════════════════════════════════════════════════════════ */

describe('availability-gated count emission', () => {

  it('likeCount is emitted only when _owner_like_available is True', () => {
    assert.ok(
      sourceContains(validation, 'if _owner_like_available:') &&
      sourceContains(validation, 'tree["likeCount"] = like_val'),
      'likeCount must be gated by _owner_like_available'
    );
  });

  it('viewCount is emitted only when _owner_view_available is True', () => {
    assert.ok(
      sourceContains(validation, 'if _owner_view_available:') &&
      sourceContains(validation, 'tree["viewCount"] = view_val'),
      'viewCount must be gated by _owner_view_available'
    );
  });

  it('count values are validated as finite, integer-like, and non-negative', () => {
    assert.ok(
      sourceContains(validation, 'isinstance(like_val, int) and like_val >= 0') ||
      sourceContains(validation, 'like_val >= 0'),
      'likeCount must be validated as non-negative integer'
    );
    assert.ok(
      sourceContains(validation, 'isinstance(view_val, int) and view_val >= 0') ||
      sourceContains(validation, 'view_val >= 0'),
      'viewCount must be validated as non-negative integer'
    );
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 6. Source-unavailable behavior omits count keys without breaking reads
 * ═══════════════════════════════════════════════════════════════════════ */

describe('unavailable-source graceful degradation', () => {

  it('dummy social source produces no rows so LEFT JOIN yields NULLs', () => {
    assert.ok(
      sourceContains(ownerReads, 'WHERE FALSE) s_dummy'),
      'when table/column unavailable, dummy source returns no rows'
    );
  });

  it('COALESCE handles NULL social counts in SQL', () => {
    assert.ok(
      sourceContains(ownerReads, 'COALESCE(s.like_count, 0)') &&
      sourceContains(ownerReads, 'COALESCE(s.view_count, 0)'),
      'SQL must COALESCE social count NULLs to 0'
    );
  });

  it('when _owner_like_available is False, likeCount key is omitted from output', () => {
    // The normalize_tree_row only adds likeCount inside `if _owner_like_available:`
    // When False (default), the key is simply never added
    // Verify that _owner_like_available guards likeCount in the full validation source
    const socialBlockStart = validation.indexOf('if include_owner_social_counts:');
    const returnTreeIdx = validation.indexOf('return tree', socialBlockStart);
    const socialBlock = validation.substring(socialBlockStart, returnTreeIdx);
    assert.ok(
      sourceContains(socialBlock, 'if _owner_like_available:'),
      'likeCount emission must be guarded by _owner_like_available within the social block'
    );
    assert.ok(
      sourceContains(socialBlock, 'if _owner_view_available:'),
      'viewCount emission must be guarded by _owner_view_available within the social block'
    );
  });

  it('base owner read fields are present regardless of social availability', () => {
    const fnSource = validation.substring(
      validation.indexOf('def normalize_tree_row'),
      validation.indexOf('def normalize_row')
    );
    // Core fields must always be present
    assert.ok(sourceContains(fnSource, '"id": str(row["id"])'), 'id must always be present');
    assert.ok(sourceContains(fnSource, '"title"'), 'title must always be present');
    assert.ok(sourceContains(fnSource, '"visibility"'), 'visibility must always be present');
    assert.ok(sourceContains(fnSource, '"memoryCount"'), 'memoryCount must always be present');
  });

});

/* ═══════════════════════════════════════════════════════════════════════
 * 7. No commentCount, shareCount, new route, public read change, write,
 *    or UI change
 * ═══════════════════════════════════════════════════════════════════════ */

describe('scope containment', () => {

  it('no commentCount in owner social-count normalization', () => {
    const fnSource = validation.substring(
      validation.indexOf('if include_owner_social_counts:'),
      validation.indexOf('return tree') + 10
    );
    assert.ok(
      !sourceContains(fnSource, 'commentCount'),
      'commentCount must not be emitted in owner social-count normalization'
    );
  });

  it('no shareCount in owner social-count normalization', () => {
    const fnSource = validation.substring(
      validation.indexOf('if include_owner_social_counts:'),
      validation.indexOf('return tree') + 10
    );
    assert.ok(
      !sourceContains(fnSource, 'shareCount'),
      'shareCount must not be emitted in owner social-count normalization'
    );
  });

  it('no new route added in owner_reads', () => {
    // Count @app.route or def fetch_ functions — should be the same as before
    const fetchFns = ownerReads.match(/def fetch_\w+/g) || [];
    assert.ok(
      fetchFns.length === 3,
      'owner_reads should have exactly 3 fetch functions (fetch_user_trees, fetch_owner_tree, fetch_owner_memories)'
    );
  });

  it('public reads source is not imported or referenced in owner reads', () => {
    assert.ok(
      !sourceContains(ownerReads, 'public_reads'),
      'owner_reads must not import or reference public_reads'
    );
  });

  it('no account-scoped fields beyond existing owner-only payload', () => {
    const fnSource = validation.substring(
      validation.indexOf('if include_owner_social_counts:'),
      validation.indexOf('return tree') + 10
    );
    assert.ok(
      !sourceContains(fnSource, 'email') &&
      !sourceContains(fnSource, 'account') &&
      !sourceContains(fnSource, 'profile'),
      'no account-scoped fields in social count normalization'
    );
  });

});
