# My Trees Story Preference Boundary

**Issue:** #3754  
**Status:** Current main contract  
**Last updated:** 2026-07-30  
**Source base:** 9af1f6116566e9b616a89f108bc17e002bcf8485  

---

## 1. Scope

This document defines the product boundary for story view-mode preference on the My Trees page (`pages/my-trees.html`). It classifies the five candidate storage/authority models, specifies which are authorized in the current phase, and identifies future contracts.

### In scope

- My Trees large/compact/list view-mode preference decision
- Relationship between My Trees preference and Browse preference
- Storage authority, fallback, and persistence boundary
- a11y announcement ownership for mode changes

### Out of scope

- Browse story view implementation (covered by #3655)
- Browse tree card layout or density (covered by #3608)
- Editor tree layout mode (covered by #3581/#3582)
- Backend/API/DB schema or migration
- Cross-device account preference sync (deferred)
- Story view mode on My Trees — implementation deferred to a future child issue (see §7)

---

## 2. Current source state (independent verification)

Verified against `9af1f6116566` without assuming any unmerged document.

### 2.1 Shared view-mode architecture

Both Browse and My Trees use the same `LoveBudTreeViewModeSwitcher` (`js/tree-view-mode-switcher.js`).

| Property | Browse | My Trees |
|---|---|---|
| Storage key | `lovebud:browse:viewMode` | `lovebud:myTrees:viewMode` |
| Allowed modes | `large`, `compact`, `list`, `story` | `large`, `compact`, `list` |
| Default mode | `compact` | `compact` |
| URL sync | None for view mode | None for view mode |
| Init file | `js/search/search-page-shell-init.js` | `js/my-trees/my-trees-page-bootstrap.js` |
| Story controller | `LoveBudBrowseStoryView` (init + setMode) | Not implemented |

### 2.2 Storage layer

- `localStorage` is the sole persistence mechanism for both surfaces.
- `sessionStorage` is not used for any view-mode or layout preference.
- URL parameters (`q`, `category`, `sort`, `limit`, `tree`) are Browse-only and do not include view mode.
- No authenticated account / server / API preference storage exists for view mode.
- No cookie-based preference storage exists for view mode.
- No SharedWorker, BroadcastChannel, or cross-tab sync exists.

### 2.3 Fail-safe behavior

The switcher `getMode()` returns `defaultMode` (`compact`) when:

- `localStorage` is unavailable (private browsing, quota error)
- The stored value is `null`, `undefined`, or empty
- The stored value is a valid mode string outside the surface's allowed set (e.g. `story` on My Trees)
- The stored value is an invalid / unknown string

The stored value is **never deleted or rewritten** — only ignored on read.

### 2.4 Auth and ownership

My Trees is exclusively the authenticated owner's own tree management surface. There is no non-owner, public, or guest perspective. The page opens behind an auth gate (`body.my-trees-auth-pending`) and redirects to login when no valid session is found.

### 2.5 Desktop / mobile behavior

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Layout | Two-column: main + preview hub sidebar | Single column, hub as bottom sheet overlay |
| Mode control | `#myTreesViewModeMount` in results-head | Same mount, compact flex balancing |
| Card click | Opens hub sidebar | Direct navigation to editor (<480px) or bottom sheet |
| Mode applies | `data-tree-view-mode` on `#trees-grid` | Same attribute, responsive grid CSS |

### 2.6 Preview hub coexistence

The preview hub (`#myTreesHubPanel`) is a right sidebar that opens on card selection. Its behavior is **independent of the current view mode** — it does not change layout, density, or presentation based on large/compact/list. The hub is purely a content preview panel for the selected tree.

### 2.7 i18n and a11y

- Mode labels are hardcoded in Korean: `큰 카드`, `작은 카드`, `목록`, `스토리`.
- The radio group has `aria-label="보기 방식"` (Korean).
- `aria-checked` is correctly toggled on mode change.
- There is **no `aria-live` announcement** when the view mode changes on either Browse or My Trees.
- The Browse story controller has a `role="status"` live region for story position, but no mode-change announcement.
- No i18n framework integration exists for the switcher labels; they are hardcoded strings.

### 2.8 Browse vs My Trees separation

```
lovebud:browse:viewMode  →  Browse (search)
lovebud:myTrees:viewMode →  My Trees
```

These are completely independent keys. A mode change on one surface never affects the other. This is correct by design — the two surfaces have different allowed mode sets and different user contexts (search discovery vs personal management).

---

## 3. Candidate model comparison

### A. Session-only preference

| Property | Assessment |
|---|---|
| Mechanism | `sessionStorage` key `lovebud:myTrees:viewMode` |
| Lifetime | Tab/session scope — lost on tab close |
| Auth required | No |
| Cross-surface | No (sessionStorage is origin-scoped, not key-sharing) |
| Fail-safe | Missing key → `compact` default |
| Pros | Simplest model; no persistence cleanup; always fresh start |
| Cons | UX friction: preference lost on every tab close; unexpected reset on BFCache restore |

**Classification: NOT_AUTHORIZED for primary preference**  
Session-only does not meet the user expectation that a selected view mode persists across page navigations within a single visit or across visits. The BFCache and history restoration paths would compound the reset behavior.

### B. My Trees page-scoped browser preference (CURRENT)

| Property | Assessment |
|---|---|
| Mechanism | `localStorage` key `lovebud:myTrees:viewMode` |
| Lifetime | Persistent across tabs, page reloads, and browser restarts |
| Auth required | No |
| Cross-surface | No — separate key from Browse |
| Fail-safe | Missing/invalid → `compact` default; storage failure → `compact` |
| Pros | Current implementation; works offline; no auth dependency; independent from Browse |
| Cons | Browser-specific (not synced); no cross-device portability |

**Classification: SOURCE_CONFIRMED — current implementation**  
This is the running authority. The current implementation satisfies all hard principles: no default change, no DB/API/auth write, no cross-surface key reuse, invalid values fall back safely.

### C. Shared Browse/My Trees preference

| Property | Assessment |
|---|---|
| Mechanism | Single `localStorage` key (e.g. `lovebud:viewMode`) used by both surfaces |
| Lifetime | Persistent |
| Auth required | No |
| Cross-surface | Yes — one key shared |
| Pros | Consistent mode across discovery and management |
| Cons | Browse supports `story` mode; My Trees does not. A user who selects `story` on Browse then navigates to My Trees would see a silent fallback to `compact`. Changing My Trees allowed modes to accept `story` without implementing the actual story view would be misleading. |

**Classification: NOT_AUTHORIZED**  
The surface capability mismatch (My Trees lacks `story`) makes a shared key unsafe. The current separated-key design correctly avoids this problem.

### D. Authenticated account preference

| Property | Assessment |
|---|---|
| Mechanism | Server/API/Database write on mode change; read on page load |
| Lifetime | Permanent; survives browser, device, and session boundaries |
| Auth required | Yes — server round-trip |
| Cross-surface | Possible (single user preference) |
| Pros | Cross-device sync; survives cache clear; could unify Browse and My Trees |
| Cons | Requires API endpoint, DB write, auth token, loading state, latency handling, conflict resolution, privacy review (preference data as stored signal) |

**Classification: ACCOUNT_PREFERENCE_DEFERRED**  
This is the correct long-term goal for cross-device consistency, but it requires:

- API endpoint design and implementation
- DB schema for user preference storage
- Auth token dependency at page load
- Graceful degradation when API is unavailable (fallback to localStorage)
- Privacy classification of preference data
- Migration path for existing localStorage preferences

These are non-trivial dependencies that block current implementation.

### E. URL / query-state preference

| Property | Assessment |
|---|---|
| Mechanism | URL parameter (e.g. `?mode=compact`) |
| Lifetime | Per-navigation (lost on pushState replace) |
| Auth required | No |
| Cross-surface | Possible via link sharing |
| Pros | Shareable; bookmarkable; survives hard navigation |
| Cons | Lost on internal link/button clicks that don't propagate the param; conflicts with localStorage (two sources of truth); URL bloat; SEO/crawler considerations |

**Classification: NOT_AUTHORIZED as primary, PROPOSED_FUTURE_CONTRACT as secondary**  
URL state cannot serve as the primary preference authority because navigation patterns on My Trees (filter, sort, pagination) would drop the parameter. As a secondary signal (e.g. temporary override via shared link), this is a future consideration.

---

## 4. Required principles satisfaction

| Principle | Current implementation | Assessment |
|---|---|---|
| Current default unchanged | `compact` is the canonical default | SOURCE_CONFIRMED |
| localStorage ≠ account sync | No server write on mode change | SOURCE_CONFIRMED |
| Browse key not reused for My Trees | Separate `lovebud:browse:viewMode` / `lovebud:myTrees:viewMode` | SOURCE_CONFIRMED |
| Invalid value → canonical default | `getMode()` returns `compact` for invalid/unset | SOURCE_CONFIRMED |
| Public ≠ authenticated owner | My Trees is always owner-only; no public perspective exists | SOURCE_CONFIRMED |
| No DB/API/auth write | No server call on mode change | SOURCE_CONFIRMED |

---

## 5. Disposition

### SESSION_ONLY_RECOMMENDED

No. The current localStorage model already handles the session boundary correctly (BFCache, history restore, page reload). Session-only would regress UX without architectural benefit.

### PAGE_SCOPED_BROWSER_PREFERENCE_RECOMMENDED

**Yes — this is the current implementation and the recommended model for the current phase.** The `lovebud:myTrees:viewMode` localStorage key satisfies all hard principles, works offline, requires no auth or server dependency, and keeps My Trees independent from Browse.

### ACCOUNT_PREFERENCE_DEFERRED

**Yes — deferred.** Cross-device account-preference sync is the correct long-term model but is blocked by missing API, schema, auth-bound loading, fallback design, and privacy review. When unblocked, the following migration constraints apply:

1. Server preference is the source of truth on first paint when available.
2. localStorage preference is the fallback when API is unavailable.
3. On successful server write, the localStorage key is also updated to stay in sync.
4. Existing `lovebud:myTrees:viewMode` localStorage values are migrated on first server write — never silently uploaded to the server without user action.
5. An explicit account preference must not change the canonical page default (`compact`) for unauthenticated or fallback paths.

### IMPLEMENTATION_BLOCKED

**Yes — blocked.** Story view mode on My Trees (issue #3722 scope) is blocked by:

1. The `MY_TREES_STORY_PARITY_READINESS_DECISION.md` document does not exist — the story mode design for My Trees has not been authored.
2. My Trees currently does not pass `modes: ['large', 'compact', 'list', 'story']` to the switcher, so `story` is not an allowed mode.
3. There is no `LoveBudMyTreesStoryView` controller analogous to `LoveBudBrowseStoryView`.
4. The My Trees card layout and preview hub interaction model would need to be evaluated for story-mode compatibility (grouping, navigation, hub synchronization).

---

## 6. a11y announcement ownership

The current switcher has no `aria-live` announcement on mode change. The `aria-checked` state and `.is-active` class provide visual and basic ARIA feedback, but a screen reader user receives no explicit notification such as "보기 방식이 작은 카드로 변경되었습니다."

**PROPOSED_FUTURE_CONTRACT:** A future child issue should add an `aria-live="polite"` announcement region to the switcher, owned by the switcher module itself (not by each surface). The announcement text should use the same i18n source as `LABELS` or an i18n key like `treeViewMode.announcement` with template `"{mode}(으)로 변경했습니다."`.

---

## 7. Future child recommendations

### Child 1: My Trees story view design

| Field | Value |
|---|---|
| Issue scope | Design and contract for story view mode on My Trees |
| Required files | `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md` (to be created) |
| Fallback behavior | Stored `story` value on My Trees before implementation → silently falls back to `compact` (already handled by the switcher) |
| Migration | After implementation, existing localStorage values are valid; no migration needed |
| Stop condition | `story` is listed in My Trees allowed modes, `LoveBudMyTreesStoryView` is implemented, and story-mode group navigation works with the preview hub sidebar |

### Child 2: a11y announcement for view-mode changes

| Field | Value |
|---|---|
| Issue scope | Add `aria-live="polite"` announcement to `LoveBudTreeViewModeSwitcher` |
| Required files | `js/tree-view-mode-switcher.js` (switcher module owns the region) |
| Fallback behavior | No region → no announcement (current behavior) |
| Stop condition | Screen reader announces mode change on all surfaces (Browse and My Trees) |

### Child 3: Account-preference primitive

| Field | Value |
|---|---|
| Issue scope | API endpoint, DB schema, auth-bound load, localStorage fallback, and privacy classification for user preference sync |
| Required files | API route, DB migration, preference module in `js/shared/` |
| Fallback behavior | API unavailable → read localStorage; server conflict → server wins with localStorage override on next write |
| Stop condition | Preference is read from server on page load, written to server on mode change, and falls back to localStorage when offline |

---

## 8. Boundary summary

```
My Trees view mode (large/compact/list)
  │
  ├── localStorage (lovebud:myTrees:viewMode)  ← CURRENT AUTHORITY
  │     └── invalid/unset → compact
  │
  ├── Account preference (server)               ← DEFERRED
  │     └── API unavailable → localStorage fallback
  │
  ├── Browse preference (lovebud:browse:viewMode) ← NOT_AUTHORIZED (separate)
  │
  ├── URL state                                  ← NOT_AUTHORIZED (primary)
  │
  └── Story mode (My Trees)                      ← BLOCKED (#3722 design)
```

Refs #3754
Refs #3654 — Keep OPEN
Refs #3717 — parallel
Refs #3703 — completed
Refs #3699 — Keep OPEN
Refs #3688 — Keep OPEN
Refs #1882 — Keep OPEN
