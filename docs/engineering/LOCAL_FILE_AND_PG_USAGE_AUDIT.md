# Local file hygiene and `pg` usage audit

Refs #429
Refs #223
Refs #425

## Purpose

This document records a docs-only audit for two repository hygiene follow-ups:

1. `.local/` tracked-file safe audit.
2. `pg` dependency usage trace.

This document does not authorize implementation, file deletion, dependency removal, runtime changes, environment changes, or any secret inspection/output.

## Scope

### `.local/` tracked-file safe audit

Audit whether tracked `.local/` content is limited to safe example material, and whether real local-only secret material remains outside git tracking.

### `pg` dependency usage trace

Audit whether `pg` usage is limited to local scripts and docs, and verify that `functions/api/*` does not directly import or require `pg` on current `main`.

## Non-goals

- No implementation.
- No file deletion.
- No `.gitignore` change.
- No dependency removal.
- No runtime code change.
- No Cloudflare-to-database direct-access assumption.
- No credential value inspection.
- No credential value output.
- No PR #7/prototype/reference/demo/variant changes.

## Safe verification commands

Run only commands that list paths or match names. Do not print secret file contents.

```bash
# local tracked-file boundary
git ls-files .local/

git check-ignore .local/*

# secret-safe local paths; report only EXISTS/MISSING/GITIGNORED
git check-ignore .env .env.* .secrets/*

# pg dependency trace
rg "from ['\"]pg['\"]|require\(['\"]pg['\"]\)" scripts functions/api package.json package-lock.json
rg "from ['\"]pg['\"]|require\(['\"]pg['\"]\)" functions/api
```

Forbidden commands for this audit:

```bash
cat .env
cat .env.*
cat .secrets/*
cat .local/*
printenv
env
set
```

## Observed repository evidence

GitHub search on current `main` found `.local` references in operational documentation and QA/local guidance, especially `docs/ops/LOCAL_SECRETS.md` and related ops documents. This audit treats `.local/` as a local-only hygiene boundary and does not inspect or output any private value.

GitHub search for `pg` usage returned local script candidates such as:

- `scripts/verify-db.js`
- `scripts/verify-env.js`
- `scripts/seed-public-trees.js`
- `scripts/inspect-schema.js`
- related script runner files and documentation

The audit target is to confirm the same boundary locally with `rg`/`git ls-files` before any future implementation. The current docs-only conclusion is not a runtime change and does not prove or require direct database access from Cloudflare Functions.

## Current working interpretation

| Item | Current interpretation | Risk | Follow-up |
|---|---|---:|---|
| `.local/` tracked files | Needs safe verification with `git ls-files .local/`; expected tracked content should be example-only if present. | Medium | Keep as audit-only unless an unsafe tracked file is found. |
| Real local secret files | Must remain untracked and gitignored. Report only status values such as `EXISTS`, `MISSING`, `GITIGNORED`. | High | Stop and report if tracked secret material is found. |
| `pg` dependency | Appears associated with local scripts and docs rather than Cloudflare Functions, pending local trace. | Medium | Do not remove dependency without separate implementation approval. |
| `functions/api/*` direct `pg` usage | Must be verified separately; no direct usage should be assumed from filename alone. | Medium | If found, split into a runtime-boundary issue before any code change. |

## Guardrails

- Never print, paste, summarize, screenshot, or commit secret values.
- Use path/name presence checks only.
- Do not run commands that dump all environment variables.
- Do not infer Cloudflare-to-database direct access from `pg` dependency presence alone.
- Do not change runtime, dependency, or environment configuration from this audit.
- Do not modify PR #7/prototype/reference/demo/variant paths.

## Follow-up axes

- If `.local/` contains only example tracked files and real local secrets are gitignored, no implementation is needed.
- If a tracked local file appears unsafe, stop and open a security-hygiene follow-up without repeating the contents.
- If `pg` is confirmed script-only, document that boundary in future runtime docs if needed.
- If `functions/api/*` imports `pg`, open a dedicated runtime-boundary issue before any implementation.

## Final status

Docs-only audit baseline recorded. Future work must remain audit-only unless CTO separately authorizes an implementation PR.
