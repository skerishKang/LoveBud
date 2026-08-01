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
- storage of raw provider responses, screenshots with identifiers, or row data in the
  repository, Issues, or PRs;
- any change to the migration ledger, schema manifests, catalog drift, migration
  provenance, deploy preconditions, or the readonly query catalog (#3458 territory);
- creation of new Issues or changes to Issue state.

Nothing in this document configures a provider or grants recovery execution authority.

## 2. Evidence provenance

- **Method:** the already-configured Neon credential boundary
  (`~/.config/neonctl/credentials.json`, used by `neonctl` v2.22.0) was used for
  **GET-only** requests against the Neon API (`https://console.neon.tech/api/v2`).
  No other credential was read. The token was never printed, written, or uploaded.
- **GET requests issued (read-only proof):** `/projects`, `/projects/{project_id}`,
  `/projects/{project_id}/branches`, `/projects/{project_id}/snapshots`,
  `/projects/{project_id}/branches/{branch_id}/backup_schedule`.
  Mutation operation count: **0**.
- **Probe location:** a disposable directory outside the repository
  (`/tmp/kilo/neon-audit/`). Raw responses were processed in memory and reduced to
  sanitized facts; no raw provider response was saved to the repository.
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
  Agent plan); Free plan includes 1 snapshot, paid plans 10; flexible retention;
  "Preview data before restoring" is available in the Console.
- **Restore window / project management:** a root branch is created by default as the
  project's default branch (Console name `production`, API/CLI name `main`); the
  **history window** (instant restore / Time Travel) is project-configurable under
  Settings → Instant restore (`history_retention_seconds`, default example `86400`);
  deleted projects can be recovered within a 7-day deletion recovery period.

### 3.2 Observed project configuration (sanitized, account-level)

- **6 projects** are visible under the configured GET-only boundary.
- **Root branch:** determinable for all 6 projects (each project exposes a
  primary/default branch). Exactly one project has a branch named `main` (the API
  default root name).
- **History window (`history_retention_seconds`) distribution:** 5 of 6 projects
  `LT_24H`; 1 of 6 projects `GE_24H_LT_7D`.
- **Snapshot list:** `GET /snapshots` returns `200` on all 6 projects. Snapshot counts:
  5 of 6 projects have **none**; 1 project has exactly **one manual** snapshot with no
  configured expiry, aged `GE_24H`.
- **Backup schedule:** `GET .../backup_schedule` returns `200` on every root branch;
  the schedule array is **empty on all projects** → no configured snapshot schedule
  (state `NONE`).
- **Production project identification:** not determinable from this boundary. The
  account exposes 6 projects and the application's connection configuration is out of
  scope, so a unique "Production" project cannot be attributed here.

## 4. Sanitized verification matrix

Classification vocabulary: `VERIFIED_PASS` / `VERIFIED_FAIL` /
`PROJECT_CONFIGURATION_UNVERIFIED` / `NOT_APPLICABLE` / `BLOCKED_NO_ACCESS`.

### 4.1 Project recovery topology

| Item | Recorded value | Classification |
|---|---|---|
| Production root branch determinable | `UNKNOWN` — every project's root branch is structurally determinable, but the Production project cannot be attributed from this boundary | `PROJECT_CONFIGURATION_UNVERIFIED` |
| Snapshot-eligible root branch determinable | `YES` (account level) — snapshot and backup-schedule GETs return `200` for every root branch; production-attribution remains `UNKNOWN` | `VERIFIED_PASS` (account level) |
| Production-target ambiguity | `PRESENT` (6 projects; no unique correlation) | — |

### 4.2 Restore window

| Item | Recorded value | Classification |
|---|---|---|
| Production-attributed window bucket | `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` |
| Account distribution (observed) | 5/6 `LT_24H`; 1/6 `GE_24H_LT_7D` | `VERIFIED_PASS` (observation) |
| Meets policy daily tier (≥ 24 h / `86400` s) | majority does **not** | `VERIFIED_FAIL` (account majority); production `PROJECT_CONFIGURATION_UNVERIFIED` |

### 4.3 Snapshot capability and schedule

| Item | Recorded value | Classification |
|---|---|---|
| Snapshot feature visible | `YES` (`GET /snapshots` → `200`) | `VERIFIED_PASS` |
| Scheduled-snapshot capability visible | `YES` (`GET /backup_schedule` → `200`) | `VERIFIED_PASS` |
| Schedule state | `NONE` (empty on all projects) | `VERIFIED_PASS` (observation); policy fail |
| Retention satisfies policy tiers | `NO` — no schedule retention configured; history window below the 24 h tier for the account majority | `VERIFIED_FAIL` |
| Manual recovery point presence | `PRESENT` (1 manual snapshot, no configured expiry) | `VERIFIED_PASS` (observation) |

### 4.4 Latest valid recovery point

