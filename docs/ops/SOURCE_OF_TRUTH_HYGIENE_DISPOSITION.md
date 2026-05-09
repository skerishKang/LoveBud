# Source-of-Truth Hygiene Disposition

Issue: #425

This document defines how LoveBud handles stale documentation, source-of-truth routing, and documentation hygiene without changing runtime behavior.

This is a docs-only disposition. It does not authorize implementation, file deletion, broad documentation rewrites, runtime changes, CSS changes, workflow changes, or protected prototype/reference/demo/variant changes.

## Purpose

LoveBud has many narrow operating documents created through staged PRs. This is useful, but it can create confusion when older documents, checklists, and issue-specific audits overlap with newer source-of-truth documents.

The purpose of #425 is to define a durable hygiene rule:

- prefer updating existing source-of-truth documents,
- make ownership and routing explicit,
- avoid duplicate docs for the same decision,
- preserve historical audit documents unless explicitly reviewed,
- keep docs cleanup separate from implementation.

## Source-of-truth hierarchy

Use this hierarchy when documents appear to overlap.

| Area | Primary source |
| --- | --- |
| Product identity and public-first policy | `docs/product/PRODUCT_IDENTITY.md` |
| Brand tone and experience | `docs/product/BRAND_EXPERIENCE.md` |
| Publication/privacy/visibility policy | `docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md` |
| UI design system | `docs/design/UI_DESIGN_SYSTEM.md` |
| Prototype/reference/demo/variant inventory | `docs/reference/PROTOTYPE_INDEX.md` |
| Runtime/API contract | `docs/engineering/API_CONTRACT.md` |
| Browse/Search visibility guard | `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md` |
| Code architecture and large-file policy | `docs/engineering/CODE_ARCHITECTURE.md` |
| Large-file candidate routing | `docs/engineering/LARGE_FILE_MODULARIZATION_CANDIDATES.md` |
| Modal owner route split boundary | `docs/engineering/MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md` |
| CSS architecture | `docs/engineering/CSS_ARCHITECTURE.md` |
| Script load order | `docs/engineering/SCRIPT_LOAD_ORDER.md` |
| Active operations policy | `docs/ops/OPERATIONS.md` |
| Parallel agent and worktree policy | `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md` |
| Agent startup and verification rules | `docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md` |
| Browser URL provenance | `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md` |
| Fixed test slots | `docs/ops/TEST_PREVIEW_SLOTS.md` |
| Cloudflare/Modal diagnostics | `docs/ops/MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md` |
| Security posture planning | `docs/security/security_index.md` and linked security docs |
| Migration state | `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md` |

If a document is not listed here, treat it as supporting context unless its own header explicitly declares source-of-truth status.

## Hygiene classification

Use these labels when reviewing stale or overlapping docs.

| Label | Meaning | Action |
| --- | --- | --- |
| `SOURCE_OF_TRUTH` | Current decision authority for a domain | Update in place when policy changes. |
| `SUPPORTING_CONTEXT` | Useful background or audit detail | Keep linked if still helpful. |
| `HISTORICAL_AUDIT` | Completed issue/PR evidence | Keep unless misleading or explicitly archived. |
| `SUPERSEDED` | Replaced by a newer source | Add pointer to current source or archive after review. |
| `DUPLICATE_CANDIDATE` | Overlaps with another document | Prefer consolidation through a narrow docs-only PR. |
| `ARCHIVE_CANDIDATE` | No longer part of active workflow | Archive only after explicit review. |

## Stale documentation indicators

A document may need hygiene review if it:

- names Netlify as active production runtime instead of legacy artifact,
- names Vercel as primary runtime instead of transitional or secondary,
- contradicts Cloudflare Pages + Modal as the active runtime baseline,
- treats anonymous public exposure and Browse/Search eligibility as the same concept,
- omits the parent tree visibility guard for public memory reads,
- treats prototype/reference/demo/variant paths as cleanup candidates,
- lacks fixed-slot requirements for Auth/API/runtime browser verification,
- uses close/fix/resolve issue keywords in tracker/disposition PRs when the issue must remain open,
- duplicates a newer source-of-truth document without linking to it.

## Update routing rules

When a doc update is needed:

1. Identify the source-of-truth document first.
2. Update that document in place if the policy itself changed.
3. If only a narrow audit is needed, create a supporting document and link it from the relevant index.
4. If an older doc conflicts with the source of truth, add a pointer or disposition note instead of rewriting the full historical record.
5. Do not delete or archive without explicit review.
6. Keep docs hygiene separate from runtime implementation.

## Forbidden combinations

Do not combine docs hygiene with:

- runtime code changes,
- Auth/API/backend changes,
- CSS or UI implementation,
- package or workflow changes,
- broad file moves,
- prototype/reference/demo/variant cleanup,
- PR #7 changes,
- PR #450 changes,
- protected active PR files unless explicitly scoped.

## Index maintenance rules

When adding or updating docs:

- Update `docs/doc_index.md` only when the document should be discoverable from the top level.
- Update the relevant section index, such as `docs/ops/ops_index.md` or `docs/engineering/engineering_index.md`, when the document belongs to that section.
- Do not add every issue-specific audit to the top-level `먼저 읽기` list.
- Reserve top-level `먼저 읽기` for active operating policy and high-frequency routing documents.
- Prefer concise descriptions that state whether a document is source-of-truth, audit, checklist, runbook, or historical context.

## Archive rules

Archiving is allowed only after explicit review.

Before archive:

- confirm the document is not linked as a source of truth,
- identify the replacement document,
- preserve useful historical context if needed,
- avoid breaking existing index links,
- keep archive-only PRs docs-only.

Do not archive protected prototype/reference/demo/variant material from this issue.

## Closure criteria for #425

#425 can be closed when:

- a source-of-truth hierarchy is documented,
- stale-doc classification labels exist,
- update routing rules are documented,
- archive rules are documented,
- index maintenance rules are documented,
- the change remains docs-only,
- no protected files or excluded PRs/issues are touched.

## Guardrails

- Docs-only.
- No runtime changes.
- No CSS/UI implementation.
- No package or workflow changes.
- No file deletion.
- No broad documentation rewrite.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No `css/editor/status-settings.css` changes.
- No `css/editor/overrides.css` changes.
- No `css/editor.css` changes.
- No PR #527 changes.
- No Issue #513 changes.
