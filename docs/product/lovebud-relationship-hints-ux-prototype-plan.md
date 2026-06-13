# Relationship Hints UX Prototype Plan

> Docs/contracts-only UX prototype planning slice for #2456. This plan defines how optional relationship hints should be shown as a non-saving prototype while preserving the #2454 review-before-save boundary. It does not implement runtime UI, saved edges, storage, graph layout, or live provider work.

## Status

- Refs: #2456, #2418
- Depends on: #2454 — Plan relationship hints review-before-save boundary
- Parent: #2418 — Explore Obsidian-style relationship graph and canvas links
- Scope: docs/contracts-only UX prototype planning slice
- Runtime behavior change: none
- Saved relationship behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend UI implementation: none
- Automatic graph layout: none
- Scout/live AI/provider/fetch/network work: none
- Browse/Search social-count changes: none

## Executive Summary

The next safe slice for #2418 is a **relationship hints UX prototype without saving**. The prototype should answer: “Can users understand and act on optional relationship hints without confusing them with saved relationships?”

Core direction:

1. Show relationship hints as provisional, non-persistent suggestions in the editor/canvas context.
2. Keep manual tree/canvas editing as the source of truth.
3. Make suggested links visibly different from saved links.
4. Reserve future accept/dismiss affordance placement without saving anything in this slice.
5. Lock no-save, no-runtime, no-live-provider boundaries in docs and contract tests.

This slice is about product/design planning only. It does not add working UI, saved edges, DB/API changes, automatic graph layout, or Scout/live AI/provider work.

## UX Prototype Purpose

The UX prototype should help the team evaluate whether relationship hints are understandable before any persistence or live generation work exists.

Prototype goals:

- Show that hints are optional suggestions, not automatic relationships.
- Let users visually compare suggested links against saved links.
- Make the future accept/dismiss surface discoverable without committing to final implementation.
- Preserve editor confidence: users should never feel that hints silently changed their tree.
- Keep the prototype safe to remove or replace without data loss.

Prototype non-goals:

- Do not implement a working runtime UI in this PR.
- Do not create, save, or persist relationship edges.
- Do not add DB schema, migrations, or API endpoints.
- Do not run automatic graph layout.
- Do not call Scout, live AI, external providers, or network services.
- Do not change Browse/Search social-count behavior.

## Prototype Surface

The future prototype should live in the owner-side Editor/canvas flow, not in the read-only viewer.

Recommended prototype locations:

| Area | Role | Notes |
| --- | --- | --- |
| Selected node / selected moment context | Primary hint anchor | Hints should relate to the currently selected node or moment. |
| Canvas toolbar or side panel | Secondary hint list | A panel is safer than ambiguous inline canvas controls for the first prototype. |
| Canvas relationship line | Visual preview only | Suggested links may be previewed, but must remain visually distinct from saved links. |
| Empty state area | Optional prototype copy | Explain that hints are suggestions and that this prototype does not save relationships. |

The prototype should not appear in read-only viewer mode because viewer mode must not imply editor authority or write capability.

## Visual Language: Suggested vs Saved Links

Suggested links must be impossible to mistake for saved relationships.

Recommended visual treatment:

- dashed or dotted line, never the same solid style as saved edges;
- lower opacity or softer color than saved links;
- small suggestion badge such as `관계 제안` or `제안 연결`;
- tooltip or caption explaining that the link is not saved;
- no saved-edge affordance until a future accept/save flow exists;
- no drag/drop handle on suggested links;
- no automatic layout that hides the distinction.

Suggested link state should be visually closer to a preview than a committed relationship. The user should be able to tell at a glance: “This is something LoveBud is suggesting; it is not my tree yet.”

## Empty / Loading / Disabled States

Because this slice is a prototype plan, state definitions are product-level only.

| State | Prototype meaning | Required behavior |
| --- | --- | --- |
| Empty | No hints are available for the selected node/moment | Show optional copy: “아직 관계 제안이 없어요.” Do not create a saved edge. |
| Loading | Future data source may be preparing hints | Use non-blocking prototype loading copy; do not block manual editing. |
| Disabled | No selection, editor mode unavailable, or prototype unavailable | Hide or disable hint surface without changing saved tree data. |
| Error | Prototype hint preparation failed | Show safe copy and keep manual editing available. |
| No hints after dismiss | User dismissed available hints | Hide or collapse the hint surface without saving a relationship. |

Loading must not imply live provider work in this slice. Future loading copy may be prepared with mock/stub data only.

## Future Accept / Dismiss Affordance Placement

The prototype should define where future controls would appear, without implementing save behavior.

Recommended placement:

1. **Primary hint panel**
   - One row/card per relationship hint.
   - Future controls appear on the hint card, not directly on the canvas line.
   - Suggested controls: `살펴보기` / `연결 검토` for accept path; `닫기` / `제외` for dismiss path.

2. **Canvas line preview**
   - Suggested line remains non-interactive in the first prototype.
   - It may expose a lightweight tooltip or badge, but should not expose save/delete/drag controls.

3. **Future review/save affordance**
   - Accept should open a review/save affordance, not save immediately.
   - Save should require explicit confirmation in a later slice.
   - Dismiss should hide/remove the suggestion without creating a hidden edge.

