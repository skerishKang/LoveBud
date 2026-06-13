# Relationship Hints Review-Before-Save Plan

> Docs/contracts-only planning slice for #2454. This plan defines the first safe product boundary for optional relationship hints in the LoveBud editor/canvas. It does not implement UI, storage, graph layout, or AI behavior.

## Status

- Refs: #2454, #2418
- Parent: #2418 — Explore Obsidian-style relationship graph and canvas links
- Scope: docs/contracts-only planning slice
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend UI implementation: none
- Scout/live AI/provider/fetch/network work: none
- Browse/Search social-count changes: none

## Executive Summary

LoveBud should not automatically connect every possible relationship in a LoveTree. The safer product direction is **review-before-save relationship hints**:

1. The user's manual tree/canvas editing remains the source of truth.
2. A relationship hint is only a suggestion until the user explicitly accepts it.
3. Suggested links must look visually different from saved links.
4. Users must be able to accept or dismiss a suggestion.
5. Dismissed suggestions must not become saved edges.
6. No live AI/provider/fetch/network work is included in this planning slice.

This plan locks the product semantics and guardrails before any future implementation work begins.

## Relationship Hint Definition

A relationship hint is a proposed connection between two LoveTree nodes or moments. It is not a saved relationship by itself.

| Concept | Meaning |
| --- | --- |
| Saved relationship | A relationship the user intentionally created or accepted and that is persisted as part of the tree/canvas model. |
| Relationship hint | A temporary or pending suggestion that may become a saved relationship only after explicit user acceptance. |
| Suggested link | A visual representation of a relationship hint. It must be visibly different from a saved link. |
| Accepted hint | A hint the user chose to convert into a saved relationship. Acceptance may still require the normal save/review step. |
| Dismissed hint | A hint the user rejected or hid. Dismissal must not create a saved edge. |

## Source-of-Truth Boundary

Manual editing remains the source of truth.

- Existing manual tree/canvas editing behavior is not replaced by hints.
- Hints may suggest a relationship, but they must not silently create or overwrite saved edges.
- A saved relationship requires an explicit user action: accept, confirm, or save.
- The user must be able to continue editing manually even when no hints are available.
- If a hint conflicts with existing manual relationships, the manual saved relationship remains authoritative unless the user explicitly changes it.

## Suggested Link vs Saved Link Behavior

Suggested links and saved links must remain separate concepts.

| Dimension | Suggested link | Saved link |
| --- | --- | --- |
| Source | Hint, suggestion, or future relationship source | User-created or user-accepted relationship |
| Visual treatment | Distinct, provisional, lower-commitment | Normal relationship edge |
| Persistence | Not persisted as a relationship until accepted/saved | Persisted as part of tree/canvas state |
| User action | Accept or dismiss | Edit/delete/reorder according to existing editor behavior |
| Failure behavior | Hint can disappear or be ignored without data loss | Saved relationship changes follow normal save/error behavior |

Future UI must make the provisional state obvious. Recommended visual language:

- dashed or dotted line instead of solid saved edge;
- lower opacity or softer color;
- small suggestion badge or tooltip;
- no saved-edge affordance until accepted;
- no automatic layout that hides the distinction.

## Lifecycle

A future implementation may use this lifecycle:

```text
discovered → presented → accepted or dismissed
accepted → review/save → saved relationship
dismissed → hidden/suppressed without creating a saved edge
```

Required lifecycle rules:

1. `presented` hints are suggestions only.
2. `accepted` hints are not automatically persisted until the user completes the normal review/save boundary.
3. `dismissed` hints must not become saved edges.
4. A dismissed hint may be hidden for the current session or future sessions only if the implementation explicitly defines suppression semantics.
5. Suppression state must not be confused with a saved relationship.
6. Hints must be removable from the UI without changing the saved tree model.

## Accept / Dismiss Rules

Accept and dismiss actions must be explicit and visible.

### Accept

Accept means: "use this hint as a candidate relationship and let me review/save it."

Accept must not mean:

- immediately save an edge without review;
- overwrite an existing saved relationship;
- trigger hidden graph layout changes;
- call a live AI/provider endpoint by default.

### Dismiss

Dismiss means: "do not save this relationship."

Dismiss must:

- remove or hide the suggestion from the current hint surface;
- avoid creating a saved edge;
- avoid creating a hidden edge;
- avoid changing branch/momentum relationships unless the user explicitly edits them later.

Dismiss should not require an explanation in the first slice. If future UX adds "not relevant" / "wrong relationship" labels, those labels must remain optional and non-blocking.

## Review-Before-Save Boundary

Relationship hints must follow the same review discipline as other suggestion surfaces:

- suggestions are editable/reviewable candidates, not final saved content;
- the user must perform an explicit accept/confirm/save action before a hint becomes a saved relationship;
- suggestion failure or dismissal must leave manual editing available;
- no auto-save is allowed from hint generation or hint presentation;
- errors must not clear existing user edits.

