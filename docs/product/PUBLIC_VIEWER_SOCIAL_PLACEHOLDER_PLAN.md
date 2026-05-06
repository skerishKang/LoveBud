# Public Viewer Social Placeholder Plan

Refs #755

## Purpose

Define read-only social placeholder placement for public LoveTree viewer surfaces before comment or reaction writing is implemented.

This document is planning-only. It does not add UI, API, Auth, database, moderation, or runtime behavior.

## Product boundary

Public viewer social surfaces are planned as two distinct scopes:

1. **Tree-level social space** — belongs to the whole public LoveTree.
2. **Moment-level social space** — belongs to the selected public moment inside that tree.

These scopes must remain visually and semantically separate. A user should not confuse a whole-tree discussion area with a selected-moment discussion area.

## Phase model

| Phase | Behavior | Write affordance |
|---|---|---|
| Phase 1 | Read-only placeholders only | Hidden |
| Phase 2 | Read-only comments/counts when backend read contracts exist | Hidden or disabled with explanation |
| Phase 3 | Authenticated writing when moderation baseline and write API exist | Enabled only for verified authenticated flows |

Phase 1 is the only scope covered by this plan. It should set expectations without implying that social writing is ready.

## Tree-level placeholder placement

The tree-level placeholder should appear in the public viewer after the tree identity area and before the moment list or selected-moment content.

Recommended desktop placement:

- below tree title, summary, visibility-safe metadata, and primary viewing context;
- above the connected moments list or timeline section;
- visually quiet, not a primary CTA;
- one compact empty-state block.

Recommended mobile placement:

- after the tree identity block;
- before the first long moment/timeline section when vertical space allows;
- avoid sticky placement;
- avoid creating a second scroll region.

Phase 1 copy direction:

- Korean: `이 러브트리에 남겨질 감상 공간은 준비 중이에요.`
- English: `A reflection space for this LoveTree is coming later.`

The copy should communicate future availability without presenting an enabled comment box.

## Moment-level placeholder placement

The moment-level placeholder should appear inside the selected-moment detail area, after the moment content and before secondary navigation or related moments.

Recommended desktop placement:

- inside the selected moment panel or detail column;
- below media, title, memo, and emotion tags;
- above related moments or next/previous controls;
- clearly scoped to the selected moment.

Recommended mobile placement:

- directly after the selected moment content;
- collapsed or compact by default if the moment content is long;
- no nested scroll container;
- no fixed footer interaction.

Phase 1 copy direction:

- Korean: `이 순간에 대한 감상은 나중에 나눌 수 있어요.`
- English: `Reflections for this moment will be available later.`

## Empty-state rules

Placeholder empty states must be descriptive but non-interactive in Phase 1.

Required rules:

- no textarea;
- no submit button;
- no fake disabled composer that looks almost usable;
- no login prompt for writing until the write path is implemented;
- no reaction buttons unless count/read behavior is implemented;
- no raw private identifiers or payload-derived labels.

Allowed elements:

- small section label;
- short explanatory copy;
- optional quiet `준비 중` / `Coming later` badge;
- optional static icon if it does not look like an action.

## Owner/editor affordance separation

Public viewer social placeholders must not expose owner/editor controls.

Rules:

- non-owner public viewers must not see editor-only moderation, delete, pin, or manage actions;
- owners may eventually see moderation affordances, but not in Phase 1;
- authenticated writing must remain hidden until the write API and moderation baseline are ready;
- private trees must not show public social placeholders.

## Visibility and privacy guardrails

Future implementation must respect the following:

- public viewer placeholders appear only when the parent LoveTree is publicly readable;
- selected-moment placeholders appear only when both the parent tree and target moment are publicly readable;
- private tree pages must not show public social placeholders;
- reports must use safe status labels only;
- no tree IDs, owner IDs, memory IDs, copied tree IDs, DB rows, tokens, sessions, cookies, credentials, or raw payloads may appear in reports.

## Runtime verification requirements for future UI PRs

Any future UI implementation must be verified in a runtime target with deployed SHA matching the PR head.

Required report fields:

1. Public viewer route access: PASS/FAIL.
2. Tree-level placeholder visible only on public tree: PASS/FAIL/NOT_VERIFIED.
3. Moment-level placeholder visible only on public selected moment: PASS/FAIL/NOT_VERIFIED.
4. Private tree placeholder exposure: PRESENT/ABSENT/NOT_VERIFIED.
5. Write affordance in Phase 1: PRESENT/ABSENT.
6. Desktop layout: PASS/FAIL.
7. Mobile 375px layout: PASS/FAIL.
8. Nested scroll trap: PRESENT/ABSENT.
9. Fatal console/network errors: NONE/PRESENT.
10. Secret/private payload exposure: NO.

## Implementation split

Future implementation should be split narrowly:

| Unit | Scope | Runtime verification |
|---|---|---|
| A | Add read-only tree-level placeholder copy and placement | Required |
| B | Add read-only moment-level placeholder copy and placement | Required |
| C | Wire tree-level read counts/comments when API exists | Required |
| D | Wire moment-level read counts/comments when API exists | Required |
| E | Add authenticated write affordance after moderation/write API readiness | Required |

Do not combine Phase 1 placeholders with social writing, moderation actions, schema changes, or comment API implementation.

## Out of scope

- comment read/write implementation;
- reactions/counts implementation;
- moderation/reporting implementation;
- social UI redesign;
- Browse card redesign;
- My Trees card cleanup;
- Auth/API/backend/DB changes;
- package/workflow changes;
- PR #7 / prototype / reference / demo / variant paths.

## Status

- Planning: READY
- Runtime implementation: NOT STARTED
- Related issue: #755
- Parent social model: #622
