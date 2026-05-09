# LoveBud Agent Global Rules

These rules apply to all agents working on the LoveBud project, especially code-executor agents.

## Git Workflow
- Never modify `main` branch directly.
- Never push directly to `main`.
- Never merge `main` into your branch or vice versa; use PRs.
- One task per branch.
- Create PRs as draft by default.

## PR Management
- Preserve PRs numbered #7 or labeled prototype/reference/demo/variant. Do not close or delete these.
- Do not guess or use arbitrary PR preview URLs.

## Runtime & Infrastructure
- Active runtime: Cloudflare Pages (frontend) + Modal (compute/backend).
- Netlify is legacy artifact and removal candidate; not used for active production.
- Production site `https://lovebud.pages.dev/` must not be used for pre-merge verification.

## API Architecture
- Client requests follow: browser → same-origin `/api/*` → Cloudflare Functions `functions/api/**` → Modal → Neon.

## Verification
- Final browser PASS only on actual Cloudflare Preview URL or assigned test slot.
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
- Stop work in a dirty worktree and prepare a clean environment.
