# Verification Target Classification and Provenance

Issue: follow-up from PR #537 verification target contamination; de-escalated by Issue #3448.

This document classifies browser/runtime verification targets for LoveBud by
**what each target can prove**, given its provenance. It is docs/process-only
and does not authorize runtime, deployment, workflow, package, API, or
infrastructure changes.

**Blocker/permission authority:** The canonical source of truth for agent /
development / browser blocker and approval judgments is
`docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment
`4947327550`). This document is evidence-depth guidance; it is **not** itself a
repo-wide permission gate. A target's provenance determines *claim strength*,
not whether unrelated work may proceed.

## Purpose

A PR #537 browser verification attempt used a `lovebudold.netlify.app` URL and
reported the result as a fixed test slot verification. That target cannot prove
the current Cloudflare + Modal runtime posture. This document prevents
recurrence by making target classification and provenance explicit, while
de-escalating automatic-blocker language: an evidence limit lowers a claim's
status, it does not make the whole task `BLOCKED`.

## Active runtime posture

The active runtime path is:

```text
Browser -> same-origin /api/* -> Cloudflare Pages Functions -> Modal -> Neon
```

Active browser-facing deployment targets must therefore be Cloudflare Pages
URLs unless the CTO explicitly requests a production-only observation.

## Target classification and provenance

| Target class | Allowed? | What it can prove | Claim-status limit |
| --- | --- | --- | --- |
| Production (post-merge) | Yes (observation) | The currently deployed production state. | Cannot by itself prove an unmerged branch. |
| Cloudflare PR Preview | Yes | Rendered/static behavior for the deployed preview SHA. | Auth/API/domain-sensitive proof strength depends on actual preview wiring. |
| Cloudflare Branch Preview | Yes (when expected SHA provenance is known) | Branch preview behavior for the reported commit. | Unknown provenance lowers claim status. |
| Fixed test slot | Yes (evidence option) | Runtime/API/Auth/domain-sensitive behavior after explicit assignment and SHA match. | Missing assignment does not block unrelated work. |
| Local static server | Yes (development observation) | Local UI/layout behavior. | Claim strength is limited for production/Auth/API/data-loaded behavior. |
| Netlify / `lovebudold` | Invalid for active-runtime proof | Only legacy/artifact investigation when explicitly scoped. | Must not be presented as current-runtime proof. |
| Vercel / other hosts | Not verified for active runtime | May be observed only when explicitly scoped. | `NOT_VERIFIED_FOR_ACTIVE_RUNTIME` / `INVALID_FOR_TARGET_CLAIM`. |

### Production

Allowed observation environment. Can prove the currently deployed production
state. Cannot by itself prove an unmerged branch. Production is an environment,
not a banned target; it is allowed by default under `MVP_AGENT_GOVERNANCE.md`.

### PR Preview

Allowed. Can prove rendered/static behavior for the deployed preview SHA.
Auth/API/domain-sensitive proof strength depends on the actual preview wiring.
Being a PR Preview is not, by itself, a blocker.

### Branch Preview

Allowed when expected SHA provenance is known.

### Fixed slot

Allowed evidence option. Explicit assignment and SHA match strengthen a
fixed-slot-specific claim. Missing assignment does not block unrelated work;
report `FIXED_SLOT_NOT_ASSIGNED` / `NOT_VERIFIED_ON_FIXED_SLOT` / `PARTIAL` for
the fixed-slot-specific claim.

### Localhost

Allowed development observation. Claim strength is limited for
production/Auth/API/data-loaded behavior. It is an environment, not a banned
target.

### Netlify / `lovebudold`

Invalid for proving the current Cloudflare + Modal active runtime. May still be
observed only for legacy/artifact investigation when explicitly scoped. Must not
be presented as current-runtime proof. Report `INVALID_FOR_TARGET_CLAIM` for an
active-runtime claim made on Netlify/lovebudold.

### Vercel / other hosts

Not verified for the active runtime. Handle as
`NOT_VERIFIED_FOR_ACTIVE_RUNTIME` or `INVALID_FOR_TARGET_CLAIM`. Absence of a
CTO assignment on another host does not by itself make the whole project
`BLOCKED`.

### SHA mismatch / unknown provenance

Lower the claim status to one of:

- `NOT_VERIFIED`
- `INVALID_FOR_TARGET_CLAIM`
- `PARTIAL`

This is an evidence-limit result, not a project-wide `BLOCKED`.

## Canonical blocker authority

This document does **not** take precedence over other governance documents, and
it is **not** itself the blocker/permission authority. The canonical blocker
and approval authority is:

```text
Blocker/permission authority: docs/ops/MVP_AGENT_GOVERNANCE.md
```

If another document appears to allow Netlify, Vercel, an old deployment, or an
unassigned URL as final active-runtime proof, the evidence-quality guidance
here still applies, but any normative blocker/permission judgment defers to
`MVP_AGENT_GOVERNANCE.md`.

## Hard stop rule (slot infra / security only)

If a verifier sees a target that is a Netlify/`lovebudold` URL used as
current-runtime proof, they should report:

```text
Claim status: INVALID_FOR_TARGET_CLAIM
Reason: Netlify/lovebudold does not prove Cloudflare + Modal active runtime.
```

This stops only the *claim on that target*, not the whole task. CI red/pending
or expected-head mismatch remains a canonical merge hard rule under
`MVP_AGENT_GOVERNANCE.md` and is handled separately.

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

A label such as `test7` is not enough. The URL must be the matching Cloudflare
Pages domain. Any `test7` assignment that resolves to Netlify or another host is
invalid for the active runtime.

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
8. Claim status (when host not allowed or SHA unconfirmed):
   NOT_VERIFIED / INVALID_FOR_TARGET_CLAIM / PARTIAL / FIXED_SLOT_NOT_ASSIGNED / NOT_VERIFIED_ON_FIXED_SLOT
```

## Relationship to existing docs

Use this document together with:

- `docs/ops/TEST_PREVIEW_SLOTS.md`
- `docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md`
- `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`
- `docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md`

## Guardrails

- No code changes.
- No deployment changes.
- No slot branch updates.
- No workflow/package changes.
- No runtime/API/backend/Auth changes.
- No production mutation without separate approval.
- No secret/token/session/cookie/API key/private payload output.
- Prototype/reference/demo/variant folders are preserved only within their original named issue context (canonical preservation guidance in `docs/doc_index.md`); this is not an automatic blocker on other work.

Follow-up: Issue #3448 de-escalated the automatic-blocker language. Provenance
and SHA uncertainty now lower a claim's status (`NOT_VERIFIED` /
`INVALID_FOR_TARGET_CLAIM` / `PARTIAL`) instead of making the project `BLOCKED`.
The automatic `Ready transition: NO` / `Merge: NO` / `Issue close: NO` results
were removed; merge is governed only by canonical `MVP_AGENT_GOVERNANCE.md` hard
rules (CI red/pending, expected-head mismatch). Evidence-quality guidance
(provenance/SHA reporting, Netlify/lovebudold invalid-for-active-runtime,
secret/token/cookie protection, production write/delete approval) is preserved.

Refs #3448
Refs #3442
Refs #3445
Refs #3441
Refs #3437
Refs #3435
Refs #1882
