# Environment naming and runtime terminology audit

Refs #431
Refs #223
Refs #425

## Purpose

This document records a docs-only audit for two follow-up areas:

1. `NETLIFY_DATABASE_URL` usage trace before any environment naming change.
2. README/AGENTS runtime terminology alignment.

This document does not authorize environment variable renaming, code changes, configuration changes, migration, or runtime structure changes.

## Scope

### `NETLIFY_DATABASE_URL` usage trace

Classify usage locations by category before any naming change is proposed.

### README/AGENTS runtime terminology alignment

Clarify the difference between:

- user-facing deployment entrypoint language; and
- compute/runtime priority language.

A different order in README and AGENTS is not automatically a conflict.

## Non-goals

- No implementation.
- No environment variable rename.
- No code change.
- No configuration change.
- No migration.
- No runtime structure change.
- No broad documentation rewrite.
- No PR #7/prototype/reference/demo/variant changes.

## Safe verification commands

```bash
# env name usage trace
rg "NETLIFY_DATABASE_URL" .

# runtime terminology references
rg "Cloudflare Pages|Modal|Netlify|Vercel" README.md AGENTS.md docs/ops docs/migration docs/engineering
```

Do not run commands that print environment variable values.

Forbidden commands for this audit:

```bash
printenv
env
set
echo $NETLIFY_DATABASE_URL
echo %NETLIFY_DATABASE_URL%
```

## Observed repository evidence

Search results on current `main` show `NETLIFY_DATABASE_URL` references in local scripts, docs, and example/config guidance, including:

- `scripts/run_seed.js`
- `scripts/run-vp1.ps1`
- `scripts/run-seed.ps1`
- `scripts/verify-phase1.js`
- `scripts/verify-env.js`
- `.env.example`
- `docs/migration/POSTGRES_MIGRATION.md`
- `docs/ops/LOCAL_SECRETS.md`
- `docs/ops/ENV_DEPENDENCY.md`
- `docs/ops/RUNBOOK.md`

This broad usage means a rename is not a safe documentation-only action and must not be proposed as an immediate implementation without a separate impact plan.

README currently describes the operating infrastructure as Cloudflare Pages + Modal, with Cloudflare Pages first as the public user-facing deployment entrypoint and same-origin `/api` gateway. AGENTS currently lists Modal first and Cloudflare Pages second under infrastructure priority, where Modal is described as the compute/read-heavy priority layer and Cloudflare Pages as the service frontend and same-origin `/api` entrypoint.

## Current working interpretation

| Item | Current interpretation | Risk | Follow-up |
|---|---|---:|---|
| `NETLIFY_DATABASE_URL` naming | Legacy name appears across scripts/docs/example guidance. Rename impact is broad. | Medium | Usage trace only; no rename without separate implementation approval. |
| Scripts usage | Script references likely support local or migration workflows. | Medium | Categorize exact usage before any change. |
| Docs usage | Docs references need source-of-truth alignment if naming policy changes later. | Medium | Prefer docs update only after naming decision. |
| README runtime order | User-facing entrypoint perspective: Cloudflare Pages first. | Low | Not a conflict by itself. |
| AGENTS runtime order | Compute/runtime priority perspective: Modal first. | Low | Clarify perspective if future docs alignment is approved. |

## Guardrails

- Do not rename `NETLIFY_DATABASE_URL` in this audit.
- Do not change scripts or runtime configuration.
- Do not treat README/AGENTS ordering difference as a direct conflict without context.
- Do not change active API path or deployment structure.
- Do not modify PR #7/prototype/reference/demo/variant paths.
- Report secret-related information only as `PRESENT`, `MISSING`, `EXISTS`, or `GITIGNORED` if a future verification requires it.

## Follow-up axes

- If a future env-name change is desired, create a dedicated implementation issue with allowed files and migration steps.
- If README/AGENTS terminology needs alignment, prefer a narrow docs-only PR that clarifies perspective rather than rewriting runtime ownership.
- If legacy Netlify naming remains intentional for compatibility, record that explicitly in ops docs.

## Final status

Docs-only audit baseline recorded. No implementation, rename, migration, or runtime change is authorized by this document.
