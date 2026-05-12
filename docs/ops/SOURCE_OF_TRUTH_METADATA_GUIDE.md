# Source-of-Truth Metadata Guide

Issue: #1077

This guide defines a lightweight metadata pattern for LoveBud documents so agents and reviewers can tell whether a document is active, reference-only, superseded, or archived.

## Purpose

LoveBud has many product, design, engineering, ops, audit, report, and conversation documents. This metadata pattern reduces ambiguity without moving or deleting existing documents.

The goal is to make routing clear:

- which document is authoritative;
- which document is only historical or audit evidence;
- which document should not be used for new implementation decisions;
- which document supersedes or is superseded by another document.

## Recommended metadata block

Add this block near the top of high-traffic docs when classification is useful:

```markdown
> Status: active | reference | superseded | archived
> Authoritative for: <short list of decisions this document governs>
> Do not use for: <short list of decisions this document must not govern>
> Supersedes: <optional paths/issues>
> Superseded by: <optional paths/issues>
```

Keep the block short. Do not add metadata if it makes the document harder to scan.

## Status values

| Status | Meaning |
| --- | --- |
| `active` | Current source of truth for the stated scope. |
| `reference` | Useful background or audit evidence, but not the final decision source. |
| `superseded` | Replaced by a newer document. Keep for history only. |
| `archived` | Preserved record. Do not use for current implementation decisions. |

## Priority documents

Add metadata first to documents that agents read frequently or that can be confused with implementation authority:

- `README.md`
- `AGENTS.md`
- `docs/doc_index.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/engineering/CODE_ARCHITECTURE.md`
- `docs/engineering/SCRIPT_LOAD_ORDER.md`
- `docs/engineering/SEARCH_RUNTIME_CONTRACT.md`
- major ops runbooks
- major migration/runtime documents
- large audit documents that may be mistaken for implementation approval

## Routing rules

### Product and UI decisions

Product and user-facing UI decisions should start from:

- `docs/product/PRODUCT_IDENTITY.md`
- `docs/product/BRAND_EXPERIENCE.md`
- `docs/design/UI_DESIGN_SYSTEM.md`

Engineering docs do not replace these product/design source-of-truth documents.

### Runtime/API decisions

Runtime and API decisions should start from:

- `docs/engineering/API_CONTRACT.md`
- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- relevant route/runtime contract documents

### Script-order decisions

Classic-script page loading decisions should start from:

- `docs/engineering/SCRIPT_LOAD_ORDER.md`
- page-specific runtime contract documents such as `docs/engineering/SEARCH_RUNTIME_CONTRACT.md`

### Legacy runtime decisions

Legacy Netlify/Vercel artifact decisions should start from:

- `docs/ops/LEGACY_RUNTIME_GUARDRAILS.md`
- `docs/ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md`
- migration/runtime documents

## Non-goals

This guide does not authorize:

- broad documentation reorganization;
- deletion of old documents;
- runtime behavior changes;
- product/design source-of-truth rewrites;
- PR #7 or prototype/reference/demo/variant cleanup.

## Verification

Docs-only metadata PRs require:

- docs review;
- path/link sanity check when indexes are touched;
- no runtime verification.
