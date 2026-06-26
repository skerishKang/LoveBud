# Browse / My Trees Canonical Structure Reconciliation — Architecture Audit

## 1. Purpose and scope

This document audits the current page-level structure of **Browse** (`pages/search.html`)
and **My Trees** (`pages/my-trees.html`) to identify shared baseline, duplication,
wrapper-depth divergence, CSS ownership redundancy, and migration seams toward a
unified canonical topology.

This is **Phase 1 — audit only**. No production HTML, CSS, or JS behaviour is changed.
Phase 2 will normalise the identified seams.

---

## 2. Existing shared baseline

### 2.1 Shared calm page shell contract

Both pages have been converged onto `lovetree-calm-two-column-shell` via
`css/global/lovetree-calm-page-shell.css`. The shell defines:

- `.lovetree-calm-two-column-shell` — two-column grid (`minmax(0, 1fr) minmax(360px, 400px)`)
- `.lovetree-calm-main-column` — left column
- `.lovetree-calm-right-rail` — right column (sticky `top: 133px`)
- `.lovetree-calm-utility-row` — shared utility/finder row
- `.lovetree-calm-results-head` — shared results-head row
- Responsive collapse breakpoints at 1024px and 768px

Enforced by `tests/contracts/shared-page-shell-contract.test.cjs`.

### 2.2 Preview hub canonical skeleton contract

Both pages use the same semantic slot skeleton inside the hub `<aside>`:

```
aside.preview-hub
  header
  media slot
  content slot
    heading slot
    meta slot
    flow slot
    summary slot
    actions slot
    social slot
```

Enforced by `tests/contracts/preview-hub-canonical-skeleton-contract.test.cjs`.

### 2.3 My Trees / Browse hub alignment contract

My Trees hub has converged onto the shared calm shell and removed legacy wrappers
(`my-trees-with-hub`, `my-trees-dashboard-grid-shell`). The hub split file
(`my-trees-preview-hub/layout.css`) no longer owns the 2-column grid — ownership
belongs to the global calm page shell.

Enforced by `tests/contracts/my-trees-browse-hub-structure-alignment-contract.test.cjs`.

---

## 3. Current structure map

### 3.1 Browse (`pages/search.html`)

```
body.bokeh-bg
  main.search-container.lovetree-calm-two-column-shell
    [lovetree-calm-main-column]
      .browse-curation-shell.reveal-up              ← hero
        .search-panel-header
          .search-panel-eyebrow (span)
          h1.headline
          p
      .browse-utility-row.lovetree-calm-utility-row ← finder
      .browse-results-head.lovetree-calm-results-head  ← results head (flat)
        span.browse-results-label
        .browse-results-controls
          #browseSortControls (JS mount)
          #browseViewModeMount (JS mount)
      #resultsList.reveal-up                        ← results list
        tree-card skeleton (×3, inline)
    [lovetree-calm-right-rail]
      aside.preview-sidebar.preview-hub             ← preview hub
        header.preview-panel-header
        #previewVideoContainer.video-container
          .preview-empty-state
        #previewDesc.preview-panel-desc
          #previewTitle
          #previewHubMetaSlot                       ← meta slot
            #previewHubDynamicMetadataSlot (JS mount)
            #previewTreeStats[hidden]
            #previewEmotionSection[hidden]
          #previewHubFlowSlot (JS mount)            ← flow slot
          #previewHubSummarySlot (JS mount)          ← summary slot
          #previewHubActionsSlot (JS mount)           ← actions slot
          #previewHubSocialSlot (JS mount)            ← social slot
```

### 3.2 My Trees (`pages/my-trees.html`)

```
body.bokeh-bg.my-trees-auth-pending
  #myTreesContainer.my-trees-container.lovetree-calm-two-column-shell
    [lovetree-calm-main-column]
      .browse-curation-shell.reveal-up              ← hero
        .search-panel-header
          .search-panel-eyebrow (div)
          h1.headline
          p
      #myTreesFinder.browse-utility-row.my-trees-finder.lovetree-calm-utility-row  ← finder
      .browse-results-head.my-trees-results-head   ← results head (nested)
        .my-trees-results-title-row                  ← EXTRA wrapper
          span.browse-results-label
          #headerCreateTreeBtn
        .browse-results-controls
          .sort-control
            #sortTreesSelect
          #myTreesViewModeMount
      #treesContainer.reveal-up                    ← results list + states
        #state-loading (spinner + skeleton)
        #state-error (icon + retry)
        #state-empty (icon + create)
        #state-loaded (empty, JS fills)
    [lovetree-calm-right-rail]
      aside.my-trees-hub-panel.preview-sidebar.preview-hub
                                          .is-empty.preview-state-empty
        .my-trees-hub-header                       ← div (not header)
        #myTreesHubVideoContainer
          .my-trees-hub-placeholder
          .my-trees-hub-media[hidden]
        #myTreesHubContent[hidden]                  ← content (static, toggled)
          #myTreesHubTreeTitle
          #myTreesHubMetaBadge
          #myTreesHubFlow[hidden]                   ← static flow markup
          #myTreesHubNoMoments[hidden]
          #myTreesHubSummary
          #myTreesHubActions[hidden]                 ← static action markup
          #myTreesHubSocialSlot
```

