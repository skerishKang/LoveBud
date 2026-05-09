# Verification Target Allowlist

Issue: follow-up from PR #537 verification target contamination

This document defines the allowed and invalid browser/runtime verification targets for LoveBud. It is docs/process-only and does not authorize runtime, deployment, workflow, package, API, or infrastructure changes.

## Purpose

A PR #537 browser verification attempt used a `lovebudold.netlify.app` URL and reported the result as a fixed test slot verification. That target is invalid for the current LoveBud runtime posture.

This document prevents recurrence by making the target allowlist explicit and by classifying Netlify/lovebudold URLs as invalid verification targets for active runtime work.

## Active runtime posture

The active runtime path is:

```text
Browser -> same-origin /api/* -> Cloudflare Pages Functions -> Modal -> Neon
```

Active browser-facing deployment targets must therefore be Cloudflare Pages URLs unless the CTO explicitly requests a production-only observation.

## Allowed verification targets

| Target class | Allowed URL pattern | Use |
| --- | --- | --- |
| Production after merge | `https://lovebud.pages.dev/` | Post-merge production observation only. Do not use for pre-merge final PASS. |
| Cloudflare PR Preview | `https://<hash>.lovebud.pages.dev/` | Preliminary or public/static checks when SHA provenance is clear. |
| Cloudflare Branch Preview | `https://<branch-slug>.lovebud.pages.dev/` | Branch preview checks when Cloudflare reports the expected commit. |
| Fixed test slot | `https://test1.lovebud.pages.dev/` through `https://test10.lovebud.pages.dev/` | Runtime/API/Auth/domain-sensitive verification after explicit assignment and SHA match. |
| Local static server | `http://localhost:*` or equivalent | Local-only development observation. Not valid final PASS for API/Auth/runtime/data-loaded flows. |

## Invalid verification targets

The following must not be used for active LoveBud PR verification:

| Invalid target | Reason | Required report status |
| --- | --- | --- |
| `*.netlify.app` | Netlify is legacy/fallback/artifact, not active runtime. | `INVALID_VERIFICATION_TARGET` or `BLOCKED` |
| `lovebudold.netlify.app` or Netlify deploy aliases | Old Netlify project does not prove Cloudflare + Modal runtime behavior. | `INVALID_VERIFICATION_TARGET` |
| Vercel URLs | Vercel is secondary/transitional unless explicitly scoped. | `BLOCKED` unless CTO explicitly assigned it |
| Any URL with deployed SHA mismatch | Does not prove the target PR. | `BLOCKED` |
| Any unassigned fixed slot URL | Slot provenance is unknown. | `BLOCKED` |
| Any URL chosen from local memory, bookmarks, previous tasks, or browser history | Source of truth not established. | `BLOCKED` |

## Hard stop rule

If a verifier sees any of the following, they must stop before browser claims:

- target URL is not on the allowlist;
- target is a Netlify or `lovebudold` URL;
- fixed slot assignment was not explicit;
- deployed SHA does not match the expected PR head SHA;
- the URL came from a local bookmark/history/old deployment rather than the task or GitHub/Cloudflare evidence.

The report must say:

```text
Final status: INVALID_VERIFICATION_TARGET
Reason: target URL is not an allowed Cloudflare Pages PR Preview, Branch Preview, fixed test slot, or approved production observation.
Ready transition: NO
Merge: NO
Issue close: NO
```

## Fixed slot domain rules

Fixed slot verification must use only these domains:

```text
https://test1.lovebud.pages.dev/
https://test2.lovebud.pages.dev/
https://test3.lovebud.pages.dev/
https://test4.lovebud.pages.dev/
https://test5.lovebud.pages.dev/
https://test6.lovebud.pages.dev/
https://test7.lovebud.pages.dev/
https://test8.lovebud.pages.dev/
https://test9.lovebud.pages.dev/
https://test10.lovebud.pages.dev/
```

A label such as `test7` is not enough. The URL must be the matching Cloudflare Pages domain. Any `test7` assignment that resolves to Netlify or another host is invalid.

## Required verification report fields

Every browser/runtime verification report must include:

```text
1. Verification target class:
2. URL:
3. URL host allowed: YES / NO
4. Fixed slot assignment explicit: YES / NO / NOT_APPLICABLE
5. Expected PR head SHA:
6. Deployed SHA:
7. SHA match: YES / NO / NOT_VERIFIED
8. If URL host allowed is NO: INVALID_VERIFICATION_TARGET and STOP
9. If SHA match is NO/NOT_VERIFIED for a required slot: BLOCKED and STOP
```

## Relationship to existing docs

Use this document together with:

- `docs/ops/TEST_PREVIEW_SLOTS.md`
- `docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md`
- `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`
- `docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md`
- `docs/ops/NETLIFY_VERCEL_LEGACY_ARTIFACT_AUDIT.md`

If another document appears to allow Netlify, Vercel, an old deployment, or an unassigned URL as final active-runtime proof, this allowlist takes precedence until the CTO records a newer source of truth.

## Guardrails

- No code changes.
- No deployment changes.
- No slot branch updates.
- No workflow/package changes.
- No runtime/API/backend/Auth changes.
- No production mutation.
- No secret/token/session/cookie/API key/private payload output.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
