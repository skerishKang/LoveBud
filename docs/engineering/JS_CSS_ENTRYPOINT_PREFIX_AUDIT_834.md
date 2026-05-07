# JS/CSS Entrypoint and Folder-prefix Naming Consistency Audit

- Issue: #834
- Parent tracker: #656
- Base main SHA: fd65fbcc13b5e894647e8ae1086155039565b9cf

## Audit scope

- js/**/*.js excluding js/product/ (POC, prototype)
- css/**/*.css excluding css/gemini-v2/, css/gemini-v3/, css/gpt-v2/, css/v2/ (legacy design variants)
- Root JS/CSS files that share a name with an existing folder
- Folder-internal files whose filename does not start with the folder prefix and is not an accepted entry file (index.js, index.css)

## Method

File listing collected via Get-ChildItem -Recurse. Prefix-mismatch analysis performed manually per folder.

## Non-action statement

This audit is inventory-only. It does not authorize:
- File moves
- File renames
- HTML script order changes
- CSS selector movement
- Any runtime behavior change

Each finding is classified for future reference. Any implementation PR must reference this audit and follow its recommended split.

## Classification legend

| Classification | Meaning |
|---|---|
| MOVE_CANDIDATE | File should logically move inside the matching folder. Requires script order audit. |
| KEEP_AS_COMPAT_ENTRY | Root entry with same-name folder. Keep as thin re-export for backward compat. |
| PREFIX_RENAME_CANDIDATE | File should be renamed with folder prefix. Low risk. |
| DO_NOT_TOUCH | File/folder is legacy, frozen, or prototype. Do not modify. |
| NEEDS_SCRIPT_ORDER_REVIEW | Moving/renaming requires HTML script tag audit across all pages. |
| NEEDS_BROWSER_VERIFICATION | Any script-order change requires fixed-slot browser verification. |

---

## JS findings

### Root entries with same-name folder

