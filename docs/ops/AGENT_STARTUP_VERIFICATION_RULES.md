# Agent Startup Verification Rules

Issue: #464

This runbook defines the mandatory startup and verification rules for LoveBud agents before GitHub, browser, runtime, fixed-slot, or repository work.

It is docs/process-only. It does not authorize product UI changes, backend changes, Auth changes, database changes, package changes, workflow changes, secret inspection, branch deletion, or merge actions.

## Purpose

LoveBud uses multiple AI agents, models, workstations, and fixed test slots in parallel. Every agent must start from the same operational checklist so tasks do not collide, runtime verification is not overclaimed, dirty worktrees are preserved, and sensitive values are not exposed.

This document standardizes:

- required startup checklist fields,
- fixed test slot classification,
- browser verification environment rules,
- dirty worktree stop behavior,
- token/secret-safe handling,
- PR/report status language,
- handoff expectations.

## Mandatory startup checklist

Before any GitHub, browser, runtime, local repository, or fixed test slot task, the agent report must include or explicitly confirm:

```text
Agent Startup Checklist

1. Repository:
2. Current branch/worktree:
3. git status --short:
4. Dirty worktree status:
5. If dirty, STOP performed:
6. main direct push prohibited acknowledged:
7. Merge requires CTO approval acknowledged:
8. PR #7/prototype/reference/demo/variant protected acknowledged:
9. PR #450 protected if active/relevant acknowledged:
10. Secret/token/cookie/session/credential output prohibited acknowledged:
11. Browser verification classification:
12. Fixed test slot required:
13. Assigned test slot:
14. Slot deployed SHA matches PR head SHA:
15. If no fixed slot, browser result status:
```

If the task is GitHub Web/API-only and no local repository is used, write `not applicable - GitHub Web/API-only` for local branch/worktree fields rather than inventing values.

## Dirty worktree policy

If `git status --short` is not empty:

- STOP immediately.
- Do not commit.
- Do not stash.
- Do not restore files.
- Do not checkout files to discard changes.
- Do not reset.
- Do not clean.
- Do not push.
- Do not merge.
- Preserve dirty and untracked files.
- Report the dirty paths without exposing sensitive values.
- Wait for a clean worktree assignment or explicit CTO disposition.

A dirty worktree does not authorize cleanup. Cleanup is a separate decision.

## Main and PR flow rules

- Never modify `main` directly.
- Never push directly to `main`.
- Use one branch per task.
- Use PR-only merge flow.
- Prefer squash merge unless the CTO explicitly approves another method.
- Merge requires CTO approval.
- PR creation and additional commits require scope discipline.
- Stop if unauthorized files change.
- Do not mix UI work with docs/ops/backend/security/runtime work unless explicitly scoped.
- Do not modify, close, merge, delete, or cleanup PR #7/prototype/reference/demo/variant paths.
- Do not touch PR #450 files unless the active task explicitly authorizes it.

## Browser verification classification

Before browser work, classify the page or flow.

| Flow type | Fixed test slot required? | Notes |
| --- | --- | --- |
| Docs-only | No | Static review or PR diff is usually enough. |
| Static public page without login/API dependency | Usually no | Cloudflare PR Preview may be sufficient. |
| CSS-only public landing/intro smoke | Usually no | PR Preview can be enough if no Auth/API runtime state is needed. |
| Editor | Yes | Data, state, and interaction flows are runtime-sensitive. |
| My Trees | Yes | Auth/API/user data required. |
| Login/Auth | Yes | PR Preview alone is not sufficient for final PASS. |
| API-dependent UI | Yes | Must verify actual deployed API path. |
| DB-backed data display | Yes | Must verify runtime data path. |
| User-specific state | Yes | Requires fixed slot and secret-safe auth handling. |
| CTA click flow that saves/edits/creates/deletes | Yes | Requires fixed slot and runtime verification. |
| Browse/Search actual data loading | Yes unless public production observation is explicitly requested | Distinguish static layout from data-backed behavior. |
| Flicker/loading/runtime-state investigation | Yes | PR Preview alone cannot prove stateful runtime behavior. |
| Production public read observation | No fixed slot if explicitly production-only | Do not mutate data or expose private payloads. |

## Fixed test slot rules

A fixed test slot is required for Auth/API/runtime-sensitive verification.

Rules:

- One fixed test slot is assigned to one PR until verification completes.
- The slot branch and deployed SHA must match the expected PR head SHA.
- If slot SHA cannot be confirmed, final result cannot be `PASS`.
- If slot SHA mismatches, mark `BLOCKED` or `NOT_VERIFIED` and stop browser claims.
- If login/Auth cannot be completed, final result cannot be `PASS`.
- Cloudflare PR Preview alone is not sufficient for Login/Auth/API/runtime final PASS.
- Browser reports must record URL provenance: PR Preview, Branch Preview, fixed test slot, production, or local.

Suggested fixed slot verification fields:

```text
Fixed Slot Verification

1. Assigned slot:
2. Slot URL:
3. PR number:
4. Expected PR head SHA:
5. Deployed slot SHA:
6. SHA match: YES / NO / NOT_VERIFIED
7. Browser result validity: PASS / NOT_VERIFIED / BLOCKED
```

## PR Preview allowed cases

Cloudflare PR Preview can be sufficient for:

