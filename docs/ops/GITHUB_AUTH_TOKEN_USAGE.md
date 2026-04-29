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

---

## 3. Secret handling rules

Never output, paste, summarize, screenshot, or log:

- raw GitHub credential values;
- partial credential values;
- credential prefixes or suffixes;
- Authorization headers;
- cookies;
- browser session values;
- credential store contents;
- one-time login codes;
- password manager entries.

Allowed reporting examples:

```text
GitHub CLI auth: authenticated as <account>
GitHub CLI auth: not authenticated
Required secret name: GH_TOKEN
Required secret name: GITHUB_TOKEN
```

Forbidden reporting examples:

```text
<environment variable name>=<credential value>
Authorization header with credential value
Cookie header with session value
```

If a credential or session value appears in terminal output, screenshots, logs, or browser developer tools, redact it before reporting. If redaction is not possible, do not share the artifact.

---

## 4. Credential storage and local files

GitHub login material must stay outside committed repository content.

Local-only paths that may contain secrets are:

- `.secrets/`
- `.env`
- `.env.*`

These paths must not be committed, copied into docs, pasted into PR comments, or included in screenshots.

If any `.secrets/` or `.env*` file appears in `git status --short` as tracked or staged content, stop and report `BLOCKED`.

Do not create new credential files inside the repository unless the CTO explicitly assigns a local-only file path and confirms it is ignored.

---

## 5. GitHub CLI usage rules

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

## 6. Browser login rules

Browser login may be used to inspect GitHub PRs, issues, checks, deployments, and deployment bot comments.

Rules:

- Do not show password manager UI in screenshots.
- Do not reveal account email, credentials, cookies, or browser session information.
- Do not copy private deployment logs that contain secrets.
- Do not approve OAuth scopes or third-party app permissions unless CTO explicitly instructs it.
- Do not use a personal browser session to mutate repository state unless the task explicitly authorizes that action.

When a browser session is needed only for inspection, keep the action read-only.

---

## 7. Connector vs local GitHub access

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

## 8. Write permission guardrails

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

## 9. Reporting template

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

## 10. Related documents

- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
- [PR_CHECKLIST.md](PR_CHECKLIST.md)
- [RUNBOOK.md](RUNBOOK.md)
