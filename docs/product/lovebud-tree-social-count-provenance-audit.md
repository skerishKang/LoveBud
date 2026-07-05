# Tree Card Count Provenance Audit

- **Issue:** #3252
- **Parent:** Refs #3188
- **Reference:** Refs #1882
- **Audit baseline SHA:** `858d4261739bd5b70d67f9485a57857618825cb9`
- **Classification:** evidence-only source audit; no production data, credentials, or runtime change

---

## 1. Scope

This audit traces the provenance of the four tree-card metrics (`likeCount`, `viewCount`, `commentCount`, `shareCount`) across every present path in the codebase at the baseline SHA. Each metric is traced per path: public Browse/Search, owner/My Trees, and public tree detail.

## 2. Conclusion States

| State | Meaning |
|---|---|
| `PERSISTED` | Value read from a verified canonical DB column or aggregate table |
| `DERIVED` | Value computed at read time from an authoritative source |
| `OMITTED` | Backend intentionally does not emit the field for this path |
| `UI_DEFAULT` | Frontend renders a synthetic value (typically `0`) when no backend field exists |
| `NOT_VERIFIED` | No authoritative source found in inspected source |

## 3. Source Evidence by Metric and Path

### 3.1 likeCount

#### Path: Public Browse/Search

- **Storage / authoritative source:** `tree_social_counts.like_count` (integer, default 0)
- **Migration:** `scripts/migration-add-tree-social-counts.sql` creates `tree_social_counts(like_count INTEGER NOT NULL DEFAULT 0)`
- **Query / API path:**
  - `fetch_latest_public_tree_snapshots()` in `modal_compute/public_reads.py:199` LEFT JOINs `tree_social_counts` and selects `COALESCE(s.like_count, 0) as like_count`
  - `GET /modal/browse/latest` in `modal_compute/app.py:142` serves the result
  - Cloudflare `functions/api/[[path]].js` maps `/api/community/trees?view=summary` to `/modal/browse/latest`
- **Normalization:** `normalize_row()` in `modal_compute/validation.py:126` emits `result["likeCount"] = row.get("like_count", 0) or 0` when `include_like_count=True`
- **Client adapter:** `js/postgres-client.js` `enrichBrowseSummaryTree()` passes through `likeCount` from API response (line 86-110)
- **Renderer behavior:** `js/search/search-card-renderer.js:148` `getTreeReactionCounts()` reads `likeCount` via `getFirstFiniteCount(tree, ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count'])`
- **Unavailable/missing-value behavior:** `normalize_row` coalesces to 0; renderer fallback `getFirstFiniteCount` returns 0 for missing keys
- **Public/private visibility boundary:** Only public trees are queried (`t.visibility = 'public'`); owner_id is not selected
- **Account-scoped values reaching public output:** No — like_count is a de-identified aggregate; individual like rows (`tree_likes.owner_id`) are not exposed in Browse payloads
- **Classification:** `PERSISTED`

#### Path: Owner/My Trees

- **Storage / authoritative source:** `tree_social_counts.like_count` exists but is NOT queried by the owner-tree list route
- **Query / API path:**
  - `fetch_user_trees()` in `modal_compute/owner_reads.py:47` queries `trees LEFT JOIN memories` only; no JOIN to `tree_social_counts`
  - `GET /modal/private/trees` in `modal_compute/app.py:291` serves the result
- **Normalization:** `normalize_tree_row()` in `modal_compute/validation.py:96` does NOT emit `likeCount`
- **Client adapter:** `js/postgres-client.js` `createTreeApi().getTrees()` calls `/trees` and returns raw
- **Renderer behavior:** `js/my-trees/my-trees-ui.js:54` `getTreeLikeCount(tree)` returns `Number(tree.likeCount || tree.likes || 0)` — always 0 because the field is absent from the API payload
- **Unavailable/missing-value behavior:** Renders `0` via the `|| 0` fallback
- **Public/private visibility boundary:** Owner-scoped; no public leak
- **Account-scoped values reaching public output:** N/A (private endpoint)
- **Classification:** `UI_DEFAULT`

#### Path: Public Tree Detail

- **Storage / authoritative source:** `tree_social_counts.like_count`
- **Query / API path:**
  - `fetch_public_tree()` in `modal_compute/public_reads.py:712` does NOT include like_count
  - `GET /modal/trees/{tree_id}` in `modal_compute/app.py:235` calls `fetch_public_tree()` then appends `tree["likeCount"] = fetch_public_tree_like_count(safe_tree_id)` (line 251)
  - `fetch_public_tree_like_count()` in `modal_compute/tree_likes.py:121` reads from `tree_social_counts.like_count` with public-visibility guard; returns 0 when table missing
