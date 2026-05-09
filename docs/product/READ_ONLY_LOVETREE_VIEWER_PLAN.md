# Read-only LoveTree Viewer Plan

Refs #648
Refs #652
Refs #653
Refs #622

## Purpose

LoveBud needs a full read-only LoveTree viewer that presents a shared tree as an actual connected tree structure. Browse cards and 감상허브 remain discovery and preview surfaces; they are not enough to express the core LoveTree metaphor or the relationship between moments.

This document defines the planning boundary for a viewer that can reuse safe visual and layout ideas from the Editor tree canvas while remaining a separate, non-editable public viewing experience.

## Surface model

| Surface | Primary role | Editing allowed | Notes |
| --- | --- | --- | --- |
| Browse card | Public discovery and ranking entry point | No | Compact preview only. |
| 감상허브 | Quick public preview / context surface | No | May show summary and selected highlights. |
| Read-only LoveTree viewer | Full tree structure, branch following, moment selection | No | Primary target of this plan. |
| Moment panel | Focused selected moment content | No in viewer mode | May host future moment-level social space. |
| Editor | Owner creation and editing mode | Yes | Separate owner-only tool surface. |

## Route and entry points

The viewer should have a dedicated public-safe route rather than exposing the Editor page in a disabled state.

Candidate route directions:

- `pages/tree-viewer.html?tree=<public-safe tree reference>`
- `pages/lovetree.html?tree=<public-safe tree reference>`
- a future clean route such as `/tree/<share-slug>` after routing infrastructure exists

Entry points should include:

- Browse card primary click target;
- 감상허브 full-tree CTA;
- share links for public trees;
- owner preview link from My Trees or Editor, clearly labeled as viewer preview.

The route must not require private owner context for anonymous public reads. Authenticated owner preview may exist later, but public viewer behavior must remain safe by default.

## Viewer and Editor separation

The viewer may reuse Editor visual patterns, not Editor authority.

Allowed in viewer mode:

- pan / scroll / fit-to-view interactions;
- select a moment node;
- open or update the selected-moment panel;
- follow branch relationships;
- read public tree metadata and public moment content;
- show future read-only social placeholders when the tree and moment are public.

Forbidden in viewer mode:

- edit controls;
- delete controls;
- drag or reorder handles;
- add moment / add branch controls;
- title edit;
- memo edit;
- source edit;
- owner-only diagnostics;
- internal identifiers in UI, logs, screenshots, or reports;
- implicit fallback to Editor runtime when viewer data fails.

A viewer implementation should not hide Editor controls only with CSS. The preferred boundary is separate viewer rendering code or explicit viewer-mode rendering branches that never create editing affordances.

## Data model direction

The viewer needs enough public-safe data to render a tree without relying on owner-only Editor state.

Minimum public-safe tree payload:

- public tree display name;
- public tree visibility status suitable for anonymous exposure checks;
- ordered list of public moments eligible under parent tree visibility;
- moment display title or fallback label;
- moment media/source summary that is safe for public display;
- branch or parent-child relationship data for layout;
- lightweight tree layout metadata if available;
- public aggregate counts only when they are already policy-approved.

Data that must not be exposed:

- owner identifiers;
- raw private tree or moment identifiers in UI or reports;
- private memories under a public or private parent;
- source fields not already approved for public moment display;
- write/auth capability hints that could imply owner privileges.

The viewer should tolerate missing layout metadata by using a deterministic read-only fallback layout. Missing optional social data must not block tree rendering.

## Tree-level and moment-level social connection

The viewer should be the long-term home for two social scopes:

- tree-level social space: discussion/reactions for the entire public LoveTree;
- moment-level social space: discussion/reactions for the selected public moment.

These scopes must remain distinct. Tree-level comments should not appear as if they belong to a selected moment, and moment-level reactions should not be aggregated as tree-level endorsement unless a later contract explicitly defines that behavior.

