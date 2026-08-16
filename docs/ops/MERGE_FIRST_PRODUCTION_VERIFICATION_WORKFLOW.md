# Merge-First Production Verification Workflow

> **Status:** active canonical evidence workflow
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Parallel work:** `PARALLEL_WORKTREE_AGENT_POLICY.md`
> **Role model:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI fast lane:** `../project/UI_RAPID_ITERATION_LANE.md`
> **Refs:** #3513, #3662, #3664, #3994

## 1. Purpose

LoveBud uses post-merge Production confirmation as the normal final check when authenticated preview/fixed-slot/staging-equivalent environments are not reliably available.

`Merge-first` describes the preferred **evidence order after an authorized merge**. It does not grant Ready or merge authority to an implementation worker, verifier, or Web CTO when the task/owner has kept integration separately gated.

Preview and fixed-slot procedures remain optional supplementary evidence when explicitly assigned. Their absence is not a merge blocker.

Pre-merge evidence is risk-proportional. Low-risk UI does not require backend-grade local/full-suite verification.

## 2. Current operating mode

```text
Web CTO contract, risk classification, and authority allocation
→ separate Web Developer / implementation owner
→ focused pre-merge evidence
→ Local Validation only when required
→ independent remote exact-head review
→ canonical CI classification
→ user/task integration decision
→ authorized expected-head squash merge when applicable
→ Cloudflare Pages automatically deploys main
→ affected Production behavior is confirmed
```

Agents do not search for preview URLs or deploy fixed slots unless assigned. Implementation completion or browser PASS does not create merge authority.

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

For active multi-model work, also confirm branch/path/semantic-authority ownership before any write or integration action.

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
- expected-head confirmation immediately before any authorized merge.

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

If an executed failure does not expose an exact assertion/subtest/error, record the evidence gap and do not guess-patch product code.

## 6. Optional pre-merge browser evidence

| Evidence | Default |
|---|---|
| PR/branch preview | optional |
| fixed slot | optional |
| authenticated preview | optional |
| local static browser | optional, evidence-limited |
| UI Lab/prototype | recommended for rapid U2 design iteration |

If used, record URL provenance and deployed SHA where applicable. Fixed-slot operational authority never grants feature-branch Ready/merge authority.

## 7. Post-merge Production verification

Production target:

```text
https://lovebud.pages.dev/
```

Verification scope is proportional and applies only after a merge has been separately authorized and completed.

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

Record evidence and close an eligible child Issue only if issue-close authority is separately present and the broader goal is complete.

### Minor U0/U1 visual miss

```text
new micro branch from current main
→ exact correction
→ focused checks
→ independent exact-head review
→ task-authorized expected-head squash merge when applicable
→ Production re-check
```

### Material regression

Create a dedicated correction or revert PR. Never force-push/reset/move `main` destructively.

## 9. Merge rules

When merge is authorized:

1. confirm the task/owner granted integration authority;
2. confirm the implementation author is not self-merging unless that authority was explicitly delegated;
3. inspect current PR head and cumulative diff independently;
4. confirm required evidence for the change class;
5. classify CI;
6. verify protected Issue wording;
7. confirm dependency and semantic-authority sequencing;
8. re-read exact head immediately before merge;
9. squash merge with expected head pinned unless a narrower task contract requires another allowed method.

Do not use rebase to rewrite published feature history. Do not force-update feature PR branches or `main`.

## 10. Role allocation

### Web CTO

- classifies risk and evidence;
- allocates/monitors parallel semantic authority;
- reviews remote diff and final evidence independently;
- decides technical `READY/NOT_READY`;
- performs integration only when task/owner authorization delegates that action;
- judges Production result after an authorized merge.

### Web Developer / implementation owner

- implements branch changes and focused tests;
- maintains Draft PR and CI correction;
- reports exact evidence;
- does not make final merge decision;
- does not Ready-transition or merge its own active PR unless task-specific owner authorization explicitly delegates that integration authority.

### Local Validation

- is invoked only when required;
- executes exact-head local/environment/browser checks;
- returns raw evidence;
- does not redesign or broadly rewrite source;
- does not gain Ready/merge authority from a PASS result.

## 11. Issue handling

- U0/U1 do not require a new child Issue for every micro correction;
- reference the active parent/product/UI objective when appropriate;
- create separate Issues for distinct product goals, structural/runtime contracts, policy, privacy/security, or substantial follow-up;
- issue close requires the applicable task authority;
- never close #1882 and use `Refs #1882` only.

## 12. Report template

```text
[Merge-First Evidence Report]

PR / Issue:
Risk or UI class:
Exact head:
Changed files:
Active semantic authority / writer:
Parallel class: GREEN / YELLOW / RED
Focused checks and counts:
CI classification:
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
Pre-merge browser evidence: USED / NOT_USED / NOT_REQUIRED
Integration authority: AUTHORIZED / NOT_AUTHORIZED / PENDING
Production verification scope:
Production result: PASS / FAIL / PARTIAL / NOT_YET_VERIFIED
Correction/revert required:
Secret/private exposure: NONE
```

## 13. Governance boundary

This workflow does not weaken or replace hard governance. Secret safety, preservation of worker state, Production-destructive approval, CI executed-failure/pending blockers, alternative evidence for infrastructure unavailability, semantic-authority writer locks, independent review, task-authorized expected-head integration, and #1882 protection remain authoritative.

Refs #3994.
Refs #3664.
Refs #3662.
Refs #3513.
Refs #1882 — Keep OPEN.
