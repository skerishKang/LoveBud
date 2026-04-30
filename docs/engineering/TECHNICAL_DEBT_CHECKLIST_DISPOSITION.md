# Technical Debt Checklist Disposition

> Status: disposition map only  
> Related: #224  
> Runtime impact: none

## 1. Purpose

This document maps Issue #224 technical-debt verification checklist items to their current disposition.

It classifies each reported item as one of:

- `COMPLETE`
- `TRANSFERRED`
- `NOT_APPLICABLE`
- `STILL_OPEN`

It is not an implementation PR and does not authorize runtime cleanup, deletion, password policy changes, Auth fallback removal, Editor state migration, deployment configuration changes, or prototype/reference/demo/variant cleanup.

## 2. Issue #224 checklist disposition table

| #224 item | Disposition | Evidence / current judgment | Follow-up owner |
|---|---|---|---|
| CORS default allowed origins | `NOT_APPLICABLE` for current main / `TRANSFERRED` if legacy audit reopens it | The reported `netlify/functions/_lib/http.js` path is not present on current `main`; active runtime remains Cloudflare Pages + Modal. If a legacy Netlify path reappears, handle under a legacy runtime audit. | Legacy runtime audit / deployment artifact tracker |
| Repeated hard-coded primary RGBA tokens | `TRANSFERRED` | Hard-coded primary RGBA token cleanup belongs with global CSS hardening implementation, not #224 verification. | Issue #137 / global CSS hardening implementation follow-up |
| CSS version/prototype folders | `TRANSFERRED` | Version/prototype folders require prototype/reference policy and folder-prefix classification before any deletion. | Prototype/reference policy or folder-prefix audit follow-up |
| `auth.js` / `editor.js` transitional fallback patterns | `TRANSFERRED` | Auth and Editor fallbacks have separate ownership and should not be fixed together. | Auth fallback: Issue #78; Editor fallback: Issue #225 |
| `window.currentTreeMemories` global state | `TRANSFERRED` | Editor global state should be handled through EditorStore/editor global-state follow-up work, not #224. | Issue #225 / EditorStore or editor global state follow-up |
| Jest/test framework migration | `NOT_APPLICABLE` for immediate migration | Current lightweight Node contract tests remain the preferred low-friction strategy unless a concrete test strategy issue proves a framework need. | Separate test strategy issue only if CTO reopens framework migration |
| Signup password complexity validation | `TRANSFERRED` | Password policy is Auth UX/security work and needs product/security decision plus user-facing copy before implementation. | Separate Auth UX/security follow-up |

## 3. Completed / transferred / not applicable / still open summary

### COMPLETE

No #224 checklist item is implemented by this disposition document. Items that were previously audited remain represented through their follow-up owner documents or trackers.

### TRANSFERRED

- Repeated hard-coded primary RGBA tokens → Issue #137 / global CSS hardening implementation.
- CSS version/prototype folders → prototype/reference policy or folder-prefix audit follow-up.
- `auth.js` fallback patterns → Issue #78.
- `editor.js` fallback patterns → Issue #225.
- `window.currentTreeMemories` global state → Issue #225 / EditorStore or editor global-state follow-up.
- Signup password complexity validation → separate Auth UX/security follow-up.

### NOT_APPLICABLE

- CORS default allowed origins: not applicable to current `main` as a direct file fix because the reported `netlify/functions/_lib/http.js` path is absent and the active runtime is Cloudflare Pages + Modal. If Netlify legacy runtime work reopens the concern, it should move to a legacy runtime audit.
- Jest/test framework migration: not applicable as an immediate migration because lightweight Node contract tests remain the preferred current strategy absent a concrete test framework requirement.

### STILL_OPEN

- No item should remain open under #224 after the transferred follow-up links are recorded in the issue comment or body.
- The only administrative open work is to record owner links for transferred items before closing #224.

## 4. Follow-up ownership map

| Area | Owner tracker / follow-up | Implementation rule |
|---|---|---|
| Legacy runtime CORS defaults | Legacy runtime audit / deployment artifact follow-up | Do not modify inactive legacy files unless current file presence and runtime relevance are re-established. |
| Global CSS primary RGBA tokens | Issue #137 / global CSS hardening implementation | No broad search/replace; visual review required for token changes. |
| Prototype/version folders | Prototype/reference policy or folder-prefix audit follow-up | No automatic deletion; PR #7 and preserved prototype/reference/demo/variant assets remain untouched. |
| Auth transitional fallbacks | Issue #78 | No Auth fallback removal without provider-boundary and login/Auth smoke validation. |
| Editor transitional fallbacks | Issue #225 | No broad `editor.js` rewrite; preserve compatibility aliases and startup behavior. |
| Editor global state / `window.currentTreeMemories` | Issue #225 / EditorStore follow-up | No large EditorStore rewrite in one PR; browser smoke required for state behavior changes. |
| Test framework strategy | Separate test strategy issue only if needed | Do not add Jest or framework dependencies without a concrete testing gap. |
| Signup password policy | Separate Auth UX/security follow-up | No stricter validation without approved policy, UX copy, i18n, and Auth smoke. |

## 5. Closure rule

Issue #224 can be closed only after all of the following are true:

1. every checklist item is recorded as `COMPLETE`, `TRANSFERRED`, `NOT_APPLICABLE`, or `STILL_OPEN`;
2. any transferred item has an owner issue or follow-up axis recorded in the #224 issue comment or body;
3. any still-open item is either resolved, marked not applicable with evidence, or transferred to a linked follow-up issue;
4. the #224 final comment states that closure is administrative and does not authorize implementation;
5. no close keyword is used accidentally from a PR body;
6. no JS/CSS/HTML/runtime or deployment config files are changed as part of this disposition.

Closing #224 does not authorize implementation.

## 6. Guardrails

- No JS changes.
- No CSS changes.
- No HTML/page markup changes.
- No runtime/Auth/API/Search/MyTrees/Editor behavior changes.
- No deployment config changes.
- No package/test framework dependency changes.
- No password policy implementation.
- No Auth fallback removal.
- No Editor fallback removal.
- No EditorStore or global state migration.
- No prototype/reference/demo/variant path changes.
- No PR #7 changes.
- No close keyword in PR bodies unless CTO explicitly approves issue closure.

## 7. Non-goals

- Do not change CSS tokens in this PR.
- Do not delete legacy/prototype/reference/demo/variant files.
- Do not remove Auth or Editor fallback code.
- Do not implement EditorStore or global state migration.
- Do not add Jest or change package scripts.
- Do not strengthen password policy without approved UX copy and Auth smoke.
- Do not change deployment configuration.
- Do not close #224 from this document alone.

## 8. Suggested next step

Post an issue comment on #224 that links this document and records the disposition of each checklist item.

If CTO approves, close #224 only after the transferred items have explicit owner links and the final comment states that closure is administrative, not implementation approval.
