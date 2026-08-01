# Database Recovery Production Configuration Inspection

> **Parent:** Issue #3460 (Keep OPEN).
> **This child:** Issue #3817 — sanitized, read-only inspection of the attributed Production recovery configuration.
> **Completed prerequisites:** Issue #3807 / PR #3808 (provider capability audit); Issue #3812 / PR #3814 (Production target attribution = `VERIFIED_UNIQUE`).
> **Source policy:** `docs/ops/DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md`.
> **Provider capability audit:** `docs/ops/DATABASE_RECOVERY_PROVIDER_CAPABILITY_AUDIT.md`.
> **Production target attribution:** `docs/ops/DATABASE_RECOVERY_PRODUCTION_TARGET_ATTRIBUTION.md`.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`.

Refs #3817
Refs #3812 — completed.
Refs #3807 — completed.
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Scope and explicit non-actions

This child re-runs the private in-memory Production-target attribution gate and then, only
after it succeeds, inspects the attributed project's recovery configuration read-only via
Neon GET-only requests. It records only fixed statuses, enums, and age buckets. It does
**not** perform or authorize:

- any PostgreSQL connection, socket open, handshake, or SQL execution (including
  connectivity, introspection, or health queries);
- any `POST` / `PUT` / `PATCH` / `DELETE` provider call;
- snapshot creation/update/deletion, backup-schedule creation/update, history-retention
  update, project update, branch creation/reset/rename/delete, endpoint start/suspend,
  restore, restore preview, or finalize-restore;
- `modal deploy`, `modal serve`, persistent App/Function deployment, web endpoint,
  schedule, queue, volume, or secret creation/update;
- any Production, provider, or Cloudflare mutation;
- inspection of secrets, credentials, connection strings, or environment values outside
  the bounded in-memory comparison;
- any schema/table/row inspection, migration decision, or binding change (#3458 / #3435
  territory);
- recording of the `DATABASE_URL` value, connection string, endpoint identity, project,
  branch, snapshot, account, or organization identifiers, region, database/role name, or
  any derived value that could identify a resource.

Nothing in this document modifies provider configuration or grants restore-drill or
remediation execution authority.

## 2. Completed attribution prerequisite

- Issue #3807 / PR #3808: sanitized read-only Neon recovery capability audit completed
  (verdict `PROVIDER_CAPABILITY_UNVERIFIED` due to an unattributed Production target).
- Issue #3812 / PR #3814: Production target attribution completed as `VERIFIED_UNIQUE`.

The exact starting `origin/main` for this child was the PR #3814 merge commit. The actual
remote state was verified at session start, and the latest `origin/main` was used.

## 3. Sanitized inspection method

- **Private attribution gate (re-run this session):** the same non-identifying comparison
  as Issue #3812 was repeated within this session. Neon GET-only metadata was normalized
  in process memory into session-bounded blinded comparison material using one-time random
  material. One disposable ephemeral Modal run injected the existing `lovebud-db` secret
  by name, read only `DATABASE_URL` from the injected environment, parsed only the
  endpoint identity in process memory, and performed a constant-time equality comparison.
  The run returned the fixed attribution enum; no value, identifier, or object count was
  printed or recorded.
- **Attributed inspection:** only after `VERIFIED_UNIQUE` was the attributed project's
  read-only metadata inspected: project settings (history retention bucket), the default
  root branch backup schedule, and the project snapshot list. All raw responses were
  handled in process memory and converted immediately to fixed buckets and statuses.
- **Ephemerality:** the disposable script and all comparison material were deleted after
  the run. No persistent App, Function, secret, volume, queue, schedule, or endpoint was
  created.

## 4. Production restore-window result

| Item | Value |
|---|---|
| Production target attribution | `VERIFIED_UNIQUE` |
| Production root branch attribution | `VERIFIED` |
| Restore-window bucket (history retention) | `LT_24H` |
| General 24-hour RPO | `NOT_SATISFIED` |

The attributed project's configured history window is below the 24-hour threshold, so the
policy's general-user-data RPO of no more than 24 hours is **not** satisfied by the
provider history window.

## 5. Production snapshot-schedule result

| Item | Value |
|---|---|
| Schedule state | `NONE` |
| DAILY | `ABSENT` |
| WEEKLY | `ABSENT` |
| MONTHLY | `ABSENT` |

No snapshot schedule is configured on the attributed project's root branch. No frequency
count or schedule detail is recorded.

## 6. Production retention-policy comparison

| Item | Value |
|---|---|
| DAILY_POLICY | `NOT_SATISFIED` |
| WEEKLY_POLICY | `NOT_SATISFIED` |
| MONTHLY_POLICY | `NOT_SATISFIED` |

The policy requires a valid recovery point per 24-hour window (daily tier), retention of
at least 4 weeks (weekly tier), and retention of at least 3 months (monthly tier). With no
scheduled recovery points configured, none of the retained tiers is satisfied. Exact
retention values are not recorded.

## 7. Recovery-point presence and age bucket

| Item | Value |
|---|---|
| Snapshot presence | `PRESENT` |
| Newest snapshot age bucket | `GE_7D` |

A manual recovery point exists but the newest observed point is older than 7 days, which
is stale relative to the policy's daily recovery-point expectation. Snapshot identifiers,
counts, and exact times are not recorded.

## 8. Final configuration verdict

**Verdict: `RECOVERY_CONFIGURATION_REMEDIATION_REQUIRED`.**

Production target attribution and root branch attribution are verified, but the read-only
evidence shows the configured restore window is below the 24-hour tier, no snapshot
schedule is configured, all retained-policy tiers are unsatisfied, and the newest
recovery point is stale. This verdict does **not** authorize a restore drill or any
provider mutation.

## 9. Dependency boundary with #3458 and #3435

- #3458 retains exclusive ownership of the migration ledger, schema manifests, catalog
  drift, migration provenance, deploy preconditions, and PostgreSQL rehearsal.
- #3435 retains ownership of database/table identity, schema drift, search-path
  inspection, dependency preflight, and eventual schema reconciliation.

This child inspected only provider-level recovery configuration. No schema inspection,
SQL, row access, migration decision, or environment-binding correction was authorized or
performed.

## 10. Smallest next #3460 child

Because the final configuration verdict is `RECOVERY_CONFIGURATION_REMEDIATION_REQUIRED`,
the smallest next child is an **owner-authorized provider configuration remediation
decision**: determine which of the fixed statuses above (window, schedule, retention, or
recovery-point currency) must be remediated and obtain explicit approval before any
schedule, retention, snapshot, or provider mutation is performed. Snapshot configuration
and the isolated-copy restore drill remain separate later approvals.

## 11. Privacy self-audit

- No `DATABASE_URL` value, connection string, endpoint identity, project, branch,
  snapshot, account, or organization identifier, region, database/role name, credential,
  raw provider response, exact object count, exact time, exact retention value, exact
  schedule detail, or derived value appears in this document or in this PR.
- The fixed repository-known aliases `lovebud-db` and `DATABASE_URL` appear only as
  source-level configuration identifiers; their values were never inspected outside the
  bounded in-memory comparison process or recorded.
- Only fixed statuses, enums, buckets, and the policy vocabulary are recorded.
- All disposable comparison material and scripts were deleted after the session; no raw
  provider response or private artifact remains.
- Manual semantic review (English and Korean) confirms that no project/account/organization
  name, endpoint, branch, snapshot, object count, or exact time is disclosed.
