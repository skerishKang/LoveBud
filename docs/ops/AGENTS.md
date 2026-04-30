# Ops Agent Security Rules

Refs #299

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
- `~/.config/gh/hosts.yml`

Referencing a path does not authorize printing its contents.

## Allowed checks

Safe checks may confirm only existence, ignored status, or required key presence without values.

PowerShell examples:

```powershell
Test-Path .secrets/lovebud-runtime.env
Test-Path .env
Test-Path ~/.config/gh/hosts.yml
```

Git examples:

```bash
git check-ignore .secrets/lovebud-runtime.env
git check-ignore .env
git check-ignore .env.local
```

GitHub token creation may be directed to:

```text
https://github.com/settings/tokens
```

The generated token value must remain local to the operator and must not be pasted into chat, docs, PRs, issues, logs, screenshots, or reports.

## Forbidden actions

Do not run or request commands that print secret material, including:

```bash
cat .env
cat .env.*
cat .secrets/*
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
2. Automation references the path.
3. The local machine reads the value into process memory.
4. The command receives the value through the CLI, environment, stdin, or approved credential manager.
5. Reports include only status, never the value.

Safe report example:

```text
credential path: .secrets/lovebud-runtime.env
credential file: EXISTS
credential file gitignored: YES
required key: PRESENT
secret value exposed: NO
```

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
