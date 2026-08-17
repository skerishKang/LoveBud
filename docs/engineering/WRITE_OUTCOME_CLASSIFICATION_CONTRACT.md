# Write Outcome Classification Contract (#4080)

Parent: #3461 — Reliability & Observability. Keep OPEN.

Status: `C2_WRITE_OUTCOME_CLASSIFICATION_SOURCE_COMPLETE` (source authority only).

## Purpose

Close the #3457-style silent-persistence detection gap by defining
provider-neutral write-boundary outcome categories and a canonical reread
contract, **without changing user-visible write behavior**.

This child defines/classifies only. It introduces **no telemetry sink, no
scheduled runner, no provider binding, and no Production DB mutation**.

## Stage distinction (immutable ordering)

The five write-boundary stages are kept strictly distinct, in this order:

1. `REQUEST_ACCEPTED` — the write request reached/accepted a boundary.
2. `DB_TRANSACTION_COMMITTED` — the DB transaction committed.
3. `CANONICAL_ROW_RETURNED` — the committed write returned a canonical row.
4. `FOLLOWUP_REREAD_VISIBLE` — a follow-up canonical reread sees the row.
5. `CLIENT_VISIBLE_SUCCESS` — the client observed the confirmed write.

**Invariant:** `WRITE_ACKNOWLEDGED != CANONICAL_REREAD_CONFIRMED`.
A server 2xx / accepted acknowledgement is NEVER equivalent to a canonical
reread confirmation. This is encoded as the constant
`WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED = false` in both authorities.

## Bounded outcome vocabulary

Reused from #3835/#3852/#3855 (by value, not duplicated):

- `CONFIRMED`
- `TRANSPORT_FAILED`
- `ACKNOWLEDGEMENT_MISSING`
- `ACKNOWLEDGED_REREAD_MISSING`
- `MONITORING_FAILED`
- `INSUFFICIENT_EVIDENCE`

Narrow server-side additions required by #4080:

- `WRITE_REJECTED_VALIDATION` — rejected before any DB side effect.
- `WRITE_COMMITTED_ROW_RETURNED` — committed + canonical row returned; reread not yet confirmed.
- `WRITE_COMMITTED_REREAD_MISSING` — committed + row returned; follow-up reread missing.
- `WRITE_COMMITTED_REREAD_MISMATCH` — committed + row returned; reread mismatch.
- `WRITE_STATUS_UNKNOWN` — commit state undecidable; **never retry blindly**.

No provider name appears anywhere in the vocabulary.

## Critical safety rule

Timeout / 503 / 504 where commit state is undecidable MUST classify as
`WRITE_STATUS_UNKNOWN` with `retry_safe=false`. An unknown write is never
blindly retried; reread/reconciliation is required before retry semantics.
This child coordinates with #4058/PR #4059 idempotency authority rather than
duplicating it.

## Source authorities

| Authority | Path | Role |
| --- | --- | --- |
| JS classifier core | `js/observability/reliability-write-outcome-classifier-core.js` | Pure frozen decision table over bounded facts. |
| Python classifier | `modal_compute/write_outcome_classification.py` | Pure `MappingProxyType` decision table, same vocabulary. |
| Edge-facts adapter | `functions/_shared/write-outcome-edge-facts.js` | Maps Cloudflare proxy-boundary observations to bounded facts. Not wired into live routes. |

All three are PURE SOURCE AUTHORITIES with zero capabilities. They never
execute a write, never retry, never reconcile, never persist, and never mutate
the user write path or any response status/body.

## Bounded facts record

The classifier consumes exactly these fields (unknown keys rejected):

Required:

- `transport` ∈ `ok | timeout | network_error | not_dispatched`
- `commit` ∈ `committed | rolled_back | not_reached | unknown`
- `returning` ∈ `row_returned | no_row | not_reached | unknown`
- `reread` ∈ `visible | missing | mismatch | not_attempted | unknown`

Optional:

- `validation_rejected` (boolean)
- `upstream_status_class` ∈ `success_2xx | client_error_4xx | server_error_5xx | unknown`
- `client_visible` (boolean)

## Canonical result record

`classifyWriteOutcome` / `classify_write_outcome` return exactly:

- `stage` — one of the five stages.
- `outcome_code` — one of the bounded outcome codes.
- `retry_safe` — boolean; always `false` for `WRITE_STATUS_UNKNOWN`.
- `evidence_completeness` ∈ `complete | partial | missing | invalid`.

## Authoritative bounded facts

