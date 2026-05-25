# Legacy Deployment Artifact Audit

**Status:** Audit map
**Owner:** CTO / Ops
**Related issue:** #221
**Guardrail contract source:** `tests/contracts/runtime-boundary-guardrail-contract.test.cjs` (CI-enforced static checks documented in `docs/ops/LEGACY_RUNTIME_GUARDRAILS.md`)
**Scope:** docs-only audit; no runtime, routing, deployment, or config behavior changes

---

## 1. Purpose

This document records the legacy deployment artifact audit for LoveBud.

Issue #221 identified that LoveBud's active runtime is Cloudflare Pages + Modal, while historical deployment artifacts still existed or had recently existed in the repository. This document consolidates the current decision map so future agents do not infer runtime ownership from stale files.

This audit is descriptive. It does not authorize deletion, route changes, config changes, or deployment changes.

---

## 2. Active runtime source of truth

Current active runtime hierarchy:

```text
Browser
  -> same-origin /api/*
  -> Cloudflare Pages Functions
  -> Modal runtime
  -> Neon Postgres
```

Operational meaning:

- Cloudflare Pages is the active browser-facing runtime entry.
- Modal is the active backend/runtime target for API compute.
- Neon is the active database target.
- Netlify is not an active production fallback.
- Vercel is not an active production fallback.
- Legacy files must not be treated as active runtime owners without explicit current documentation.

---

## 3. Artifact classification table

| Artifact | Current classification | Runtime owner? | Action state | Notes |
|---|---|---:|---|---|
| `netlify.toml` | Legacy Netlify artifact | No | Removal/archival only after audit approval | Previously annotated as legacy; later cleanup PRs may remove it after decoupling tests/scripts |
| `netlify/functions/**` | Legacy Netlify Functions artifact | No | Removal/archival only after audit approval | Must not be used as active API source of truth |
| `vercel.json` | Deprecated transitional fallback artifact | No | Retain only with clear annotation or remove with CTO approval | Unknown-field annotation is acceptable if config remains valid JSON |
| `_redirects` | Cloudflare Pages static rewrite aliases / historical static routing aid | Partial static routing marker only | Keep unless explicit route-alias replacement is approved | Not an `/api/*` routing owner |
| `functions/api/**` | Active Cloudflare Pages Functions gateway | Yes | Keep active | Owns same-origin `/api/*` entry behavior |
| `modal_compute/**` | Active Modal runtime | Yes | Keep active | Owns Modal backend/API implementation |
| `docs/ops/DEPLOYED_ENTRY_MAP.md` | Runtime entry documentation | Documentation | Keep updated | Should reflect Cloudflare Pages + Modal current state |
| `docs/ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md` | Netlify-specific legacy artifact audit | Documentation | Keep as narrower audit | This document is broader than Netlify-only scope |

---

## 4. Follow-up PR map observed from #221

The #221 cleanup path has been handled across several smaller PRs. Future agents should treat these as a staged sequence rather than one large migration.

Relevant follow-ups:

```text
PR #256 — decouple route alias tests from netlify.toml
PR #259 — decouple scripts from netlify/functions paths
PR #260 — annotate vercel.json as deprecated transitional fallback
PR #271 — add _redirects ownership marker
PR #283 — remove Netlify legacy artifact candidates after approval
```

Interpretation:

- #221 was not a direct deletion approval.
- Test/script decoupling came before artifact removal.
- Vercel and `_redirects` annotations were handled separately.
- Netlify cleanup was staged and approval-gated.

---

## 5. Artifact-specific guidance

### 5.1 `netlify.toml`

Classification:

```text
legacy artifact / removal candidate
not active production fallback
```

Rules:

- Do not infer active runtime behavior from `netlify.toml`.
- Do not reintroduce tests that parse `netlify.toml` as route source of truth.
- If file exists, it should carry a clear legacy marker.
- If removed, ensure tests/scripts no longer depend on it.

### 5.2 `netlify/functions/**`

Classification:

```text
legacy Netlify Functions artifact
not active backend runtime
```

Rules:

- Do not use these files as active API contract source.
- Do not add new runtime behavior here.
- Do not write tests that require these files as active backend handlers.
- Removal requires prior decoupling of tests/scripts and CTO approval.

### 5.3 `vercel.json`

Classification:

```text
deprecated transitional fallback artifact
not active production fallback
```

Rules:

- If retained, annotate without changing behavior.
- Use valid JSON only.
- Do not assume Vercel deploy is a production fallback.
- Do not remove without confirming no docs/scripts/ops references still rely on it.

### 5.4 `_redirects`

Classification:

```text
static route alias / Cloudflare Pages rewrite marker
not an API routing owner
```

Rules:

- Do not treat `_redirects` as Netlify-only by default.
- Do not remove merely because Netlify is legacy.
- Do not use `_redirects` for active `/api/*` ownership.
- Any removal requires route alias coverage and browser route smoke.

### 5.5 `functions/api/**`

Classification:

```text
active Cloudflare Pages Functions gateway
```

Rules:

- This is the active same-origin `/api/*` entry layer.
- Route mapping tests should target this layer, not Netlify functions.
- Any change here may require fixed-slot/browser/API verification.

### 5.6 `modal_compute/**`

Classification:

```text
active Modal backend runtime
```

Rules:

- Modal owns backend logic, auth/ownership checks, visibility guards, DB access, and response handling where routed through `/api/*`.
- Modal runtime changes are not equivalent to static docs/config cleanup.
- Modal verification may require backend/runtime-specific validation.

---

## 6. Decision sequence for future cleanup

Use this sequence for any future deployment artifact cleanup:

```text
1. Identify active vs legacy owner.
2. Confirm all tests/scripts have been decoupled from the legacy artifact.
3. Confirm docs describe active Cloudflare Pages + Modal runtime accurately.
4. Annotate retained legacy files before considering removal.
5. If removal is proposed, require CTO approval.
6. Verify no route alias, package script, CI, or docs reference regresses.
7. Keep PR scope narrow: one artifact class per PR when possible.
```

---

## 7. Verification checklist for artifact PRs

For docs/config-only annotation PRs:

```text
Changed files limited to docs/config comments: YES / NO
Runtime route behavior changed: NO
functions/api changed: NO
modal_compute changed: NO
prototype/reference/demo/variant changed: NO
PR #7 touched: NO
JSON/config syntax valid when applicable: PASS / NOT_APPLICABLE
```

For test/script decoupling PRs:

```text
npm test: PASS / NOT_RUN
npm run lint: PASS / NOT_RUN
npm run verify: PASS / NOT_RUN
No active runtime path changed: YES / NO
No artifact deletion: YES / NO
```

For artifact removal PRs:

```text
CTO approval recorded: YES / NO
Decoupling PRs completed: YES / NO
Route alias coverage retained: YES / NO
Cloudflare active runtime unaffected: YES / NO
Modal runtime unaffected: YES / NO
No PR #7/prototype/reference/demo/variant changes: YES / NO
```

---

## 8. Non-goals

This audit does not authorize:

- deleting `netlify.toml`;
- deleting `netlify/functions/**`;
- deleting `vercel.json`;
- deleting `_redirects`;
- changing Cloudflare Pages routing;
- changing Modal backend behavior;
- changing `/api/*` path behavior;
- changing CI workflows;
- changing package scripts;
- changing PR #7 or prototype/reference/demo/variant paths.

---

## 9. Current disposition

This document satisfies the docs-only audit-map layer for #221.

Future work should update this document only when the artifact classification changes, not for every unrelated runtime or deployment PR.
