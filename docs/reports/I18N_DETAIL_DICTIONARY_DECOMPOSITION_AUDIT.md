# I18N Detail Dictionary Decomposition Readiness Audit

## Audit Scope

- **Issue**: #3109
- **Parent**: #3086 (oversized production modules umbrella), #2976 (dynamic UI-copy centralization — separated)
- **Parent product issue**: #1882 (open, must not be closed)
- **Protected**: #2960 (detail panel UX), #2856 (growth affordance render), #3070 (existing-moment save UX — paused), #3072 (mobile UX redesign — separated)
- **Explicit exclusions**: #2976 dynamic UI-copy centralization; runtime copy/translation edits; HTML/CSS/JS/test/config/deployment changes; any change to `js/i18n/i18n-detail.js` or `js/i18n/i18n-index.js` content; translation key/copy/casing changes
- **Audit-only**: documentation-only PR; no source, configuration, deployment, or runtime changes
- **Scope of this issue vs. #2976**: #2976 concerns centralizing new dynamic literals and untranslated copy across the UI. This audit (#3109) concerns the existing static translation dictionary structure (key families, IIFE wrapper, dictionary merger boundary, consumer lookup pattern) and whether a behavior-preserving first split is identifiable without changing translations or lookup semantics. The two scopes do not overlap.

## 1. Base SHA

- **Current main**: `04691d80e47d13f8a687ff1e574ddcbac8e75972`
- **No unrelated open PRs**: only #2960 and #2856 (both protected) are open
- **No pending changes** relevant to `js/i18n/i18n-detail.js` or its consumers

## 2. Global API / Assignment Boundary

### 2.1 IIFE wrapper and single global assignment

`js/i18n/i18n-detail.js` is wrapped in an IIFE (`(function() { 'use strict'; ... })();`, lines 1 and 542). The only assignment to `window` is a single line:

```
window.i18nDetail = { ... };
```

at line 4. The dictionary object is created directly with object-literal syntax; no factory function, no module/closure returns, no incremental mutation within the IIFE.

### 2.2 Module surface

- Single export name: `window.i18nDetail` (line 4).
- Single consumer boundary: `js/i18n/i18n-index.js` line 19 reads `window.i18nDetail` as one entry inside the `dictModules` array.
- No other code path writes to or mutates `window.i18nDetail` after the IIFE completes (confirmed via direct text search over `js/`, `pages/`, and `tests/` for the token `i18nDetail`).

### 2.3 Preserved-for-future-split condition

For the detail merger path (see §4.3), the following must be preserved in any future split:

- The `window.i18nDetail` global name and reachability on `window` must remain (the global API identity).
- The effective key/value set visible to `window.t(key)` at the directly inspected detail call sites must not change for any verified entry.
- The duplicate-key survivor for `video_embed_fallback_cta` (line-349 English value wins per §3.7) must not change.
- The load/merge timing: `window.i18nDetail` must be assigned before `js/i18n/i18n-index.js` executes on routes that use the merger path.
- For index-free routes (§4.2), the effective dictionary-injection path is not yet established; any future split must verify equivalence there separately (see §6.2(4)).

The specific construction mechanism (single object-literal vs. other composition) is not prescribed by this audit, provided the above observable properties are preserved and demonstrated via a verified equivalence contract in a separate runtime PR.

## 3. Dictionary Key-Family Map (verified on current main)

Total keys observed: **133 distinct key entries** within the `window.i18nDetail = { ... }` object literal, spanning lines 5 to 540 of `js/i18n/i18n-detail.js`. One key (`video_embed_fallback_cta`) appears **twice** as a duplicate-key boundary (see §3.7). Total literal-occurrences: 134.

The following families are identifiable by name prefix/cluster. Family boundaries are stated only for keys actually present in the current source; no fabricated clusters are recorded. Translation copy is intentionally not reproduced — only key names and brief topical grouping, per the audit-only constraint.

### 3.1 Tree / load / error family

Lines 5–69 of `js/i18n/i18n-detail.js` (per source-position grep, see §7 References for raw output). Contains `memory_not_found_*`, `tree_*` and `_tree*` keys covering memory-not-found, tree-load failure titles, tree-not-found, API unavailable, tree-load descriptions, current-tree label, tree-info-missing, partial-context, and path-missing. This is the largest contiguous cluster dedicated to viewer-side load/error copy.

