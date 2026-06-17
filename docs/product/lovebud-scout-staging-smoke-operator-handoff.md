# LoveBud Scout Staging Smoke Operator Handoff

Refs #1882
Refs #2636

## Purpose

This handoff helps an operator run the real Scout staging smoke for #2636 without treating any local simulated report as completion evidence.

## Current status

- #2636 remains open until the real Cloudflare staging run is completed and recorded.
- #1882 remains open as the parent product issue.
- Production activation remains blocked.
- The existing 2026-06-18 report is local simulated evidence only.

## Required operator inputs

Record only presence/status, not values.

| Item | Status |
| --- | --- |
| Staging deployment URL/build identifier available | yes / no / not checked |
| Required staging configuration present | yes / no / not checked |
| Provider credential configured in the platform only | yes / no / not checked |
| Operator access credential available to the operator | yes / no / not checked |
| Report template available | yes / no / not checked |
| Rollback/kill switch path available | yes / no / not checked |

## Run order

1. Confirm this run targets staging only.
2. Confirm production activation is not part of the run.
3. Use the runbook at `docs/product/lovebud-scout-staging-api-key-smoke-runbook.md`.
4. Record results using `docs/product/lovebud-scout-staging-smoke-report-template.md`.
5. Capture only sanitized status, error-code, request-id, latency bucket, and pass/fail notes.
6. Record the rollback or kill-switch drill result.
7. Choose one final decision: pass, fail, retry, or rollback.

## Required scenarios

| Scenario | Required result |
| --- | --- |
| success-short-public-text | sanitized success evidence only |
| missing-auth | safe unauthorized result |
| invalid-auth | safe unauthorized result |
| rate-limit | safe rate-limited result if safe to trigger |
| missing-config | safe unavailable result if safe to test |
| provider-down | safe provider-boundary result if safe to test |
| kill-switch | provider path disabled or bypassed as intended |

## Do not record

- Credential values.
- Full request or response bodies.
- Model prompt text.
- User excerpt text.
- Source link text.
- Provider raw output.
- Platform environment values.
- Production configuration values.

## Completion rule

#2636 may close only after a sanitized real staging report is attached or committed and reviewed.

A local simulated report alone must not close #2636.