| File | Folder | Classification | Note |
|---|---|---|---|
| js/auth.js | js/auth/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry; all logic already delegated to js/auth/*. |
| js/detail.js | js/detail/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. Already delegates. |
| js/editor.js | js/editor/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. Already delegates. |
| js/i18n.js | js/i18n/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. Already delegates. |
| js/my-trees.js | js/my-trees/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. Already delegates. |
| js/search.js | js/search/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. Already delegates. |

### Root legacy files not moved into folder

| File | Target folder | Classification | Note |
|---|---|---|---|
| js/search-card-renderer.js | js/search/ | MOVE_CANDIDATE + NEEDS_SCRIPT_ORDER_REVIEW | |
| js/search/search-copy-ui.js | js/search/ | MOVE_CANDIDATE + NEEDS_SCRIPT_ORDER_REVIEW | |
| js/search/search-data-adapter.js | js/search/ | MOVED_IN_PR_C1 | |
| js/search-preview-renderer.js | js/search/ | MOVE_CANDIDATE + NEEDS_SCRIPT_ORDER_REVIEW | |
| js/search/search-shared-utils.js | js/search/ | MOVED_IN_PR_C1 | |
| js/search/search-title-helper.js | js/search/ | MOVED_IN_PR_C1 | |

### Folder-prefix mismatch (JS)

#### js/auth/ (expected prefix: auth-)

| File | Classification | Note |
|---|---|---|
| protected-route.js | PREFIX_RENAME_CANDIDATE | Should be auth-protected-route.js. Low risk (single reference). |

#### js/search/ (expected prefix: search-)

Accepted entry file: index.js (exempt).

| File | Classification | Note |
|---|---|---|
| controls.js | PREFIX_RENAME_CANDIDATE | Should be search-controls.js. |
| data.js | PREFIX_RENAME_CANDIDATE | Should be search-data.js. |
| preview-controller.js | PREFIX_RENAME_CANDIDATE | Should be search-preview-controller.js. |
| url-state.js | PREFIX_RENAME_CANDIDATE | Should be search-url-state.js. |

#### js/api/ (no consistent prefix)

| File | Classification | Note |
|---|---|---|
| auth-policy.js | PREFIX_RENAME_CANDIDATE | Could be api-auth-policy.js. |
| base-api-fetch.js | DO_NOT_TOUCH | Well-known name; renaming breaks all imports. |
| public-tree-adapter.js | PREFIX_RENAME_CANDIDATE | Could be api-public-tree-adapter.js. |

---

## CSS findings

### Root entries with same-name folder

| File | Folder | Classification | Note |
|---|---|---|---|
| css/global.css | css/global/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. |
| css/editor.css | css/editor/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. |
| css/intro.css | css/intro/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. |
| css/my-trees.css | css/my-trees/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. |
| css/search.css | css/search/ | KEEP_AS_COMPAT_ENTRY | Thin compat entry. |

### Folder-prefix mismatch (CSS)

Unlike JS, most CSS folders do NOT use the folder as a filename prefix. This is a deliberate convention difference because CSS files within a folder are imported via @import in the root entry file, not loaded independently by script tags. The folder acts as a scope boundary.

#### css/editor/ (no prefix convention — DO_NOT_TOUCH)

base.css, canvas.css, canvas-toolbar.css, detail-panel.css, layout.css, memory-edit.css, memory-form.css, mode-selection.css, overrides.css, responsive.css, responsive-tail.css, sidebar.css, status-settings.css

#### css/global/ (no prefix convention — DO_NOT_TOUCH)

base.css, header.css, header-language.css, ready-state.css, tokens.css, transition-polish.css

#### css/intro/ (no prefix convention — DO_NOT_TOUCH)

base.css, cta.css, hero.css, how-to.css, responsive.css, value.css

#### css/my-trees/ (no prefix convention — DO_NOT_TOUCH)

cards.css, create-modal.css, header.css, layout.css, responsive.css, states.css

#### css/search/ (uses search- prefix — consistent)

All files use search- prefix. Consistent. No action needed.

---

## Legacy/design-variant folders

| Folder | Classification | Note |
|---|---|---|
| css/gemini-v2/ | DO_NOT_TOUCH | Legacy design variant. |
| css/gemini-v3/ | DO_NOT_TOUCH | Legacy design variant. |
| css/gpt-v2/ | DO_NOT_TOUCH | Legacy design variant. |
| css/v2/ | DO_NOT_TOUCH | Legacy design variant. |
| js/product/ | DO_NOT_TOUCH | POC/prototype. |

---

## Summary

### JS

| Category | Count |
|---|---|
| Root entries with same-name folder (KEEP_AS_COMPAT_ENTRY) | 6 |
| Root legacy files not moved (MOVE_CANDIDATE + NEEDS_SCRIPT_ORDER_REVIEW) | 6 |
| Folder-prefix mismatch (PREFIX_RENAME_CANDIDATE) | 7 |
| Accepted entry exceptions (index.js) | 1 |

### CSS

| Category | Count |
|---|---|
| Root entries with same-name folder (KEEP_AS_COMPAT_ENTRY) | 5 |
| Folder-prefix mismatch (DO_NOT_TOUCH) | All project CSS uses generic names; accepted convention. |
| Legacy design variant folders (DO_NOT_TOUCH) | 4 |

### Risk summary

| Classification | Count |
|---|---|
| MOVE_CANDIDATE | 6 |
| KEEP_AS_COMPAT_ENTRY | 11 |
| PREFIX_RENAME_CANDIDATE | 7 |
| DO_NOT_TOUCH | ~40+ (CSS internal files + legacy folders) |
| NEEDS_SCRIPT_ORDER_REVIEW | 6 |
| NEEDS_BROWSER_VERIFICATION | 6 |

---

## Recommended follow-up PR split

1. PR-A (low risk): Rename js/auth/protected-route.js to js/auth/auth-protected-route.js. Update single HTML reference.
2. PR-B (low risk): Rename js/search/{controls,data,preview-controller,url-state}.js to js/search/search-{controls,data,preview-controller,url-state}.js. Update HTML references.
3. PR-C (medium risk, needs script order review): Move root js/search-*.js files into js/search/. Requires script order audit and browser verification.
4. PR-D (future): Standardize js/api/ prefix if desired.

## NOT_VERIFIED

- No script order verification performed.
- No browser verification performed.
- No duplicate check between root js/search-card-renderer.js and js/search/search-card-renderer.js (assumed distinct).
- Same for js/search-preview-renderer.js vs js/search/search-preview-renderer.js.
