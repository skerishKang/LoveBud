# Search Preview Renderer Helper Extraction Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #223 item 4  
> **Type:** Docs-only — no JS, CSS, HTML, API, or runtime changes in this document

---

## 1. Purpose

This document captures the responsibility boundary audit for `js/search-preview-renderer.js`.

The file currently handles several distinct concerns in a single renderer module. This audit maps each responsibility, identifies low-risk extraction candidates for follow-up PRs, records runtime risk notes, and defines the Browse/Search verification matrix required before any implementation PR.

No code changes are made in this document. `js/search-preview-renderer.js`, `js/search*.js`, `js/api/public-tree-adapter.js`, `pages/search.html`, and all CSS files are read-only with respect to this PR.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #223 item 4 |
| Audit target | `js/search-preview-renderer.js` |
| Related files (read-only) | `js/search*.js`, `js/api/public-tree-adapter.js`, `pages/search.html` |
| Core entry point | `updatePreview` function — must remain stable until helpers have contract coverage |

---

## 3. Current Renderer Responsibility Map

### 3.1 Preview Media Fallback

**Responsibility:** Handles thumbnail/image rendering with fallback logic when a tree has no cover image or when the primary image fails to load.

| Aspect | Notes |
|---|---|
| DOM target | Preview panel image/thumbnail element |
| Primary source | Tree cover image URL from public-tree-adapter response |
| Fallback chain | Missing URL → placeholder SVG / default cover — **VERIFY exact fallback order** |
| Error handling | `onerror` handler on `<img>` or equivalent — **VERIFY** |
| Inline style risk | Image `object-fit` / dimension override may be inline — **VERIFY** |
| Extraction readiness | **High** — self-contained, no URL state dependency |

**Concern:** Fallback logic is currently co-located with the full preview render path. It has no dependency on Search URL state or tree selection events, making it the **lowest-risk extraction candidate**.

---

### 3.2 Thumbnail / Image Handling

**Responsibility:** Constructs and injects the image element for the preview panel, including src resolution and lazy-load attributes.

| Aspect | Notes |
|---|---|
| DOM target | Preview panel `<img>` or background-image container |
| src resolution | Direct URL or constructed from tree metadata — **VERIFY** |
| Lazy-load | `loading="lazy"` or equivalent — **VERIFY** |
| Relation to media fallback | Fallback (3.1) activates when this path fails |
| Extraction readiness | **Medium** — couples with fallback logic; extract together with 3.1 |

---

### 3.3 Copy / Locale Formatting

**Responsibility:** Formats display strings for tree title, memory count, date labels, owner name, and any locale-sensitive copy in the preview panel.

| Aspect | Notes |
|---|---|
| DOM target | Title element, meta row (count, date, owner) in preview panel |
| Locale source | Browser locale or hardcoded `ko` — **VERIFY** |
| Date formatting | `Intl.DateTimeFormat` or manual format — **VERIFY** |
| Count pluralization | Memory/moment count label — **VERIFY** |
| Inline style risk | Text truncation may use inline `max-width` or `-webkit-line-clamp` override — **VERIFY** |
| Extraction readiness | **High** — pure formatting functions, no DOM event dependency |

**Concern:** Copy/locale formatting is stateless with respect to tree selection events and URL state, making it the **second-lowest-risk extraction candidate** after media fallback.

---

### 3.4 CTA / Share Markup

**Responsibility:** Renders call-to-action and share action elements in the preview panel (fork/copy button, share link, open-in-detail link).

| Aspect | Notes |
|---|---|
| DOM target | CTA button bar and share row at bottom of preview panel |
| Auth dependency | Fork/copy CTA gated by auth state — **VERIFY gate mechanism** |
| Public tree adapter | Share URL constructed from public tree adapter contract — **VERIFY URL shape** |
| Selected tree state | CTA targets the currently-selected tree; depends on selection state |
| Inline style risk | Button visibility via inline `display` — **VERIFY** |
| Extraction readiness | **Medium-Low** — requires contract coverage and auth gate verification first |

