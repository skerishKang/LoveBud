# Search Preview Controller Split Audit

> Status: audit / planning only  
> Scope: Search/Browse preview controller split preparation  
> Related: #65, #72  
> Runtime impact: none

## 1. Purpose

This document records the safe path for a future Search/Browse preview controller split.

The goal is to prepare the next implementation slice for Issue #72 and Issue #65 without modifying runtime code in this PR.

This audit is needed because Search/Browse currently has several adjacent responsibilities:

- data loading
- URL state
- controls binding
- card rendering
- preview rendering
- selected tree hydration
- desktop/mobile preview behavior
- preview cache interaction

PR #336 covers data loading split. PR #337 covers URL state and controls split. This document defines the guardrails for the later preview controller split only.

## 2. Non-goals

This PR does not implement the preview controller split.

Do not do the following in this audit PR:

- create `js/search/preview-controller.js`
- modify `js/search.js`
- modify `js/search/data.js`
- modify `js/search-ui.js`
- modify `search-preview-cache.js`
- modify `pages/search.html`
- change Search/Browse CSS
- change API calls or adapter contracts
- change selected tree deep link behavior
- close Issue #65 or Issue #72

## 3. Current dependency sequence

The implementation order should remain:

1. PR #336 — Search/Browse data loading split
2. PR #337 — Search URL state and controls split
3. Preview controller split — future implementation PR after #336/#337 are stable on `main`

The preview controller split must not be merged before the preceding Search split PRs are resolved.

## 4. Candidate future file

Future implementation candidate:

```text
js/search/preview-controller.js
```

Expected browser-global namespace candidate:

```text
window.LoveBudSearchPreviewController
```

The exact exported API should be finalized in the implementation PR, but it should be small and focused.

## 5. Candidate responsibility boundary

The future preview controller module may own orchestration around:

- selected tree preview activation
- preview sidebar open/close coordination
- selected tree hydration handoff
- preview cache read/write handoff
- desktop/mobile preview state coordination
- preview loading/error state coordination

It should not own:

- API adapter implementation
- raw public tree response normalization
- card markup rendering
- preview markup rendering internals
- global URL state parsing
- category/sort/limit controls binding
- CSS definitions

## 6. Compatibility rules

A future implementation must preserve existing user-visible behavior:

- direct selected tree deep link must keep working
- desktop preview sidebar behavior must remain stable
- mobile preview behavior must remain stable
- back/forward behavior must not regress
- category/sort/limit controls must not reset selected tree unexpectedly
- preview cache behavior must remain compatible
- YouTube embed/thumbnail fallback behavior must not change
- no API endpoint or response contract changes

## 7. Script loading guardrails

If a future PR adds `js/search/preview-controller.js`, then `pages/search.html` must load it in a safe order.

Candidate order should be verified against the current Search runtime contract:

1. shared dependencies and API/client scripts
2. Search adapter/cache/rendering helpers
3. preview controller module
4. `js/search.js` or future thin entrypoint

The implementation PR must confirm that any new namespace is available before the entrypoint uses it.

## 8. Browser verification required for future implementation

A future implementation PR requires Cloudflare Preview or fixed test slot browser verification.

Local static server alone is not final PASS because Search/Browse is API/data-loaded.

Minimum checks:

- `/pages/search.html` loads on assigned Cloudflare Preview or fixed test slot
- initial public tree data load works
- category filter works
- sort/limit controls work
- selected tree preview opens
- selected tree deep link works
- desktop preview behavior is stable
- mobile preview behavior is stable
- empty state renders correctly
- API/network has no new blocker
- console has no fatal error
- horizontal overflow does not appear

## 9. Suggested future PR body skeleton

```markdown
## Summary
- Split Search/Browse preview controller orchestration into `js/search/preview-controller.js`.
- Preserve selected tree deep link, desktop/mobile preview behavior, and preview cache behavior.
- Keep API, adapter, renderer, CSS, and URL state contracts unchanged.

## Scope
- Preview controller orchestration split only.
- No API endpoint changes.
- No adapter contract changes.
- No renderer markup changes.
- No CSS/page layout changes.
- No PR #7/prototype/reference/demo/variant changes.

## Related
Refs #72
Refs #65

## Verification
- [ ] git diff --check
- [ ] Search/Browse initial data load verified on Cloudflare Preview or fixed test slot
- [ ] selected tree preview works
- [ ] selected tree deep link works
- [ ] desktop/mobile preview behavior preserved
- [ ] category/sort/limit controls do not regress
- [ ] no API/Auth/runtime/CSS changes
- [ ] no close keywords for #72 or #65
```

## 10. Final audit decision

Proceed with a future preview controller implementation only after:

- PR #336 is merged or otherwise resolved
- PR #337 is merged or otherwise resolved
- latest `main` contains the expected Search split baseline
- a valid Cloudflare Preview or fixed test slot is assigned
- the future PR has a Browser verification entrypoint comment

Until then, this remains a planning/audit document only.
