# Project Documentation Index

This folder contains LoveBud role, review, evidence, and execution guidance.

## Canonical reading order

1. [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md) — separated Web CTO / Web Developer / conditional Local Validation model.
2. [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md) — U0/U1/U2/U3 risk-proportional UI workflow.
3. [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md) — copy-ready role prompts.
4. [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md) — lifecycle and approval summary.
5. [REPORTING_CHAIN.md](./REPORTING_CHAIN.md) — evidence routing and correction loops.
6. [BRANCHING_AND_REVIEW.md](./BRANCHING_AND_REVIEW.md) — branches, micro PRs, reviews, and merge routing.
7. [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md) — exact-head local execution only when required.
8. [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md) — risk-proportional test/browser/evidence matrix.
9. [AGENT_OPERATION_GUARDRAILS.md](./AGENT_OPERATION_GUARDRAILS.md) — role, secret, browser, parallel, and scope guardrails.
10. [TASK_STATUS.md](./TASK_STATUS.md) — status-tracking format.
11. [VERIFICATION_WARNING_CATALOG.md](./VERIFICATION_WARNING_CATALOG.md) — warning/blocker vocabulary.

## Core operating summary

```text
Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO independent final review
```

UI acceleration:

```text
U0/U1: Web CTO → Web Developer → Web CTO → Production confirmation
U2: Web CTO design/UI Lab → Web Developer → conditional Local → Web CTO
U3: full runtime-sensitive path
```

## Authority

- hard blockers and CI: [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)
- current merge/Production flow: [../ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md](../ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md)
- PR checklist: [../ops/PR_CHECKLIST.md](../ops/PR_CHECKLIST.md)
- screenshot/visual judgment: [../ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md](../ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md)

Historical TF Lead, `UI Local`, `Feature Local`, fixed-slot-required, universal full-suite, and Local-coder-default language does not override the canonical documents above.

## Use principles

- start from current remote `main` and exact target head;
- classify actual risk before assigning process;
- do not create Local work for U0/U1 by default;
- do not run unrelated full suites by habit;
- use exact evidence and preserve protected Issues;
- #1882 uses `Refs #1882` only.

Refs #3664.  
Refs #3662.  
Refs #1882 — Keep OPEN.
