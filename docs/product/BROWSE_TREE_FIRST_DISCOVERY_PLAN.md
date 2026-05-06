# Browse Tree-first Discovery Plan

Refs #800
Refs #605
Refs #648
Refs #618
Refs #766
Refs #768

## Purpose

LoveBud Browse should communicate that users are discovering public LoveTrees, not merely browsing representative media tiles or opening a video-led 감상 hub.

The product identity is strongest when a public card, preview panel, and final destination all reinforce the same metaphor: connected emotional moments growing as a tree. This document defines the tree-first Browse hierarchy for v0.1+ without changing runtime behavior.

## Product decision

Browse should move toward this hierarchy:

1. A Browse card represents a public LoveTree.
2. Selecting a card previews the tree, not only a representative moment.
3. `트리 열기` is reserved for a real read-only LoveTree viewer.
4. `감상 열기` or representative moment viewing remains available as a secondary shortcut.
5. 감상허브 is a preview layer, not the final primary destination once the tree viewer exists.

## Current problem

Browse can currently read as media-led when:

- representative thumbnails dominate the card;
- selected panel copy centers 감상 rather than tree structure;
- `트리 열기` and 감상/detail routes are semantically close but not identical;
- users expect a tree structure but are routed to a moment/detail viewing experience;
- compact tree preview/minimap elements are treated as decoration instead of product meaning.

This weakens the central LoveTree idea: the emotional value comes from relationships between moments, not only from one media item.

## Surface model

| Surface | v0.1 role | Primary meaning | CTA rule |
| --- | --- | --- | --- |
| Browse card | Discovery tile | Public LoveTree summary | Card should point toward tree identity. |
| Selected preview / 감상허브 | Preview layer | Tree preview plus representative moment | Should not overpromise full viewer before it exists. |
| Read-only tree viewer | Primary tree destination | Public tree structure and node inspection | Owns `트리 열기`. |
| Detail / 감상 page | Moment-level viewing shortcut | Watch/read one selected or representative moment | Owns `감상 열기` / `대표 순간 감상`. |
| Editor | Owner creation/editing | Private owner-write surface | Must not be public viewer destination. |

## Browse card direction

Browse cards should feel like LoveTree discovery cards.

Recommended card ingredients:

- tree title;
- short description or derived context;
- representative moment thumbnail/media;
- compact tree preview, flow, or minimap;
- moment count or public-moment context;
- quiet public identity markers.

The representative media may remain important, but it should not be the whole product story. A card should imply that there is a connected tree behind the media.

## Selected preview direction

The selected preview panel should evolve from a media-led 감상 hub toward a tree preview.

Candidate structure:

1. tree title and short context;
2. compact tree flow/minimap;
3. representative moment preview;
4. emotion tags and connected flow;
5. primary action only when ready: `트리 열기`;
6. secondary action: `대표 순간 감상` or `감상 열기`;
7. utility actions: share, copy/import, or other safe controls.

Until the read-only tree viewer is runtime-verified, the panel should avoid presenting `트리 열기` as a strong primary route if it actually opens a moment/detail or incomplete page.

## CTA semantics

### `트리 열기`

Use only when the target is a real read-only LoveTree viewer.

Requirements before promotion:

- viewer route exists;
- public tree data loads;
- tree nodes or a clear tree structure render;
- viewer is read-only;
- no owner/edit controls are visible;
- desktop and mobile 375px pass;
- deployed SHA verification is complete for implementation PRs.

### `감상 열기` / `대표 순간 감상`

Use for a moment-level viewing destination.

Appropriate targets:

- selected representative moment detail;
- current 감상/detail route;
- video/moment-first experience.

This label should not pretend to be full tree structure viewing.

### Copy/import/share actions

These remain utility actions. They should not compete with tree viewing as the primary product direction unless their recovery and auth behavior are runtime-verified.

## Relationship to active issues

- #605: immediate CTA label/destination mismatch for `감상 열기` vs `트리 열기`.
- #648: read-only LoveTree viewer planning using safe Editor layout ideas.
- #801: first read-only public LoveTree viewer shell.
- #802: selected moment detail panel inside public viewer.
- #618: hybrid Browse card direction with thumbnail plus tree preview zone.
- #766: selectable flow moments in selected preview.
- #768: lighter flow visual treatment and text-style expand/collapse.

This document coordinates those efforts. It does not replace their implementation scopes.

## Phased implementation path

### Phase 1 — Product semantics and copy alignment

- Treat Browse card as LoveTree-first in product language.
- Avoid using `트리 열기` for a non-tree viewer route.
- Relabel current moment/detail route as 감상-oriented when needed.

### Phase 2 — Card and selected preview hierarchy

- Strengthen compact tree preview/minimap on cards.
- Tune selected preview toward tree preview rather than only media preview.
- Keep moment viewing as a secondary action.

### Phase 3 — Read-only tree viewer bridge

- Runtime-verify the read-only public tree viewer.
- Promote `트리 열기` only after the viewer shell is verified.
- Ensure no Editor affordances leak into public viewer mode.

### Phase 4 — Node detail and Browse flow integration

- Let viewer nodes open read-only moment detail.
- Optionally let Browse preview flow items become selectable.
- Keep social placeholders/read/write behavior separate until ready.

## Verification requirements for implementation PRs

Browse, viewer, and detail routes are runtime-sensitive. Implementation PRs require:

- fixed test slot or valid Cloudflare deployment;
- deployed SHA match with PR head;
- Browse page load;
- selected preview open;
- correct CTA label and destination;
- viewer route load if `트리 열기` is present;
- representative moment/detail route load if `감상 열기` is present;
- desktop screenshot;
- mobile 375px screenshot;
- no horizontal overflow;
- no fatal console/page/network errors;
- no restricted private data exposure.

Local-only or text-only verification is not sufficient for final runtime PASS.

## Guardrails

Do not combine tree-first Browse work with unrelated:

- Auth provider changes;
- backend/API/DB migrations;
- Editor owner-write refactors;
- comment/social write implementation;
- package or workflow changes;
- PR #7, prototype, reference, demo, or variant changes.

Reports must not expose credentials, tokens, sessions, cookies, headers, passwords, private keys, DB URLs, tree IDs, owner IDs, memory IDs, copied tree IDs, raw payloads, or DB row values.

## Acceptance mapping for #800

| #800 criterion | Status from this document |
| --- | --- |
| Browse product hierarchy documented as tree-first | PASS |
| 감상허브 defined as preview/secondary | PASS |
| `트리 열기` reserved for real read-only viewer | PASS |
| Staged path linked for viewer shell, node detail, Browse CTA transition | PASS |
| No runtime behavior changed | PASS |

## Current disposition

This document satisfies the planning layer for #800. The issue should remain open until Browse card/preview CTA behavior and the read-only viewer bridge are implemented, runtime-verified, or explicitly deferred.