**Concern:** CTA/share markup has auth state dependency and public-tree-adapter URL contract coupling. Extraction must wait until contract tests cover `updatePreview` behavior (see Section 6).

---

### 3.5 Hydration / Event Binding

**Responsibility:** Attaches click, scroll, and keyboard event listeners to dynamically rendered preview panel elements after each `updatePreview` call.

| Aspect | Notes |
|---|---|
| Trigger | Called after each preview DOM insertion |
| Listener cleanup | Whether old listeners are removed before re-bind — **VERIFY for leak risk** |
| Mobile scroll behavior | Scroll handler for preview panel open/close on mobile — **VERIFY** |
| CTA event binding | Fork/copy, share, detail link click handlers bound here |
| Extraction readiness | **Low** — tightly coupled with DOM structure; defer until CTA markup is stabilized |

**Concern:** Listener leak risk if old listeners are not cleaned up before each re-bind. Verify before any extraction.

---

### 3.6 Selected Tree Preview State Dependency

**Responsibility:** Reads and responds to the currently-selected tree state (from Search URL params, browser history, or in-memory selection).

| Aspect | Notes |
|---|---|
| State source | URL param (`?tree=`, `?id=`, or equivalent) or in-memory selected tree object — **VERIFY** |
| `updatePreview` dependency | All rendering paths depend on this state being resolved before render |
| Deep link behavior | Direct URL with tree param must open preview in correct state |
| Extraction readiness | **Not a candidate** — this is the core controller concern; do not extract |

---

## 4. Extraction Candidates

| Priority | Candidate helper | Scope | Extraction readiness |
|---|---|---|---|
| **1 (first)** | Media fallback helper | Image src resolution + `onerror` fallback chain only | High — no URL/state dependency |
| **2 (second)** | Copy/locale formatting helper | Title, date, count, owner string formatting only | High — pure functions |
| **3 (later)** | CTA/share markup helper | Fork/copy button + share URL markup | Medium-Low — requires contract coverage first |
| **Deferred** | Preview controller split | `updatePreview` orchestration, hydration, state dependency | Not candidate — requires separate CTO approval |

### 4.1 First Extraction: Media Fallback Helper

**Branch candidate:** `refactor/search-preview-media-helper`  
**Proposed file:** `js/search/search-preview-media.js`  
**Scope:**
- Extract `<img>` src resolution and `onerror` fallback chain from `updatePreview`.
- No change to fallback behavior or placeholder assets.
- `updatePreview` calls the new helper for image rendering.

**Guardrails:**
- No change to `updatePreview` public signature.
- No change to Search URL state handling.
- Browse/Search smoke required (see Section 5) before merge.

---

### 4.2 Second Extraction: Copy/Locale Formatting Helper

**Branch candidate:** `refactor/search-preview-copy-helper`  
**Proposed file:** `js/search/search-preview-copy.js`  
**Scope:**
- Extract title, date, count, and owner string formatting from `updatePreview`.
- Pure functions only — no DOM mutation inside helper.
- `updatePreview` calls helpers for formatted strings before DOM injection.

**Guardrails:**
- No change to displayed copy or locale behavior.
- No change to `updatePreview` public signature.
- Browse/Search smoke required (see Section 5) before merge.

---

### 4.3 Later: CTA/Share Markup Helper

**Branch candidate:** `refactor/search-preview-cta-helper`  
**Pre-condition:** Contract tests covering `updatePreview` CTA/share behavior must exist before this extraction.

---

### 4.4 Deferred: Preview Controller Split

`updatePreview` orchestration, hydration/event binding, and selected tree state dependency are **not extraction candidates** in the current phase. A separate CTO approval is required before any controller-level split is planned.

---

## 5. Runtime Risk Notes

