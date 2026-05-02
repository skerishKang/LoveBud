# Fixed slot deploy with Wrangler

## Purpose

This document defines the standard manual deployment path for LoveBud fixed test slots before browser verification.

Use this procedure when a PR or issue requires a deployed fixed slot such as `test/slot-4`, `test/slot-5`, or another assigned slot branch before Browse, Search, Editor, My Trees, Auth, or API-dependent browser verification.

This is a docs-only operational procedure. It does not implement a GitHub workflow and does not change runtime behavior.

## Related context

- PR #696 and PR #698 documented the need to separate fixed slot verification from stale slot artifacts.
- Issue #694 tracks the fixed slot deployment procedure and stale asset guardrail.
- [FIXED_SLOT_MANUAL_E2E_GATE.md](FIXED_SLOT_MANUAL_E2E_GATE.md) remains the assignment, SHA provenance, and evidence gate.

## Standard deployment path

The fixed slot deployment standard is **Wrangler direct deploy**.

Do not rely on a normal `git push` to a slot branch as the only deployment signal when the verification depends on fresh static assets. Git push based slot deploy can leave a slot serving stale assets or an older static bundle even when the branch pointer appears correct.

Use Wrangler direct deploy after the slot assignment and before browser verification.

```bash
npx wrangler pages deploy . --project-name lovebud --branch test/slot-X
```

Replace `test/slot-X` with the assigned fixed slot branch, for example:

```bash
npx wrangler pages deploy . --project-name lovebud --branch test/slot-4
```

## Slot URL format

For a fixed slot branch named `test/slot-X`, the expected Cloudflare Pages URL is:

```text
https://test-slot-X.lovebud.pages.dev
```

Examples:

| Slot branch | Expected URL |
| --- | --- |
| `test/slot-4` | `https://test-slot-4.lovebud.pages.dev` |
| `test/slot-5` | `https://test-slot-5.lovebud.pages.dev` |

Do not confuse these URLs with `testX.lovebud.pages.dev`.

```text
Correct:   https://test-slot-4.lovebud.pages.dev
Incorrect: https://test4.lovebud.pages.dev
```

Browser verification evidence must report the exact URL that was actually loaded.

## Required sequence

1. Confirm the PR or task requires fixed slot browser verification.
2. Confirm the assigned slot branch, such as `test/slot-4`.
3. Confirm the source branch and source head SHA that should be deployed.
4. Check out the intended source tree locally.
5. Run the expected local static checks for the PR scope.
6. Run Wrangler direct deploy:

   ```bash
   npx wrangler pages deploy . --project-name lovebud --branch test/slot-X
   ```

7. Confirm the Wrangler output reports a successful deploy.
8. Open the expected fixed slot URL, such as `https://test-slot-X.lovebud.pages.dev`.
9. Perform the browser verification only after the Wrangler deployment succeeds.
10. Report the deployed SHA/source branch, exact URL, viewport, browser, console/pageerror status, and final status.

## Stale asset guardrail

Treat this output as a stale asset warning:

```text
Uploaded 0 files
```

`Uploaded 0 files` may mean Cloudflare did not receive a fresh asset bundle for the verification target. When the purpose of the task is to verify a newly changed UI, Browse behavior, Search behavior, Auth behavior, or static copy, this is not a reliable deployment signal.

If the deployment shows stale-asset risk, do not report browser verification as final PASS. Use a blocked status instead.

```text
final status: BLOCKED_BY_STALE_ASSET
```

## What not to use as deploy triggers

Do not use source branch mutations as a workaround for stale fixed slot deployment.

Avoid:

- empty commits;
- source branch version bumps;
- arbitrary timestamp or cache-busting changes;
- unrelated file edits;
- source branch force-pushes that exist only to trigger deployment;
- workflow edits for a one-off manual deployment.

The deployment path should not alter the PR source tree unless the PR itself legitimately requires source changes.

## Status values

Use these status values in handoff and verification reports:

| Status | Meaning |
| --- | --- |
| `READY_FOR_FIXED_SLOT_DEPLOY` | Slot assignment and source SHA are known; Wrangler deploy has not yet run. |
| `WRANGLER_DIRECT_DEPLOYED` | Wrangler direct deploy completed for the assigned fixed slot. |
| `FIXED_SLOT_VERIFIED` | Browser verification completed against the expected fixed slot URL after Wrangler deploy. |
| `BLOCKED_BY_STALE_ASSET` | Deployment did not provide a reliable fresh asset signal, such as `Uploaded 0 files`. |

## Browse verification rule

Browse verification must run only after Wrangler direct deploy succeeds for the assigned fixed slot.

Do not claim Browse browser PASS from:

- local-only testing;
- text-only review;
- an unassigned slot;
- a stale slot;
- a URL whose branch/SHA/source provenance is unclear;
- `testX.lovebud.pages.dev` when the expected fixed slot URL is `test-slot-X.lovebud.pages.dev`.

## Security and reporting restrictions

Do not print or store secrets in deployment or browser verification reports.

Do not expose:

- Cloudflare API token values;
- session or cookie values;
- passwords;
- private keys;
- database URLs;
- restricted runtime identifiers.

Report only safe status labels, branch names, public PR numbers, public commit SHAs, and public Cloudflare Pages URLs.

## Non-goals

This document does not:

- add or modify GitHub Actions workflows;
- change runtime code;
- change Cloudflare project settings;
- change API/Auth/backend behavior;
- change Browse/Search/Editor/My Trees implementation;
- deploy production;
- change PR #7 or prototype/reference/demo/variant paths.

Refs #694
