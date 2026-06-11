# LoveBud Browse Tree View Count Policy

## Status

- Refs: #1661, #1660
- Unit: B — Tree-level views
- Scope: policy/contract only before runtime implementation
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend label change: none
- Browse card redesign: none

This document locks the narrow Unit B policy for tree-level view counts before any runtime event tracking, `sort=views`, or Browse UI label change is introduced.

## Relationship to the foundation plan

This document extends `lovebud-browse-tree-social-counts-plan.md` and must not override its existing decisions:

- `tree_social_counts` remains the aggregate table direction for `like_count` and `view_count`.
- Likes are implemented before views.
- `sort=views` and `sort=likes` remain unsupported until real counts and sort APIs are implemented and verified.
- Public Browse must not expose private engagement data.
- Tree-level views are separate from memory-level reactions, comments, and tree-level likes.

## Definition

A tree-level view is a qualified user exposure to a public LoveTree.

A qualified view is not the same as:

- loading a Browse summary list;
- automated prefetch;
- crawler access;
- cache warmup;
- background health checks;
- memory-level detail access outside an explicit tree viewing surface;
- owner/private tree access.

## Countable event policy

The first runtime implementation may count only one of these explicit surfaces:

1. Public tree detail page open.
2. Explicit public tree card open that navigates to or expands the full tree surface.

The implementation must choose one event source per slice and document it in that PR. It must not count both card impression and detail open in the same first slice unless duplicate suppression is already proven to cover the double-count risk.

The following events must not increment `view_count`:

- Browse summary fetch.
- Search summary fetch.
- Growing/public carousel fetch.
- Static card render without explicit open.
- Link preview unfurl.
- Server-side prefetch.
- Client-side speculative prefetch.
- Cache warmup.
- Crawler/bot-like request when detectable.
- Private owner/editor reads.
- Missing or private tree reads.

## Duplicate suppression policy

A single actor must not increment the same public tree more than once in a rolling 24-hour window.

Required actor keys:

- Authenticated user: use account identity, not raw network identifiers.
- Anonymous user: use a privacy-preserving session key or signed view key.
- Unknown actor with no safe key: do not count, or count only through a future explicitly reviewed low-trust path.

The duplicate key must include:

- tree id;
- actor/session key;
- time window bucket or equivalent rolling-window state.

The duplicate key must not store:

- raw IP address;
- raw user-agent string;
- full device fingerprint;
- exact location;
- per-account public exposure history.

## Storage policy

The preferred storage remains:

- `tree_social_counts.view_count` for aggregate counts.
- A future narrow view-event or view-dedup table only if needed for suppression.

If a view-event table is introduced, it must store the minimum data required for suppression and auditability. It must not become broad analytics.

Allowed future fields are limited to concepts such as:

- tree id;
- hashed or opaque actor/session key;
- counted window timestamp;
- created timestamp;
- source enum such as `public_tree_detail`.

Prohibited fields include:

- raw IP address;
- raw user-agent;
- referrer URL with query strings;
- full request headers;
- viewer profile details;
- device fingerprint.

## Public/private boundary

Public view counts may only be read for public trees.

Private trees must not:

- increment public `view_count`;
- appear in public view rankings;
- expose view counts through public Browse, Search, or public detail responses;
- leak whether private viewers opened the tree.

Missing trees and private trees should continue to be hidden as not found on public routes.

## API and routing policy

The first view implementation must use a narrow endpoint or explicit server-side handler. It must not piggyback on broad Browse summary reads.

Allowed future route shape examples:

- `POST /api/trees/:tree_id/views`
- `POST /modal/public/trees/{tree_id}/views`

Required behavior for a future count endpoint:

- Validate tree id.
- Confirm the tree is public before counting.
- Apply duplicate suppression before incrementing.
- Return a minimal safe response, such as `{ treeId, counted, viewCount }`.
- Treat private or missing tree as 404.
- Avoid returning actor/session data.

## Sort and UI hold

This policy does not enable `sort=views`.

The following remain forbidden until a later Unit C PR:

- adding `sort=views` to Browse/Search API;
- adding `viewCount` to public Browse summary payload;
- changing Browse labels to `조회순`;
- renaming `popular` to real popularity language;
- using memory count as a substitute for view count.

## Implementation gates for the first runtime PR

A future Unit B implementation PR must include contract coverage for:

- public-tree-only counting;
- private/missing tree 404 behavior;
- no count from Browse summary or prefetch/cache paths;
- 24-hour duplicate suppression;
- aggregate `view_count` non-negative update;
- no raw network/device identifiers in persisted view data;
- no `sort=views` or Browse UI label changes.

## Acceptance for this policy slice

This policy slice is complete when:

- countable view event source is bounded;
- non-countable events are explicitly listed;
- 24-hour duplicate suppression is required;
- privacy-preserving actor/session keys are required;
- private tree view leakage is prohibited;
- Browse sort/UI changes remain held;
- runtime behavior remains unchanged.

## Closure note for #1661

This Unit B policy slice does not close #1661. It prepares the view-count implementation boundary only. #1661 should remain open until the count model, safe reads, sort API, and final UI update are implemented or split into concrete linked issues.
