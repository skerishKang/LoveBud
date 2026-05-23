# Ops Agent Security Rules

Refs #299
Refs #849

## Purpose

This document defines secret-safe operating rules for LoveBud agents that inspect GitHub, local paths, credentials, deployment settings, or verification environments.

Agents and central systems must not request, display, store, summarize, or transmit raw token or secret values. They may only guide local operators by referencing approved paths, secret names, and presence/status checks.

## Core rule

Model-side or central-system work has no need to see secret values.

Allowed reports are limited to status words such as:

- `PRESENT`
- `MISSING`
- `EXISTS`
- `GITIGNORED`
- `REDACTED`
- `PASS`
- `BLOCKED`

Do not include raw values, partial values, prefixes, suffixes, hashes, screenshots, copied file contents, command output that contains values, or environment dumps.

## Allowed local paths to reference

Agents may reference these local paths by name only:

- `.secrets/`
- `.env`
- `.env.*`
- `.local/test-accounts.json`
- `.local/test-accounts.example.json`
- `docs/ops/qa-credential-bundle/`
- `~/.config/gh/hosts.yml`

Referencing a path does not authorize printing its contents.

`.local/test-accounts.json` is a credential-bearing runtime file. Agents may reference the path, selected credential keys, and safe preflight status only. They must not print email, password, confirmPassword, token, session, cookie, UID, request payload, or private values.

## Allowed checks

Safe checks may confirm only existence, ignored status, or required key presence without values.

PowerShell examples:

```powershell
Test-Path .secrets/lovebud-runtime.env
Test-Path .env
Test-Path .local/test-accounts.json
Test-Path .local/test-accounts.example.json
Test-Path ~/.config/gh/hosts.yml
```

Git examples:

```bash
git check-ignore .secrets/lovebud-runtime.env
git check-ignore .env
git check-ignore .env.local
git check-ignore .local/test-accounts.json
```

Credential preflight examples:

```bash
npm run check:auth-credentials -- --key accounts.user
npm run check:auth-credentials -- --key accounts.personaA001
```

Credential preflight must report only safe status fields such as key presence, non-empty status, whitespace status, confirmPassword match status, and final PASS/BLOCKED state. It must not print credential values.

GitHub token creation may be directed to:

```text
https://github.com/settings/tokens
```

The generated token value must remain local to the operator and must not be pasted into chat, docs, PRs, issues, logs, screenshots, or reports.

## Fixed slot deployment rule

When a task requires fixed slot browser verification, agents must treat **local Wrangler OAuth direct deploy** as the standard deployment path before reporting final browser verification.

Use the fixed slot deploy procedure in [FIXED_SLOT_DEPLOY_WITH_WRANGLER.md](FIXED_SLOT_DEPLOY_WITH_WRANGLER.md). Do not rely on a plain `git push` to a slot branch as the only deployment signal when fresh assets are required.

Do not use GitHub Actions fixed-slot deployment. The former workflow path is deprecated and is not part of the active verification process. Missing GitHub Actions Cloudflare secrets must not be reported as fixed-slot deployment blockers when local Wrangler OAuth deploy is available.

Required safe reporting status values include:

- `READY_FOR_FIXED_SLOT_DEPLOY`
- `WRANGLER_DIRECT_DEPLOYED`
- `FIXED_SLOT_VERIFIED`
- `BLOCKED_BY_STALE_ASSET`

Agents must not use empty commits, version bumps, unrelated source edits, or workflow changes merely to trigger fixed slot deployment. If the deploy output indicates stale asset risk, such as `Uploaded 0 files`, report `BLOCKED_BY_STALE_ASSET` instead of final PASS.

For fixed slot URLs, agents must use the `test1` through `test10` domain format defined in [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md). Example: slot `test4` must use `https://test4.lovebud.pages.dev`. Do not use `https://test-slot-4.lovebud.pages.dev` for LoveBud fixed slot verification. Always report the exact URL used.

Fixed-slot verification reports should use this wording:

```text
fixed-slot deploy path: local Wrangler OAuth
GitHub Actions fixed-slot deploy: not used / deprecated
Cloudflare GitHub Actions secrets: not required for this verification
```

## Forbidden actions

Do not run or request commands that print secret material, including:

```bash
cat .env
cat .env.*
cat .secrets/*
cat .local/test-accounts.json
printenv
env
set
echo $GH_TOKEN
echo $CLOUDFLARE_API_TOKEN
```

```powershell
Get-Content .env
Get-Content .env.*
Get-Content .secrets/*
Get-Content .local/test-accounts.json
type .local/test-accounts.json
echo $env:GH_TOKEN
echo $env:CLOUDFLARE_API_TOKEN
Get-ChildItem Env:
```

Also forbidden:

- file content output for credential-bearing files;
- full environment variable dumps;
- token value recording or exposure;
- screenshots containing tokens, cookies, session data, or private keys;
- PR/Issue comments that include tokens or credential values;
- committing plaintext credential files.

## Local automation pattern

Use this pattern when a local command needs a secret:

1. Operator stores the secret in an approved local path.
2. Automation references the path and selected key, not the value.
3. The local machine reads the value into process memory.
4. The command receives the value through the CLI, environment, stdin, browser automation, or approved credential manager.
5. Reports include only status, never the value.

Safe report example:

```text
credential path: .local/test-accounts.json
selected credential key: accounts.personaA001
credential file: EXISTS
credential file gitignored: YES
required key: PRESENT
secret value exposed: NO
```

## Browser login credential pattern

For browser verification, agents should not ask the model to read credentials. Use this pattern instead:

```text
credential source: .local/test-accounts.json
selected key: accounts.personaA001
credential preflight: CREDENTIAL_PREFLIGHT_PASS
browser login performed locally: YES
credential values exposed: NO
```

A local browser executor may load the selected credential key into the browser form through local automation or manual operator entry. The model/report should see only key names and status fields.

## PR and Issue safety guidance

PR and Issue comments should include only:

- scope;
- related Issue or PR number;
- whether merge is needed;
- whether CTO approval is required;
- verification status without secret values.

Do not mix static verification PASS with functional PASS.

Examples:

- `git diff --check: PASS` means whitespace/static diff is clean only.
- `Cloudflare Preview smoke: PASS` means browser/runtime verification passed for the stated URL only.
- `Docs-only scope: PASS` does not imply runtime behavior was verified.

PR merge requires explicit CTO approval in the current task. Authentication or write permission is not authorization.

## Incident rule

If a secret, token, cookie, session, private key, Authorization header, database URL, service-account JSON, or credential value appears in output, stop immediately and report:

```text
SECURITY_INCIDENT_SECRET_EXPOSURE
```

Do not repeat the exposed value.