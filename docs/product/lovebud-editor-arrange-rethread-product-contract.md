# Arrange vs Rethread: Editor Moment Order Controls Product Contract

> Docs/contracts-only planning slice for #2471. This contract defines the product semantics and boundary between **visual arrange** (canvas layout) and **rethread** (saved edge mutation) before any runtime implementation begins.

## Status

- Refs: #2471
- Parent: #2471 — Explore canvas arrange and rethread controls for moment order cleanup
- Scope: docs/contracts-only product boundary slice
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend UI implementation: none
- editor-canvas.js runtime modification: none
- Scout/live AI/provider/fetch/network work: none
- Browse/Search social-count changes: none

## Definitions

### Arrange (visual-only canvas layout)

Arrange controls operate on the **visual layout** of moments on the canvas. They must not modify saved parent/child edge relationships.

| Arrange action | What it does | What it must NOT do |
|---|---|---|
| Sort by date on canvas | Reposition moment cards by date order | Modify saved parent/child edges |
| Horizontal/vertical alignment | Align cards along a layout axis | Add or remove saved edges |
| Snap to grid | Snap cards to nearest grid position | Persist as a new saved layout |
| Center view | Center canvas on selected moments | Change moment position data |
| Save current layout (future) | Persist card positions per user session | Mutate the LoveTree flow/edge structure |

Arrange is **safe and reversible** by design. No saved edge mutation occurs during arrange operations.

### Rethread (saved edge mutation)

Rethread controls operate on the **saved LoveTree flow/edge structure**. They modify parent/child relationships between moments.

| Rethread action | What it does | User experience requirement |
|---|---|---|
| Disconnect | Remove a saved edge between two moments | Confirm before applying |
| Connect to another moment | Create a saved edge between a different pair of moments | Confirm before applying |
| Attach after this moment | Reparent a moment to follow a different moment | Confirm before applying |
| Direct flow edit | Manually reroute edges between moments | Preview + confirm |
| Reorder by date | Re-thread edges to follow remembered date order | Preview before apply required |

Rethread is **destructive/structural** by design. All rethread actions require preview and explicit user confirmation before applying.

## Core Principles

| Concept | Definition |
|---|---|
| Moment position | The visual canvas layout coordinate of a moment card |
| Moment edge/line | A user-declared emotional/story flow between two moments |
| Remembered date | The user-saved date in LoveBud (when the moment was saved or dated) |
| Content date | The original source/event date (e.g., channel upload date, event date) |

**Thesis:** LoveTree edges represent the user's declared emotional/story narrative, not automatic date-based ordering. Any operation that modifies edges must preserve this thesis.

## Forbidden Principles

1. Visual arrange must NOT silently mutate saved edges.
2. Automatic date-order rethread must NOT apply without preview and confirmation.
3. Remembered date and content date mixing must NOT cause automatic edge changes.

## UX Policy

| Control type | Nature | Requires preview | Requires confirm | Reversible |
|---|---|---|---|---|
| Arrange | Safe | No | No | Yes (undo layout) |
| Rethread | Destructive/structural | Yes | Yes | Per-action undo |
| Reorder by date | Rethread subtype | Yes (preview before apply) | Yes | Per-action undo |

"날짜순으로 다시 잇기" ("rethread by date order") must always provide a preview of the resulting edge structure before applying.

## Implementation Gate

- No runtime arrange/rethread UI may be implemented without this document and its companion contract test.
- No DB/API/schema changes for arrange/rethread.
- No Browse/Search behavior changes.
- No Scout/provider/AI integration.
- No expansion into Obsidian-style relationship graph features.
- No merge with #2464 rename modal work or #2465 social footer/branch controls polish.
- editor-canvas.js may not be modified by this planning slice.

## Product Index Cross-Reference

This document was added to `docs/product/product_index.md` under the arrange/rethread section.

## Closure Note

This docs/contracts-only slice fulfills the exploration requirement of #2471 by locking the product boundary between arrange and rethread. The issue may be closed once this document and its contract test are merged to main. Further runtime implementation work belongs in separate follow-up issues.
