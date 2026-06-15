# Scout Live Execution Blocker Map

> Docs/contracts-only blocker map for #2522. This document maps the remaining blockers that prevent LoveBud Scout from moving from safe stub/local execution into real-live provider execution. It does not implement runtime provider, network, Firebase, storage, or endpoint behavior.

## Status

- Refs: #2522, #1882
- Parent: #1882 — Explore LoveBud Scout link-based fan assistant MVP
- Scope: docs/contracts-only blocker map
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Frontend UI implementation: none
- Scout/live AI/provider/fetch/network work: none
- Browse/Search social-count changes: none

## Parent Context

#1882 is the Scout MVP umbrella. The safe exploration and contract boundary track is substantially complete: endpoint scaffolding, safe-fail adapter boundaries, disabled live execution, auth/rate-limit policy docs, mock execution contracts, and observability/readiness gates have been documented and partially implemented in non-live-safe modes.

#1882 remains open because real-live Scout execution still has unresolved blockers. This blocker map keeps the umbrella open until those blockers are either satisfied or explicitly marked not-planned.

## Current Safe Defaults

The current Scout live path must remain safely disabled by default:

| Default | Required state |
|---|---|
| Endpoint default | `stub` |
| Frontend default | `local_stub` |
| Endpoint client | disabled for live execution |
| Provider execution | no live provider execution |
| Staging/production live | no `staging_live` or `production_live` execution |
| Browse/Search | no #1661 / Browse/Search work included |

These defaults are the baseline safety contract. Any future slice that changes these defaults must first close the relevant blocker and add explicit runtime/operations verification.

## Remaining Blockers

| Blocker | Category | Why it blocks live |
|---|---|---|
| runtime Firebase auth enforcement | safety/security gate | Live endpoint execution needs real authenticated request enforcement before provider calls are allowed |
| persistent rate-limit storage | safety/security gate | Live provider calls require durable rate-limit state that survives serverless restarts |
| runtime cost/quota monitor | operations gate | Live provider usage must be monitored against cost and quota limits before production exposure |
| runtime abuse reporting | operations gate | Live execution needs an abuse reporting path for misuse, quota pressure, and safety incidents |
| provider-specific real adapter | runtime gate | Stub/mock adapters are insufficient for real provider behavior, errors, retries, and cost accounting |
| live integration test harness | runtime gate | Live execution needs a controlled integration harness with mockable boundaries and safe rollback |
| staging soak | operations gate | Live behavior must be soaked in staging before production exposure |
| kill-switch drill | safety/security gate | Operators must verify they can disable live Scout execution quickly |
| credential rotation drill | safety/security gate | Provider credentials must be rotatable without live execution outage or credential leakage |

## Blocker Classification

| Category | Meaning |
|---|---|
| product gate | Product-level decision required before live behavior can be enabled |
| runtime gate | Code/runtime capability must be implemented and verified |
| operations gate | Operational process, monitoring, or soak verification must be ready |
| safety/security gate | Security, abuse, kill-switch, or credential safety must be proven before live execution |

The current blocker list contains no product gate blockers because the product decision to explore Scout live execution is already captured by #1882. The remaining blockers are runtime, operations, and safety/security gates.

## Safe Next Slices

Recommended next slices must stay scoped and should not implement live provider execution until blockers are closed:

1. docs-only blocker map — current slice.
2. runtime Firebase auth implementation issue, later.
3. persistent rate-limit storage issue, later.
4. cost/quota monitor issue, later.
5. abuse reporting issue, later.
6. provider adapter issue, later.
7. live integration harness issue, later.
8. staging soak / kill-switch / credential rotation drill issues, later.

Runtime implementation slices must be separate follow-up issues. This document only maps the blockers and safe next slices.

## Closure Policy

#2522 may close when this blocker map and its companion contract test are merged. The closure is documentation-only: it confirms the blocker inventory, categories, safe defaults, and next-slice boundaries.

#1882 must remain open until all real-live blockers are satisfied or an explicit not-planned decision is made. Closing #2522 does not authorize live provider execution.

## NO-GO Guardrails

This slice must not:

- add runtime/provider/network/Firebase/storage implementation;
- add external provider calls;
- change the endpoint default from `stub`;
- enable frontend live endpoint execution;
- add DB/API/schema changes;
- change Browse/Search or #1661 behavior;
- move Scout into `staging_live` or `production_live` execution.

## Implementation Gate

No future live Scout execution slice may proceed until the relevant blocker category is closed and the runtime/operations/safety verification is documented in a separate follow-up issue.