| Risk area | Description | Mitigation |
|---|---|---|
| **Search URL state regression** | Any change to preview render path risks breaking `?tree=` / `?id=` deep link behavior | Smoke-test URL-with-param load for every extraction PR |
| **Mobile preview scroll/selection** | Mobile preview open/close scroll behavior is coupled with hydration event binding (3.5) | Verify mobile scroll on every extraction PR; do not touch hydration until 3.5 is stable |
| **Data load dependency** | `updatePreview` depends on resolved public-tree-adapter response; helpers must not assume data is pre-resolved | Helpers receive resolved data as parameters — no direct adapter calls inside helpers |
| **Public tree adapter contract** | Share URL shape and tree data shape are defined by `js/api/public-tree-adapter.js`; helpers must not reshape this contract | Pass adapter output as-is; helpers format only |
| **No static-only PASS** | Browse/Search behavior cannot be verified with static fixture only — production-equivalent or fixed-slot live data required | See Section 5 verification matrix |
| **Listener leak** | Re-binding event listeners on each `updatePreview` without cleanup may accumulate listeners | Verify cleanup before hydration extraction; add leak test in contract PR |

---

## 6. Verification Matrix (Required Before Any Implementation PR)

All rows must pass on both desktop and mobile before any extraction PR is merged.

### Desktop (Chrome / Firefox / Safari — 1280px+)

- [ ] Search/Browse renders result list correctly
- [ ] Selecting a tree card opens preview panel with correct content
- [ ] Preview panel: thumbnail / cover image loads; fallback renders on missing image
- [ ] Preview panel: title, date, memory count, owner display correctly
- [ ] Preview panel: CTA/share buttons present and functional
- [ ] URL state: selecting a tree updates URL param correctly; back navigation restores state
- [ ] Deep link: opening `?tree=<id>` URL directly opens correct preview
- [ ] No fatal console errors or network 4xx/5xx blockers on Search page

### Mobile (Chrome / Safari — 375px – 430px)

- [ ] Search result list renders correctly at narrow viewport
- [ ] Tapping a tree card opens preview panel
- [ ] Preview panel opens/closes via scroll or tap-outside gesture
- [ ] Preview panel: thumbnail fallback renders on narrow viewport
- [ ] Preview panel: CTA/share buttons tap targets ≥ 44px; no clipping
- [ ] URL state unchanged after preview open/close on mobile
- [ ] No horizontal overflow on Search/Browse layout

---

## 7. Follow-Up PR Split Proposal

| PR | Branch candidate | Scope | Pre-condition |
|---|---|---|---|
| **PR 1** | `refactor/search-preview-media-helper` | Media fallback + thumbnail extraction | Section 5 smoke passing |
| **PR 2** | `refactor/search-preview-copy-helper` | Copy/locale formatting extraction | Section 5 smoke passing; PR 1 merged |
| **PR 3** | `refactor/search-preview-cta-helper` | CTA/share markup extraction | Contract tests covering CTA behavior; PR 2 merged |
| **PR 4** | Preview controller split | `updatePreview` orchestration + hydration refactor | Separate CTO approval required |

---

## 8. Guardrails

- **No JS changes in this document or its PR.** `js/search-preview-renderer.js`, `js/search*.js`, and `js/api/public-tree-adapter.js` are read-only.
- **No HTML changes.** `pages/search.html` script order is unchanged.
- **No CSS changes.**
- **No Search adapter/API/UI state changes.**
- **No selected tree deep link changes.**
- **No runtime behavior changes.**
- **Do not touch PR #319, #320, #321, #322.**
- **Do not touch PR #7 or prototype/reference/demo/variant files.**
- **Issue #223 remains open** — this document covers item 4 only.

---

## 9. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/engineering/SEARCH_PREVIEW_RENDERER_HELPER_AUDIT.md`
- [ ] No JS/CSS/HTML/runtime/API changes
- [ ] No `close`/`fixes`/`resolves` keywords for #223
