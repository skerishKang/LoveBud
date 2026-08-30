# Production-First Verification Workflow

> **Status:** active canonical Production evidence workflow
> **Primary policy:** `PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Owner direction:** 2026-08-30

## 1. Purpose

LoveBud uses the real Production system as the preferred acceptance surface for bounded changes whose previous state can be restored safely.

The normal question is not "did we finish enough pre-merge tests?" It is:

```text
Is the exact Production target known?
Is rollback concrete?
Can we make the bounded change now?
Can we verify the real behavior immediately?
```

## 2. Current operating mode

```text
fresh remote / target / authority inspection
→ capture rollback anchor
→ bounded implementation
→ integrate/deploy when authorized
→ immediate Production verification
→ KEEP when acceptable
   OR
→ ROLLBACK first when unacceptable
→ confirm restoration
→ investigate/fix afterward
→ redeploy
```

Preview, fixed slots, Local Validation, full pre-merge suites, and waiting for all CI lanes are optional for rollback-ready work.

## 3. Rollback anchor by change class

### Source/runtime

Record the previous Production commit/deployment identity and the exact revert/redeploy path.

### UI

Record the previous Production source/deployment. A visual miss normally uses immediate revert or a bounded corrective redeploy.

### Config/feature flag

Record the previous exact value/state and the restoration operation.

### DB data

Use a transaction, deterministic inverse operation, or bounded backup/snapshot for the exact affected rows/keys.

### DB schema

Use a down path or a restorable snapshot/branch/backup. One-way destructive migrations are `IRREVERSIBLE_RISK = YES`.

### Provider/routing/binding

Record the prior provider identity, route, binding, or deployment and the exact restoration path.

## 4. Pre-Production checks

Pre-Production checks are optional unless explicitly required by the task or needed to make rollback credible.

Use them when they are cheaper than likely rollback/rework, for example:

- syntax/parser check for an obvious typo risk;
- targeted contract test for a stateful mutation that would be expensive to reverse;
- read-only identity check to avoid touching the wrong Production resource;
- backup/snapshot verification before a destructive or one-way operation.

Do **not** require generic full-suite execution merely because a source file changed or a PR exists.

## 5. CI

Canonical states remain:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

In the Production-first lane, CI is diagnostic evidence rather than a universal pre-Production permit.

A failing or pending CI lane does not automatically block a rollback-ready owner-authorized Production change when secret/privacy, irreversible-risk, and semantic-collision gates are clear.

Do not falsify or suppress CI. If branch protection mechanically blocks integration, use an explicit owner/admin-authorized bypass path when available or report the mechanical blocker.

## 6. Production verification by class

### U0 — Copy-only

Verify the exact copy/state in Production. If wrong, restore or correct immediately.

### U1 — Visual-only

Verify the affected visual property/state/viewport in Production. Avoid unnecessary full-site screenshot matrices.

### U2 — Structural UI

Verify affected states, layout, focus/visibility/accessibility concerns, and relevant viewports directly in Production.

### U3 — Runtime-sensitive UI

Verify the affected route/action/auth/API/cache/storage behavior and necessary console/network evidence in Production.

### Backend/API

Exercise only the bounded affected behavior needed to determine correctness and collateral safety.

### DB/Auth/Security/Provider

Use the exact task-specific readback and rollback contract. Do not expose secrets or private payloads in reports.

## 7. Production outcomes

### PASS / KEEP

Record the Production evidence and retain the change.

Post-Production CI/regression work may follow when useful for long-term confidence.

### FAIL / ROLLBACK

Default:

```text
stop additional mutation
→ restore previous known-good state
→ verify restoration
→ investigate
→ fix
→ redeploy
```

Do not keep broken Production in place merely to complete forensic analysis.

### PARTIAL / UNCERTAIN

If rollback is clean and the uncertainty is material, prefer restore-first and investigate afterward.

If observation must continue briefly to perform a safe stateful rollback, restrict activity to what is required for restoration.

## 8. Integration rules

Before an authorized Production-first integration:

1. identify exact current Production/main/PR/provider target;
2. confirm branch/file/semantic-authority collision status;
3. record rollback anchor;
4. classify irreversible risk;
5. confirm secret/privacy boundary safety;
6. integrate/deploy through an allowed repository/provider path;
7. verify Production immediately;
8. keep or rollback.

Independent review may occur after the Production result for rollback-ready work. Irreversible/high-risk work may still use pre-mutation review when it is needed to make containment credible.

## 9. GitHub protection

Do not silently disable required checks or global branch protection.

When a required check is the only mechanical blocker to an explicitly owner-authorized rollback-ready Production-first change, an available owner/admin bypass path may be used. Record the bypass, exact head, rollback anchor, and Production result.

If bypass is unavailable, report `MECHANICAL_PROTECTION_BLOCKER` rather than fabricating green status.

## 10. Report template

```text
[Production-First Evidence Report]

Issue / PR:
Target Production identity:
Exact source head:
Change scope:
Active semantic authority / writer:
Parallel class: GREEN / YELLOW / RED
Rollback anchor:
Rollback ready: YES / NO
Irreversible risk: YES / NO
Pre-Production tests: SKIPPED_BY_POLICY / USED_BY_EXCEPTION
CI at integration: GREEN / EXECUTED_FAILURE / PENDING / UNAVAILABLE / NOT_RUN
Integration/bypass authority:
Production mutation: PERFORMED / NOT_PERFORMED
Production result: PASS / FAIL / PARTIAL / UNKNOWN
Rollback: NOT_NEEDED / PERFORMED / FAILED / NOT_AVAILABLE
Known-good restored: YES / NO / NA
Follow-up forensic: REQUIRED / NOT_REQUIRED
Secret/private exposure: NONE
```

## 11. Governance boundary

Production-first does not weaken:

- secret/private-data protection;
- exact target/provider identity confirmation;
- no destructive overwrite of another worker's state;
- one-writer semantic authority;
- shared Love platform architecture authority;
- explicit authorization for genuinely irreversible mutations;
- #1882 protection.

It **does** supersede generic process rules that require tests/Preview/Local Validation/full CI green before a rollback-ready Production change.

Refs #3994.
Refs #3664.
Refs #3662.
Refs #3513.
Refs #1882 — Keep OPEN.
