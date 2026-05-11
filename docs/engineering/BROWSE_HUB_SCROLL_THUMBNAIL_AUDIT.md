# Browse Hub Scroll Thumbnail Behavior Audit

## Scope

This note records an investigation target for the observed Browse appreciation hub behavior where the visible media thumbnail appears to change while the hub panel is scrolled.

## Current question

Is the thumbnail/media change on Browse appreciation hub scroll an intentional feature, or an incidental side effect of existing media rendering and lazy loading?

## Initial code search result

A repository search for explicit scroll-driven media switching logic did not find a dedicated Browse hub feature that maps scroll position to selected moment media.

Search terms reviewed:

- `scroll preview thumbnail search previewVideoContainer IntersectionObserver currentSrc`
- `preview-sidebar scroll thumbnail video image change`

No explicit scroll observer, IntersectionObserver, or preview-sidebar scroll handler dedicated to thumbnail switching was found from the search pass.

## Working interpretation

The observed behavior should be treated as **unconfirmed / incidental** until browser verification proves otherwise.

Likely explanations:

1. The iframe or image source finishes loading after scroll, making the media appear to change.
2. The right hub panel scroll changes the visible crop/position of already-rendered media.
3. A separate preview update is being triggered by another click/selection path, not by scroll itself.
4. Browser caching or Cloudflare preview freshness causes different commits/assets to be mixed during verification.

## Required browser verification

Use the latest Cloudflare PR preview or fixed test slot for the active Browse hub PR.

Verification steps:

1. Open `pages/search.html` in a clean browser profile or with extensions disabled.
2. Select the first visible Browse card.
3. Record the initial hub media thumbnail or iframe title.
4. Scroll only the appreciation hub panel without clicking flow items or cards.
5. Confirm whether the media changes.
6. If it changes, inspect whether a click event, `updatePreview`, or iframe reload occurs.
7. Click `1`, `2`, `3`, `4` in the `이어진 흐름` section and confirm whether media changes intentionally.
8. Confirm whether scroll-driven change is reproducible after hard refresh.

## Product decision

Current product preference:

- Moment media should change when the user selects a flow item.
- Scroll alone should not silently change the selected media unless a dedicated scroll-sync design is explicitly approved.
- If scroll-sync is desired later, it should be tracked as a separate feature with active state, accessible keyboard behavior, and mobile behavior.

## Non-goals

- Do not modify runtime behavior in this audit PR.
- Do not change Browse card layout.
- Do not change media playback implementation.
- Do not change backend/API/Auth/DB/schema.
- Do not expose raw IDs, raw payloads, private data, or secrets.
- Do not modify PR #7 or prototype/reference/demo/variant paths.

## Follow-up recommendation

If scroll-driven media switching is confirmed as real and desirable, create a separate feature issue for:

- Browse hub scroll-synced moment preview
- Active moment state display
- Keyboard/focus parity
- Mobile drawer behavior

If it is not confirmed, keep the intentional interaction limited to clicking the `이어진 흐름` items.
