# Production-First / Rollback-First Operating Policy

> **Status:** canonical owner-approved operating policy
> **Owner direction:** 2026-08-30
> **Scope:** LoveBud implementation, integration, deployment, Production verification, CI/test ordering, and corrective operations

## 1. Owner operating preference

LoveBud defaults to **Production-first / rollback-first** execution for changes whose prior Production state can be restored safely.

The default objective is not to maximize pre-Production evidence. The objective is to minimize cycle time while keeping a concrete restoration path ready.

Default sequence:

```text
fresh target identification
→ capture rollback anchor
→ implement the bounded change
→ integrate/deploy to Production
→ verify the affected Production behavior immediately
→ KEEP when acceptable
   OR
→ ROLLBACK first when unacceptable
→ diagnose/fix after restoration
→ redeploy
```

Pre-Production tests, preview deployments, fixed slots, Local Validation, full-suite regression, browser matrices, and waiting for all CI lanes are **not default prerequisites** for a reversible Production change.

## 2. Rollback readiness is the primary gate

Before a Production-first mutation, establish the smallest sufficient rollback anchor for the affected surface.

Examples:

```text
source/runtime change
= previous Production commit/deployment identity + known redeploy/revert path

configuration change
= previous exact configuration value/state + restoration command/path

feature flag
= previous flag state + immediate toggle-back path

DB data mutation
= exact affected rows/keys + transaction/backup/snapshot or deterministic inverse operation

DB schema migration
= reversible down path or restorable snapshot/branch/backup

provider routing/binding
= previous route/binding/provider identity + exact restoration path
```

`ROLLBACK_READY = YES` is the normal Production-first gate.

A change is not considered rollback-ready merely because someone believes it is "probably reversible." The prior state or deterministic restoration mechanism must be identifiable.

## 3. Test and CI ordering

For rollback-ready changes, testing is normally **post-Production confidence work**, not a mandatory pre-Production gate.

Preferred order:

```text
Production mutation/deploy
→ immediate Production observation
→ keep or rollback
→ targeted regression/CI/forensic work when useful
```

CI classifications remain useful diagnostic evidence:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

But for an explicitly owner-approved Production-first lane, `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION` is **not by itself an automatic Production/integration blocker** when all of the following hold:

```text
ROLLBACK_READY = YES
SECRET_PRIVATE_BOUNDARY = SAFE
DESTRUCTIVE_IRREVERSIBLE_CHANGE = NO
SEMANTIC_WRITER_COLLISION = NO
OWNER_OR_TASK_PRODUCTION_AUTHORITY = YES
```

Agents must not spend a long cycle trying to make pre-Production CI green solely because a reversible Production change is waiting.

CI failures should still be recorded. If Production behavior is good, diagnose the CI/test contract separately. If Production behavior is bad, rollback before forensic work unless continued observation is required to perform the rollback safely.

## 4. Failure behavior

The failure response is **rollback-first**, not "keep broken Production while investigating."

Default:

```text
Production regression observed
→ stop additional mutation
→ restore previous known-good Production state
→ confirm restoration
→ investigate cause
→ prepare corrected change
→ redeploy
```

Do not repeatedly patch a broken Production state in place when a clean rollback is available.

Do not automatically retry the same failed mutation without understanding whether the retry can worsen state.

## 5. Changes that require stronger preparation

Production-first does not mean blind irreversible mutation.

The following require a restoration mechanism, snapshot/backup, transactional containment, or explicit owner decision before mutation:

- destructive Production data deletion;
- destructive or one-way schema migration;
- identity/auth migration that can strand real users;
- secrets/key rotation where the prior credential cannot be restored;
- payment/billing mutation;
- privacy/security boundary reduction;
- provider/account deletion;
- any mutation with no credible rollback path.

The preferred response is **make rollback possible**, not "build a large pre-Production test program."

If rollback cannot reasonably be made possible, classify:

```text
ROLLBACK_READY = NO
IRREVERSIBLE_RISK = YES
```

and obtain explicit owner authorization for that exact irreversible mutation.

## 6. Database / Production data

