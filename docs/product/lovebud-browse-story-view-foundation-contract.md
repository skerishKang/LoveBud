# LoveBud Browse Story View — Foundation Contract

- **Implementation child:** #3655 `[UX][Browse] Add an opt-in Story view foundation for loaded LoveTree results`
- **Parent product issue:** #3654 `[PRODUCT][UX][Browse][My Trees] Add a fourth Story Showcase card view mode` — **Keep OPEN**
- **Related:** #3608 (completed; canonical card geometry preserved), #3578 (completed; shared card composition preserved)
- **Unrelated but kept OPEN:** #1882 — **Keep OPEN** (this child does not resolve it)
- **Baseline `origin/main`:** `b3bcdda7d69fe98d447df41fddcd9edcde4e20cd`
- **Branch:** `feat/browse-story-view-foundation-3655`

## What this child delivers

A fourth, **opt-in** Browse view mode named `story` (KR `스토리` / EN `Story`) on
`pages/search.html`, implemented as a foundation for the focused 1–3 card
exploration concept validated by parent #3654. It answers five product
questions with a real, shippable surface:

1. Is focusing on 1–3 cards at a time a good fit for LoveBud Browse?
2. Does the Story presentation feel like the same product family as the
   existing LoveTree cards?
3. Is the amount of information per card appropriate?
4. Are plain previous/next arrows plus a local position indicator enough
   for users to understand the navigation?
5. Is the single-card mobile composition natural?

## Surface-specific mode capability

- The shared switcher (`js/tree-view-mode-switcher.js`) keeps three base
  modes `large / compact / list` as the default capability for every
  surface. A new `KNOWN_MODES` list adds `story` as a known-but-not-default
  mode.
- Surfaces opt in per call via `modes` (Browse passes
  `['large', 'compact', 'list', 'story']` in
  `js/search/search-page-shell-init.js`).
- **My Trees is unchanged**: it passes no `modes` option, keeps exactly
  `large / compact / list`, default `compact`, and a stored `story` value
  on the My Trees storage key is treated as invalid with a `compact`
  fallback. Invalid stored values are **never deleted or rewritten**.
- Existing stored `large / compact / list` values remain valid on both
  surfaces; the Browse default remains `compact`; storage keys unchanged.
- Exported mode arrays are frozen; unknown tokens in a `modes` option are
  dropped.

## Local loaded-results grouping (NOT server pagination)

- The Story controller (`js/search/search-story-view.js`) groups **only the
  cards currently loaded** in `#resultsList`. The `01 / 04` indicator is a
  **local group index over loaded results** — it is not a backend page
  number, and no pagination query, offset, total-count, or extra request of
  any kind is introduced.
- Cards are the canonical rendered `.tree-card[data-tree-id]` DOM nodes
  built by `LoveBudTreeCardComposition` via
  `js/search/search-card-renderer.js`. The controller never rebuilds card
  HTML, rewrites card content, reorders cards, or creates new card routes.
  The canonical appreciation route (`view.html?treeId=...`) and the single
  primary CTA per card are preserved exactly.
- Card activation (click / Enter / Space), preview-hub selection, image
  fallback, and mobile open behaviour remain owned by
  `js/search/search-card-events.js` — the Story controller binds no
  per-card listeners.
- Result-set replacement (search / filter / sort / load-more) is detected
  with a `MutationObserver` on `#resultsList` (`childList` only, so
  visibility toggles never feed back). On a new result set the group index
  resets to the first group; skeleton-only states hide the navigation.

## Responsive group size

| Viewport            | Visible cards per group |
| ------------------- | ----------------------- |
| `>= 1200px`         | 3                       |
| `768px – 1199px`    | 2                       |
| `< 768px`           | 1                       |

The controller writes `data-story-group-size` with the current group's
actual card count, and CSS columns follow that attribute — a 2-card group
never leaves an empty third slot and a single card is centered. Hidden
cards use the `hidden` attribute (enforced with `display: none` in CSS),
so they leave layout, the accessibility tree, and the tab order.

## Navigation, keyboard, motion

