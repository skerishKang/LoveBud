# Operations Documentation Index

This folder contains LoveBud runtime, governance, CI, browser, deployment, and repository-operation guidance.

## Operating principle — default simple, escalate on evidence

LoveBud work uses the smallest process that can safely prove the affected change.

```text
normal path
→ inspect scope and exact diff
→ run focused checks
→ classify CI
→ verify exact head
→ squash merge
→ check only the affected Production behavior after automatic deployment
```

Do not add Local Validation, full-suite testing, Preview, multi-viewport browser QA, Cloudflare authentication, Wrangler, deployment retries, or extended runtime evidence unless the change class or an observed failure requires them.

When a real error is found, escalation is immediate and strict:

```text
observed failure
→ stop merge or acceptance
→ identify the exact root cause
→ make the smallest corrective change
→ add regression coverage for that failure
→ rerun the affected checks and relevant CI
→ re-review the exact head
```

Missing optional evidence is not an error. A tool failure is not a product failure unless it prevents a required check. Do not turn diagnosis of an unrelated operational issue into a gate for an otherwise complete PR.

## Current runtime

- Production: `https://lovebud.pages.dev/`
- Frontend/entry: Cloudflare Pages and same-origin `/api/*`
- Primary compute/backend: Modal
- Database: Neon where applicable
- Vercel: secondary/transitional
- Netlify: legacy artifact, not active fallback
- Local execution default: Windows-native
- Preferred shell: PowerShell 7
- WSL: explicit authorization only

## Authority and first read

1. [MVP_AGENT_GOVERNANCE.md](MVP_AGENT_GOVERNANCE.md) — hard blockers, CI, role/UI owner approvals, expected-head merge.
2. [../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md) — separated execution roles.
3. [../project/UI_RAPID_ITERATION_LANE.md](../project/UI_RAPID_ITERATION_LANE.md) — U0/U1/U2/U3 UI process.
4. [MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md](MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md) — current Production verification flow.
5. [PR_CHECKLIST.md](PR_CHECKLIST.md) — risk-proportional PR checklist.
6. [UI_SCREENSHOT_CTO_REVIEW_POLICY.md](UI_SCREENSHOT_CTO_REVIEW_POLICY.md) — class-dependent screenshot and visual judgment.
7. [PATHS_AND_SHELLS.md](PATHS_AND_SHELLS.md) — current local Windows/PowerShell source of truth.
8. [REMOTE_ACCESS_AND_WSL.md](REMOTE_ACCESS_AND_WSL.md) — historical WSL/remote-access reference; not current startup guidance.
9. [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md) — safe GitHub authentication/token handling.

## Current execution summary

```text
Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO final review
```

UI:

```text
U0/U1: focused Web path, no Local by default
U2: structural tests + conditional Local/browser evidence
U3: full runtime-sensitive path
```

## Browser and evidence

- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md) — local/browser preflight reference.
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md) — URL provenance when preview evidence is actually used.
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md) — optional fixed-slot operations.
- [FIXED_SLOT_DEPLOY_WITH_WRANGLER.md](FIXED_SLOT_DEPLOY_WITH_WRANGLER.md) — optional fixed-slot deployment reference.
- [GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md](GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md) — broad global-CSS smoke reference; not a universal U0/U1 gate.
- [EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md](EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md) — editor-specific runtime smoke reference; use only when scope requires it.

Preview/fixed slot is optional evidence unless explicitly assigned. Historical documents that describe it as a universal gate are superseded by canonical governance and the merge-first workflow.

## CI and quality

- [CI_UNAVAILABLE_INFRA_MERGE_POLICY.md](CI_UNAVAILABLE_INFRA_MERGE_POLICY.md) — alternative evidence for infrastructure-unavailable CI.
- [KNOWN_CI_E2E_BLOCKERS.md](KNOWN_CI_E2E_BLOCKERS.md) — recurring CI/E2E classification reference.
- [E2E_SMOKE_COVERAGE_POLICY.md](E2E_SMOKE_COVERAGE_POLICY.md) — E2E coverage reference for affected runtime behavior.
- [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) — deployment checks.
- [RUNBOOK.md](RUNBOOK.md) — runtime incident response.

Test scope is selected by affected behavior and risk. Older universal full-suite wording does not override U0/U1 fast-lane policy.

## Parallel work and repository state

- [PARALLEL_WORKTREE_AGENT_POLICY.md](PARALLEL_WORKTREE_AGENT_POLICY.md)
- [ACTIVE_WORK_BOARD_POLICY.md](ACTIVE_WORK_BOARD_POLICY.md)
- [BRANCH_CLEANUP_PLAN.md](BRANCH_CLEANUP_PLAN.md)
- [SOURCE_OF_TRUTH_HYGIENE_DISPOSITION.md](SOURCE_OF_TRUTH_HYGIENE_DISPOSITION.md)
- [LOCAL_FILE_HYGIENE_PG_DEPENDENCY_AUDIT.md](LOCAL_FILE_HYGIENE_PG_DEPENDENCY_AUDIT.md)

One active writer per remote branch. Preserve other workers' state. Do not use destructive cleanup without approval.

## Runtime-specific references

- [OPERATIONS.md](OPERATIONS.md)
- [MODAL_BROWSE_RUNTIME.md](MODAL_BROWSE_RUNTIME.md)
- [MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md](MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md)
- [TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md](TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md)
- [DEPLOYMENT_TARGET_PAGE_OWNERSHIP_AUDIT.md](DEPLOYMENT_TARGET_PAGE_OWNERSHIP_AUDIT.md) — Issue #2715 deployment target and page ownership audit covering the Cloudflare Pages/Modal active boundary, Vercel/Netlify legacy/transitional posture, detail.html vs view.html ownership, and no-removal guardrails.
- [../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md](../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md)

## Secret and security references

- [AGENT_SECURITY.md](AGENT_SECURITY.md)
- [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md)
- [FIREBASE_CONSOLE_AND_DEPLOYMENT_SECRET_POSTURE.md](FIREBASE_CONSOLE_AND_DEPLOYMENT_SECRET_POSTURE.md)

Never expose secret/private values. Report presence/status only.

## Historical document interpretation

Many operations documents were written for earlier fixed-slot, Local-coder, TF Lead, or full-suite-default workflows. They remain useful inside their named technical scope but cannot override:

- `MVP_AGENT_GOVERNANCE.md`;
- `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`;
- `UI_RAPID_ITERATION_LANE.md`;
- `MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
