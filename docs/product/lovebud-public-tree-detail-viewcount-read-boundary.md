# LoveBud Public Tree Detail viewCount Read Exposure Boundary

## Status
- Refs: #1661, #1660
- Unit: B-read — Public detail `viewCount` read exposure
- Scope: policy/contract only before runtime implementation
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none (this defines the boundary for future PR)
- Frontend label change: none

This document locks the narrow read-exposure boundary for `viewCount` in the public tree detail response before any API or frontend change is introduced.

## Relationship to Existing Policy

This document extends `lovebud-browse-tree-view-count-policy.md` and `lovebud-browse-tree-social-counts-plan.md` and must not override their existing decisions:

- `tree_social_counts.view_count` remains the aggregate count store.
- View counting (POST) is implemented and separate from read exposure.
- `sort=views` and Browse summary `viewCount` payload remain unsupported until Unit C.
- Public Browse/Search must not expose `viewCount` in summary cards.
- Private trees must never leak engagement data through any public surface.

## Decision: Public Tree Detail MAY Include `viewCount`

The public tree detail endpoint (`GET /modal/trees/{tree_id}` via Cloudflare `GET /api/trees/{tree_id}`) **shall** include `viewCount` in its response for public trees.

### Rationale

1. **Policy alignment**: The view-count policy states "Public view counts may only be read for public trees" and prohibits private trees from exposing "view counts through public Browse, Search, or public detail responses" — the prohibition on public detail responses for private trees implies the converse is permitted for public trees.

2. **Narrow endpoint**: The public tree detail is a single-tree lookup (`GET /modal/trees/{tree_id}`), not a broad Browse summary. The view-count policy explicitly requires "a narrow endpoint or explicit server-side handler" and forbids "piggyback on broad Browse summary reads."

3. **Consistency with `likeCount`**: The detail endpoint already returns `likeCount` via `fetch_public_tree_like_count()`. Adding `viewCount` follows the same pattern and uses the same `tree_social_counts` aggregate table.

4. **Infrastructure ready**: The counting pipeline (POST, dedup, aggregate increment) is implemented and gated behind `tree_view_dedup_events`. The aggregate column `tree_social_counts.view_count` exists.

5. **No new privacy risk**: `viewCount` is an anonymous aggregate. The detail endpoint already requires the tree to be public. No actor/session data is exposed.

## Required Behavior for the Read Endpoint

When the implementation PR adds `viewCount` to the public tree detail response:

- **Public tree only**: The endpoint already validates `visibility = 'public'`. `viewCount` must only be included when the tree is public.
- **Safe zero fallback**: If `tree_social_counts` table or `view_count` column is missing (pre-migration environments), return `0` or omit the field gracefully — do not error.
- **Minimal response shape**: Add `viewCount: number` alongside existing `likeCount: number` in the detail response.
- **No `sort=views`**: This read exposure does not enable `sort=views` in Browse/Search. That remains Unit C.
- **No Browse summary payload change**: Browse summary (`/modal/browse/latest`, `/modal/browse/growing`) must not include `viewCount` until Unit C.

## Prohibited Behaviors

The following remain forbidden by the parent policy and this boundary:

- Adding `viewCount` to Browse summary payload (`/modal/browse/latest`, `/modal/browse/growing`).
- Adding `sort=views` to Browse/Search API.
- Changing Browse UI labels to `조회순`.
- Exposing `viewCount` for private/missing trees (return 404 as today).
- Exposing per-actor or per-session view history in any public response.
- Storing raw IP, user-agent, fingerprint, referrer, or headers in count tables.

## Implementation Gates for the Read-Exposure PR

A future PR that adds `viewCount` to the public tree detail response must include contract coverage for:

- Public tree detail returns `viewCount` (integer, ≥ 0).
- Private/missing tree returns 404 (no `viewCount` leakage).
- Pre-migration safe zero fallback when `tree_social_counts` is absent.
- No `viewCount` in Browse summary responses.
- No `sort=views` in Browse/Search.
- No new persisted fields beyond existing `tree_social_counts.view_count`.

## Acceptance for This Boundary Slice

This boundary slice is complete when:

- The decision is recorded: public tree detail **shall** expose `viewCount`.
- The boundary is explicit: Browse/Search summary and sort remain unchanged.
- Private tree leakage prohibition is reaffirmed.
- Implementation gates are defined for the future read-exposure PR.
- Runtime behavior remains unchanged (this is a docs-only decision).

## Closure Note for #1661

This boundary slice does not close #1661. It finalizes the read-exposure boundary for `viewCount` in public tree detail only. #1661 should remain open until the count model, safe reads, sort API, and final UI update are implemented or split into concrete linked issues.