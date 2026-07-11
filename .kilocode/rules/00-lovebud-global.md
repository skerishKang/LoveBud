# LoveBud Agent Global Rules

> Canonical governance: `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`). Conflicts defer to it. main direct push, secret exposure, and destructive interference with other workers' work remain hard rules.

These rules apply to all agents working on the LoveBud project, especially code-executor agents.

## Git Workflow
- Never modify `main` branch directly.
- Never push directly to `main`.
- Never merge `main` into your branch or vice versa; use PRs.
- One task per branch (advisory; not an automatic blocker — see docs/ops/MVP_AGENT_GOVERNANCE.md).
- Create PRs as draft or ready as appropriate (draft-by-default is advisory, not mandatory).

## PR Management
- Preserve PRs numbered #7 or labeled prototype/reference/demo/variant. Do not close or delete these.
- Do not guess or use arbitrary PR preview URLs.

## Runtime & Infrastructure
- Active runtime: Cloudflare Pages (frontend) + Modal (compute/backend).
- Netlify is legacy artifact and removal candidate; not used for active production.
- Production site `https://lovebud.pages.dev/` is not the source of truth for unmerged PR behavior; production verification is allowed by default after merge/deploy (evidence=PRODUCTION_EVIDENCE). Pre-merge PR Preview is the usual pre-merge target.

## API Architecture
- Client requests follow: browser → same-origin `/api/*` → Cloudflare Functions `functions/api/**` → Modal → Neon.

## Verification
- Browser evidence is reported as LOCAL_EVIDENCE / PRE_MERGE_EVIDENCE / PRODUCTION_EVIDENCE. A fixed slot is an evidence option, not a permission gate (see docs/ops/MVP_AGENT_GOVERNANCE.md).
- Pages that depend on API, auth, or dynamic data (Search/Browse/Editor/My Trees/Auth-gated) cannot be validated solely with a local static server.

## Security
- Never log, record, or expose credentials, tokens, cookies, sessions, or secrets (Firebase, Cloudflare, Modal, Neon, etc.).
- Only reference secret names/locations; never include values.

## Local Artifact Hygiene
- Do not create `local-backup/`, `work/`, screenshots, or report JSON files inside the repo.
- Move local verification artifacts (screenshots, reports, backup files) outside the repo to `local-backup/`.
- Before creating a PR, always check `git status --short` and `git diff --name-only origin/main...HEAD`.
- If unexpected files are included, stop immediately and clean up the scope.
- Do not run git clean, git reset --hard, or git stash without explicit approval.
- In a dirty worktree, preserve existing changes and use another worktree/branch or read-only inspection. A dirty worktree is not an automatic blocker (see docs/ops/MVP_AGENT_GOVERNANCE.md).