- **Normalization:** `normalize_tree_row()` produces base tree; likeCount is attached post-normalization
- **Client adapter:** `js/postgres-client.js` `getPublicTree()` or `getTree()` returns the API payload with `likeCount`
- **Renderer behavior:** Viewer social summary renders the like count
- **Unavailable/missing-value behavior:** `fetch_public_tree_like_count` returns `0` when `tree_social_counts` table doesn't exist (pre-migration env); `0` is indistinguishable from a genuine persisted zero
- **Public/private visibility boundary:** Only public trees served (`fetch_public_tree_like_count` checks visibility); no owner_id exposed
- **Account-scoped values reaching public output:** No — only the aggregate count
- **Classification:** `PERSISTED` (with caveat: pre-migration env falls back to synthetic 0 indistinguishable from true zero)

---

### 3.2 viewCount

#### Path: Public Browse/Search

- **Storage / authoritative source:** `tree_social_counts.view_count` (integer, default 0)
- **Migration:** Same `tree_social_counts` table; `view_count` column added by `scripts/migration-add-tree-social-counts.sql`
- **Query / API path:** Same as likeCount — `fetch_latest_public_tree_snapshots()` selects `COALESCE(s.view_count, 0) as view_count`
- **Normalization:** `normalize_row()` in `modal_compute/validation.py:126` conditionally emits `viewCount` only when `vc is not None` (line 158-160): *"viewCount is included only when the DB row has a real value. Missing key, None, or social-count source unavailable means we cannot truthfully report a count — omit the field"*
- **Client adapter:** `js/postgres-client.js` `enrichBrowseSummaryTree()` does NOT explicitly pass `viewCount`; it relies on the spread of `rawTree` into the result object
- **Renderer behavior:** `js/search/search-card-renderer.js:149` `getTreeReactionCounts()` reads `views` via `shared.getViewCount(tree)`; `js/search/search-share-link.js:103` uses `utils.getViewCount(tree)` which returns `null` when field absent
- **Unavailable/missing-value behavior:** `normalize_row` omits the key entirely when `view_count` is None; `search-share-link.js` shows `—` dash when `viewCount` is `null`; search card renderer falls back to 0 via `getFirstFiniteCount`
- **Public/private visibility boundary:** Public trees only; no owner_id in payload
- **Account-scoped values reaching public output:** No
- **Classification:** `PERSISTED` (conditional emission: omitted when no real value exists; this is the only metric that truthfully distinguishes unavailable from zero)

#### Path: Owner/My Trees

- **Storage / authoritative source:** `tree_social_counts.view_count` exists but NOT queried by owner-tree list
- **Query / API path:** `fetch_user_trees()` does not JOIN `tree_social_counts`; no viewCount in payload
- **Normalization:** `normalize_tree_row()` does NOT emit `viewCount`
- **Renderer behavior:** `js/my-trees/my-trees-ui.js:47` `getTreeViewCount(tree)` returns `Number(tree.totalViewCount || tree.viewCount || 0)` — always 0
- **Unavailable/missing-value behavior:** Renders `0` via `|| 0`
- **Public/private visibility boundary:** Owner-scoped; no public leak
- **Classification:** `UI_DEFAULT`

#### Path: Public Tree Detail

- **Storage / authoritative source:** `tree_social_counts.view_count`
- **Query / API path:**
  - `GET /modal/trees/{tree_id}` in `modal_compute/app.py:252` appends `tree["viewCount"] = fetch_public_tree_view_count(safe_tree_id)`
  - `fetch_public_tree_view_count()` in `modal_compute/tree_views.py:127` reads from `tree_social_counts.view_count`; returns 0 when table or column missing
- **Normalization:** Post-fetch attachment; not part of `normalize_tree_row`
- **Renderer behavior:** Viewer renders the view count
- **Unavailable/missing-value behavior:** Returns `0` when table/column doesn't exist — indistinguishable from genuine persisted zero
- **Public/private visibility boundary:** Public trees only; no owner_id exposed
- **Classification:** `PERSISTED` (with same pre-migration zero-ambiguity caveat as likeCount)

---

### 3.3 commentCount

#### Path: Public Browse/Search

