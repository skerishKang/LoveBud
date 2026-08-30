# LoveBud PR Checklist

> **Primary execution policy:** `PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Owner direction:** 2026-08-30

## 1. Every change / PR

### Baseline

- [ ] exact current `main`, PR base/head, Production target, and provider/database identity are known where relevant;
- [ ] related open PRs/Issues and active writer are checked;
- [ ] branch/file/semantic-authority overlap is classified (`GREEN` / `YELLOW` / `RED`);
- [ ] changed files are within scope;
- [ ] no secrets/private payloads or unrelated artifacts are exposed;
- [ ] #1882 uses `Refs #1882` only.

### Rollback gate

Before an owner/task-authorized Production mutation:

- [ ] rollback anchor is concrete;
- [ ] `ROLLBACK_READY = YES`, or the exact irreversible mutation has explicit owner authorization;
- [ ] prior Production source/deployment/config/data state needed for restoration is identified;
- [ ] rollback operation is known;
- [ ] semantic writer collision is clear;
- [ ] destructive irreversible risk is classified;
- [ ] secret/privacy boundary remains safe.

Rollback readiness, not generic test completion, is the normal Production-first gate.

## 2. PR / completion description

Include:

```text
Objective / user-visible outcome
Exact target Production identity
Exact source head
Change scope
Active semantic authority / writer
Parallel class: GREEN / YELLOW / RED
Rollback anchor
Rollback ready: YES / NO
Irreversible risk: YES / NO
Pre-Production tests: SKIPPED_BY_POLICY / USED_BY_EXCEPTION
CI at integration: GREEN / EXECUTED_FAILURE / PENDING / UNAVAILABLE / NOT_RUN
Integration/bypass authority
Production verification scope
Production result: PASS / FAIL / PARTIAL / UNKNOWN
Rollback: NOT_NEEDED / PERFORMED / FAILED / NOT_AVAILABLE
Known-good restored: YES / NO / NA
Follow-up forensic: REQUIRED / NOT_REQUIRED
Secret/private exposure: NONE
```

## 3. Pre-Production tests

Pre-Production tests are not mandatory by default for rollback-ready changes.

Use a focused check before Production only when:

- it is materially cheaper than likely rollback/rework;
- it is needed to avoid touching the wrong Production identity;
- it is needed to prove that rollback/backup/transaction containment actually exists;
- the owner/task explicitly requests it;
- the mutation is irreversible/high-risk and the check is part of containment.

Do not require a full suite merely because a PR exists, multiple files changed, or source code changed.

## 4. CI

Use:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

These are evidence classifications, not universal Production permits.

For an owner-approved rollback-ready Production-first change, a failing or pending relevant lane does not automatically block integration if:

```text
ROLLBACK_READY = YES
SECRET_PRIVATE_BOUNDARY = SAFE
DESTRUCTIVE_IRREVERSIBLE_CHANGE = NO
SEMANTIC_WRITER_COLLISION = NO
OWNER_OR_TASK_PRODUCTION_AUTHORITY = YES
```

Never falsify, suppress, or rewrite a failing test merely to get green status.

If branch protection mechanically blocks integration, use an explicit owner/admin-authorized bypass path when available. Otherwise report the blocker.

## 5. UI classification

Every UI change may still declare one class:

```text
U0 — copy-only
U1 — visual-only
U2 — structural UI
U3 — runtime-sensitive UI
```

The class controls Production verification and rollback scope, not an automatic quantity of pre-Production testing.

### U0

- [ ] previous Production source/deployment is known;
- [ ] verify the exact copy in Production;
- [ ] revert/correct immediately if wrong.

### U1

- [ ] previous Production source/deployment is known;
- [ ] verify the exact visual property/state/viewport in Production;
- [ ] rollback/correct immediately if wrong.

### U2

- [ ] identify affected structural states/viewports;
- [ ] verify layout/focus/visibility/accessibility concerns directly in Production;
- [ ] rollback when a material structural regression appears.

### U3

- [ ] identify affected route/action/auth/API/cache/storage/runtime behavior;
- [ ] verify only necessary runtime/network/console behavior in Production;
- [ ] rollback material runtime regression before long forensic work.

Preview/fixed slots and pre-merge screenshots are optional unless explicitly requested.

## 6. Backend / database / auth / provider

For reversible bounded work:

```text
fresh Production target
→ rollback transaction/snapshot/inverse operation ready
→ bounded Production mutation
→ immediate readback
→ KEEP/COMMIT or ROLLBACK/RESTORE
```

A staging/mock rehearsal is not required merely because the change involves a DB or backend.

Stronger preparation is required for:

- destructive data deletion;
- one-way/destructive schema migrations;
- user-stranding auth/identity changes;
- un-restorable secret/key rotation;
- payment/billing mutation;
- privacy/security weakening;
- provider/account deletion;
- any mutation with no credible rollback path.

The preferred mitigation is to create a credible rollback/containment mechanism rather than building a broad pre-Production test program.

## 7. Browser / Production verification

Production is the preferred acceptance surface for rollback-ready work.

- U0: verify exact copy/state.
- U1: verify exact visual delta.
- U2: verify affected states/layouts/viewports.
- U3: verify affected runtime behavior.
- backend/data/auth/provider: verify the bounded affected contract and readback.

Do not automatically run a site-wide journey or screenshot matrix when only a narrow surface changed.

## 8. Failure handling

Material Production failure:

```text
stop additional mutation
→ rollback/restore previous known-good state
→ confirm restoration
→ investigate cause
→ fix
→ redeploy
```

Do not keep broken Production live solely to inspect it longer when rollback is available.

Do not blindly retry stateful mutations.

## 9. Post-Production test / forensic work

After Production has been kept or restored, run targeted tests/CI/forensic analysis when useful for:

- preventing recurrence;
- repairing a stale test contract;
- confirming broader shared-module safety;
- documenting the cause of a rollback;
- improving the next deployment.

If Production is correct but an old test fails, do not automatically treat Product behavior as wrong. Compare the test contract to the intended Product behavior.

## 10. Parallel work

Keep:

```text
ONE WRITER PER BRANCH
ONE WRITER PER FILE
ONE WRITER PER SEMANTIC AUTHORITY
```

`GREEN` allows independent writes. `YELLOW` sequences writes while allowing read/review/forensic parallelism. `RED` means one writer only.

Production-first does not authorize competing Production writers.

## 11. Branch protection / merge

- Do not silently disable global branch protection.
- Do not force-push/reset `main`.
- Do not fabricate CI success.
- An explicit owner/admin bypass may be used for an owner-authorized rollback-ready Production-first change if repository permissions allow it.
- Record exact head, bypass reason, rollback anchor, and Production result.

## 12. Final status vocabulary

```text
ROLLBACK_READY_FOR_PRODUCTION
PRODUCTION_DEPLOYED
PRODUCTION_PASS_KEEP
PRODUCTION_FAIL_ROLLED_BACK
PRODUCTION_PARTIAL_RESTORED
MECHANICAL_PROTECTION_BLOCKER
IRREVERSIBLE_OWNER_AUTH_REQUIRED
FOLLOW_UP_FORENSIC_REQUIRED
```

These describe operational state; they do not override secret/privacy, collision, architecture-authority, or #1882 rules.

Refs #3994.
Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
