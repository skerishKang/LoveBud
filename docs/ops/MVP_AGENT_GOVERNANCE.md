# MVP Agent Governance

> **Status:** canonical source of truth — owner-approved
> **Latest owner amendment:** Production-first / rollback-first operating direction, 2026-08-30
> **Primary execution policy:** `PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`

This document defines LoveBud hard blockers, authority, CI interpretation, integration rules, parallel writer ownership, and role governance. The 2026-08-30 owner amendment changes the default order from **pre-Production validation first** to **rollback-ready Production first**.

## 1. Authority and precedence

Current precedence for execution ordering:

```text
PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md
→ this governance document
→ focused role/UI/test/verification documents
→ historical runbooks/task reports
```

Older language that makes generic tests, Preview, Local Validation, full CI green, or independent review mandatory **before** a rollback-ready Production change is superseded.

## 2. Hard standing rules

Only the following remain universal blockers:

1. Never expose or commit secrets, credentials, cookies, sessions, tokens, private keys, database URLs, authorization headers, or private payloads.
2. Never destructively delete, overwrite, reset, clean, drop, or force-update another worker's branch, worktree, stash, staged, untracked, or uncommitted state.
3. Never create competing writers for the same branch, file, or core semantic authority.
4. Confirm the exact Production/provider/database/account/branch identity before mutation.
5. Destructive or genuinely irreversible Production data/schema/security/auth/provider changes require either a concrete restoration/containment mechanism or explicit owner authorization for that exact irreversible action.
6. Do not falsify CI, suppress a failing test, or manipulate evidence to manufacture a PASS.
7. Never close #1882; use `Refs #1882` only.

## 3. Production-first default

For a bounded change with a credible restoration path:

```text
fresh target/authority check
→ capture rollback anchor
→ implement
→ integrate/deploy to Production
→ immediate Production verification
→ KEEP if correct
   OR
→ ROLLBACK first if incorrect
→ diagnose/fix after restoration
→ redeploy
```

`ROLLBACK_READY = YES` is the normal gate.

Pre-Production tests, Preview/fixed slots, Local Validation, browser matrices, full-suite regression, and waiting for all CI lanes are not default prerequisites.

## 4. CI classification

Use exactly:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

These remain factual classifications, but they are no longer universal pre-Production merge gates.

For the owner-approved Production-first lane, `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION` does not automatically block integration when:

```text
ROLLBACK_READY = YES
SECRET_PRIVATE_BOUNDARY = SAFE
DESTRUCTIVE_IRREVERSIBLE_CHANGE = NO
SEMANTIC_WRITER_COLLISION = NO
OWNER_OR_TASK_PRODUCTION_AUTHORITY = YES
```

If branch protection mechanically requires a check, use an explicit owner/admin-authorized bypass when available. Do not silently weaken global protection. If bypass is unavailable, report the mechanical blocker.

## 5. Rollback readiness

A rollback anchor must identify the prior known-good state or deterministic inverse path.

Examples:

```text
code/runtime  = prior Production commit/deployment
config/flag   = prior exact value/state
DB data       = transaction, inverse operation, backup, or snapshot
DB schema     = down migration or restorable snapshot/branch/backup
provider      = prior exact route/binding/account identity
```

If rollback cannot be made credible:

```text
ROLLBACK_READY = NO
IRREVERSIBLE_RISK = YES
```

and exact owner authorization is required before the irreversible mutation.

## 6. Shared Love platform authority

For Auth/Firebase/Neon/Cloudflare Worker/DB/schema/data/shared API/provider/routing work, fresh-read the controlling shared-platform authorities:

```text
LoveBud#4004
LoveTree#152
LoveBud#4005 when DB/schema/data is involved
LoveBud#4006 when auth/identity is involved
```

Current architecture remains one Product authentication authority, one shared backend/API authority, and one canonical writable Tree/Memory/social data authority.

Classify provider/database/auth resources as:

```text
CANONICAL_PRODUCT_AUTHORITY
TRANSITIONAL_BRIDGE_NONCANONICAL
TEST_ISOLATION_ONLY
PROTOTYPE_ONLY
HISTORICAL_EVIDENCE_ONLY
UNKNOWN_STOP
```

