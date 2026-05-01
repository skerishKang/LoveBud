# Browse selected hub action contract

## Purpose

This document defines the expected contract for action controls inside the Browse selected hub.

The selected hub can expose actions such as opening a tree, copying a viewing link, or bringing a public tree into the user's own collection. Issues #604 and #605 both belong to this action surface. Those actions are not just visual buttons: they imply navigation, ownership, authentication, API behavior, and user feedback.

The purpose of this document is to define what must be true before a Browse hub action PR is considered ready.

## Product problem

The selected hub gives the user a public preview of a LoveTree. From that preview, the user may want to continue into the tree, share the view, or save/import/copy it into a personal context. If an action label says one thing but the target does another, the hub loses trust.

Two action problems must be kept separate:

1. Open-target behavior: `이 트리 열기` should take the user to the intended tree/detail experience for the selected LoveTree.
2. Copy/import behavior: any action that brings a public tree into My Trees must respect ownership, authentication, and result feedback.

These must not be mixed with purely visual hub layout changes.

## Expected action roles

### Open tree action

The open action should be deterministic. For a selected public tree, it should open the selected tree's intended detail route or viewing route. It should not accidentally open a stale tree, a previous selected tree, or a generic page without enough context.

The verifier should check that the generated target includes the selected tree context and that the target can be loaded from the Browse route.

### Share/copy link action

The share link action should copy a public viewing URL for the selected tree. It should provide clear success or failure feedback and should not require authentication if the action is only public link copying.

### Bring into My Trees action

If the selected hub offers a way to bring a public tree into the user's own collection, that action must be treated as an authenticated ownership-sensitive operation. It should handle signed-out state, success, duplicate/already-owned state, and failure state clearly.

## Required implementation boundaries

A future implementation PR should:

- keep visual hub cleanup separate from action behavior changes;
- test action target generation against the currently selected tree;
- avoid stale selected-tree state after switching cards;
- provide clear feedback for success and failure;
- preserve existing card selection behavior;
- preserve mobile bottom-sheet behavior unless explicitly scoped;
- avoid exposing implementation details in user-visible messages.

## Verification checklist

A future implementation PR should verify:

- selected tree A open action targets tree A;
- selecting tree B updates the open action to tree B;
- link copy feedback appears and resets;
- signed-out behavior is clear for authenticated actions;
- signed-in behavior completes or reports a recoverable failure;
- repeated clicks do not duplicate in-flight operations;
- mobile bottom-sheet action buttons remain reachable;
- no stale action target remains after clearing selection;
- no card-grid regression;
- no fatal console errors.

## Non-goals

This document does not implement Browse actions, API behavior, ownership behavior, selected hub rendering, card rendering, Auth behavior, backend behavior, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, My Trees changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports the Browse selected hub action issues.

Closes #604
Closes #605
Refs #594
Refs #599
Refs #600
Refs #601
Refs #602
Refs #603
