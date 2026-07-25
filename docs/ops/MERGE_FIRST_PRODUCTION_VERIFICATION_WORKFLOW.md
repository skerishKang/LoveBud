# Merge-First Production Verification Workflow

> **Status:** active canonical workflow  
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`  
> **Role model:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`  
> **UI fast lane:** `../project/UI_RAPID_ITERATION_LANE.md`  
> **Refs:** #3513, #3662, #3664

## 1. Purpose

LoveBud uses post-merge Production confirmation as the normal final check when authenticated preview/fixed-slot/staging-equivalent environments are not reliably available.

Preview and fixed-slot procedures remain optional supplementary evidence when explicitly assigned. Their absence is not a merge blocker.

Pre-merge evidence is risk-proportional. Low-risk UI does not require backend-grade local/full-suite verification.

## 2. Current operating mode

```text
Web CTO contract and risk classification
→ separate Web Developer implementation
→ focused pre-merge evidence
→ Local Validation only when required
→ remote exact-head review
→ canonical CI classification
→ expected-head squash merge
→ Cloudflare Pages automatically deploys main
→ affected Production behavior is confirmed
```

Agents do not search for preview URLs or deploy fixed slots unless assigned.

## 3. Pre-merge evidence by change class

### U0 — Copy-only

Required:

- exact before/after copy and changed-file review;
- syntax/static/focused copy check when relevant;
- `git diff --check` or equivalent diff hygiene;
- CI classification;
- exact-head remote review.

Not automatically required:

- Local Validation;
- full lint/build/test/verify suite;
- preview/fixed slot;
- screenshots;
- desktop/mobile journey QA.

### U1 — Visual-only

Required:

- exact selector/token/value delta and scope review;
- focused CSS/static check when available;
- relevant syntax/build step only when needed;
- diff hygiene;
- CI classification;
- exact-head remote review.

Local Validation and pre-merge screenshots are optional unless justified by layout, overflow, shared/global, or breakpoint risk.

### U2 — Structural UI

Required:

- focused DOM/layout/accessibility/static tests;
- affected build/checks;
- conditional browser/Local evidence for affected states/viewports;
- exact-head remote review and CI classification.

### U3 — Runtime-sensitive UI

Required:

- focused unit/contract/integration tests;
- relevant regression/build checks;
- Local/runtime/browser/auth/API/cache/storage evidence when applicable;
- exact-head remote review and CI classification.

### Backend/data/auth/security

Use the strict full evidence defined by the task contract. UI fast-lane reductions do not apply.

## 4. Test selection principle

Tests are selected by affected behavior and blast radius.

Do not require every command below for every PR:

```text
npm run lint
npm run build
npm test
npm run verify
```

Run them when they are relevant to the changed contract or when shared/broad risk warrants them.

Every PR still requires:

- remote scope/diff review;
- appropriate focused checks;
- diff hygiene;
- CI classification;
- expected-head confirmation before merge.

## 5. CI

Use canonical states:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

- relevant executed failure blocks merge;
- relevant queued/running work blocks merge temporarily;
- infrastructure-unavailable shells use the documented alternative-evidence policy;
- red shell appearance alone is not executed failure.

## 6. Optional pre-merge browser evidence

| Evidence | Default |
|---|---|
| PR/branch preview | optional |
| fixed slot | optional |
| authenticated preview | optional |
| local static browser | optional, evidence-limited |
| UI Lab/prototype | recommended for rapid U2 design iteration |

If used, record URL provenance and deployed SHA where applicable.

## 7. Post-merge Production verification

Production target:

```text
https://lovebud.pages.dev/
```

Verification scope is proportional.

### U0

Check the exact copy in the affected state. Full journey QA is not required unless the copy is state-dependent.

### U1

Check the exact affected visual property on the relevant viewport/state. Do not automatically repeat every page and viewport.

### U2

Check affected states, layouts, and viewports, including overflow/accessibility concerns defined by the contract.

### U3

Check affected route/action/auth/API/cache/storage/runtime behavior, console/network, and required viewports.

### Backend/data/auth/security

Use the task-specific Production verification and data-safety contract.

## 8. Production outcomes

### PASS

Record evidence and close eligible child Issue if the broader goal is complete.

### Minor U0/U1 visual miss

```text
new micro branch from current main
→ exact correction
→ focused checks
→ expected-head squash merge
→ Production re-check
```

### Material regression

Create a dedicated correction or revert PR. Never force-push/reset/move `main` destructively.

## 9. Merge rules

1. inspect current PR head and cumulative diff;
2. confirm required evidence for the change class;
3. classify CI;
4. verify protected Issue wording;
5. re-read exact head immediately before merge;
6. squash merge with expected head pinned.

Do not use merge/rebase commit methods for normal feature completion.

## 10. Role allocation

### Web CTO

- classifies risk and evidence;
- reviews remote diff and final evidence;
- decides READY/NOT_READY;
- performs expected-head squash merge;
- judges Production result.

### Web Developer

- implements branch changes and focused tests;
- maintains PR and CI correction;
- reports exact evidence;
- does not make final merge decision.

### Local Validation

- is invoked only when required;
- executes exact-head local/environment/browser checks;
- returns raw evidence;
- does not redesign or broadly rewrite source.

## 11. Issue handling

- U0/U1 do not require a new child Issue for every micro correction;
- reference the active parent/product/UI objective when appropriate;
- create separate Issues for distinct product goals, structural/runtime contracts, policy, privacy/security, or substantial follow-up;
- never close #1882 and use `Refs #1882` only.

## 12. Report template

```text
[Merge-First Evidence Report]

PR / Issue:
Risk or UI class:
Exact head:
Changed files:
Focused checks and counts:
CI classification:
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
Pre-merge browser evidence: USED / NOT_USED / NOT_REQUIRED
Production verification scope:
Production result: PASS / FAIL / PARTIAL / NOT_YET_VERIFIED
Correction/revert required:
Secret/private exposure: NONE
```

## 13. Governance boundary

This workflow does not weaken hard governance. Secret safety, preservation of worker state, production-destructive approval, CI executed-failure/pending blockers, alternative evidence for infrastructure unavailability, expected-head squash merge, and #1882 protection remain authoritative.

Refs #3664.  
Refs #3662.  
Refs #3513.  
Refs #1882 — Keep OPEN.
