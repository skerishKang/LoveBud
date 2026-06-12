# LoveBud Browse Final Social Sort Labels Decision

## Status

- Refs: #2433, #1661, #608
- Unit: D — Final Browse UI update (social sort labels)
- Scope: product decision / contract only — no runtime behavior change in this slice
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none (this defines the boundary for future UI PR)

This document locks the final visible sort labels for the Browse page after Units A, B, C are complete.

## Relationship to Existing Decisions

This document extends and must not override:

- `lovebud-browse-tree-social-counts-plan.md` — Units A, B, C, D split and target labels
- `lovebud-browse-tree-view-count-policy.md` — view count policy, sort/UI hold until Unit D
- `lovebud-browse-sort-views-readiness-audit.md` — audit confirming Units A–C readiness
- `lovebud-public-tree-detail-viewcount-read-boundary.md` — public detail `viewCount` read exposure
- `BROWSE_POPULAR_SORT_SEMANTICS.md` — current `인기순` is a memory-count proxy, not real popularity
- `BROWSE_SORT_DEFINITION.md` — decision criteria for sort labels
- `lovebud-browse-sort-views-readiness-audit.md` — confirms `sort=views` backend is ready

## Current Backend Reality (Post Units A–C)

| Sort value | Backend ordering | Signal source | Implementation status |
|------------|------------------|---------------|----------------------|
| `latest` | `t.created_at DESC` | Tree creation time | ✅ Active |
| `popular` | `public_memory_count DESC, t.created_at DESC` | Public memory count (proxy) | ✅ Active |
| `likes` | `s.like_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC` | Tree-level likes (real engagement) | ✅ Active (Unit C) |
| `views` | `s.view_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC` | Tree-level views (real engagement) | ✅ Active (Unit C) |

**Key change from baseline**: `sort=likes` and `sort=views` now have **real engagement signals** (tree-level like count, tree-level view count) backed by `tree_social_counts` aggregate table. The previous `popular` sort was a memory-count proxy; it is no longer the only engagement-adjacent option.

## Product Decision: Final Visible Sort Label Set

The Browse page shall expose exactly three user-facing sort labels:

| Visible label | Internal sort value | Signal | Honesty assessment |
|---------------|---------------------|--------|---------------------|
| **최신순** | `latest` | Tree creation time | ✅ Honest — clear meaning |
| **조회순** | `views` | Tree-level view count (24h dedup, public trees only) | ✅ Honest — real engagement signal |
| **좋아요순** | `likes` | Tree-level like count (authenticated, one per account per tree) | ✅ Honest — real engagement signal |

### `인기순` (current `popular` label) disposition

**Decision**: Remove `인기순` from the visible sort control.

**Rationale**:

1. **It is a proxy, not popularity**: `popular` orders by public memory count, which correlates with tree completeness but does not measure user engagement (views, likes, shares, comments, dwell time). The `BROWSE_POPULAR_SORT_SEMANTICS.md` explicitly recommended renaming or hiding it.

2. **Real engagement signals now exist**: With `조회순` (views) and `좋아요순` (likes) both backed by real tree-level engagement aggregates, the user has genuine popularity-adjacent options. Keeping a weak proxy alongside real signals creates confusion and dilutes trust.

3. **Three is a clean UX set**: "Recency / Views / Likes" maps cleanly to the three fundamental discovery dimensions: newness, passive engagement, active endorsement. Adding a fourth proxy label adds cognitive load without proportional value.

4. **No data loss**: The `popular` sort value remains supported in the API (it still works and produces the same memory-count ordering). It is simply not surfaced in the visible control. Advanced users or future features can still access it via direct URL if needed.

## Migration Path for `popular`

- **API**: `sort=popular` continues to work, ordering by `public_memory_count DESC, t.created_at DESC` with eligibility `public_memory_count >= 3`. No breaking change.
- **Frontend**: The visible sort control (dropdown/tabs) removes the `인기순` option. The control shows only `최신순` / `조회순` / `좋아요순`.
- **URL state**: If a user has `?sort=popular` in their URL or saved state, the backend still honors it. The frontend should not highlight a "selected" state for a label that no longer exists in the control — treat it as "custom/other" or default to `최신순` display.
- **Future**: If a true curation/editorial score is implemented, it can be added as a fourth label with an honest name (e.g., `큐레이션순`, `추천순`).

## Hard Scope Boundaries for the Follow-up UI PR

The follow-up UI implementation PR (Unit D execution) must NOT touch:

1. **Backend sort logic** — `latest`, `popular`, `likes`, `views` ordering all stay as-is.
2. **API contract** — no new sort values, no changes to fallback behavior.
3. **Browse summary payload** — still no `viewCount` or `likeCount` in summary (policy boundary from Unit B-read).
4. **Private tree boundary** — `sort=views` and `sort=likes` must continue to only rank public trees (already enforced in SQL).
5. **Dedup policy** — 24-hour per-actor view dedup unchanged; one like per account per tree unchanged.
6. **Analytics prohibition** — no raw IP / user-agent / fingerprint / referrer / header collection.

The UI PR scope is strictly: update the visible sort control labels and their mapping to internal sort values.

## Implementation Gates for the Unit D UI PR

A future PR that implements the visible label change must include contract coverage for:

- Visible sort control shows exactly three options: `최신순`, `조회순`, `좋아요순`.
- `최신순` maps to `sort=latest`.
- `조회순` maps to `sort=views`.
- `좋아요순` maps to `sort=likes`.
- `인기순` is not present in the visible control.
- `sort=popular` still works via direct URL (not a regression).
- Mobile (375px) and desktop Browse remain usable.
- No restricted runtime values printed in reports.

## Acceptance for This Decision Slice

This decision slice is complete when:

- The final three-label decision is recorded.
- The `인기순` disposition is explicit.
- The hard scope boundaries for the follow-up UI PR are defined.
- Implementation gates are defined.
- Runtime behavior remains unchanged (this is a docs-only decision).

## Closure Note for #1661 and #608

This decision slice does not close #1661 or #608 by itself. It finalizes the product label decision that enables the Unit D UI implementation PR. #1661 should remain open until the UI implementation is complete. #608 can be closed when the UI PR implements this decision (Outcome B from BROWSE_SORT_DEFINITION.md — rename/remove the misleading label).