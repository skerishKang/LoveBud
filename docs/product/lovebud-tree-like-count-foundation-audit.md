# LoveBud Tree Like Count Foundation Audit

## Status
- Refs: #2422, #1661
- Scope: audit/assessment only
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none

This document audits whether the current tree-level like count foundation is sufficient as a prerequisite for `sort=likes` implementation, per the Browse tree social counts plan sequence (Unit A → Unit B → Unit C → Unit D).

## Executive Summary

**Verdict: Foundation is SUFFICIENT for `sort=likes` implementation.**

All critical prerequisite checks pass. The tree-level like count infrastructure exists, is tree-level (not memory-level), properly separates from memory reactions, enforces public tree boundary, handles pre-migration fallbacks, and prevents duplicate likes.

## Detailed Checklist

### 1. Public detail `likeCount` is tree-level ✅

**Evidence:**
- `modal_compute/app.py:220` — `tree["likeCount"] = fetch_public_tree_like_count(safe_tree_id)`
- `modal_compute/tree_likes.py:121-153` — `fetch_public_tree_like_count()` reads from `tree_social_counts.like_count` (tree-level aggregate)
- Contract test `tree-like-api-boundary-contract.test.cjs:56-57` verifies read from `tree_social_counts` table

**Conclusion:** Public detail exposes tree-level like count, not memory-level reaction aggregate.

### 2. `likeCount` reads from `tree_social_counts.like_count` ✅

**Evidence:**
- Migration `scripts/migration-add-tree-social-counts.sql:31-36` creates `tree_social_counts` with `like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0)`
- `tree_likes.py:138-147` — SQL `SELECT like_count FROM tree_social_counts WHERE tree_id = %s`
- `tree_likes.py:77-88` — `_fetch_like_count()` reads from same table
- Contract test verifies `FROM tree_social_counts` pattern

**Conclusion:** Single authoritative source exists.

### 3. Memory-level reactions and tree-level likes are separated ✅

**Schema separation:**
- `reactions` table: memory-level, per-memory, multiple types (see `reactions.py:30-48`)
- `tree_likes` table: tree-level, per-tree, single like per owner (migration lines 14-25)
- `tree_social_counts` table: aggregates both `like_count` and `view_count` (migration lines 31-36)

**Code separation:**
- `reactions.py` handles `toggle_reaction`, `fetch_reaction_counts`, `fetch_reaction_summary` — all use `memory_id`
- `tree_likes.py` handles `toggle_tree_like`, `fetch_tree_like_summary`, `fetch_public_tree_like_count` — all use `tree_id`
- Contract test `tree-like-api-boundary-contract.test.cjs:28-33` explicitly asserts no `FROM reactions` or `memory_id` in tree_likes code

**Conclusion:** Clean separation maintained. No code path conflates the two.

### 4. Private/missing tree `likeCount` does not leak via public route ✅

**Public detail endpoint (`app.py:204-228`):**
- Calls `fetch_public_tree()` which enforces `visibility = 'public'` (or `is_public = true`)
- Returns 404 if tree not found or not public (line 217-219)

**Read helper (`tree_likes.py:91-118`):**
- `_fetch_public_tree_for_like_count()` queries with `visibility = 'public'` or `is_public = %s` (True)
- `fetch_public_tree_like_count()` returns `None` if tree not public, raising 404

**Contract test verifies:**
- `tree-like-api-boundary-contract.test.cjs:62-73` — public read validates `visibility = 'public'`, returns 404 for private
- Cloudflare route `functions/api/trees/[tree_id]/likes.js` requires Authorization (private only)

**Conclusion:** Private trees return 404 on public detail read; no engagement data leaks.

### 5. Missing aggregate row returns 0 ✅

**Evidence:**
- `tree_likes.py:135-136` — `if not _table_exists(cur, "tree_social_counts"): return {"like_count": 0}`
- `tree_likes.py:147-148` — `int(row.get("like_count") or 0)` handles NULL
- `tree_social_counts` migration: `like_count INTEGER NOT NULL DEFAULT 0`

**Conclusion:** Safe zero fallback for pre-migration environments.

### 6. Pre-migration table/column missing is safe ✅

**Table missing:** Handled by `_table_exists(cur, "tree_social_counts")` check (returns 0)

**Column missing:** NOT explicitly checked in `fetch_public_tree_like_count()` — but `tree_social_counts` always includes `like_count` column (migration line 33 creates it with `DEFAULT 0`). Since the table and column were created together, column-only missing is impossible without manual schema tampering.

**Risk assessment:** LOW. The migration creates `tree_social_counts` with `like_count` column as a unit. If table exists, column exists.

### 7. `toggle_tree_like` prevents repeated likes per user/tree ✅

**Evidence:**
- Migration line 23-25: `CREATE UNIQUE INDEX ... ON tree_likes(tree_id, owner_id) WHERE deleted_at IS NULL` — enforces one active like per account per tree
- `tree_likes.py:190-202` — queries for existing active like: `WHERE tree_id = %s AND owner_id = %s AND deleted_at IS NULL LIMIT 1`
- Toggle logic: if exists → set `deleted_at = NOW()` (soft delete), decrement count; else insert new
- `GREATEST(like_count - 1, 0)` prevents negative counts

**Conclusion:** Database-level uniqueness + application logic prevents duplicate active likes.

### 8. Blocker assessment for `sort=likes` implementation

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| Tree-level like count exists | ✅ | `tree_social_counts.like_count` |
| Public detail read exists | ✅ | `GET /modal/trees/{tree_id}` returns `likeCount` |
| Aggregate read helper exists | ✅ | `fetch_public_tree_like_count()` |
| Index for sort ordering exists | ✅ | `idx_tree_social_counts_like_count (like_count DESC, updated_at DESC)` |
| Private tree boundary enforced | ✅ | 404 on public read |
| Pre-migration safe | ✅ | Table missing → 0 |
| Browse summary unchanged | ✅ | Contract test: no `likeCount` in browse snapshot |
| `sort=likes` not implemented | ✅ | Catch-all falls back to `latest` |

**Remaining work for `sort=likes` (Unit C):**
1. Add `sort=likes` to catch-all route (`functions/api/[[path]].js`)
2. Implement browse latest/growing queries with `ORDER BY like_count DESC`
3. Add `likeCount` to browse summary payload (public card)
4. Update Browse UI with `좋아요순` label (Unit D)

**No blockers identified.** All Unit A foundation is complete.

## Related Documents

- `lovebud-browse-tree-social-counts-plan.md` — Original plan (Unit A likes before Unit B views)
- `lovebud-public-tree-detail-viewcount-read-boundary.md` — View count boundary (parallel read exposure)
- `migration-add-tree-social-counts.sql` — Schema foundation
- `tree-like-api-boundary-contract.test.cjs` — Existing contract coverage

## Conclusion

The tree-level like count foundation (Unit A) is **complete and sufficient** for proceeding to Unit C (`sort=likes` implementation). All 8 audit checkpoints pass with no critical gaps.

The implementation correctly:
- Uses tree-level aggregate (`tree_social_counts.like_count`)
- Separates from memory-level reactions
- Enforces public tree boundary
- Provides safe pre-migration fallbacks
- Prevents duplicate likes via database constraint + application logic
- Exposes `likeCount` only on public detail (not Browse summary)
- Does not enable `sort=likes` or UI labels prematurely