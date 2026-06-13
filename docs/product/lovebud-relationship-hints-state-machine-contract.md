# Relationship Hints State Machine Contract

> Docs/contracts-only state machine slice for #2458. This contract defines relationship hint states and transitions before any runtime implementation. It does not implement UI, storage, API, graph layout, or AI behavior.

## Status

- Refs: #2458, #2418
- Depends on: #2454, #2456
- Parent: #2418 — Explore Obsidian-style relationship graph and canvas links
- Scope: docs/contracts-only state machine slice
- Runtime behavior change: none
- Saved relationship behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend UI implementation: none
- Automatic graph layout: none
- Scout/live AI/provider/fetch/network work: none
- Browse/Search social-count changes: none

## Executive Summary

The relationship hints state machine must separate **suggestion lifecycle** from **saved relationship lifecycle**.

The allowed states are:

| State | Meaning | Saved relationship? |
| --- | --- | --- |
| `not_shown` | No hint is currently visible for the selected node/moment. | No |
| `presented` | A relationship hint is visible as a suggestion. | No |
| `accepted_pending_save` | The user accepted/reviewed a suggestion, but no relationship has been saved yet. | No |
| `saved_relationship` | An explicit save/confirm step created a real relationship edge. | Yes |
| `dismissed` | The user dismissed a suggestion. | No |
| `hidden` | The hint surface is closed/collapsed/hidden. | No |
| `error` | Hint preparation or a future validation step failed safely. | No |

Core rule: `presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are **not saved relationships**. Only `saved_relationship` represents a persisted relationship edge, and it may only be reached through an explicit future save/confirm transition.

## State Categories

### Suggestion lifecycle states

These states describe hint presentation and review state only:

- `not_shown`
- `presented`
- `accepted_pending_save`
- `dismissed`
- `hidden`
- `error`

They must not be treated as saved edges, persisted relationships, graph data, or user-authored relationship intent.

### Saved relationship state

- `saved_relationship`

This state exists only after a future explicit save/confirm step. It is outside the no-save prototype boundary and must not be produced by automatic hint presentation, accept-for-review, dismiss, hide, or error handling.

## Allowed Transitions

| From | Event | To | Persistence effect |
| --- | --- | --- | --- |
| `not_shown` | `present_hint` | `presented` | No persistence; hint is temporary presentation data only. |
| `not_shown` | `hide_or_reset` | `hidden` / `not_shown` | No persistence. |
| `presented` | `accept_for_review` | `accepted_pending_save` | No persistence; this is review intent only. |
| `presented` | `dismiss_hint` | `dismissed` | No persistence; dismiss is not a saved edge. |
| `presented` | `hide_hint_surface` | `hidden` | No persistence. |
| `presented` | `hint_error` | `error` | No persistence; keep manual editing available. |
| `accepted_pending_save` | `confirm_save_relationship` | `saved_relationship` | Future persistence only; requires explicit save/confirm. |
| `accepted_pending_save` | `back_to_review` | `presented` | No persistence. |
| `accepted_pending_save` | `dismiss_pending_hint` | `dismissed` | No persistence. |
| `accepted_pending_save` | `hide_pending_hint` | `hidden` | No persistence; hiding pending intent must not save. |
| `accepted_pending_save` | `save_validation_error` | `error` | No persistence; user may retry review. |
| `dismissed` | `hide_dismissed_hint` | `hidden` | No persistence. |
| `dismissed` | `reset_hint_lifecycle` | `not_shown` | No persistence. |
| `dismissed` | `present_new_hint` | `presented` | No persistence; new hint is still a suggestion. |
| `hidden` | `present_hint` | `presented` | No persistence. |
| `hidden` | `reset_hint_lifecycle` | `not_shown` | No persistence. |
| `error` | `retry_hint` | `presented` | No persistence. |
| `error` | `hide_after_error` | `hidden` | No persistence. |
| `saved_relationship` | `relationship_hint_lifecycle_complete` | `not_shown` / `hidden` | Hint lifecycle ends; saved edge remains separate. |

## Forbidden Transitions

The following transitions are forbidden because they would blur the boundary between suggestions and saved relationships:

| From | Forbidden event | Forbidden to | Reason |
| --- | --- | --- | --- |
| `not_shown` | automatic relationship creation | `saved_relationship` | Saved relationships cannot be created without explicit user save/confirm. |
| `presented` | automatic save | `saved_relationship` | A visible suggestion is not user-authored relationship data. |
| `presented` | dismiss-as-save | `saved_relationship` | Dismiss must remove the suggestion, not save it. |
| `presented` | hide-as-save | `saved_relationship` | Hiding UI must not create graph data. |
| `accepted_pending_save` | implicit timeout save | `saved_relationship` | Pending review intent must not persist without confirmation. |
| `accepted_pending_save` | close-panel-as-save | `saved_relationship` | Closing a review surface is not save confirmation. |
| `dismissed` | any event | `saved_relationship` | Dismissed suggestions are explicitly not saved. |
| `hidden` | any event | `saved_relationship` | Hidden states must not create hidden edges. |
| `error` | any event | `saved_relationship` | Error states must not create relationships. |
| `saved_relationship` | dismiss/hide | `dismissed` / `hidden` as hint state | A saved relationship is not a hint state; hide/dismiss should apply to UI presentation only. |

## Save / Confirm Boundary

`accepted_pending_save` means:

- the user has reviewed or accepted a suggestion for possible saving;
- the relationship is still **not saved**;
- no edge is persisted;
- no graph layout changes are committed;
- closing, hiding, dismissing, or refreshing must not convert it to a saved relationship.

A relationship may become `saved_relationship` only through a future explicit transition such as `confirm_save_relationship`. That future transition must require a clear user action, not an automatic timeout, not a panel close, not a dismiss, and not a hint presentation.

## Dismiss / Hidden / Error Semantics

### `dismissed`

- User chose not to act on the suggestion.
- No saved edge is created.
- No hidden edge is created.
- No suppression state may be confused with a saved relationship.
- Future implementations may hide or collapse the hint after dismiss.

### `hidden`

- The hint surface is closed or collapsed.
- Hidden is a presentation state, not a saved edge.
- Hiding `accepted_pending_save` must not save.
- Hiding `presented` must not save.
- Hiding `error` must not save.

### `error`

- Hint preparation or future validation failed safely.
- Error must not create saved relationships.
- Error must not clear manual edits.
- Manual editing remains available.
- Retry may return to `presented` with a new suggestion.

## Persistence Boundary

This state machine contract does **not** authorize persistence.

- `not_shown`, `presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are non-persistent suggestion states.
- `saved_relationship` is the only saved state.
- Persistence requires a later storage/runtime slice after this contract is accepted.
- This slice must not add DB schema, migrations, API endpoints, or saved-edge implementation.

