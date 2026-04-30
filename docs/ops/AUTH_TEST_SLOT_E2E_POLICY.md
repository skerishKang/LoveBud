# Auth Test Slot E2E Policy

## Purpose
- Track auth/test-account and fixed-slot E2E policy for #413.
- Document credential-safe handling and evidence rules.

## Relationship to #445
- Follow-up documentation for merged PR #445.

## Auth/Test-Account Handling
- Only owner-approved accounts
- No credential values exposed
- No token/cookie/session output

## Fixed Test Slot Assignment
- One slot per PR
- SHA provenance required
- Deployment URL provenance required

## Evidence Requirements
- PASS / FAIL / BLOCKED / NOT_VERIFIED separated
- No sensitive screenshots

## Cleanup Policy
- Track test data cleanup status
- No private content leakage

## Non-goals
- No workflow implementation
- No Playwright implementation
- No required checks

## Follow-up Split
- Workflow candidate later
- Page-specific smoke later