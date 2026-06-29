# LoveBud Browse Tree Social Counts Completion Audit

## Status

- Refs: #2451, #1661
- Parent epic: #1661 — Browse/Search social counts (`latest` / `popular` / `likes` / `views`)
- Depends on: #2436 — final Browse social sort labels implementation
- Audit date: 2026-06-13
- Audited branch baseline: `main` at `e69f3cb87d6953d6c4e9c4fedb88039807d1e553`
- Scope: closure audit / assessment only
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none
- Browse/Search scope only: no Editor, AI/Scout, DB migration, or unrelated runtime work

## Executive Summary

**Verdict: #1661 is ready to close completed.**

The tree-level social counts work is complete across the product decision chain, backend sort path, Browse UI control, and contract coverage. No blocker remains for closing #1661 as completed.

| Gate | Status | Evidence |
|------|--------|----------|
| Tree-level like/view semantics documented | ✅ Ready | `lovebud-browse-tree-social-counts-plan.md`, `lovebud-tree-like-count-foundation-audit.md`, `lovebud-browse-tree-view-count-policy.md` |
| Public/private boundary documented and enforced | ✅ Ready | `lovebud-public-tree-detail-viewcount-read-boundary.md`, `modal_compute/public_reads.py`, `modal_compute/tree_likes.py`, `modal_compute/tree_views.py` |
| `sort=likes` backend maintained | ✅ Ready | `functions/api/[[path]].js`, `modal_compute/app.py`, `modal_compute/public_reads.py` |
| `sort=views` backend maintained | ✅ Ready | `functions/api/[[path]].js`, `modal_compute/app.py`, `modal_compute/public_reads.py` |
| Browse UI exposes exactly `최신순` / `조회순` / `좋아요순` | ✅ Ready | `js/search/search-ui.js`, `js/i18n/i18n-search.js` |
| Browse controls send `latest` / `views` / `likes` | ✅ Ready | `js/search/search-ui.js`, `js/search/search-index.js` |
| Browse/Search summary payload includes persisted viewCount | ✅ Ready | `modal_compute/validation.py`, `modal_compute/public_reads.py` |
| Private tree leakage boundary preserved | ✅ Ready | `t.visibility = 'public'` filters, public detail 404 behavior, view/like read helpers |
| No raw analytics storage or Scout live work mixed in | ✅ Ready | migration comments, `tree_views.py`, relevant Browse/Search files contain no Scout/live-provider work |
| Closure recommendation | ✅ Ready | #2451 audit can close #1661 completed |

## Audit Checklist

### 1. Tree-level view/like semantics are documented

**Verdict: ✅ Ready.**

The product docs separate tree-level engagement from memory-level reactions and define the count model.

Evidence:
- `lovebud-browse-tree-social-counts-plan.md` records:
  - tree-level likes are separate from memory-level reactions;
  - `tree_likes` is the per-tree active like record table;
  - `tree_social_counts` is the aggregate table for `like_count`, `view_count`, and `updated_at`;
  - tree-level views are qualified public-tree exposure events, not broad analytics.
- `lovebud-tree-like-count-foundation-audit.md` confirms tree-level likes are sufficient for `sort=likes`.
- `lovebud-browse-tree-view-count-policy.md` locks view counting semantics: public trees only, duplicate suppression, no raw identifiers, no Browse summary counting.
- `lovebud-public-tree-detail-viewcount-read-boundary.md` locks the narrow public detail `viewCount` read boundary.

Conclusion: the semantics needed to close #1661 are documented and traceable.

### 2. `sort=likes` and `sort=views` backend are maintained

**Verdict: ✅ Ready.**

The backend accepts and orders by the real tree-level engagement values.

Evidence:
- `functions/api/[[path]].js` maps `sort=popular`, `sort=likes`, and `sort=views` in both cache and modal proxy paths, with unsupported values falling back to `latest`.
- `modal_compute/app.py` allows `safe_sort` values `{ "latest", "popular", "likes", "views" }`.
- `modal_compute/public_reads.py` has explicit order branches:
  - `popular`: public memory count proxy;
  - `likes`: `s.like_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC`;
  - `views`: `s.view_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC`.
- `scripts/migration-add-tree-social-counts.sql` creates symmetric indexes:
  - `idx_tree_social_counts_like_count(like_count DESC, updated_at DESC)`;
  - `idx_tree_social_counts_view_count(view_count DESC, updated_at DESC)`.

Conclusion: the backend sort surface is complete and deterministic.

### 3. Browse UI exposes the final three labels

**Verdict: ✅ Ready.**

The visible Browse sort control now exposes the final labels from the Unit D decision.

Evidence:
- `js/search/search-ui.js` creates exactly three Browse sort buttons:
  - `data-browse-sort="latest"` → `최신순` / `Latest`;
  - `data-browse-sort="views"` → `조회순` / `Views`;
  - `data-browse-sort="likes"` → `좋아요순` / `Likes`.
- `js/search/search-ui.js` does not create a visible `data-browse-sort="popular"` button.
- `js/i18n/i18n-search.js` contains `resultsViewsHeading` and `resultsLikesHeading`.

Conclusion: the final user-facing label set is implemented as documented.

### 4. Browse controls send the correct internal sort values

**Verdict: ✅ Ready.**

