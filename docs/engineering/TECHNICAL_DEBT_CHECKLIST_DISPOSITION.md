# Technical Debt Checklist Disposition

> Status: disposition map only  
> Related: #224  
> Runtime impact: none

## 1. Purpose

This document maps Issue #224 technical-debt verification checklist items to their current disposition.

It is not an implementation PR and does not authorize runtime cleanup, deletion, password policy changes, Auth fallback removal, or Editor state migration.

## 2. Disposition summary

| #224 item | Current disposition | Evidence / related PRs | Next action |
|---|---|---|---|
| CORS default allowed origins | Finding appears stale / current active default includes Pages origin | PR #335 documents that the reported Netlify file/default was not present on current main and Modal configuration includes `https://lovebud.pages.dev` | Mark as audit-complete; no Netlify CORS implementation unless new evidence appears |
| Repeated primary RGBA tokens | Audit complete / implementation deferred | PR #298 documents usage audit and safe candidate/hold areas | Create separate CSS token cleanup PR only after visual review approval |
| CSS version/prototype folders | Audit complete / no deletion authorized | PR #348 merged folder reference audit | Keep preserved artifacts unless a dedicated removal audit explicitly approves deletion |
| Auth/editor transitional fallbacks | Ownership mapped / implementation deferred | PR #349 maps Auth cleanup to #78 and Editor fallback/global-state cleanup to #225/#322 | Do not remove fallbacks from #224 directly |
| `window.currentTreeMemories` global state | Audit owner mapped / migration deferred | PR #322 documents Editor fallback/global state audit path; PR #349 maps ownership | Keep under #225 staged Editor state cleanup |
| Jest/test framework migration | Audit complete / no immediate migration | PR #329 documents lightweight test runner strategy | Do not add Jest unless a concrete follow-up need is approved |
| Signup password complexity validation | Audit complete / implementation deferred | PR #327 documents password policy options and guardrails | Create separate Auth UX/security PR only after policy/copy approval |

## 3. Closure blocker

Issue #224 can only close when the issue body or final issue comment records that every checklist item is either:

- completed by an audit PR;
- marked stale/not applicable with evidence;
- moved to a dedicated owner issue; or
- deferred with an explicit follow-up owner.

This document supports that final comment but does not close #224 by itself.

## 4. Recommended issue-level disposition

Recommended final disposition for #224:

- CORS default origin: audit-complete / no action on current main unless new file evidence appears.
- Primary RGBA tokens: defer implementation to CSS token cleanup follow-up.
- CSS version folders: audit-complete / no deletion authorized.
- Auth fallback cleanup: owned by #78 and staged runtime cleanup trackers.
- Editor fallback/global state: owned by #225 and Editor audit documents.
- Test framework migration: audit-complete / keep current lightweight tests unless approved.
- Signup password policy: audit-complete / separate Auth UX/security follow-up required.

## 5. Non-goals

- Do not change CSS tokens in this PR.
- Do not delete legacy/prototype/reference/demo/variant files.
- Do not remove Auth or Editor fallback code.
- Do not implement EditorStore or global state migration.
- Do not add Jest or change package scripts.
- Do not strengthen password policy without approved UX copy and Auth smoke.
- Do not close #224 from this document alone.

## 6. Suggested next step

Post an issue comment on #224 that links this document and records the final disposition of each checklist item. If CTO approves, close #224 only after any remaining implementation work is moved to explicit follow-up issues.
