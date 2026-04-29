# Local Verification Artifact Hygiene Audit

> **Status:** AUDIT_ONLY  
> **Source:** Issue #277  
> **Type:** Docs-only — no .gitignore, AGENTS, or runtime code changes

---

## 1. Incident Context

### PR #276 Scope Contamination Pattern

Issue #277 was created after observing scope contamination risks in local verification workflows:

| Contamination Type | Example | Risk Level |
|---|---|---|
| **Root-level screenshots** | `screenshot-*.png` in repository root | Medium |
| **Ops local reports** | `ops/**` containing executor screenshots/slot reports | Medium |
| **Worktree folders** | `work/**` local executor temporary folders | Medium |
| **Test results** | `docs/test-scenarios/results/**` unreviewed artifacts | Low-Medium |
| **Kilocode local artifacts** | `.kilocode/` local configuration contamination | Low |

### Root Causes

1. **Missing pre-commit guards** — No automated check for accidentally staged local artifacts
2. **Unclear classification** — Ambiguity about what constitutes "always-local" vs "reviewable" artifacts
3. **Index update risk** — Adding new artifacts to index without verifying .gitignore coverage
4. **Parallel PR conflicts** — Multiple PRs touching ops docs can create stale artifact references

---

## 2. Audit Targets

### 2.1 .gitignore Analysis

**Current patterns to audit:**

| Pattern | Status | Recommendation |
|---|---|---|
| `.secrets/` | Active | Keep — credential isolation |
| `.env*.local` | Active | Keep — local environment isolation |
| `*.log` | Active | Keep — log file exclusion |
| `.playwright-mcp/` | Active | Review — MCP screenshot directory |
| `work/` | Missing | **Candidate for addition** |
| `ops/screenshots/` | Missing | **Candidate for addition** |
| `console_*.log` | Partial | Review pattern specificity |

### 2.2 AGENTS.md References

**Section to audit:** Local verification guidelines

Current AGENTS.md includes UI validation guidelines that reference local servers. The document should clarify:

- When local static server verification is sufficient
- When Cloudflare Preview is required
- When test slots must be used
- Screenshot/artifact handling responsibilities

### 2.3 Kilocode Rules

**File:** `.kilocode/rules/00-lovebud-global.md` (if exists)

Audit for:
- Screenshot handling guidance
- Local artifact cleanup instructions
- Worktree hygiene rules
- Pre-commit verification steps

### 2.4 QA Account Usage Docs

**File:** `docs/ops/QA_ACCOUNT_USAGE.md`

Verify:
- Whether QA account credentials are documented as `.secrets/` only
- No hardcoded credentials in docs
- No screenshots containing session tokens

### 2.5 Test Scenarios Results Policy

**Directory:** `docs/test-scenarios/results/**`

Current status:
- Some test results may be committed for reference
- Need clear policy on what's acceptable
- Distinguish between "audit evidence" and "temporary results"

---

## 3. Artifact Classification

### 3.1 Always-Local Artifacts (Never Commit)

| Artifact Type | Location Pattern | Rationale |
|---|---|---|
| Screenshots | `*.png`, `screenshot-*` | Temporary visual verification only |
| Console logs | `console_*.log`, `*.log` | Ephemeral debugging output |
| Local environment | `.env*.local` | Local secrets/credentials |
| Session artifacts | `.secrets/`, `.ssh-backup/` | Security isolation |
| Executor worktrees | `work/`, `.work/` | Temporary execution folders |
| MCP artifacts | `.playwright-mcp/` | Browser automation output |

### 3.2 Reviewable Docs Artifacts (Commit with Approval)

| Artifact Type | Location Pattern | Rationale |
|---|---|---|
| Audit evidence | `docs/**/verification-report-*.md` | Reviewed documentation artifacts |
| Test manifests | `docs/test-scenarios/*-manifest.md` | Structured test documentation |
| Results with approval | `docs/test-scenarios/results/approved-*.md` | CTO-approved reference results |

### 3.3 Screenshot/Report Artifacts (Case-by-Case)

| Scenario | Handling | Example |
|---|---|---|
| PR body reference | Upload to GitHub directly, don't commit | GitHub-attached images |
| Documentation evidence | Commit with explicit CTO approval | UI state verification |
| Debugging artifacts | Never commit, use gist/temporary storage | Error state screenshots |
| CI artifacts | Use GitHub Actions artifacts, not repo | Test failure screenshots |

### 3.4 Test Results (Approval Required)

| Result Type | Commit Policy | Location |
|---|---|---|
| Automated test output | Never commit | CI artifacts only |
| Manual verification report | Commit if reviewed | `docs/**/verification-*.md` |
| Slot occupancy logs | Never commit | `.secrets/` or local only |
| Account credentials | Never commit | `.secrets/` with `.gitignore` |

### 3.5 Worktree/Executor Folders (Must Stay Untracked)

| Folder Pattern | Purpose | .gitignore Status |
|---|---|---|
| `work/` | Local executor temporary folders | **Missing — needs audit** |
| `.work/` | Alternative executor pattern | **Missing — needs audit** |
| `tmp/` | General temporary storage | Check existing patterns |
| `temp/` | Alternative temp pattern | Check existing patterns |
| `local/` | Local-only development | Check existing patterns |

---

## 4. Recommendation Matrix

### 4.1 .gitignore Updates Needed