For ordinary bounded, reversible Production DB work, the default is not to require a mock/staging rehearsal first.

Preferred sequence:

```text
fresh Production identity and target confirmation
→ establish transaction/snapshot/inverse-operation rollback
→ execute the bounded Production mutation
→ read back the affected result
→ COMMIT/KEEP when correct
   OR
→ ROLLBACK/RESTORE when incorrect
```

Use transaction boundaries where the operation supports them. For operations that cannot be atomically rolled back, capture the smallest sufficient backup/snapshot first.

Never expose private row bodies, credentials, or secrets merely to satisfy an evidence report.

## 7. UI/runtime changes

For reversible UI/runtime changes, the normal lane is:

```text
bounded implementation
→ integrate/deploy
→ direct Production visual/runtime review
→ keep or rollback
→ correction iteration
```

Preview/fixed-slot/local browser evidence is optional unless the owner/task explicitly asks for it.

## 8. GitHub branch protection and integration

Repository protection is infrastructure, not the definition of product acceptance.

Do not silently disable or weaken global branch protection merely to implement this policy.

When a required status check blocks an owner-authorized reversible Production-first integration, use an available **explicit owner/admin-authorized integration/bypass path** if repository permissions permit it. Record that a bypass was used and why.

If repository permissions do not permit bypass, report the mechanical protection blocker. Do not falsify CI, suppress a failing test, or rewrite evidence to manufacture green status.

## 9. Independent review

Independent review remains useful, but it moves after the bounded Production result when the change is rollback-ready.

Preferred:

```text
Production result
→ independent exact-state review
→ retain or follow-up correction
```

For irreversible/high-risk work, independent review may still occur before mutation when it is part of making the rollback/containment plan credible.

## 10. Parallel work safety

Production-first does not weaken writer-collision rules.

Keep:

```text
ONE WRITER PER BRANCH
ONE WRITER PER FILE
ONE WRITER PER SEMANTIC AUTHORITY
```

Do not create two competing Production mutations for the same core authority.

## 11. Secrets and privacy

Production-first never authorizes:

- printing or committing secrets;
- exposing private payloads in logs/reports;
- weakening security/privacy controls merely to speed deployment;
- copying Production credentials into source or chat.

These remain hard blockers.

## 12. Required Production-first report fields

For a Production-first mutation, report at minimum:

```text
TARGET_PRODUCTION_IDENTITY =
CHANGE_SCOPE =
ROLLBACK_ANCHOR =
ROLLBACK_READY = YES / NO
IRREVERSIBLE_RISK = YES / NO
PRE_PRODUCTION_TESTS = SKIPPED_BY_POLICY / USED_BY_EXCEPTION
CI_AT_INTEGRATION = GREEN / EXECUTED_FAILURE / PENDING / UNAVAILABLE / NOT_RUN
PRODUCTION_MUTATION = PERFORMED / NOT_PERFORMED
PRODUCTION_RESULT = PASS / FAIL / PARTIAL / UNKNOWN
ROLLBACK = NOT_NEEDED / PERFORMED / FAILED / NOT_AVAILABLE
RESTORED_KNOWN_GOOD = YES / NO / NA
FOLLOW_UP_FORENSIC = REQUIRED / NOT_REQUIRED
PRIVATE_SECRET_EXPOSURE = NONE
```

## 13. Precedence

This policy is an explicit Product Owner amendment dated 2026-08-30.

When an older LoveBud operating document requires test/CI/preview/Local Validation **before** a rollback-ready Production change solely as a general process rule, this policy supersedes that ordering requirement.

The following remain authoritative and are not superseded:

- secret/private-data protection;
- no destructive overwrite of another worker's state;
- semantic writer/collision ownership;
- exact target/provider identity confirmation;
- explicit authorization for destructive/irreversible Production mutations;
- #1882 protection;
- architecture authority rules that prevent accidental second canonical Product authority.

One-line rule:

```text
identify exact Production target
→ make rollback concrete
→ change Production
→ verify Production immediately
→ keep or restore first
→ test/forensic afterward as useful
```

Refs #1882 — Keep OPEN.
