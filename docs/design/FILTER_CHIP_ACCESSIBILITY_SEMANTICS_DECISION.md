# Filter Chip Accessibility Semantics Decision

Source-only decision record for Issue #3786 (parent design-system program #3672). Determines the canonical interactive filter-chip semantic contract for the Browse and My Trees surfaces. No runtime, markup, CSS, JavaScript, test-harness, browser, or Production change is authorized by this document.

## 1. Status and exact source baseline

```text
Status:      DRAFT decision record — pending Web CTO review
Baseline:    origin/main 62da156eb4cff1873d96cdcb5e580c80e7db666f
Issue:       #3786 — Decide canonical filter-chip semantics (source-only)
Parent:      #3672 — Keep OPEN
Authorities: #3712 CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md (4.5 Filter Chip)
             #3753 FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md
             SECONDARY_ACTION_FOCUS_TREATMENT_DECISION.md
```

Evidence vocabulary used below (Issue #3786):

```text
SOURCE_CONFIRMED            directly read from current source
SEMANTICALLY_CORRECT        element/semantics match the intended interactive role
SEMANTICALLY_INCOMPLETE     element or state does not fully expose the interaction
VISUAL_ONLY_STATE           state carried only by a class/style, not by ARIA
AUTHORITY_VARIANT           legitimate surface difference, not a defect
COMPATIBILITY_IDENTIFIER    selector/id/attribute/key a later child must preserve
IMPLEMENTATION_REQUIRED_LATER  deferred to a future child (max 3)
UNRESOLVED_RUNTIME          browser-observable claim not provable from source
NOT_APPLICABLE              not relevant to the current selection model
```

## 2. Scope and evidence boundary

- Decision scope: the interactive semantic contract of filter chips on the Browse (public discovery) and My Trees (owner filtering) surfaces.
- Evidence boundary: `pages/search.html`, `pages/my-trees.html`, `css/global.css`, `css/search/search-controls.css`, `css/search/search-responsive/browse.css`, `css/my-trees/my-trees-finder.css`, `css/my-trees/my-trees-responsive.css`, `js/search/**`, `js/my-trees.js`, `js/my-trees/**`, `js/i18n/i18n-search.js`, `js/i18n/i18n-my-trees.js`, the three design authorities, and the source-static contracts that lock these selectors.
- Out of scope: implementation, browser/Playwright/screenshot/Preview/Production verification, and any non-`docs/` file change. Claims that only a browser could prove are labeled `UNRESOLVED_RUNTIME`.
- This decision is deliberately independent of #3784, #3785, #3688 and PR #3783; it shares only the standing prohibitions (no merge, no Ready, no Issue closure, `Refs #1882` only).

## 3. Current Browse markup and event ownership

Markup — `pages/search.html:40-45`:

```html
<div class="filter-row" aria-label="감상 보조 필터">
    <span class="tag-chip active" data-category="전체">전체</span>
    <span class="tag-chip" data-category="입덕">첫 순간</span>
    <span class="tag-chip" data-category="성장">이어진 마음</span>
    <span class="tag-chip" data-category="최애">깊어진 마음</span>
</div>
```

`SOURCE_CONFIRMED` facts:

1. The chips are plain `<span>` elements: no `tabindex`, no `role`, no `aria-pressed`/`aria-selected`, no keydown listener. `grep` for `role=|aria-pressed|aria-selected|tabindex` inside both filter rows returns nothing.
2. `data-category` carries the internal category value (`전체/입덕/성장/최애`); the visible text carries the user label (`전체/첫 순간/이어진 마음/깊어진 마음`). The two differ for three of four chips.
3. The container carries `aria-label="감상 보조 필터"` but no group role.
4. Event ownership (active orchestrator chain):
   - `js/search/index.js:30` collects `tagChips: document.querySelectorAll('.tag-chip')`; `state.currentCategory` defaults to `'전체'` (`index.js:72`).
   - `js/search/search-controls.js:29-44` (`bindCategoryChips`) attaches a `click` listener to every `.tag-chip`. On click it removes `.active` from all chips, adds `.active` to the clicked chip, and sets `state.currentCategory = chip.dataset.category || chip.textContent.trim()` (`search-controls.js:34-36`), then re-renders and writes URL state.
   - `js/search/search-url-state.js:2,40-44` persists the category as the `category` query parameter (`DEFAULT_CATEGORY = '전체'`; the parameter is deleted when the default is active) and restores it into `state.currentCategory` on load (`search-url-state.js:86-88`), toggling the `.active` class per chip (`search-url-state.js:109-114`).
   - A dormant duplicate orchestrator `js/search/search-index.js:24,320-324` binds the same span-click pattern but is not loaded by `pages/search.html` (only `js/search/index.js` is loaded, `search.html:195`).
5. Selection state is therefore communicated three ways: the `.active` CSS class (visual), `state.currentCategory` (internal state), and the `?category=` URL parameter (shared/deep-link state). No ARIA state exists.
6. The chips show `cursor: pointer` and `:hover` styling (`css/global.css:541-557`, `css/search/search-controls.css:52-64`) — a pointer affordance on elements that cannot receive keyboard focus.

Answers to the required decision questions (Browse):

| Question | Answer | Evidence label |
|---|---|---|
| Are `.tag-chip` elements focusable? | No — spans, no `tabindex`; the `.tag-chip:focus-visible` rules (`css/global.css:564,595`) are unreachable for spans. | `SOURCE_CONFIRMED` / `SEMANTICALLY_INCOMPLETE` |
| Keyboard Enter/Space operable? | No — only a `click` listener exists; no keydown handler. | `SOURCE_CONFIRMED` / `SEMANTICALLY_INCOMPLETE` |
| Where is the `data-category` consumer? | `js/search/search-controls.js:36`, `js/search/search-url-state.js:111`, dormant `js/search/search-index.js:324` (dual read `dataset.category || textContent`). | `SOURCE_CONFIRMED` |
| Is active state only a CSS class? | Active is `.active` class + `state.currentCategory` + `?category=` URL. Visually it is class-only; no ARIA state. | `SOURCE_CONFIRMED` / `VISUAL_ONLY_STATE` |
| Does ARIA state exist? | No `aria-*` state on the chips. | `SOURCE_CONFIRMED` |
| Is selection reflected in URL/internal state? | Yes — `?category=` (URL) and `state.currentCategory` (internal). | `SOURCE_CONFIRMED` |

Conclusion for Browse: the chips are interactive *by behavior* (mouse click changes the filter and URL) but are not interactive *controls* — they expose no focus, keyboard, or AT semantics. This is the divergence the inventory authority already records (`CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md:153,156,386,404,427,437`).

## 4. Current My Trees markup and event ownership

Markup — `pages/my-trees.html:41-46`:

```html
<div class="filter-row my-trees-filter-chips" id="myTreesFilterChips" aria-label="내 러브트리 필터">
  <button type="button" class="my-trees-filter-chip tag-chip active" data-filter="all">전체</button>
  <button type="button" class="my-trees-filter-chip tag-chip" data-filter="public">공개</button>
  <button type="button" class="my-trees-filter-chip tag-chip" data-filter="private">비공개</button>
  <button type="button" class="my-trees-filter-chip tag-chip" data-filter="has-moments">순간 있음</button>
</div>
```

`SOURCE_CONFIRMED` facts:

1. The chips are native `<button type="button">` elements — focusable, Enter/Space operable, and announced by AT as buttons without any extra ARIA. At the element level this is `SEMANTICALLY_CORRECT`.
2. `data-filter` carries the filter value (`all/public/private/has-moments`); text is the label. The set is locked by `browse-my-trees-pattern-alignment-contract.test.cjs:105-114` (exactly four chips; `data-filter="empty"` is forbidden in the top finder).
3. The container has `id="myTreesFilterChips"` and `aria-label="내 러브트리 필터"`; its `id` is locked by `browse-mytrees-hero-finder-structure-parity-contract.test.cjs:82`.
4. Event ownership:
   - `js/my-trees/my-trees-filter.js:97-111` (`bindFinderControls`) delegates a `click` listener on `#myTreesFilterChips`, resolves `e.target.closest('.my-trees-filter-chip')`, removes `.is-active` from every chip, adds `.is-active` to the clicked chip, reads `data-filter` (`my-trees-filter.js:109`), and calls `onFilterChange`.
   - `js/my-trees.js:611-618` wires `bindFinderControls` with `onFilterChange` updating a single `currentFilter` string (`js/my-trees.js:411`).
5. State divergence (`VISUAL_ONLY_STATE` / `SEMANTICALLY_INCOMPLETE`):
   - The JS toggles the class `is-active` (`my-trees-filter.js:105,107`), but no CSS rule styles `.tag-chip.is-active` or `.my-trees-filter-chip.is-active` anywhere in `css/` (`grep` shows `is-active` only for editor toolbar components, `.lovetree-card`, and `.lovetree-chip`). The structure-parity contract explicitly forbids a desktop `.my-trees-filter-chip.is-active` block (`browse-mytrees-hero-finder-structure-parity-contract.test.cjs:60`).
   - The visual active styling comes from `.tag-chip.active` (`css/global.css:558`, `css/search/search-controls.css:66`) — a class that only the initial HTML sets (on `전체`). The JS never updates `.active`.
   - Net source implication: after a click, the previously-active chip loses nothing the JS manages (JS removes `is-active`, which nothing styles), the clicked chip receives an unstyled class, and the initial `.active` on `전체` remains present. The active *state* is conveyed only through JS state (`currentFilter`) and an un-rendered class token. Whether the rendered visual highlight is broken in a real browser is `UNRESOLVED_RUNTIME`, but the source does not render the JS-managed state.
6. No URL state: `currentFilter` is internal-only; no `URLSearchParams`/`history` handling for the filter exists in `js/my-trees.js`.
7. No ARIA state (`aria-pressed`/`aria-selected`/`role`) exists on the chips.

Answers to the required decision questions (My Trees):

| Question | Answer | Evidence label |
|---|---|---|
| Native button semantics preserved? | Yes — all four chips are `<button type="button">`, locked by `browse-mytrees-hero-finder-structure-parity-contract.test.cjs:85`. | `SOURCE_CONFIRMED` / `SEMANTICALLY_CORRECT` |
| Is `aria-pressed` (or another state) needed? | Yes — the selected chip is not exposed to AT at all; the JS-managed class is unstyled. | `IMPLEMENTATION_REQUIRED_LATER` / `SEMANTICALLY_INCOMPLETE` |
| Mutually exclusive? | Yes — JS removes the state class from all chips then adds it to one (`my-trees-filter.js:103-107`); a single `currentFilter` holds the value (`my-trees.js:411,617-618`). | `SOURCE_CONFIRMED` |
| Multi-select? | No — exactly one chip is active at a time; the default `all` is always present. | `SOURCE_CONFIRMED` / `NOT_APPLICABLE` (checkbox semantics) |
| Simple action button? | No — the buttons carry a persistent selection state (filter), they do not trigger a one-off action. | `SOURCE_CONFIRMED` |

## 5. Semantic comparison matrix

| Dimension | Browse (`search.html:41-44`) | My Trees (`my-trees.html:42-45`) | Assessment |
|---|---|---|---|
| Element | `<span>` | `<button type="button">` | Divergence: My Trees correct, Browse not interactive. `SEMANTICALLY_INCOMPLETE` (Browse) |
| Focusable | No | Yes (native) | Divergence |
| Keyboard (Enter/Space) | No | Yes (native) | Divergence |
| Event model | `click` on `.tag-chip` (`search-controls.js:32`) | `click` delegation on `#myTreesFilterChips` (`my-trees-filter.js:99`) | Same activation surface, different ownership |
| Data attribute | `data-category` (taxonomy) | `data-filter` (visibility/moments) | `AUTHORITY_VARIANT` |
| Selection values | 전체/입덕/성장/최애 | all/public/private/has-moments | `AUTHORITY_VARIANT` |
| Active visual token | `.active` (styled, `global.css:558`) | initial `.active`; JS toggles unstyled `.is-active` | Divergence (`VISUAL_ONLY_STATE`) |
| Selection exposed to AT | None | None | Both `SEMANTICALLY_INCOMPLETE` |
| Selection in URL | `?category=` (`search-url-state.js:40-44`) | None | `AUTHORITY_VARIANT` |
| Container label | `aria-label="감상 보조 필터"` | `id + aria-label="내 러브트리 필터"` | `AUTHORITY_VARIANT` |
| Group role | None | None | Both incomplete (needs radio group) |
| Single-select (mutually exclusive) | Yes (one `.active`, one `currentCategory`) | Yes (one state class, one `currentFilter`) | Shared canonical model |
| Shared visual classes | `.tag-chip`, `.filter-row` | `.tag-chip`, `.filter-row`, `.my-trees-filter-chip` | Shared visual language — `COMPATIBILITY_IDENTIFIER`, not shared authority |
| Mobile behavior | Inline wrap + compact density (`search-responsive/browse.css:51-64`) | Horizontal scroll + compact density (`my-trees-responsive.css:46-63`) | `AUTHORITY_VARIANT` (see section 13) |

## 6. Selection-state model

Current state model (both surfaces, `SOURCE_CONFIRMED`):

```text
states:       active (exactly one) | inactive (the rest)
domain:       single-select, mutually exclusive, one default always present
              Browse: '전체' | My Trees: 'all'
runtime set:  state.currentCategory  (Browse, also ?category=)
              currentFilter          (My Trees, internal only)
visual token: .active                (both surfaces; My Trees JS mismatches with .is-active)
ARIA state:   none                   (both surfaces)
disabled:     not used for chips anywhere in current source
multi-select: not used (no multi-checkbox filter exists in either surface)
```

Canonical state model (future, `IMPLEMENTATION_REQUIRED_LATER`):

```text
element:       <button type="button"> (interactive chip base)
group:         container role="radiogroup" (one tab stop)
chip:          role="radio"  aria-checked="true|false"
active  :=     aria-checked="true"  == the one selected chip
inactive :=    aria-checked="false"
disabled (later, not now):  disabled attribute + aria-disabled="true", no state change
multi-select (only if a future surface requires it):  role="checkbox" + aria-checked
independent toggle (only if a future surface requires it):  aria-pressed
```

Rationale: because each surface guarantees exactly one active chip and never zero (the default is always present and re-selecting it is possible), the selection is a single-choice group, not a set of independent toggles. `aria-pressed` models an independent on/off toggle (zero or more pressed) and would misrepresent the "exactly one of N, one always chosen" invariant. `role="tab"`/`aria-selected` requires a `tablist`/`tabpanel` reveal relationship that filter chips do not have. Checkbox semantics model multi-select and are `NOT_APPLICABLE` today. The radio-group model is the accurate fit.

The visual token question is left for children: current source styles `.active` (`global.css:558`, `search-controls.css:66`), the JS manages `.is-active` (unstyled), and the repo's other pill component `.lovetree-pill` uses `.is-active` (`global.css:81`, `SECONDARY_ACTION_FOCUS_TREATMENT_DECISION.md:101,111`). A later child must converge on a single state token without breaking the structure-parity contract that currently forbids a `.my-trees-filter-chip.is-active` desktop block (`browse-mytrees-hero-finder-structure-parity-contract.test.cjs:60`).

## 7. Keyboard and focus obligations

Obligations that follow from the chosen radio-group semantics (`IMPLEMENTATION_REQUIRED_LATER`):

1. One tab stop per chip group (roving `tabindex`: `tabindex="0"` on the selected chip, `-1` on the rest), so the four-chip group is one navigation stop, not four.
2. Arrow keys (Left/Right, and Up/Down as an acceptable enhancement) move focus and selection together; the newly focused chip becomes `aria-checked="true"` and the previous becomes `false`.
3. Enter/Space activates the focused chip (native button behavior provides this; the radio pattern additionally requires Space to select the focused radio).
4. Home/End (optional enhancement) move to the first/last chip.
5. Focus must be visible: the existing `.tag-chip:focus-visible` ring (`css/global.css:564,595`, `--control-focus-ring`) must apply to the real focusable element. Today it is unreachable on Browse spans and already applies on My Trees buttons (element-level), but its adequacy after the element change is `UNRESOLVED_RUNTIME` (see section 12).
6. No focus may be forced into unresolved content; nothing in this decision forces focus.
7. Because the My Trees group scrolls horizontally on mobile (`my-trees-responsive.css:46-63`), the implementation must confirm the roving tab stop remains reachable inside the overflow container — `UNRESOLVED_RUNTIME`.

Current keyboard status: Browse `SEMANTICALLY_INCOMPLETE` (no focus/keyboard), My Trees element-level `SEMANTICALLY_CORRECT` (native button Enter/Space) but no arrow-key group navigation and no selected-state announcement.

## 8. ARIA alternatives considered

| Alternative | Fit for single-select filter chips | Verdict |
|---|---|---|
| `role="tab"` + `aria-selected` + `tablist` | Requires tab panels; filter chips do not reveal panels; tab semantics imply a tabstop/panel relationship. | Rejected — `NOT_APPLICABLE` |
| `aria-pressed` on plain buttons | Models an independent on/off toggle (0..N pressed). Both surfaces always have exactly one selected and never zero, so pressed/unpressed misrepresents the invariant. | Rejected for single-select groups; allowed only for a future true independent toggle |
| `role="checkbox"` + `aria-checked` | Models multi-select. Both surfaces are single-select. | Rejected — `NOT_APPLICABLE` today |
| `role="listbox"`/`option` | Focus-managed list semantics with typeahead; pill buttons are not list options and activation semantics differ. | Rejected |
| `role="radiogroup"` + `role="radio"` + `aria-checked` | Exactly models "one of N, exactly one chosen, a default always present". | **Canonical** |
| Native `<input type="radio">` + `<label class="tag-chip">` | Equivalent semantics with native arrow-key behavior; acceptable implementation technique for the same canonical model. | Accepted as an implementation option for children |

## 9. Canonical decision

Canonical interactive filter chip (single-select):

```text
container:  <div class="filter-row" role="radiogroup" aria-label="...">
chip:       <button type="button" class="tag-chip" role="radio" aria-checked="true|false">
state:      selected chip has aria-checked="true" and the visual active token
group:      one tab stop; arrow keys move selection; Enter/Space activate
```

Decisions, with source justification:

1. **Canonical element is `<button type="button">`** — the My Trees chips already are (`my-trees.html:42-45`); Browse spans must become real controls because they are interactive in behavior (click changes filter + URL, `search-controls.js:34-36`) but expose no semantics. Exception carved out: a surface with a genuinely non-interactive static label is not a chip in this sense and is not covered; a future multi-select surface uses checkbox semantics; a future independent toggle uses `aria-pressed`.
2. **Canonical state model is the radio-group model** (`role="radiogroup"` + `role="radio"` + `aria-checked`) because both surfaces are single-select, mutually exclusive, with an always-present default (`SOURCE_CONFIRMED`). `aria-pressed` and `role=tab` are rejected for this selection model (section 8).
3. **Selection is NOT a class-only state.** The `.active` class (and the JS-managed `.is-active`) are `VISUAL_ONLY_STATE` today; the canonical model binds the visual token to `aria-checked` and to the existing state variables (`state.currentCategory`, `currentFilter`), and — for Browse — keeps the `?category=` URL reflection that already exists (`search-url-state.js:40-44`).
4. **Browse and My Trees share the canonical interactive semantic model.** Their differences are legitimate `AUTHORITY_VARIANT` (data model, labels, URL persistence, container identity — section 10), not a reason to treat them as different components. Conversely, the shared `.tag-chip` visual classes are `COMPATIBILITY_IDENTIFIER`s that must remain shared visually without implying shared behavior — the current element divergence (span vs button) is the *accidental* part and must be converged.
5. **This decision is deliberately not** "convert every chip to a button unconditionally", "apply `role=tab` everywhere", "apply `aria-selected` to every active state", or "assert Browse and My Trees are the same feature". Each of those is rejected in sections 8-9 with source evidence.

`NOT_APPLICABLE` at this decision point: disabled state (not present in source), multi-select (not present), tab semantics (no panels), listbox semantics.

## 10. Authority variants

Legitimate differences that must be preserved (`AUTHORITY_VARIANT`):

1. **Data model**: Browse `data-category` carries a public-discovery taxonomy (`전체/입덕/성장/최애`, `search.html:41-44`); My Trees `data-filter` carries an owner filtering model (`all/public/private/has-moments`, `my-trees.html:42-45`). The consumers differ (`search-controls.js:36` / `my-trees-filter.js:109`), and the filter predicates differ (`treeMatchesFilter` in `my-trees-filter.js:42-74` vs `Adapter.filterTrees` in `js/search/search-data-adapter.js` via `index.js:268`).
2. **URL persistence**: Browse reflects selection in `?category=` (`search-url-state.js:40-44`) and restores it on load; My Trees intentionally keeps `currentFilter` internal-only (`my-trees.js:411,617-618`). This is a real product difference (public Browse URLs are shareable/deep-linkable; My Trees is a private owner view) and must be preserved.
3. **Container identity and labels**: Browse `.filter-row[aria-label="감상 보조 필터"]` vs My Trees `.filter-row.my-trees-filter-chips#myTreesFilterChips[aria-label="내 러브트리 필터"]`. The `id` and labels are `COMPATIBILITY_IDENTIFIER`.
4. **Responsive treatment**: Browse chips remain in the flex `filter-row` with compact density (`search-responsive/browse.css:51-64`); My Trees chips scroll horizontally on mobile (`my-trees-responsive.css:46-63`). Both are valid container treatments of the same chip component.
5. **Chip sets**: Browse 4 categories vs My Trees 4 filters — locked independently by `browse-my-trees-pattern-alignment-contract.test.cjs:105-114` (My Trees) and the `search.html` markup (Browse). Different sets are expected; the count coincidence (4/4) is not a semantic dependency.

## 11. Compatibility identifiers

Identifiers a later implementation must preserve or migrate deliberately (`COMPATIBILITY_IDENTIFIER`, `SOURCE_CONFIRMED`):

HTML classes and structure:
- `.tag-chip` (shared visual base — `css/global.css:541`, `css/search/search-controls.css:52`; locked by `search-responsive-css-contracts.test.cjs:142-143` and `browse-mytrees-chip-visual-alignment-contract.test.cjs:76-81`).
- `.tag-chip.active` (active visual token — `css/global.css:558`, `css/search/search-controls.css:66`; locked by `browse-mytrees-chip-visual-alignment-contract.test.cjs:84-91`).
- `.my-trees-filter-chip` (My Trees chip class — must stay on a `<button>`; `browse-mytrees-hero-finder-structure-parity-contract.test.cjs:85`).
- `.filter-row` (shared flex layout — `css/search/search-controls.css:72`, `browse-mytrees-hero-finder-structure-parity-contract.test.cjs:70`).
- `.my-trees-filter-chips` (My Trees group class + mobile scroll owner — `my-trees.html:41`, `my-trees-responsive.css:46-63`).
- `#myTreesFilterChips` (container id — `my-trees.html:41`, `my-trees-filter.js:97`, structure-parity test:82).
- `#myTreesSearchInput`, `#searchInput` (related search inputs, unchanged by this decision).

Data attributes:
- `data-category` (Browse — `search.html:41-44`; consumed by `search-controls.js:36`, `search-url-state.js:111`, dormant `search-index.js:324`).
- `data-filter` (My Trees — `my-trees.html:42-45`; consumed by `my-trees-filter.js:109`; the top-finder set `all/public/private/has-moments` is locked by `browse-my-trees-pattern-alignment-contract.test.cjs:110-113` and `data-filter="empty"` is forbidden there, while `my-trees-search-filter-create-card-contract.test.cjs:24-31` permissively allows `empty` in its value allowlist).

URL and state:
- `category` query parameter (Browse — `search-url-state.js:2,15,40-44,87-88`).
- `state.currentCategory` / `state.currentQuery` (Browse runtime state — `index.js:69-79`).
- `currentFilter` (My Trees runtime state — `my-trees.js:411`).
- `window.LoveBudSearchControls` (`bindCategoryChips`, `syncControlsFromState`), `window.LoveBudSearchUrlState`, `window.LoveBudMyTreesFilter` (`bindFinderControls`).

CSS selectors and tokens:
- `body .tag-chip`, `body .tag-chip:hover`, `body .tag-chip.active`, `body .tag-chip:focus-visible` (`css/global.css:541-601`).
- `.tag-chip`, `.tag-chip.active`, `.filter-row` in `css/search/search-controls.css` and `css/search/search-responsive/browse.css`.
- `.my-trees-filter-chip` density block (`my-trees-responsive.css:55-63`).
- Tokens: `--control-chip-bg`, `--control-chip-text`, `--control-chip-border`, `--control-chip-active-bg/text/border` (`browse-mytrees-chip-visual-alignment-contract.test.cjs:100-127`), `--control-focus-ring` (`css/global.css:470,564,595`), `--lovetree-chip-active-shadow` (`tokens.css`, `browse-mytrees-chip-visual-alignment-contract.test.cjs:51-57`).

i18n keys:
- Browse: `search.filter.all`, `search.filter.newbie`, `search.filter.growing`, `search.filter.fan` (`js/i18n/i18n-search.js:338-356`) — defined (ko/en) but currently **not bound** to the hardcoded chip labels. A child may bind them; the keys are `COMPATIBILITY_IDENTIFIER`.
- My Trees: no chip keys exist today; adding them is `IMPLEMENTATION_REQUIRED_LATER`.

Locking contracts (read-only now; a child must update them deliberately):
- `browse-mytrees-hero-finder-structure-parity-contract.test.cjs` (button semantics, ids, no `.my-trees-filter-chip.is-active` desktop block, shared classes).
- `browse-mytrees-chip-visual-alignment-contract.test.cjs` (`.tag-chip`/`.tag-chip.active` token families; doc-comment about `.my-trees-filter-chip.is-active` is stale relative to its assertions).
- `browse-my-trees-pattern-alignment-contract.test.cjs` (4 chips, exact `data-filter` set, no `data-filter="empty"` in the top finder, `type="text"` search input).
- `my-trees-search-filter-create-card-contract.test.cjs` (`myTreesFilterChips` id, `data-filter` values).
- `search-responsive-css-contracts.test.cjs` (`.tag-chip`, `.filter-row` preserved).

## 12. Forced-colors and reduced-motion obligations

Forced-colors (`FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md`, `SOURCE_CONFIRMED`):

1. `.tag-chip:focus-visible` uses `outline: 2px solid var(--control-focus-ring)` (`css/global.css:564,595`) with no authored forced-colors override → audit `PARTIAL_COVERAGE`; `outline` renders in WHCM with UA system-color adjustment. Adequacy after the element change is `UNRESOLVED_RUNTIME`.
2. `.tag-chip.active` is a background/border/color-only selected state (`.tag-chip.active` in `css/global.css:558` and `css/search/search-controls.css:66`) → audit `MISSING_COVERAGE`; the selected state may collapse in WHCM. A later child must add a non-color state distinction (e.g., border/outline + system-color-safe indicator) in addition to the `aria-checked` state (which is always exposed to AT regardless of color).
3. Browse chips being non-focusable is itself flagged as `UNRESOLVED` in the audit (`FORCED_COLORS_FOCUS_COVERAGE_AUDIT.md:56`); converting them to focusable radio controls is the prerequisite for the focus obligation.

Reduced-motion:
- Chip transitions are color/opacity only: `transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease` (`css/global.css:548-550`) and `transition: all 0.2s` (`css/search/search-controls.css:60`). No animation that needs a `prefers-reduced-motion` override is introduced by the canonical model. `NOT_APPLICABLE` beyond the existing transition audit; a child should confirm no new motion is added.

## 13. Localization and responsive obligations

Localization (`SOURCE_CONFIRMED` / `IMPLEMENTATION_REQUIRED_LATER`):
- Browse chip labels are hardcoded Korean in `search.html:41-44`; the `search.filter.*` keys exist (`i18n-search.js:338-356`) but are unbound. A Browse child should bind them without changing the visible copy.
- My Trees chip labels are hardcoded Korean in `my-trees.html:42-45` with no i18n keys. A My Trees child should add keys (e.g., under `myTrees.*`) and keep the `data-filter` values language-neutral.
- The `aria-label` values (`감상 보조 필터`, `내 러브트리 필터`) are currently literal; a child may move them into i18n, preserving the labels.

Responsive (`SOURCE_CONFIRMED`):
- Browse: chips are inline in `.filter-row` with compact density at ≤768px (`search-responsive/browse.css:51-64`, `css/global.css:601-606`).
- My Trees: chips are in a horizontally scrolling `.my-trees-filter-chips` row on mobile with hidden scrollbar (`my-trees-responsive.css:46-63`).
- A child must keep the roving radio tab stop reachable when the group scrolls horizontally (`UNRESOLVED_RUNTIME` until browser-verified).

## 14. Risks and unresolved runtime questions

`UNRESOLVED_RUNTIME` (cannot be settled from source; a future child must verify in a browser):

1. Whether the My Trees `.is-active` vs `.active` mismatch renders a visibly broken active chip after clicks (source shows the JS-managed class is unstyled while the initial `.active` on `전체` persists; the rendered outcome is browser-observable).
2. Whether AT announces anything useful for Browse spans today (spans are non-focusable and carry no state).
3. Focus-ring adequacy for converted chips in WHCM and normal mode (audit `PARTIAL_COVERAGE`/`MISSING_COVERAGE`).
4. Roving-tab-stop behavior inside the horizontally scrolling My Trees group.
5. `?category=` restoration for a category value that is not among the four chips (e.g., a manually crafted URL) — `search-url-state.js:87-88` accepts any string; rendered behavior for out-of-set categories is browser-observable.
6. Actual `aria-checked` announcement behavior of `role="radio"` on a `<button>` in the used screen readers.

Risks:
- Converging the active-state token touches selectors locked by `browse-mytrees-hero-finder-structure-parity-contract.test.cjs:60` (forbids `.my-trees-filter-chip.is-active` desktop block) and `browse-mytrees-chip-visual-alignment-contract.test.cjs` (locks `.tag-chip.active`). Children must update these contracts deliberately.
- Two Browse orchestrators exist (`js/search/index.js` active; `js/search/search-index.js` dormant). A Browse child must update both or delete the dormant one, and re-verify `search.html` script loading.
- The chip count (4/4) is coincidental; children must not couple the two chip sets.
- Misapplying `aria-pressed` (rejected for single-select) is the most likely regression if a child does not follow the radio-group model.

## 15. Future implementation children — maximum 3

Child 1 — **Browse filter-chip interactive semantics** (U3 runtime-sensitive UI):
- Page: `pages/search.html` (Browse only).
- Candidate files: `pages/search.html`, `js/search/search-controls.js`, `js/search/index.js`, `js/search/search-url-state.js`, optionally `js/search/search-index.js` (dormant orchestrator — update or remove), `css/global.css` or `css/search/search-controls.css` (focus/active adjustments), `js/i18n/i18n-search.js` (bind `search.filter.*`).
- Semantics change: convert the four `.tag-chip` spans to real interactive controls with radio-group semantics (`role="radiogroup"` + `role="radio"` + `aria-checked`), roving tabindex + arrow keys + Enter/Space, sync `aria-checked` with `state.currentCategory`, `.active`, and `?category=`; bind i18n labels.
- Accessibility requirements: one tab stop, arrow-key selection, `aria-checked` sync, focus-visible ring, non-color active indicator for WHCM, container `aria-label` retained.
- Tests: source-static contracts (element/ARIA/structure in `search.html`, updated `browse-mytrees-hero-finder-structure-parity` if it asserts Browse) + a focused U2 keyboard/browser contract (arrow keys, Space, focus ring, WHCM).
- Browser verification: **YES** (keyboard and AT-adjacent structure; `UNRESOLVED_RUNTIME` items 2, 3, 5, 6).
- Non-overlap: touches no My Trees markup/JS/CSS; only the shared `.tag-chip` visual token if adjusted.

Child 2 — **My Trees filter-chip state + ARIA** (U3 runtime-sensitive UI):
- Page: `pages/my-trees.html` (My Trees only).
- Candidate files: `pages/my-trees.html`, `js/my-trees/my-trees-filter.js`, `js/my-trees.js` (finder wiring), `css/my-trees/my-trees-responsive.css` (density), `css/global.css` or `css/search/search-controls.css` (single active token), `js/i18n/i18n-my-trees.js` (new chip keys).
- Semantics change: reconcile `.is-active`/`.active` into one rendered state token, add `role="radiogroup"` to `#myTreesFilterChips` + `role="radio"` + `aria-checked` to the buttons, roving tabindex + arrow keys, keep native `<button>` base and the locked `data-filter` set, keep internal-only `currentFilter` (no URL change — preserve the authority variant), bind i18n labels.
- Accessibility requirements: same as Child 1, plus the state-token convergence and the mobile scroll reachability check.
- Tests: source-static contracts (state token, `data-filter` set, button semantics; update `browse-my-trees-pattern-alignment`/`browse-mytrees-hero-finder-structure-parity` as needed) + a focused U2 keyboard contract.
- Browser verification: **YES** (`UNRESOLVED_RUNTIME` items 1, 3, 4, 6).
- Non-overlap: no Browse markup/JS change; shares only the canonical radio decision and the shared `.tag-chip` token, coordinated with Child 1/3.

Child 3 — **Canonical chip contract codification** (U0/U1 document + source-static contract, no runtime change):
- Candidate files: `docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md` (update §4.5 to mark the span/button divergence resolved and record the canonical radio-group model), a new source-static contract (e.g., `tests/contracts/filter-chip-canonical-semantics-contract.test.cjs`) locking the canonical shape (single-select radio, active token, i18n-bound labels, 4-chip sets, no `aria-pressed` misuse), and contract updates for `browse-mytrees-hero-finder-structure-parity` / `browse-mytrees-chip-visual-alignment` if their selectors changed.
- Semantics change: none at runtime — codifies the outcome of Children 1-2.
- Accessibility requirements: none beyond the documented contract.
- Tests: source-static only.
- Browser verification: **NO**.
- Non-overlap: depends on Children 1-2 landing first; no markup/JS/CSS runtime change.

Children 1 and 2 are independent in surface and files; Child 3 is the codifying follow-up. All three are bounded and separately reviewable; none is implemented by this decision.

## 16. Explicit non-actions

This decision does not authorize, and no worker may perform under this document:

```text
no pages/** change
no css/** change
no js/** change
no test or registry change
no package/lockfile/workflow change
no browser or Playwright
no screenshot
no Preview or Production
no real login or user data
no API/DB/provider mutation
no modification of PR #3783, #3784, #3785, #3780, or their worktrees
no Ready transition
no merge
no Issue closure by the worker
no rebase/reset/amend/force push
no Closes/Fixes/Resolves on #3672 or #1882 (Refs only)
```

## 17. Rollback

- This record is additive (one new `docs/` file). Rollback is `git revert`/branch deletion of the single-file Draft PR; no runtime state is affected.
- Children 1-2, once implemented, are rollback-safe per PR because the locked contracts (`browse-mytrees-hero-finder-structure-parity`, `browse-mytrees-chip-visual-alignment`, `browse-my-trees-pattern-alignment`, `my-trees-search-filter-create-card`, `search-responsive-css-contracts`) must be updated in the same PR, making the semantic change and its contract guard atomic.

Refs #3786.
Refs #3672 — Keep OPEN.
Refs #3712 — completed authority.
Refs #3753 — completed authority.
Refs #1882 — Keep OPEN.