This preserves the #2454 rule: a relationship hint is only a suggestion until the user accepts and saves it.

## No-Save Prototype Boundary

The UX prototype must be non-persistent.

Required no-save rules:

- prototype hints are temporary presentation data only;
- suggested links are not saved relationships;
- dismissing a suggested link does not create a saved edge;
- accepting a suggested link in a future prototype must not save an edge until a later review/save contract exists;
- no hidden edge or suppression state should be confused with a saved relationship;
- closing the prototype or refreshing the editor must not leave phantom saved links.

The first UX prototype may use mock/stub data only. It must not write to DB, call API, or persist relationship hints.

## Manual Editing Source of Truth

Hints must not replace or override manual editing.

Required source-of-truth rules:

- existing manual tree/canvas editing remains the source of truth;
- hints must not silently create, overwrite, or reorder saved relationships;
- if a hint conflicts with an existing saved relationship, the saved relationship remains authoritative until the user explicitly changes it;
- users must be able to continue editing manually even when hints are unavailable;
- hint errors must not clear existing user edits.

## Privacy and Visibility Guardrails

Prototype hints must not expose private data.

Required guardrails:

- no private nodes, private memories, owner identifiers, or hidden tree structure in UI, logs, screenshots, or reports;
- private tree data must not be used to suggest public relationships unless a future privacy contract explicitly allows it;
- public viewer mode must not imply editor authority or write capability;
- if hint reasons are shown, use safe labels such as `같은 아티스트`, `같은 소스`, `비슷한 순간` rather than raw private metadata;
- contract tests and docs must not print internal IDs or private relationship payloads.

## Accessibility Requirements for Future Prototype

Future implementation should keep hint surfaces accessible.

Minimum requirements:

- keyboard-accessible accept/dismiss controls;
- visible focus states for suggested link and hint card controls;
- screen-reader labels that say the link is a suggestion, not saved;
- sufficient color contrast even when suggested links use softer colors;
- avoid color-only distinction; use line style, badge, and text together.

## Scout / Live AI Boundary

This slice must not call Scout, live AI, external providers, or network services.

Allowed in future planning:

- deterministic local rules after privacy review;
- mock/stub prototype data;
- future Scout/live AI suggestions only after Scout/auth/rate-limit/provider readiness gates are complete.

Prohibited for this slice:

- Scout/live provider calls;
- default live AI/provider/fetch/network work;
- network dependency for prototype hints;
- relationship scoring outside a future contract.

## Recommended Future Slices

1. **UX prototype runtime slice** — render non-saving hints with mock data and suggested-link visual language.
2. **State machine contract** — define presented/accepted/dismissed/saved states and transitions.
3. **Accept/dismiss UX slice** — implement explicit hint-card controls without persistence.
4. **Review/save UX slice** — allow accepted hints to become saved relationships only after confirmation.
5. **Storage/runtime slice** — add persistence only after product/state contracts are accepted.
6. **Optional Scout/live AI slice** — only after Scout/auth/rate-limit/provider readiness gates are complete.

## Verification Plan

This planning slice requires docs and contract verification only.

Required validation for this PR:

- UX prototype plan exists;
- contract test locks no-save, no-runtime, no-live-provider boundaries;
- docs define suggested-link visual language;
- docs define future accept/dismiss affordance placement;
- docs define empty/loading/disabled states at product/design level;
- docs state manual editing remains the source of truth;
- docs state the prototype does not create saved edges;
- docs state no DB/API/migration changes;
- docs state no automatic graph layout;
- docs state no Scout/live AI/provider/fetch/network work;
- docs state no Browse/Search social-count changes.

Future implementation PRs will need additional verification:

- browser smoke for suggested vs saved link distinction;
- keyboard/accessibility checks for hint cards and future accept/dismiss controls;
- no-save/no-persistence checks for prototype data;
- privacy checks for private tree/node hints;
- contract tests for state transitions and persistence boundaries.

## Related Documents

- `#2456` — Prototype relationship hints without saving
- `#2454` — Plan relationship hints review-before-save boundary
- `#2418` — Explore Obsidian-style relationship graph and canvas links
- `lovebud-relationship-hints-review-before-save-plan.md` — review-before-save semantics and no-save source-of-truth boundary
- `READ_ONLY_LOVETREE_VIEWER_PLAN.md` — viewer/editor separation and public-safe relationship rendering boundary
- `MOMENT_TIMELINE_REORDER_DESIGN.md` — explicit, reviewable editor sequence behavior as a model for phased editor UX
- `lovebud-scout-mvp-boundary.md` — Scout is additive and user-reviewed before saving
- `lovebud-scout-live-provider-prompt-response-contract.md` — suggestion output must remain editable and review-required before save
- `tests/contracts/relationship-hints-review-before-save-plan-contract.test.cjs` — pattern for relationship hints planning contracts
- `tests/contracts/browse-tree-social-counts-completion-audit-contract.test.cjs` — pattern for docs/contracts-only boundary tests

## Closure Recommendation

Close #2456 as completed when:

- this UX prototype plan is merged;
- the contract test passes;
- `product_index.md` links to this plan;
- no runtime implementation is included in this PR.

#2418 remains open until a later implementation slice is planned and executed.
