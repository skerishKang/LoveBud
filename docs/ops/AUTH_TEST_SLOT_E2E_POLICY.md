# Auth Test Slot E2E Policy

> **Status:** OPTIONAL / CURRENTLY UNAVAILABLE AS A REQUIRED GATE
>
> 이 절차는 환경이 실제로 사용 가능하고 CTO가 명시적으로 지정한
> 경우에만 사용합니다. 해당 환경의 부재는 merge blocker가 아닙니다.
> 자세한 내용은 `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`를 참고하세요.

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