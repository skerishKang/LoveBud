# LoveBud Documentation Index

This is the top-level documentation hub. Detailed inventories belong in each document-family index rather than in one continuously growing file.

## 1. Start here

1. [../AGENTS.md](../AGENTS.md) — repository entrypoint.
2. [ops/MVP_AGENT_GOVERNANCE.md](./ops/MVP_AGENT_GOVERNANCE.md) — hard blockers, CI, browser permission, owner approvals.
3. [project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md) — separated execution roles.
4. [project/UI_RAPID_ITERATION_LANE.md](./project/UI_RAPID_ITERATION_LANE.md) — U0/U1/U2/U3 UI acceleration.
5. [project/ROLE_SESSION_TEMPLATES.md](./project/ROLE_SESSION_TEMPLATES.md) — copy-ready Web CTO/Web Developer/Local prompts.
6. The product/design/engineering/ops index relevant to the task.

## 2. Current operating summary

```text
Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

UI:

```text
U0 copy-only: focused Web path, no Local by default
U1 visual-only: focused Web path, no Local by default
U2 structural UI: focused structural tests + conditional Local/browser evidence
U3 runtime-sensitive UI: full relevant runtime path
```

## 3. Current runtime

- Production frontend: `https://lovebud.pages.dev/`
- User-facing entry and same-origin `/api/*`: Cloudflare Pages
- Primary backend/compute: Modal
- Database: Neon where applicable
- Vercel: secondary/transitional
- Netlify: legacy artifact, not active fallback
- Local default: Windows + PowerShell 7
- WSL: explicit authorization only

## 4. Document-family indexes

- [project/project_index.md](./project/project_index.md) — roles, branching, review, Local Validation, evidence.
- [ops/ops_index.md](./ops/ops_index.md) — runtime, CI, browser, deployment, repository operations.
- [product/product_index.md](./product/product_index.md) — product definition, policy, journeys, copy.
- [design/design_index.md](./design/design_index.md) — visual system, prototypes, UI polish, assets.
- [engineering/engineering_index.md](./engineering/engineering_index.md) — architecture, API, contracts, review guardrails.

## 5. Product and visual source of truth

For product/UX work read:

1. [product/PRODUCT_IDENTITY.md](./product/PRODUCT_IDENTITY.md)
2. [product/BRAND_EXPERIENCE.md](./product/BRAND_EXPERIENCE.md)
3. [design/UI_DESIGN_SYSTEM.md](./design/UI_DESIGN_SYSTEM.md)

For prototype/reference preservation:

- [reference/PROTOTYPE_INDEX.md](./reference/PROTOTYPE_INDEX.md)
- [design/PROTOTYPE_REFERENCE_POLICY.md](./design/PROTOTYPE_REFERENCE_POLICY.md)

## 6. Execution and verification

- [project/PROJECT_OPERATING_MODEL.md](./project/PROJECT_OPERATING_MODEL.md)
- [project/REPORTING_CHAIN.md](./project/REPORTING_CHAIN.md)
- [project/BRANCHING_AND_REVIEW.md](./project/BRANCHING_AND_REVIEW.md)
- [project/LOCAL_MODEL_WORKFLOW.md](./project/LOCAL_MODEL_WORKFLOW.md)
- [project/VERIFICATION_AND_EVIDENCE.md](./project/VERIFICATION_AND_EVIDENCE.md)
- [project/AGENT_OPERATION_GUARDRAILS.md](./project/AGENT_OPERATION_GUARDRAILS.md)
- [ops/PR_CHECKLIST.md](./ops/PR_CHECKLIST.md)
- [ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md](./ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md)
- [ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md](./ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md)
- [ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md](./ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md)

## 7. Topic-specific additions

Read only when relevant:

- privacy/publication: `product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- Browse display versus publication: `engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- code architecture: `engineering/CODE_ARCHITECTURE.md`
- review false positives: `engineering/REVIEW_GUARDRAILS.md`
- local paths/shells: `ops/PATHS_AND_SHELLS.md`
- GitHub authentication safety: `ops/GITHUB_AUTH_TOKEN_USAGE.md`
- Modal/Vercel transition: `migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- conversation restoration: `conversation/summary/summary_index.md`

## 8. Historical-document interpretation

Historical fixed-slot, TF Lead, `UI Local`, `Feature Local`, universal full-suite, or Local-coder-default documents remain useful only inside their named technical/history scope.

They do not override:

- `ops/MVP_AGENT_GOVERNANCE.md`;
- `project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`;
- `project/UI_RAPID_ITERATION_LANE.md`;
- `ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`.

## 9. Documentation maintenance

- Keep this top-level index short.
- Add detailed documents to the relevant family index.
- Do not duplicate long policy bodies across indexes.
- Record authority and supersession explicitly.
- Preserve prototypes/reference/demo variants unless the applicable policy authorizes removal.
- Never expose secret/private values in documentation.
- Never close #1882; use `Refs #1882` only.

Refs #3664.  
Refs #3662.  
Refs #1882 — Keep OPEN.
