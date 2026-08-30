# Production-First / Rollback-First Policy

> **Status:** owner-approved operating policy
> **Owner direction:** 2026-08-30
> **Canonical hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Scope:** LoveBud reversible Production runtime/config/deployment/data corrections and Production verification sequencing
> **Refs:** #1882 — Keep OPEN

## 1. Purpose

LoveBud does not use pre-Production testing as the automatic default gate for a reversible Production correction.

For a bounded change that can be safely restored, the preferred operating order is:

```text
fresh Production state
→ smallest reversible change
→ capture rollback point
→ apply to Production
→ immediate post-change verification
→ keep if healthy
→ rollback first if unhealthy
→ investigate and repair after service/state is restored
```

The objective is fast correction with explicit reversibility, not proving every change in staging before touching Production.

## 2. Core rule

For a reversible Production correction, lack of completed local/staging/preview/CI evidence is **not by itself** a Production-mutation blocker.

A worker or CTO must not automatically respond with:

```text
TEST_NOT_COMPLETE → PRODUCTION_FORBIDDEN
CI_RED → PRODUCTION_CORRECTION_FORBIDDEN
PREVIEW_NOT_AVAILABLE → PRODUCTION_CORRECTION_FORBIDDEN
```

Instead, determine whether the requested Production action is authorized, bounded, observable, and reversible.

If those conditions are satisfied, perform the smallest Production correction first and verify immediately afterward.

## 3. Merge CI versus Production correction

Source integration and Production runtime correction are separate gates.

```text
CI_EXECUTED_FAILURE / CI_PENDING_EXECUTION
= source merge blocker
!= automatic blocker for an independently authorized reversible Production correction
```

Do not merge a failing or pending exact head when repository governance forbids it.

However, a separately authorized Production correction may proceed without waiting for that merge when it uses an already permitted Production mechanism and has a verified rollback point.

This policy does not convert an unmerged source candidate into merge authority and does not permit bypassing a task-specific activation/approval contract.

## 4. Required pre-mutation checks

Before a Production-first correction, perform only the checks needed to avoid acting on the wrong target or losing rollback capability:

1. fresh current Production identity/state;
2. exact intended mutation surface;
3. current value/version/SHA/config needed for rollback;
4. whether the operation is reversible in the expected incident window;
5. immediate post-change verification signal;
6. task-specific explicit approval when the governing Issue/runbook requires it;
7. secret/private-output boundary when relevant.

These checks exist to guarantee target correctness and recovery, not to recreate a staging test gate.

## 5. Production-first eligible changes

Typical eligible changes include:

- reversible runtime/config flag updates;
- deployment/version switch with known previous deployment;
- small provider/runtime correction with a restoration path;
- bounded routing/config changes;
- narrowly scoped data correction where the previous value is captured and restoration is supported;
- read-only Production diagnostic/reconciliation sessions when separately authorized by their task contract;
- other changes whose prior state can be restored promptly and whose impact can be observed immediately.

## 6. Changes that require stronger recovery preparation

Production-first does **not** mean blind or irreversible mutation.

Before executing any of the following, establish a credible recovery strategy appropriate to the operation:

- destructive schema migration;
- irreversible data deletion;
- broad overwrite or mass rewrite;
- privilege/security-policy mutation;
- credential rotation without a proven rollback/dual-validity path;
- deletion of provider resources;
- operations whose previous state cannot be reconstructed;
- changes with blast radius that cannot be observed or reversed promptly.

If rollback is unknown or materially unreliable, the operation is not eligible for ordinary Production-first execution.

The purpose of additional pre-work in this case is to secure recovery, not to impose testing for its own sake.

## 7. Failure handling

When a Production-first change produces a material regression:

```text
regression confirmed
→ rollback immediately
→ verify Production recovery
→ preserve evidence
→ investigate root cause
→ prepare next bounded correction
```

Do not keep a broken Production state in place merely to obtain more forensic evidence when rollback is available.

For minor non-material mismatches, use judgment based on user impact and rollback cost, but restoration remains preferred when the intended state is clearly not achieved.

## 8. Test and CI role after the change

Tests, CI, local checks, preview, and browser verification remain useful.

Their default role for a Production-first correction is:

- post-change confirmation;
- regression detection;
- root-cause isolation;
- source-integration readiness;
- preventing recurrence.

They are not automatic prerequisites to a reversible Production correction unless a task-specific owner-approved contract explicitly makes them prerequisites.

## 9. Task-specific approval boundaries remain authoritative

This policy changes the **test-versus-Production sequencing default**. It does not erase explicit approval boundaries.

If an Issue or runbook says that a named Production action requires a fresh explicit owner approval, that approval is still required.

Examples include:

- a one-time Production database session specifically requiring owner authorization;
- destructive Production data/schema/security changes;
- secret/credential mutation;
- an ephemeral activation candidate whose Issue explicitly requires owner approval before activation or connection.

Generic continuation language does not satisfy a task contract that explicitly requires a more specific approval reference.

## 10. Report format

Production lanes should report, where applicable:

```text
PRODUCTION_BEFORE =
CHANGE_APPLIED =
CHANGE_SCOPE =
ROLLBACK_POINT =
PRODUCTION_AUTHORITY =
POST_CHANGE_VERIFY =
RESULT = PASS | FAIL | PARTIAL
ROLLBACK_EXECUTED = YES | NO | NOT_REQUIRED
CURRENT_PRODUCTION =
CI_STATE =
SOURCE_MERGE_STATE =
SECRET_PRIVATE_EXPOSURE = NONE
NEXT_ACTION =
```

Do not confuse `CI_STATE` with `PRODUCTION_AUTHORITY`.

## 11. Prohibited operating habits

Do not:

- delay a reversible Production correction solely because staging/local/CI has not completed;
- treat any red CI shell as automatic prohibition on an independently authorized Production correction;
- leave a known bad Production state active while performing lengthy forensics when rollback is available;
- mutate Production without capturing the rollback point first;
- use this policy to justify destructive or irreversible changes without recovery planning;
- use this policy to bypass a task-specific explicit owner approval requirement;
- expose secrets or private payloads while collecting evidence.

## 12. Precedence

For Production correction sequencing, this policy supersedes older generic language that can be read as:

```text
pre-test first
→ all checks green
→ Production only afterward
```

`MVP_AGENT_GOVERNANCE.md` remains the hard-governance source of truth. Source merge CI rules, parallel writer locks, secret safety, #1882 protection, and explicit task-specific Production approval boundaries remain intact.

`MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` continues to govern ordinary source-merge-to-Production evidence flow, but it does not override this policy for a separately authorized reversible Production correction.

## 13. One-line rule

```text
If the Production correction is authorized + bounded + observable + reversible:
apply the smallest change first, verify immediately, rollback first on failure.
```

Refs #1882 — Keep OPEN.
