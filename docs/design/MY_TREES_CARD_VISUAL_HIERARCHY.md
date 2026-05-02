# My Trees card visual hierarchy

## Purpose

This document defines the product and verification frame for My Trees card visual hierarchy.

Issues #612, #613, #614, and #615 all belong to the same card surface. They cover duplicated moment-count badges, weak card separation, visibility/status metadata hierarchy, and overflow menu visual noise. These should not be patched independently without a shared card model, because each fix can affect the same visual balance.

The goal is to make My Trees cards feel like clear owner-managed LoveTree objects. A user should understand what the tree is, whether it is public or private, how many moments it contains, what the primary action is, and where secondary management actions live.

## Product problem

My Trees is a private management page, not a public discovery grid. Cards should prioritize owner control and continuity. They should not look like generic content tiles, and they should not over-repeat the same metadata.

A card that repeats moment count in multiple places feels noisy. A card that does not separate itself from neighboring cards feels unfinished. A card that mixes visibility, status, moment count, and actions without hierarchy makes it harder for the owner to decide what to do next. An overflow menu that competes visually with the primary action makes the card feel more like a settings panel than a tree entry.

## Recommended direction

A future implementation PR should treat the card as three clear regions:

1. Identity region: title, optional status cue, and the primary context of the tree.
2. Metadata region: visibility, moment count, and recent state, shown once each.
3. Action region: primary open action first, secondary menu actions second.

The implementation should avoid duplicated badges and redundant labels. If moment count appears in the metadata row, it should not also appear as a competing badge unless each instance has a distinct meaning.

## Scope for future implementation

A later implementation PR may:

- remove duplicated moment-count badges;
- strengthen card separation through border, shadow, background, or spacing;
- reorganize visibility/status metadata so it reads as supporting information;
- reduce visual weight of overflow menu controls;
- preserve the primary card action as the clearest interaction;
- adjust responsive card spacing if needed.

## What to avoid

A later PR should avoid:

- mixing card visual hierarchy with My Trees loading behavior;
- changing create-tree behavior;
- changing Auth or data loading;
- changing backend/API contracts;
- changing Browse card styles in the same PR;
- making the overflow menu more prominent than the primary action;
- hiding important visibility state from the owner.

## Verification checklist

A future implementation PR should verify:

- My Trees with multiple cards;
- My Trees with public and private cards;
- cards with zero moments;
- cards with multiple moments;
- primary action remains clear;
- overflow menu remains reachable but secondary;
- duplicated moment count is removed or justified;
- card separation is visible on desktop;
- card separation is visible on mobile 375px;
- no horizontal overflow;
- no fatal console errors;
- create-tree flow is unchanged unless explicitly scoped.

## Non-goals

This document does not implement My Trees CSS, JavaScript, Auth behavior, data loading, create-tree behavior, backend/API behavior, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, Browse changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports the My Trees card visual hierarchy work.

Closes #612
Closes #613
Closes #614
Closes #615
Refs #609
Refs #610
Refs #611
Refs #616
