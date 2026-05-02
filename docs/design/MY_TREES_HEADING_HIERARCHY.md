# My Trees heading hierarchy

## Purpose

This document defines the product and visual frame for the My Trees page heading.

The My Trees page is an owner-management surface. Its heading should orient the user quickly: this is where their own LoveTrees live, where they can reopen a tree, continue it, sort the list, and create a new one. The heading must feel personal and calm without becoming visually noisy.

Issue #609 focuses on the heading's typography, icon, and color treatment. This document gives that work a narrow implementation frame before any CSS or copy PR changes the page header.

## Product problem

A heading can fail in two directions. If it is too plain, the page can feel generic and disconnected from the LoveTree concept. If it is too decorated, the emoji/icon/color treatment can compete with the actual controls and cards.

The My Trees heading should make the page feel owned and active, but it should not become a decorative banner. The primary actions on the page are sorting, opening trees, and creating a new tree. The heading should orient those actions, not compete with them.

## Recommended direction

A future implementation PR should:

- keep the page title readable and concise;
- decide whether the tree emoji belongs in the text, as an icon treatment, or should be reduced;
- align heading weight and color with the LoveBud design system;
- keep the subtitle supportive and not repetitive;
- keep the toolbar visually connected to the heading without crowding it;
- preserve accessibility and heading semantics.

## What to avoid

A future implementation PR should avoid:

- changing My Trees data loading;
- changing card layout at the same time;
- changing create-tree behavior;
- changing sort behavior;
- making the heading icon larger than the heading's informational role;
- introducing a heading treatment that does not work on mobile;
- touching Browse, Intro, Auth, API, backend, package, or workflow behavior.

## Verification checklist

A future implementation PR should verify:

- desktop My Trees heading and toolbar alignment;
- mobile 375px heading and toolbar fit;
- title readability;
- subtitle readability;
- emoji/icon treatment does not crowd text;
- create button remains visually discoverable;
- sort control remains visually discoverable;
- no horizontal overflow;
- no card grid regression;
- no create modal regression.

## Non-goals

This document does not implement CSS, copy, JavaScript, Auth behavior, data loading, card layout, create-tree behavior, backend/API behavior, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, Browse changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports Issue #609 and should guide a later narrow implementation PR.

Closes #609
Refs #610
Refs #611
Refs #612
Refs #613
Refs #614
Refs #615
Refs #616