- **Storage / authoritative source:** No `comment_count` column exists in `tree_social_counts`. The `comments` table is memory-level (`comments.memory_id`), not tree-level. No migration creates a tree-level `comment_count`.
- **Query / API path:** `fetch_latest_public_tree_snapshots()` does not query comments; `normalize_row()` does NOT emit `commentCount`
- **Client adapter:** `js/postgres-client.js` `enrichBrowseSummaryTree()` does not include `commentCount`
- **Renderer behavior:**
  - `js/search/search-card-renderer.js:150` `getTreeReactionCounts()` reads `comments: getFirstFiniteCount(tree, ['commentCount', 'commentsCount', 'comments', 'comment_count'])` — returns 0 when no key present
  - `js/search/search-share-link.js:105` `resolveSocialCount(tree, ['commentCount', ...])` returns `null` when no valid key found; renders `—` dash
- **Unavailable/missing-value behavior:** Search card renderer displays `0`; share-link shell displays `—` (information-absent marker). The `0` on the card is a UI_DEFAULT, not a verified zero.
- **Public/private visibility boundary:** N/A — no data flows
- **Account-scoped values reaching public output:** No comment data reaches Browse cards
- **Classification:** `NOT_VERIFIED` (no canonical tree-level source exists; card `0` is `UI_DEFAULT`)

#### Path: Owner/My Trees

- **Storage / authoritative source:** Same — no tree-level comment_count exists
- **Query / API path:** `fetch_user_trees()` returns no commentCount
- **Normalization:** `normalize_tree_row()` does NOT emit `commentCount`
- **Renderer behavior:** `js/my-trees/my-trees-ui.js:356` `var commentCount = Number(normalizedTree.commentCount || normalizedTree.comment_count || 0)` — always 0
- **Preview hub:** `js/my-trees/my-trees-preview-hub.js:530` `commentEl.textContent = String(tree.commentCount || tree.comment_count || 0)` — always 0
- **Unavailable/missing-value behavior:** Always renders `0`
- **Classification:** `UI_DEFAULT` (no backend source; `|| 0` produces synthetic zero)

#### Path: Public Tree Detail

- **Storage / authoritative source:** No tree-level comment_count in `tree_social_counts`
- **Query / API path:** `GET /modal/trees/{tree_id}` does not attach any commentCount
- **Renderer behavior:** `js/viewer/public-viewer-read-only-social-summary.js:163` computes `commentCount: validComments.length` by fetching per-memory public comments at runtime — this is a DERIVED count from moment-level comments, not a persisted tree-level count
- **Unavailable/missing-value behavior:** Returns 0 when no comments found on any public memory
- **Public/private visibility boundary:** Only public memory comments are counted
- **Classification:** `NOT_VERIFIED` (no persisted tree-level source; viewer derives from moment-level comments at read time)

---

### 3.4 shareCount

#### Path: Public Browse/Search

- **Storage / authoritative source:** No `share_count` column exists in `tree_social_counts`. No migration creates a tree-level `share_count`. No database table tracks tree shares.
- **Query / API path:** `fetch_latest_public_tree_snapshots()` does not query shares; `normalize_row()` does NOT emit `shareCount`
- **Client adapter:** `enrichBrowseSummaryTree()` does not include `shareCount`
- **Renderer behavior:**
  - `js/search/search-card-renderer.js:151` `shares: getFirstFiniteCount(tree, ['shareCount', 'sharesCount', 'shares', 'share_count'])` — returns 0
  - `js/search/search-share-link.js` does NOT render a share count — only a share button
- **Unavailable/missing-value behavior:** Card renders `0`; no share count in share-link shell
- **Public/private visibility boundary:** N/A
- **Account-scoped values reaching public output:** No
- **Classification:** `NOT_VERIFIED` (no canonical source exists; card `0` is `UI_DEFAULT`)

#### Path: Owner/My Trees

- **Storage / authoritative source:** None
- **Query / API path:** `fetch_user_trees()` returns no shareCount
- **Renderer behavior:** `js/my-trees/my-trees-ui.js:358` `var shareCount = Number(normalizedTree.shareCount || normalizedTree.share_count || 0)` — always 0
- **Unavailable/missing-value behavior:** Always renders `0`
- **Classification:** `UI_DEFAULT`

#### Path: Public Tree Detail

