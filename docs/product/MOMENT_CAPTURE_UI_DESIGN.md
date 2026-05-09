# Moment Capture UI Design

## Purpose

Define the first user-facing capture flow for saving an emotional YouTube segment into LoveBud as a Moment.

This document is design-only. It does not implement a player, database model, API endpoint, or production UI.

Related issues:

- Parent: #362
- Child: #364
- Planning PR: #363

---

## Product framing

The primary action is not “save video.”

The primary action is:

> Save this moment.

LoveBud should help users preserve the exact timestamp range where affection, fandom memory, or emotional recall happens.

---

## MVP capture flow

1. User pastes a YouTube URL.
2. Preview player loads the video.
3. User plays or scrubs to the desired moment.
4. User clicks **Save this moment**.
5. `startSeconds` is captured from the current player time.
6. A default duration is applied, initially recommended as **10 seconds**.
7. User adjusts start/end if needed.
8. User adds title, note, and emotion tags.
9. User chooses a save target: LoveTree or Moment Timeline.
10. User saves the Moment.

---

## Required UI elements

| Element | Purpose | MVP requirement |
|---|---|---|
| YouTube URL input | Accept a watch/share/shorts URL | Required |
| Preview player area | Let the user find the desired moment | Required after player PoC |
| Save this moment button | Capture current time as `startSeconds` | Required |
| Set start control | Fine-tune segment start | Required |
| Set end control | Fine-tune segment end | Required |
| Duration presets | Quickly set end from start | Required |
| Title field | Name the Moment | Required |
| Note field | Capture emotional context | Optional but visible |
| Emotion tags | Add meaning/category | Optional but visible |
| Loop preview toggle | Preview the segment repeatedly | Required after player PoC |
| Save target selector | Attach to LoveTree or Moment Timeline | Required once both targets exist |

---

## Recommended defaults

| Field | Default |
|---|---|
| duration | 10 seconds |
| startSeconds | current player time when user clicks Save this moment |
| endSeconds | `startSeconds + 10` |
| title | empty, user-provided |
| note | empty, user-provided |
| tags | empty or suggested presets |
| loopPreview | off by default |
| save target | current LoveTree if launched from Editor; Moment Timeline if launched from timeline context |

---

## Time editing model

The UI should accept both user-friendly and precise formats:

- `mm:ss` for visible fields
- seconds internally for storage
- optional conversion helper for pasted `t=` or `start=` URL parameters

Validation rules:

- `startSeconds >= 0`
- `endSeconds > startSeconds`
- default duration applies only when end is not set
- invalid input shows inline copy before save
- unavailable/invalid YouTube video blocks save with a clear message

---

## Candidate layout

### Desktop

Use a two-column composition:

- left: URL input and preview player
- right: Moment details and save controls

Suggested order:

1. URL input
2. preview player
3. Save this moment / Set start / Set end controls
4. title/note/tags
5. loop preview
6. save target
7. save action

### Mobile

Use a single-column flow:

1. URL input
2. preview player
3. sticky or near-player capture controls
4. details form
5. save target
6. save action

Avoid drag-heavy interactions in the first mobile capture flow.

---

## Copy candidates

| UI location | Korean | English |
|---|---|---|
| Primary CTA | 이 순간 저장하기 | Save this moment |
| Set start | 시작 지점으로 설정 | Set start |
| Set end | 끝 지점으로 설정 | Set end |
| Loop preview | 이 구간 반복 미리보기 | Loop this segment |
| URL helper | 유튜브 링크를 붙여 넣고 마음이 움직인 지점을 찾아보세요. | Paste a YouTube link and find the moment that moved you. |
| Default duration helper | 기본 10초 구간으로 저장하고, 필요하면 시작과 끝을 조정할 수 있어요. | Saves a 10-second segment by default. You can adjust the start and end. |
| Invalid range | 끝 지점은 시작 지점보다 뒤에 있어야 해요. | End time must be later than start time. |
| Invalid video | 이 영상을 불러올 수 없어요. 다른 링크를 확인해 주세요. | This video cannot be loaded. Check the link and try again. |

---

## Data captured by the UI

The capture flow should produce a draft Moment object similar to:

```json
{
  "videoId": "string",
  "sourceUrl": "string",
  "startSeconds": 10,
  "endSeconds": 20,
  "title": "string",
  "note": "string",
  "tags": ["string"],
  "loop": false,
  "targetType": "tree-or-timeline",
  "targetId": "string"
}
```

Exact persistence shape remains out of scope for this design document.

---

## Open UX decisions

1. Should default duration be fixed at 10 seconds or user-configurable?
2. Should emotion tags start as presets, freeform, or both?
3. Should capture live inside Editor first, or as a separate Moment page?
4. Should the first save attach directly to a LoveTree, or require a timeline?
5. Should mobile capture support precise second entry in the first release?
6. Should a YouTube URL with an existing timestamp prefill `startSeconds`?

---

## Non-goals

- No player PoC implementation
- No database implementation
- No API contract implementation
- No reorder timeline UI
- No public sharing
- No video download
- No video export
- No server-side encoding
- No Search/Auth/Editor cleanup work
- No PR #7/prototype/reference/demo/variant changes

---

## Future PR split

1. YouTube segment player PoC proves playback behavior.
2. Data model/API contract audit defines persistence.
3. Capture UI shell implementation adds fields and disabled/safe preview state.
4. Player integration connects current time capture.
5. Save integration persists Moment drafts.
6. Browser/mobile smoke validates capture behavior.

---

## Acceptance criteria for this design stage

- Capture flow is documented.
- Required and optional fields are separated.
- Mobile considerations are documented.
- Invalid video and invalid time range behavior are defined.
- Future implementation can be split into small PRs.

---

Refs #364
Refs #362
