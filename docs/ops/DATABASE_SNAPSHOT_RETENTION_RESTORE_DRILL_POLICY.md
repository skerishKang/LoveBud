# Database Snapshot, Retention, and Restore-Drill Policy

> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Risk tiers:** `WORK_RISK_TIER_POLICY.md`
> **Secret safety:** `docs/ops/AGENTS.md` (Ops Agent Security Rules)
> **Migration ledger / provenance:** Issue #3458 and `db/migration-provenance/`
> **Motivating incidents:** Issue #3435 (schema drift), Issue #3437 (legacy tree entity loss)

**Status:** `PROPOSED_FUTURE_CONTRACT`. This is a source-only operating policy. It defines
what LoveBud requires from database recovery. It does **not** configure any provider,
create any snapshot/branch/restore, connect to any database, or mutate any environment.
Every capability claim is classified below. Where the current Neon project plan or
configuration cannot be verified without account access, the item is marked
`PROJECT_CONFIGURATION_UNVERIFIED` and the policy fails closed.

## Classification legend

| Label | Meaning |
|---|---|
| `REPOSITORY_CONFIRMED` | Verified directly in this repository (docs, scripts, contracts, Issue records). |
| `OFFICIAL_PROVIDER_CAPABILITY` | Documented by current official Neon documentation as a general Neon capability. Not a claim that it is enabled for this project. |
| `PROJECT_CONFIGURATION_UNVERIFIED` | Depends on the live Neon project plan/settings, which cannot be confirmed without account access. Treated as unknown; fail closed. |
| `PROPOSED_FUTURE_CONTRACT` | Policy selected here but not yet implemented or enforced. Requires separate approved work. |
| `NOT_AUTHORIZED` | Explicitly out of scope for this policy document and forbidden without separate explicit approval. |

## 0. Scope and explicit non-actions

This document only defines policy. It does **not** perform or authorize:

- Neon API, Dashboard, CLI, or account access;
- any database connection or SQL execution;
- creation of any snapshot, branch, backup, or restore;
- any Production or staging mutation;
- inspection of secrets, environment values, or credentials;
- any workflow, package, runtime, API, migration, or test change;
- storage of any backup artifact inside the repository;
- creation of any new Issue or change of any Issue state.

All of the above are `NOT_AUTHORIZED` here. Production restore always requires separate
explicit owner approval per `MVP_AGENT_GOVERNANCE.md` and is never automatic.

## 1. Purpose and authority boundary

### Problem this policy solves

