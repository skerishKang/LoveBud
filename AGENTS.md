# LoveBud Agent Guidance

This file is the repository-wide entrypoint for LoveBud work.

## 1. Guidance hierarchy

Current owner-approved precedence:

1. `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md` — **Production-first / rollback-first execution order**, owner direction 2026-08-30.
2. `docs/ops/MVP_AGENT_GOVERNANCE.md` — hard blockers, authority, role and parallel-work governance.
3. `docs/architecture/SHARED_LOVE_PLATFORM_AUTHORITY.md` — shared LoveBud/LoveTree Product auth/backend/data authority.
4. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` — separated execution roles.
5. `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md` — owner-approved autonomous implementation lane.
6. `docs/project/UI_RAPID_ITERATION_LANE.md` — UI U0/U1/U2/U3 classification.
7. relevant product/design/engineering/ops source-of-truth documents.

When an older document requires tests, Preview, Local Validation, full CI green, or independent review **before** a rollback-ready Production change solely as a generic process rule, the 2026-08-30 Production-first policy wins.

## 2. Core operating rule

LoveBud now defaults to:

```text
identify exact Production target
→ capture a concrete rollback anchor
→ implement the bounded change
→ integrate/deploy to Production
→ verify affected Production behavior immediately
→ KEEP when correct
   OR
→ ROLLBACK first when incorrect
→ diagnose/fix after restoration
→ redeploy
```

The default is **not** "test until confident, then touch Production." The default is **"make restoration concrete, change Production, then verify the real system."**

For rollback-ready changes, pre-Production tests, Preview/fixed slots, Local Validation, browser matrices, and waiting for every CI lane are optional unless the owner/task explicitly requires them.

## 3. Hard standing rules

These remain mandatory:

- Never expose or commit secrets, credentials, cookies, sessions, tokens, private keys, database URLs, authorization headers, or private payloads.
- Never destructively overwrite another worker's branch, worktree, stash, staged, untracked, or uncommitted state.
- Never create competing writers for the same branch/file/core semantic authority.
- Destructive or genuinely irreversible Production data/schema/security/auth/provider mutations require an explicit rollback/containment mechanism or exact owner authorization for the irreversible action.
- Confirm the exact target/provider/account/database/branch identity before a Production mutation.
- Never close #1882; use `Refs #1882` only.

### CI is no longer a universal pre-Production blocker

Use the canonical states:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

They remain useful evidence. However, in the owner-approved Production-first lane, `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION` does **not by itself** block integration/Production when:

```text
ROLLBACK_READY = YES
SECRET_PRIVATE_BOUNDARY = SAFE
DESTRUCTIVE_IRREVERSIBLE_CHANGE = NO
SEMANTIC_WRITER_COLLISION = NO
OWNER_OR_TASK_PRODUCTION_AUTHORITY = YES
```

Do not falsify CI or suppress tests to manufacture green status. If repository protection mechanically blocks integration, use an explicit owner/admin-authorized bypass path when available; otherwise report the mechanical blocker.

## 4. Shared Love platform authority

For Auth, Firebase, Neon, Cloudflare Worker, DB/schema/data, shared API, provider config, Preview/Production routing, or mutable E2E infrastructure, read the current authorities first:

```text
LoveBud#4004
LoveTree#152
LoveBud#4005 when DB/schema/data is involved
LoveBud#4006 when auth/identity is involved
```

Current Product architecture during migration remains:

```text
LoveBud + LoveTree
= ONE Product authentication authority
= ONE shared backend/API authority
= ONE canonical writable Tree/Memory/social data authority
```

Classify new/reused resources as:

```text
CANONICAL_PRODUCT_AUTHORITY
TRANSITIONAL_BRIDGE_NONCANONICAL
TEST_ISOLATION_ONLY
PROTOTYPE_ONLY
HISTORICAL_EVIDENCE_ONLY
UNKNOWN_STOP
```

`UNKNOWN_STOP` means do not mutate until the target is identified. This is identity/architecture safety, not a test-before-Production requirement.

Never promote an isolated test resource into Product authority merely because it exists or passes tests.

## 5. Rollback readiness

Before a reversible Production mutation, capture the smallest sufficient rollback anchor.

Examples:

- source/runtime: previous Production commit/deployment identity and known redeploy/revert path;
- config/flag: previous exact value/state and restoration path;
- DB data: affected keys plus transaction, deterministic inverse operation, or backup/snapshot;
- DB schema: down path or restorable snapshot/branch/backup;
- routing/binding/provider: prior exact route/binding/provider identity and restoration path.

`ROLLBACK_READY = YES` is the normal Production-first gate.

