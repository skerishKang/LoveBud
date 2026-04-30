# JS Architecture Cleanup Reconciliation

> Status: audit/reconciliation only
> Related: #72
> Runtime impact: none

## 1. Purpose

This document reconciles Issue #72 after the completed Search responsibility split work and related audit PRs.

It does not authorize broad JavaScript reorganization, file movement, runtime changes, or issue closure.

## 2. Completed work already reflected in the repository

The following Issue #72-related work is already complete or superseded:

| Area | Status | Evidence |
|---|---|---|
| Search data loading split | Completed | PR #336 added `js/search/data.js` |
| Search URL state and controls split | Completed | PR #337 added `js/search/url-state.js` and `js/search/controls.js` |
| Search preview controller split | Completed | PR #382 added `js/search/preview-controller.js` |
| Selected tree deep link | Completed / revalidated | Completed via PR #83 and production-revalidated via PR #382 |
| Search grouped script paths | Completed / stabilized | PR #338 grouped Search scripts; later Search module expectations were updated by PR #382 |
| Search inline style cleanup | Completed / no current remainder | PR #339 recorded no remaining inline Search page styles; current Search has no known inline-style remainder |
| JS script loading and namespace contract audit | Completed | PR #304 added `JS_SCRIPT_LOADING_NAMESPACE_CONTRACT.md` |
| API client naming/loading audit | Completed as audit baseline | PR #307 added `API_CLIENT_NAMING_LOADING_AUDIT.md`; implementation remains separate |
| Public tree YouTube utility split audit | Completed as audit baseline | PR #341 added `PUBLIC_TREE_YOUTUBE_UTILITY_SPLIT_AUDIT.md`; implementation remains separate |
| Editor shell/helper boundary work | Documented / partially completed | Related Editor docs and staged helper work documented boundaries without approving broad Editor reorganization |
| Shared root/page module audit docs | Created | Recent docs PRs created the audit baseline for root/page ownership follow-up |

## 3. Issue #72 closure disposition

Issue #72 should not be closed directly from its current tracker state.

The issue body still contains broader cleanup language and explicit non-closure guidance. The safe disposition is to split the tracker into:

1. completed staged JS architecture cleanup already reflected in repository history;
2. follow-up audit or implementation axes that should live in smaller issue-specific trackers;
3. guardrails that continue to apply to all future JS architecture work.

Closure disposition:

- #72 can be closed only after follow-up issue links are created and added to the tracker comment.
- Closing #72 does not authorize broad JS reorganization.
- Future implementation must remain one PR per page/domain.
- Runtime-sensitive pages must use Cloudflare Preview or fixed test slot validation before merge.
- Search, My Trees, Detail, Login, Editor, Auth, API, and shared root contracts must not be combined in a single broad implementation PR.

## 4. Completed under #72

The following items can be treated as completed for #72 reconciliation purposes:

- Search data split: PR #336.
- Search URL state and controls split: PR #337.
- Search preview controller split: PR #382.
- Selected tree deep link: completed via PR #83 and revalidated via PR #382.
- Search CSS inline-style reduction: completed; no current Search inline-style remainder is known.
- Search module expectations: updated and stabilized through PR #382.
- Editor shell/helper boundary work: documented or partially completed through related Editor PRs without approving broad Editor reorganization.
- Shared root/page module audit docs: created through recent docs PRs and available as follow-up baselines.

## 5. Not completed but transferred

The following should be transferred out of #72 into dedicated follow-up issues or issue comments before #72 is closed:

