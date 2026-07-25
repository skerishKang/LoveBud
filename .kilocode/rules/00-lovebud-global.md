# LoveBud Agent Global Rules

> Canonical governance: `docs/ops/MVP_AGENT_GOVERNANCE.md`.
> Role model: `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`.
> UI fast lane: `docs/project/UI_RAPID_ITERATION_LANE.md`.

These rules apply especially to local/code-executor agents. Conflicts defer to canonical governance.

## Git workflow

- Never edit or push directly to `main`.
- Use feature branches and PRs.
- Preserve other workers' branch/worktree/stash/uncommitted state.
- One active writer per remote branch.
- Do not force-push, hard-reset, clean, stash-drop, or delete worktrees without explicit approval.

## Role routing

```text
Web CTO: contract and final review
Web Developer: implementation and PR/CI correction
Local Validation: exact-head environment evidence only when required
```

Local is not the default production coder or UI designer.

## UI risk classes

```text
U0 copy-only
U1 visual-only
U2 structural UI
U3 runtime-sensitive UI
```

Defaults:

- U0/U1: no Local Validation, fixed slot, screenshot matrix, full suite, or new child Issue by default;
- U2: focused structural tests and conditional browser/local evidence;
- U3: full relevant runtime path;
- escalate for JavaScript, DOM/focus/visibility semantics, auth/API/data/cache/storage, global/shared blast radius, dependencies, privacy, or security.

Do not expand a U0/U1 task into broad implementation or verification without a revised Web CTO contract.

## Runtime and Production

- Active runtime: Cloudflare Pages frontend + same-origin `/api/*` + Modal + Neon.
- Netlify is legacy, not active Production fallback.
- Merge-first Production verification is the current default.
- Preview/fixed slot is optional evidence and is used only when assigned.
- Production URL: `https://lovebud.pages.dev/`.

## Verification

- Evidence levels: `LOCAL_EVIDENCE`, `PRE_MERGE_EVIDENCE`, `PRODUCTION_EVIDENCE`.
- Tests are selected by affected behavior and blast radius.
- Do not run unrelated full suites solely because HTML/CSS changed.
- Dynamic/auth/API pages cannot be fully proven by a local static server; report limitations.
- U0/U1 normally route Web Developer evidence directly to Web CTO.

## CI

Use only:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Relevant executed failure or pending execution blocks merge. Infrastructure-unavailable shells use canonical alternative evidence.

## Security

Never expose credentials, tokens, cookies, sessions, private IDs/payloads, database URLs, or secrets. Report only safe presence/status labels.

## Local artifact hygiene

- Keep screenshots, reports, backup files, and local artifacts outside the repository unless explicitly required.
- Before push, check `git status --short` and changed files.
- Unexpected files require scope review, not destructive cleanup.

## Merge and protected Issues

- Web Developer and Local Validation do not make final merge decisions.
- Web CTO verifies exact expected head and squash merges.
- Never close #1882; use `Refs #1882` only.

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