### 3.2 Tree context (in-viewer state copy) family

Lines 89–139 of `js/i18n/i18n-detail.js`. Contains `tree_context_*` keys covering in-viewer state copy such as moment/viewing/loading kickers, solo-view short and warm copy, moment-count descriptions, editor vs. my-trees-context, and missing-title partial/full-fail descriptions.

### 3.3 Navigation / surface labels family

Lines 141–185 and the corresponding interval around lines 505–540 (per source-position grep) of `js/i18n/i18n-detail.js`. Contains `edit_action`, `editor_label`, `go_to_my_trees`, `find_tree_in_browse`, `browse_label`, `browse_lovetrees`, `my_trees_label`, `my_trees_short`, `lovetree_brand`, `unknown_artist`, `back_to_*_soft` (browse/my-trees/editor). Plus in this same region `public_tree_growth_label`, `my_tree_growth_label`, `editor_tree_growth_label`, `single_moment_growth_label`, `moment_centered_growth_label`, `detail_loading_growth_label`.

### 3.4 Empty / connected / unavailable-media family

Lines 189–349 of `js/i18n/i18n-detail.js`. Contains `empty_tree_*`, `empty_panel_hint`, `root_moment_hint`, `path_moment_hint`, `edit_memory`, `delete_memory`, `delete_confirm`, `memory_updated`, `memory_deleted`, `update_failed`, `delete_failed`, `record_error`, `empty_memo_*`, `connected_*` (loading, temporarily unavailable, path missing, missing cards, partial tree, relation previous/next/same-tree), `video_unavailable_soft_*`.

### 3.5 Public-tree / single-moment / detail-loading viewer surfaces family

Lines 353–429 of `js/i18n/i18n-detail.js`. Contains `public_tree_view_chip`, `single_moment_view_chip`, `moment_centered_view_chip`, `detail_loading_view_chip`, public-tree/single-moment/moment-centered/detail-loading kickers and fallback titles, public-tree desc join/suffix/fallback-with-memory-suffix, hero desc variants, public-tree-context desc, current-moment-kicker and side-summary.

### 3.6 Connected-flow / branching-content family

Lines 433–501 of `js/i18n/i18n-detail.js`. Contains `connected_flow_kicker`/`title`/`summary`/`count_suffix`/`count_pending_suffix`/`empty_summary`/`single_summary`/`temporarily_unavailable_summary`/`partial_tree_summary`, plus `connected_loading_kicker`/`heading`/`summary` and `single_moment_connected_kicker`/`title`/`summary`.

### 3.7 Duplicate-key boundary within the dictionary

`video_embed_fallback_cta` appears **twice** within `js/i18n/i18n-detail.js`:

- First occurrence at line 185: `'Continue viewing on YouTube'` (en) / `'원본에서 감상 이어가기'` (ko).
- Second occurrence at line 349: `'Continue with the original video'` (en) / `'원본에서 감상 이어가기'` (ko).

The two English payloads differ while the Korean payload is identical in both. Because the dictionary object literal is constructed via object-literal syntax in source order, **the second occurrence (line 349) overwrites the first** at object-build time. The `i18n-index.js` merger then copies the surviving (line-349) value into `mergedDictionary`, which is what `i18n(key)` ultimately returns. This means any consumer of `video_embed_fallback_cta` that consults the dictionary sees the line-349 English copy, while consumers that pass a hardcoded fallback see the Korean literal regardless.

This audit directly verified that `js/detail/detail-video.js` references this key at lines 47 and 66, both with the Korean fallback string `'원본에서 감상 이어가기'`. No claim is made about whether other consumers exist beyond what was directly inspected; the audit scope is limited to verified references.

This is a real, observable duplicate-key boundary. Recording it here is consistent with the audit scope (the issue explicitly enumerates "duplicate-key, key-name, and mutation/override risk boundaries where actually present") and is information-only — no behavior change is implied.

### 3.8 Keys without an obvious family

