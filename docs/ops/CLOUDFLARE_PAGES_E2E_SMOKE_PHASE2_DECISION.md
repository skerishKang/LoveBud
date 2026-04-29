# Cloudflare Pages E2E Smoke Phase 2 Decision

## Purpose

This document records the Phase 2 decision path for replacing the removed Netlify dev E2E smoke flow after PR #108.

The decision is intentionally docs-only. It does not add GitHub Actions workflow changes, Playwright tests, package scripts, runtime behavior, Auth behavior, API behavior, or Modal behavior.

## Baseline

- PR #289 merged the docs-only Cloudflare Pages E2E smoke design for Issue #136.
- Cloudflare Pages + Modal is the verification direction.
- The current CI posture remains lint/build/test/verify focused.
- Fully automated E2E coverage is not currently established.
- Cloudflare PR Preview and fixed test slots are the preferred verification surfaces, but the mechanics for automated discovery and safe slot ownership still require staged validation.

## Decision Summary

Phase 2 should not begin with immediate full automated E2E.

The approved direction is a staged manual-to-semi-automated path:

1. Clarify manual gates and evidence requirements first.
2. Design a static public smoke script before adding workflow automation.
3. Experiment with Cloudflare PR Preview URL discovery before depending on it in CI.
4. Keep fixed test slots manually assigned until slot ownership and collision behavior are stable.
5. Keep auth/data-sensitive pages out of automated CI until QA credentials and slot policy are secure and repeatable.

This keeps verification aligned with Cloudflare Pages + Modal without reintroducing Netlify dev as a proxy for production behavior.

## Page Classification

| Class | Candidate paths | Verification posture |
| --- | --- | --- |
| Static/public candidates | `/`, `/intro.html` | First candidates for static smoke and future CI trial. |
| API/data candidates | `/search.html`, `/detail.html` with stable fixture only | Manual or semi-automated only until data fixtures and expected states are stable. |
| Auth/session candidates | `/my-trees.html`, `/editor.html`, `/settings.html` | Fixed-slot/manual until QA credentials and session handling are approved. |
| Modal-dependent candidates | browse/search and detail hydrate paths | Must verify Cloudflare Pages Functions to Modal behavior; avoid brittle CI until upstream stability and fixture policy are defined. |

## Proposed Phases

### Phase 2A: Docs/manual gate clarification

Document the exact manual evidence expected for PR Preview and fixed test slot verification.

Expected output:

- Verification checklist for public static pages.
- Verification checklist for API/data pages.
- Verification checklist for auth/session pages.
- Clear distinction between PR Preview and fixed test slot evidence.

No workflow or runtime change is included in this phase.

### Phase 2B: Static public smoke script design

Design a static-only smoke script that can target public pages without credentials or data dependencies.

Initial candidate paths:

- `/`
- `/intro.html`

Required properties:

- Accept a base URL override.
- Avoid secrets.
- Avoid login/auth requirements.
- Avoid API fixture assumptions.
- Report clear failure modes.

This phase may remain docs-only until the script shape is approved.

### Phase 2C: Cloudflare PR Preview URL discovery experiment

Validate how to reliably obtain the Cloudflare PR Preview URL in automation.

Questions to answer:

- Is the preview URL available from PR comments, deployment metadata, commit status, or Cloudflare API?
- How soon after PR creation is the URL available?
- What is the failure mode when preview deployment is delayed or absent?
- Can the workflow avoid printing secrets or internal deployment details?

No CI gate should depend on this until the source is proven reliable.

### Phase 2D: Optional CI workflow only after mechanics confirmed

Only after Phase 2B and 2C are confirmed should a small workflow be considered.

Allowed initial workflow target:

- Static/public smoke only.
- No auth/session pages.
- No fixed-slot mutation.
- No Modal-dependent assertions beyond page load for static pages.

### Phase 2E: Auth/data pages remain fixed-slot/manual until stable

Auth/data-sensitive pages stay out of automated CI until the following are stable:

- QA credential source.
- Fixed test slot ownership policy.
- Slot collision prevention.
- Cleanup/recovery behavior.
- Expected loaded/error/empty states.

Candidate pages for this deferred phase:

- `/my-trees.html`
- `/editor.html`
- `/settings.html`
- `/search.html`
- `/detail.html`

## Guardrails

- Do not restore Netlify dev as the E2E verification surface.
- Do not use the production domain as the PR pre-merge source of truth.
- Do not auto-overwrite fixed test slots from CI.
- Do not run auth/session tests without a secure QA credential source.
- Do not add broad runtime/API changes as part of smoke replacement.
- Do not modify Cloudflare Pages Functions, Modal backend, Auth, page JS, or page HTML in a decision/documentation PR.
- Do not print secrets, tokens, cookies, or credential-derived state in logs.
- Do not treat a passing static page smoke as proof that API/auth/data pages are safe.

## Acceptance Criteria for Future Implementation PRs

Any future implementation PR must satisfy the following before it can be treated as a merge candidate:

- Clear preview URL source is documented.
- Static-only smoke target list is explicit.
- No secrets are printed.
- Failure modes are documented.
- Manual fallback remains available.
- Changed files are restricted to the approved workflow/script/test scope for that phase.
- The PR clearly states whether it is static-only, API/data, auth/session, or Modal-dependent.

## Non-Goals

- No GitHub Actions workflow change in this PR.
- No Playwright test addition in this PR.
- No package script or dependency change in this PR.
- No Netlify dev restoration.
- No Auth/Login behavior change.
- No Cloudflare Pages Functions or Modal behavior change.
- No production-domain CI gate.

## Related

- Issue #136
- PR #108 removed the Netlify dev E2E smoke path.
- PR #289 merged the Phase 1 docs-only design baseline.

## Notes

Issue #136 remains open because actual workflow implementation, if approved, is still pending.