| Pattern | Priority | PR Assignment |
|---|---|---|
| `work/` | High | Follow-up PR A |
| `ops/screenshots/` | Medium | Follow-up PR A |
| `console_desktop_*.log` | Low | Follow-up PR A |
| `*.local.png` (screenshots) | Medium | Follow-up PR A |

### 4.2 Docs Updates Needed

| Document | Update Type | PR Assignment |
|---|---|---|
| `docs/ops/TEST_SLOT_USAGE.md` | Clarify slot screenshot handling | Follow-up PR B |
| `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md` | Add artifact cleanup step | Follow-up PR B |
| `AGENTS.md` | Add local artifact guardrails | Follow-up PR B |

### 4.3 Agent Rules Updates Needed

| Rule File | Update Type | PR Assignment |
|---|---|---|
| `.kilocode/rules/00-lovebud-global.md` | Add pre-commit artifact check | Follow-up PR C |
| New: `99-local-hygiene.md` | Create dedicated hygiene rules | Follow-up PR C |

### 4.4 PR Preflight Checklist Addition

| Check | Location | PR Assignment |
|---|---|---|
| "No local screenshots staged?" | PR template | Follow-up PR C |
| "No work/ folder contents?" | PR template | Follow-up PR C |
| "No console_*.log files?" | PR template | Follow-up PR C |
| ".secrets/ unchanged?" | PR template | Follow-up PR C |

---

## 5. Guardrails

### This Audit PR Strictly Avoids:

- ❌ **No file deletion** — Audit identifies, does not remove
- ❌ **No moving local artifacts** — Only documents current state
- ❌ **No runtime/code changes** — Docs-only scope
- ❌ **No Search/Browse fix logic** — Unrelated to Issue #277
- ❌ **No PR #7 changes** — Strict prohibition
- ❌ **No PR #319 contact** — Parallel work isolation
- ❌ **No PR #320/#321/#322 changes** — Parallel work isolation
- ❌ **No prototype/reference/demo/variant changes** — Strict prohibition

### Follow-up PRs Must Maintain:

- ✅ Minimal `.gitignore` patterns (specific, not broad)
- ✅ Docs-only guidance in ops documents
- ✅ Agent rules that guide, don't block
- ✅ No deletion without explicit CTO approval
- ✅ No breaking changes to existing workflows

---

## 6. Follow-up PR Split Proposal

### Recommended Sequence

#### PR A: .gitignore Minimal Pattern Update

**Scope:**
- Add `work/` folder exclusion
- Add `ops/screenshots/` exclusion
- Add specific screenshot patterns
- No broad wildcard additions

**Verification:**
- `git diff --check`
- Changed files: `.gitignore` only
- No runtime changes
- Test: `git status` in work/ folder shows untracked

#### PR B: Ops Docs Policy Update

**Scope:**
- Update `docs/ops/TEST_SLOT_USAGE.md`
- Update `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
- Add artifact cleanup guidance
- No index link changes (conflict avoidance)

**Verification:**
- `git diff --check`
- Changed files: ops docs only
- No .gitignore changes (handled in PR A)

#### PR C: Agent Rules Checklist Update

**Scope:**
- Update `.kilocode/rules/00-lovebud-global.md` or create new
- Add pre-commit verification checklist
- Add artifact hygiene guidance
- Add PR template updates if applicable

**Verification:**
- `git diff --check`
- Changed files: agent rules only
- No runtime/code changes

#### PR D: Optional Preflight Script/Checklist (Deferred)

**Scope:**
- Pre-commit hook or script (optional)
- PR checklist template updates
- Automation for common checks

**Note:** This PR is **deferred** until PR A-C are merged and validated.

---

## 7. Immediate Actions (This PR Only)

### Permitted in docs/local-artifact-hygiene-audit:

1. ✅ Create this audit document
2. ✅ Minimal index link addition (if existing pattern exists, low conflict risk)
3. ✅ No file modifications, deletions, or moves

### Verification Checklist (This PR):

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/ops/LOCAL_ARTIFACT_HYGIENE_AUDIT.md`
- [ ] No `.gitignore` changes
- [ ] No AGENTS or agent-rule changes
- [ ] No file deletion or artifact movement
- [ ] No runtime/code/config changes
- [ ] No close keywords for #277
- [ ] Issue #277 remains open

---

## 8. Parallel Work Isolation

### Active PRs to Avoid:

| PR | Reason | Isolation Rule |
|---|---|---|
| PR #319 | Active ops docs PR | Do not touch ops_index.md if #319 is modifying it |
| PR #320 | Active feature PR | No overlap with Search/Browse |
| PR #321 | Active feature PR | No overlap with Editor/Modal |
| PR #322 | Active feature PR | No overlap with Auth/My Trees |

### Conflict Detection:

Before any index updates:
1. Check `git log --oneline origin/main..HEAD` for ops docs changes
2. Verify no parallel PR is modifying `docs/ops/ops_index.md`
3. If conflict risk exists: skip index update entirely

---

## 9. Notes

Issue #277 remains **open** because:
- `.gitignore` updates are pending (PR A)
- Ops docs policy updates are pending (PR B)
- Agent rules updates are pending (PR C)
- Preflight automation is deferred (PR D)

This audit document establishes the baseline and roadmap for those follow-up tasks.

**Key Principle:** Local artifact hygiene is a process issue, not a code issue. The solution is guidance and guards, not deletion or restriction.
