# Vertical Tree Layout Decision

Refs #652
Refs #648
Refs #923

## Purpose

LoveBud should make the LoveTree visual metaphor feel like an actual tree rather than a horizontal timeline. This document records the product/layout decision for Editor and the future read-only LoveTree viewer.

The selected direction is a vertical tree model: the first/root moment sits closer to the lower/root area, and later connected moments grow upward through visible branches.

## Decision

Use a vertical tree-growth model as the target direction for both:

- owner-side Editor tree layout; and
- public read-only LoveTree viewer layout.

This does not mean a quick CSS rotation of the current canvas. The implementation should be treated as a layout model and interaction change with its own runtime PRs and browser verification follow-up.

## Product rationale

A LoveTree should communicate growth, branching, and emotional progression. The current horizontal flow can read as a timeline or carousel, especially when moments appear side-by-side.

A vertical tree model better supports the product metaphor:

- the first moment feels like the root or origin;
- connected memories feel like branches growing out of that root;
- branch splits are easier to understand as growth paths;
- later moments can visually rise from earlier moments;
- the read-only viewer can present a full tree shape rather than a preview card or video-led timeline.

## Target visual model

The intended model is tree-shaped, not just vertically stacked.

Recommended structure:

```text
           later moment
          /            \
   branch moment      branch moment
          \            /
        connected moment
              |
        first/root moment
```

The root or first moment should sit near the lower center when possible. Later moments extend upward and outward. Branches should remain legible and should not collapse into a simple one-column list unless the viewport requires a simplified mobile fallback.

## Editor behavior direction

The Editor should eventually use the same vertical growth logic but with owner-only capabilities layered on top.

Allowed Editor capabilities:

- select moment;
- add next moment;
- edit title/memo/source where owner-authorized;
- delete where owner-authorized;
- focus selected moment;
- fit-to-view;
- safe placement or layout adjustment if implemented.

However, vertical layout work must not bundle unrelated editing feature expansion. Add/edit/delete/source controls should remain existing capability surfaces, not layout side effects.

## Read-only viewer behavior direction

The read-only LoveTree viewer should use the vertical model without Editor authority.

Allowed viewer capabilities:

- view public tree structure;
- select a public moment;
- inspect selected moment content;
- follow visible branch relationships;
- fit or focus the tree;
- open public-safe moment detail where applicable.

Forbidden viewer capabilities:

- edit;
- delete;
- add;
- drag/reorder;
- title edit;
- memo edit;
- source edit;
- owner-only diagnostics;
- hidden Editor fallback controls.

Viewer implementation must not expose `pages/editor.html` as the public viewing surface.

## Desktop layout principles

Desktop should prioritize tree comprehension.

- Root/first moment starts near lower center.
- Primary connected path rises upward.
- Branch splits move left/right from parent nodes.
- Selected node remains visible without losing the whole-tree context.
- Moment panel can sit to the side or below depending on available width.
- Fit-to-view should frame the full tree shape.
- Long trees may require pan/scroll, but the first impression should still read as a tree.

## Mobile layout principles

Mobile should preserve the tree metaphor while avoiding horizontal overflow.

Acceptable mobile adaptations:

- vertical scroll through a simplified tree shape;
- reduced horizontal branch spread;
- selected moment panel below the tree;
- focus-selected or fit-to-view control;
- collapsed branch spacing when necessary.

Unacceptable mobile adaptations:

- turning the viewer into a plain list without tree relationship cues;
- requiring precise drag to understand the tree;
- hiding selected moment context behind ambiguous controls;
- exposing Editor controls to public users.

## Layout risks to solve in implementation

Vertical layout implementation must account for:

- node overlap;
- branch density;
- long trees;
- sparse trees;
- mobile 375px width;
- pan/zoom or scroll behavior;
- fit-to-view behavior;
- selected moment focus;
- keyboard focus order;
- screenshot-based visual review;
- public/private visibility boundaries in viewer mode.

## Phased implementation recommendation

Do not convert Editor and viewer in one large PR.

Suggested phases:

1. Read-only viewer route shell and public-safe payload boundary (#923).
2. Static vertical layout renderer for public-safe moment data.
3. Viewer node selection and selected-moment panel.
4. Mobile vertical tree behavior and 375px verification.
5. Editor vertical layout adoption after viewer model is stable.
6. Optional owner-only placement refinements or editable branch slots after separate planning (#653).

## Implementation guardrails

- No PR #7 changes.
- No prototype/reference/demo/variant changes.
- No backend/schema migration unless a separate issue approves it.
- No broad Browse redesign.
- No My Trees redesign.
- No public Editor exposure.
- No owner IDs, memory IDs, tree IDs, DB rows, raw payloads, sessions, cookies, tokens, headers, passwords, or private URLs in reports.

## Verification policy

Runtime implementation PRs may merge after code, local verification, CI, scope review, and product-direction review under the current separated verification policy.

Browser verification remains required but should be tracked as a separate post-merge/post-deploy Browser Verification issue.

For vertical layout implementation, browser verification should include:

- deployed SHA match;
- desktop screenshot;
- mobile 375px screenshot;
- tree shape visible;
- root/first moment lower than connected later moments when data supports it;
- branch relationships legible;
- selected moment still usable;
- no viewer edit/add/delete/source-edit controls;
- no fatal console errors;
- no private data exposure.

## Acceptance criteria for #652

This planning decision is complete when:

- the project has selected vertical tree-growth as the target model;
- the document distinguishes vertical tree shape from a plain vertical list;
- Editor and viewer capability differences are documented;
- desktop and mobile layout principles are documented;
- implementation risks and phased rollout are documented;
- #923 or later implementation issues can proceed from this decision.
