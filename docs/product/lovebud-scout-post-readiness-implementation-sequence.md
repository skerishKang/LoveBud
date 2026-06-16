# Scout Post-Readiness Implementation Sequence

**Status:** Transition plan, not runtime implementation.
**Parent:** #1882 (Scout MVP umbrella, kept open).
**Predecessor:** #2522 Scout live execution blocker map (completed as a map, not as runtime authorization).

## 1. Purpose

The nine readiness audits under #2522 are complete. This document turns that
completed readiness track into a safe implementation sequence. It does **not**
authorize live execution, staging soak, kill-switch drill, credential rotation
drill, or any provider-side runtime code change.

The goals of this slice are:

1. Lock the current completed-readiness state into a single place of truth.
2. Enumerate which runtime/operations gates are still real implementation work.
3. Recommend a safe implementation order for those gates.
4. Reaffirm the safe defaults that must remain disabled.
5. Guard against accidental `#1882` auto-closure via GitHub close keywords.

## 2. Completed readiness audits (read-only, no runtime change)

The following readiness audits are closed and remain read-only references:

- #2524 — runtime Firebase auth enforcement readiness
- #2526 — persistent rate-limit storage readiness
- #2528 — runtime cost/quota monitor readiness
- #2530 — runtime abuse reporting readiness
- #2538 — provider-specific real adapter readiness
- #2557 — live integration test harness readiness
- #2559 — staging soak readiness
- #2561 — kill-switch drill readiness
- #2563 — credential rotation drill readiness

Closing these issues means the readiness audit slice is complete. It does
**not** mean the underlying capability is implemented, deployed, exercised,
or authorized.

## 3. Gates still requiring future implementation

The following gates remain future implementation work and are not in scope
for this docs/contracts-only slice:

1. Runtime Firebase auth enforcement (in front of provider calls).
2. Persistent rate-limit storage (durable backend, not in-memory).
3. Runtime cost/quota monitor (per-tenant, per-provider, per-day).
4. Runtime abuse reporting (collect + escalate + archive trail).
5. Provider-specific real adapter (per-provider real client wrapper).
6. Live integration test harness (executes real adapter under auth/quota).
7. Staging soak (time-boxed live execution on staging).
8. Kill-switch drill (incident rehearsal for forced disable).
9. Credential rotation drill (rehearsal for secret replacement).

These are gates, not tasks for this slice.

## 4. Recommended implementation order

The recommended first runtime gate is **runtime Firebase auth enforcement**,
because every other gate depends on a known, authenticated caller. After that:

1. Runtime Firebase auth enforcement.
2. Persistent rate-limit storage.
3. Runtime cost/quota monitor.
4. Runtime abuse reporting.
5. Provider-specific real adapter (only after auth + rate-limit + cost are
   in place).
6. Live integration test harness (only after real adapter is in place).
7. Staging soak (only after live integration tests are stable).
8. Kill-switch drill (only after staging soak is stable).
9. Credential rotation drill (last, with the longest rehearsal cycle).

Reordering any of the above requires a new issue that explicitly justifies
the reordering and reaffirms that `#1882` stays open.

## 5. Safe defaults that must remain disabled

The following defaults are part of the lock-down and must remain unchanged
in this slice and every subsequent slice until a future issue explicitly
reverses them with proper guardrails:

- Endpoint default remains `stub`.
- Frontend default remains `local_stub`.
- Live endpoint client remains disabled.
- No `staging_live` execution is enabled.
- No `production_live` execution is enabled.
- No live provider execution is enabled.
- No provider credentials are read, used, rotated, or persisted.

## 6. Runtime non-goals for this slice

This slice adds none of the following:

- No provider SDK, fetch/network call, prompt construction, retry, timeout,
  streaming, model selection, credential access, cost accounting, or
  response parsing runtime code.
- No runtime Firebase auth behavior.
- No persistent storage writes.
- No DB/API/schema changes.
- No frontend runtime behavior changes.
- No Browse/Search/#1661 work.

## 7. GitHub auto-close keyword guard for #1882

`#1882` is the Scout MVP umbrella. It must remain open until every gate in
Section 3 is implemented, exercised, and signed off.

To prevent accidental auto-closure by GitHub close keywords:

- Future documents and PR bodies **must not** contain `closes #1882`,
  `fixes #1882`, `resolves #1882`, or any other GitHub close keyword
  referencing `#1882`.
- Future documents and PR bodies **must** include the phrase
  `keeps #1882 open` whenever they describe work that follows from this
  transition plan.
- Reviewers must reject any PR that accidentally introduces a `#1882` close
  keyword.

## 8. Acceptance criteria recap

- A docs-only transition plan is added in this file.
- A contract test verifies the completed readiness audit list and safe
  defaults.
- The plan recommends a safe implementation order after readiness audits.
- The plan explicitly guards against accidental `#1882` auto-closure
  wording.
- No runtime, network, Firebase, storage, provider SDK, credential,
  prompt, retry, timeout, streaming, or response parsing implementation
  is added.
- No DB/API/schema changes.
- No Browse/Search/#1661 work.

## 9. Closure policy

Closing this issue means the transition plan is merged. It does **not**
authorize runtime Firebase auth enforcement, persistent rate-limit storage,
cost/quota monitor, abuse reporting, real adapter, live integration
testing, staging soak, kill-switch drill, credential rotation drill,
staging_live, production_live, live execution, or provider credential
usage.
