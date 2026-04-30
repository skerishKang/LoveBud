# Staged Runtime Cleanup Disposition

> Status: disposition map only
> Related: #225
> Runtime impact: none

## 1. Purpose

This document maps Issue #225 staged runtime cleanup items to current disposition, evidence, and next action.

This is a disposition map only. It does not authorize immediate implementation of any staged cleanup items.

## 2. Current Disposition Summary

| #225 stage | Current disposition | Evidence / related PRs | Next action |
|---|---|---|---|
| Stage 1 — Auth/Login legacy fallback reduction | Deferred / owned by #78 or dedicated Auth fallback implementation tracker | #78, #224/#225 ownership context | Do not remove Auth fallbacks under this disposition doc. Continue only after Auth/Login module contracts and browser smoke gates are stable. |
| Stage 1 — Editor fallback removal | Audited / implementation deferred | #223, #224, #225, Editor fallback/global state audit context if already documented | Future implementation only after Editor browser smoke matrix and module coverage are ready. |
| Stage 2 — Editor global state encapsulation | Audited / migration deferred | window.currentTreeMemories, window.currentTreeData, EditorStore/call-site inventory needed | Create dedicated EditorStore/call-site inventory implementation tracker before code changes. |
| Stage 3 — Optional bundler feasibility | Audit/defer | Static multipage runtime contract, Cloudflare Pages constraints | Do not introduce Vite/Rollup/build-tool adoption unless later implementation proposal is approved. |
| Stage 4 — Password policy strengthening | Separate Auth UX/security follow-up needed | Signup/password policy context | Separate policy/copy/i18n/validation PRs only after product/security approval. |

## 3. Recommended Tracker Decision

Issue #225 should usually remain open while staged runtime cleanup is still active.

If CTO wants closure later, first split remaining work into dedicated owner issues.

This document alone does not close Issue #225.

## 4. Non-goals

This disposition map does not authorize:

- Modifying `js/auth.js`
- Modifying `js/editor.js`
- Removing any fallback implementations
- Adding EditorStore
- Changing memory persistence semantics
- Converting to `type="module"`
- Adding Vite/Rollup or other bundlers
- Changing Cloudflare Pages routing or API
- Implementing password policy changes
- Modifying PR #7/prototype/reference/demo/variant paths
- Closing Issue #225 from this document alone

## 5. Closure Conditions

Issue #225 closure review is only possible after:

- Auth/Login fallback reduction owned by #78 or dedicated tracker
- Editor fallback removal and global state migration have separate trackers
- Bundler feasibility explicitly deferred or moved to future build-tool tracker
- Password policy strengthening moved to dedicated Auth UX/security issue
- Final issue comment records disposition of every stage

## 6. Recommended Immediate Next Step

Post #225 issue comment linking this disposition map and decide whether #225 remains umbrella tracker or later split-and-close candidate.

