# Impact-Based Test Execution Policy

> **Status:** current test-selection policy
> **Primary execution policy:** `PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Owner direction:** 2026-08-30

## 1. Purpose

LoveBud does not treat pre-Production testing as the default path for rollback-ready work.

The preferred sequence is:

```text
fresh target/authority check
→ rollback anchor
→ bounded implementation
→ Production integration/deploy
→ immediate Production verification
→ keep or rollback
→ targeted test/CI/forensic work afterward when useful
```

Tests are selected for diagnostic value and recurrence prevention, not as a ritual permit to touch Production.

## 2. Pre-Production testing

Pre-Production checks are optional for rollback-ready changes.

Use them before Production only when one or more apply:

```text
P1_WRONG_TARGET_PREVENTION
P2_ROLLBACK_MECHANISM_PROOF
P3_IRREVERSIBLE_RISK_CONTAINMENT
P4_CHEAPER_THAN_EXPECTED_ROLLBACK
P5_EXPLICIT_OWNER_OR_TASK_REQUEST
```

### P1_WRONG_TARGET_PREVENTION

Use read-only identity/authority checks when needed to avoid mutating the wrong Production database, provider, branch, deployment, account, or route.

### P2_ROLLBACK_MECHANISM_PROOF

Use a focused check when needed to prove the backup/snapshot/transaction/down-path or other restoration mechanism actually exists.

### P3_IRREVERSIBLE_RISK_CONTAINMENT

Use focused evidence for destructive/one-way data/schema/auth/security/provider actions where rollback is weak or unavailable.

### P4_CHEAPER_THAN_EXPECTED_ROLLBACK

Use a small syntax/contract/build check when it is clearly faster and cheaper than the expected Production rollback/redeploy cycle.

### P5_EXPLICIT_OWNER_OR_TASK_REQUEST

Run the exact requested pre-Production check when the owner/task explicitly requires it.

## 3. What is not a reason to test first

The following do not by themselves justify pre-Production testing:

- a PR exists;
- source code changed;
- multiple files changed;
- the repository has a test suite;
- a previous PR used Local Validation;
- CI is available;
- a merge-forward occurred without relevant semantic overlap;
- a test can be run "just in case."

## 4. CI role

Use the factual states:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

CI remains valuable for diagnosis and long-term confidence.

For an explicitly owner-authorized rollback-ready Production-first change, `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION` is not by itself a Production/integration blocker when the canonical rollback/safety conditions are satisfied.

Never alter or suppress a failing test merely to manufacture green status.

If branch protection mechanically prevents integration, use an explicit owner/admin-authorized bypass when available or report `MECHANICAL_PROTECTION_BLOCKER`.

## 5. Local Validation

Local Validation is optional and should be used after Production when it helps diagnose a real failure or coverage gap.

Useful post-Production triggers include:

```text
L1_PRODUCTION_FAILURE_REPRODUCTION
L2_CI_FAILURE_REPRODUCTION
L3_CI_COVERAGE_GAP
L4_PRISTINE_MAIN_COMPARISON
L5_BROWSER_RUNTIME_FORENSIC
L6_BROAD_SHARED_REGRESSION
L7_CI_OR_TEST_INFRA_CHANGE
```

Do not open a Local cycle merely to duplicate a lane that already ran elsewhere.

## 6. Production result determines immediate action

### Production PASS

Keep the change.

Run targeted tests/CI afterward when useful to:

- prevent recurrence;
- document confidence;
- detect collateral shared-module issues;
- repair stale tests;
- improve future rollback/observability.

A Production PASS with an old failing test is a contract discrepancy to investigate; it is not automatic proof that Product behavior must be reverted.

### Production FAIL

Default:

```text
rollback/restore first
→ confirm known-good state
→ build smallest reproducer
→ diagnose
→ fix
→ redeploy
```

Do not keep a broken Production state active while repeatedly running broad suites when a clean restore path exists.

## 7. Test scope after Production

Start with the smallest reproducer for the observed or plausible issue.

Examples:

```text
syntax/parser check
focused unit/contract/integration test
changed-module or route-specific test
page-specific static/CSS check
relevant typecheck/lint/build slice
pristine-main comparison
exact failing CI lane
```

Escalate to broader regression only when a shared contract or failure pattern justifies it.

## 8. No universal full-suite rule

A full or near-full suite is warranted only when it materially answers a real question, for example:

- CI/test infrastructure itself changed;
- broad shared runtime behavior changed;
- a failure cannot be isolated narrowly;
- an explicit task requires broad regression;
- post-Production evidence suggests collateral impact beyond the changed surface.

Do not run the full suite solely because it exists.

## 9. Database / auth / provider

Testing policy does not replace rollback policy.

For bounded reversible Production work, prefer:

```text
exact Production identity
→ transaction/snapshot/inverse operation ready
→ Production mutation
→ immediate readback
→ keep or rollback
```

For irreversible/high-risk work, use the minimum pre-mutation evidence necessary to make containment credible and obtain exact owner authorization where required.

## 10. Reports

When tests are used, report:

```text
Production state tested against
reason test was selected
pre-Production or post-Production
exact command/flow
exact failure or pass
whether Product was kept or restored
whether the test contract appears current or stale
remaining follow-up
```

Do not present a test PASS as stronger than direct affected Production behavior when the test does not exercise the same contract.

## 11. Precedence

This policy supersedes older universal sequences such as:

```text
focused tests
→ CI GREEN
→ Local Validation
→ review
→ Production
```

for rollback-ready changes.

The current default is:

```text
rollback ready
→ Production
→ immediate verification
→ keep or restore
→ tests/CI/forensic afterward as useful
```

Secret/privacy protections, exact target identity, semantic writer locks, shared Love platform architecture authority, irreversible-risk authorization, and #1882 protection remain hard governance.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
