# Search Card Event Delegation Audit

**Status:** Draft audit  
**Owner:** CTO / Engineering  
**Related issue:** #123  
**Scope:** docs-only audit; no runtime behavior changes

---

## 1. Purpose

This document records the decision boundary for Search/Browse card event handling before or after delegation refactors.

Issue #123 identified that Search card interactions had mixed patterns:

- share-link handling used document-level event delegation;
- tree card click and keyboard selection used per-card direct listeners after render;
- card re-rendering required listener reattachment after `innerHTML` updates.

The goal is to preserve Search/Browse behavior while making future Search refactors safer. This document is descriptive and planning-only. It does not approve runtime changes by itself.

---

## 2. Current interaction surface

Primary user interactions to preserve:

```text
click tree card
Enter / Space on focused tree card
open selected preview on desktop
open selected preview on mobile
preserve active-card / aria-pressed state
ignore nested action buttons and links
copy view link action
copy/import tree action when present
load more / filter / sort / query state behavior
```

Primary files to inspect before implementation:

```text
pages/search.html
js/search.js
js/search/search-ui.js
js/search/card-renderer.js
js/search/preview-renderer.js
js/search/preview-controller.js
js/i18n/i18n-search.js
css/search.css
css/search/*
```

Related contracts:

```text
LoveBudSearchCardRenderer output
.tree-card[data-tree-id]
.tree-card.is-active
aria-pressed
role / tabindex keyboard affordance
mobile preview open/close behavior
Search URL state q/category/sort/limit/tree
```

---

## 3. Direct listener model

The original model attached click/keydown listeners directly to rendered `.tree-card` nodes.

Benefits:

- simple local mental model;
- direct closure can reference the tree object;
- easy to call `selectTree(tree, card)`;
- low complexity for small lists.

Risks:

- listeners must be reattached after each render;
- repeated render paths can create listener churn;
- future refactors can forget to call attachment helpers;
- direct closures can become stale if DOM and data maps diverge;
- keyboard and click behavior can drift if handled in multiple places.

This model is acceptable only when card count is small, re-render paths are centralized, and attachment is covered by smoke tests.

---

## 4. Delegated listener model

A delegated model binds listeners once at a stable container and resolves the target card through DOM traversal.

Recommended stable containers:

```text
resultsList
growingList
or a shared Search results root if both containers can be handled safely
```

Required behavior:

- find the nearest `.tree-card[data-tree-id]` from the event target;
- ignore events originating from nested interactive controls;
- resolve tree data from a current map keyed by card or tree id;
- call the same selection path used by the direct-listener model;
- preserve keyboard behavior for Enter and Space;
- keep active-card and `aria-pressed` state synchronized;
- keep mobile preview behavior unchanged.

Benefits:

- listeners are registered once per stable container;
- render churn does not require reattaching per-card handlers;
- card behavior is easier to audit in one location;
- nested action protection can be centralized;
- future renderer splits are less likely to break interaction wiring.

Risks:

- DOM-to-data mapping must be accurate;
- stale maps can select the wrong tree;
- nested button/link protection must be comprehensive;
- keyboard event target handling must not break accessibility;
- multiple containers can accidentally double-handle events if binding is not guarded.

---

## 5. Required output contract from card renderer

Delegation depends on stable renderer output.

Minimum contract:

```html
<article class="tree-card" data-tree-id="..." tabindex="0" role="button" aria-pressed="false">
  ...
</article>
```

Required properties:

| Requirement | Reason |
|---|---|
| `.tree-card` class | delegated selector target |
| `data-tree-id` | DOM-to-data lookup key |
| focusable card | keyboard selection support |
| `role="button"` or equivalent semantics | screen reader/action semantics |
| `aria-pressed` or selected state | active selection state reporting |
| nested controls marked as real controls | event guard can ignore them |

Do not change renderer output class names or data attributes without updating delegation logic and tests together.

