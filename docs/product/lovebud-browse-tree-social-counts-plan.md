# LoveBud Browse Tree Social Counts Foundation Plan

## Status

- Refs: #1661, #1660
- Scope: planning/design only
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none
- Browse card redesign: none

This document locks the first planning slice for tree-level social counts before `조회순` or `좋아요순` can be exposed in Browse.

## Current baseline

Current Browse/Search sort state:

- visible sort labels: `최신순` and `많은 순간순`
- internal sort values: `latest` and `popular`
- `popular` means public memory-count proxy, not true popularity

Current API/router baseline:

- `/api/community/trees?view=summary` accepts `latest` and `popular`
- unsupported sort values must continue to fall back safely to `latest`
- `sort=views` is not supported yet
- `sort=likes` is not supported yet
- Browse summary payload is memory-count centered and does not expose `viewCount` or `likeCount`

Current product/data baseline:

- tree-level `view_count` / `tree_view_count` does not exist
- tree-level `like_count` / `tree_like_count` does not exist
- memory-level reactions are not tree-level likes
- no backend event tracking increments tree views on tree detail or card open
- private tree engagement data must never leak to public Browse surfaces

## Product decision

Do not expose user-facing `조회순` or `좋아요순` until the supporting tree-level counts, aggregation rules, abuse controls, and API sort support are implemented and verified.

Keep `많은 순간순` as an honest public memory-count proxy. Do not rename it to `인기순` or `Popular` until real engagement data exists.

## Count semantics

### Tree likes

A tree-level like is an engagement with the whole public tree. It is separate from memory-level reactions.

Required semantics:

- one authenticated account may have at most one active like per tree
- a like may be toggled off if the product chooses toggle semantics
- memory reactions must not be counted as tree likes
- likes on private trees must not be exposed in public Browse results
- deleted or private trees must not appear in public like rankings

Recommended storage model:

- `tree_likes` for per-tree active like records
- `tree_social_counts` for aggregate `like_count`, `view_count`, and `updated_at`

The separate aggregate table is preferred over storing counters directly on `trees` because it keeps product metadata, mutable engagement metrics, and future backfills isolated.

### Tree views

A tree-level view is a qualified public-tree exposure event. It must not become broad analytics.

Required semantics:

- count only public tree detail or explicit tree-card open events selected by the implementation slice
- suppress duplicate views for the same actor/session/tree within a time window
- do not count automated prefetch, crawler, or background cache warmup as user views
- do not expose private tree views in public Browse results
- do not store raw network or device identifiers in count tables

Recommended duplicate policy:

- same authenticated account + tree: count at most once per 24 hours
- anonymous/session-based viewer: count at most once per 24 hours using a privacy-preserving key
- bot/crawler-like requests must be ignored where possible
- cache/prefetch routes must not increment views

## Implementation order

Implement likes before views.

Reasoning:

1. Tree likes have clearer semantics and lower abuse risk.
2. Likes require explicit intent, unlike passive views.
3. Likes can validate the aggregate table and public summary read path before view tracking is introduced.
4. Views require duplicate suppression, bot filtering, and route-level instrumentation, so they should follow after the aggregate model is stable.

## Recommended follow-up split

### Unit A — Tree-level likes

- Add tree-level like data model.
- Enforce one active like per account per tree.
- Keep memory-level reactions separate.
- Add safe aggregate read support for public tree `likeCount`.
- Keep Browse UI labels unchanged.

### Unit B — Tree-level views

- Add tree-level view tracking model.
- Define exactly which user actions count as a view.
- Implement duplicate suppression.
- Exclude private tree views from public ranking.
- Exclude prefetch/cache/crawler events from counts.

### Unit C — Browse sort API support

- Add `sort=likes` only after `likeCount` exists.
- Add `sort=views` only after `viewCount` exists.
- Preserve `sort=latest` behavior.
- Preserve `popular` as memory-count proxy or explicitly alias it to `moments` in a separate decision.
- Unsupported sort values must continue to fall back safely to `latest`.

### Unit D — Final Browse UI update

Only after Units A-C are complete, update visible Browse controls to:

- `최신순`
- `조회순`
- `좋아요순`

## Public payload policy

Public Browse summary may eventually expose:

- `memoryCount`
- `likeCount`
- `viewCount`

Public Browse summary must not expose:

- private tree counts
- liker or viewer lists
- raw request identifiers
- per-account engagement history
- memory-level reactions as a substitute for tree-level likes

## Non-goals for this planning slice

- No database migration.
- No API implementation.
- No `sort=views` support.
- No `sort=likes` support.
- No Browse UI label change.
- No broad analytics or tracking.
- No Browse card redesign.
- No CSP, Auth, Scout, or unrelated editor work.

## Acceptance for this slice

This planning slice is complete when:

- storage model preference is recorded
- likes-before-views order is recorded
- duplicate view counting policy is recorded
- memory-level and tree-level engagement remain separated
- public/private count exposure policy is recorded
- follow-up units are explicitly split
- current UI/API behavior remains unchanged

## Closure note for #1661

This planning slice does not close #1661. It satisfies the first planning step only. #1661 should remain open until the data model, read API, sort API, and final UI update are implemented or split into concrete linked implementation issues.