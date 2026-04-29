# Moment Timeline Plan

> Status: product / technical planning  
> Related: #362  
> Runtime impact: none  
> Implementation: deferred

## 1. Product thesis

YouTube playlists organize full videos.

LoveBud can organize the exact moments where affection, memory, fandom, or emotional attachment happens.

A working product line:

> YouTube saves videos. LoveBud saves the moments that moved you.

The feature should start as a cue-based timeline, not as a generic video editor.

## 2. What this is

Moment Timeline is a LoveBud-native way to save and arrange short YouTube segments.

A moment can represent:

- an 입덕 moment;
- a favorite live part;
- a facial expression;
- a lyric line;
- a funny scene;
- a comforting moment;
- a sports highlight;
- any emotional cue a user wants to replay or share.

The user does not save the entire video as the primary object. The user saves the meaningful segment.

## 3. What this is not

The MVP is not:

- a full video editor;
- a Premiere/Vegas replacement;
- a YouTube downloader;
- a video clipping/exporting service;
- a server-side video encoder;
- an uploaded video editor;
- a way to rehost YouTube content.

The MVP stores playback instructions and user-authored metadata only.

## 4. Core user flow

1. User opens a LoveTree or Moment editor.
2. User pastes a YouTube URL.
3. LoveBud loads the video in an embedded player.
4. User plays until the desired moment.
5. User clicks `Save this moment`.
6. LoveBud captures the current playback time as `startSeconds`.
7. User selects duration: 5s, 10s, 15s, or custom.
8. LoveBud computes `endSeconds`.
9. User can fine-tune start/end.
10. User adds title, note, and emotion tags.
11. User saves the moment to a LoveTree.
12. User arranges multiple moments in a timeline.
13. User plays the timeline as a sequence of emotional moments.

## 5. MVP scope

### Must have

- YouTube URL parsing to video ID.
- YouTube IFrame Player API integration.
- Current time capture.
- `startSeconds` and `endSeconds` storage.
- Preset duration options: 5s, 10s, 15s.
- Custom duration or end-time adjustment.
- Segment preview playback.
- Optional segment loop preview.
- Moment title.
- Moment note.
- Emotion tags.
- Timeline ordering.
- Drag or button-based reorder.
- Save/load association with a LoveTree.

### Should have

- Timeline sequence playback.
- Previous/next moment controls.
- Basic thumbnail/card display.
- Clear empty state.
- Mobile-friendly edit flow.

### Later

- Shared public Moment Timeline page.
- Captions or quote overlay.
- Multi-source moment collections.
- More advanced timeline UI.
- Export feasibility audit.

## 6. Data model sketch

Initial cue-based object:

```json
{
  "id": "moment_001",
  "treeId": "tree_001",
  "videoProvider": "youtube",
  "videoId": "abc123",
  "sourceUrl": "https://www.youtube.com/watch?v=abc123",
  "startSeconds": 83,
  "endSeconds": 93,
  "order": 1,
  "title": "처음 빠진 장면",
  "note": "이 표정 때문에 저장",
  "tags": ["입덕", "설렘"],
  "loop": true,
  "createdAt": "2026-04-29T00:00:00Z",
  "updatedAt": "2026-04-29T00:00:00Z"
}
```

Timeline-level object:

```json
{
  "id": "timeline_001",
  "treeId": "tree_001",
  "title": "내 입덕 순간 모음",
  "description": "처음 보여주고 싶은 장면들",
  "visibility": "private",
  "momentIds": ["moment_001", "moment_002"]
}
```

The exact database/API contract should be designed in a separate PR before implementation.

## 7. Player behavior

The first implementation should use YouTube IFrame Player API.

Required behaviors:

- load a video by `videoId`;
- seek to `startSeconds`;
- stop or advance at `endSeconds`;
- loop by seeking back to `startSeconds` when current time reaches `endSeconds`;
- support next moment in sequence playback;
- tolerate small keyframe drift around the requested start time.

Do not attempt to download, trim, or store YouTube video files.

## 8. Timeline editor concept

The UI can borrow the mental model of Premiere/Vegas without becoming a full NLE.

Recommended MVP layout:

```text
┌──────────────────────────────────────┐
│ YouTube preview player               │
│ [Save this moment] [Set start] [Set end]
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Moment Timeline                      │
│ [입덕 10s] [눈빛 5s] [라이브 12s]       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Moment Detail                        │
│ title / start / end / tags / note     │
└──────────────────────────────────────┘
```

Editing operations:

- reorder moments;
- adjust start/end;
- toggle loop preview;
- edit title/note/tags;
- delete a moment from the timeline;
- play the timeline from the selected moment.

## 9. UX principles

- Optimize for emotional recall, not video production.
- Make `Save this moment` the primary action.
- Keep duration presets visible.
- Show human-readable time codes.
- Avoid overwhelming users with pro editing controls early.
- Let users build a narrative sequence gradually.
- Keep mobile editing possible, even if full timeline editing is better on desktop.

## 10. Suggested phased PR split

### Phase 0 — Planning

- Product/technical plan document. This PR.
- Issue #362 as umbrella tracker.

### Phase 1 — Data and contract design

- Define Moment and Moment Timeline data model.
- Decide storage table/collection shape.
- Decide private/public visibility behavior.
- Decide API routes and response shape.
- No UI implementation.

### Phase 2 — YouTube segment player proof of concept

- Add isolated player module or demo page under approved non-production path.
- Validate `startSeconds`, `endSeconds`, loop, and sequence playback.
- Browser verification required.

### Phase 3 — Moment capture UI

- Add capture controls near an existing LoveTree/editor context.
- Save a single segment with title/note/tags.
- Keep timeline reorder out of this phase.

### Phase 4 — Moment Timeline reorder UI

- Add reorderable list/timeline UI.
- Allow sequence playback.
- Preserve player behavior.

### Phase 5 — Share/view experience

- Add public/private view behavior if product-approved.
- Do not expose private moments accidentally.

### Phase 6 — Export/editor feasibility audit

- Evaluate whether true video export is desirable or safe.
- Treat as separate long-term research.

## 11. Verification matrix for implementation PRs

Any player or editor implementation PR must verify:

- YouTube URL parsing;
- video ID extraction;
- start time capture;
- end time/duration calculation;
- segment loop behavior;
- sequence playback behavior;
- no fatal console errors;
- mobile layout;
- existing LoveTree editor behavior unaffected;
- Auth/private data boundaries preserved if persistence is involved.

## 12. Guardrails

- Do not implement video download, cutting, encoding, or export in MVP.
- Do not mix this with Search refactors.
- Do not mix this with Auth cleanup.
- Do not mix this with Editor fallback cleanup.
- Do not modify PR #7 or prototype/reference/demo/variant paths without explicit approval.
- Keep each implementation PR narrow.
- Browser verification is required for any player behavior.
- API/database changes require contract docs and backend verification.

## 13. Open questions

- Should Moment Timeline live inside each LoveTree or as a separate collection that can reference a tree?
- Should a moment be private by default?
- Should tags be freeform, preset, or both?
- Should timeline order be stored as integer order or explicit array of moment IDs?
- Should public sharing allow direct playback of segments?
- Should sequence playback auto-advance across different YouTube videos?
- How should unavailable/deleted YouTube videos be represented?
- What is the minimum mobile editing experience?

## 14. Planning decision

Proceed with planning and phased implementation only if the team keeps the MVP cue-based.

The first product value is not exporting videos. The value is letting users collect and arrange the moments that explain why they care.