For the first implementation slice, the safest flow is:

```text
show hint → user accepts → open review/save affordance → user saves → saved relationship appears as normal edge
```

A future implementation may collapse accept and save into one explicit "Save relationship" action, but it must not save before the user has seen and confirmed the relationship.

## Relationship Sources

This planning slice does not implement relationship generation. It only defines acceptable future sources and boundaries.

Allowed future hint sources:

- same person, artist, character, or work metadata;
- same video/channel/source URL/domain;
- similar emotion tags;
- close dates or repeated moments;
- same root tree or branch context;
- deterministic local rules that do not require private data exposure;
- Scout/live AI suggestions only after Scout/auth/rate-limit/provider readiness gates are complete.

Prohibited for this slice:

- automatic hidden edges;
- automatic graph layout;
- default live AI/provider/fetch/network work;
- Scout/live provider calls;
- broad analytics or relationship scoring outside a future contract;
- Browse/Search social-count behavior changes.

## Privacy and Visibility Guardrails

Relationship hints must not expose private data.

Required guardrails:

- hints must not reveal private nodes, private memories, owner identifiers, or hidden tree structure;
- private tree data must not be used to suggest public relationships unless a future privacy contract explicitly allows it;
- public viewer mode must not imply editor authority or write capability;
- reports, logs, screenshots, and contract tests must not print internal IDs or private relationship payloads;
- if hint reasons are shown to users, they must use safe labels such as "같은 아티스트" or "같은 소스" rather than exposing raw private metadata.

## Visual and UX Requirements for Future Implementation

Future UI may include:

- a hint panel near the selected node or canvas toolbar;
- dashed/dotted suggested links on the canvas;
- accept and dismiss controls on the hint item;
- a review/save confirmation before persistence;
- empty state copy that explains hints are optional;
- keyboard-accessible accept/dismiss controls.

Future UI must not:

- blur the line between suggested and saved links;
- create saved edges without explicit user acceptance;
- replace manual tree editing;
- require drag/drop or graph layout for the first slice;
- depend on Scout/live AI by default.

## Recommended Future Slices

1. **Product/design prototype** — show optional relationship hints without saving them.
2. **State machine contract** — define presented/accepted/dismissed/saved states and transitions.
3. **Review/save UX** — implement explicit accept/dismiss and save confirmation.
4. **Storage/runtime slice** — only after product/state contracts are accepted.
5. **Optional Scout/live AI slice** — only after Scout/auth/rate-limit/provider readiness gates are complete.

## Verification Plan

This planning slice requires docs and contract verification only.

Required validation for this PR:

- product plan exists;
- contract test locks review-before-save guardrails;
- docs state manual editing remains the source of truth;
- docs state hints require user acceptance before saving;
- docs state dismissed hints are not saved;
- docs state this slice has no runtime behavior change;
- docs state no Scout/live AI/provider/fetch/network work is included.

Future implementation PRs will need additional verification:

- browser smoke for suggested vs saved link distinction;
- keyboard/accessibility checks for accept/dismiss;
- save/error-state checks;
- privacy checks for private tree/node hints;
- contract tests for state transitions and persistence boundaries.

## Non-goals

This plan does **not**:

- implement relationship hint UI;
- create or save relationship edges;
- add DB schema or migrations;
- add API endpoints;
- implement automatic graph layout;
- implement drag/drop canvas relationships;
- call Scout/live AI/provider/fetch/network services;
- change Browse/Search social-count behavior;
- reopen or alter completed Browse/Search issues;
- change existing manual editor/canvas editing semantics.

## Related Documents

- `#2418` — Explore Obsidian-style relationship graph and canvas links
- `#2454` — Plan relationship hints review-before-save boundary
- `READ_ONLY_LOVETREE_VIEWER_PLAN.md` — viewer/editor separation and public-safe relationship rendering boundary
- `MOMENT_TIMELINE_REORDER_DESIGN.md` — explicit, reviewable editor sequence behavior as a model for phased editor UX
- `lovebud-scout-mvp-boundary.md` — Scout is additive and user-reviewed before saving
- `lovebud-scout-live-provider-prompt-response-contract.md` — suggestion output must remain editable and review-required before save
- `tests/contracts/browse-tree-social-counts-completion-audit-contract.test.cjs` — pattern for docs/contracts-only boundary tests
- `tests/contracts/scout-live-provider-post-mock-readiness-audit-contract.test.cjs` — pattern for locking no-live-provider guardrails

## Closure Recommendation

Close #2454 as completed when:

- this plan is merged;
- the contract test passes;
- `product_index.md` links to this plan;
- no runtime implementation is included in this PR.

#2418 remains open until a later implementation slice is planned and executed.
