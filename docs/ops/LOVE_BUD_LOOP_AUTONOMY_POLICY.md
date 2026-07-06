# LoveBud Loop Autonomy Policy

Status: v0 (dry-run only)
Scope: LoveBud Loop Engineering Phase 1 — Local Foundation

---

## 1. Purpose

The LoveBud Loop reads GitHub open issues, open PRs, and CI status to produce a **work queue**. v0 produces a queue only — no mutations, no automation, no code changes.

```
GitHub state → read → classify → queue report → stop
```

The model assists classification and planning suggestions. The policy engine (this document + config/lovebud-loop.yml) defines what is allowed and what is forbidden.

---

## 2. v0 Mode: dry-run only

v0 operates exclusively in dry-run mode. No code, branch, worktree, PR, or GitHub state is modified.

### Allowed operations
- Read GitHub issue/PR/CI state via `gh` (read-only API calls)
- Classify items into lanes
- Assign status labels (local only, stored in report file outside repo)
- Write report to `%LOCALAPPDATA%\LoveBudLoop\reports\` (or user home fallback)

### Forbidden operations
- GitHub issue/PR/comment/label mutation (create, edit, close, comment, label change)
- Branch creation or deletion
- Worktree creation or deletion
- Code modification
- Push or PR creation
- Merge
- Cloudflare / Modal / Firebase / Neon configuration change
- DB migration
- Auth change
- UI change

---

## 3. Lane classification

### Auto-eligible lanes
These lanes may be classified `READY_FOR_PLANNING` without human review:

| Lane | Description |
|------|-------------|
| `docs` | Documentation-only changes |
| `contract-test` | Contract test additions or corrections |
| `test-stability` | Flaky test fixes, test infrastructure |
| `static-cleanup` | Static analysis fixes, linting, code cleanup with no behavioral change |

### Human-required lanes
These lanes require human product, UX, or operational decision:

| Lane | Description |
|------|-------------|
| `product-decision` | Feature scope, priority, trade-offs |
| `ux-direction` | User-facing interaction, copy, layout |
| `browser-ui-qa` | UI verification requiring real browser + production/preview data |
| `database-migration` | Schema change, data migration |
| `api-contract` | API endpoint signature, response contract |
| `auth` | Authentication, authorization, session |
| `privacy` | PII handling, data exposure |
| `deployment` | Infrastructure, CI/CD, deployment config |
| `production-approval` | Release sign-off |

---

## 4. Status assignment

| Status | Meaning | Auto-assignable |
|--------|---------|-----------------|
| `READY_FOR_PLANNING` | Auto-eligible lane, clean CI | Yes |
| `BLOCKED_BY_CI` | PR has failing or pending checks | Yes |
| `BLOCKED_BY_DEPENDENCY` | Item depends on another not-yet-merged change | Yes (with dependency metadata) |
| `NEEDS_PRODUCT_DECISION` | Human-required lane, needs product/UX decision | Yes |
| `NEEDS_UI_QA` | UI verification needed | Yes |
| `NEEDS_DEPLOYMENT_APPROVAL` | Deployment or production approval needed | Yes |
| `SCOPE_CONFLICT` | Overlaps with another active item | Manual |
| `NO_AUTO` | Cannot determine lane with sufficient confidence | Yes |

Default: when evidence is insufficient, classify as `NEEDS_PRODUCT_DECISION` or `NO_AUTO`.

**When in doubt, do not automate.**

---

## 5. CI policy

- PRs with red (failure) or pending CI checks are never auto-eligible.
- Such PRs must be classified `BLOCKED_BY_CI`.
- CI status is read from GitHub check runs API.

---

## 6. Issue #1882 protection

- `#1882` is the parent product issue. It must never be closed by automation.
- No commit, PR description, or automation output may use "Closes", "Fixes", or "Resolves" followed by issue reference `#1882`.
- `Refs #1882` may be used when referencing the issue.
- The loop must never mutate issue #1882.

---

## 7. Verification separation

Verification stages must be clearly separated:

| Stage | Environment | Can close? |
|-------|-------------|-----------|
| Local static analysis | Local machine | No — syntax/lint only |
| Local contract test | Local machine | No — logic/contract only |
| Remote CI | GitHub Actions | No — build/test only |
| Cloudflare Preview | PR Preview URL | No — pre-merge functional |
| Fixed test slot | Assigned slot URL | No — pre-merge functional |
| Production | `lovebud.pages.dev` | Only after merge to main |

UI verification requires the user's logged-in production/preview session. No UI task may be closed as complete without confirmed production or preview QA.

---

## 8. Secret and environment safety

- No token, secret, cookie, session, API key, or environment variable value may appear in model prompts, logs, or reports.
- Reports may contain only redacted status words: `PRESENT`, `MISSING`, `EXISTS`, `GITIGNORED`, `PASS`, `FAIL`, `BLOCKED`.
- Report files written to `%LOCALAPPDATA%\LoveBudLoop\reports\` must exclude raw issue bodies, token-like strings, and environment values.
- The `collect-github-state.mjs` script strips raw issue bodies and filters output for safety.

---

## 9. Enforcement

- `config/lovebud-loop.yml` is the machine-readable policy source. It is loaded and validated at runtime by `scripts/loop/policy-loader.mjs` **before** any GitHub API call.
- `policy-loader.mjs` implements a strict YAML subset parser with fail-closed behavior:
  - Duplicate keys, unknown root keys, malformed lists, unsupported YAML syntax → `POLICY_CONFIG_INVALID`
  - Config path is resolved relative to the module location, not the working directory.
  - Error messages never include raw config content, token patterns, filesystem paths, or environment values.
- Runtime policy validation enforces:
  - `mode` must be `dry-run-only`
  - `implementation_slots` and `verification_slots` must be `1` in v0
  - Auto/human lane lists must be non-empty, unique, and non-overlapping
  - `allowed-statuses` must include `NO_AUTO`, `CI_DATA_MISSING`, `CI_STATE_UNTRUSTED`, `CI_UNKNOWN_STATUS`
  - All mutation keys (`merge`, `issue mutation`, `pr mutation`, `worktree mutation`) must be exactly `['disabled']`
- Policy load/validation failure stops the runner **before** any GitHub CLI call. No collector is invoked.
- `config/lovebud-loop.yml` is no longer a declarative reference document. It is the **runtime-enforced single policy source**.
- Changing config alone cannot enable execution, mutation, merge, worktree, or deployment capability. Schema extensions require separate review and contract test changes.
- `scripts/loop/policy-loader.mjs` policy compliance.
- `tests/contracts/lovebud-loop-policy-loader-contract.test.cjs` verifies YAML parsing, policy validation, and runtime fail-closed behavior.
- `tests/contracts/lovebud-loop-autonomy-policy-contract.test.cjs` verifies config and doc policy compliance.
- `tests/contracts/lovebud-loop-triage-contract.test.cjs` verifies triage behavior with fixtures.
- Violations (merge, push, PR create, issue mutation) must cause test failure.