| Item | Recorded value |
|---|---|
| Age bucket of the newest observed recovery point | `GE_24H` (the sole manual snapshot); the other 5 projects have `NONE` |

### 4.5 Safe restore workflow capability (visibility only; not executed)

| Item | Recorded value | Classification |
|---|---|---|
| Restore-to-preview / isolated-copy path visible | Official: `YES` (restore creates a new branch). Project-level: `UNKNOWN` | `PROJECT_CONFIGURATION_UNVERIFIED` (project-level) |
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

`VERIFIED_NOT_CONFIGURED` — the source policy (§1, §3) confirms the repository has no
external logical backup system, and the retention tiers mark an external logical backup
job as `PROPOSED_FUTURE_CONTRACT` / not configured. Neon snapshots and history windows are
**not** external retained backups and are not counted as such.

## 5. Policy RPO/RTO and retention comparison

- **General user data RPO ≤ 24 h:** not provably satisfied. Production window is
  `UNKNOWN`; the account majority history window is `LT_24H`; the newest observed
  recovery point is `GE_24H`. Fail closed.
- **Pre-change (Tier 3 / destructive) RPO ≈ 0:** not satisfied — no automated
  change-bound recovery-point gate exists (schedule `NONE`). Fail closed
  (`RECOVERY_POINT_MISSING` for change-bound points).
- **Major incident RPO:** limited by the observed history window (majority `LT_24H`).
- **Restore drill RPO (synthetic point ≤ 90 days):** no drill has been rehearsed →
  `RESTORE_DRILL_OVERDUE` if the drill gate were applied.
- **RTO:** targets remain `PROPOSED_FUTURE_CONTRACT`; no automation or rehearsed
  procedure exists to measure them.
- **Retention tiers:** short-term PITR window is below the 24 h daily tier for the
  account majority; daily/weekly/monthly retained checkpoints and external logical
  backups are not configured.

## 6. Recovery gate verdict

**Gate state: `PROVIDER_CAPABILITY_UNVERIFIED`.**

Rationale: the Production project cannot be unambiguously identified from the authorized
GET-only boundary (6 projects; `PRESENT` ambiguity), so the production-attributed restore
window, snapshot capability configuration, and current recovery-point state remain
unverified, and the policy fails closed. Supporting observed facts that independently map
to other states: the sole manual recovery point is `GE_24H` (would map to
`RECOVERY_POINT_STALE` if production-attributable); no snapshot schedule is configured
(daily tier unmet); no restore drill has been rehearsed (would map to
`RESTORE_DRILL_OVERDUE`).

`RECOVERY_POINT_VALID` is **not** used: not all required provider capability and current
recovery-point evidence is verified, and no isolated restore drill has been performed.
This audit does **not** complete #3460; the separately authorized isolated-copy restore
drill and any missing recovery automation/alert implementation remain required.

## 7. Exact unresolved provider gaps

1. Production project identification and its exact history window (requires
   owner-provided connection-boundary correlation; out of scope here).
2. No automated snapshot schedule is configured (`NONE` on all projects).
3. History window is below the 24 h daily tier for the account majority.
4. The sole manual recovery point is ≥ 24 h old with no configured expiry (stale if
   production-attributable).
5. Restore workflow (POST endpoints) was not executed, and Console restore visibility is
   not verifiable via GET-only access.
6. Creator/restore and approver/executor authority separation is not verifiable through
   the current boundary.

## 8. Dependency boundary with #3458

#3458 owns the migration ledger, expected-schema manifests, catalog drift, migration
checksums, schema provenance, and deploy preconditions. This audit verifies only
provider-side recovery capability and sanitized configuration state. It does not inspect,
change, or duplicate #3458 authorities. A future restore drill must additionally confirm
the applied-schema/ledger invariants under #3458 before Production restore is considered;
that dependency is recorded here and not implemented.

## 9. Smallest next #3460 child

The smallest next child is an **owner-authorized, isolated-copy restore drill** using
synthetic/non-sensitive data that: (a) first configures or confirms the production
project's history window and snapshot schedule (provider configuration is mutation and
requires separate explicit owner approval); (b) restores into an isolated branch/copy;
(c) verifies the restored schema plus representative relational invariants per the policy;
and (d) records sanitized drill evidence. No provider or repository mutation is
authorized by this document.

## 10. Privacy self-audit

- No database URL, `postgresql://` string, host, endpoint, project ID, branch ID,
  snapshot ID, operation ID, account ID, organization ID, email, token, authorization
  header, connection string, UUID, raw timestamp, raw API JSON, row data, or
  user/tree/memory identifier is recorded in this document or in this PR.
- Only statuses, enums, age buckets, and the policy vocabulary appear.
- The GET-only probe ran in a disposable directory outside the repository; raw provider
  responses were never committed or uploaded.
- Identifier-shaped tokens (IDs, UUIDs, hosts, emails) were stripped in-process before
  any output.
