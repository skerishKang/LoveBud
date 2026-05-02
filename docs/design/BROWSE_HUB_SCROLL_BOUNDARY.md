# Browse selected hub scroll boundary

## Purpose

This document defines the design and verification scope for making the Browse selected hub scroll independently where appropriate.

The Browse page has a result grid on the left and a selected hub on the right. The result grid can become long as more public LoveTrees load. The selected hub can also become long when it contains representative media, tree summary, emotion tags, connected moments, share/open actions, and fallback text. If both areas rely only on the page scroll, the user can lose context: selecting a card may leave the hub partially visible, and reading hub details may pull the user away from the card grid.

The goal is not to create a complicated nested-scroll experience. The goal is to decide where an independent hub scroll boundary is useful, especially on desktop, while keeping mobile bottom-sheet behavior predictable.

## Product problem

The selected hub is a companion panel. It should remain available while the user browses cards, but it should not dominate the entire page. When the hub content grows, it needs a clear internal structure and, if necessary, its own scroll area. Otherwise, the user has to use the whole page scroll to read hub content, then scroll back to continue browsing.

This is especially important once the hub includes richer connected moment flow. A richer hub will be more useful, but it also increases height. A scroll boundary prevents richer content from making the full Browse page feel unwieldy.

## Recommended implementation direction

A future implementation PR should evaluate the desktop hub as a bounded panel. The likely direction is:

- keep the selected hub visually anchored beside the results grid on desktop;
- cap the hub height relative to the viewport;
- allow the hub body to scroll internally when content exceeds that cap;
- preserve the header/title area so the selected context remains visible;
- avoid nested scroll regions inside the hub unless unavoidable;
- keep the mobile bottom sheet as the mobile scroll container rather than adding another inner scroll layer.

The implementation should be CSS-first if possible. JavaScript should not be introduced unless required for preserving current selection or mobile sheet behavior.

## Required behavior

### Desktop

On desktop, the hub should remain readable while users continue scanning the result grid. If the selected content is long, the hub should scroll internally without pushing the full page into awkward jumps.

### Tablet

At intermediate widths, the layout may collapse or reduce the hub width. The scroll boundary should not cause clipped content or trapped scrolling.

### Mobile

On mobile, the existing bottom-sheet model should remain the primary selected hub behavior. The sheet may scroll vertically, but the implementation should avoid creating a second nested scroll area inside the sheet unless the reviewer confirms it is usable.

## Verification checklist

A future implementation PR should verify:

- desktop hub with no selection;
- desktop hub with a selected tree and representative media;
- desktop hub with longer summary/metadata content;
- desktop card grid scrolling while the hub remains usable;
- tablet width if the layout changes materially;
- mobile 375px bottom-sheet open and close behavior;
- mobile sheet scroll does not hide key actions unexpectedly;
- no horizontal overflow;
- no card selection regression;
- no preview hydration regression;
- no page scroll jump on card selection.

## Non-goals

This document does not implement CSS or JavaScript changes. It does not change Browse card rendering, selected hub rendering, preview hydration, API/runtime behavior, Auth behavior, backend behavior, package files, workflows, PR #7, prototype/reference/demo/variant assets, PR #450, My Trees, Intro, or Editor/#520.

## Issue relationship

This document supports Issue #599 and should guide a later narrow implementation PR.

Closes #599
Refs #594
Refs #600
Refs #601
Refs #602
Refs #603