---

## 4. Duplication / divergence ledger

### 4.1 `search-container` vs `my-trees-container` geometry duplication

Both `.search-container` and `.my-trees-container` define identical grid geometry
(`width: min(100%, var(--page-shell-max))`, `margin: 0 auto`, `padding`,
`display: grid`, `grid-template-columns`, `gap`). This is fully duplicated with
the shared `.lovetree-calm-two-column-shell` class doing the same.

The only unique additions are:
- `.my-trees-container` adds `min-height: 100vh`
- `.my-trees-container` has a `body.my-trees-auth-pending` guard for visibility

The shared shell should eventually absorb the unique deltas, and the page-specific
container classes should become thin overrides or be removed.

### 4.2 Results-head wrapper-depth difference

**Browse**: flat — label and controls are direct children of `.browse-results-head`.

```
.browse-results-head
  span.browse-results-label
  .browse-results-controls
```

**My Trees**: nested — label is inside `.my-trees-results-title-row`, controls below.

```
.my-trees-results-head
  .my-trees-results-title-row                       ← EXTRA wrapper
    span.browse-results-label
    #headerCreateTreeBtn
  .browse-results-controls
    .sort-control
    #myTreesViewModeMount
```

This wrapper depth difference is the single largest structural divergence in the
results-head region. Phase 2 should normalise to a consistent topology.

### 4.3 Browse slot injection vs My Trees static owner hub markup

**Browse** uses a **slot injection** pattern:
- Hub content areas are empty `<div>` slots (`#previewHubFlowSlot`,
  `#previewHubSummarySlot`, `#previewHubActionsSlot`, `#previewHubSocialSlot`)
- All content is rendered by JS (`search-preview-renderer.js` + hub-dom-patch)
- The flow list, summary, and actions are assembled programmatically

**My Trees** uses a **static markup with `.hidden` toggle** pattern:
- Hub content is pre-rendered in HTML (`#myTreesHubFlow` with label + list + controls,
  `#myTreesHubActions` with open/edit/share buttons, `#myTreesHubSummary`)
- JS fills text content into existing elements and toggles visibility via `.hidden`
- Only `#myTreesHubSocialSlot` is a true slot (populated by JS)

This is an architecture difference driven by owner vs public context: My Trees
always knows its action set (open/edit/share/social), while Browse needs generic
slots because the action set depends on the selected tree's owner status.

### 4.4 Preview surface CSS duplication

Both `css/search/search-preview-sidebar.css` and `css/my-trees/my-trees-preview-hub.css`
manage hub-related styles. Key duplication areas:

| Area | Browse ownership | My Trees ownership |
|------|------------------|--------------------|
| Hub base scroll | `shared/preview-hub-scroll.css` | `shared/preview-hub-scroll.css` (shared) |
| Sidebar base | `search/search-preview-sidebar/layout.css` | `my-trees-preview-hub/layout.css` |
| Header | `search/search-preview-sidebar/header.css` | — (inline in HTML + hub layout) |
| Flow | `search/search-preview-sidebar/flow.css` | `my-trees-preview-hub/flow.css` |
| Actions | `search/search-preview-sidebar/actions.css` | `my-trees-preview-hub/actions.css` |
| Responsive | `search/search-preview-sidebar/responsive.css` | `my-trees-preview-hub/responsive.css` |
| Social bar | `search/search-preview-social-bar.css` | shared base + `my-trees-preview-hub/social-bar.css` |

My Trees sidebars override or replace most Browse-specific sidebar sub-modules
with their own versions under `my-trees-preview-hub/`. The canonical split should
move shared sub-modules to `css/shared/` and keep only page-specific deltas in
each page's CSS folder.

---

## 5. Canonical target topology

The reconciliation target is a single canonical structure shared by both pages:

```
page-shell (lovetree-calm-two-column-shell)
├── lovetree-calm-main-column
│   ├── hero
│   │   └── search-panel-header
│   │       ├── search-panel-eyebrow
│   │       ├── h1.headline
│   │       └── p
│   ├── finder
│   │   └── browse-utility-row.lovetree-calm-utility-row
│   │       ├── search-input-wrapper
│   │       ├── filter-row
│   ├── results-head (lovetree-calm-results-head)
│   │   ├── results label
│   │   ├── optional owner CTA slot (owner pages only)
│   │   └── controls
│   │       ├── sort control
│   │       └── view mode control
│   ├── results list or state region
│       ├── loading state
│       ├── error state
│       ├── empty state
│       └── loaded results grid
└── lovetree-calm-right-rail
    └── aside.preview-hub
        ├── header
        │   ├── title group
        │   ├── badge
        │   └── close button
        ├── media slot
        ├── content slot
        │   ├── heading (title)
        │   ├── meta (badge / stats)
        │   ├── flow (with optional no-moments fallback)
        │   ├── summary
        │   ├── actions
        │   └── social
```

