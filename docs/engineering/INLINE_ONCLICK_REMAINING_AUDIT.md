# PR-C-02: Remaining Inline `onclick` Handler Audit

Base SHA: `fcee6af4ad8ea87c13bddabab2e673e0e03cd064`

Tracking issue: `#1203`

Previous PR:

- PR-C-01 / PR #1222 migrated the active Settings logout button from inline `onclick="handleLogout()"` to a `js/settings.js` event listener.

## Executive decision

After PR-C-01, the remaining visible inline `onclick=` matches are not suitable for automatic runtime migration because they are located in protected reference, prototype, demo, or variant artifacts.

Recommendation: **do not modify remaining reference/variant artifacts under PR-C without explicit CTO approval.**

## Current active-production finding

The active production Settings inline handler was removed by PR #1222.

No additional active production route was selected for PR-C-02 migration from the current audit pass.

## Remaining search results observed

A repository search for `onclick=` still surfaces these categories:

| Path category | Examples | CTO action |
| --- | --- | --- |
| Protected reference artifacts | `quiet/home.html`, `quiet/home-desktop.html` | Do not modify |
| Protected design variants | `pages/kimi-v2/*`, `pages/gemini-v2/*`, `pages/gemini-v3/*` | Do not modify |
| Historical conversation docs | `docs/conversation/full/*` | Do not modify |
| Audit/reference docs | `docs/engineering/SHARED_HEADER_INLINE_HANDLER_STYLE_AUDIT.md` | Do not modify |
| Stale indexed pre-merge result | `pages/settings.html` at the pre-PR-C-01 SHA | Already fixed on main |

## Why `quiet/` is excluded

`docs/reference/PROTOTYPE_INDEX.md` explicitly classifies `quiet/` as a protected reference artifact:

- `quiet/` is a Quiet Home landing visual experiment / historical UI reference.
- `quiet/home.html` and `quiet/home-desktop.html` are not active production routes.
- Because its path does not include `prototype`, `demo`, or `variant`, cleanup work must still treat it as a protected reference artifact.

Therefore, the inline `location.href` handlers inside `quiet/` must not be migrated under a general PR-C cleanup task.

## Why Kimi/Gemini variants are excluded

The same reference index classifies these as prototype / design variant / historical UI exploration paths:

- `pages/kimi-v2/`
- `pages/gemini-v2/`
- `pages/gemini-v3/`

These are not active production source-of-truth routes and must not be modified by the PR-C migration queue.

## Security interpretation

The remaining non-production inline handlers should not be treated as active DOM XSS remediation targets because:

1. They are not current production route sources of truth.
2. They are protected reference artifacts.
3. The observed handlers are primarily static navigation handlers such as `location.href = '...'`, not user-controlled data sinks.
4. Editing these files would violate the project rule to avoid PR #7 / prototype / reference / demo / variant path changes.

## PR-C status after this audit

| Item | Status |
| --- | --- |
| Active Settings logout inline handler | Migrated in PR #1222 |
| Remaining active production inline `onclick` candidate | None selected from this audit pass |
| Reference/prototype/variant inline handlers | Leave untouched |
| Further PR-C runtime migrations | Only if a new active production route candidate is found |

## Recommended next action

Proceed to PR-D: CSP readiness hardening, or perform a broader active-production-only event-handler audit that explicitly excludes protected reference/variant paths.

If a future PR-C migration is opened, it should:

- name the exact active production route
- exclude protected reference paths
- avoid broad rewrite
- include browser smoke requirements
- avoid issue close keywords

## Verification scope for this PR

This is a docs-only audit. Required checks:

- changed files limited to this document
- no JS/CSS/HTML runtime change
- no backend/API/schema/Auth/DB change
- no PR #7 / prototype / reference / demo / variant file change
- CI green

Refs #1203
