# Browse card thumbnail and tree-preview strategy

## Purpose

This document records the product decision frame for Browse card imagery.

The current Browse card can read in two competing ways. It can read as a video thumbnail card because the representative media image is visually dominant. It can also read as a LoveTree card because the product is meant to show a connected emotional tree, not only one isolated media item. Those two readings are both plausible, but they lead to different UI decisions.

The purpose of this document is to prevent small visual fixes from accidentally deciding the product model. A card thumbnail cleanup PR can remove a misleading overlay, but it should not silently decide whether the Browse card is primarily a video preview, a tree preview, or a hybrid.

## Product question

The core question is:

Should a Browse card primarily represent one media-backed moment, or should it represent the whole LoveTree?

If the card is primarily a media-backed moment, then a large thumbnail is expected. The user reads the card as "open this representative scene." The card needs clear media affordance and a truthful connection to the selected hub or detail page.

If the card is primarily a LoveTree, then a large thumbnail alone is not enough. The user needs to understand that the card represents a collection of connected moments. The UI should show a tree identity cue, moment count, emotional path, stage, or another compact structure marker.

If the card is a hybrid, the card must clearly balance both: the representative scene introduces the tree, but the surrounding card language and metadata must make the full tree identity obvious.

## Current risk

A thumbnail-heavy card can make Browse feel like a video grid. That may be visually familiar, but it weakens the LoveTree concept. Users may expect each card to behave like a YouTube/video preview rather than a tree with connected memories.

A tree-heavy card without a representative media cue may feel abstract or generic. Users may not know what they are about to preview, especially when the selected hub opens a video or representative moment.

A mixed card without clear hierarchy can feel confusing: the image suggests one thing, the title/meta suggests another, and the hub opens a third reading.

## Recommended direction

The recommended direction is hybrid, with LoveTree identity taking precedence.

A Browse card should use a representative thumbnail when available because it gives the user an immediate emotional entry point. However, the card should still read as a LoveTree card. The thumbnail should act as the first scene or representative moment, not as the entire object.

That means future implementation should preserve media imagery but add or strengthen tree-level context. The tree title, moment count, stage or emotional category, and selected hub behavior should all reinforce that the card represents a connected tree.

## What a future implementation PR may change

A future implementation PR may consider:

- adding a compact tree identity marker over or near the thumbnail;
- showing a small moment-path cue beside the media area;
- making the metadata row more clearly tree-level rather than video-level;
- ensuring the title and subtitle explain the whole LoveTree, not only the first media item;
- keeping a representative media image but reducing decorative elements that look like controls;
- using fallback visuals that read as tree structure, not generic placeholder art.

## What a future implementation PR should avoid

A future implementation PR should avoid:

- adding fake controls that look clickable but do nothing;
- making the card look like a standalone video tile when the destination is a tree flow;
- hiding all media context and making the card too abstract;
- changing API/runtime behavior while also redesigning the card visual language;
- changing selected hub behavior in the same PR unless the issue explicitly requires it;
- mixing popularity/sort semantics into card visual strategy.

## Verification criteria

Any future implementation PR should verify:

- cards with thumbnails still provide an immediate visual entry point;
- cards without thumbnails still read as intentional tree cards;
- the user can tell that each card represents a LoveTree, not only one video;
- selected hub behavior still matches the card promise;
- title, subtitle, metadata, and thumbnail do not compete for meaning;
- desktop grid remains balanced;
- mobile 375px remains readable;
- keyboard/card selection behavior is unchanged unless explicitly scoped;
- no restricted runtime values are printed in reports.

## Non-goals

This document does not implement card CSS, renderer logic, API behavior, sort behavior, selected hub behavior, My Trees behavior, Auth behavior, backend changes, package changes, workflow changes, PR #7 changes, prototype/reference/demo/variant changes, PR #450 changes, or Editor/#520 changes.

## Issue relationship

This document supports Issue #617 and provides the decision frame for later Browse card implementation PRs.

Refs #617
Refs #591
Refs #592
Refs #593
Refs #594
Refs #599