The UI maps labels to internal sort values and flows them through the existing search state.

Evidence:
- `js/search/search-ui.js` updates `state.currentSort` from `button.dataset.browseSort`.
- `js/search/search-index.js` keeps `state.currentSort` as the Browse sort state.
- `js/search/search-index.js` passes `sort: state.currentSort` when requesting public trees.
- The backend route accepts the resulting `latest`, `views`, and `likes` values.

Conclusion: the Browse controls are wired end-to-end.

### 5. Browse/Search summary payload includes persisted viewCount

**Verdict: ✅ Ready (updated by #3017).**

The summary payload now includes a persisted `viewCount` when the social-count source has a real value.

Evidence:
- `modal_compute/validation.py` includes `result["viewCount"]` when `include_like_count=True` and the row has a non-None `view_count` value.
- Missing or null `view_count` (social-count source unavailable) omits the field so the UI does not display a synthetic "0" indistinguishable from a genuine persisted zero.
- `modal_compute/public_reads.py` calls `normalize_row(row, include_like_count=True)` for Browse latest summaries; the growing helper does not join social counts.
- Private tree reads continue to return 404 and never reach `normalize_row` with social counts.
- `sort=views` UI label/ordering is unchanged by this scope; only the summary payload `viewCount` field is added.
- Detail API view-tracking write, dedup policy, and data migration are unchanged.

Conclusion: the summary payload boundary now includes persisted `viewCount` for public trees only, with a clear two-state convention (available count vs. omitted field).

### 6. Private/public boundary is preserved

**Verdict: ✅ Ready.**

Public Browse/Search ranking and public detail count reads continue to require public trees.

Evidence:
- `modal_compute/public_reads.py` uses `WHERE t.visibility = 'public'` before ordering by `s.view_count` or `s.like_count`.
- `modal_compute/tree_likes.py` and `modal_compute/tree_views.py` both enforce public-tree-only reads through visibility checks before returning counts.
- `modal_compute/app.py` returns 404 when `fetch_public_tree()` cannot find a public tree.
- `scripts/migration-add-tree-view-tracking.sql` explicitly states missing or private tree reads must not create dedup rows.

Conclusion: private tree engagement data is not exposed through Browse/Search or public detail reads.

### 7. No raw analytics storage or Scout live work is mixed in

**Verdict: ✅ Ready.**

The completed count work remains narrow and does not introduce broad analytics or Scout live-provider work.

Evidence:
- `lovebud-browse-tree-view-count-policy.md` prohibits raw IP, raw user-agent, referrer URLs, full request headers, device fingerprint, viewer profile details, and broad analytics.
- `scripts/migration-add-tree-view-tracking.sql` stores only `tree_id`, opaque `actor_key`, `actor_kind`, `counted_window_start`, `source`, and `created_at`.
- `modal_compute/tree_views.py` accepts `actor_key`, `actor_kind`, and `source`; it does not persist raw network or device identifiers.
- The audited Browse/Search files (`functions/api/[[path]].js`, `modal_compute/app.py`, `modal_compute/public_reads.py`, `modal_compute/validation.py`, `js/search/search-ui.js`, `js/search/search-index.js`) do not add Scout live-provider work.

Conclusion: no raw analytics or Scout live work was introduced into the #1661 completion path.

## Closure Recommendation

Close #1661 as **completed**.

Rationale:
1. The product semantics are documented.
2. The storage model and privacy boundaries are implemented.
3. `sort=likes` and `sort=views` are backend-complete.
4. The final Browse UI labels are implemented.
5. The Browse/Search summary payload includes persisted `viewCount` with a clear available/unavailable two-state convention.
6. Contract tests lock the behavior and the audit test in this PR documents the closure gate.

No remaining #1661 blocker was found.

## Non-goals

This audit does **not**:
- change runtime behavior;
- change database schema;
- change API behavior;
- change Browse labels;
- reopen #2400;
- touch #1661 implementation code;
- add Scout live-provider work;
- add broad analytics;
- add Editor/AI/DB/API runtime changes.

## Related Documents

- `lovebud-browse-tree-social-counts-plan.md` — original Units A-D plan for tree-level social counts.
- `lovebud-tree-like-count-foundation-audit.md` — Unit A like-count readiness audit.
- `lovebud-browse-tree-view-count-policy.md` — Unit B view-count policy.
- `lovebud-browse-sort-views-readiness-audit.md` — Unit C `sort=views` readiness audit.
- `lovebud-public-tree-detail-viewcount-read-boundary.md` — public detail `viewCount` read boundary.
- `lovebud-browse-final-social-sort-labels-decision.md` — final `최신순` / `조회순` / `좋아요순` decision.
- `BROWSE_POPULAR_SORT_SEMANTICS.md` — `popular` remains a public memory-count proxy, not real popularity.
- `tests/contracts/browse-tree-social-counts-plan-contract.test.cjs` — planning and backend baseline contract.
- `tests/contracts/browse-sort-likes-backend-contract.test.cjs` — `sort=likes` backend contract.
- `tests/contracts/browse-sort-views-readiness-contract.test.cjs` — `sort=views` readiness contract.
- `tests/contracts/browse-final-social-sort-labels-implementation-contract.test.cjs` — Unit D UI implementation contract.