`memory_record_prefix` (line 141), `moment_detail` (line 85), `selected_moment` (line 81), `waiting_first_moment` (line 73), `start_moment` (line 77), `no_siblings_in_path` (line 193), `current_moment_kicker` (line 433), `current_moment_side_summary` (line 437), `current_moment_side_summary_fallback` (line 441). Each is left in its source line position and not pre-grouped.

## 4. Consumer / Load-Order Map

### 4.1 Pages that include `js/i18n/i18n-detail.js` (verified via direct HTML search)

The following pages contain a `<script src=".../js/i18n/i18n-detail.js?...">` tag in current main:

- `pages/editor.html` (line 251)
- `pages/view.html` (line 98)
- `pages/search.html` (line 189)
- `pages/public-canvas.html` (line 117)
- `pages/my-trees.html` (line 165)
- `pages/login.html` (line 120)
- `pages/intro.html` (line 281)
- `pages/detail.html` (line 136)
- `index.html` (line 173)

This shows that `i18n-detail.js` is loaded broadly and is not detail-page-only at the script-tag level. The script tag exists across most pages, but whether each page actually consumes keys from the dictionary depends on the page-specific script.

### 4.2 Detail and viewer pages: i18n-* script order

`pages/detail.html` script order around i18n modules (lines 131–140):

```
i18n-core.js → i18n-shared.js → i18n-login.js → i18n-intro.js →
i18n-search.js → i18n-detail.js → i18n-editor.js → i18n-my-trees.js →
i18n-index.js → i18n.js
```

`pages/view.html` (lines 94–99):

```
i18n-core.js → i18n-shared.js → i18n-editor.js → i18n-search.js →
i18n-detail.js → i18n.js
```

`pages/public-canvas.html` (lines 113–118):

```
i18n-core.js → i18n-shared.js → i18n-editor.js → i18n-search.js →
i18n-detail.js → i18n.js
```

In `detail.html`, `i18n-detail.js` loads before the merger `i18n-index.js`, which is required because `i18n-index.js` reads `window.i18nDetail` at IIFE time (see §4.3).

`pages/view.html` and `pages/public-canvas.html` load `i18n-detail.js` **without listing `i18n-index.js` in their current script sequence** (verified above). `js/i18n.js` is a compatibility shim (header at lines 1–9, IIFE body at lines 11–16); this audit does not establish that the shim performs any dictionary-merge or per-dictionary-global injection step for these index-free routes. The effective dictionary-injection path for `view.html` and `public-canvas.html` is **not established by this audit** and must be verified by a separate runtime investigation before any runtime extraction is considered.

### 4.3 Direct lookup boundary

Direct text search for `i18nDetail` over `js/`, `pages/`, and `tests/` returns only two non-definition matches, both in `js/i18n/i18n-index.js`. Within the inspected search scope, no consumer script directly reads `window.i18nDetail`; the directly verified detail call sites use `window.t` or `tText(key, fallback)` instead. This audit does not draw a repository-wide consumer conclusion.

### 4.4 Consumer files (directly verified references)

The following files were directly inspected and found to reference at least one key defined in §3. Key names are listed without copy:

- `js/detail/detail-loading-error-boundary.js` (line 16: `memory_not_found_title`)
- `js/detail/detail-render.js` (line 246: `memory_not_found_title`)
- `js/detail/detail-video.js` (lines 47, 66: `video_embed_fallback_cta`)

`detail-loading-error-boundary.js` and `detail-render.js` both use the `tText(key, fallback)` pattern with the Korean-literal fallback string. The current `tText` helper in `js/detail/detail-utils.js` defines the fallback contract:

```
const translated = i18n(key);
if (typeof translated !== 'string') return fallback;
if (!translated.trim() || translated === key) return fallback;
return translated;
```

So the fallback is invoked when:
1. `window.t(key)` returns a non-string, or
2. the returned translation is empty, or
3. the returned translation equals the key name itself (typical of missing-key lookup behavior).

This fallback boundary is real and observable at the call sites that were directly verified. The audit does not claim to enumerate every consumer of the dictionary in the repository; only the consumers directly inspected are listed. Any extension of this list requires a separate runtime investigation.

### 4.5 Missing-key and locale behavior

The runtime lookup chain has two layers that are relevant to the fallback contract:

