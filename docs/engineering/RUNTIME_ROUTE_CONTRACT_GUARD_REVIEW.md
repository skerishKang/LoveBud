# Runtime Route Contract Guard Review

> **Status:** AUDIT_ONLY
> **Source:** Issue #119
> **Type:** Docs-only — no tests, runtime behavior, route mapping, code, config, or deploy changes

---

## 1. Purpose

This document records the runtime route contract guard review for Issue #119.

The purpose is to establish an audit baseline for active route ownership and `tests/contracts` coverage before any route behavior, routing layer, runtime mapping, deployment config, or legacy layer changes are proposed.

This PR is documentation only. It does not modify contract tests, runtime code, route mappings, deploy/config files, or browser API behavior.

---

## 2. Active Route Ownership Baseline

Current active browser contract:

- Browser code calls same-origin `/api/*`.
- The active browser-facing router is `functions/api/[[path]].js` under Cloudflare Pages Functions.
- The compute target behind active routes is Modal.
- Modal uses Neon for persisted data where applicable.

Runtime ownership rule:

| Layer | Current role |
|---|---|
| Browser | Calls same-origin `/api/*` only |
| Cloudflare Pages | Official frontend and same-origin API entry |
| `functions/api/[[path]].js` | Active route owner / browser-facing router |
| Modal | Active compute target |
| Neon | Active persistence target |
| Vercel | Deprecated transitional fallback, not first-class production target |
| Netlify | Legacy references only after residual artifact cleanup, not first-class production target |

Netlify and Vercel references should be reviewed as historical or transitional documentation unless an explicitly approved current runtime task says otherwise.

---

## 3. Routes to Audit

The following routes should be covered by contract review before any route behavior changes:

| Route | Access class | Expected ownership question |
|---|---|---|
| `/api/community/trees?view=summary` | public | Does Cloudflare route forward to the active Modal browse summary path? |
| `/api/community/growing-trees` | public | Is growing-tree data served through the active same-origin route? |
| `/api/community/memories` | public / public tree scoped | Is public memory listing behavior covered? |
| `/api/trees` | protected for private/user data | Is auth-required behavior preserved? |
| `/api/memories` | protected for private/user data | Is auth-required behavior preserved? |
| `/api/trees/:id` | mixed depending visibility/ownership | Is public/private behavior and forwarding covered? |
| `/api/memories/:id` | protected or scoped | Is detail/update/delete behavior guarded? |

The route audit should distinguish public browse/detail flows from protected owner flows.

---

## 4. Contract Test Checklist

Future `tests/contracts` review should confirm whether contract tests cover:

- active route to Modal forwarding;
- unsupported route failure behavior;
- auth-required route behavior;
- public route behavior;
- same-origin path consistency;
- public community route availability;
- protected owner route gating;
- route method handling where applicable;
- no accidental browser direct-to-Modal or browser direct-to-database contract;
- no stale Netlify/Vercel-first assumptions.

Recommended route guard questions:

1. Does each active browser route resolve through `functions/api/[[path]].js`?
2. Does each active route forward to the intended Modal endpoint?
3. Do unsupported routes fail predictably?
4. Do auth-required routes preserve 401/403 behavior?
5. Do public routes remain accessible without auth?
6. Does the browser client continue to use same-origin `/api/*` paths?

---

## 5. Docs Consistency Checklist

Before runtime route behavior changes, verify consistency across:

- `docs/ops/RUNBOOK.md`
- `docs/ops/DEPLOY_CHECKLIST.md`
- `docs/ops/ENV_DEPENDENCY.md`
- `docs/engineering/API_CONTRACT.md`
- `js/postgres-client.js` routing comments
- Netlify references
- Vercel references

Docs review should check:

- Cloudflare Pages + Modal remains the active runtime statement.
- Browser contract remains same-origin `/api/*`.
- Netlify is not described as an active fallback or new backend policy target.
- Vercel is described only as deprecated transitional fallback where applicable.
- `js/postgres-client.js` comments do not imply browser direct-to-database access.
- API contract docs match actual public/protected route ownership.

This PR does not update those files. It only records the checklist.

---

## 6. Production-Equivalent Validation Requirements

Any future test/runtime/route/config implementation must be validated against a production-equivalent target.

Required target:

- Cloudflare Pages Preview; or
- CTO-assigned fixed test slot.

Validation should include:

- Modal route availability;
- browser same-origin `/api/*` behavior;
- Search/Browse data load;
- Detail data load;
- protected My Trees flow where applicable;
- protected Editor flow where applicable;
- 401/403 behavior for auth-required routes;
- unsupported route failure behavior;
- no accidental production data mutation;
- no fatal browser console errors for affected pages.

Local static server checks are not sufficient for final PASS on API/data/Auth route behavior.

---

## 7. Follow-up PR Split

Recommended staged split:

| PR | Scope | Notes |
|---|---|---|
| PR A | Contract guard review doc | This PR |
| PR B | `tests/contracts` update if gaps are found | Test-only unless explicitly approved otherwise |
| PR C | Docs stale reference cleanup | Docs-only; no route behavior change |
| PR D | Route behavior change | Separate approval required |
| PR E | Legacy layer deletion/deprecation | Separate approval required after validation |

Do not combine tests, docs cleanup, runtime route changes, and legacy layer deletion into one PR.

---

## 8. Guardrails

- Do not modify `tests/contracts/**` in this PR.
- Do not modify `functions/api/[[path]].js` in this PR.
- Do not modify `modal_compute/**` in this PR.
- Do not modify Netlify/Vercel runtime/config artifacts in this PR.
- Do not modify `js/postgres-client.js` in this PR.
- Do not modify existing ops/API docs in this PR.
- Do not change route mappings.
- Do not change runtime/API/Auth behavior.
- Do not change deploy/config/env files.
- Do not modify PR #7 or prototype/reference/demo/variant paths.
- Do not close Issue #119 from this audit-only work.

---

## 9. Next Recommended PR

The next safest follow-up is a test-only `tests/contracts` coverage audit/update if gaps are found. Any runtime route behavior change should wait until the contract coverage and production-equivalent validation plan are explicit.

---

## Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/engineering/RUNTIME_ROUTE_CONTRACT_GUARD_REVIEW.md`.
- [ ] No test/runtime/route/config/code changes.
- [ ] Issue #119 remains open.
- [ ] No close keywords for Issue #119.

---

## Related

Refs #119
