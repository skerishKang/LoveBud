# LoveBud PR Checklist

> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Role model:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **Test execution:** `IMPACT_BASED_TEST_EXECUTION_POLICY.md`
> **UI fast lane:** `../project/UI_RAPID_ITERATION_LANE.md`

## 1. Every PR

### Baseline

- [ ] current `main`, PR base, merge base, and exact head verified;
- [ ] related open PRs/Issues and active writer checked;
- [ ] changed files are within scope;
- [ ] affected behavior and plausible regression area identified;
- [ ] no secrets/private payloads or unrelated artifacts;
- [ ] protected Issue wording is correct;
- [ ] #1882 uses `Refs #1882` only.

### PR description

Include:

```text
Objective / user-visible outcome
Risk or UI class
Classification reason
Changed files
Behavior explicitly unchanged
Affected behavior / blast radius
Focused tests and counts
CI classification
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
Local trigger code(s), when applicable
Browser evidence: USED / NOT_USED / NOT_REQUIRED
Production verification remaining
Known limitations
Exact head SHA
```

### Before merge

- [ ] remote cumulative diff reviewed;
- [ ] changed files reviewed;
- [ ] relevant CI state classified correctly;
- [ ] required evidence for the change class is present;
- [ ] Local Validation, if used, has a declared trigger and exact tested head;
- [ ] no local lane was rerun merely to duplicate already-green exact-head CI without an additional evidence reason;
- [ ] exact expected head re-checked;
- [ ] squash merge selected.

## 2. UI classification

Every UI PR must declare one class.

### U0 — Copy-only

Examples: typo, label, helper text, translation, non-behavioral aria copy.

Checklist:

- [ ] exact before/after copy recorded;
- [ ] no DOM/event/validation/routing/auth/API/data/cache/storage change;
- [ ] syntax/static/focused copy check completed when relevant;
- [ ] Local Validation marked `NOT_REQUIRED` unless a dynamic-copy gap exists;
- [ ] Production copy confirmation planned.

Not automatically required:

- new child Issue;
- full suite;
- Local Validation;
- preview/fixed slot;
- screenshots;
- desktop/mobile journey QA.

### U1 — Visual-only

Examples: page-scoped color, spacing, typography, radius, shadow, border, simple visual token.

Checklist:

- [ ] exact selector/token/value delta recorded;
- [ ] page-scoped versus shared impact checked;
- [ ] no DOM/read-order/focus/visibility/runtime behavior changed;
- [ ] focused CSS/static check completed when available;
- [ ] Local Validation marked `NOT_REQUIRED` unless explicitly justified;
- [ ] Production visual confirmation planned.

Escalate to U2/U3 for responsive structure, show/hide semantics, broad global/shared CSS, JavaScript, auth/API/data/cache/storage, or accessibility behavior.

### U2 — Structural UI

Examples: DOM/card composition, skeleton/loading shell, responsive structure, visibility/focus/accessibility semantics, multi-page shared UI.

Checklist:

- [ ] target states and affected viewports defined;
- [ ] focused DOM/layout/accessibility contracts added or run;
- [ ] UI Lab/prototype used when live data/auth would slow visual iteration;
- [ ] Local/browser evidence requirement explicitly decided;
- [ ] affected layout/overflow screenshots captured when required;
- [ ] Production visual acceptance planned.

### U3 — Runtime-sensitive UI

Examples: JavaScript interaction, auth, API/data loading, cache/storage, routing, forms, persistence, privacy/security.

Checklist:

- [ ] focused unit/contract/integration tests;
- [ ] relevant regression/build checks selected by affected behavior;
- [ ] Local Validation trigger explicitly recorded when environment/runtime evidence is needed;
- [ ] auth/API/cache/storage/router/console/network checks as applicable;
- [ ] Production runtime verification planned.

## 3. Non-UI risk classes

Backend, database, migration, auth, security, privacy, persistence, and provider changes use the strict affected-behavior contract defined by the Web CTO. The UI fast lane does not reduce their evidence.

Strict evidence does **not** mean an unrelated local full-suite run by default. Use focused tests, the relevant GitHub CI lanes, and Local Validation only under `IMPACT_BASED_TEST_EXECUTION_POLICY.md` trigger rules.

## 4. Test selection

Select tests by affected behavior and blast radius.

### Focused checks may include

