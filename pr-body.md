## Summary
- Extract `getTimelineLabel`, `getPreviewTimeRange`, `getPreviewSummaryCopy` from renderer to builders
- Renderer retains thin delegation wrappers with minimal fallbacks
- Refs #656

## Extracted helpers
- `getTimelineLabel` — timeline label string formatting
- `getPreviewTimeRange` — time range validation and filtering
- `getPreviewSummaryCopy` — summary copy template formatting

## Changed files
- `js/search/search-preview-renderer.js`
- `js/search/search-preview-renderer-builders.js`
- `tests/routes/search-runtime-modules.test.js`

## Line count before/after
| File | Before | After | Delta |
|------|--------|-------|-------|
| search-preview-renderer.js | 700 | 598 | -102 |
| search-preview-renderer-builders.js | 207 | 290 | +83 |

## Verification
- `git diff --check`: PASS
- `npm run verify`: 149/149 PASS
- `npm test`: 203/203 PASS

## Guardrails
- No UX/DOM/structure/class name changes
- No search URL state behavior changes
- No auth/API path/payload changes
- No filter/sort/limit behavior changes
- No preview open/close behavior changes
- No fallback/error behavior changes
- No desktop/mobile behavior changes
- No new helper files created
- Delegation fallbacks maintained

## Browser verification required
- YES — preview summary copy, timeline label, and time range rendering should be verified via browser smoke

## Non-goals
- Does not change any other search runtime module
- Does not touch PR #7 / prototypes / reference / demo / variant paths
- Does not add new script loading entries