Phase 1 should remain read-only placeholder oriented if write APIs are not fully ready. Any future write affordance requires authenticated session checks, moderation posture, rate limiting, and a browser-verified permission model.

## Desktop interaction model

Desktop viewer should prioritize tree comprehension:

- tree/canvas region is the primary surface;
- selected-moment panel is persistent or side-aligned when space allows;
- fit-to-view can be available as a non-editing control;
- node selection updates the current moment without route loss;
- keyboard focus should move predictably between tree nodes and the moment panel;
- empty or sparse trees should still communicate the LoveTree structure intent.

Desktop must not show Editor-style handles, drop zones, or owner-only toolbar actions.

## Mobile interaction model

Mobile viewer should prioritize comprehension without horizontal overflow:

- tree can stack, scroll, or use a simplified vertical layout;
- selected moment can open below the tree or in a dedicated panel state;
- tap targets must remain usable at narrow widths;
- fit/focus actions must not obscure content;
- the viewer must not require drag interactions to understand the tree.

Issue #652 vertical tree layout evaluation should be treated as a child decision for mobile and shared viewer/editor layout strategy, not as permission to merge viewer and Editor behavior.

## Editor-only future planning

Issue #653 editable branch slots belongs to owner-side Editor planning. It may influence how branch relationships are stored, but viewer work must not introduce add-slot affordances into public mode.

Any shared layout component must accept an explicit capability model. Viewer capabilities should be read-only by default; Editor capabilities should be opt-in and owner-gated.

## Auth, visibility, and privacy guardrails

The viewer must enforce public visibility at both parent tree and moment levels.

Required guardrails:

- anonymous viewer reads require public tree eligibility;
- moment display requires parent tree visibility and target moment public eligibility;
- private trees must not expose viewer social placeholders;
- authenticated users without ownership must still see only public-safe content;
- owners may preview public rendering, but owner-only data must not leak into that preview;
- reports must not print tree id, owner id, memory id, copied tree id, DB row values, session data, or secrets.

## Verification requirements

Because this viewer touches Browse, public tree viewing, Auth/visibility boundaries, and responsive behavior, it requires fixed-slot browser verification for implementation PRs.

Implementation PR verification must include:

- fixed test slot deployment;
- deployed SHA matches PR head SHA;
- anonymous public viewer access path;
- authenticated owner preview path when implemented;
- mobile viewport check, including 375px width;
- desktop viewport check;
- no edit/delete/drag/add/title-edit/memo-edit/source-edit affordances in viewer mode;
- no restricted identifiers or secret-like values in logs, screenshots, comments, or reports.

Local-only or text-only checks are not sufficient for final PASS on viewer behavior.

## Protected scope

This planning document does not authorize changes to:

- `experiment/gpt-svg-tree-prototype` / PR #7;
- prototype/reference/demo/variant paths;
- production data migrations;
- Editor runtime behavior;
- Browse/Search runtime behavior.

Any implementation PR should explicitly state whether it changes viewer route, data fetch, rendering, CSS, social placeholder, or Editor-shared layout code.

## Suggested phases

1. Route and public-safe payload contract.
2. Read-only viewer shell and deterministic tree layout fallback.
3. Node selection and selected-moment panel.
4. Mobile vertical or simplified tree behavior evaluation.
5. Tree-level and moment-level social placeholders.
6. Authenticated write affordances only after separate social write contracts exist.

## Acceptance checklist for future implementation PRs

- Dedicated viewer route exists or is explicitly deferred.
- Viewer does not expose Editor page as public surface.
- Viewer can render public tree structure from public-safe data.
- Viewer distinguishes tree-level and moment-level surfaces.
- Viewer mode creates no editing affordances.
- Visibility checks are documented and browser-verified.
- Mobile and desktop behavior are verified on fixed slot.
- PR #7 and prototype/reference/demo/variant paths remain untouched.
