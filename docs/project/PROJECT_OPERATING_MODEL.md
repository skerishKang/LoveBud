# Project Operating Model

> **Role model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI fast lane:** `UI_RAPID_ITERATION_LANE.md`
> **Owner approvals:** Issues #3662 and #3664
> **Hard-governance precedence:** `../ops/MVP_AGENT_GOVERNANCE.md`

## Purpose

This document summarizes LoveBud work classification, role allocation, approval rights, and the risk-proportional execution lifecycle.

## Workstream classification

Work may be classified as:

- documentation;
- UI;
- feature/data/backend.

These are workstream labels, not additional executor roles. All work uses:

```text
Web CTO
Web Developer
Local Validation when required
```

## Default lifecycle

### 1. Web CTO contract

The Web CTO verifies current remote state and fixes before implementation:

- exact base and target;
- objective and user-visible outcome;
- risk/UI class;
- non-goals;
- allowed/forbidden paths;
- implementation shape;
- focused tests;
- Local Validation requirement;
- Production verification requirement;
- protected Issues and stop conditions.

### 2. Web Developer implementation

A separate Web Developer context:

- implements on a feature branch;
- adds focused tests/contracts;
- creates additive commits and a PR;
- inspects CI;
- returns exact SHA/diff/test evidence.

### 3. Local Validation — conditional

Local Validation is used only when the contract requires full-checkout, environment, browser, auth, database, provider, OS, device, or broad regression evidence.

It is not automatically inserted between every Web Developer change and Web CTO review.

### 4. Web CTO final review

The original Web CTO independently checks remote diff, exact head, CI classification, required evidence, risks, linkage, and expected-head squash merge readiness.

Judgment:

```text
READY
CONDITIONALLY_READY
NOT_READY
```

## Execution modes

### Mode A — Direct GitHub implementation

```text
Web CTO contract
→ Web Developer branch implementation
→ CI
→ Local Validation only if required
→ Web CTO final review
```

### Mode B — Patch package

Web Developer supplies changed files, patch, manifest, apply instructions, test plan, and review notes. Local Validation applies and executes it.

### Mode C — Local-environment loop

```text
Web Developer implementation
→ Local Validation execution
→ raw failure evidence
→ Web Developer correction
→ re-test
```

### Mode D — UI Rapid Iteration Lane

#### U0/U1

```text
Web CTO exact change
→ Web Developer direct edit
→ focused checks
→ Web CTO review/merge
→ Production visual confirmation
```

Local Validation is skipped by default.

#### U2

```text
Web CTO design/UI Lab
→ Web Developer structural implementation
→ focused tests
→ conditional Local Validation
→ Web CTO review
```

#### U3

Use the full runtime-sensitive path.

## UI classification

- **U0:** copy-only;
- **U1:** page-scoped visual-only;
- **U2:** DOM/layout/loading/responsive/accessibility structure;
- **U3:** JavaScript/auth/API/data/cache/storage/routing/runtime behavior.

A new Issue, full regression suite, Local Validation, preview, and screenshots are not automatically required for U0/U1. They are selected by actual risk.

## Independent review

The same production change is not implemented and finally approved in the same context. The Web CTO may author design prototypes, exact copy, state contracts, or patch drafts, but a separate Web Developer implements or independently reviews production code.

## Parallel work

Parallel work requires separate branches, non-overlapping file ownership, one active writer per remote branch, and remote-head checks before push. Shared/global files are serialized.

## Approval rights

- **User/owner:** product direction and final product judgment;
- **Web CTO:** contract, final READY/NOT_READY, expected-head merge;
- **Web Developer:** implementation and CI correction;
- **Local Validation:** exact-head execution and raw evidence when required.

## Governance boundary

This model changes role and evidence allocation, not hard blockers. Canonical CI, secret, destructive-state, expected-head squash merge, and #1882 rules remain unchanged.

## Related documents

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
