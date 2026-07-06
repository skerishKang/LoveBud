# LoveBud Loop Runner

Status: v0 (dry-run only)
Target OS: Windows (local execution)
Updated: 2026-07-06

---

## 1. Prerequisites

| Tool | Required | Check command |
|------|----------|---------------|
| Node.js 18+ | Yes | `node --version` |
| Git | Yes | `git --version` |
| GitHub CLI (`gh`) | Yes | `gh --version` |
| GitHub CLI auth | Yes | `gh auth status` |

The loop runner requires an authenticated GitHub CLI session. Authentication is verified at startup. If auth is missing, the loop exits with a non-zero code and does not attempt any GitHub API call.

---

## 2. Execution

### Command

```powershell
npm run loop:triage
```

This runs:

```
node scripts/loop/run-loop.mjs --mode=dry-run
```

### What happens

0. **Load and validate policy**: `scripts/loop/policy-loader.mjs` reads `config/lovebud-loop.yml` and validates runtime constraints. Fail-closed — no GitHub call if policy is invalid.
1. GitHub CLI auth check → fail-safe exit if missing
2. Read GitHub state: main SHA, open issues, open PRs, CI check status
3. Classify items into lanes by labels and title heuristics
4. Assign status based on lane type and CI results (policy defines which lanes are auto-eligible vs human-required)
5. Validate output against schemas (using policy's allowed lanes and statuses)
6. Write report to output directory
7. Print summary to stdout

### Output location

Reports are written **outside** the repository:

```
%LOCALAPPDATA%\LoveBudLoop\reports\queue-<timestamp>.json
```

If `%LOCALAPPDATA%` is not set or does not exist, fallback:

```
%USERPROFILE%\LoveBudLoop\reports\queue-<timestamp>.json
```

File naming: `queue-{ISO-timestamp-with-hyphens}.json`

### Report format

```json
{
  "queue": [
    {
      "id": "pr-123",
      "type": "pr",
      "number": 123,
      "title": "Fix editor save feedback",
      "lane": "static-cleanup",
      "status": "READY_FOR_PLANNING",
      "risk": "low",
      "headRefName": "fix/editor-save",
      "headRefOid": "abc123...",
      "checks": "{\"success\":5}"
    }
  ],
  "timestamp": "2026-07-06T...",
  "mode": "dry-run",
  "mainSha": "b8587749..."
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (report generated) |
| 1 | Failure (auth fail, API error, validation error, forbidden mode) |

---

## 3. Safety guarantees

- **Policy enforced before first GitHub call**: `policy-loader.mjs` must succeed before any `gh` invocation. Invalid config is fail-closed.
- **No GitHub mutations**: The runner never creates, edits, or closes issues, PRs, comments, or labels.
- **No code changes**: The runner never modifies files in the repository.
- **No branches or worktrees**: The runner never creates or deletes branches or worktrees.
- **No pushes or PRs**: The runner never pushes or creates PRs.
- **No secrets in output**: Report files exclude raw issue bodies, token-like strings, and environment values.
- **Policy config is runtime-enforced**: `config/lovebud-loop.yml` is a single policy source. Config changes alone cannot enable execution, mutation, merge, or deployment capability.

---

## 4. Windows Task Scheduler (planned, not implemented)

v0 does not register Windows Task Scheduler. This section is documentation only.

Example scheduled task (for future reference):

```powershell
$action = New-ScheduledTaskAction -Execute "npm" -Argument "run loop:triage" -WorkingDirectory "G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-codex"
$trigger = New-ScheduledTaskTrigger -Daily -At 09:00
Register-ScheduledTask -TaskName "LoveBudLoopTriage" -Action $action -Trigger $trigger
```

Do not register this task in v0.

---

## 5. Troubleshooting

### GitHub CLI auth failure

```
LOOP TRIAGE FAILED: GitHub CLI authentication failed. Run gh auth login first.
```

Solution:

```powershell
gh auth login
```

### Forbidden mode

```
Error: mode "execute" is forbidden in v0. Only --mode=dry-run is allowed.
```

Only `--mode=dry-run` is accepted. All other modes are rejected.

### Report validation error

```
LOOP TRIAGE FAILED: report validation error - ...
```

This indicates a schema violation. Check that all queue items have valid lanes, statuses, and required fields.
