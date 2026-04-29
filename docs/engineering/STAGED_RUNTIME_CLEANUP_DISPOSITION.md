# Staged Runtime Cleanup Disposition

> Status: disposition map only  
> Related: #225  
> Runtime impact: none

## 1. Purpose

This document maps Issue #225 staged runtime cleanup items to their current owners and next steps.

Issue #225 intentionally does not authorize immediate implementation. It tracks valid cleanup directions that must wait until Auth/Login, Editor, script-load-order, and Cloudflare Pages runtime contracts are stable.

## 2. Current disposition summary

| #225 stage | Current disposition | Evidence / related PRs | Next action |
|---|---|---|---|
| Stage 1 — Auth/Login legacy fallback reduction | Deferred / owned by #78 | PR #349 maps Auth fallback cleanup ownership to #78 and keeps runtime unchanged | Do not remove Auth fallbacks under #225; continue under #78 after module contracts stabilize |
| Stage 1 — Editor fallback removal | Audited / implementation deferred | PR #322 documents Editor fallback/global state audit; PR #349 maps ownership | Future implementation only after module coverage and editor browser smoke matrix are ready |
| Stage 2 — Editor global state encapsulation | Audited / migration deferred | PR #322 covers `window.currentTreeMemories` and `window.currentTreeData` audit plan | Create a dedicated EditorStore/call-site inventory implementation tracker before code changes |
| Stage 3 — optional bundler feasibility | Audit complete / no immediate build-tool adoption | PR #324 documents static multipage bundler feasibility | Do not introduce Vite/Rollup unless a later implementation proposal is approved |
| Stage 4 — password policy strengthening | Audit complete / separate Auth UX/security follow-up needed | PR #327 documents signup password policy options and guardrails | Create separate policy/copy/i18n/validation PRs only after product/security approval |

## 3. Recommended tracker decision

Issue #225 should usually remain open while staged runtime cleanup is still active.

If CTO wants to close #225, first split remaining work into dedicated owner issues:

1. Auth fallback reduction — owned by #78 or a dedicated Auth fallback implementation issue.
2. Editor fallback removal — dedicated Editor fallback implementation tracker after #322.
3. Editor global state encapsulation — dedicated EditorStore/call-site inventory tracker.
4. Bundler adoption — no implementation unless a new build-tool proposal is approved.
5. Password policy strengthening — dedicated Auth UX/security implementation tracker after copy/policy approval.

## 4. Non-goals

This disposition does not authorize:

- modifying `js/auth.js`;
- modifying `js/editor.js`;
- removing fallback code;
- adding EditorStore;
- changing memory persistence semantics;
- converting scripts to `type="module"`;
- adding Vite/Rollup;
- changing Cloudflare Pages routing or `/api/*` behavior;
- strengthening signup validation without UX copy and Auth smoke;
- touching PR #7 or prototype/reference/demo/variant paths;
- closing #225 from this document alone.

## 5. Closure conditions

#225 can be considered for closure only after:

- Auth/Login fallback reduction is fully owned by #78 or a dedicated issue;
- Editor fallback removal and Editor global state migration have separate implementation trackers;
- bundler feasibility is either explicitly deferred or moved to a future build-tool tracker;
- password policy strengthening is moved to a dedicated Auth UX/security issue;
- a final issue comment records the disposition of every stage.

## 6. Recommended immediate next step

Post a #225 issue comment linking this disposition map and stating whether CTO wants to keep #225 open as the umbrella tracker or split-and-close it after follow-up issues are created.