- **Storage / authoritative source:** None
- **Query / API path:** No shareCount attached by `GET /modal/trees/{tree_id}`
- **Renderer behavior:** Viewer social summary does not render share count; share-link renders a share button only
- **Unavailable/missing-value behavior:** No count displayed
- **Classification:** `OMITTED`

---

## 4. Classification Summary Table

| Metric | Browse/Search | Owner/My Trees | Public Tree Detail |
|--------|--------------|----------------|-------------------|
| likeCount | `PERSISTED` | `UI_DEFAULT` | `PERSISTED` |
| viewCount | `PERSISTED` (conditional emission) | `UI_DEFAULT` | `PERSISTED` |
| commentCount | `NOT_VERIFIED` (card `0` is `UI_DEFAULT`) | `UI_DEFAULT` | `NOT_VERIFIED` (derived from moment-level comments) |
| shareCount | `NOT_VERIFIED` (card `0` is `UI_DEFAULT`) | `UI_DEFAULT` | `OMITTED` |

## 5. Key Findings

1. **likeCount and viewCount have verified canonical runtime sources.** Both are persisted in `tree_social_counts` and correctly read for public Browse and public tree detail. The owner/My Trees list route does not include them, causing `UI_DEFAULT` zeros.

2. **commentCount has no verified canonical runtime source for any path.** The `comments` table is memory-level (`comments.memory_id FK → memories.id`). No `comment_count` column exists in `tree_social_counts`. No migration creates one. The Browse card `0` and My Trees card `0` are both synthetic `UI_DEFAULT` values produced by `|| 0` fallback patterns. The viewer's `commentCount` is derived by counting moment-level comments at read time — not a persisted tree-level aggregate.

3. **shareCount has no verified canonical runtime source for any path.** No `share_count` column exists in `tree_social_counts`. No database table tracks tree shares at all. The Browse card `0` and My Trees card `0` are `UI_DEFAULT`. Public tree detail omits shareCount entirely.

4. **No existing card display can truthfully distinguish unavailable from zero for commentCount or shareCount.** The `|| 0` pattern in `my-trees-ui.js:356-358` and `getFirstFiniteCount` in `search-card-renderer.js:129-135` both produce `0` for absent data. Only `viewCount` in Browse normalization (`normalize_row` lines 158-160) conditionally omits the key to signal unavailability, and `search-share-link.js` `resolveSocialCount` returns `null` and renders `—`.

5. **The `viewCount` conditional-omission pattern in `normalize_row` is the only existing mechanism that correctly distinguishes unavailable from persisted zero.** All other metric/path combinations conflate the two states.

## 6. Conclusions

### 6.1 Does commentCount have a verified canonical runtime source?

**No.** For all three paths (Browse/Search, My Trees, public tree detail), there is no persisted tree-level `comment_count`. The `comments` table is keyed by `memory_id`, not `tree_id`. Deriving a tree-level comment count by summing per-memory comment counts across all public memories of a tree would be a DERIVED computation, not a persisted canonical value. No such derivation exists in the current backend for Browse or My Trees paths. The viewer performs a runtime derivation from moment-level comments.

### 6.2 Does shareCount have a verified canonical runtime source?

**No.** No database table or column stores tree-level share counts. No share-tracking mechanism exists in the codebase.

### 6.3 Can any existing card display truthfully distinguish unavailable from zero?

**Only for viewCount on the Browse path** (via `normalize_row` conditional omission and `search-share-link.js` null-aware rendering). All other metric/path combinations render `0` for both genuinely-persisted-zero and data-unavailable, making them indistinguishable.

## 7. Recommended Next Child Slice

**Add `comment_count` column to `tree_social_counts` and wire a read-only tree-level comment-count aggregate.**

Scope:
- Migration: `ALTER TABLE tree_social_counts ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0)`
- Backend read: `fetch_public_tree_comment_count()` in a new or existing module, mirroring `fetch_public_tree_like_count` / `fetch_public_tree_view_count` — read-only, no write path
- Wire to `GET /modal/trees/{tree_id}` (public tree detail) post-fetch attachment
- Wire to `normalize_row` with conditional emission (matching the `viewCount` pattern from line 158-160)
- Do NOT add comment-write aggregation, share-count work, or UI feature changes
- Remain read-only and readiness-first; no combination with tree-like writes, tree comments writes, or UI feature work

This slice is the minimal read-only foundation that makes `commentCount` a `PERSISTED` metric on the same footing as `likeCount` and `viewCount`, without introducing writes or UI changes.

---

*Audit complete. No runtime files, test files, or configuration files were modified.*
