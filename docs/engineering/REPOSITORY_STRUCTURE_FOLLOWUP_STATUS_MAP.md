# Repository Structure Follow-up Status Map

> Status: disposition map only
> Related: #223
> Runtime impact: none

## 1. Purpose

This document maps Issue #223 repository structure follow-up items to completed, in-progress, deferred, transferred, or remaining implementation work.

It does not authorize direct implementation, merge, deletion, runtime cleanup, broad repository restructuring, or prototype/reference/demo/variant changes.

## 2. Current high-level judgment

Issue #223 is a broad tracker. It should not be closed directly from its original checklist state.

Most audit and planning buckets have been completed or documented through focused PRs. Remaining work should be split into narrow follow-up issues or PRs with explicit allowed files.

Large redesign is not required. The remaining work should continue as small PRs with tests or browser smoke when runtime-sensitive.

## 3. Checklist disposition

| #223 bucket | Current disposition | Evidence / related PRs | Next action |
|---|---|---|---|
| Editor detail UI stabilization | Audit completed / implementation follow-ups remain | PR #321 documents `editor-detail-ui` responsibility boundaries | Split implementation into small follow-up issue or PR only after explicit approval |
| Cloudflare API route mapping contract | Completed | PR #297 documents audit; PR #345 added contract test coverage | Helper extraction, if still needed, should be separate and explicitly approved |
| Modal repository/query split planning | Planning documented | PR #326 documents repository/query split boundaries | Split implementation into a backend-specific follow-up issue |
| Search preview renderer helper extraction | Audit completed / implementation follow-ups remain | PR #323 documents media/copy/CTA helper candidates; PR #381 records related status | Create focused helper extraction PRs one at a time after browser smoke plan |
| Shared header config helper extraction | Deferred by decision | PR #343 records defer decision and trigger conditions | No immediate implementation unless triggers appear |
| CSS override hygiene | Transferred | Issue #137 owns CSS/HTML cleanup disposition and follow-ups | Keep CSS cleanup separate from #223 runtime/API work |
| Docs source-of-truth hygiene | Ongoing / remaining follow-up | Existing docs/index work and recent status maps improved source-of-truth routing | Split stale-doc cleanup into docs-only follow-up when concrete conflicts are identified |
| Repository status map | Completed / current document | This document records the disposition map | Keep this map as the #223 closure baseline |

## 4. Completed or documented buckets

The following buckets are completed or documented for #223 disposition purposes:

- Residual legacy API artifact cleanup: completed or documented through repository-structure cleanup/audit PRs, including recent status-map and legacy-artifact disposition work.
- Cloudflare API route mapping audit and contract coverage: completed through audit and contract-test PRs, including PR #297 and PR #345.
- Modal repository/query split planning: documented through PR #326.
- Search preview renderer helper audit: documented through PR #323, with related follow-up status captured by later repository-structure docs.
- Search staged split references: completed through the Search staged split sequence and reflected in repository architecture status docs.
- Shared header config/helper extraction deferred decision: documented through PR #343.
- Repository status map: created and maintained by this document and related #223 docs PRs.

These items do not require broad repository restructuring to be counted as disposition-complete.

## 5. Transferred buckets

The following #223 buckets should no longer be owned directly by #223:

| Bucket | Transfer target | Reason |
|---|---|---|
| CSS override hygiene | Issue #137 | CSS/HTML cleanup has its own status map, closure disposition, and implementation follow-up split. |
| Auth fallback cleanup | Issue #78 | Auth fallback and provider-boundary cleanup belongs with the Auth architecture tracker, not repository-structure closure. |
| Editor global state / EditorStore boundary | Issue #225 | Editor global state and EditorStore migration/audit belongs with the Editor fallback/global-state audit tracker. |

## 6. Remaining implementation follow-ups to split

The following implementation follow-ups should be split into narrow issues or PRs before #223 is administratively closed:

| Follow-up | Recommended split | Required guardrail |
|---|---|---|
| Editor detail UI implementation follow-up | Dedicated Editor detail UI issue or small PR | No `js/editor.js` rewrite; no `pages/editor.html` rewrite; preserve editor interactions and browser-smoke scope. |
| Modal repository/query split implementation follow-up | Dedicated Modal backend issue | Do not move route decorators without explicit approval; keep DB/auth/validation changes separate. |
| Search preview renderer helper extraction implementation follow-up | Dedicated Search preview issue | One helper extraction at a time; preserve `updatePreview` behavior and run browser smoke. |
| Docs source-of-truth hygiene follow-up | Dedicated docs-only issue or PR | Prefer updating existing source-of-truth docs; no runtime/code changes. |

## 7. Issue #223 closure disposition

Issue #223 can be considered for administrative closure only after remaining follow-up issue links are created and added to the issue comment or body.

Closure disposition:

- #223 can be closed after follow-up issue links are created and added to the issue comment/body.
- Closing #223 does not authorize broad repository restructuring.
- Future implementation remains one PR per bucket with explicit allowed files.
- Runtime-sensitive implementation must include appropriate contract tests, browser smoke, Cloudflare Preview, or fixed test slot validation.
- Prototype/reference/demo/variant paths and PR #7 remain outside automatic cleanup.

## 8. Safe next sequence

1. Add or update issue comment on #223 linking this disposition map.
2. Create or identify follow-up issues for the remaining implementation buckets.
3. Record transferred buckets: CSS override hygiene to #137, Auth fallback cleanup to #78, and Editor global state / EditorStore to #225.
4. Keep #223 open until those follow-up links are recorded.
5. Close #223 only as administrative tracker completion, not implementation approval.

## 9. Closure rule

#223 can move to closure only when all of the following are true:

1. follow-up issue links exist for remaining implementation buckets;
2. the #223 issue comment or body lists those follow-up links;
3. transferred buckets are explicitly mapped to their owner issues;
4. closure is described as administrative tracker completion only;
5. no close keyword is used accidentally from a PR body;
6. no JS/CSS/HTML/runtime files are changed as part of closure disposition;
7. no file moves occur as part of closure disposition.

## 10. Non-goals

- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.
- Do not delete legacy files from this disposition work.
- Do not combine API, Modal, Editor, Search, CSS, and docs hygiene implementation in one PR.
- Do not convert scripts to `type="module"`.
- Do not close #223 from this document alone.
- Do not authorize broad repository restructuring.
- Do not move files.

## 11. Closure recommendation

#223 can be considered for closure only after:

- completed/documented buckets are recorded;
- transferred buckets are mapped to owner issues;
- remaining implementation follow-ups are split into explicit owner issues; and
- the #223 issue body or final comment records the disposition of every checklist bucket.

Current recommendation: keep #223 open until follow-up issue links are recorded, then close administratively without authorizing broad repository restructuring.
