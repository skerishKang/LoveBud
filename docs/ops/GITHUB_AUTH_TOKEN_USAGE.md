# GitHub Auth Token Usage

**Status:** Active ops guidance
**Owner:** CTO / Ops Lead
**Scope:** GitHub CLI login, browser login sessions, connector-backed GitHub access, and local verification agents

---

## 1. Purpose

Some LoveBud agents work through GitHub connectors, while other local/browser agents must authenticate with GitHub directly through GitHub CLI or a browser session.

This document defines safe operating rules for GitHub authentication and credential handling.

It does not authorize broad repository writes, direct `main` pushes, merges, issue closes, branch deletion, or secret disclosure. Task-specific authority must still come from the CTO prompt.

---

## 2. Allowed authentication surfaces

Allowed GitHub access surfaces:

- GitHub connector access provided by the execution environment.
- GitHub CLI authenticated through the local credential manager.
- Browser login to GitHub for viewing PRs, issues, checks, deployments, and comments.
- Local environment variables for GitHub authentication only when values are already provisioned securely by the user or CI environment.

Agents may verify authentication state with commands such as:

```bash
gh auth status
```

Do not print credential values or copy credential-store contents into reports.

GitHub token creation may be directed to:

```text
https://github.com/settings/tokens
```

The generated token value must remain local to the operator and must not be pasted into chat, docs, PRs, issues, screenshots, logs, or reports.

---

## 3. Secret handling rules

Secret Handling Clarification

Agents must never print, paste, summarize, screenshot, log, commit, or expose secret values.

Model-side or central-system work must not access actual token or secret values. Agents may guide operators by naming the required credential, approved path, and safe presence check only.

However, local machine processes may use secrets when required for authorized project operations, provided that the value is not displayed, copied, summarized, committed, or persisted outside the approved local secret store.

**Allowed:**
- Referring to secret names, required locations, and expected presence.
- Referencing approved local paths only as paths:
  - `.secrets/`
  - `.env`
  - `.env.*`
  - `~/.config/gh/hosts.yml`
- Checking whether a required secret file exists.
- Checking whether required secret keys are present, without printing values.
- Checking whether local secret files are ignored with `git check-ignore`.
- Loading a local secret file into an environment for an authorized command or test, without displaying the value.
- Using secrets through approved tools such as gh, wrangler, firebase, npm scripts, or local test runners.
- Reporting only redacted status:
  - `GH_TOKEN: PRESENT`
  - `CLOUDFLARE_API_TOKEN: PRESENT`
  - `.secrets/lovebud-runtime.env: EXISTS`
  - `.secrets/lovebud-runtime.env: GITIGNORED`
  - `required secret keys present: YES`

**Forbidden:**
- Printing raw secret values.
- Printing partial secret values.
- Printing credential prefixes, suffixes, or last characters.
- Copying secrets into issue/PR comments, docs, chat, screenshots, logs, or reports.
- Summarizing private keys, service account JSON, tokens, cookies, session values, or Authorization headers.
- Committing secret files or generated files containing secret values.
- Running commands that echo secrets to stdout/stderr.
- Running commands that dump all environment variables.
- Including secret values directly in command lines that may be stored in shell history or process lists.
- Asking a model, connector, or central system to read and display a credential file.

**Clarification:**
- Secret files may be read by local machine processes only for authorized local execution or key-presence validation.
- Secret values must not be displayed to the agent, user, logs, PRs, issues, screenshots, or reports.
- Reports may contain only `EXISTS` / `MISSING` / `PRESENT` / `GITIGNORED` / `SUCCESS` / `FAIL` / `REDACTED`.
- If a secret value is accidentally displayed or logged, stop work and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the secret.

**PowerShell guidance:**

Allowed:

```powershell
Test-Path .secrets/lovebud-runtime.env
Test-Path .env
Test-Path .env.local
Test-Path ~/.config/gh/hosts.yml
git check-ignore .secrets/lovebud-runtime.env
```

Forbidden:

```powershell
cat .secrets/lovebud-runtime.env
type .secrets/lovebud-runtime.env
Get-Content .secrets/lovebud-runtime.env
echo $env:GH_TOKEN
echo $env:CLOUDFLARE_API_TOKEN
Get-ChildItem Env:
```

---

## 4. Credential storage and local files

GitHub login material must stay outside committed repository content.

Local-only paths that may contain secrets are:

- `.secrets/`
- `.env`
- `.env.*`
- `~/.config/gh/hosts.yml`

These paths must not be committed, copied into docs, pasted into PR comments, or included in screenshots.

If any `.secrets/` or `.env*` file appears in `git status --short` as tracked or staged content, stop and report `BLOCKED`.

Do not create new credential files inside the repository unless the CTO explicitly assigns a local-only file path and confirms it is ignored.

---

## 5. Local automation pattern

Use path indirection rather than value disclosure.

