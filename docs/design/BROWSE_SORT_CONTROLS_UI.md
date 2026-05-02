# Browse sort controls UI

## Purpose

This document defines the UI and verification frame for Browse sort and result controls.

Browse controls are split across search, category filters, sort chips, result count messaging, and load-more behavior. Issues #606 and #607 concern the visible control model around latest/popular/load-more behavior. Issue #608 separately defines the product semantics of popularity. This document focuses on control presentation and verification.

## Product problem

Browse controls should help users understand how the result set is shaped. If search, category filters, sort options, result count, and load-more controls appear as unrelated chips, users cannot easily tell what changes the data set and what simply continues the current list.

Sort controls should feel like result controls, not category filters. Load-more should feel like continuation, not another sort mode. Result count or result-range messaging should not compete with the actual card grid.

## Relationship to sort semantics

This document does not decide what `popular` means. That decision belongs to the Browse sort semantics document. However, once semantics are confirmed, the UI should present sort controls truthfully and clearly.

If `popular` is not verified, the UI should not over-emphasize it. If `popular` is verified, it should be visually grouped with `latest` as a sort option, not mixed into category chips.

## Recommended UI direction

A future implementation PR should:

- visually group latest/popular controls as sort options;
- keep load-more visually distinct from sort options;
- keep search and category filters near the result list they control;
- avoid making all controls look identical if they perform different roles;
- make the active sort state clear;
- keep disabled or unavailable states obvious;
- preserve URL state behavior if currently supported;
- preserve keyboard and click behavior.

## Verification checklist

A future implementation PR should verify:

- latest sort active state;
- popular sort active state if still visible;
- load-more state before and after click;
- disabled/no-more state;
- search interaction with current sort;
- category filter interaction with current sort;
- URL state after sort changes;
- desktop layout readability;
- mobile 375px layout readability;
- no horizontal overflow;
- no card selection regression;
- no selected hub regression.

## What to avoid

A future PR should avoid:

- mixing popularity semantics with UI-only control polish;
- changing API sort behavior unless explicitly scoped;
- changing card rendering while changing control grouping;
- making load-more look like a category chip;
- hiding sort state from the user;
- introducing a control whose target behavior is unverified.

## Non-goals

This document does not implement control UI, API behavior, sort semantics, card rendering, selected hub rendering, Auth behavior, backend behavior, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, My Trees changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports Browse sort/control UI work.

Closes #606
Closes #607
Refs #608
Refs #596
Refs #597
