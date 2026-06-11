# Browse sort=views backend readiness audit

- Refs: #1661, #2429, #2420, #2426
- Parent epic: #1661 — Browse/Search social counts (latest / popular / likes / views)
- Slice: planning/audit only (no runtime behavior change, no schema migration, no API/UI change)
- Audit date: 2026-06-12
- Audited branch baseline: `main` after PR #2421 (viewCount public detail) and PR #2424 (sort=likes backend) merges
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none

## Goal

Confirm whether the codebase is **ready** to implement `sort=views` as a runtime
Browse/Search sort, or whether any **prerequisite** is still missing. The audit
is intentionally read-only: it inspects code, schema, and contracts already
landed on `main` and reports a per-requirement verdict.

This audit does **not**:

- Change runtime behavior
- Change database schema
- Enable `sort=views` anywhere
- Add `viewCount` to the Browse/Search summary payload
- Touch the Browse UI labels (`최신순` / `조회순` / `좋아요순`)

`sort=views` remains unsupported in the router, the modal endpoint, and the
SQL ordering path. The audit exists so a future `api/browse-sort-views-backend`
runtime slice can be planned with the right prerequisites in hand.

## Unit C scope reminder

`sort=views` is part of the Unit C "Browse sort API support" slice defined in
`docs/product/lovebud-browse-tree-social-counts-plan.md`. The plan says:

> Add `sort=views` only after `viewCount` exists.

The audit checks whether every prerequisite for that statement is now satisfied.

## Audit verdict (top-line)

| # | Requirement | Verdict |
|---|---|---|
| 1 | `viewCount` exists in storage for public trees | ✅ Ready |
| 2 | Public read of `viewCount` for a public tree exists (narrow endpoint) | ✅ Ready |
| 3 | Router `sort` parameter currently rejects `views` and falls back to `latest` | ✅ Ready |
| 4 | Modal endpoint `sort` validation rejects `views` and falls back to `latest` | ✅ Ready |
| 5 | `tree_social_counts` has a `view_count DESC, updated_at DESC` index | ✅ Ready |
| 6 | Private tree reads do not leak `viewCount` to public callers | ✅ Ready |
| 7 | No raw IP / user-agent / fingerprint / referrer / header in view tracking | ✅ Ready |
| 8 | Browse/Search summary payload does not yet expose `viewCount` | ✅ Ready |
| 9 | Browse UI labels do not yet include `조회순` | ✅ Ready |
| 10 | `sort=likes` is already enabled without breaking the contract surface | ✅ Reference only |

**Top-line**: No audit blocker. The runtime slice is feasible. Two scope-discipline
guardrails must be carried into the next slice verbatim — see
`Hard scope boundaries for the next slice` below.

## Requirement-by-requirement evidence

### 1. `viewCount` exists in storage for public trees

**Status**: ✅ Ready.

- Migration: `scripts/migration-add-tree-social-counts.sql` creates
  `tree_social_counts(tree_id PK, like_count, view_count, updated_at)` with
  non-negative `CHECK` constraints on both counts.
- Increment path: `modal_compute/tree_views.py` `record_public_tree_view()`
  uses `SET view_count = view_count + 1` after the dedup write succeeds.
- Read path: `modal_compute/tree_views.py` `fetch_public_tree_view_count()`
  selects `view_count` from `tree_social_counts`.
- Safe fallback: both `_table_exists` and `_table_has_column` checks
  return `0` when storage is missing, so pre-migration environments are
  safe.

### 2. Public read of `viewCount` for a public tree exists (narrow endpoint)

