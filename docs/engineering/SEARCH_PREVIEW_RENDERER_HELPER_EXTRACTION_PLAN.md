# Search Preview Renderer Helper Extraction Plan

Refs #424
Refs #223
Refs #400

## Purpose

This document defines the safe implementation sequence for Issue #424, the Search preview renderer helper extraction follow-up.

The current target is `js/search-preview-renderer.js`, specifically helper boundaries around preview media, copy/locale formatting, CTA/share markup, and `updatePreview` behavior preservation.

## Current responsibility buckets

`js/search-preview-renderer.js` currently owns several responsibilities in one browser script:

1. Shared utility fallback wrappers
   - `getSharedUtils`
   - `escapeHtml`
   - `sanitizeUrl`
   - `isSuspiciousYouTubeThumbnailImage`

2. Locale and copy helpers
   - `getCurrentLocale`
   - `getSearchCopy`
   - `formatSearchCopy`
   - date/copy formatting used by preview summary and timeline labels

3. Preview navigation and action markup
   - `getBasePath`
   - `getTreeDetailHref`
   - `renderPreviewActionButton`
   - `renderShareButton`

4. Preview media helpers
   - `getPreviewMediaMemory`
   - `renderPreviewThumbnailFallback`
   - `renderPreviewThumbnailMedia`
   - `showPreviewImageFallback`
   - preview iframe/thumbnail selection inside `updatePreview`

5. Preview descriptive markup helpers
   - `renderEmotionTags`
   - `getTimelineLabel`
   - `getPreviewSummaryCopy`
   - `renderSectionHeading`
   - `renderInfoCallout`
   - `renderPathStageBadge`
   - `renderMoreStagesText`

6. Main renderer flow
   - `init`
   - `renderLoadingPreview`
   - `updatePreview`
   - `renderPlaceholder`
   - public API exposure on `window.LoveBudSearchPreviewRenderer`

## Extraction principle

Each implementation PR must extract one helper boundary only.

Do not combine:
- Search adapter/API behavior changes.
- Search UI state changes.
- CSS layout changes.
- Renderer behavior changes beyond the one helper boundary.
- Auth/API/backend/package/workflow changes.

`updatePreview` must remain behaviorally stable until each helper boundary is independently verified.

## Proposed PR sequence

### PR B — Media fallback helper extraction

Branch suggestion:
- `refactor/issue-424-search-preview-media-helper`

Allowed files:
- `js/search-preview-renderer.js`
- Optional new file: `js/search-preview-media-helper.js` or equivalent search-scoped helper file
- If a new helper file is added, the corresponding script load path must be handled without converting existing scripts to modules.

Scope:
- Extract media memory selection and thumbnail fallback rendering only.
- Preserve iframe/thumbnail/no-media behavior in `updatePreview`.
- Preserve `showPreviewImageFallback` public behavior if existing inline `onerror` callbacks depend on it.

Verification required:
- Search page loads.
- Selected tree preview with source URL renders iframe path where reachable.
- Selected tree preview with thumbnail renders image path where reachable.
- Thumbnail error fallback still displays fallback panel.
- No fatal console errors.
- Mobile smoke.

### PR C — Copy and locale helper extraction

Branch suggestion:
- `refactor/issue-424-search-preview-copy-helper`

Allowed files:
- `js/search-preview-renderer.js`
- Optional new file: `js/search-preview-copy-helper.js` or equivalent search-scoped helper file

Scope:
- Extract locale/copy/template replacement helpers only.
- Preserve Korean/English fallback behavior.
- Preserve existing `window.i18n` and `window.i18nSearch` lookup behavior.

Verification required:
- Korean preview copy smoke.
- English preview copy smoke where reachable.
- Missing translation fallback smoke where reachable.
- No markup escaping regression.
- No fatal console errors.

### PR D — CTA/share markup helper extraction

Branch suggestion:
- `refactor/issue-424-search-preview-cta-share-helper`

Allowed files:
- `js/search-preview-renderer.js`
- Optional new file: `js/search-preview-actions-helper.js` or equivalent search-scoped helper file

Scope:
- Extract tree detail href, open CTA markup, and share button markup only.
- Preserve `data-share-tree-link` and `data-share-tree-link-label` attributes.
- Preserve link generation contract for `detail.html?id=...&tree=...&from=browse`.

Verification required:
- Open tree CTA appears when both tree id and first memory id are present.
- CTA href remains encoded and functional.
- Share button appears when tree id exists.
- Share button label and data attributes remain unchanged.
- No fatal console errors.

## Browser smoke checklist for every implementation PR

Every implementation PR under #424 must report PASS or NOT_VERIFIED for:

- Search page load.
- Preview sidebar initial placeholder.
- Loading preview state where reachable.
- Empty tree preview state.
- Populated tree preview state.
- Media iframe path where reachable.
- Thumbnail image path where reachable.
- Thumbnail fallback path where reachable.
- Emotion tags rendering.
- Timeline label rendering.
- CTA button rendering.
- Share button rendering.
- Mobile 375px search preview smoke.
- Horizontal overflow.
- Fatal console errors.

## Guardrails

Do not touch:
- `css/editor.css`
- `css/editor/overrides.css`
- `css/editor/status-settings.css`
- PR #527 / Issue #513 scope
- PR #7 prototype/reference/demo/variant paths
- PR #450 scope
- Auth/API/backend/package/workflow files
- My Trees or Editor runtime behavior

Do not:
- Convert browser scripts to `type="module"`.
- Bundle Search adapter/API/UI state changes into renderer helper extraction.
- Rename public API methods on `window.LoveBudSearchPreviewRenderer` unless separately approved.
- Change `updatePreview` output behavior without browser smoke.

## Acceptance criteria for #424 closure

#424 can be considered complete after:

1. This extraction plan is merged.
2. At least the first low-risk implementation PR extracts the media helper boundary.
3. Any remaining helper boundaries are either implemented in follow-up PRs or split into narrower issues with clear owner, allowed files, and browser smoke requirements.
4. Browser verification is recorded for every implementation PR.
