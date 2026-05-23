# Fixed Slot Workflow Secret Setup

**Status:** Deprecated / inactive reference
**Owner:** CTO / Ops Lead
**Related issue:** #684
**Former workflow:** `.github/workflows/deploy-test-slot.yml`
**Current source of truth:** [FIXED_SLOT_DEPLOY_WITH_WRANGLER.md](FIXED_SLOT_DEPLOY_WITH_WRANGLER.md)

This document is retained only as historical context for the archived GitHub Actions fixed-slot deploy experiment. It must not be used as the active deployment procedure for LoveBud fixed test slots.

## Current policy

LoveBud fixed-slot deployment for browser verification must use local Wrangler OAuth deploy from the operator machine:

```bash
npx wrangler pages deploy . --project-name lovebud --branch testX
```

Replace `testX` with the assigned fixed slot, for example `test4`.

The active runbook is:

```text
docs/ops/FIXED_SLOT_DEPLOY_WITH_WRANGLER.md
```

## What changed

The GitHub Actions workflow formerly documented here is inactive and has been removed from `.github/workflows/` to prevent operators from dispatching the wrong deploy path or reporting expected secret failures as deployment blockers.

The archived workflow text remains available only for historical reference:

```text
docs/ops/archive/deploy-test-slot.workflow.yml.txt
```

## Do not use this document for active deployment

Do not:

- configure repository secrets for fixed-slot deploy solely to revive this workflow;
- dispatch GitHub Actions for `test4`, `test5`, or other fixed-slot browser verification;
- report `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` missing as a blocker for fixed-slot verification when local Wrangler OAuth deploy is available;
- modify workflow files to perform one-off fixed-slot deployment;
- treat a GitHub Actions deploy failure as a valid failure of the current fixed-slot process.

## Correct report language

Use this wording when a fixed slot is deployed manually through Wrangler:

```text
fixed-slot deploy path: local Wrangler OAuth
command: npx wrangler pages deploy . --project-name lovebud --branch <slot>
GitHub Actions fixed-slot deploy: not used / deprecated
Cloudflare GitHub Actions secrets: not required for this verification
```

## Secret safety

This deprecation does not change secret handling rules. Operators and agents still must not print, paste, screenshot, or store Cloudflare token values, account IDs, cookies, sessions, passwords, or private keys in chat, issues, PRs, logs, or reports.

## Historical note

This runbook previously described repository secret setup for a manually dispatched `Deploy fixed test slot` workflow. That approach was superseded by local Wrangler OAuth deploy because browser verification already requires local operator control, and the workflow path caused avoidable confusion when repository Cloudflare secrets were intentionally not configured.
