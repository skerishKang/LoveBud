# CI Risk-Tier Gate Policy Contract

> **Status:** Implementation — Issue #3710  
> **Parent:** #3670  
> **Baseline SHA:** `daec7e8895836b1b5f0c0ce36084a5c83cf8aa38`  
> **Generic risk tier:** Tier 2  
> **UI class:** NOT_APPLICABLE  
> **Execution effect:** Repository-source-only  
> **Workflow effect:** None authorized  
> **Test-behavior effect:** None authorized  

## Evidence boundary

This child creates a machine-readable risk-tier gate policy and a deterministic planner that maps Tier/UI/capability combinations to execution-group plans. It does **not** execute any test, browser, network, provider, database, or workflow action.

## Authority separation

| Authority | File | Owner |
|-----------|------|-------|
| Risk-tier gate policy | `tests/ci-risk-gate-policy.json` | This child (#3710) |
| Deterministic planner | `scripts/plan-ci-risk-gates.cjs` | This child (#3710) |
| Policy contract test | `tests/contracts/ci-risk-gate-policy-contract.test.cjs` | This child (#3710) |
| Policy contract doc | `docs/architecture/CI_RISK_TIER_GATE_POLICY_CONTRACT.md` | This child (#3710) |
| Test layer classification | `tests/test-layer-classification.json` | #3429 / #3710 (1 entry) |
| Execution-group registry | `tests/ci-test-group-registry.json` | #3685 |
| Registry contract | `tests/contracts/ci-test-group-registry-contract.test.cjs` | #3685 / #3710 (count update) |
| Layer reporter | `scripts/report-test-layers.cjs` | #3429 |
| Group reporter | `scripts/report-ci-test-groups.cjs` | #3685 |

The risk-tier gate policy references but does not duplicate the execution-group registry. Registry membership continues to live in `tests/ci-test-group-registry.json`.

## Policy schema

`tests/ci-risk-gate-policy.json` (`schema_version: 1.0.0`)

```
tier_enum:           [TIER_1, TIER_2, TIER_3]
ui_class_enum:       [NOT_APPLICABLE, U0, U1, U2, U3]
capability_enum:     17 capability flags
sensitive_capabilities: 9 sensitive flags (auth, api_write, cache, DB, migration, privacy, provider, deployment, destructive)
execution_group_enum: 8 groups (matches ci-test-group-registry.json group_enum)
```

### Tier/UI/capability matrix

| Tier | UI | Valid capabilities |
|------|-----|-------------------|
| TIER_1 | NOT_APPLICABLE | Any (non-UI work, e.g. CI/docs) |
| TIER_1 | U0 | `copy_or_docs` only |
| TIER_1 | U1 | `visual_only`, `copy_or_docs` only |
| TIER_2 | NOT_APPLICABLE | Any non-sensitive |
| TIER_2 | U1 | `visual_only`, `copy_or_docs` only |
| TIER_2 | U2 | Non-sensitive: `structural_dom`, `responsive_layout`, `accessibility_or_focus`, `browser_runtime`, `process_runtime`, `api_read` |
| TIER_3 | NOT_APPLICABLE | Any |
| TIER_3 | U2 | Any (including sensitive) |
| TIER_3 | U3 | Any (including sensitive) |

### Prohibited combinations

- `U0` with `TIER_2` or `TIER_3` (copy-only should never need medium/high tier)
- `U2` with `TIER_1` (structural work must be at least Tier 2)
- `U3` with `TIER_1` (runtime-sensitive work requires at least Tier 2)
- `U0`/`U1` with any capability beyond `copy_or_docs` or `visual_only`

### TIER_2 + U3 policy

`TIER_2 + U3` is a valid combination when **no sensitive capability** is present. This accommodates narrow runtime-sensitive work (e.g., `browser_runtime`, `responsive_layout`, `accessibility_or_focus`) without requiring the full Tier 3 escalation.

When a sensitive capability (`auth_or_session`, `api_write`, `cache_or_storage_persistence`, `database`, `migration`, `privacy_or_security`, `provider_or_network`, `deployment_or_runtime_infra`, `destructive`) is present with `TIER_2 + U3`, the planner rejects with `UNDERCLASSIFIED_CAPABILITY` and requires `TIER_3`.

### Sensitive capabilities → Tier 3 escalation

Any of the following capabilities force the effective tier to `TIER_3`:

```
auth_or_session
api_write
cache_or_storage_persistence
database
migration
privacy_or_security
provider_or_network
deployment_or_runtime_infra
destructive
```

If the input tier is below `TIER_3` and any of these capabilities is present, the planner **rejects** the input with `UNDERCLASSIFIED_CAPABILITY`.

### Escalation matrix

| Input tier | UI class | Sensitive capability | Effective tier | Action |
|------------|----------|---------------------|----------------|--------|
| TIER_1 | U0 | No | TIER_1 | Pass |
| TIER_1 | U1 | No | TIER_1 | Pass |
| TIER_1 | U1 | Yes | — | Reject (UNDERCLASSIFIED) |
| TIER_2 | U2 | No | TIER_2 | Pass |
| TIER_2 | U2 | Yes | — | Reject (UNDERCLASSIFIED: needs TIER_3) |
| TIER_2 | U3 | No | TIER_2 | Pass |
| TIER_2 | U3 | Yes | — | Reject (UNDERCLASSIFIED: needs TIER_3) |
| TIER_3 | U2 | Any | TIER_3 | Pass |
| TIER_3 | U3 | Any | TIER_3 | Pass |

### Execution-group matrix

| Tier | Required groups | Conditional groups |
|------|----------------|--------------------|
| TIER_1 | SOURCE_STATIC | (none) |
| TIER_2 | SOURCE_STATIC, EXECUTED_FAKE | BROWSER_REAL_LOCAL (if browser_runtime/responsive_layout), PROCESS_REAL_LOCAL (if process_runtime) |
| TIER_3 | FULL_DEFAULT_REGRESSION | DB_ENGINE (if database/migration), BROWSER_REAL_LOCAL (if browser_runtime/responsive_layout), PROCESS_REAL_LOCAL (if auth_or_session/process_runtime) |

### Manual evidence boundary

- `REMOTE_OR_PROVIDER_MANUAL` is never a required or conditional group.
- When `provider_or_network` or `deployment_or_runtime_infra` capability is present, manual evidence is **required** but never executed by the planner.
- Manual evidence groups are recorded as obligations only.

### Local/browser/Production obligations

| Tier | Local Validation | Browser evidence | Production verification |
|------|-----------------|------------------|------------------------|
| TIER_1 | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED |
| TIER_2 | NOT_REQUIRED by default | Required for browser_runtime/responsive_layout/accessibility_or_focus | NOT_REQUIRED |
| TIER_3 | REQUIRED | Required for browser_runtime/responsive_layout/accessibility_or_focus | REQUIRED |

### Merge blockers

Hard blockers that prevent merge regardless of CI status:

- `CI_EXECUTED_FAILURE`
- `CI_PENDING_EXECUTION`
- `UNRESOLVED_DESTRUCTIVE_APPROVAL`

### CI_UNAVAILABLE_INFRA posture

`CI_UNAVAILABLE_INFRA` is a distinct status: infrastructure is unavailable but no test execution failure occurred.

| Property | Value |
|----------|-------|
| Status | `CI_UNAVAILABLE_INFRA` |
| Alternative evidence required | `true` |
| Merge-ready without alternative | `false` |

- `CI_UNAVAILABLE_INFRA != CI_GREEN`
- `CI_UNAVAILABLE_INFRA != CI_EXECUTED_FAILURE`
- Canonical alternative evidence is required
- Until alternative evidence is resolved, merge is not ready
- This is stored separately from `hard_blockers` in the policy JSON

### CLI input/output

```
node scripts/plan-ci-risk-gates.cjs --tier TIER_2 --ui-class U2 --capability structural_dom
node scripts/plan-ci-risk-gates.cjs --tier TIER_2 --ui-class U2 --capability structural_dom --json
```

Human output format:

```
CI RISK-TIER GATE PLAN
======================

CLASSIFICATION
  Tier:         TIER_2
  UI class:     U2
  Capabilities: structural_dom

EFFECTIVE TIER: TIER_2

REQUIRED GROUPS
  - SOURCE_STATIC
  - EXECUTED_FAKE

CONDITIONAL GROUPS
  (none)

MANUAL EVIDENCE: NOT REQUIRED
LOCAL VALIDATION: NOT REQUIRED
BROWSER/RUNTIME EVIDENCE: NOT REQUIRED
PRODUCTION VERIFICATION: NOT REQUIRED

MERGE BLOCKERS
  - CI_EXECUTED_FAILURE
  - CI_PENDING_EXECUTION
  - UNRESOLVED_DESTRUCTIVE_APPROVAL

VALIDATION OUTCOME: PASS
```

JSON output contains the same data structured as a machine-readable object.

### Fail-closed behavior

All unrecognized or contradictory inputs produce a non-zero exit and a sanitized error message containing:

- Error code (stable machine-readable key)
- Human-readable explanation

Errors never contain:

- Absolute host paths
- Stack traces
- Environment variables
- Credentials
- Private URLs
- Raw parser details

### CI failure-class preservation

The planner does not modify, rerun, or suppress any existing CI failure classification. Hard merge blockers (`CI_EXECUTED_FAILURE`, `CI_PENDING_EXECUTION`, `UNRESOLVED_DESTRUCTIVE_APPROVAL`) are preserved as policy documentation. `CI_UNAVAILABLE_INFRA` is tracked separately as an infrastructure availability posture.

### Security/privacy output boundary

Planner output contains only:

- Tier/UI class/capability classification
- Execution group names and descriptions
- Validation outcome
- Notes about evidence requirements

Planner output never contains:

- Credentials, tokens, or secrets
- Private URLs or hostnames
- Provider payloads
- Raw file contents
- Database connection strings
- Environment variables

### Rollback

Repository-only rollback: revert the PR.

No runtime state, workflow configuration, branch protection, database state, provider state, or Production state is created by this child.

### Later workflow child boundary

The following remain **not authorized** by this child:

- Workflow wiring (`.github/workflows/**`)
- Branch protection changes
- Required check changes
- Nightly or scheduled CI
- Full-regression movement between groups
- Failure artifact upload
- Test isolation hardening
- Quarantine
- Flaky-test classification
- Reliability metrics
- Production action

Refs #3710  
Refs #3670 — Keep OPEN  
Refs #1882 — Keep OPEN
