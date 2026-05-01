# Netlify and Vercel Legacy Artifact Audit

> Status: audit only
> Related: #405
> Runtime impact: none

## 1. Purpose

Issue #405 tracks the deprecation path for remaining Netlify and Vercel legacy artifacts without deleting, moving, reactivating, or treating them as active runtime prematurely.

Current runtime posture is:

```text
Browser -> same-origin /api/* -> Cloudflare Pages Functions -> Modal -> Neon
```

This document records a docs-only classification of Netlify and Vercel artifacts, guardrails for future cleanup work, and validation requirements before any future removal PR.

This document does not authorize implementation, deletion, file movement, route changes, deployment config changes, or reactivation of legacy platforms.

## 2. Current runtime judgment

| Area | Current status | Notes |
| --- | --- | --- |
| Cloudflare Pages | Active web/runtime edge | Browser-facing static pages and same-origin `/api/*` route entry remain the active path. |
| Cloudflare Pages Functions | Active API entry | `functions/api/[[path]].js` is the active browser-facing API route contract. |
| Modal | Active backend compute | `modal_compute/` owns active Modal backend behavior. |
| Neon | Active persisted database | Active database backing the Modal path. |
| Netlify Functions | Legacy/fallback/artifact | `netlify/functions/*` must not be treated as active runtime without a fresh audit. |
| Netlify SQL | Legacy/fallback/artifact | `netlify/sql/*` must not be treated as active schema truth. |
| `netlify.toml` | Legacy artifact | Not active runtime config under the Cloudflare + Modal posture. |
| Vercel config/API artifacts | Deprecated transitional fallback / under audit | Must not be treated as active runtime unless a fresh audit proves otherwise. |

## 3. Artifact inventory and classification

| Artifact | Classification | Current action | Removal readiness |
| --- | --- | --- | --- |
| `netlify/functions/*` | Legacy/fallback/artifact | Preserve in place. Do not edit from #405. | Not removable from this issue alone. Requires route, docs, tests, and contract audit. |
| `netlify/sql/*` | Legacy/fallback/artifact | Preserve in place. Do not edit from #405. | Not removable from this issue alone. Requires schema-truth and migration-risk audit. |
| `netlify.toml` | Legacy artifact | Preserve in place. Do not edit from #405. | Potential future deprecation candidate only after no tooling/docs/tests depend on it. |
| Vercel config files | Deprecated transitional fallback / under audit | Preserve in place. Do not edit from #405. | Not removable from this issue alone. Requires exact file inventory and deployment-history review. |
| Vercel API/code artifacts | Deprecated transitional fallback / under audit | Preserve in place. Do not edit from #405. | Not removable from this issue alone. Requires active route parity and dependency review. |
| `functions/api/[[path]].js` | Active Cloudflare API entry | Out of scope for edits. | Not a removal candidate. |
| `modal_compute/` | Active backend compute | Out of scope for edits. | Not a removal candidate. |

## 4. Required audit before any future removal

Future removal or deactivation work must prove all of the following before any file deletion, move, or config removal PR:

- no active deployment path depends on Netlify artifacts;
- no active deployment path depends on Vercel artifacts;
- tests and contract assertions do not treat Netlify/Vercel as active runtime truth;
- docs do not instruct contributors to use Netlify/Vercel as active runtime;
- `functions/api/[[path]].js` and `modal_compute/` cover the active Cloudflare + Modal route contract;
- exact files/folders proposed for removal are listed;
- PR #7 and prototype/reference/demo/variant paths are untouched;
- production-equivalent validation is defined and available before deletion.

## 5. Documentation cleanup posture

Allowed documentation language:

- `legacy artifact`
- `fallback artifact`
- `deprecated transitional fallback`
- `not active runtime under current Cloudflare + Modal posture`
- `requires fresh audit before removal/reactivation`

Disallowed documentation language:

- claiming Netlify is active runtime without evidence;
- claiming Vercel is active runtime without evidence;
- instructing contributors to deploy active runtime through Netlify/Vercel;
- marking files as removable without file-level evidence;
- authorizing deletion from this audit alone.

## 6. Guardrails

- Do not delete Netlify files from this issue alone.
- Do not delete Vercel files from this issue alone.
- Do not move legacy artifacts without a separate approved PR.
- Do not modify runtime routing.
- Do not modify deployment configuration.
- Do not modify `functions/api/[[path]].js` from this audit issue.
- Do not modify `modal_compute/` from this audit issue.
- Do not touch PR #7.
- Do not touch prototype/reference/demo/variant paths.
- Do not mix this audit with UI, Search, Auth, Editor, My Trees, or runtime implementation changes.

## 7. Future PR split

| Future PR | Scope | Allowed files | Forbidden files |
| --- | --- | --- | --- |
| Legacy runtime status confirmation | Docs-only | `docs/ops/**`, possibly `docs/doc_index.md` | Runtime files, deployment configs, Netlify/Vercel artifacts |
| Contract/test guard review | Docs/test audit only unless separately approved | docs or test docs scoped by CTO | Runtime route changes, deployment config changes |
| Docs cleanup for stale references | Docs-only | stale docs that incorrectly describe active runtime | JS/CSS/HTML/runtime/config files |
| Deprecation checklist | Docs-only | deprecation checklist doc | file deletion or movement |
| Removal/deactivation PR | Implementation/removal only after CTO approval | exact approved legacy files only | active Cloudflare/Modal runtime, PR #7/prototype/reference/demo/variant |

## 8. Production-equivalent validation before removal

A future deletion/removal PR must include validation appropriate to the removed artifact class:

- active Cloudflare Pages preview or assigned fixed test slot;
- deployed SHA matches the PR head SHA;
- same-origin `/api/*` route smoke remains intact;
- Modal-backed active routes remain reachable;
- no contributor docs direct active usage to removed Netlify/Vercel paths;
- no CI/test/contract guard expects removed files as runtime truth;
- rollback plan is recorded if removal touches deployment assumptions.

## 9. Current recommendation

Keep Netlify and Vercel artifacts preserved in place for now.

Do not start deletion or deactivation work from #405 alone. If cleanup pressure remains, open a future narrow docs-only deprecation checklist PR first, then a separately approved removal PR only after validation and exact file-level evidence are available.

## 10. Acceptance criteria mapping

| #405 acceptance criterion | Status in this audit |
| --- | --- |
| Netlify/Vercel artifacts are classified as active, legacy, fallback, reference, or removable. | Covered in sections 2 and 3. |
| Any removal candidate has explicit file-level evidence. | Required before future removal; no immediate removal candidate approved here. |
| Follow-up PRs have allowed files and forbidden files. | Covered in section 7. |
| No runtime path changes occur without separate approval. | Guardrail preserved. |
| PR #7 and preserved prototype/reference/demo/variant areas remain untouched. | Guardrail preserved. |

## 11. Non-goals

- No implementation.
- No file deletion.
- No file movement.
- No runtime routing change.
- No deployment configuration change.
- No Netlify reactivation.
- No Vercel reactivation.
- No Cloudflare route modification.
- No Modal modification.
- No Neon/database/schema modification.
- No PR #7/prototype/reference/demo/variant changes.

## Related

Refs #405