- Minimal controls only: previous arrow, local position indicator
  (`01 / 04`), next arrow. Buttons are `type="button"`, carry localized
  `aria-label`s, and expose accurate disabled boundary states (single-group
  sets disable both; zero results hide the nav).
- No numbered page buttons, no ellipsis rails, no wraparound, no timed
  auto-advance, no looping timers, no swipe/carousel libraries. The final
  pink pill pagination rail is explicitly deferred to a refinement child.
- Keyboard (Story mode active only): `ArrowLeft` / `ArrowRight` move one
  group, `Home` / `End` jump to the first/last group. Key events from
  `input`, `textarea`, `select`, and contenteditable elements are never
  intercepted; modifier-key combinations and key repeat are ignored; one
  keydown moves at most one group; focus is never forcibly moved into card
  internals. The indicator is a `role="status"` region with a localized
  assistive string (`스토리 1 / 4` / `Story 1 of 4`).
- Motion is bidirectional: outgoing and incoming groups animate
  simultaneously. Next direction slides outgoing left (`translateX(-8%)`,
  opacity 1→0) while incoming slides in from the right (`translateX(8%)`
  →0, opacity 0→1). Previous direction mirrors. Duration is 340ms with
  `cubic-bezier(0.22, 1, 0.36, 1)` easing. A temporary two-layer stage
  hosts both groups during the transition; the outgoing layer is `inert`
  and `aria-hidden`, and `aria-busy` is set on `#resultsList`. After the
  transition completes, wrappers are removed and canonical card order is
  restored. Rapid double-clicks and keydowns during a transition are
  blocked (only one group movement per transition). `prefers-reduced-motion:
  reduce` skips the animated path entirely (immediate swap, no wrappers).

## Visual family

Story mode reuses existing tokens (`--primary`, `--on-surface`,
`--on-surface-variant`, `--outline-variant`, `--lovetree-card-grid-gap`)
and the canonical card radius/shadow/typography. No new gradient system,
no glass surfaces, no travel-template palette hardcoded.

## Explicit non-scope of this child

- No My Trees Story mode (My Trees HTML/CSS/JS untouched).
- No default-mode change on any surface.
- No numbered pagination, ellipsis rails, autoplay, wraparound, swipe or
  external carousel libraries.
- No server/API pagination, no new API request, no DB/schema/migration
  work, no auth change (parallel DB PR #3653 owns that surface; this child
  touches none of its files).
- No AI-generated titles or summaries, no new image collection or
  rehosting, no Browse hero / search panel / preview hub redesign.
- No framework addition; the existing browser-global script loading model
  is preserved.
- No Home page (`index.html`) or Home hero changes (parallel PR #3640
  surface).

## Verification and acceptance

- Static contract: `tests/contracts/browse-story-view-foundation-3655-contract.test.cjs`
- Executable Chromium contract: `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs`
  (mode capability, grouping, keyboard, canonical card behaviour, and
  geometry at `1440×900`, `768×1024`, `375×812`, plus reduced-motion)
- Existing switcher / parity / #3608 geometry contracts continue to pass.
- **Production visual acceptance is required** after merge via the
  Merge-First Production Verification workflow at
  `https://lovebud.pages.dev/` before #3655 is closed.
- The next refinement child (full travel-card treatment, pink pill rail,
  richer motion) depends on actual feedback from this foundation.

---

## Additive evolution — surface-adapter boundary (#3813)

This section records the backward-compatible evolution of the shared Story
controller. The #3655 Browse foundation behavior documented above is
**unchanged** and remains the default when the new options are omitted.

### Context

