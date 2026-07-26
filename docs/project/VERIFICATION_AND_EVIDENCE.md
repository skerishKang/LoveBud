# Verification and Evidence

> **Hard-governance authority:** `../ops/MVP_AGENT_GOVERNANCE.md`
> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`
> **Merge-first workflow:** `../ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`

## 1. Purpose

Verification checks correctness. Evidence records what was actually checked. LoveBud selects both according to the behavior that can change, not according to a one-size-fits-all checklist.

## 2. Evidence levels

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

- **LOCAL_EVIDENCE:** local files, tests, build, static server, local runtime, local browser.
- **PRE_MERGE_EVIDENCE:** PR preview, branch preview, fixed slot, disposable deployment.
- **PRODUCTION_EVIDENCE:** merged/deployed `main` at `https://lovebud.pages.dev/`.

Environment indicates claim strength, not permission to work. Preview/fixed slot is optional evidence unless a contract explicitly requires it.

## 3. Current default

LoveBud currently uses merge-first Production verification.

```text
focused pre-merge evidence
→ exact-head review and safe merge
→ Cloudflare Pages automatic Production deployment
→ Production confirmation for affected user-facing behavior
```

Do not search for a preview URL or deploy a fixed slot unless assigned.

## 4. Risk-proportional verification

Every task must identify the affected behavior and select the smallest evidence set that proves it.

### U0 — Copy-only

Default evidence:

- exact before/after copy;
- changed-file and diff review;
- syntax/static check when relevant;
- focused copy/i18n contract if one exists;
- CI classification;
- Production copy confirmation.

Not automatic:

- Local Validation;
- screenshots;
- desktop/mobile matrix;
- full test suite;
- preview/fixed slot;
- new child Issue.

### U1 — Visual-only

Default evidence:

- exact selector/token/value delta;
- page-scoped versus shared impact review;
- focused CSS/static contract if available;
- syntax/build check only when relevant;
- CI classification;
- Production visual confirmation.

Pre-merge screenshots and Local Validation are optional. Escalate to U2 when structure, breakpoints, visibility, focus, accessibility-tree semantics, or broad global/shared impact changes.

### U2 — Structural UI

Default evidence:

- explicit desktop/mobile/state contract for affected layouts;
- focused DOM/layout/accessibility/static tests;
- browser/overflow/screenshot evidence when structure cannot be proved statically;
- conditional Local Validation;
- Production visual acceptance.

Only affected viewports and states are required. A universal desktop+375px matrix is not mandatory when the change cannot affect one of them.

### U3 — Runtime-sensitive UI

Default evidence:

- focused unit/contract/integration tests;
- relevant regression/build checks;
- exact-head Local Validation when environment/runtime evidence is needed;
- auth/API/cache/storage/router/console/network evidence as applicable;
- Production runtime verification.

### Backend/data/auth/security

Use the full strict contract appropriate to schema, migration, security, privacy, persistence, and runtime risk. The UI fast lane does not apply.

## 5. Test selection

Tests are selected by affected behavior and shared-surface risk.

Do not require unrelated full-suite commands solely because:

- an HTML file changed;
- a CSS file changed;
- the repository contains a large default suite;
- older checklists list broad commands for every PR.

Focused checks may include:

```text
syntax/parser check
focused contract test
page-specific static test
CSS selector/token contract
relevant build step
git diff --check
remote changed-file/diff review
```

Broader regression is warranted when the change affects shared/global files, runtime orchestration, multiple surfaces, or a behavior with wide blast radius.

## 6. CI classification

Use only:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

- relevant executed failure blocks merge;
- genuinely running/queued relevant work blocks merge temporarily;
- infrastructure-unavailable shells are not code failures and use the documented alternative-evidence path;
- red UI alone does not prove an executed failure.

## 7. Browser evidence

Browser evidence is required only when the acceptance claim depends on rendered/runtime behavior.

### Static/local browser

Useful for:

- HTML/CSS shape;
- asset paths;
- basic overflow;
- simple component states;
- UI Lab/prototype iteration.

State limitations for auth/API/Cloudflare/Modal/Firebase-dependent pages.

### Preview/fixed slot

Optional supplementary evidence unless explicitly assigned. If used, record URL provenance and deployed SHA.

### Production

Normal final confirmation for UI/Auth/runtime under the merge-first policy.

For U0/U1, Production confirmation may be a narrow check of the exact changed copy or visual value. It does not automatically require full journey QA.

## 8. Screenshots

Screenshots are evidence, not a universal gate.

- U0: normally unnecessary pre-merge;
- U1: optional, useful when diff cannot predict the visual result;
- U2: normally useful for affected layout/state/viewports;
- U3: required when browser/runtime state is part of acceptance.

Final subjective visual judgment belongs to the Web CTO/user.

## 9. Local Validation routing

Local Validation is:

```text
U0: NOT_REQUIRED by default
U1: NOT_REQUIRED by default
U2: CONDITIONAL
U3: normally REQUIRED when environment/runtime evidence is needed
```

When Local is skipped, Web Developer evidence routes directly to Web CTO.

When a Web correction changes source/test after Local tested an older head, old local evidence cannot be reused for the changed behavior.

## 10. Reporting truthfully

Separate:

```text
VERIFIED
NOT_VERIFIED
INFERRED
NOT_REQUIRED
NOT_AVAILABLE
NOT_USED
```

Reports must include exact SHA, commands/counts, evidence level, limitations, and whether Local was required or skipped.

Do not write “all tests passed” without commands and counts. Do not call a visual result approved unless the Web CTO/user inspected it.

## 11. Pristine-main comparison

When failures appear, compare against pristine `main` when useful and report:

```text
pristine-main SHA and failures
branch SHA and failures
branch-only failures
```

Do not spend time on pristine comparison for a successful U0/U1 focused check unless there is an actual ambiguity.

## 12. Secret/private safety

Never expose credentials, cookies, sessions, tokens, private IDs, private payloads, database URLs, or authorization headers in evidence.

Use safe status labels and sanitized screenshots/logs.

## 13. Completion and Production loops

### U0/U1

```text
focused evidence
→ Web CTO merge
→ narrow Production confirmation
→ immediate micro correction PR if needed
```

### U2/U3

Use the structural/runtime evidence and post-merge verification defined by the contract.

A Production visual miss is not a reason to force-push/reset `main`. Use a small correction PR or dedicated revert PR.

## 14. Required UI report fields

```text
UI class and reason
exact head
changed files
behavior unchanged
focused checks and counts
CI classification
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
browser evidence: LOCAL / PRE_MERGE / PRODUCTION / NOT_USED
Production check remaining
unverified items
```

## Related documents

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md)
- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)
- [../ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md](../ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md)
- [../ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md](../ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md)

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