**`window.t(key)`** (from `js/i18n/i18n-core.js`):
- If the key is absent from the dictionary, returns the key string itself.
- If the key is present but the selected locale's value is absent, falls back to the default locale value (the other `ko`/`en` field) — this is implemented by `i18n-core.js` and is not a dictionary-internal stub.

**`tText(key, fallback)`** (from `js/detail/detail-utils.js`):
- This is an additional wrapper used at the directly verified detail call sites (see §4.4).
- It calls `window.t(key)` internally and applies a further guard: if the result is not a string, is empty, or equals the key string itself (the missing-key echo), the caller's Korean fallback string is returned instead.
- The Korean fallback is a hardcoded string literal at each call site (e.g., `'기억을 찾지 못했어요'` for `memory_not_found_title`); it is not derived from the dictionary.

The dictionary itself (`js/i18n/i18n-detail.js`) has no per-key fallback chain, no per-key locale-override, and no missing-key stub. `window.t(key)`'s missing-key echo and selected-locale-absence default-locale fallback are `js/i18n/i18n-core.js`'s base lookup behavior. `tText(key, fallback)` is an additional wrapper used at directly verified detail call sites that replaces non-string/empty/key-echo with the caller's Korean fallback. Dictionary file has no per-key fallback; the runtime fallback is not solely in consumer helpers. The audit makes no claim about whether a future implementation should consolidate or change either layer.

## 5. Protected Invariants

The following must remain preserved in any future extraction:

1. **Global API identity**: `window.i18nDetail` (line 4 of `js/i18n/i18n-detail.js`). The name and reachability on `window` must be preserved.
2. **Effective key/value set and lookup semantics**: the final key set, the per-key lookup result, and the duplicate-key survivor semantics observed by consumers today must be preserved. The current construction (single object-literal assignment in source order) is one mechanism that yields those semantics; other construction mechanisms are acceptable **only if** they produce an equivalent observable behavior, demonstrated via a verified equivalence contract recorded in a separate runtime PR.
3. **Key spelling and casing**: every key is currently `lower_snake_case`; order of definition within the object literal currently determines the survivor in any duplicate-key collision (see §3.7). Any new construction must produce the same survivor for the duplicate-key case.
4. **Payload shape**: existing entries are represented as `ko`/`en` payload objects. A future split must preserve each verified entry's payload shape and lookup result. `window.t`'s core missing-key lookup and `tText(key, fallback)`'s additional fallback at directly verified call sites are separate responsibilities: the base `i18n-core` behavior handles key-absence echo and locale absence, while the directly verified `tText` call sites add a non-string/empty/key-echo Korean fallback replacement on top. Neither should be collapsed into a single 'consumer-fallback' label.
5. **Consumer lookup timing**: `window.i18nDetail` must be assigned before `js/i18n/i18n-index.js` IIFE runs. This is preserved by the current script ordering on `pages/detail.html`, `pages/editor.html`, and other pages where the merger module runs.
6. **Dictionary merger behavior**: `i18n-index.js` iterates the array `dictModules` (lines 14–24) and uses `mergedDictionary[key] = module[key]` for each module. Any future split that produces a different `dictModules` order, or removes `window.i18nDetail` from the array, will alter the survivor of any cross-dictionary key collision. This audit does not assess whether such collisions exist; it only records the lookup convention so future splits can preserve it.
7. **No runtime locale-selection change**: this issue explicitly forbids adding locale-selection logic. The Korean/English distinction in the dictionary is only consumed by `window.t` based on the user's current locale selection (handled outside the dictionary file).
8. **Script-order preservation**: per §4.2, `i18n-detail.js` must continue to load after `i18n-core.js` and (for the merger path) `i18n-shared.js`, and before any `i18n-index.js` execution that reads it. The current load-order contract is part of the protected invariant set.

## 6. No-Split / Defer Conclusion

After examining the current global API boundary, the IIFE-wrapper style, the dictionary merger pattern in `js/i18n/i18n-index.js`, the single `window.i18nDetail = { ... }` write, the confirmed detail-merger/lookup path, and the undetermined index-free routes, this audit concludes:

> **The audited global-object assignment and consumer/load-order contract does not identify a behavior-preserving first split within the allowed files.**