**Status**: ✅ Ready (already merged in PR #2421).

- Route: `GET /modal/trees/{tree_id}` in `modal_compute/app.py` adds
  `tree["viewCount"] = fetch_public_tree_view_count(safe_tree_id)`.
- Helper: `fetch_public_tree_view_count(tree_id)` enforces
  `visibility = 'public'` (modern schema) or `is_public = true` (legacy)
  and returns 404 (treated as missing) for private trees.
- Boundary decision: `docs/product/lovebud-public-tree-detail-viewcount-read-boundary.md`
  locks the rule that only the narrow public detail endpoint may expose
  `viewCount`; Browse/Search summary must not.

### 3. Router `sort` parameter currently rejects `views` and falls back to `latest`

**Status**: ✅ Ready.

- `functions/api/[[path]].js` builds the cache URL with a ternary
  `'popular' ? 'popular' : ... === 'likes' ? 'likes' : 'latest'`.
  Any value other than `popular` or `likes` falls back to `latest`,
  so `views` (and any other unknown value) is rejected.
- Contract: `tests/contracts/tree-view-api-boundary-contract.test.cjs`,
  `browse-tree-view-count-policy-contract.test.cjs`,
  `browse-sort-likes-backend-contract.test.cjs`,
  `public-tree-view-event-wiring-contract.test.cjs`, and
  `public-tree-detail-viewcount-read-boundary-contract.test.cjs`
  all assert the router does not match `sort'\) === 'views'`.

### 4. Modal endpoint `sort` validation rejects `views` and falls back to `latest`

**Status**: ✅ Ready.

- `modal_compute/app.py` `get_latest_browse_snapshot` uses
  `safe_sort = sort if sort in {"latest", "popular", "likes"} else "latest"`.
  `views` is not in the allow set, so it falls back to `latest`.
- `fetch_latest_public_tree_snapshots` defaults `order_clause` to
  `t.created_at DESC` and only switches to `popular` (memory_count) or
  `likes` (like_count) branches. There is no `views` branch.
- Contract: `tests/contracts/modal-public-read-routes-contract.test.cjs`
  asserts the safe-sort set and the lack of a `views` branch.

### 5. `tree_social_counts` has a `view_count DESC, updated_at DESC` index

**Status**: ✅ Ready.

- `scripts/migration-add-tree-social-counts.sql` creates
  `idx_tree_social_counts_view_count ON tree_social_counts(view_count DESC, updated_at DESC)`.
- This is the same shape used for `idx_tree_social_counts_like_count`, so the
  index plan is symmetric and the future `ORDER BY s.view_count DESC, ...`
  path will hit the index.
- Note: the **runtime SQL for `sort=views`** is not yet written. The index
  exists; the planner can use it once the query is added.

### 6. Private tree reads do not leak `viewCount` to public callers

**Status**: ✅ Ready.

- `modal_compute/tree_views.py` `_fetch_public_tree_for_view_count()` checks
  `visibility = 'public'` (modern) or `is_public = true` (legacy) before
  returning a row. A private tree yields no row, which the caller treats
  as "view not found" (returns 0, not exposed).
- `fetch_public_tree()` (the public detail helper) filters to
  `t.visibility = 'public'` / `WHERE visibility = 'public'`, so the
  caller-side 404 prevents the `viewCount` lookup from ever running.
- `modal_compute/tree_likes.py` already enforces the analogous private-tree
  boundary for `likeCount`; the same pattern is reused.
- Contract: `tests/contracts/public-tree-detail-viewcount-read-boundary-contract.test.cjs`
  asserts the public visibility filter is present and that the public
  detail helper omits `owner_id`.

### 7. No raw IP / user-agent / fingerprint / referrer / header in view tracking

**Status**: ✅ Ready.

- `modal_compute/tree_views.py` `record_public_tree_view()` accepts only
  `actorKey`, `actorKind`, and `source`. The full request, headers, and
  cookies are never passed in.
- The view tracking migration is restricted to the dedup table and the
  aggregate table; no analytics table, no event stream, no raw logs.
- `docs/product/lovebud-browse-tree-view-count-policy.md` locks the
  "no broad analytics" rule and the privacy key scheme
  (account id for authenticated users, random per-browser key for anonymous).
- Contract: `tests/contracts/public-tree-view-event-wiring-contract.test.cjs`
  asserts the absence of `userAgent`, `document.cookie`, `navigator.platform`,
  `fingerprint`, and `referrer` strings in the viewer code.

### 8. Browse/Search summary payload does not yet expose `viewCount`

**Status**: ✅ Ready.

- `modal_compute/validation.py` `normalize_row()` no longer includes a
  `viewCount` key by default. `viewCount` is only ever returned by the
  narrow public detail endpoint, never by the Browse/Search snapshot.
- `modal_compute/public_reads.py` `fetch_latest_public_tree_snapshots()`
  modern_query selects only `s.like_count` (no `s.view_count`).
- `fetch_growing_public_tree_snapshots()` does not join `tree_social_counts`
  at all.
- Legacy fallback dictionaries in both helpers also omit `viewCount`.
- Contract: `tests/contracts/browse-sort-likes-backend-contract.test.cjs`,
  `modal-public-read-routes-contract.test.cjs`,
  `browse-tree-view-count-policy-contract.test.cjs`, and
  `tree-view-api-boundary-contract.test.cjs` all assert
  `doesNotMatch(..., /viewCount/)` on the Browse/Search snapshot sources.

### 9. Browse UI labels do not yet include `조회순`

**Status**: ✅ Ready.

- The Browse UI label set is still `최신순` / `인기순` / `좋아요순` (or the
  pre-Unit-D variant). `조회순` is not added until Unit D, which is
  explicitly gated on Units A, B, and C all being complete.
- This audit confirms there is no premature UI label leak in any HTML
  or JS file shipped on `main`.

### 10. `sort=likes` is already enabled without breaking the contract surface

**Status**: ✅ Reference only.

- The same allow-set pattern (`{"latest", "popular", "likes"}`) and
  ternary fallback used for `sort=likes` will be reused for
  `sort=views` (the future runtime slice just adds `"views"` to the
  set and a new `order_clause` branch).
- Tie-breaker: `s.view_count DESC, t.updated_at DESC, t.created_at DESC,
  t.id ASC` (symmetric to the `likes` path).

## Hard scope boundaries for the next slice

The future `api/browse-sort-views-backend` slice must NOT touch any of the
following (these are explicitly audited-as-still-correct and the audit
contracts will continue to enforce them):

1. **No `viewCount` in Browse/Search summary payload.** Latest/growing
   snapshots must keep omitting `viewCount` even after `sort=views` is
   enabled. The summary is "public read", but the boundary decision
   (`docs/product/lovebud-public-tree-detail-viewcount-read-boundary.md`)
   restricts `viewCount` to the narrow public detail endpoint.
2. **No Browse UI label change.** `조회순` activation is Unit D work and
   must wait until Unit C (likes + views) is fully done.
3. **No `sort=views` in the Browse UI** until Unit D.
4. **No private tree leakage.** `sort=views` must only rank public trees;
   the `WHERE t.visibility = 'public'` filter must remain in the SQL
   before the `ORDER BY s.view_count DESC` clause.
5. **No broad analytics.** No raw IP / user-agent / fingerprint / referrer
   / header collection. The aggregate `view_count` is the only signal.
6. **No dedup policy change.** The 24-hour per-actor dedup window stays
   the same. `sort=views` ranks by the already-deduped aggregate, not
   raw events.
7. **Tie-breaker must be deterministic.** The same ordering columns as
   `sort=likes`: `s.view_count DESC, t.updated_at DESC, t.created_at DESC,
   t.id ASC`. Any deviation must be a separate decision.
8. **Router / modal / SQL / contract must all move together.** The
   `sort=views` slice must update: catch-all route ternary, modal app
   `safe_sort` set, `fetch_latest_public_tree_snapshots` `order_clause`
   branch, and the relevant contract tests in one PR. Partial changes
   will leave the system inconsistent.

## Recommended shape of the next slice (for planning reference only)

The audit does not implement the slice; it only sketches the shape so the
next PR can be planned. The actual implementation must be a separate
runtime slice with its own contract tests, branch, and PR.

- Branch suggestion: `api/browse-sort-views-backend`
- Files to touch (small list, narrow scope):
  - `functions/api/[[path]].js` — add `views` to the ternary in both
    cache-build helpers (mirrors the `likes` change).
  - `modal_compute/app.py` — add `"views"` to the `safe_sort` set.
  - `modal_compute/public_reads.py` — add the `views` `order_clause`
    branch; add `s.view_count` to the `SELECT` list; mirror the
    table/column safe fallbacks.
  - `tests/contracts/browse-sort-views-backend-contract.test.cjs` —
    new contract test mirroring `browse-sort-likes-backend-contract.test.cjs`.
  - Update the **existing** contracts that still pin `sort=views` as
    forbidden (see `Existing contract updates the next slice must do`).

### Existing contract updates the next slice must do

The following existing contracts currently assert that `sort=views` is
forbidden. The `api/browse-sort-views-backend` slice must update them in
the same PR, mirroring how the `sort=likes` slice updated
`browse-sort-likes-backend-contract.test.cjs`'s neighbors:

- `tests/contracts/browse-sort-likes-backend-contract.test.cjs` —
  rename / re-scope the "sort=views remains unsupported" test.
- `tests/contracts/browse-tree-social-counts-plan-contract.test.cjs` —
  test 6 currently forbids `views` and `likes`; must allow `views`.
- `tests/contracts/browse-tree-view-count-policy-contract.test.cjs` —
  test 6 currently forbids `views`; must allow it.
- `tests/contracts/migration-tree-social-counts-contract.test.cjs` —
  test 4 asserts router does not match `views`; must allow it.
- `tests/contracts/modal-public-read-routes-contract.test.cjs` — must
  allow `views` in the `safe_sort` set and the `order_clause` branch.
- `tests/contracts/public-tree-view-event-wiring-contract.test.cjs` —
  must allow `views` in the router ternary.
- `tests/contracts/tree-like-api-boundary-contract.test.cjs` — test 8
  forbids `views` and `likes`; must allow both.
- `tests/contracts/tree-like-count-foundation-audit-contract.test.cjs`
  — tests 8 and 10 forbid `views`/`likes`; must allow `views`.
- `tests/contracts/tree-view-api-boundary-contract.test.cjs` — test 5
  forbids `views`; must allow it.
- `tests/contracts/public-tree-detail-viewcount-read-boundary-contract.test.cjs`
  — must allow `views` in the router assertion.

The new `browse-sort-views-backend-contract.test.cjs` must also enforce
the **hard scope boundaries** (no `viewCount` in summary, no `조회순` UI
label, private tree boundary, no raw analytics, deterministic tie-breaker)
exactly the way `browse-sort-likes-backend-contract.test.cjs` does for
the `sort=likes` slice.

## Audit conclusion

The codebase is ready. No audit blocker exists. The next runtime slice
can be planned as a small, narrow change with a clear contract envelope,
following the same shape as the `api/browse-sort-views-backend` PR.

This audit slice does not close #1661; it only confirms the next slice
is feasible. The actual `sort=views` enablement must be a separate
runtime slice with its own PR.
