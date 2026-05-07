# v0.1 UI Trust Pass Release Gate Status Contract

Status: active release-gate tracking contract
Scope: docs and contract only
Parent gate: #681

This document records the current release-gate tracking shape for the v0.1 UI Trust Pass. It is not an implementation plan and does not authorize runtime, UI, Auth, API, backend, database, deployment, package, workflow, or credential changes.

The purpose is to give reviewers and verification executors one stable place to classify active gate items without mixing unrelated PR queues.

## Status Taxonomy

Use these labels when reporting #681 child work:

| Label | Meaning |
| --- | --- |
| ACTIVE_REVERIFY_REQUIRED | A patch exists and the next required step is fixed-slot or runtime verification. |
| HOLD_CREDENTIAL_VERIFICATION | The patch remains on hold because credential-safe verification cannot currently complete. |
| OPEN_DRAFT_VERIFY_BEFORE_USE | A draft document or policy exists, but its merge status and current content must be verified before relying on it. |
| MERGED_OR_SUPERSEDED_VERIFY_FIRST | A prior related item may already be reflected elsewhere, but current repository state must be checked before using it as evidence. |

## Active Gate Items

| PR | Gate item | Current status | Required next check |
| --- | --- | --- | --- |
| #878 | Public detail owner identifier strip | ACTIVE_REVERIFY_REQUIRED | Fixed-slot public detail response and viewer reverify. |
| #880 | Private visibility controls | HOLD_CREDENTIAL_VERIFICATION | Credential-safe logged-in fixed-slot verification before readiness decisions. |
| #881 | Login and Settings auth consistency | ACTIVE_REVERIFY_REQUIRED | Fixed-slot logged-in Settings and Login redirect reverify. |
| #870 | Visible action readiness policy | OPEN_DRAFT_VERIFY_BEFORE_USE | Verify draft status and current content before treating the policy as a gate input. |

## Guardrails

- Do not mix #681 gate documentation with runtime implementation.
- Do not use this document as proof that browser verification passed.
- Do not use this document as deploy, ready, merge, or issue-status authority.
- Do not copy credential values, account values, tokens, sessions, cookies, raw payloads, database rows, or private identifiers into gate evidence.
- Do not modify `docs/ux/V01_VISIBLE_ACTION_READINESS_POLICY.md` from this release-gate tracking contract.
- Do not touch PR #7 or prototype/reference/demo/variant paths from this release-gate tracking contract.

## Verification Contract

Any PR that updates this document should verify:

- changed files remain docs/contract only;
- runtime JS/CSS/HTML/backend/Auth/API/DB/package/workflow files are unchanged;
- the status taxonomy labels remain present;
- #878, #880, #881, and #870 remain represented as explicit gate items;
- reports use status labels and issue references only, without private values.

Refs #681