`validation_rejected=true` is an AUTHORITATIVE BOUNDED FACT. It must be
supplied only by a source that actually observed the pre-DB validation
rejection. A 4xx upstream status alone is NEVER sufficient to infer a
validation rejection or that the DB was never reached, because the edge
cannot distinguish a rejection that happened before the DB from one that
happened after reaching it. The edge-facts adapter therefore never sets
`validation_rejected=true` from status alone, and never emits
`commit=not_reached` from a 4xx-only observation.

## Cross-field consistency (contradiction) validator

Individually valid enum values that cannot all be true at once are rejected
fail-closed as `CONTRADICTORY_FACTS`. Only present, enum-valid fields
participate. Conservative set (a statement may execute, return a row, and
still be rolled back afterwards — rollback-on-mismatch checks the RETURNING
row before commit — so `returning=row_returned` is NOT contradictory with
`rolled_back`):

- `transport=not_dispatched` with any executed/committed evidence
  (`commit=committed`, `returning=row_returned/no_row`, `reread=visible`);
- `commit=not_reached` with executed evidence
  (`returning=row_returned/no_row`, `reread=visible`);
- `commit=rolled_back` with `reread=visible` (a rolled-back write's row
  cannot be canonically visible);
- `reread=visible` without a returned row (`returning=not_reached/no_row`);
- `validation_rejected=true` with `commit=committed`;
- `client_visible=true` without `reread=visible`.

## Privacy invariants

No emitted result or accepted fact may contain tokens, email/UID,
owner/tree/memory IDs, title/content, URL, payload, SQL, raw DB error,
connection/provider identity, or secret/config values. Private keys are
rejected on input; results carry only the four bounded fields.

## Deterministic decision rules (first match wins)

1. `validation_rejected=true` (authoritative) → `WRITE_REJECTED_VALIDATION` @ `REQUEST_ACCEPTED`.
2. `transport=not_dispatched` → `ACKNOWLEDGEMENT_MISSING` @ `REQUEST_ACCEPTED`.
3. `transport=timeout` ∧ `commit=unknown` → `WRITE_STATUS_UNKNOWN` (retry_safe=false).
4. transport failed ∧ commit ∈ {rolled_back, not_reached} → `TRANSPORT_FAILED`.
5. `transport=network_error` ∧ `commit=unknown` → `WRITE_STATUS_UNKNOWN` (retry_safe=false).
6. `commit=unknown` → `WRITE_STATUS_UNKNOWN` (retry_safe=false).
7. commit ∈ {rolled_back, not_reached} → `ACKNOWLEDGEMENT_MISSING` (a 4xx status alone never infers `WRITE_REJECTED_VALIDATION`; that requires the authoritative `validation_rejected=true` fact in Rule 1).
8. `commit=committed`:
   - `returning=row_returned` ∧ `reread=visible` → `CONFIRMED` @ `FOLLOWUP_REREAD_VISIBLE` (or `CLIENT_VISIBLE_SUCCESS` when `client_visible`).
   - `returning=row_returned` ∧ `reread=missing` → `WRITE_COMMITTED_REREAD_MISSING`.
   - `returning=row_returned` ∧ `reread=mismatch` → `WRITE_COMMITTED_REREAD_MISMATCH`.
   - `returning=row_returned` ∧ reread not confirmed → `WRITE_COMMITTED_ROW_RETURNED`.
   - `returning=no_row` → `ACKNOWLEDGED_REREAD_MISSING`.
   - `returning` absent → `INSUFFICIENT_EVIDENCE`.

## Coordination and non-goals

- Does NOT modify #3852/#3855 client convergence behavior.
- Does NOT require raw error logging.
- Does NOT introduce retry-on-unknown semantics without proven
  idempotency/reconciliation authority (#4058/PR #4059).
- The disposable PostgreSQL commit/reread-divergence rehearsal is provided as
  a COLLISION-SAFE `EXECUTED_REAL_LOCAL` contract test under
  `tests/contracts/` (covered by the existing default-CI glob
  `tests/contracts/*.test.cjs`). It reuses the shared disposable harness and
  bounded-skips when no loopback `LB_TEST_PG*` Postgres is present, so it
  touches NO shared `package.json` / `ci.yml` / `tests/ci-test-group-registry.json`
  / `scripts/report-ci-test-groups.cjs` surface currently owned by open PR
  #4045 and concurrent layer-registry PRs.

## Refs

Refs #4080.
Refs #3461 — Keep OPEN.
Refs #3457.
Refs #3835.
Refs #3852.
Refs #3855.
Refs #4058.
Refs #1882 — Keep OPEN.
