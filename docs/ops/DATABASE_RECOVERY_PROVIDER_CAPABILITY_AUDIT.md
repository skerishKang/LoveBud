# Database Recovery Provider Capability Audit

> **Parent:** Issue #3460 (Keep OPEN).
> **Provider-side capability state audit:** Issue #3807.
> **Source policy:** `docs/ops/DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md` (PR #3776).
> **Policy guard contract:** PR #3778.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`.
> **Migration/provenance boundary:** Issue #3458 (Keep OPEN) — not inspected here.
> **Status:** `PROVIDER_CAPABILITY_UNVERIFIED` (fail closed).

Refs #3807
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Scope and explicit non-actions

This audit verifies, **read-only and privacy-preserving**, the live Neon recovery
capability and configuration state required by #3460. It records only statuses, enums,
and age buckets. It does **not** perform or authorize:

- any `POST` / `PUT` / `PATCH` / `DELETE` Neon API call;
- snapshot creation, backup-schedule creation or modification, branch creation, reset,
  rename, expiration, or deletion;
- restore or restore-preview creation, or a Time Travel query;
- any PostgreSQL connection or SQL execution;
- any Production / Preview / staging / provider mutation;
- inspection of secrets, tokens, connection strings, or environment values;
- storage of raw provider responses, screenshots with identifiers, or row data;
- any change to the migration ledger, schema manifests, catalog drift, migration
  provenance, deploy preconditions, or the readonly query catalog (#3458 territory);
- creation of new Issues or changes to Issue state.

Nothing in this document configures a provider or grants recovery execution authority.

## 2. Evidence provenance

- **Access method:** an already-configured neonctl credential boundary.
- **Request boundary:** GET-only provider metadata retrieval.
- **Mutation count:** 0.
- **Credential handling:** the token was not printed or recorded.
- **Raw response handling:** raw provider responses were not committed or uploaded; only
  sanitized statuses, enums, and age buckets are recorded.
- **Official documentation sources** (general capability only, per #3807):
  - Snapshot list API: https://api-docs.neon.tech/reference/listsnapshots
  - Backup schedule read API: https://api-docs.neon.tech/reference/getsnapshotschedule
  - Snapshot restore API semantics: https://api-docs.neon.tech/reference/restoresnapshot
  - Snapshot scheduling announcement: https://neon.com/docs/changelog/2025-10-31
  - Restore-window / project management documentation: https://neon.com/docs/manage/projects
- These links establish **general provider capability**; they do **not** prove the
  feature is enabled or correctly configured for the target project.

## 3. Official provider capability versus project configuration

### 3.1 Official provider capability (current official documentation)

- **Snapshot list** — `GET /projects/{project_id}/snapshots` (Beta): lists snapshots,
  each a point-in-time backup of project data.
- **Backup schedule** — `GET /projects/{project_id}/branches/{branch_id}/backup_schedule`
  (Beta): returns configured snapshot frequencies (`daily` / `weekly` / `monthly`) and
  per-frequency retention seconds.
- **Snapshot restore** — `POST /projects/{project_id}/snapshots/{snapshot_id}/restore`
  (Beta): restores the snapshot to a **new branch**; `finalize_restore` defaults to
  `false`, i.e. **preview-first** semantics (finalize replaces the original branch).
- **Snapshot scheduling (announcement 2025-10-31):** snapshots in Beta for all users;
  scheduled snapshots (daily/weekly/monthly) are available on paid plans (excluding the
  Agent plan); plan-level snapshot limits differ between Free and paid plans; flexible
  retention; "Preview data before restoring" is available in the Console.
- **Restore window / project management:** a root branch is created by default as the
  project's default branch; the **history window** (instant restore / Time Travel) is
  project-configurable (`history_retention_seconds`); deleted projects can be recovered
  within a 7-day deletion recovery period.

### 3.2 Observed project configuration (sanitized, account-level)

- Root/default branch structurally determinable: `YES` across the inspected project
  boundaries.
- Production root branch determinable: `UNKNOWN`.
- Production-target ambiguity: `PRESENT`.
- Production-attributed restore window: `UNKNOWN`.
- Observed account-level restore-window buckets: `LT_24H` and `GE_24H_LT_7D` were
  observed.
- Manual recovery point presence: `PRESENT`.
- Latest observed recovery-point age bucket: `GE_24H`.
- Observed account-level schedule state: `NONE` was observed across the inspected
  root/default branch boundaries.
- Production-attributed schedule state: `UNKNOWN`.
- Other observed projects may have no manual recovery point, but exact counts are not
  recorded.

## 4. Sanitized verification matrix

Classification vocabulary: `VERIFIED_PASS` / `VERIFIED_FAIL` /
`PROJECT_CONFIGURATION_UNVERIFIED` / `NOT_APPLICABLE` / `BLOCKED_NO_ACCESS`.

### 4.1 Project recovery topology

| Item | Recorded value | Classification |
|---|---|---|
| Root/default branch structurally determinable | `YES` | `VERIFIED_PASS` (observation) |
| Production root branch determinable | `UNKNOWN` — production project cannot be attributed from this boundary | `PROJECT_CONFIGURATION_UNVERIFIED` |
| Production-target ambiguity | `PRESENT` | — |

### 4.2 Restore window

| Item | Recorded value | Classification |
|---|---|---|
| Production-attributed window bucket | `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` |
| Observed account-level buckets | `LT_24H` and `GE_24H_LT_7D` observed | `VERIFIED_PASS` (observation) |
| Policy daily tier (≥ 24 h) comparison | not production-attributable; account-level observations include windows below the 24 h tier | `PROJECT_CONFIGURATION_UNVERIFIED` (production) |

### 4.3 Snapshot capability and schedule

| Item | Recorded value | Classification |
|---|---|---|
| Snapshot feature visible | `YES` (snapshot list GET → `200`) | `VERIFIED_PASS` |
| Scheduled-snapshot capability visible | `YES` (backup-schedule GET → `200`) | `VERIFIED_PASS` |
| Observed account-level schedule state | `NONE` | `VERIFIED_PASS` (observation) |
| Production-attributed schedule state | `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` |
| Retention satisfies policy tiers | not production-attributable; no schedule retention observed at account level | `PROJECT_CONFIGURATION_UNVERIFIED` (production) |
| Manual recovery point presence | `PRESENT` | `VERIFIED_PASS` (observation) |

### 4.4 Latest valid recovery point

| Item | Recorded value |
|---|---|
| Latest observed recovery-point age bucket | `GE_24H` |
| Production-attributed recovery-point state | `UNKNOWN` |

### 4.5 Safe restore workflow capability (visibility only; not executed)

| Item | Recorded value | Classification |
|---|---|---|
| Restore-to-preview / isolated-copy path | Official: `YES` (restore creates a new branch). Project-level: `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` (project-level) |
| In-place restore path distinguishable | Official: `YES` (`finalize_restore`). Project-level: `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` (project-level) |
| Preview-before-finalize semantics | Official: `YES` (`finalize_restore` default `false`; Console "Preview data" button). Project-level: `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` (project-level) |
| Automatic pre-restore preservation | Official: `YES` (restore is non-destructive by default — new branch). Project-level: `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` (project-level) |

### 4.6 Authorization and least privilege

| Item | Recorded value |
|---|---|
| Read-only observer boundary | `VERIFIED` (this audit executed GET-only through the configured boundary) |
| Creator versus restore authority separable | `UNVERIFIED` (single-credential boundary; role separation not verifiable here) |
| Approver versus executor separation | `UNVERIFIED` (not operationally defined in an observable way) |

### 4.7 External retained backup

`PROJECT_CONFIGURATION_UNVERIFIED` — repository-owned external retained backup automation
was not found in this repository, but the existence or absence of externally operated
backups outside the repository cannot be proven from this audit's authorized evidence.
Neon history windows and Neon snapshots are **not** counted as external retained backups.

## 5. Policy RPO/RTO and retention comparison

- **General user data RPO ≤ 24 h:** not provably satisfied. Production-attributed window
  is `UNKNOWN`; account-level observations include windows below the 24 h tier; the
  latest observed recovery point is `GE_24H`. Fail closed.
- **Pre-change (Tier 3 / destructive) RPO ≈ 0:** not satisfied — no automated
  change-bound recovery-point gate was observed (account-level schedule state `NONE`).
  Fail closed.
- **Major incident RPO:** bounded by the unverified production window.
- **Restore drill RPO (synthetic point ≤ 90 days):** no drill has been rehearsed
  (drill completion `NO`).
- **RTO:** targets remain `PROPOSED_FUTURE_CONTRACT`; no automation or rehearsed
  procedure exists to measure them.
- **Retention tiers:** production-attribution `UNKNOWN`; daily/weekly/monthly retained
  checkpoints and external logical backups are not confirmed.

## 6. Recovery gate verdict

**Gate state: `PROVIDER_CAPABILITY_UNVERIFIED`.**

Rationale: the Production project cannot be uniquely identified from the authorized
read-only evidence (Production-target ambiguity `PRESENT`), so Production's restore
window, schedule, retention, current recovery point, and restore workflow availability
cannot be production-attributed and verified; the policy fails closed.

Supporting observations (auxiliary facts, not the final verdict):

- schedule state `NONE` observed at account level;
- restore-window buckets below and above 24 hours observed at account level;
- manual recovery point presence `PRESENT`;
- latest observed recovery-point age bucket `GE_24H`;
- restore drill completed `NO`;
- authority separation `UNVERIFIED`.

`RECOVERY_POINT_VALID` is **not** used. `RECOVERY_POINT_STALE` and `RESTORE_DRILL_OVERDUE`
are described only as conditional references (for example, if the observed recovery point
were production-attributable its age would map to `RECOVERY_POINT_STALE`, and an absent
drill maps to `RESTORE_DRILL_OVERDUE`); they are **not** used as the final single verdict.
This audit does **not** complete #3460; the separately authorized isolated-copy restore
drill and any missing recovery automation/alert implementation remain required.

## 7. Exact unresolved provider gaps

1. Production project attribution and its exact history window (requires an
   owner-authorized correlation; out of scope here).
2. No snapshot schedule observed at account level (state `NONE`); production-attributed
   schedule `UNKNOWN`.
3. Account-level restore-window observations include windows below the 24 h daily tier.
4. Latest observed recovery point is `GE_24H`; exact counts and expiry are not recorded.
5. Restore workflow (POST endpoints) not executed; Console visibility not verifiable via
   GET-only access.
6. Creator/restore and approver/executor authority separation unverified.

## 8. Dependency boundary with #3458

#3458 owns the migration ledger, expected-schema manifests, catalog drift, migration
checksums, schema provenance, and deploy preconditions. This audit verifies only
provider-side recovery capability and sanitized configuration state. It does not inspect,
change, or duplicate #3458 authorities. A future restore drill must additionally confirm
the applied-schema/ledger invariants under #3458 before Production restore is considered;
that dependency is recorded here and not implemented.

## 9. Smallest next #3460 child

**Owner-authorized Production project attribution decision.**

- **Goal:** decide, by operator confirmation, which Neon project the current connection
  boundary maps to, without publishing any secret or connection string to GitHub.
- **Output:** sanitized Production target attribution status only.
- **Non-actions:** no snapshot creation; no schedule modification; no restore; no SQL; no
  branch creation; no Production mutation.

Only after Production project attribution is complete may snapshot-schedule configuration
or an isolated-copy restore drill be separately authorized as their own children.

## 10. Privacy self-audit

- No database URL, `postgresql://` string, host, private endpoint, project ID/name,
  branch ID/name, snapshot ID, operation ID, account ID, organization ID, email, token,
  authorization header, connection string, UUID, raw timestamp, raw API JSON, row data,
  or user/tree/memory identifier is recorded.
- No exact provider object counts, no actual branch names, and no operator filesystem or
  credential paths are recorded.
- Only statuses, enums, age buckets, and the policy vocabulary appear.
- Public API documentation URLs and generic endpoint templates (for example
  `/projects/{project_id}`) are used only for capability description; no real identifier
  appears.