The My Trees Story child (#3811) was blocked because the controller exposed no
supported way for a thin surface adapter to enter at a selected tree's group,
preserve selection across result replacement, receive settled group-change
notification, or supply surface-localized text. The Web CTO accepted the
blocker and authorized this four-file prerequisite (#3813): extend the shared
controller only. **My Trees Story is not implemented here.**

### New optional surface-adapter API

Existing API (unchanged, still authoritative):

```js
init({ results, navMount })
controller.setMode(mode)
controller.refresh()
controller.getCurrentGroup()
controller.getGroupCount()
controller.destroy()
```

Additive optional boundary:

```js
init({
  results,
  navMount,
  translate,      // optional function(semanticKey, locale) -> string | null
  onGroupChange   // optional function(snapshot)
})

controller.setMode('story', { initialTreeId })   // open the group containing this data-tree-id
controller.refresh({ preferredTreeId })          // re-collect and open the preferred group
controller.goTo(groupIndex)                      // public delegate to the existing internal goTo
controller.getVisibleTreeIds()                   // new frozen detached array of settled visible ids
```

Behavior rules:

- `initialTreeId`: exact string match only; the containing group is shown
  directly (never a transient group-0 render or an animated detour). Absent,
  empty, malformed, or not-found IDs keep the existing group-0 entry.
- `preferredTreeId`: applied in one immediate settled render after a
  synchronous result replacement; queued MutationObserver records are
  discarded so no intermediate group-0 notification occurs. Omitted or
  not-found IDs keep the existing group-0 reset behavior.
- `goTo(index)`: exposes the existing navigation authority. Clamp, no-wrap,
  transition lock, reduced-motion immediate path, `aria-busy`, wrapper
  cleanup, and canonical card-order restoration are all preserved. No second
  transition path is created.
- `getVisibleTreeIds()`: returns a brand-new `Object.freeze`d detached array
  of the settled visible `data-tree-id` values in canonical order; an empty
  frozen array when inactive or empty. Never exposes internal `cards` or DOM
  nodes.

### Settled `onGroupChange` snapshot

After each **settled** group state the optional callback is invoked at most
once with a frozen plain object:

```js
{
  groupIndex,          // number
  groupCount,          // number
  firstVisibleTreeId,  // string | null
  visibleTreeIds       // frozen detached array of strings
}
```

- Immediate paths (`setMode` activation, `refresh`, reduced-motion
  navigation, breakpoint change, result-set reset) notify after the final
  hidden/visible state is applied.
- Normal animated navigation notifies **only after** transition wrappers are
  removed, `aria-busy` is cleared, canonical direct-child order is restored,
  and the final visibility is applied. Never at animation start.
- No-op/clamped-same/transition-blocked navigation never duplicates a
  notification. Callback absence is a complete no-op. Callback throws are
  contained (never propagated, never logged) and cannot corrupt controller
  state, navigation, cleanup, or later notifications.

### Surface-neutral translation

The optional `translate(semanticKey, locale)` receives only these five
semantic keys:

```text
story.regionLabel
story.previous
story.next
story.label
story.position   // may contain {current} and {total} placeholders
```

It is never handed `search.*` keys, `myTrees.*` keys, or the i18n object.
Resolution priority: (1) translator non-empty string, (2) existing Browse
`window.i18nSearch` key (`search.story.*` / `search.viewMode.story`), (3)
existing module `FALLBACK_STRINGS`. A missing, throwing, `null`, empty, or
non-string translator result silently falls through to the existing Browse
strings. Navigation labels and `aria-label`s are refreshed on every
`updateNav()` so the current locale stays authoritative.

### Browse backward compatibility

With the existing `init({ results, navMount })` call, none of the above
applies: Story activates at group 0, result replacement resets to group 0,
Browse i18n strings remain authoritative, grouping 3/2/1, keyboard,
transitions, reduced motion, card activation, media lifecycle, mutation
handling, and navigation markup are byte-equivalent in behavior. No callback,
no surface translator, and no My Trees script/key/selector/i18n namespace is
introduced.

### My Trees remains unimplemented

My Trees keeps exactly `large / compact / list`, default `compact`, storage
key `lovebud:myTrees:viewMode`, and rejects a stored `story` value (falls
back to `compact`, unrewritten). No My Trees script, nav mount, i18n, CSS, or
adapter is added by this prerequisite. Issue #3811 resumes from then-current
main after #3813 is independently reviewed and merged.

### Contract and scope notes

- No backend pagination, no API/DB/auth change, no framework/autoplay/looping
  addition, and no second transition authority.
- Exact four-file scope: `js/search/search-story-view.js`,
  `tests/contracts/browse-story-view-foundation-3655-contract.test.cjs`,
  `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs`,
  and this document.