- docs-only checks,
- static public pages that do not require login,
- CSS-only public landing/intro visual smoke,
- static copy/layout smoke,
- deployment existence checks,
- public non-mutating route smoke when explicitly scoped as public observation.

It is not sufficient for:

- Auth-gated flows,
- user-specific pages,
- save/edit/delete/create behavior,
- DB-backed state changes,
- Editor/My Trees runtime behavior,
- fixed test slot tasks,
- final PASS claims for runtime-sensitive flows.

## Token and secret handling policy

Treat the following as sensitive and never output values:

- token
- secret
- API key
- cookie
- session
- credential
- private key
- SSH key
- Firebase service-account material
- OAuth callback/session material
- test-account password or session state
- Authorization header value
- raw private request body
- private tree or memory content

Allowed reporting terms:

- `PRESENT`
- `ABSENT`
- `UNKNOWN`
- `configured`
- `not configured`
- `redacted`
- `not inspected`
- `no secret values exposed`

Forbidden:

- printing values,
- printing partial prefixes/suffixes,
- decoding secrets,
- dumping browser storage,
- dumping cookies,
- dumping unknown archives,
- copying raw logs that may contain sensitive values,
- including screenshots that show sensitive values.

## Log and diagnostics handling

When checking logs, report only redaction-safe metadata:

- route pattern or endpoint category,
- HTTP method,
- status code,
- coarse error category,
- request ID presence or absence,
- upstream/degraded header presence or absence,
- timestamp or relative time if needed,
- duration bucket if available.

Do not paste raw log lines unless they are confirmed not to contain sensitive values. Prefer summaries over raw output.

## PASS / NOT_VERIFIED / BLOCKED rules

Use `PASS` only when the claim was actually verified in the correct environment.

Use `NOT_VERIFIED` when:

- the environment cannot prove the requested property,
- a browser flow was not exercised,
- a private/authenticated path was intentionally excluded,
- logs were not accessible,
- fixed slot was not required but runtime proof remains partial,
- only static inspection was performed.

Use `BLOCKED` when:

- required fixed slot is missing,
- slot SHA mismatches expected PR head SHA,
- required credentials/access are unavailable,
- DNS/network blocks verification,
- dirty worktree policy requires stopping,
- required logs cannot be reviewed safely,
- deployment is stale or mismatched.

Do not convert `NOT_VERIFIED` or `BLOCKED` into `PASS` for narrative convenience.

## Required report shape

Use this compact report format unless the task provides a stricter one.

```text
Verification Report

1. Computer/model:
2. Repository:
3. Task/issue/PR:
4. Branch:
5. git status --short:
6. Dirty worktree status:
7. Environment type:
8. Fixed test slot required:
9. Assigned slot:
10. Expected head SHA:
11. Deployed SHA:
12. SHA match:
13. Changed files or tested routes:
14. PASS:
15. NOT_VERIFIED:
16. BLOCKED:
17. Secret/token/cookie/session/credential exposure: NONE / STOP_AND_REPORT
18. Private payload exposure: NONE / STOP_AND_REPORT
19. Final recommendation:
```

## PR body verification environment section

For runtime-sensitive PRs, include or preserve a verification environment section:

```markdown
## Verification Environment

- [ ] Static/diff-only verification
- [ ] Cloudflare PR preview verification
- [ ] Fixed test slot required
- [ ] Fixed test slot used: test__
- [ ] Slot deployed SHA matches PR head SHA
- [ ] Login/Auth verified if required
- [ ] API/runtime verified if required
- [ ] Browser result marked NOT_VERIFIED if no fixed slot
```

Do not mark fixed-slot or login/Auth checks complete unless verified.

## Agent handoff rules

When handing off to another model or workstation:

- Include repository, issue, PR, branch, head SHA, allowed files, forbidden files, and expected verification environment.
- State whether a new PR will be created.
- State whether a fixed test slot is assigned.
- State current blockers.
- Do not include secrets, tokens, cookies, sessions, credentials, private payloads, or browser storage values.
- Do not issue duplicate prompts for work already assigned to another active worker.
- Warn about overlapping files or active PRs.

## Stop conditions

Stop and report when any of the following occur:

- dirty worktree discovered,
- unauthorized file changed,
- protected PR #7/prototype/reference/demo/variant path appears in diff,
- protected PR #450 path appears without authorization,
- secret/private value is encountered,
- fixed test slot SHA mismatch,
- merge conflict or mergeability uncertainty appears,
- requested task would mix UI and non-UI scopes without approval,
- runtime verification would require unavailable credentials or unsafe private payload inspection.

## Related documents

- `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md`
- `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
- `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`
- `docs/ops/TEST_PREVIEW_SLOTS.md`
- `docs/ops/MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md`
- `docs/ops/AGENT_SECURITY.md`
- `docs/project/VERIFICATION_AND_EVIDENCE.md`
- `docs/project/VERIFICATION_WARNING_CATALOG.md`

## Closure criteria for #464

This issue can be closed when:

- a single agent startup checklist exists,
- fixed test slot requirements are documented for Auth/API/runtime flows,
- dirty worktree stop behavior is explicit,
- token/secret-safe handling is explicit,
- reports distinguish `PASS`, `NOT_VERIFIED`, and `BLOCKED`,
- the initial change remains docs-only with no workflow/package/runtime changes.