---

## 6. Nested interactive element guard

Delegated card selection must not swallow or duplicate nested action behavior.

Treat these as interactive descendants:

```text
button
a
input
select
textarea
summary
[role="button"]
[role="link"]
[data-card-action]
[data-preview-action]
[data-copy-action]
```

Rule:

```text
If the event originated from an interactive descendant, do not trigger tree card selection unless that control explicitly opts in.
```

This protects actions such as:

- copy view link;
- copy/import tree;
- mobile preview close;
- future share/favorite/report actions;
- card-level links if added later.

---

## 7. DOM-to-data mapping options

### Option A — map by `data-tree-id`

Maintain a `Map<string, tree>` keyed by tree id.

Pros:

- easy to debug;
- survives DOM re-creation;
- aligns with URL deep link behavior.

Cons:

- id collisions or missing ids must be handled;
- map must be refreshed when result sets change.

### Option B — `WeakMap<Element, tree>`

Associate each card element with its source tree.

Pros:

- direct and avoids id collision concerns;
- element garbage collection can clean old entries.

Cons:

- map must be rebuilt for each render;
- harder to reconcile with deep link lookup.

Recommended practical approach:

```text
Use a current tree-id map for selection data, and optionally use a WeakMap only when renderer-level element association is unavoidable.
```

---

## 8. Accessibility requirements

Delegated selection must preserve keyboard behavior.

Required checks:

```text
Tab focuses card
Enter selects card
Space selects card and prevents page scroll when appropriate
aria-pressed updates on selected card
previous active card resets aria-pressed
nested controls remain keyboard-operable
focus is not stolen unexpectedly when mobile preview opens
```

Do not treat click-only behavior as sufficient.

---

## 9. Mobile preview requirements

Mobile card selection is runtime-sensitive because selection can open a preview sheet/panel and alter page scroll.

Required checks:

```text
375px card selection works
390/393px modern phone smoke works
430px large phone smoke works
mobile preview opens without page jump
mobile preview close restores expected state
nested buttons do not trigger card selection
Enter/Space selection works on focused card
```

Use the current mobile viewport policy when verifying new Search/Browse interaction work.

---

## 10. Verification checklist for future implementation PRs

Any PR that changes Search card event binding should report:

```text
Changed files:
Search renderer output changed: YES / NO
Search selection logic changed: YES / NO
Delegated listener binding count reviewed: YES / NO
Nested action protection: PASS / FAIL / NOT_VERIFIED
Click card selection: PASS / FAIL / NOT_VERIFIED
Enter/Space card selection: PASS / FAIL / NOT_VERIFIED
aria-pressed active state: PASS / FAIL / NOT_VERIFIED
Mobile preview open/close: PASS / FAIL / NOT_VERIFIED
Search URL state q/category/sort/limit: PASS / FAIL / NOT_VERIFIED
Tree deep link ?tree=: PASS / FAIL / NOT_VERIFIED
Console fatal errors: NONE / PRESENT
Network fatal blockers: NONE / PRESENT
Private data exposure: NO
```

For Search/Browse runtime changes, final PASS should use a deployed browser target. If fixed-slot verification is required, report slot deployed SHA and PR head SHA match.

---

## 11. Non-goals

This audit does not authorize:

- Search UI layout redesign;
- Search API changes;
- renderer output rewrites unrelated to event handling;
- URL state behavior changes;
- preview/sidebar redesign;
- mobile sheet behavior changes;
- Browse/Search CSS refactors;
- Auth, My Trees, Editor, Detail, Modal, Cloudflare, or database changes;
- PR #7 or prototype/reference/demo/variant changes.

---

## 12. Current disposition

This document satisfies the docs-only audit layer for #123.

Future implementation should be small and behavior-preserving. If a later PR already moved Search card selection to delegated events, use this document as the preservation checklist for subsequent Search renderer or UI refactors.