```text
node --check or parser check
focused unit/contract/integration test
changed-module or route-specific test
page-specific static/CSS test
relevant build/typecheck/lint step
git diff --check
remote changed-file/diff review
```

### Broader regression is warranted when

- shared/global source changes;
- runtime orchestration changes;
- multiple surfaces depend on the changed contract;
- persistence/auth/security/data boundaries change;
- test discovery, CI workflow, package scripts, harnesses, or runtime matrices change;
- the focused tests and normal CI lanes do not cover the plausible regression area.

### Repository-wide execution authority

The normal sequence is:

```text
focused developer checks
→ push exact head
→ GitHub Actions relevant/full matrix
→ Local Validation only for declared trigger-qualified evidence
```

If exact-head GitHub CI already passed a lane, do not require Local to rerun the same lane solely for duplicate evidence.

Do not run or require unrelated full-suite commands solely because source code changed, multiple files changed, a PR exists, or a merge-forward occurred without relevant overlap.

## 5. CI

Use:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

A relevant executed failure blocks merge. Infrastructure-unavailable shells use the canonical alternative-evidence path. Red workflow appearance alone is not a code-failure classification.

For an executed failure, isolate the exact failing step/subtest first. Do not repeatedly rerun broad suites until green. Use the smallest reproducer and pristine-main comparison when classification requires it.

## 6. Browser and screenshot routing

- Preview/fixed slot is optional evidence unless assigned.
- Merge-first Production verification is the default.
- U0: no pre-merge screenshot by default.
- U1: pre-merge screenshot optional.
- U2: screenshots/browser evidence normally useful for affected layouts.
- U3: browser evidence required when runtime behavior is part of acceptance.
- Final subjective visual judgment belongs to Web CTO/user.

## 7. Local Validation routing

Default routing:

```text
U0: NOT_REQUIRED
U1: NOT_REQUIRED
U2: CONDITIONAL
U3: CONDITIONAL/REQUIRED only when a Local trigger applies
non-UI: based on affected behavior and Local trigger, not file type alone
```

Valid Local trigger codes are defined in `IMPACT_BASED_TEST_EXECUTION_POLICY.md`:

```text
L1_ENVIRONMENT_REQUIRED
L2_CI_FAILURE_REPRODUCTION
L3_CI_COVERAGE_GAP
L4_PRISTINE_MAIN_COMPARISON
L5_RUNTIME_BROWSER_REQUIRED
L6_BROAD_SHARED_REGRESSION
L7_CI_OR_TEST_INFRA_CHANGE
```

Every Local handoff must state:

```text
exact PR head
trigger code(s)
exact commands/flows
why focused Web checks + GitHub CI are insufficient
expected result
stop condition
```

When Local is not required, Web Developer evidence goes directly to Web CTO.

If source/test changes after Local tested an older head, inspect the new delta and revalidate only newly affected behavior. Do not blindly rerun unrelated work.

After merge-forward/current-main alignment, inspect path and semantic overlap first. Run focused alignment checks, then let exact-head GitHub CI execute the normal matrix unless a Local trigger requires additional evidence.

## 8. Parallel work and validation load

Prefer parallelism for read-only remote analysis and independent branches, not for duplicating the same validation.

```text
Web CTO coordinator
+ parallel read-only forensic/review workers when useful
+ one active writer per branch
+ Local Validation only for trigger-qualified work
```

Two implementation/Local workers may run concurrently only when branches and affected contracts are independent. Serialize shared modules, common test registries, package/CI infrastructure, auth/security boundaries, schema work, and other shared contracts unless explicitly partitioned.

## 9. Issue overhead

A new child Issue is not required for every U0/U1 correction. The PR may reference an active parent/product/UI objective.

Create a separate Issue for a distinct product goal, cross-page contract, policy decision, structural/runtime change, privacy/security concern, or substantial follow-up.

## 10. Production correction

For an unsuccessful U0/U1 visual result:

```text
Production observation
→ new micro branch/PR
→ focused checks
→ expected-head squash merge
→ Production re-check
```

Do not reset or force-push `main`. Use a dedicated revert PR when a micro correction is not safe.

## 11. Final status vocabulary

```text
READY_FOR_CTO_FINAL_REVIEW
READY_FOR_LOCAL_VALIDATION
LOCAL_VALIDATION_PASS
CONDITIONALLY_READY
NOT_READY
```

A developer or verifier report never replaces Web CTO final review.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
