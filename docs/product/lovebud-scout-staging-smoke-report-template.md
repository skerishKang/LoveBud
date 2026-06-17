# LoveBud Scout Staging Smoke Report Template

**Issue context:**
- Work issue: #2634
- Parent product issue: #1882
- Keeps #1882 open.

## Scope

This template records evidence from a staging-only Scout smoke run. It is an operator-facing report template, not an approval artifact.

- Staging smoke evidence is a prerequisite for future production review.
- Staging smoke evidence does not automatically approve production activation.
- This document records status and evidence only. It must not record secret values or original user/provider content.
- Normal CI remains network-free.
- Frontend/browser code must not call a provider directly.
- Production activation remains blocked unless a separate production approval is granted.

## Smoke run metadata

| Field | Record |
| --- | --- |
| Report author |  |
| Review date |  |
| Smoke run date/time |  |
| Staging deployment URL |  |
| Build SHA / release label |  |
| Smoke scenario set version |  |
| Request id header observed |  |
| Production activation requested during this run? | No — staging smoke only |

Only record the request id header value. Do not record request body values, API key values, bearer token values, prompt text, excerpt text, source URL text, or raw provider response text.

## Staging environment snapshot

| Field | Record |
| --- | --- |
| Cloudflare Pages/Workers environment | staging |
| Provider mode expected for this smoke run | staging-only |
| Live adapter enabled? | yes / no / unknown |
| API-key transport selected? | yes / no / unknown |
| Production activation enabled? | No |
| Rollback path available? | yes / no / unknown |
| Operator notes |  |

## Env/secret presence checklist, names only, no values

Record presence or missing status only. Do not record values.

| Name | Presence/status | Evidence note |
| --- | --- | --- |
| `SCOUT_SUGGEST_PROVIDER_MODE` | present / missing / not checked |  |
| `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED` | present / missing / not checked |  |
| `SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE` | present / missing / not checked |  |
| `SCOUT_SUGGEST_PROVIDER_STAGE` | present / missing / not checked |  |
| `SCOUT_SUGGEST_LLM_PROVIDER` | present / missing / not checked |  |
| `SCOUT_SUGGEST_MODEL` | present / missing / not checked |  |
| `SCOUT_SUGGEST_LLM_API_KEY` | present / missing / not checked |  |
| `SCOUT_SUGGEST_LLM_BASE_URL` | present / missing / not checked |  |

## Request scenario list

| Scenario id | Purpose | Expected boundary | Actual status | Evidence note |
| --- | --- | --- | --- | --- |
| success-short-public-text | Success path with sanitized metadata only | 200 + sanitized suggestion | pass / fail / retry |  |
| missing-auth | Auth boundary | safe-fail unauthorized | pass / fail / retry |  |
| invalid-auth | Auth boundary | safe-fail unauthorized | pass / fail / retry |  |
| rate-limit | Rate-limit boundary | safe-fail rate limited | pass / fail / retry |  |
| missing-config | Config boundary | safe-fail config missing | pass / fail / retry |  |
| provider-down | Provider/network boundary | safe-fail provider error | pass / fail / retry |  |

Do not paste prompt text, excerpt text, source URL text, API key values, bearer token values, or raw provider response text in this table.

## Success response verification

| Check | Required result | Actual result | Evidence note |
| --- | --- | --- | --- |
| Response status | 200 |  |  |
| Body `ok` | `true` |  |  |
| Body `providerMode` | staging/live-api-key smoke value only |  |  |
| Body `suggestion.content` | sanitized, no secrets, no raw provider output |  |  |
| Request id | returned in `x-lovebud-request-id` response header only |  |  |
| No body-level request id | absent |  |  |
| No API key value recorded | absent |  |  |
| No bearer token value recorded | absent |  |  |
| No raw provider response recorded | absent |  |  |

## Safe-fail response verification

| Scenario | Expected status code | Expected error code | Sanitized? | Evidence note |
| --- | --- | --- | --- | --- |
| missing-auth |  |  | yes / no |  |
| invalid-auth |  |  | yes / no |  |
| rate-limit |  |  | yes / no |  |
| missing-config |  |  | yes / no |  |
| provider-down |  |  | yes / no |  |

Safe-fail evidence may include status, error code, sanitized message, latency bucket, and request id header. It must not include raw provider response text, API key values, bearer token values, prompt text, excerpt text, or source URL text.

## Sanitized log/observability verification

| Check | Required result | Actual result | Evidence note |
| --- | --- | --- | --- |
| API key value absent from logs | absent |  |  |
| Bearer token value absent from logs | absent |  |  |
| Raw provider response absent from logs | absent |  |  |
| Prompt text absent from logs | absent |  |  |
| Excerpt text absent from logs | absent |  |  |
| Source URL text absent from logs | absent |  |  |
| Only sanitized metadata recorded | provider latency/status/error code/request id header |  |  |

## Kill switch drill result

| Check | Required result | Actual result | Evidence note |
| --- | --- | --- | --- |
| Kill switch path identified | documented |  |  |
| Kill switch drill performed | staging-only |  |  |
| Provider path disabled after drill | yes / no |  |  |
| Frontend/browser provider call remains disabled | yes / no |  |  |
| Normal CI provider/network call remains absent | yes / no |  |  |
| Rollback evidence captured without secret values | yes / no |  |  |

## Regression notes

| Area | Regression observed? | Evidence note | Follow-up |
| --- | --- | --- | --- |
| Scout endpoint behavior | yes / no |  |  |
| Staging-only guard | yes / no |  |  |
| Auth boundary | yes / no |  |  |
| Rate-limit boundary | yes / no |  |  |
| Privacy/no-leak behavior | yes / no |  |  |
| Frontend/browser behavior | yes / no |  |  |
| Normal CI behavior | yes / no |  |  |

## Decision: pass / fail / retry / rollback

| Decision field | Record |
| --- | --- |
| Decision | pass / fail / retry / rollback |
| Reason |  |
| Blockers |  |
| Retry steps |  |
| Rollback steps |  |
| Follow-up issue links |  |

A pass decision means the staging smoke report is complete and sanitized. It does not approve production activation.

## Sign-off fields

| Role | Name | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Operator |  |  | pass / fail |  |
| Engineering reviewer |  |  | pass / fail |  |
| Security/privacy reviewer |  |  | pass / fail |  |
| CTO / product owner |  |  | pass / fail |  |
