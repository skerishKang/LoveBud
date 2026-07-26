# Reporting Chain

> **Role model:** Issue #3662
> **UI fast lane:** Issue #3664
> **Detailed contracts:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`, `UI_RAPID_ITERATION_LANE.md`

## Roles

### User / owner

- sets product direction;
- gives final subjective product/visual judgment when needed;
- approves new hard restrictions when required.

### Web CTO

- verifies remote state;
- fixes scope, risk class, design, tests, and evidence;
- decides whether Local Validation is required;
- independently reviews final remote evidence;
- returns READY / CONDITIONALLY_READY / NOT_READY;
- performs expected-head squash merge.

### Web Developer

- works in a separate web context;
- implements branch code/tests/docs;
- maintains the PR and CI corrections;
- reports exact evidence;
- does not make final merge or product-acceptance decisions.

### Local Validation

- is used only when required;
- tests the exact PR head in local/environment/browser/runtime conditions;
- returns raw evidence;
- does not invent design or broadly rewrite production source.

## Normal reporting chain

```text
User request
→ Web CTO contract
→ Web Developer implementation report
→ Local Validation report when required
→ Web CTO final review
→ user judgment / expected-head squash merge
```

## UI fast-lane reporting chain

### U0/U1

```text
User visual/copy request
→ Web CTO exact delta and classification
→ Web Developer micro implementation
→ Web CTO remote review and merge
→ Production visual confirmation
```

No Local Validation handoff is created by default.

### U2

```text
Web CTO design/UI Lab
→ Web Developer structural implementation
→ conditional Local Validation
→ Web CTO final review
```

### U3

Use the normal full chain.

## Correction loops

Local-required failure:

```text
Local failure evidence
→ Web Developer correction
→ exact-head re-test
→ Web CTO review
```

Web CTO blocker:

```text
NOT_READY
→ revised correction contract
→ Web Developer correction
→ required CI/Local evidence
→ Web CTO re-review
```

U0/U1 Production visual miss:

```text
Production observation
→ new exact micro correction
→ focused checks
→ Web CTO merge
→ Production re-check
```

## Required handoffs

### Web CTO → Web Developer

- exact baseline/target;
- objective and user-visible outcome;
- risk/UI class and reason;
- non-goals;
- allowed/forbidden paths;
- implementation shape;
- focused tests;
- Local Validation decision;
- Production verification requirement;
- protected Issues and stop conditions.

### Web Developer → Web CTO when Local is not required

- exact head and commits;
- changed files/diff;
- classification and unchanged behavior;
- focused checks and CI classification;
- `Local Validation: NOT_REQUIRED` with reason;
- remaining Production check.

### Web Developer → Local Validation when required

- PR, branch, exact head;
- commands and expected behavior;
- browser/auth/viewports/flows;
- evidence required;
- authorized local changes;
- destructive commands forbidden.

### Local Validation → Web CTO

- exact tested SHA;
- commands and counts;
- pristine-main comparison;
- browser/auth/console/network/environment evidence;
- unverified items;
- repository state.

## Parallel reporting

Report:

```text
branch
worktree if any
file ownership
active writer
upstream dependency
merge order
```

One remote branch has one active writer. Shared/global files are serialized.

## Interpretation rules

- Web Developer completion is not final approval.
- Local PASS is not product approval.
- Local Validation is not mandatory for U0/U1.
- Summary prose never overrides remote SHA, diff, CI, and raw evidence.
- #1882 remains protected and uses `Refs #1882` only.

## Related documents

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [UI_RAPID_ITERATION_LANE.md](./UI_RAPID_ITERATION_LANE.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)
- [LOCAL_MODEL_WORKFLOW.md](./LOCAL_MODEL_WORKFLOW.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
