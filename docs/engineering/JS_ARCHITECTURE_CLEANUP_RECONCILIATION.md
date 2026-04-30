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
| Search grouped script paths | Completed / stabilized | PR #338 grouped Search scripts; later Search module expectations were updated by PR #382 |
| Search inline style cleanup | Completed / no current remainder | PR #339 recorded no remaining inline Search page styles |
| JS script loading and namespace contract audit | Completed | PR #304 added `JS_SCRIPT_LOADING_NAMESPACE_CONTRACT.md` |
| API client naming/loading audit | Completed | PR #307 added `API_CLIENT_NAMING_LOADING_AUDIT.md` |
| Public tree YouTube utility split audit | Completed | PR #341 added `PUBLIC_TREE_YOUTUBE_UTILITY_SPLIT_AUDIT.md` |

## 3. Issue #72 items that should remain open

The following should remain open until separately approved and implemented:

| Backlog item | Recommended next step | Notes |
|---|---|---|
| Shared root JS audit | Separate audit PR | Covers `js/auth.js`, `js/i18n.js`, `js/firebase-config.js`, `js/page-shell.js`, `js/shared-header.js` |
| Remaining page module grouping audit | Separate audit PR | Covers Detail, My Trees, Home, and Settings boundaries |
| YouTube utility implementation split | Separate implementation PR after audit acceptance | Preserve `window.LoveTreePublicTreeAdapter` compatibility |
| API client rename implementation | Separate implementation PR after explicit approval | Do not rename `js/postgres-client.js` without loading-order and global contract review |
| Editor JS architecture audit | Separate audit PR | Do not mix with Editor UI polish |

## 4. Current operational recommendation

Issue #72 should remain open, but its body should be reconciled so completed audit items are no longer described as paused or missing.

Recommended issue body updates:

- Mark script loading and namespace contract docs as completed via PR #304.
- Mark API client naming/loading audit as completed via PR #307.
- Mark public tree YouTube utility split audit as completed via PR #341.
- Keep implementation follow-ups open.
- Keep broad JS reorganization prohibited.
- Keep PR #7/prototype/reference/demo/variant guardrails unchanged.

## 5. Non-goals

- Do not close Issue #72 from this document alone.
- Do not perform runtime JavaScript changes.
- Do not move or rename files.
- Do not modify `pages/*.html` script loading order.
- Do not change `window.*` global contracts.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.

## 6. Follow-up PR candidates

1. `docs(js): audit shared root JS ownership`
2. `docs(js): audit remaining page module grouping`
3. `refactor(public-tree): split YouTube URL helpers into utility` after implementation approval
4. `refactor(api-client): rename browser API client` only after explicit implementation approval
