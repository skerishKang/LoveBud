# Moment Timeline Reorder and Sequence Design

## Purpose

Define a lightweight Moment Timeline editor for arranging saved YouTube Moments into an ordered playback sequence.

This document is design-only. It does not implement database storage, API behavior, player behavior, drag-and-drop, or production UI.

Related issues:

- Parent: #362
- Child: #365
- Planning PR: #363

---

## Product boundary

Moment Timeline is not a full video editor.

It is a cue-based sequence editor for Moments:

- each block represents a YouTube segment cue
- each cue stores start/end time and metadata
- sequence playback moves from one Moment cue to the next
- no video file is downloaded, cut, rendered, or exported

The UI may borrow timeline language from video editors, but the MVP should stay closer to a playlist/order editor than a nonlinear editing tool.

---

## MVP editor behavior

The first timeline editor should support:

1. Display Moments as ordered blocks.
2. Show title and duration per block.
3. Allow reordering.
4. Allow selecting a Moment.
5. Allow editing start/end/title/note/tags from a detail panel.
6. Play the selected Moment.
7. Play all Moments in order.
8. Preserve the association with a LoveTree.
9. Show total timeline duration.
10. Provide a clear empty state.

---

## Recommended layout

### Desktop

Use a three-region layout:

| Region | Role |
|---|---|
| Preview/player area | Shows selected Moment playback |
| Timeline/list area | Shows ordered Moment blocks |
| Detail panel | Edits selected Moment metadata and segment times |

Recommended first layout:

- vertical ordered list first, not horizontal drag timeline
- optional compact horizontal strip later
- up/down reorder buttons as the first reliable mechanism
- drag-and-drop can be added after keyboard/mobile behavior is defined

### Mobile

Use a single-column layout:

1. Selected Moment preview/player
2. Current Moment summary
3. ordered Moment list
4. expandable edit panel
5. sequence controls

Mobile MVP should prioritize reliable tap controls over drag-and-drop.

---

## Timeline block content

Each Moment block should show:

- order number
- title
- duration
- source indicator, likely YouTube
- optional thumbnail after player/API feasibility is confirmed
- selected state
- unavailable/error state when playback cannot proceed

Example visible shape:

```text
01  Favorite chorus moment     00:10
02  Smile at the bridge        00:08
03  Ending pose                00:12
```

---

## Reorder model

### MVP recommendation

Use explicit reorder controls first:

- Move up
- Move down
- Move to top, optional later
- Move to bottom, optional later

Why:

- easier to verify
- keyboard accessible
- mobile friendly
- avoids drag library and pointer edge cases in the first PR

### Later enhancement

Add drag-and-drop only after:

- keyboard behavior is specified
- mobile fallback exists
- order persistence contract is stable
- browser smoke matrix is defined

---

## Selection model

Selecting a Moment should:

- mark the block as selected
- load that Moment into the preview/player area
- show editable fields in the detail panel
- keep sequence order unchanged
- not autoplay unless the user explicitly presses play

Deselection is optional for MVP. Empty selection can show the first Moment or a neutral hint state.

---

## Sequence playback behavior

### Play selected Moment

- seek to `startSeconds`
- play until `endSeconds`
- stop unless loop is enabled

### Play all Moments

- start at the selected Moment or first Moment
- play current segment from start to end
- advance to next Moment
- skip unavailable Moment only if policy explicitly chooses skip behavior
- stop at final Moment

### Previous / next controls

- Previous moves to previous ordered Moment and prepares playback
- Next moves to next ordered Moment and prepares playback
- whether next auto-plays should follow the current playback mode:
  - if sequence playback is active, continue playing
  - if not active, select only

---

## Loop behavior

MVP recommendation:

- loop current Moment only
- whole-timeline loop is a later option

Loop current Moment behavior:

1. segment reaches `endSeconds`
2. player seeks back to `startSeconds`
3. segment plays again
4. loop ends only when user disables loop or stops playback

Whole-timeline loop can be revisited once sequence playback is proven.

---

## Unavailable video behavior

If a Moment cannot be loaded:

- show an unavailable state on the block
- report the player/network error in verification notes
- prevent silent failure
- for MVP, stop sequence playback and show the error

Alternative future policy:

- sequence playback may skip unavailable Moments if product chooses playlist resilience over strict playback accuracy

---

## Empty state

Empty timeline copy should make the next step clear.

Korean candidate:

> 아직 저장된 순간이 없어요. 유튜브 링크에서 마음이 움직인 장면을 먼저 저장해 보세요.

English candidate:

> No moments yet. Save the first scene that moved you from a YouTube link.

Primary action:

- `첫 순간 저장하기`
- `Save first moment`

---

## Data model sketch

A timeline can be represented as an ordered list of Moment references or embedded cue objects:

```json
{
  "timelineId": "string",
  "treeId": "string",
  "title": "string",
  "moments": [
    {
      "momentId": "string",
      "videoId": "string",
      "startSeconds": 10,
      "endSeconds": 20,
      "order": 1,
      "title": "string",
      "note": "string",
      "tags": ["string"],
      "loop": false
    }
  ]
}
```

Persistence shape is not finalized by this design document.

---

## Open UX decisions

1. Should desktop start with a vertical list or horizontal strip?
2. Should drag-and-drop be delayed until after button reorder is stable?
3. Should sequence playback skip unavailable videos or stop with an error?
4. Should loop apply only to current Moment in MVP?
5. Should thumbnails be required in the timeline block?
6. Should editing start/end happen inline or only in the detail panel?
7. Should mobile expose the same controls or a simplified sequence mode?

---

## Non-goals

- No video file editing
- No export/rendering
- No waveform or multitrack editor
- No transitions
- No captions overlay in MVP
- No database/API implementation in this issue
- No player implementation in this document
- No Search/Auth/Editor cleanup work
- No PR #7/prototype/reference/demo/variant changes

---

## Future PR split

1. Data model/API contract audit for Moment Timeline persistence.
2. Static timeline UI shell with mock Moments.
3. Reorder controls using buttons only.
4. Player PoC integration for selected Moment playback.
5. Sequence playback integration.
6. Mobile fallback smoke pass.

---

## Acceptance criteria for this design stage

- MVP timeline editor behavior is defined.
- Reorder model is specified.
- Sequence playback behavior is specified.
- Loop behavior is scoped.
- Mobile fallback behavior is specified.
- Future implementation PRs can be scoped safely.

---

Refs #365
Refs #362
