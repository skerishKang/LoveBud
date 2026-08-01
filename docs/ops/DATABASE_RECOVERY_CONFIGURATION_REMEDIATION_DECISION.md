# Database Recovery Configuration Remediation Decision

> **Direct issue:** Issue #3822 — decide the Production recovery configuration remediation sequence.
> **Parent:** Issue #3460 (Keep OPEN).
> **Source-only decision child:** no provider configuration is changed, approved, or executed here.
> **Authority:** `docs/ops/DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md` (merged, PR #3776), `docs/ops/DATABASE_RECOVERY_PROVIDER_CAPABILITY_AUDIT.md` (#3808), `docs/ops/DATABASE_RECOVERY_PRODUCTION_TARGET_ATTRIBUTION.md` (#3814), `docs/ops/DATABASE_RECOVERY_PRODUCTION_CONFIGURATION_INSPECTION.md` (#3818), `docs/ops/WORK_RISK_TIER_POLICY.md`, `docs/ops/AGENTS.md`, `docs/ops/MVP_AGENT_GOVERNANCE.md`, `docs/ops/ENV_DEPENDENCY.md`.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`.

Refs #3822
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Scope and explicit non-actions

This child converts the fixed, merged sanitized inspection result into an exact,
owner-decision remediation **sequence**. It does **not**:

- perform any Neon/provider GET or mutation, Dashboard, CLI, Modal, Cloudflare, or secret
  access;
- open a database connection or execute SQL;
- create or update any snapshot, branch, schedule, retention, or restore, or create an
  external logical backup;
- change any workflow, package, runtime, or test file;
- access Production or Preview;
- transition Ready, merge, or close any Issue;
- create a new implementation child (proposals only in this document);
- reset, clean, stash, rebase, amend, or force-push.

Nothing here authorizes a provider change. Every provider mutation listed below requires a
separate owner-approved child.

## 2. Authority baseline and fixed evidence

Only merged sanitized evidence is used. No provider re-inspection occurred.

Fixed inspection result (Issue #3817 / PR #3818):

```text
Production target attribution: VERIFIED_UNIQUE
Production root branch attribution: VERIFIED
Restore-window bucket: LT_24H
General 24-hour RPO: NOT_SATISFIED
Schedule state: NONE
DAILY / WEEKLY / MONTHLY: ABSENT / ABSENT / ABSENT
DAILY_POLICY / WEEKLY_POLICY / MONTHLY_POLICY: NOT_SATISFIED / NOT_SATISFIED / NOT_SATISFIED
Snapshot presence: PRESENT
Newest recovery-point age bucket: GE_7D
Final verdict: RECOVERY_CONFIGURATION_REMEDIATION_REQUIRED
```

Fixed policy targets (not weakened):

```text
General user-data RPO: ≤24h
Pre-change Tier 3/destructive recovery point: age ≤1h and change-bound, creation confirmed
Weekly retained checkpoint: ≥4 weeks
Monthly retained checkpoint: ≥3 months
Isolated-copy restore + invariant verification RTO: ≤4h
Production in-place restore RTO target: ≤8h, including a separate owner approval
Restore-drill cadence: quarterly, and before any Tier 3 database release
```

## 3. Decision mapping

### Q1 — Minimum target for the restore window

The general ≤24h RPO requires a provider history window of **at least 24 hours** (the
policy's daily-tier boundary). The observed `LT_24H` window is below that boundary, so the
minimum remediation target is a window in the `GE_24H_LT_7D` bucket or longer.
Classification: **`CONFIGURATION_REQUIRED`** (+ **`OWNER_APPROVAL_REQUIRED`**).

### Q2 — Daily coverage from provider history alone

Yes. With a verified history window ≥ 24h, the daily recovery-point tier
(`≤24h` general RPO) is satisfied by provider point-in-time history alone.
Classification: **`PROVIDER_CAPABILITY_SUFFICIENT`** for the daily tier — but the current
configuration is below it, so the current state is **`BLOCKED_PENDING_CONFIGURATION`**.

### Q3 — Weekly 4 weeks / monthly 3 months by provider-native features only

No. The merged policy states longer-term retained checkpoints are **not** achievable
through the history window alone beyond its configured length and require external
retained logical backups. Whether the provider-native scheduled-snapshot retention
capability can retain checkpoints for ≥ 4 weeks / ≥ 3 months is **not** established by the
merged evidence. Classification: **`PROVIDER_CAPABILITY_INSUFFICIENT`** (policy-consistent)
with the native-retention sub-question **`PROVIDER_CAPABILITY_UNVERIFIED`**. The decision
therefore defaults to **`EXTERNAL_RETENTION_REQUIRED`** for the weekly and monthly tiers.

### Q4 — Is an external retained logical backup required?

- Daily tier: **No** — provider history ≥ 24h is sufficient.
- Weekly / monthly tiers: **Yes** — **`EXTERNAL_RETENTION_REQUIRED`** unless a future,
  separately authorized provider inspection verifies native schedule retention meeting
  ≥ 4 weeks / ≥ 3 months. An external logical backup is a distinct mechanism, never
  counted as a Neon history window or Neon snapshot.

### Q5 — Required pre-change recovery point for Tier 3 / destructive changes

Immediately before any approved Tier 3 or destructive DB operation, a **named,
change-bound recovery point** must exist with age ≤ 1h, bound to the change identifier, and
creation confirmed, and the repository pre-change gate must evaluate it
(`RECOVERY_POINT_VALID`). Approval authority: the **owner** (Tier 3 policy:
Production-destructive schema/data/security changes require owner approval). The provider
capability to create such a point is `OFFICIAL_PROVIDER_CAPABILITY` per the policy, but
creation itself is **`OWNER_APPROVAL_REQUIRED`** and the gate wiring is
**`REPOSITORY_IMPLEMENTATION_REQUIRED`**.

### Q6 — Order of provider configuration versus repository implementation

Provider configuration remediation **first**, repository implementation second:

```text
1. provider history window + snapshot schedule (A)
2. external retained logical backup (B) — weekly/monthly
3. pre-change recovery gate + stale/missing alerting (C+D) — repository implementation
4. isolated-copy synthetic restore drill (E)
5. Production in-place restore (F) — last resort, NOT_AUTHORIZED
```

Repository gates and alerts depend on provider state being correct, so the provider layer
must be remediated and re-verified before the repository layer is meaningful.

### Q7 — Stale recovery point and schedule absence → alert/gate linkage

The repository alert layer monitors schedule state and recovery-point age. When the
schedule is `NONE` or the newest recovery point is stale (e.g. `GE_7D`), the pre-change
gate must fail closed (`RECOVERY_POINT_MISSING` / `RECOVERY_POINT_STALE` /
`BLOCKED_BY_RECOVERY_GATE`) and block Tier 3/destructive changes. A drill older than
cadence maps to `RESTORE_DRILL_OVERDUE` and also blocks such changes.
Classification: **`REPOSITORY_IMPLEMENTATION_REQUIRED`** for both the alert and the gate.

### Q8 — When may the isolated-copy restore drill run?

Only after the provider configuration layer is remediated and re-verified (window ≥ 24h,
schedule present, current recovery point) — i.e. after layers A (+B as needed). The
pre-drill gate state is **`BLOCKED_PENDING_DRILL`** today; it becomes
**`READY_FOR_ISOLATED_DRILL`** once layers A–C are verified. The drill uses
synthetic/non-sensitive data, performs zero mutation on Production, and must complete
within the ≤4h RTO.

### Q9 — When is #3460 closure-eligible?

#3460 becomes closure-eligible only at a dedicated completion review after all of:

- provider window remediated and re-verified (≥ 24h) and schedule present;
- daily policy satisfied and weekly/monthly satisfied (externally retained, or verified
  native retention);
- pre-change gate and stale/missing alerting implemented and exercised;
- at least one successful isolated-copy restore drill with sanitized evidence within
  cadence.

Until then #3460 stays OPEN. This decision does not close it.

### Q10 — Why is Production in-place restore excluded?

Production in-place restore is a last-resort, high-risk mutation of the live Production
boundary. Per governance it requires a separate owner approval, has a ≤8h RTO target, and
must never be reachable by normal automation. It is **`NOT_AUTHORIZED`** for this child and
for the routine remediation sequence.

## 4. Remediation sequence layers

| Layer | Scope | Classification |
|---|---|---|
| A | Provider configuration remediation: history window to ≥ 24h; snapshot schedule configured | **`CONFIGURATION_REQUIRED`** + **`OWNER_APPROVAL_REQUIRED`** |
| B | External retained logical backup for weekly ≥ 4 weeks and monthly ≥ 3 months | **`EXTERNAL_RETENTION_REQUIRED`** + **`REPOSITORY_IMPLEMENTATION_REQUIRED`** + **`OWNER_APPROVAL_REQUIRED`** |
| C | Repository pre-change recovery gate (Tier 3 / destructive) | **`REPOSITORY_IMPLEMENTATION_REQUIRED`** |
| D | Stale / missing recovery-point alerting (schedule `NONE`, age stale) | **`REPOSITORY_IMPLEMENTATION_REQUIRED`** |
| E | Isolated-copy synthetic restore drill | **`BLOCKED_PENDING_DRILL`** today → **`READY_FOR_ISOLATED_DRILL`** after A–C |
| F | Production in-place restore | **`NOT_AUTHORIZED`** (last resort, separate owner approval, ≤8h RTO) |

## 5. Current-state classification

| Gap | Current state | Required action | Classification |
|---|---|---|---|
| Restore window | `LT_24H` | raise to ≥ 24h | `CONFIGURATION_REQUIRED` |
| General 24h RPO | `NOT_SATISFIED` | satisfied by window ≥ 24h | `PROVIDER_CAPABILITY_SUFFICIENT` (pending config) |
| Schedule | `NONE` | daily schedule configured | `CONFIGURATION_REQUIRED` |
| DAILY_POLICY | `NOT_SATISFIED` | history ≥ 24h + daily schedule | `PROVIDER_CAPABILITY_SUFFICIENT` (pending config) |
| WEEKLY_POLICY | `NOT_SATISFIED` | ≥ 4 weeks retention | `EXTERNAL_RETENTION_REQUIRED` |
| MONTHLY_POLICY | `NOT_SATISFIED` | ≥ 3 months retention | `EXTERNAL_RETENTION_REQUIRED` |
| Newest recovery point | `GE_7D` (stale) | fresh current point + alert | `REPOSITORY_IMPLEMENTATION_REQUIRED` + remediation |
| Drill | none | isolated-copy drill | `BLOCKED_PENDING_DRILL` |
| Production in-place restore | — | last resort only | `NOT_AUTHORIZED` |

## 6. Final decision

**`RECOVERY_REMEDIATION_SEQUENCE_DEFINED`**

The merged policy and inspection evidence are sufficient to define the exact remediation
sequence and approval boundaries. The sequence is: provider window/schedule remediation →
external logical backup for weekly/monthly → repository pre-change gate + stale/missing
alert → isolated-copy drill → (never in this routine path) Production in-place restore.
No evidence gap blocks the decision; the only unverified sub-question (provider-native
long-term snapshot retention) defaults conservatively to external retention per policy.

## 7. Future-child sequence (max 4, dependency-ordered)

### Child 1 — Owner-approved provider history/schedule remediation (Layer A)

- **Goal:** raise the history window to at least the 24-hour tier and configure a daily
  snapshot schedule on the attributed root branch.
- **Mutation class:** provider configuration (provider mutation, owner-authorized).
- **Owner approval:** required before execution.
- **Prerequisite:** explicit owner approval; re-run the private in-memory attribution gate
  during the session.
- **Success marker:** sanitized re-inspection shows window `GE_24H_LT_7D` or longer,
  schedule `PRESENT` with daily coverage, and `GENERAL_RPO_24H = SATISFIED`.
- **Stop condition:** any non-`VERIFIED_UNIQUE` attribution, failed re-inspection, or
  denied approval — fail closed, no further child.
- **#3460 impact:** remains OPEN.

### Child 2 — External retained logical-backup decision/implementation (Layer B)

- **Goal:** weekly ≥ 4 weeks and monthly ≥ 3 months retained checkpoints via an external
  retained logical backup (only if native retention is not verified sufficient).
- **Mutation class:** external storage writes + repository tooling; provider read-only.
- **Owner approval:** required.
- **Prerequisite:** Child 1 completed and re-verified.
- **Success marker:** sanitized evidence of weekly/monthly checkpoints retained at the
  policy minimums; WEEKLY_POLICY / MONTHLY_POLICY = `SATISFIED`.
- **Stop condition:** insufficient external retention evidence or denied approval.
- **#3460 impact:** remains OPEN.

### Child 3 — Stale/missing recovery-point alert + pre-change recovery gate (Layers C+D)

- **Goal:** alert on schedule absence and stale recovery points; gate Tier 3/destructive
  changes on `RECOVERY_POINT_VALID` (≤1h, change-bound, creation-confirmed) and
  drill-within-cadence.
- **Mutation class:** repository implementation (workflow/test/runtime guarded by Tier 3).
- **Owner approval:** required (Tier 3 boundary).
- **Prerequisite:** Children 1–2 complete so recovery points exist and are current.
- **Success marker:** the gate blocks an intentionally stale/missing state; the alert
  fires on schedule `NONE`; pre-change point gate evaluates `RECOVERY_POINT_VALID` on a
  current point.
- **Stop condition:** any gate bypass, alert miss, or regression.
- **#3460 impact:** remains OPEN.

### Child 4 — Isolated-copy synthetic restore drill + #3460 completion review (Layer E)

- **Goal:** quarterly (and before a Tier 3 DB release) isolated-copy restore drill with
  synthetic data, zero Production mutation, ≤4h RTO, sanitized evidence; then the #3460
  completion review.
- **Mutation class:** isolated copy only (no Production mutation).
- **Owner approval:** required to schedule the drill.
- **Prerequisite:** Children 1–3 complete; gate `READY_FOR_ISOLATED_DRILL`.
- **Success marker:** drill `PASS` with sanitized evidence within cadence; completion
  review finds all closure-eligibility conditions met.
- **Stop condition:** drill `FAIL` / `BLOCKED` (→ `RESTORE_DRILL_OVERDUE`, blocks further
  Tier 3 DB changes) or any Production mutation.
- **#3460 impact:** OPEN until the completion review; only the owner may close at that
  point.

## 8. Privacy self-audit

- No provider account/project/branch/snapshot identifier, project or branch name,
  host/database/region name, database URL, secret, or private material appears in this
  document or in this PR.
- No raw provider response, exact snapshot time, exact schedule time, exact current
  retention value, exact account/project count, or any derived value that could identify a
  resource appears.
- No temporary or local configuration path appears.
- Only the fixed sanitized enums, buckets, policy targets, and the decision vocabulary are
  recorded.
- Manual semantic review (English and Korean) confirms no private or exact-current-state
  value is disclosed.
