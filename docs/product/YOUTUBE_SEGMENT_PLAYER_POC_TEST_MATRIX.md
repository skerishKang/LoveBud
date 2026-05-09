# YouTube Segment Player PoC Test Matrix

## Purpose

This document defines the test matrix and browser verification requirements for the YouTube segment player PoC implementation under Issue #366 (Prototype YouTube segment player for Moment Timeline). It is a child PoC of Issue #362 (Moment Timeline planning). This is a docs-only specification; no runtime implementation is performed here.

## PoC Scope

The PoC will validate the feasibility of cue-based YouTube segment playback using the YouTube IFrame Player API. Implemented behaviors:

- Parse YouTube video ID from various URL formats.
- Load video with YouTube IFrame Player API.
- Start playback from `startSeconds`.
- Stop playback at `endSeconds` or advance to next segment.
- Loop a selected segment by seeking back to `startSeconds`.
- Sequence-play multiple segments across potentially different videos.
- Record browser/player behavior and limitations (keyframe drift, autoplay restrictions, embed constraints).

## Non-Goals

The following are explicitly out of scope for this PoC:

- No production UI integration.
- No database persistence.
- No video downloading.
- No video export or file generation.
- No server-side encoding/transcoding.
- No Search/Auth/Editor cleanup work.
- No PR #7/prototype/reference/demo/variant path usage.
- No connection to LoveTree data model or backend services.

## Candidate Implementation Path

The contained PoC path must be approved by CTO before coding begins:

- Standalone PoC page or sandbox component (not wired to production navigation).
- Hard-coded test data array of segments (no persistence layer).
- YouTube IFrame Player API loaded from `https://www.youtube.com/iframe_api`.
- Playback controls implemented in client-side JavaScript only.
- Console logging of errors, state transitions, and drift observations.
- No routing, no backend calls, no auth required.

## Data Shape for PoC Only

The PoC will operate on an array of segment objects:

```typescript
interface PoCSegment {
  videoId: string;       // YouTube video ID
  startSeconds: number;  // Segment start time in seconds
  endSeconds: number;    // Segment end time in seconds
  title: string;         // User-facing title
  order: number;         // Sequence order
  loop: boolean;         // Whether to loop this segment
  sourceUrl?: string;    // Optional: original URL for parsing validation
}
```

No backend schema, Firestore collection, or API contract is defined in this PoC.

## Test Matrix

The PoC must pass the following test cases (manual browser verification):

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Play one segment from 00:10 to 00:20 | Video loads, seeks to 10s, plays until 20s, stops |
| 2 | Loop one segment | At endSeconds, seeks to startSeconds and continues playing (loop) |
| 3 | Play two moments from two different YouTube videos | First segment completes, second video loads and plays from its startSeconds |
| 4 | Switch from one segment to the next | Seamless transition (or documented gap) between segments |
| 5 | Handle invalid/unavailable video | Player displays error state; console logs error; no crash |
| 6 | Handle endSeconds earlier than startSeconds | Validation error logged; segment skipped or clamped with documented behavior |
| 7 | Mobile viewport smoke | Player renders and plays correctly on mobile screen size |
| 8 | Console fatal error check | No uncaught exceptions; errors reported gracefully |
| 9 | Network/player error check | Network failures or player API errors handled without crash |

## Browser Verification Requirements

Verification must be conducted across environments:

- **Desktop viewport:** Chrome/Edge (latest), Firefox (latest), Safari (latest)
- **Mobile viewport:** iOS Safari, Chrome Android
- **Console:** No fatal errors during normal playback sequence
- **Network/Player:** Handle `onError` callbacks from YouTube IFrame API
- **Keyframe drift:** Document any observed deviation from exact `startSeconds`/`endSeconds` due to YouTube keyframe alignment
- **Autoplay limitations:** Document any autoplay restrictions requiring user gesture
- **Embed availability:** Document any videos that block embedding (player shows restricted message)

## Relationship to Issue #362

- Issue #362 covers the full Moment Timeline feature: data model, LoveTree linkage, editor integration, reorder UI, persistence, share/view pages.
- This PoC (#366) validates only the player feasibility: cue-based segment playback and sequence behavior.
- The PoC does not implement #362's persistence, routing, UI, or tree integration — those are separate follow-up issues.

## Follow-up PR Split (recommended order)

1. **PR A:** Contained PoC runtime page (static HTML + JS sandbox)
2. **PR B:** Browser verification report (evidence of test matrix completion)
3. **PR C:** Data model/API contract audit for #362 (Firestore schema, API routes)
4. **PR D:** Moment capture UI in tree/editor context
5. **PR E:** Timeline reorder UI
6. **PR F:** Sequence playback integration into production LoveTree flow
7. **PR G:** Share/view page for curated moment timelines

## Safety Guardrails

- Refs #366 only for PoC implementation PRs (no close keywords in this doc).
- Refs #362 for parent feature linkage.
- Do not use PR #7/prototype/reference/demo/variant paths.
- No video download/export features at any point.
- No production persistence in PoC.
- CTO approval required before moving from PoC to implementation PRs.