If rollback is not credible, make rollback possible first. If it genuinely cannot be made possible, classify `IRREVERSIBLE_RISK = YES` and require explicit owner authorization for that exact mutation.

## 6. Default roles

```text
Web CTO
Web Developer / designated implementation owner
Local Validation when specifically useful
```

Roles are responsibilities, not mandatory serial pre-Production gates.

### Web CTO

Owns target/architecture/risk classification, collision control, rollback sufficiency, exact remote review, Production result judgment, and integration decisions when authorized.

### Web Developer / implementation owner

Implements bounded changes, preserves rollback information, integrates/deploys when authorized, and reports the exact Production result. Focused tests may be used when they materially reduce rework, but they are not a default pre-Production requirement for rollback-ready work.

### Local Validation

Is optional evidence unless the task specifically needs a local/environment reproduction. It is no longer a default prerequisite before Production.

An owner-approved autonomous advanced/frontier worker may self-select a bounded non-conflicting Issue and implement it after fresh collision/authority checks.

## 7. Production-first lifecycle

Default reversible lane:

```text
user request
→ fresh remote/target/authority check
→ bounded implementation
→ rollback anchor captured
→ owner/task-authorized integration/deploy
→ immediate Production verification
→ keep OR rollback first
→ post-Production CI/test/forensic work when useful
```

Do not keep Production broken while performing a long forensic cycle when a known-good rollback is available.

Do not automatically retry a failed stateful mutation until retry safety is understood.

## 8. UI Rapid Iteration Lane

Classify UI work:

```text
U0 — copy-only
U1 — visual-only
U2 — structural UI
U3 — runtime-sensitive UI
```

For rollback-ready U0/U1/U2 and ordinary reversible U3 changes, prefer direct Production observation after integration rather than mandatory Preview/Local/browser proof first.

Escalation changes the rollback/observation plan, not automatically the amount of pre-Production testing.

## 9. Backend / DB / Auth / provider work

Production-first also applies to bounded reversible backend/DB/provider work.

Preferred DB pattern:

```text
fresh Production identity
→ transaction/snapshot/inverse-operation rollback ready
→ bounded Production mutation
→ immediate readback
→ COMMIT/KEEP when correct
   OR
→ ROLLBACK/RESTORE when incorrect
```

Do not require staging/mock rehearsal merely by habit.

Stronger preparation is required for destructive/one-way schema change, un-restorable credential rotation, real-user identity migration, billing, privacy/security weakening, provider/account deletion, or any mutation without a credible restore path.

## 10. Browser and Production verification

Evidence levels remain useful:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

But Production evidence is preferred for rollback-ready changes.

- Preview/fixed slot is optional unless assigned.
- Static local browser evidence is limited for dynamic/auth/API behavior.
- Production verification should inspect only the affected behavior and necessary collateral surfaces.
- Final subjective UI acceptance belongs to Web CTO/user.

## 11. Test selection

Tests are selected for diagnostic value and post-Production confidence, not because a PR exists.

Do not automatically require:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

before a rollback-ready Production change.

Use focused checks before Production only when they are cheaper than likely rollback/rework or are explicitly requested. Run broader CI/regression afterward when useful for long-term confidence.

If a CI failure conflicts with good Production behavior, investigate the CI/test contract separately rather than immediately reverting good Product behavior solely to satisfy a generic test gate.

## 12. Branch and parallel safety

Keep:

```text
ONE WRITER PER BRANCH
ONE WRITER PER FILE
ONE WRITER PER SEMANTIC AUTHORITY
```

Do not force-push/reset `main` or another worker's active branch. Preserve unrelated state.

Feature branches/PRs remain the normal integration mechanism when repository protection requires them. Production-first does not mean silently disabling global branch protection.

## 13. Current runtime

- Production frontend: `https://lovebud.pages.dev/`
- Entry/runtime: Cloudflare Pages and same-origin `/api/*`
- Primary backend/compute: Modal
- Database: Neon where applicable
- Vercel: secondary/transitional
- Netlify: legacy artifact, not active fallback

Shared-platform convergence remains governed by #4004/#152.

## 14. Required Production-first report

Use at minimum:

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

## 15. Session startup

Recommended order:

1. `AGENTS.md`
2. `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`
3. `docs/ops/MVP_AGENT_GOVERNANCE.md`
4. `docs/architecture/SHARED_LOVE_PLATFORM_AUTHORITY.md` when relevant
5. current remote Issue/PR/diff/provider identity
6. only the detailed process documents needed for the task

Historical task reports are evidence, not current authority.

## 16. One-line operating rule

```text
fresh target + architecture authority
→ concrete rollback
→ bounded Production change
→ immediate Production verification
→ keep or restore first
→ test/forensic afterward as useful
```

Refs #1882 — Keep OPEN.
