# LoveBud Agent Instruction Policy

> **Repository entrypoint:** `AGENTS.md`  
> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`  
> **Execution roles:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`  
> **UI fast lane:** `../project/UI_RAPID_ITERATION_LANE.md`

## 1. Purpose

LoveBud uses several agents, web contexts, and local executors. This policy defines the instruction-source hierarchy so safety, role allocation, risk classification, and verification do not silently diverge.

## 2. Hierarchy

1. `docs/ops/MVP_AGENT_GOVERNANCE.md` — hard blockers, CI, browser permission, owner approvals, expected-head merge.
2. root `AGENTS.md` — concise repository-wide entrypoint.
3. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` — current role allocation.
4. `docs/project/UI_RAPID_ITERATION_LANE.md` — U0/U1/U2/U3 UI execution depth.
5. focused product/design/engineering/ops documents for the assigned task.
6. tool-specific execution guidance.

A lower source cannot add a repo-wide blocker, restore Local as the default coder, or require universal fixed-slot/full-suite/screenshot gates contrary to the higher sources.

All agents read `AGENTS.md` first, then the focused documents appropriate to their role and task.

## 3. Current state

- `.codex` marker files are not repository authority.
- `CLAUDE.md`, `CODEX.md`, and similar tool-side files are not canonical LoveBud governance.
- Historical runbooks remain valid only inside their named technical/history scope.
- Current role and UI policies are owner-approved by #3662 and #3664.
- Repository-wide guidance changes should update `AGENTS.md` and the relevant focused canonical document rather than copying the same policy into multiple new files.

## 4. Tool-specific guidance

A tool-specific document may be added only when it:

- describes actual configuration or execution unique to the tool;
- links the repository entrypoint and relevant canonical policy;
- does not contradict the role or risk model;
- does not create an unapproved runtime, deployment, security, or destructive action;
- does not turn optional evidence into a universal permission gate.

Tool-specific documents should live under `docs/ops/` or the tool's established rule path and remain concise.

## 5. Role-specific startup

### Web CTO

Read:

- `AGENTS.md`;
- `MVP_AGENT_GOVERNANCE.md`;
- role model;
- UI lane for UI work;
- relevant product/design/engineering documents;
- current remote Issue/PR/diff/CI.

### Web Developer

Read the same sources plus the exact Web CTO contract. Implement on a feature branch; do not make final product/merge decisions.

### Local Validation

Read the exact-head handoff and `docs/project/LOCAL_MODEL_WORKFLOW.md`. Do not self-assign Local work for U0/U1 or broaden the task into production coding.

## 6. UI instruction rule

Every UI prompt should declare:

```text
U0 / U1 / U2 / U3
classification reason
focused checks
Local Validation requirement
Production verification scope
```

Absent an explicit escalation trigger, U0/U1 remain on the fast Web path.

## 7. Non-goals

This policy does not:

- change runtime behavior;
- modify Cloudflare/Modal/Neon configuration;
- change Scout, auth, API, DB, or functions code;
- introduce dependencies;
- authorize secret exposure or destructive actions.

## 8. Issue hygiene

- Reference #3662 for separated execution roles.
- Reference #3664 for UI Rapid Iteration Lane.
- Never use `Closes #1882`, `Fixes #1882`, or `Resolves #1882`.
- Use `Refs #1882` only.

Refs #3664.  
Refs #3662.  
Refs #2714.  
Refs #1882 — Keep OPEN.