Specifically:
- The detail merger path is confirmed: `window.i18nDetail` is assigned, then `i18n-index.js` runs and merges it, then the directly inspected detail call sites call `window.t(key)` (with `tText` wrapping at verified call sites). Within this path, no natural split is identified that would preserve §5 invariants without a verified equivalence contract.
- The duplicate-key boundary in §3.7 means the source-order of object-literal property insertion is currently load-bearing for `video_embed_fallback_cta`. Any split that distributes this key across two files would require either resolving the duplicate explicitly or relying on `i18n-index.js` iteration order (which is a separate decision). Neither is in-scope for an audit-only PR.
- For the index-free routes (`pages/view.html`, `pages/public-canvas.html`), the effective dictionary-injection path is not established by this audit (see §4.2 and §6.2(4)). A future split that affects those routes cannot be assessed until the path is verified.
- A future split that produces a different construction mechanism (e.g., `Object.assign({}, ...parts)` or multi-step mutation) is acceptable only if a verified equivalence contract records that the observable lookup results, duplicate survivor semantics, global availability where required, and route-specific load timing are preserved. Such a contract is out of scope for this audit-only PR.

### 6.1 Rollback triggers (for any future split attempt)

A future runtime extraction PR must include a rollback criterion for each of these findings:

- Any change to the `window.i18nDetail` global name or reachability that breaks current consumers is a hard rollback trigger unless §5 invariant 1 is preserved.
- Any change in the effective key/value set seen by consumers (key visible to `window.t(key)` differs from the pre-change value) is a behavior change and must be reverted, regardless of whether the change was caused by a rename, a missing key, a duplicate-key survivor shift, or a payload-shape change.
- Any change in the survivor of `video_embed_fallback_cta` (i.e., the English copy seen by consumers switches between `'Continue viewing on YouTube'` and `'Continue with the original video'`) is a behavior change and must be reverted.
- Any change in the `dictModules` order in `js/i18n/i18n-index.js` lines 14–24 is a behavior change risk even if no key actually collides today, because future duplicates could surface it.
- Any change to the per-page load order (§4.2) for `i18n-detail.js` relative to `i18n-core.js`, `i18n-shared.js`, or `i18n-index.js` (where present) is a regression and must be reverted.

### 6.2 Future prerequisite before reassessing extraction

> A broader i18n dictionary loading/ownership contract is required before reassessing extraction.

Concretely, the prerequisite scope covers:

1. Determining whether splitting `js/i18n/i18n-detail.js` should be file-per-family (using the §3 clusters), file-per-consumer-surface (detail vs. viewer vs. editor), or a single file with internal logical sections. The choice must be accompanied by a verified equivalence contract that demonstrates the new construction mechanism preserves the §5 invariants.
2. A decision on the duplicate-key resolution mechanism for `video_embed_fallback_cta` (single-source-of-truth consolidation vs. explicit i18n-index override order).
3. A consumer-side decision on whether the dictionary-internal `ko/en` shape should be retained or replaced by an external fallback chain (out of scope for this audit).
4. A separate runtime investigation must establish the effective dictionary-injection path for `view.html` and `public-canvas.html` (which do not list `i18n-index.js` in their current script sequence per §4.2). Until that investigation confirms the index-free route's effective dictionary-injection path and route-specific observable lookup/load-timing contract are established, no split that affects these routes is safe.

Until these prerequisites are documented and approved in a separate issue/PR, no source change to `js/i18n/i18n-detail.js` or its consumers is recommended under #3109.

## 7. References (verified on current main)