---

## 6. Allowed owner/public deltas

Some differences are inherent to Browse (public, read-only, multi-tenant) vs
My Trees (owner-authenticated, writable, single-user). The following deltas are
**not** candidates for normalisation:

| Delta | Rationale |
|-------|-----------|
| Browse filter chips use `<span>` with emotion-based categories; My Trees uses `<button>` with property-based filters | Current semantic implementation difference; future accessibility/interaction normalization candidate |
| Browse actions are JS-rendered into slots; My Trees actions are pre-rendered static markup | My Trees has a fixed owner action set (open/edit/share/visibility); Browse must vary by tree ownership |
| My Trees has `#headerCreateTreeBtn` in results-head | Owner-only affordance; not applicable to public Browse |
| My Trees has `#state-loading/error/empty/loaded` formal state containers | Owner view requires explicit error/empty states with actionable retry/create buttons |
| Browse has `#previewHubDynamicMetadataSlot` inside meta slot | Browse metadata is dynamic (tree stats, emotion tags); My Trees uses a static meta badge |
| My Trees hub has initial `is-empty preview-state-empty` state | Owner hub starts empty and must show a placeholder before any tree is selected |

---

## 7. Migration seams and proposed Phase 2 order

1. **Normalise page container geometry**: Consolidate `.search-container` /
   `.my-trees-container` geometry into the shared calm shell; make page-specific
   classes thin overrides.

2. **Unify results-head wrapper depth**: Eliminate the extra
   `.my-trees-results-title-row` wrapper; add an optional owner CTA slot directly
   alongside the label.

3. **Move shared hub CSS to `css/shared/`**: Extract flow, actions, social-bar
   sub-modules that are content-identical between Browse and My Trees into
   `css/shared/preview-hub/` with page-specific deltas remaining in each page's
   CSS.

4. **Evaluate hub rendering convergence**: Determine whether My Trees static
   hub markup can be replaced with slot injection (or Browse inject into static
   hosts) for the canonical hub renderer.

5. **Evaluate results list state convergence**: Determine whether Browse should
   adopt explicit state containers (loading/error/empty/loaded) matching My Trees.

---

## 8. Non-goals and regression risks

### Non-goals

- Changing any production HTML, CSS, or JS behaviour
- Changing runtime behaviour of Browse or My Trees
- Removing the container div or class from either page
- Removing search-container or my-trees-container as HTML elements
- Modifying any existing contract test
- Touching Scout, auth, API, editor, or viewer code
- Introducing new layout breakpoints or responsive behaviour
- Changing the hub scroll behaviour (shared `preview-hub-scroll.css` is already shared)

### Regression risks

- The `min-height: 100vh` on `.my-trees-container` prevents the page from
  collapsing during auth-pending state. Removing or moving this without
  equivalent guard could cause layout shift.
- The results-head wrapper depth difference is relied upon by both
  `my-trees-header.css` flex layout and `search-hero-controls.css` flex layout.
  Normalising wrapper depth must adjust both simultaneously.
- My Trees hub static markup uses `hidden` attribute for content toggle.
  Converting to slot injection must preserve the exact initial render behaviour.
- The `my-trees-preview-hub/social-bar.css` overrides shared social bar CSS.
  Sharing the social bar must account for these overrides.

---

## 9. Validation matrix

| Check | Mechanism |
|-------|-----------|
| Both pages retain `lovetree-calm-two-column-shell` | `shared-page-shell-contract.test.cjs` |
| Both pages retain `lovetree-calm-main-column` | `shared-page-shell-contract.test.cjs` |
| Both pages retain `lovetree-calm-right-rail` | `shared-page-shell-contract.test.cjs` |
| Both pages retain `browse-curation-shell` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Both pages retain `search-panel-header` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Both pages retain `browse-utility-row` / `lovetree-calm-utility-row` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Both pages retain `browse-results-head` / `lovetree-calm-results-head` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Both pages retain `preview-hub` | `preview-hub-canonical-skeleton-contract.test.cjs` |
| Results-head deltas documented: Browse has `browseSortControls` + `browseViewModeMount`; My Trees has `headerCreateTreeBtn` + `sortTreesSelect` + `myTreesViewModeMount` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Hub rendering deltas documented: Browse has `previewHubFlowSlot` / `previewHubSummarySlot` / `previewHubActionsSlot`; My Trees has `myTreesHubFlow` / `myTreesHubSummary` / `myTreesHubActions` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Both CSS entrypoints import shared `preview-hub-scroll.css` | `browse-my-trees-structure-reconciliation-contract.test.cjs` |
| Current results-head wrapper depth is NOT locked as permanent architecture | `browse-my-trees-structure-reconciliation-contract.test.cjs` |

---

Refs #2923
Refs #2903
Refs #1882
