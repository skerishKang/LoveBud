# Moment Video Clip Playlist — Product Planning (Refs #1022)

## Core Concept

Each moment may reference a source video with a time range:
```
source video + start time + end time = moment video clip
```

A tree/branch can become a sequential playlist:
```
clip 1 → clip 2 → clip 3 → ...
```

## Key Design Decisions Required

### 1. Video Source Storage
- How does a moment store its source video reference? (URL, platform ID, custom upload?)
- How are start/end times stored? (seconds offset, timestamp string, frame number?)

### 2. Playlist UX
- Where does the playlist player live? (Separate page? Overlay? Sidebar?)
- How does the user navigate between clips? (Auto-advance? Manual? Loop?)
- Are there playlist controls (shuffle, repeat, speed)?

### 3. Tree-First Integration
- Playlist follows tree/branch order, not creation order
- If user reorders moments in the tree, the playlist order follows
- The tree remains the primary structure; playlist is a consumption mode

### 4. Editor Integration
- Add start/end time pickers to the create/edit moment form
- Source video autocomplete or manual URL input
- Preview clip range before saving

### 5. Platform Support
- YouTube (primary — embedded player API)
- Other platforms? (Vimeo, custom MP4, etc.)
- Fallback behavior for unsupported sources

## Technical Considerations

- **Video player**: YouTube IFrame API for embedded clips with start/end parameters
- **Clip chaining**: Queue the next video when current clip ends
- **State persistence**: Playlist progress saved or ephemeral per session?
- **Performance**: Lazy-load video players, preload next clip metadata

## Suggested Implementation Phases

### Phase 1: Foundation (MVP)
- Add start/end time fields to moment form (Editor)
- Store time range in DB
- Basic embedded player per moment (Public Viewer)

### Phase 2: Playlist
- Sequential playback in tree/branch order
- Playlist controls (next/prev/auto-advance)
- Queue indicator showing clip positions

### Phase 3: Polish
- Custom player UI with LoveBud theme
- Keyboard shortcuts
- Shareable playlist links

## Blockers
- DB schema for moment video source/time range
- Editor form layout for time fields
- Product decision: what video sources to support

---
*Planning document v1 — Refs #1022*
