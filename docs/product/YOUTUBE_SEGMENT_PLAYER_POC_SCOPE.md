# YouTube Segment Player PoC Scope

## Purpose

Define the proof-of-concept scope for cue-based YouTube segment playback before any production integration.

This document supports Moment Timeline by clarifying what must be proven with the YouTube IFrame Player API.

Related issues:

- Parent: #362
- PoC: #366
- Planning PR: #363

---

## Scope

The PoC should validate whether LoveBud can reliably:

- parse a YouTube video ID from common URL formats
- load a video with the YouTube IFrame Player API
- seek to `startSeconds`
- detect current playback time
- stop at `endSeconds`
- advance to the next Moment segment
- loop a selected segment by seeking back to `startSeconds`
- sequence-play multiple segments
- report console, network, and player errors
- document browser behavior and limitations

---

## Non-goals

- No production UI
- No database persistence
- No API implementation
- No video download
- No video export
- No server-side encoding
- No Search/Auth/Editor cleanup work
- No PR #7/prototype/reference/demo/variant changes

---

## Candidate PoC path

The PoC should be isolated from active production pages.

Recommended path options for CTO approval:

| Option | Path | Notes |
|---|---|---|
| A | `pages/dev/youtube-segment-poc.html` | Static dev page, not linked from navigation |
| B | `pages/internal/youtube-segment-poc.html` | Internal naming, still static-only |
| C | local-only verifier page | No repository page, harder to review |

Recommended choice: **Option A**, if implementation is approved later.

The PoC page should not be linked from Home, Intro, Search, Detail, My Trees, Editor, Settings, or shared navigation.

---

## Required behaviors

| Behavior | Expected proof |
|---|---|
| Load video by `videoId` | Player enters ready state |
| Seek to `startSeconds` | playback begins near requested time |
| Detect current time | current time polling or player event strategy documented |
| Stop at `endSeconds` | playback pauses/stops within acceptable drift |
| Advance to next Moment | next cue loads after current cue end |
| Loop current segment | player seeks back to `startSeconds` repeatedly |
| Invalid/unavailable video | visible error state and console/player error capture |
| Invalid range | `endSeconds <= startSeconds` blocks playback |

---

## YouTube keyframe drift tolerance

The PoC must assume YouTube playback may not start at the exact requested frame.

Acceptance should be based on segment behavior, not frame-accurate editing:

- `seekTo(startSeconds)` may land slightly before or after the requested time.
- The player should still enforce the segment end using current time checks.
- Drift should be recorded as observed behavior.
- LoveBud should not promise frame-accurate clipping.

---

## Candidate test cases

1. Play one segment from `00:10` to `00:20`.
2. Loop one segment.
3. Play two Moments from two different YouTube videos.
4. Switch from one segment to the next.
5. Handle invalid or unavailable video.
6. Handle `endSeconds` earlier than `startSeconds`.
7. Mobile browser smoke.

---

## PoC controls

The PoC implementation may include simple controls only:

- video ID / URL input
- start seconds input
- end seconds input
- load button
- play segment button
- loop toggle
- play sequence button
- error/status log panel

No final LoveBud visual design is required for the PoC.

---

## Verification evidence to collect

The implementation PR should record:

- browser and viewport
- tested video IDs or safe public sample URLs
- observed start drift
- observed end behavior
- loop behavior result
- sequence playback result
- console errors
- network/player errors
- mobile smoke result

Do not record private user data or credentials.

---

## Go / No-Go criteria

### Go

Proceed toward production integration if:

- segment start/end playback is reliable enough for cue-based memories
- loop behavior works without fatal player errors
- sequence playback can advance between cues
- mobile smoke is acceptable
- limitations are clearly documented

### No-Go / Blocked

Block or redesign if:

- YouTube API restrictions prevent reliable cue loading
- end detection is too unstable for acceptable UX
- mobile autoplay/player constraints break the core flow
- unavailable video handling cannot be surfaced cleanly

---

## Future PR split

1. PoC implementation page with static sample controls.
2. Browser verification report documenting feasibility.
3. Capture UI shell implementation after PoC passes.
4. Timeline sequence playback integration after capture/timeline data model is approved.

---

## Acceptance criteria for this docs stage

- PoC path options are documented.
- Required behaviors are listed.
- Test cases are documented.
- Keyframe drift tolerance is defined.
- Production integration remains blocked until PoC evidence exists.

---

Refs #366
Refs #362
