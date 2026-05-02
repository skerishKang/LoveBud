# Browse selected hub state verification

## Purpose

This document defines the verification frame for the Browse selected hub.

The Browse page has two main surfaces: the card grid and the selected hub. The selected hub is where the chosen LoveTree becomes concrete. It may show an empty prompt, a loading state, representative media, tree summary, emotion tags, metadata, action buttons, or a fallback state. Because the hub is data-loaded and stateful, it cannot be verified only by looking at static markup.

This document records the states that must be checked before selected-hub implementation or styling PRs are considered ready.

## Why this matters

The selected hub explains what happens after a user chooses a Browse card. If it is empty, noisy, too large, stale, or inconsistent with the selected card, Browse feels broken even when the card grid itself is working.

The hub also bridges multiple product concepts: public discovery, representative media, LoveTree identity, emotion tags, share/open actions, and mobile bottom-sheet behavior. Any PR that changes the hub must make sure those concepts remain aligned.

## Required states

### No selection

Before a card is selected, the hub should invite the user to choose a tree. It should not look like an error, a blank panel, or a partially loaded card.

The reviewer should confirm:

- the empty copy is visible;
- the panel is not visually over-dominant relative to the card grid;
- no stale tree title, media, or metadata remains from a previous selection;
- mobile behavior does not show an unnecessary bottom sheet before selection.

### Selection loading

When a card is selected and preview data is loading, the hub should acknowledge the selected tree and show a clear transition state.

The reviewer should confirm:

- the selected card becomes visually active;
- the hub shows loading copy tied to the selected tree;
- there is no flicker back to the empty state;
- the loading state does not expose implementation details;
- slow preview loading still leaves the UI understandable.

### Loaded selection with media

When representative media is available, the hub should show it as the first viewing entry point while preserving LoveTree context.

The reviewer should confirm:

- the media area renders correctly;
- the title in the hub matches the selected card;
- the summary describes the tree flow rather than only the video;
- emotion tags and metadata are present when available;
- primary and secondary actions remain clear;
- selecting a different card replaces the previous state cleanly.

### Loaded selection without media

When no representative media is available, the hub should still feel intentional.

The reviewer should confirm:

- fallback art/copy is visible;
- the fallback does not look like an error;
- the tree title and metadata remain clear;
- the user still understands what action is available next.

### Preview load failure

If preview hydration fails, the hub should recover safely.

The reviewer should confirm:

- the card grid remains usable;
- the active selection does not leave a broken stale panel;
- the user can choose another card;
- mobile bottom-sheet state closes or updates predictably;
- reports use status labels rather than printing private runtime values.

### Mobile bottom sheet

On mobile, the selected hub becomes a bottom-sheet style preview. This state must be verified separately from desktop.

The reviewer should confirm:

- selecting a card opens the sheet;
- closing the sheet clears or preserves selection according to current expected behavior;
- background scroll lock does not jump the page;
- overlay click and close button work;
- card selection does not scroll the page to the top;
- the sheet does not exceed the viewport in a way that hides key actions.

## Verification matrix

A selected-hub PR should check at least:

- desktop no selection;
- desktop selected tree with media;
- desktop selected tree without media if test data allows;
- desktop switching between two selected cards;
- mobile 375px no selection;
- mobile 375px selected tree with media;
- mobile close behavior;
- URL deep-link selection if the PR touches deep-link or preview state;
- share/open actions if the PR touches actions.

## Pass criteria

A PR may pass this gate if:

- the hub state always matches the selected card;
- empty/loading/loaded/fallback states are visually distinct;
- the panel does not show stale content;
- mobile bottom-sheet behavior remains predictable;
- card grid interaction remains intact;
- no fatal console errors occur;
- no horizontal overflow is visible;
- no unrelated app surface is changed.

## Non-goals

This document does not implement selected hub UI, card rendering, preview hydration, API behavior, Auth behavior, backend behavior, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, My Trees changes, Intro changes, or Editor/#520 changes.

## Issue relationship

This document supports Issue #594 and should be used before ready/merge decisions on selected hub work.

Refs #594
Refs #599
Refs #600
Refs #601
Refs #602
Refs #603
Refs #604
Refs #605
