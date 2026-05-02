# Browse loading runtime evidence

This document defines the evidence required before Browse loading or prefetch changes are considered ready.

Browse is a data-loaded public surface. Loading work should be verified in the rendered page, not only by code review. A verifier should confirm the initial skeleton, first card batch, search and filter behavior, sort and continuation behavior, selected preview hydration, mobile behavior, console status, and absence of horizontal overflow.

Reports should use safe status labels and should not print private runtime values.

This document does not implement loading behavior or authorize unrelated runtime, package, workflow, prototype, reference, demo, variant, PR #450, My Trees, Intro, or Editor changes.

## Issue relationship

Refs #595
Refs #596
Refs #597
Refs #599
Refs #606
Refs #607
