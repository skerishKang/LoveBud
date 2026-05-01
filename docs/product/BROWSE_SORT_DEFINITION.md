# Browse sort definition and verification criteria

## Purpose

This document records the product and engineering decision criteria for the Browse page sort controls, especially the visible `인기순` option.

The Browse page currently presents sorting as a user-facing trust feature. When a user chooses `최신순`, the meaning is relatively clear: public LoveTrees are expected to be ordered by recency. When a user chooses `인기순`, the meaning is not self-evident. A user can reasonably ask whether popularity means many views, many copies, many shares, many public moments, recent activity, reactions, or a curated score.

The goal of this document is not to implement a new ranking algorithm. The goal is to prevent the UI from claiming a popularity concept before the product and runtime have a verified definition for it.

## Product problem

Sorting is not decorative copy. It changes user expectations about why a tree appears before another tree.

If `인기순` is based on a real engagement signal, the product should document that signal. If `인기순` is based on a weak proxy, such as number of public moments or recent update activity, the UI should not pretend that the result is objectively popular. If the runtime simply accepts `sort=popular` but falls back to the same order as latest, the UI is misleading and should be renamed, hidden, or disabled until the product can support it.

Browse is a public discovery surface, so the ranking language must remain honest. The user should be able to infer why the order exists without needing to inspect the code.

## Current frontend observation

The Browse client treats sorting as a request parameter. The frontend does not compute popularity locally. The visible sort control selects a sort value, and the public tree loading path sends that value to the public tree API request. In other words, the browser can ask for `popular`, but the actual meaning of `popular` must come from the backend or runtime query layer.

This means any implementation PR that changes the visible `인기순` copy must first determine what the runtime actually does with the sort value.

## Definitions to choose from

The team must choose one product definition before claiming that Browse supports popularity ranking.

Possible definitions include:

1. All-time views or opens.
2. Recent views or opens in a defined window, such as 7 or 30 days.
3. Copy/import count into My Trees.
4. Share-link copy count.
5. Number of public moments in the tree.
6. Recent update activity.
7. A mixed score that combines recency and engagement.
8. A curated or editorial score.

Each definition implies different product behavior. Moment count may be easy to compute, but it is not the same as popularity. Recent engagement may be more faithful to the word `인기`, but it requires reliable event tracking or aggregation. Copy count may express user intent better than passive views, but it only works if copy/import events are tracked safely.

## Recommended default stance

Until runtime investigation proves otherwise, `인기순` should be treated as an unverified product claim.

The preferred decision path is:

1. Inspect the public tree API route or query code that handles `sort=popular`.
2. Record whether it accepts the value, rejects it, ignores it, or maps it to another order.
3. Record the generic field or score category used for ordering, without exposing private identifiers or raw rows.
4. Decide whether the visible label `인기순` is honest for that implementation.
5. If not, either rename the label to match the actual behavior or hide the option until a real popularity score exists.

## Acceptable outcomes

A follow-up implementation PR should choose one of these outcomes:

### Outcome A: Keep `인기순`

Use this only if the backend has a real, deterministic popularity score and product agrees that the score matches the visible label.

The PR must document the score category and verify that latest and popular ordering differ when appropriate.

### Outcome B: Rename the label

Use this if the backend uses a proxy that is useful but not truly popularity. For example, if the order is based on public moment count, the visible label should say something closer to activity or richness rather than popularity.

The PR must preserve sort behavior but make the copy honest.

### Outcome C: Hide or disable the option

Use this if the backend does not support a meaningful popular order, or if `popular` is currently an alias for latest.

The PR must ensure users are not offered a misleading ranking choice.

### Outcome D: Implement a narrow backend score

Use this only if the required data already exists and the scope is explicitly approved. This should not be bundled with UI polish, card redesign, selected hub work, or Browse loading behavior.

### Outcome E: Open a larger analytics issue

Use this if the desired definition requires new view/copy/share tracking or aggregation. That work should be separate from UI copy/layout PRs.

## Verification requirements for implementation

Any implementation PR that changes Browse sort behavior or sort copy must verify:

- `latest` ordering still behaves as expected.
- `popular` ordering, if kept, is based on the documented criterion.
- The two sorts produce a meaningful order difference when test data supports it.
- Search/filter interactions do not break sorting.
- The first-batch model remains aligned with the Browse loading work.
- URL state, if supported, preserves the selected sort correctly.
- Desktop Browse remains usable.
- Mobile 375px Browse remains usable.
- No restricted runtime values are printed in reports.

## Non-goals

This document does not authorize implementation. It does not authorize analytics tracking, API changes, database changes, UI redesign, Browse card redesign, selected hub changes, My Trees changes, Auth changes, package or workflow changes, PR #7 changes, prototype/reference/demo/variant changes, or PR #450 changes.

## Issue relationship

This document supports Issue #608. It should be used as the decision frame before a follow-up implementation PR changes the visible sort labels or runtime ranking behavior.

Refs #608
Refs #455
Refs #456
Refs #597
Refs #607
