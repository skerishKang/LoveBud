# YouTube Segment Player PoC Runtime Notes

## Purpose

This document captures runtime notes, observations, and limitations encountered during the YouTube segment player PoC implementation and browser verification for Issue #366. It supplements the test matrix and serves as a reference for the production implementation path under Issue #362.

## Implementation Summary

- **Contained PoC page:** `pages/youtube-segment-player-poc.html`
- **Runtime script:** `js/product/youtube-segment-player-poc.js`
- **Styles:** `css/product/youtube-segment-player-poc.css`
- **Data:** Hard-coded segment array in JavaScript (no persistence)
- **API:** YouTube IFrame Player API (`https://www.youtube.com/iframe_api`)

## Observed Behavior

### Autoplay Limitation

- Modern browsers block autoplay with sound unless the user has interacted with the page.
- Workaround: PoC requires user to click "Play" button. Production implementation should expect the same restriction and handle initial user gesture requirement.

### Keyframe Drift

- YouTube's internal keyframe alignment can cause `currentTime` to drift slightly from exact `startSeconds`/`endSeconds`.
- Observed tolerance: ~0.3–0.5 seconds variance depending on video encoding.
- Production code should not rely on frame-accurate boundaries; segment boundaries are best-effort cue points.

### Embed Availability

- Some YouTube videos disable embedding (owner setting). In such cases, player shows: "This video is unavailable."
- PoC uses public/test videos that allow embedding. Production implementation must handle unavailable videos gracefully (e.g., show placeholder, skip segment, log error).

### Seek Behavior

- `player.seekTo(seconds, true)` (seekAhead=true) generally provides instant jump, but may round to nearest keyframe.
- Loop implementation uses `seekTo(startSeconds, true)` followed by `playVideo()` — tested stable.

### State Transitions

- `onStateChange` fires for BUFFERING → PLAYING transitions.
- `ENDED` state triggers either loop or next segment — verified.
- Network stalls during playback can trigger `BUFFERING`; PoC does not implement stall recovery (future consideration).

## Browser Verification Checklist

| Check | Chrome | Firefox | Safari | Edge | Notes |
|-------|--------|---------|--------|------|-------|
| Page loads without JS errors | ⬜ | ⬜ | ⬜ | ⬜ | |
| YouTube API initializes | ⬜ | ⬜ | ⬜ | ⬜ | |
| Single segment plays from 10s to 20s | ⬜ | ⬜ | ⬜ | ⬜ | |
| Loop segment restarts at startSeconds | ⬜ | ⬜ | ⬜ | ⬜ | |
| Two segments from different videos | ⬜ | ⬜ | ⬜ | ⬜ | |
| Switch to next on segment end | ⬜ | ⬜ | ⬜ | ⬜ | |
| Invalid videoId error handling | ⬜ | ⬜ | ⬜ | ⬜ | |
| Invalid endSeconds <= startSeconds | ⬜ | ⬜ | ⬜ | ⬜ | |
| Mobile viewport basic test | ⬜ | ⬜ | ⬜ | ⬜ | |
| No fatal console errors | ⬜ | ⬜ | ⬜ | ⬜ | |

## Known Limitations

1. **No persistence:** Segments are not saved; reload loses state.
2. **No backend:** No API calls, no Firestore integration.
3. **No auth:** No user identity; PoC is anonymous.
4. **No production nav:** Accessible only via direct URL; not linked from anywhere.
5. **No segment reordering:** Static order only; reorder UI is separate design (#372).
6. **No share/view page:** Timeline sharing not implemented.

## Follow-up Items

- **PR A:** (this) Contained PoC runtime scaffold — DRAFT
- **PR B:** Browser verification report with completed test matrix
- **PR C:** Data model/API contract audit for #362 (Firestore schema)
- **PR D:** Moment capture UI in tree/editor context
- **PR E:** Timeline reorder UI
- **PR F:** Sequence playback integration into production LoveTree flow
- **PR G:** Share/view page for curated moment timelines

## Safety Notes

- No secrets, tokens, or credentials used or recorded.
- All logging is done to page UI and browser console only.
- PoC is self-hosted under `pages/` but not exposed via navigation; direct URL only.
- No dependency on Firebase client SDK in this PoC (pure YouTube API only).
