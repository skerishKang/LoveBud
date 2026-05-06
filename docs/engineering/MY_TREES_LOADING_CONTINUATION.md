# My Trees loading and continuation evidence

## Purpose

This document defines the evidence required before My Trees loading, first-batch rendering, or scroll-continuation changes are considered ready.

My Trees is an authenticated owner surface. It is not enough for the page to eventually show cards. The page must communicate loading state, show the first usable batch clearly, preserve sort and card actions, and continue scrolling without breaking create-tree or owner management behavior.

## Product problem

My Trees can fail in ways that are hard to catch with static review. The page may show a loading state too long, render the first cards but lose toolbar state, continue loading but reset scroll, sort cards but lose selection or action state, or appear empty when authenticated data is still arriving.

Because this page is personal and owner-managed, loading behavior affects trust. Users should understand whether their trees are loading, absent, unavailable, or simply further down the list.

## Evidence required

A future implementation PR that changes loading, first-batch rendering, pagination, scroll continuation, sorting, or card refresh behavior should report the following evidence.

### Authenticated load evidence

The verifier should confirm:

- the page is tested in a signed-in QA state;
- the loading state appears before tree data is ready;
- the first visible card batch appears without manual refresh;
- empty state appears only when the authenticated account truly has no visible trees;
- recoverable error state appears when loading fails.

### First-batch evidence

The verifier should confirm:

- the first cards are usable as soon as they render;
- card primary actions are present;
- visibility/status metadata is present if available;
- sort control remains visible;
- create-tree button remains available.

### Continuation evidence

The verifier should confirm:

- scrolling past the first batch continues predictably if more trees exist;
- additional cards do not duplicate earlier cards;
- scroll position does not jump unexpectedly;
- loading more does not reset the sort selection;
- loading more does not break card action behavior.

### Sort evidence

The verifier should confirm:

- recent sort remains stable;
- oldest sort remains stable;
- name sort remains stable;
- changing sort clearly updates card order;
- sort changes do not create an incorrect empty state.

### Create-tree evidence

The verifier should confirm:

- create-tree modal still opens;
- creating or canceling does not leave the list in a stale loading state;
- after a successful create flow, the list either refreshes or reports the expected state according to current behavior.

### Mobile evidence

The verifier should confirm:

- mobile 375px loading state is readable;
- first card batch is usable;
- toolbar controls do not overflow;
- card actions remain reachable;
- continuation does not cause horizontal overflow or scroll trapping.

## Suggested report format

```text
My Trees loading evidence
- Target URL:
- Deployed SHA:
- Signed-in QA state: PRESENT/MISSING
- Initial loading state: PASS/FAIL/NOT_VERIFIED
- First card batch: PASS/FAIL/NOT_VERIFIED
- Continuation/scroll: PASS/FAIL/NOT_VERIFIED
- Sort controls: PASS/FAIL/NOT_VERIFIED
- Create-tree flow: PASS/FAIL/NOT_VERIFIED
- Mobile 375px: PASS/FAIL/NOT_VERIFIED
- Console fatal errors: YES/NO/NOT_VERIFIED
- Final status: PASS/BLOCKED/NOT_VERIFIED
```

## Non-goals

This document does not implement My Trees loading, pagination, sorting, card rendering, Auth behavior, API/backend behavior, create-tree behavior, CSS changes, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, Browse changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports Issue #616 and should be used as the evidence checklist for later My Trees loading and continuation work.

Closes #616
Refs #609
Refs #610
Refs #611
Refs #612
Refs #613
Refs #614
Refs #615