`UNKNOWN_STOP` means identify the exact target before mutation. This architecture/identity gate is not a requirement to run tests first.

## 7. Roles

Default roles remain:

```text
Web CTO
Web Developer / designated implementation owner
Local Validation when useful
```

Roles do not imply a mandatory serial pre-Production chain.

### Web CTO

Owns architecture/target/risk classification, collision control, rollback sufficiency, remote review, Production result judgment, and integration when authorized.

### Web Developer / implementation owner

Implements bounded work and may integrate/deploy when task/owner authority allows it. Focused tests are optional when they materially reduce expected rework.

### Local Validation

Is invoked only when a local/environment reproduction materially helps. It is not a default prerequisite before Production.

### Autonomous frontier implementation

An advanced/frontier-capability worker may self-select a bounded non-conflicting Issue after fresh remote and authority inspection. It must still obey rollback, secret, architecture, and collision rules.

## 8. Parallel multi-model authority

Keep:

```text
GREEN  = branch/path/semantic authority independent → parallel implementation allowed
YELLOW = files differ but semantic authority shared → read/review/forensic parallel; writes sequenced
RED    = same branch/file/core authority → one active writer only
```

Representative semantic authorities include Auth/session/account/token, DB schema/migration/transport, API runtime/routing, Tree/Memory/social writes, visibility, ownership mapping, and shared platform runtime.

Production-first never authorizes two competing Production mutations for the same authority.

## 9. UI lane

UI classes remain:

```text
U0 copy-only
U1 visual-only
U2 structural UI
U3 runtime-sensitive UI
```

The class determines rollback/observation scope. It no longer automatically determines how much pre-Production testing must be completed.

For reversible UI work, Production visual/runtime confirmation is the preferred first real acceptance surface.

## 10. Backend / DB / Auth / security

The UI fast lane does not define these surfaces. However, Production-first still applies when the change is bounded and reversible.

Preferred DB pattern:

```text
fresh Production identity
→ transaction/snapshot/inverse-operation ready
→ bounded Production mutation
→ immediate readback
→ COMMIT/KEEP or ROLLBACK/RESTORE
```

Stronger preparation is required for destructive/one-way schema changes, un-restorable secret rotation, identity migrations that can strand users, payment/billing, privacy/security reductions, provider deletion, and any no-rollback mutation.

## 11. Testing and evidence

Testing is selected for diagnostic value, not as a ritual gate.

For rollback-ready work:

```text
Production first
→ immediate Production observation
→ keep or rollback
→ targeted CI/test/forensic work afterward when useful
```

Pre-Production focused checks remain allowed when they are cheaper than likely rollback/rework or explicitly requested.

A good Production result can coexist with a broken or stale test contract. Do not automatically revert correct Product behavior merely to satisfy generic pre-existing test assumptions; classify and repair the test contract separately when appropriate.

## 12. Failure behavior

When a material Production regression appears and a known-good restore path exists:

```text
stop additional mutation
→ rollback/restore
→ confirm restoration
→ investigate
→ fix
→ redeploy
```

Rollback precedes long forensic analysis by default.

Do not repeatedly patch a broken Production state in place when clean restoration is available.

## 13. Branch protection and integration

Feature branches/PRs remain the normal mechanism when repository protection requires them.

Production-first does not authorize silent global protection weakening, force-pushing `main`, or fabricated green checks.

When an owner-authorized reversible Production change is mechanically blocked only by a required check, an explicit owner/admin bypass path may be used if repository permissions allow it. Record the bypass and rollback anchor.

## 14. Required report

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

## 15. New restriction protocol

A new mandatory blocker must still include:

```text
restriction
reason
scope
development-speed impact
alternatives
traceable owner approval
```

Without owner approval it is `RECOMMENDATION_ONLY`.

## 16. One-line rule

```text
exact Production target
→ concrete rollback
→ bounded Production mutation
→ immediate Production verification
→ keep or restore first
→ test/forensic afterward as useful
```

Refs #3994.
Refs #3664.
Refs #3662.
Refs #3642.
Refs #3442.
Refs #1882 — Keep OPEN.
