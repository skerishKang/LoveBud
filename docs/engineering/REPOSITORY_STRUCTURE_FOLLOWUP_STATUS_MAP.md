# Repository Structure Follow-up Status Map

> Status: disposition map only  
> Related: #223  
> Runtime impact: none

## 1. Purpose

This document maps Issue #223 repository structure follow-up items to completed, in-progress, deferred, or blocked work.

It does not authorize direct implementation, merge, deletion, runtime cleanup, or prototype/reference/demo/variant changes.

## 2. Current high-level judgment

Issue #223 is a broad tracker. It should not be closed until each checklist item is either:

- completed by a focused PR;
- explicitly deferred with a linked owner issue; or
- marked not applicable with evidence.

Large redesign is not required. The remaining work should continue as small PRs with tests or browser smoke when runtime-sensitive.

## 3. Checklist disposition

| #223 bucket | Current disposition | Evidence / related PRs | Next action |
|---|---|---|---|
| Editor detail UI stabilization | Audit completed / implementation follow-ups remain | PR #321 documents `editor-detail-ui` responsibility boundaries | Create small implementation PRs only after explicit approval |
| Cloudflare API route mapping contract | In progress | PR #297 documents audit; PR #345 adds contract test coverage and is still open/draft | Complete and verify PR #345 before helper extraction |
| Modal repository/query split planning | Planning documented | PR #326 documents repository/query split boundaries | Keep implementation deferred until backend contract tests are approved |
| Search preview renderer helper extraction | Audit completed / implementation follow-ups remain | PR #323 documents media/copy/CTA helper candidates | Create focused helper extraction PRs one at a time after browser smoke plan |
| Shared header config helper extraction | Deferred by decision | PR #343 records defer decision and trigger conditions | No immediate implementation unless triggers appear |
| CSS override hygiene | Partially tracked elsewhere | Issue #137 and related CSS cleanup PRs own this area | Keep CSS cleanup separate from #223 runtime/API work |
| Docs source-of-truth hygiene | Ongoing | Existing docs/index work has improved source-of-truth routing | Use docs-only PRs when stale docs are identified |

## 4. Open blocker for #223 closure

The main active blocker is PR #345:

- `test(api): lock Cloudflare Modal route mapping contract`
- It is test-only and should be verified with `node --test` and repository test commands before ready/merge consideration.
- No API runtime behavior should change in that PR.

Until PR #345 is resolved, #223 should remain open.

## 5. Safe next sequence

1. Verify and resolve PR #345.
2. Add or update issue comment on #223 linking this disposition map.
3. Decide which remaining implementation follow-ups move to separate issues.
4. Keep #223 open until open blockers are resolved or split out.

## 6. Non-goals

- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.
- Do not delete legacy files from this disposition work.
- Do not combine API, Modal, Editor, Search, CSS, and docs hygiene implementation in one PR.
- Do not convert scripts to `type="module"`.
- Do not close #223 from this document alone.

## 7. Closure recommendation

#223 can be considered for closure only after:

- PR #345 is completed or its work is moved to a dedicated follow-up issue;
- remaining implementation follow-ups are split into explicit owner issues; and
- the #223 issue body or final comment records the disposition of every checklist bucket.