## Runtime Implementation Boundary

This slice is docs/contracts-only.

It must not:

- implement runtime UI;
- create saved relationship edges;
- add DB schema or migrations;
- add API endpoints;
- run automatic graph layout;
- call Scout, live AI, external providers, or network services;
- change Browse/Search social-count behavior.

Future runtime implementations must add separate contracts and tests before introducing persistence or live provider behavior.

## Privacy and Visibility Guardrails

Relationship hint states must not expose private data.

- Private nodes, private memories, owner identifiers, or hidden tree structure must not appear in UI, logs, screenshots, reports, or contract test fixtures.
- Private tree data must not be used to suggest public relationships unless a future privacy contract explicitly allows it.
- If hint reasons are shown, use safe labels such as `같은 아티스트`, `같은 소스`, `비슷한 순간`.
- Contract tests must not print internal IDs or private relationship payloads.

## Accessibility Requirements for Future Runtime

Future runtime implementations should keep state transitions accessible:

- keyboard-accessible accept, save/confirm, dismiss, and hide controls;
- visible focus states for hint cards and suggested-link previews;
- screen-reader labels that distinguish suggestions from saved relationships;
- sufficient color contrast even when suggested links use softer colors;
- non-color-only distinction between `presented`/`accepted_pending_save` and `saved_relationship`.

## Scout / Live AI Boundary

This state machine contract is provider-agnostic and must not depend on Scout or live AI.

Allowed future sources, only after separate readiness gates:

- deterministic local rules;
- mock/stub prototype data;
- Scout/live AI suggestions after auth, rate-limit, provider, and privacy readiness.

Prohibited for this slice:

- Scout/live provider calls;
- default live AI/provider/fetch/network work;
- network dependency for hint state transitions;
- relationship scoring outside a future contract.

## Recommended Future Slices

1. **Runtime state machine implementation** — render state transitions with mock data only.
2. **Accept/dismiss UX slice** — implement explicit hint-card controls without persistence.
3. **Review/save UX slice** — allow `accepted_pending_save` to become `saved_relationship` only after confirmation.
4. **Storage/runtime slice** — persist saved relationships after state and review/save contracts are accepted.
5. **Optional Scout/live AI slice** — only after Scout/auth/rate-limit/provider readiness gates are complete.

## Verification Plan

This planning slice requires docs and contract verification only.

Required validation for this PR:

- state machine contract document exists;
- contract test locks the exact state list;
- contract test locks that `presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are not saved relationships;
- contract test locks that `saved_relationship` requires explicit save/confirm;
- contract test locks forbidden transitions;
- contract test locks no runtime, no DB/API/migration, no automatic layout, no Scout/live provider, and no Browse/Search changes;
- `product_index.md` links to this state machine contract.

Future implementation PRs will need additional verification:

- unit tests for state transition functions;
- contract tests for allowed and forbidden transitions;
- browser smoke for suggested vs saved link distinction;
- no-persistence checks for non-saved states;
- privacy checks for private tree/node hints;
- accessibility checks for accept/dismiss/save controls.

## Related Documents

- `#2458` — Lock relationship hints state machine boundary
- `#2456` — Prototype relationship hints without saving
- `#2454` — Plan relationship hints review-before-save boundary
- `#2418` — Explore Obsidian-style relationship graph and canvas links
- `lovebud-relationship-hints-review-before-save-plan.md` — review-before-save semantics and no-save source-of-truth boundary
- `lovebud-relationship-hints-ux-prototype-plan.md` — non-saving UX prototype and suggested-link visual language
- `READ_ONLY_LOVETREE_VIEWER_PLAN.md` — viewer/editor separation and public-safe relationship rendering boundary
- `MOMENT_TIMELINE_REORDER_DESIGN.md` — explicit, reviewable editor sequence behavior as a model for phased editor UX
- `lovebud-scout-mvp-boundary.md` — Scout is additive and user-reviewed before saving
- `lovebud-scout-live-provider-prompt-response-contract.md` — suggestion output must remain editable and review-required before save
- `tests/contracts/relationship-hints-review-before-save-plan-contract.test.cjs` — pattern for relationship hints planning contracts
- `tests/contracts/relationship-hints-ux-prototype-plan-contract.test.cjs` — pattern for no-save UX prototype contracts
- `tests/contracts/browse-tree-social-counts-completion-audit-contract.test.cjs` — pattern for docs/contracts-only boundary tests

## Closure Recommendation

Close #2458 as completed when:

- this state machine contract is merged;
- the contract test passes;
- `product_index.md` links to this state machine contract;
- no runtime implementation is included in this PR.

#2418 remains open until a later runtime implementation slice is planned and executed.