| Follow-up axis | Disposition | Required guardrail |
|---|---|---|
| API client naming/loading audit follow-through | Transfer to a dedicated API client naming/loading issue | Do not rename `js/postgres-client.js` without explicit implementation approval and loading-order validation |
| Public tree adapter and YouTube URL helper split | Transfer to a dedicated public-tree adapter utility issue | Preserve `window.LoveTreePublicTreeAdapter`, thumbnail URL behavior, and script loading order |
| Remaining page module grouping audit | Transfer to a dedicated page-module grouping audit issue | Audit Detail, My Trees, Home, Settings separately; no broad JS tree move |
| Shared root JS ownership / namespace contract follow-up | Transfer to a dedicated shared root ownership issue | Preserve existing `window.*` contracts or document compatibility aliases before implementation |
| Remaining Editor JS architecture and global state boundary audit | Transfer to a dedicated Editor architecture issue | Do not mix with Editor UI polish; no `pages/editor.html` changes in the disposition PR |

## 6. Issue #72 items that should remain open until transfer

The following should remain open until separately approved and implemented or until follow-up issues replace them:

| Backlog item | Recommended next step | Notes |
|---|---|---|
| Shared root JS audit | Separate audit issue or PR | Covers `js/auth.js`, `js/i18n.js`, `js/firebase-config.js`, `js/page-shell.js`, `js/shared-header.js` |
| Remaining page module grouping audit | Separate audit issue or PR | Covers Detail, My Trees, Home, and Settings boundaries |
| YouTube utility implementation split | Separate implementation PR after audit acceptance | Preserve `window.LoveTreePublicTreeAdapter` compatibility |
| API client rename implementation | Separate implementation PR after explicit approval | Do not rename `js/postgres-client.js` without loading-order and global contract review |
| Editor JS architecture audit | Separate audit issue or PR | Do not mix with Editor UI polish |

## 7. Current operational recommendation

Issue #72 should receive a tracker comment that links the follow-up issues once they exist.

Recommended tracker comment content:

- Summarize completed Search staged split work.
- Confirm selected tree deep link and Search inline-style cleanup are no longer #72 blockers.
- Link follow-up issues for API client naming/loading, public-tree YouTube helper split, remaining page module grouping, shared root ownership, and Editor JS/global state boundary audit.
- State that #72 closure is administrative only and does not approve broad reorganization.

Recommended issue body updates, if a later administrative pass is approved:

- Mark script loading and namespace contract docs as completed via PR #304.
- Mark API client naming/loading audit baseline as completed via PR #307 while keeping implementation follow-up separate.
- Mark public tree YouTube utility split audit baseline as completed via PR #341 while keeping implementation follow-up separate.
- Keep implementation follow-ups open.
- Keep broad JS reorganization prohibited.
- Keep PR #7/prototype/reference/demo/variant guardrails unchanged.

## 8. Closure rule

Issue #72 can move to closure only when all of the following are true:

1. follow-up issue links exist for every transferred axis;
2. the #72 tracker comment lists those follow-up links;
3. the tracker comment states that closure is administrative and not implementation approval;
4. no close keyword is used accidentally from a PR body;
5. no JS/CSS/HTML/runtime files are changed as part of the closure disposition.

## 9. Guardrails

- No JavaScript changes.
- No CSS changes.
- No HTML or page markup changes.
- No runtime/Auth/API/Search/MyTrees/Editor behavior changes.
- No file moves.
- No `pages/editor.html` changes.
- No `window.*` namespace contract changes.
- No PR #7 changes.
- No prototype/reference/demo/variant path changes.
- No broad JS reorganization.
- Future implementation must use one PR per page/domain.
- Runtime-sensitive pages require Cloudflare Preview or fixed test slot validation.

## 10. Non-goals

- Do not close Issue #72 from this document alone.
- Do not perform runtime JavaScript changes.
- Do not move or rename files.
- Do not modify `pages/*.html` script loading order.
- Do not change `window.*` global contracts.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.

## 11. Follow-up PR candidates

1. `docs(js): audit shared root JS ownership`
2. `docs(js): audit remaining page module grouping`
3. `docs(editor): audit editor JS global state boundary`
4. `refactor(public-tree): split YouTube URL helpers into utility` after implementation approval
5. `refactor(api-client): rename browser API client` only after explicit implementation approval
