# Browse selected hub moment flow

## Purpose

This document defines the product and verification frame for showing connected moments inside the Browse selected hub.

The selected hub should not only show a representative media item. It should help the user understand that a LoveTree is a sequence of connected moments. Issues #601, #602, and #603 all point to the same product area: how the selected hub should expose the continuing flow of moments without becoming noisy, cramped, or visually disconnected from the selected card.

## Product problem

If the hub only shows one representative moment, users may read the selected tree as a single video or one isolated memory. If the hub shows too many moments without hierarchy, it becomes a dense list that competes with the card grid and primary actions.

The selected hub needs a compact flow model: enough to show that the tree has connected moments, but not so much that the panel becomes a full editor or detail page.

## Recommended direction

A future implementation PR should make the hub moment flow compact and preview-oriented.

The selected hub should show:

- the representative or starting moment first;
- a small number of follow-up moments when available;
- labels that explain why the moments are shown;
- a clear distinction between tree summary, moment flow, emotion tags, and actions;
- a path toward the full detail view when the user wants the complete sequence.

The hub should not become a complete timeline editor. It should preview the flow and invite deeper viewing.

## Scope for a future implementation PR

A later PR may:

- add a compact connected-moments row or stack;
- rename headings so the flow reads as connected moments rather than generic metadata;
- limit the number of visible moments to avoid panel crowding;
- add a small overflow indicator such as “and more” when the tree has additional moments;
- adjust labels so the first, current, and follow-up moments are distinguishable;
- preserve the current open/share actions.

## What to avoid

A later PR should avoid:

- changing API shape while also changing the visual hierarchy;
- turning the selected hub into a full timeline page;
- showing every memory in a long unbounded list;
- duplicating the same labels already present in card metadata;
- making the hub require horizontal scrolling;
- mixing this work with copy/import behavior, open-target behavior, sort behavior, or card-grid redesign.

## Verification checklist

A future implementation PR should verify:

- selected tree with one moment;
- selected tree with multiple moments;
- selected tree with no representative media;
- selected tree with representative media;
- desktop hub readability;
- mobile bottom-sheet readability;
- action buttons remain reachable;
- selecting another card replaces the moment flow cleanly;
- no stale previous-tree moments remain;
- no horizontal overflow.

## Non-goals

This document does not implement rendering changes. It does not change Browse CSS, Browse JavaScript, API/runtime behavior, Auth behavior, backend behavior, package files, workflows, PR #7, prototype/reference/demo/variant assets, PR #450, My Trees, Intro, or Editor/#520.

## Issue relationship

This document supports the connected-moment work for the selected hub.

Closes #601
Closes #602
Closes #603
Refs #594
Refs #599
Refs #600
Refs #604
Refs #605