1. Operator stores the credential in an approved local path.
2. Automation references only the path.
3. The local process reads the value into process memory.
4. The CLI or script receives the value without printing it.
5. Reports include only status words such as `PRESENT`, `MISSING`, `EXISTS`, `GITIGNORED`, `PASS`, or `BLOCKED`.

**Important for GitHub CLI operations:**

When GitHub CLI authentication is required, the agent should:

1. Check if `gh auth status` shows authenticated state
2. If already authenticated (keyring/session/token stored), the agent can use `gh` commands directly
3. The agent does NOT read the token value from files or environment
4. The agent runs `gh` commands which will use the already-authenticated session or stored token
5. The agent only reports authentication status: `AUTHENTICATED` or `NOT_AUTHENTICATED`
6. If not authenticated, guide the user to run `gh auth login` (which stores token in keyring)

**Key point**: GitHub CLI automatically uses stored tokens from keyring. The agent does NOT need to read or handle token values manually. The CLI handles token storage and usage securely.

Example PowerShell pattern for checking auth state:

```powershell
# Allowed: Check auth status without reading token values
gh auth status
# Output: Logged in as username → This is safe to report
```

Safe report example:

```text
credential path: .secrets/lovebud-runtime.env
credential file: EXISTS
credential file gitignored: YES
required key: PRESENT
secret value exposed: NO
gh auth status: AUTHENTICATED
```

---

## 6. GitHub CLI usage rules

Before write operations, verify repository and account context:

```bash
gh auth status
gh repo view --json nameWithOwner
```

For PR-specific work, verify the target PR:

```bash
gh pr view <PR_NUMBER> --json number,state,isDraft,headRefName,headRefOid,baseRefName,changedFiles,url
```

For merge operations, use expected head SHA protection when available:

```bash
gh pr merge <PR_NUMBER> --squash --match-head-commit <EXPECTED_HEAD_SHA>
```

Merge is forbidden unless the CTO explicitly approves that merge in the current task.

---

## 7. Browser login rules

Browser login may be used to inspect GitHub PRs, issues, checks, deployments, and deployment bot comments.

Rules:

- Do not show password manager UI in screenshots.
- Do not reveal account email, credentials, cookies, or browser session information.
- Do not copy private deployment logs that contain secrets.
- Do not approve OAuth scopes or third-party app permissions unless CTO explicitly instructs it.
- Do not use a personal browser session to mutate repository state unless the task explicitly authorizes that action.

When a browser session is needed only for inspection, keep the action read-only.

---

## 8. Connector vs local GitHub access

Connector-based access and local GitHub access are separate trust surfaces.

Connector access may be used for:

- reading PRs, issues, commits, changed files, and diffs;
- creating issues or PRs when explicitly assigned;
- updating PR body/checklist when explicitly assigned;
- adding comments when explicitly assigned.

Local `gh` access should be preferred for:

- `git diff --check` verification;
- local branch and working-tree checks;
- mergeability checks involving `merge-tree`;
- ready/merge actions when connector mutation fails;
- expected head SHA protected merges.

Do not assume connector state and local branch state are equivalent. Verify both when the task requires it.

---

## 9. Write permission guardrails

Authentication does not imply authorization.

Even when authenticated, do not perform these actions unless explicitly assigned:

- direct push to `main`;
- merge PR;
- close issue;
- delete branch;
- force push;
- rebase shared branch;
- reset/stash/clean dirty worktree;
- modify secrets or provider dashboard configuration;
- approve new OAuth/application scopes.

Use task-specific permission, not account capability, as the source of authority.

---

## 10. PR and Issue safety guidance

PR and Issue comments should include only:

- scope;
- related Issue or PR number;
- whether merge is needed;
- whether CTO approval is required;
- verification status without secret values.

Do not mix static verification PASS with functional PASS.

Examples:

- `git diff --check: PASS` means whitespace/static diff is clean only.
- `Docs-only scope: PASS` means file scope was checked only.
- `Cloudflare Preview smoke: PASS` means browser/runtime verification passed for the stated URL only.

PR merge requires explicit CTO approval in the current task.

---

## 11. Reporting template

Use this compact report when GitHub authentication is relevant:

```text
GitHub Auth Context Report
1. Computer/model:
2. Access surface: connector / gh CLI / browser login / CI-provided credential
3. Repository verified:
4. Auth account verified: yes/no
5. Credential value exposed: NO
6. Cookie/session exposed: NO
7. Write operation performed: NO / specify authorized operation
8. Issue/PR close performed: NO
9. Merge performed: NO / specify approved merge
10. Final status:
```

---

## 12. Related documents

- [AGENTS.md](AGENTS.md)
- [AGENT_SECURITY.md](AGENT_SECURITY.md)
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
- [PR_CHECKLIST.md](PR_CHECKLIST.md)
- [RUNBOOK.md](RUNBOOK.md)
