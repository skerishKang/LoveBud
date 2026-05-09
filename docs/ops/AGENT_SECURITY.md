# Agent Secret Handling Policy

Refs #299

## Purpose

This document centralizes the LoveBud rule that agents may guide local credential setup but must not view, print, store, summarize, or transmit credential values.

## Model and central-system boundary

Models, connector sessions, PR comments, Issue comments, documentation, screenshots, and central logs must not contain raw secrets.

Allowed information:

- credential name;
- local path;
- existence status;
- gitignored status;
- required key presence status;
- token generation URL.

Forbidden information:

- token value;
- partial token value;
- cookie value;
- session value;
- private key material;
- service account JSON;
- database URL value;
- Authorization header value;
- full environment dump.

## Approved local paths

Agents may refer to these paths only as paths:

- `.secrets/`
- `.env`
- `.env.*`
- `~/.config/gh/hosts.yml`

Do not print file contents from these paths.

## Approved existence checks

PowerShell:

```powershell
Test-Path .secrets
Test-Path .env
Test-Path .env.local
Test-Path ~/.config/gh/hosts.yml
```

Git:

```bash
git check-ignore .secrets/lovebud-runtime.env
git check-ignore .env
git check-ignore .env.local
```

Allowed reports:

```text
.secrets/: EXISTS
.env.local: EXISTS
.env.local: GITIGNORED
GH_TOKEN: PRESENT
secret value exposed: NO
```

## GitHub token setup

Agents may direct local operators to create tokens at:

```text
https://github.com/settings/tokens
```

The token must be copied only into the approved local credential store or CLI credential manager. It must not be pasted into chat, issue comments, PR comments, docs, screenshots, or logs.

## Local automation pattern

Use path indirection rather than value disclosure:

1. Local operator creates or updates a credential file in an approved ignored path.
2. Automation references the file path.
3. Local process reads the value.
4. CLI or script receives the value without printing it.
5. Report includes only `PRESENT`, `MISSING`, `EXISTS`, `GITIGNORED`, `PASS`, or `BLOCKED`.

## PR and Issue comments

Safe comments may include:

- scope summary;
- changed file list;
- related issue number;
- merge needed or not needed;
- CTO approval required or not yet given;
- static verification status;
- functional verification status, only when actually performed.

Do not conflate:

- static validation with browser/runtime behavior;
- docs-only review with functional PASS;
- authentication capability with authorization to merge.

## Merge authority

PR merge requires explicit CTO approval for that PR in the current task. Do not infer approval from authentication, CI success, or previous similar merges.

## Incident response

If a value is exposed, stop immediately and report only:

```text
SECURITY_INCIDENT_SECRET_EXPOSURE
```

Do not repeat the exposed value.