`REPOSITORY_CONFIRMED`: The Production `trees` incident (Issue #3437) caused entity-row and
metadata loss; only a small number of `trees` rows survived while many dependent tree
identities remained orphaned in memories/social data. Issue #3460 records that recovery
depended on manual preservation, browser-cache inspection, and a snapshot created only
**after** the incident was discovered. Recovery capability must not depend on whether a
manual snapshot happened to exist.

`REPOSITORY_CONFIRMED`: The repository has migration and repair scripts and an in-progress
provenance track (`scripts/migration-provenance-core.cjs`, `db/migration-provenance/`), but
Issue #3458 states there is not yet an authoritative applied-migration ledger enforced
against Production, and Issue #3435 confirms there is no complete authoritative
`CREATE TABLE trees` migration or applied-migration ledger.

`REPOSITORY_CONFIRMED`: No repository script or CI job verifies database connectivity or
schema consistency against Production (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md`,
`docs/engineering/lovebud-changeability-production-parity-audit.md`). Neon database health is
observable only through provider dashboards, which are outside repository evidence boundaries
(`docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md`, `docs/ops/RELEASE_SHA_PUBLIC_EXPOSURE_DECISION.md`),
and such checks are classified `PROVIDER_MANUAL` (`docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md`).

### Source policy versus actual provider configuration

This policy states what LoveBud **requires**. It does not assert what the live Neon project
currently provides. The active runtime is Cloudflare Pages → same-origin `/api/*` →
Cloudflare Pages Functions → Modal → Neon (`REPOSITORY_CONFIRMED`, `docs/ops/ops_index.md`,
`docs/ops/ENV_DEPENDENCY.md`). The Modal `DATABASE_URL` is injected from the Modal secret
`lovebud-db` (`REPOSITORY_CONFIRMED`, `docs/ops/ENV_DEPENDENCY.md`). The phrase
"Neon Postgres snapshot read" in `ENV_DEPENDENCY.md` refers to read-path transaction
consistency, **not** to a backup snapshot; the repository has no backup/snapshot system
(`REPOSITORY_CONFIRMED`).

Whether the Neon project plan actually provides a sufficient history window, point-in-time
restore, branch limits, or any external backup job is `PROJECT_CONFIGURATION_UNVERIFIED`.
This policy therefore selects target values and fails closed wherever the live configuration
cannot be confirmed.

### Production restore authority

- Production restore is a destructive Production data operation. It requires separate
  explicit owner approval (`REPOSITORY_CONFIRMED`, `MVP_AGENT_GOVERNANCE.md`: destructive
  Production data deletion, destructive Production schema change, or Production
  security-policy change requires owner approval).
- There is **no automatic Production restore** and **no automatic branch reset**.
- A repository document does not create a new hard blocker or a new permission by itself
  (`MVP_AGENT_GOVERNANCE.md`); this policy defines requirements, not execution authority.

## 2. Explicit RPO and RTO

Values below are `PROPOSED_FUTURE_CONTRACT` policy selections. They are targets, not
guaranteed service levels, because no automated recovery system is implemented yet. Each
value carries a rationale and a fail-closed state used when the value cannot be met or
verified.

### RPO (Recovery Point Objective)

| Scenario | Selected RPO | Rationale | Fail-closed state |
|---|---|---|---|
| General user data | ≤ 24 hours | Aligns with the daily recovery-point tier and Neon's documented default history retention example (`history_retention_seconds` = 86400). The real window is `PROJECT_CONFIGURATION_UNVERIFIED`. | `RECOVERY_POINT_STALE` if the newest valid recovery point is older than 24h; `PROVIDER_CAPABILITY_UNVERIFIED` if the window cannot be confirmed. |
| Immediately before an approved schema/data mutation (Tier 3 or destructive) | ≈ 0 (a named recovery point created immediately before the change, age ≤ 1 hour, bound to the change identifier) | A risky change must have a dedicated, change-specific recovery point so the exact pre-change state is recoverable. | `RECOVERY_POINT_MISSING` if absent; `BLOCKED_BY_RECOVERY_GATE` if not change-bound or not confirmed created. |
| Major incident | Latest valid recovery point strictly before incident onset, bounded by the verified history window | Recovery must target a point known to predate the corruption/loss. | `RECOVERY_POINT_STATUS_UNKNOWN` if the incident-onset boundary cannot be established; abort if outside the verified window. |
| Restore drill | A synthetic/non-sensitive recovery point no older than the drill cadence (≤ 90 days) | Drills must exercise a recent, representative recovery point without touching real user data. | `RESTORE_DRILL_OVERDUE` if no successful drill exists within the cadence. |

### RTO (Recovery Time Objective)

| Scenario | Selected RTO | Rationale | Fail-closed state |
|---|---|---|---|
| Restore to isolated copy + invariant verification | ≤ 4 hours (manual, approval-bounded) | Isolated restore and verification are provider operations plus human review, not an automated SLA. | Abort and keep original Production if the isolated copy cannot be produced or verified. |
| Production in-place restore (last resort) | ≤ 8 hours including separate owner approval | In-place restore is destructive and requires explicit approval; it is never the first step. | `BLOCKED_BY_RECOVERY_GATE` without approval; abort on any invariant failure. |
| Restore drill completion + evidence | ≤ 1 business day | Drills are scheduled, rehearsed operations with sanitized evidence. | `RESTORE_DRILL_OVERDUE` blocks the next Tier 3 DB change until a drill succeeds. |

These RTOs assume an operator with provider access is acting under approval. They are not
automated guarantees (`PROPOSED_FUTURE_CONTRACT`).

## 3. Retention tiers

| Tier | Definition | Intended coverage | Current status |
|---|---|---|---|
| Short-term operational recovery | Provider history window supporting point-in-time restore and read-only time-travel queries on root branches. | Minutes-to-hours rollback of accidental writes. | `OFFICIAL_PROVIDER_CAPABILITY` exists; actual window `PROJECT_CONFIGURATION_UNVERIFIED`. |
| Daily recovery points | At least one valid recovery point per 24h window for general user data. | Day-level recovery for ordinary data loss. | Depends on history window ≥ 24h (`PROJECT_CONFIGURATION_UNVERIFIED`); otherwise requires an external logical backup job (`PROPOSED_FUTURE_CONTRACT`, not configured). |
| Longer-term retained checkpoints | Weekly/monthly named checkpoints retained beyond the history window (target: weekly for ≥ 4 weeks, monthly for ≥ 3 months). | Recovery from latent corruption discovered late. | Not achievable through the history window alone beyond its configured length; requires external retained logical backups (`PROPOSED_FUTURE_CONTRACT`, `PROJECT_CONFIGURATION_UNVERIFIED`). |
| Pre-change named recovery point | A change-bound recovery point (named branch or recorded timestamp/LSN) created immediately before a Tier 3 or destructive DB change. | Exact pre-change state for rollback of an approved mutation. | Capability exists (branching + point-in-time restore, `OFFICIAL_PROVIDER_CAPABILITY`); creation is `NOT_AUTHORIZED` here and not yet wired into a gate (`PROPOSED_FUTURE_CONTRACT`). |
| Restore-drill evidence | Sanitized drill record (result, age bucket, invariant outcomes) retained outside the repository per the privacy boundary. | Proof that restore actually works. | `PROPOSED_FUTURE_CONTRACT`; no drill has been rehearsed yet. |

Any tier that cannot be confirmed against the live plan is treated as unavailable until
verified, and the dependent operation fails closed.

## 4. Pre-change recovery gate

Before any Tier 3 database operation or any operation with destructive potential
(`REPOSITORY_CONFIRMED` tier definition, `WORK_RISK_TIER_POLICY.md`: schema/migration,
delete/destructive actions, storage/security rules), the following must all hold:

1. A valid latest recovery point exists for the exact target environment.
2. Its age is within the applicable RPO (≈ 0 / ≤ 1 hour for a pre-change point).
3. The environment is unambiguously identified (Production versus non-Production), without
   exposing private identifiers.
4. Creation status of the recovery point is confirmed (not merely requested).
5. Restore capability is confirmed, or a recent successful drill exists within cadence.
6. Sanitized evidence is recorded per Section 7.
7. If any requirement is unmet, the DB change is **aborted** (fail closed).

### Fixed gate states

```text
RECOVERY_POINT_VALID
RECOVERY_POINT_STALE
RECOVERY_POINT_MISSING
RECOVERY_POINT_STATUS_UNKNOWN
RESTORE_DRILL_OVERDUE
PROVIDER_CAPABILITY_UNVERIFIED
BLOCKED_BY_RECOVERY_GATE
```

| State | Meaning | Allowed next action |
|---|---|---|
| `RECOVERY_POINT_VALID` | A change-bound recovery point exists, is within RPO, environment-confirmed, and creation-confirmed. | Proceed with the approved DB change only. |
| `RECOVERY_POINT_STALE` | A recovery point exists but is older than the applicable RPO. | Abort change; create a fresh recovery point (separate approved action), then re-evaluate. |
| `RECOVERY_POINT_MISSING` | No recovery point exists for the target environment. | Abort change; do not proceed. |
| `RECOVERY_POINT_STATUS_UNKNOWN` | Existence/age/creation state cannot be confirmed. | Abort change; treat as missing (fail closed). |
| `RESTORE_DRILL_OVERDUE` | No successful drill within cadence. | Block Tier 3 DB changes until a drill succeeds. |
| `PROVIDER_CAPABILITY_UNVERIFIED` | Required Neon capability/configuration cannot be confirmed without account access. | Abort change; obtain verified provider evidence through an authorized operator. |
| `BLOCKED_BY_RECOVERY_GATE` | One or more gate requirements failed. | No DB change; escalate for separate approval and remediation. |

This gate is a `PROPOSED_FUTURE_CONTRACT`. Until it is enforced in the deploy path, operators
must apply it manually, and any Tier 3 DB change without a `RECOVERY_POINT_VALID` (or
change-bound pre-change point) is `BLOCKED_BY_RECOVERY_GATE`.

## 5. Restore-first safety procedure

Default recovery order (provider-neutral; do not assume any specific console label or API
shape is current for this project):

1. **Restore to an isolated branch/copy first.** Recover the target recovery point into a
   separate, non-Production branch or copy. Never restore in place as the first step.
2. **Verify schema and relational invariants** on the isolated copy (see Section 6 checks and
   the `db/migration-provenance/expected-schema-manifest.json` /
   `db/migration-provenance/ledger-contract.json` source of truth).
3. **Review selective extraction** if only a subset of data is needed (for example, orphaned
   dependent identities as in Issue #3437). Prefer targeted extraction over wholesale replace.
4. **Treat Production in-place restore as a last resort**, only after isolated verification
   succeeds and only with separate explicit owner approval.
5. **Obtain separate approval before any Production change.** Approval to investigate is not
   approval to mutate Production.
6. **On any failure, abort and preserve the original Production state.** Do not compound loss.

`OFFICIAL_PROVIDER_CAPABILITY` (documented by Neon, not asserted as enabled here): Neon
documents point-in-time restore ("instant restore") of a **root branch** to a timestamp
(RFC 3339) or LSN within the plan's history window; child branches do not support
point-in-time restore. Restore is a complete **overwrite, not a merge**, and applies to all
databases on the branch. Neon documents that an automatic backup branch
(`{branch_name}_old_{head_timestamp}`) preserves the pre-restore state for rollback, that
connections are temporarily interrupted during restore, and that read-only Time Travel Assist
queries can confirm a restore target beforehand. Neon also documents branching for isolated
copies, Schema Diff for comparison, `pg_dump`-based logical backups (including automated
`pg_dump`), and a 7-day deleted-project recovery window. The exact current console labels,
CLI syntax, and API request shape must be confirmed by an authorized operator at execution
time; this policy does not guess them and does not assert they are enabled for this project
(`PROJECT_CONFIGURATION_UNVERIFIED`).

## 6. Restore drill

Cadence: `PROPOSED_FUTURE_CONTRACT` — **quarterly at minimum, and additionally before any
release that includes a Tier 3 database change** (release-risk based). A drill is overdue
(`RESTORE_DRILL_OVERDUE`) if no successful drill exists within the cadence.

Drills use **synthetic/non-sensitive** data only, never real user data.

Verification items:

- core schema objects exist (compared against `db/migration-provenance/expected-schema-manifest.json`);
- primary-key and foreign-key relationships are intact;
- orphan counts are validated by a documented method (for example, dependent identities with
  no matching parent row, as measured in Issue #3437) — reported as counts/buckets only;
- migration/ledger state matches the expected manifest (per #3458 ledger contract);
- a representative read path returns expected shapes (for example, an owner tree-list read and
  a public browse read, the two paths that failed in Issue #3435/#3437);
- synthetic write/read is permitted **only** in a separately approved isolated environment;
- the drill performs **zero mutation** against original Production.

Drill outcome is recorded as sanitized evidence per Section 7. A failed drill blocks the next
Tier 3 DB change (`RESTORE_DRILL_OVERDUE`) until a drill succeeds.

## 7. Evidence and privacy boundary

`REPOSITORY_CONFIRMED` secret-safety rule (`docs/ops/AGENTS.md`): reports use status words
only and never raw values. The same boundary applies to all recovery evidence.

Allowed fields (sanitized, may be recorded in GitHub/PR/Issue evidence):

- policy version;
- environment class (for example, `production` / `non-production`, as a class label only);
- recovery-point state (one of the fixed gate states);
- age bucket (for example, `<1h`, `<24h`, `>24h` — not an exact timestamp);
- drill result (`PASS` / `FAIL` / `BLOCKED`);
- verification timestamp bucket (for example, a date bucket, not a precise time);
- sanitized failure code.

Forbidden (must never be recorded in the repository, PRs, Issues, or CI logs):

- database URL or connection string;
- host or database name;
- credentials, tokens, or keys;
- raw row data;
- user / tree / memory identifiers;
- SQL result payloads;
- provider account or project identifiers;
- private logs.

No backup artifact may be stored inside the repository (`REPOSITORY_CONFIRMED` safety rule,
Issue #3460). Drill evidence that must reference real structures is reduced to counts,
buckets, and status codes before recording.

## 8. Recovery type separation

These are distinct operations. They are **not** interchangeable, and one must not be
described as a substitute for another.

| Type | What it changes | Authority |
|---|---|---|
| Code rollback / forward fix | Deployed application code only; no data change. | Normal deploy/merge authority; preferred first response to a code defect. |
| Database restore | Replaces data and schema on a branch with a historical state (destructive overwrite). | Separate explicit owner approval; isolated-copy-first; last resort for Production. |
| Selective row repair | Targeted insert/update of a bounded set of rows (for example, recovering orphaned dependent identities). | Separate explicit approval; scoped, reviewed, and evidence-backed; not a bulk restore. |
| Schema reconciliation | Aligns live catalog with the expected schema manifest (for example, Issue #3435/#3458 work). | Governed by the #3458 provenance gate; destructive DDL separately allowlisted and approved. |
| Provider configuration correction | Changes provider settings (plan, history window, protection, networking). | `NOT_AUTHORIZED` here; requires an authorized operator and is `PROJECT_CONFIGURATION_UNVERIFIED` until confirmed. |

A code rollback does not recover lost data. A database restore is not a schema fix. A
selective row repair is not a restore. Schema reconciliation is not a data restore. Provider
configuration correction is not any of the above.

## 9. Roles and least privilege

No single role automatically holds all recovery permissions. Each role is scoped and
separately granted.

| Role | Permission | Does not include |
|---|---|---|
| Read-only recovery-state observer | Read recovery-point state, age bucket, drill result; run read-only time-travel/inspection queries on an isolated copy. | Creating recovery points, restoring, mutating anything. |
| Recovery-point creator | Create a named recovery point / isolated branch in the approved environment. | Restoring Production, approving, mutating Production. |
| Isolated restore operator | Restore into an isolated branch/copy and run invariant verification there. | Any Production mutation. |
| Production restore approver | Grant or deny separate explicit approval for a Production restore. | Executing the restore; this role approves, does not run. |
| Production restore executor | Execute an approved Production restore only after approval is recorded. | Self-approval; changing scope beyond the approved action. |
| Post-restore verifier | Verify restored schema/relations/read paths and record sanitized evidence. | Mutating data; approving. |

Approval to investigate, read, or create a recovery point is never approval to mutate
Production. The approver and executor are distinct, and verification is independent of both.

## 10. Abort conditions and rollback (fail closed)

Fail closed (abort, preserve original Production, escalate) when any of the following holds:

- provider capability or configuration is unverified (`PROVIDER_CAPABILITY_UNVERIFIED`);
- no valid recovery point exists (`RECOVERY_POINT_MISSING` / `RECOVERY_POINT_STATUS_UNKNOWN`);
- the recovery point is stale (`RECOVERY_POINT_STALE`);
- the restore drill failed or is overdue (`RESTORE_DRILL_OVERDUE`);
- a schema or relational invariant check fails on the isolated copy;
- there is any possibility of targeting the wrong environment;
- there is any possibility of private-data exposure in evidence;
- separate explicit Production approval is absent.

Rollback principle: the isolated-copy-first procedure means the original Production state is
preserved until an approved, verified action succeeds. If a Production restore was executed,
the provider's automatic pre-restore backup branch (where available) is the rollback source,
itself subject to the same approval and verification gates. On any failure, stop and keep the
safest existing state; do not attempt an unapproved second mutation to "fix" the first.

## Coordination with related work

- **Issue #3458 (migration ledger / provenance, OPEN):** the recovery gate's schema-invariant
  and migration-state checks use `db/migration-provenance/expected-schema-manifest.json`,
  `ledger-contract.json`, `precondition-registry.json`, and `readonly-query-catalog.json` as
  the source of truth. This policy does not duplicate the ledger; it depends on it. Until #3458
  is enforced against Production, recovery state is `PROVIDER_CAPABILITY_UNVERIFIED` /
  `RECOVERY_POINT_STATUS_UNKNOWN` by default.
- **Issue #3435 (schema drift, OPEN):** defines the read-only, sanitized identity preflight and
  the TEXT `trees.id` contract; recovery verification must respect that contract and must not
  convert `trees.id` to UUID.
- **Issue #3437 (legacy tree entity loss, CLOSED):** the motivating incident; its public-first
  visibility policy and orphan-identity measurement inform the selective-repair and drill
  read-path checks.
- **Issue #1882:** remains OPEN. This policy references it only.

## Provider capability reference and unknowns

`OFFICIAL_PROVIDER_CAPABILITY` (current official Neon documentation, general capabilities —
not asserted as enabled for this project):

- point-in-time restore ("instant restore") of root branches by timestamp or LSN within a
  plan-defined history window; child branches do not support it;
- restore is a complete overwrite of data and schema across all databases on the branch;
- automatic pre-restore backup branch for rollback;
- read-only Time Travel Assist for confirming a restore target;
- branching for isolated copies and Schema Diff for comparison;
- `pg_dump` logical backups, including automated `pg_dump`;
- configurable per-project history window (`history_retention_seconds`);
- 7-day deleted-project recovery window (distinct from the history window).

`PROJECT_CONFIGURATION_UNVERIFIED` (must be confirmed by an authorized operator before any
recovery action relies on it):

- the Neon plan in use for the LoveBud Production project;
- the actual configured history window / `history_retention_seconds`;
- whether point-in-time restore reaches far enough to satisfy the selected RPO/retention;
- whether any external automated backup (for example, `pg_dump`) is configured and retained;
- branch protection, networking, and role configuration;
- which branch is the Production root branch;
- storage usage relative to plan limits.

Until these are verified, the policy treats the corresponding capability as unavailable and
fails closed.

## Acceptance mapping (Issue #3460)

| Acceptance criterion | Where addressed |
|---|---|
| RPO/RTO and retention explicitly selected | Sections 2 and 3 |
| Automated snapshot/history coverage verified, not assumed | Sections 1, 3, and provider unknowns (`PROJECT_CONFIGURATION_UNVERIFIED` / fail closed) |
| Risky DB operations fail the gate without a valid pre-change recovery point | Section 4 |
| Restore-to-isolated-copy procedure documented and rehearsed | Sections 5 and 6 |
| Drill proves schema and data invariants with synthetic/sanitized checks | Sections 6 and 7 |
| Stale/missing backup state produces an actionable alert | Sections 4 (gate states) and 10 |
| Runbook distinguishes code rollback, database restore, and selective row repair | Section 8 |
| #1882 remains open | Referenced only; kept OPEN |

Refs #3460 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #1882 — Keep OPEN.
