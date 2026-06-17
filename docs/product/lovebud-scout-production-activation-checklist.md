# LoveBud Scout Production Activation Checklist

**Issue context:**
- Work issue: #2634
- Parent product issue: #1882
- Keeps #1882 open.

## Status Lock

This checklist documents production activation blockers only. It does not enable production, set production configuration, or approve live provider use.

- This is a checklist-only document.
- Completing every row does not automatically activate production.
- Production activation requires a separate approval record after this checklist is complete.
- Normal CI remains network-free.
- Frontend/browser code must not call a provider directly.
- Only placeholder values are allowed in this document.
- Do not record secret values, bearer token values, original prompt text, original excerpt text, original source URL text, or raw provider response text.

## Production Activation Blocker Checklist

| Gate | Required evidence | Status | Evidence link / note |
| --- | --- | --- | --- |
| Staging smoke report attached or referenced | Sanitized staging smoke report is linked or attached | pending / ready / blocked |  |
| Secret rotation policy confirmed | Rotation owner, cadence, and incident process are documented | pending / ready / blocked |  |
| Cost/quota guard confirmed | Quota limits, abuse monitoring, and escalation path are documented | pending / ready / blocked |  |
| Auth boundary production-ready | Auth verification is implemented, tested, and reviewed for production | pending / ready / blocked |  |
| Rate-limit persistence production-ready | Persistent rate-limit storage is implemented, tested, and reviewed | pending / ready / blocked |  |
| Monitoring and alerting configured | Sanitized metrics, logs, and alerts are configured | pending / ready / blocked |  |
| Rollback/kill switch tested | Rollback and kill switch drill passed in staging | pending / ready / blocked |  |
| No frontend provider call | Browser/frontend code does not call provider APIs directly | pending / ready / blocked |  |
| No normal CI provider call | Normal CI does not call providers or external networks for Scout | pending / ready / blocked |  |
| No raw provider response exposure | Raw provider response text is not exposed in UI, logs, reports, or commits | pending / ready / blocked |  |
| No prompt/excerpt/sourceUrl/API key/token leak | Prompt text, excerpt text, source URL text, API key values, and token values are absent from reports and commits | pending / ready / blocked |  |
| CTO/operator sign-off | CTO or delegated operator approves production review separately | pending / ready / blocked |  |

## Blocking Rules

Production activation is blocked unless all checklist rows are `ready`, every evidence link is sanitized, and a separate production approval is recorded.

- `ready` describes checklist status only. It is not an activation command.
- A missing staging smoke report blocks production review.
- A missing secret rotation policy blocks production review.
- A missing cost/quota guard blocks production review.
- A missing rollback/kill switch test blocks production review.
- Any leaked secret value, bearer token value, prompt text, excerpt text, source URL text, or raw provider response blocks production review.

## Evidence Rules

| Evidence type | Allowed | Forbidden |
| --- | --- | --- |
| Secret status | present / missing / rotated / pending | secret values |
| Bearer token status | present / missing / rotated / pending | token values |
| Provider response evidence | status, error code, latency bucket, request id header | raw provider response text |
| User content evidence | sanitized count, hash label, or absence note | prompt text, excerpt text, source URL text |
| Production approval | separate approval link | automatic approval from checklist completion |

## Sign-off Fields

| Role | Name | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Operator |  |  | pending / ready / blocked |  |
| Engineering reviewer |  |  | pending / ready / blocked |  |
| Security/privacy reviewer |  |  | pending / ready / blocked |  |
| CTO / delegated approver |  |  | pending / ready / blocked |  |