- `js/i18n/i18n-detail.js` — IIFE wrapper (lines 1, 542), `window.i18nDetail = { ... }` assignment (line 4), 133 distinct key entries spanning lines 5–540 (one duplicate: `video_embed_fallback_cta` at lines 185 and 349).
- `js/i18n/i18n-index.js` — `window.i18nDetail` read at line 19; `dictModules` order at lines 14–24; `mergedDictionary[key] = module[key]` at line 30.
- `js/i18n.js` — compatibility shim (header at lines 1–9, IIFE body at lines 11–16); does not perform dictionary merging or per-dictionary-global injection. The shim does not establish the effective dictionary-injection path for index-free routes (see §4.2 and §6.2(4)).
- `js/i18n/i18n-core.js` — `t(key)` and `lang` parameter source for runtime locale selection (lines 41, 103).
- `js/detail/detail-utils.js` — `tText(key, fallback)` fallback contract at lines 23–30.
- `js/detail/detail-loading-error-boundary.js` — consumer reference at line 16.
- `js/detail/detail-render.js` — consumer reference at line 246.
- `js/detail/detail-video.js` — `video_embed_fallback_cta` consumers at lines 47 and 66.
- `pages/detail.html` — i18n script order at lines 131–140.
- `pages/view.html` — i18n script order at lines 94–99.
- `pages/public-canvas.html` — i18n script order at lines 113–118.
- `pages/editor.html` (line 251), `pages/view.html` (line 98), `pages/search.html` (line 189), `pages/public-canvas.html` (line 117), `pages/my-trees.html` (line 165), `pages/login.html` (line 120), `pages/intro.html` (line 281), `pages/detail.html` (line 136), `index.html` (line 173) — pages that include `i18n-detail.js`.

## 8. Future Verification Matrix (any future runtime implementation PR)

A future runtime implementation PR that touches `js/i18n/i18n-detail.js` or its consumers must verify, at minimum:

- **Detail/viewer initial load with script order preserved**: `pages/detail.html` initial render, with `i18n-detail.js` loading at the documented §4.2 position relative to its neighbors. For `pages/view.html` and `pages/public-canvas.html`, the prerequisite from §6.2(4) (establishing the effective dictionary-injection path) must complete before these routes are included in any pre-merge verification matrix.
- **Public and signed-in detail surfaces where current consumers exist**: coverage of public-canvas read-only route and detail signed-in route is conditional on the §6.2(4) prerequisite; this verification row records the intent without claiming equivalence has been established today.
- **Translation-present path**: each key in §3 families, when looked up via `window.t(key)` after locale selection, returns the expected `ko` or `en` string for the selected locale, **on routes where the effective dictionary-injection path is verified**.
- **Legacy/missing-key fallback path (directly verified tText call sites only)**: at the call sites directly inspected in §4.4, lookup for a key not in the dictionary (or whose value is empty or whose lookup result echoes the key string) invokes the `tText(key, fallback)` wrapper in `js/detail/detail-utils.js` and returns the caller's hardcoded Korean fallback literal. This row does not assert the same behavior for any call site beyond those directly inspected.
- **Tree load error / not-found / API unavailable keys**: `memory_not_found_*`, `tree_load_*`, `tree_not_found_*`, `tree_load_api_unavailable` render the documented §3.1 copy on the detail route.
- **Unavailable media, empty-detail states**: `video_unavailable_soft_*`, `empty_panel_hint`, `empty_memo_*`, `connected_*`, `no_siblings_in_path` render the documented §3.4 copy on the detail route.
- **Editor-side consumers** that reference tree-context / growth-label keys on `pages/editor.html` resolve the same key strings as on the detail page (because both load `i18n-detail.js` via the merger path).
- **Duplicate-key survivor**: `video_embed_fallback_cta` returns the line-349 English value (`'Continue with the original video'`) for the `en` locale, matching the §3.7 analysis; this is the expected behavior pre- and post- any future split, and is the primary regression guard for the duplicate-key boundary. Any future split that does not preserve this survivor must be reverted per §6.1.
- **Remote CI**: PR's `verify-static` (or equivalent) job must pass.
- **Production smoke**: deferred to the runtime implementation PR only — this audit PR has no production-facing behavior to smoke.

## 9. Explicit Exclusions (recap)

- #2976: dynamic UI-copy centralization (separate issue).
- Runtime copy/translation edits.
- HTML/CSS/JS/test/config/deployment changes in this PR.
- #2960, #2856, #3070, #3072 scoped surfaces.
- Closure of #1882 and #3086 — these are protected/must remain open and must not be closed by this PR.
- Normal closure flow for #3109: review remains open while PR is in draft; after a clean merge into `main`, this audit issue moves to `completed` following standard LoveBud review conventions. This PR does not close #3109; the closure step is the standard post-merge action taken outside the audit commit.
