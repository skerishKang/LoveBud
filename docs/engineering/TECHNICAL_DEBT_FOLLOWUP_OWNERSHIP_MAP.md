# Technical debt follow-up ownership map

Refs #224

## Purpose

This document maps the Issue #224 technical debt verification checklist into narrow ownership buckets.

Issue #224 remains a tracking and verification gate. This document does not authorize direct implementation, deletion, broad rewrites, runtime behavior changes, or merge to `main` without CTO approval.

## Scope

Classify each Issue #224 checklist item as one of:

- `completed`
- `transferred`
- `needs audit`
- `implementation later`

## Non-goals

- No code changes.
- No CSS changes.
- No JS changes.
- No HTML/page markup changes.
- No runtime behavior changes.
- No Netlify/Vercel deletion or reactivation.
- No dependency migration.
- No password policy implementation.
- No PR #7/prototype/reference/demo/variant changes.

## Ownership map

| #224 item | Current disposition | Owner / follow-up axis | Notes |
|---|---|---|---|
| CORS default allowed origins | needs audit | Netlify legacy runtime audit | Verify `netlify/functions/_lib/http.js` current state before any change. Do not remove Netlify files and do not broaden CORS with `*`. |
| Repeated hard-coded primary RGBA tokens | needs audit | CSS token usage audit | Verify current `global.css` count and locations before any token replacement. Do not broad search/replace. |
| CSS version/prototype folders | needs audit | preserved asset reference map | Classify each folder as active, prototype, reference, demo, variant, or removable legacy before deletion. |
| `auth.js` / `editor.js` fallback patterns | transferred | Auth tracker #78 and staged cleanup #225 | Split Auth and Editor. Do not combine fallback cleanup in one implementation PR. |
| `window.currentTreeMemories` global state | transferred | Editor global state tracker #225 | Audit read/write call sites before any `EditorStore` or state migration. |
| Jest/test framework migration | needs audit | test runner strategy audit | Decide whether Jest is needed before any dependency or framework migration. Existing `npm test` behavior must remain stable. |
| Signup password complexity validation | implementation later | Auth UX/security policy follow-up | Requires product/security decision, copy/i18n, Firebase compatibility, and Auth smoke before implementation. |

## Recommended follow-up split

1. `docs(ops): audit Netlify CORS default origin status`
2. `docs(css): audit primary RGBA token usage`
3. `docs(repo): map preserved CSS/version folder references`
4. `docs(test): audit test runner framework strategy`
5. `docs(auth): define signup password policy options`

## Guardrails

- Keep every future PR narrow and file-scoped.
- Do not touch PR #7.
- Do not delete prototype/reference/demo/variant folders automatically.
- Do not remove Netlify or Vercel artifacts without a dedicated audit outcome.
- Do not change Auth, Editor, CSS, tests, or password policy in one PR.
- Runtime-sensitive implementation requires contract tests, browser smoke, Cloudflare Preview, or fixed test slot validation as applicable.

## Closure note

Issue #224 can only move toward closure after each checklist item has either:

1. a linked audit result;
2. a linked implementation PR;
3. a transfer target issue; or
4. an explicit not-applicable decision with evidence.

This document is a docs-only ownership map and does not by itself complete Issue #224.
