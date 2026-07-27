# LoveBud CI Test-Group Registry Contract

## Parent and authority

- Parent reliability program: #3670 — Keep OPEN
- Completed audit child: #3671
- Merged audit PR: #3676
- This Issue: #3685
- Exact implementation baseline: `0fc27a02e1f9aa510c9fa25cd7e4f375e055a7e1`

## Baseline count transition

### Before this child (baseline)

```
default-CI total: 766
SOURCE_STATIC: 565
EXECUTED_FAKE: 187
EXECUTED_REAL_LOCAL: 14
supplemental total: 19
SUPPLEMENTAL_PYTHON: 10
DB_ENGINE_EXECUTION: 7
invalid default/supplemental duplicates: 2
```

### After this child

```
default-CI total: 767  (+1 new SOURCE_STATIC contract)
SOURCE_STATIC: 566
EXECUTED_FAKE: 187
EXECUTED_REAL_LOCAL: 14
supplemental total: 17  (-2 invalid duplicates)
SUPPLEMENTAL_PYTHON: 10
DB_ENGINE_EXECUTION: 7
invalid default/supplemental duplicates: 0
```

## Cumulative file boundary

This child's cumulative PR diff may contain exactly these five paths:

- `tests/ci-test-group-registry.json`
- `scripts/report-ci-test-groups.cjs`
- `tests/contracts/ci-test-group-registry-contract.test.cjs`
- `docs/architecture/CI_TEST_GROUP_REGISTRY_CONTRACT.md`
- `tests/test-layer-classification.json`

No other path is authorized in this child.

## Authority separation

- `tests/test-layer-classification.json` is the evidence-layer authority. It assigns each default-CI file to an evidence layer (SOURCE_STATIC, EXECUTED_FAKE, EXECUTED_REAL_LOCAL, etc.) based on content evidence.
- `tests/ci-test-group-registry.json` is the execution-group authority. It groups tests by execution characteristics (runtime, platform, capabilities) without duplicating evidence-layer rationale.
- The two authorities are complementary. An execution group maps to one or more evidence layers. A single evidence layer (e.g., EXECUTED_REAL_LOCAL) may span multiple execution groups (BROWSER_REAL_LOCAL, PROCESS_REAL_LOCAL).

## Registry schema

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | yes | Semantic version of the registry schema |
| `title` | string | yes | Human-readable title |
| `description` | string | yes | Purpose and scope |
| `baseline_sha` | string | yes | Exact implementation baseline SHA |
| `baseline_sha_note` | string | no | Note about SHA usage |
| `group_enum` | string[] | yes | Canonical ordered group ID vocabulary |
| `group_enum_note` | string | no | Note about group enum rules |
| `membership_source_enum` | string[] | yes | Allowed membership source values |
| `execution_state_enum` | string[] | yes | Allowed execution state values |
| `runtime_enum` | string[] | yes | Allowed runtime values |
| `platform_enum` | string[] | yes | Allowed platform values |
| `capability_enum` | string[] | yes | Allowed capability values |
| `artifact_expectation_enum` | string[] | yes | Allowed artifact expectation values |
| `risk_gate_eligibility_enum` | string[] | yes | Allowed risk-gate eligibility values |
| `source_status_enum` | string[] | yes | Allowed source status values |
| `required_group_fields` | string[] | yes | List of required fields every group must have |
| `field_definitions` | object | yes | Description of each group field |
| `groups` | object[] | yes | Ordered array of group definitions |

### Group fields

| Field | Type | Required | Enum |
|-------|------|----------|------|
| `group` | string | yes | Must match group_enum |
| `purpose` | string | yes | Free text |
| `membership_source` | string | yes | Must match membership_source_enum |
| `explicit_paths` | string[] | null | Non-null only when membership_source is `explicit_list`. Each entry is a normalized repository-relative path with no arguments, absolute paths, or traversal. |
| `command_reference` | string | yes | Shell command, npm script, or `NOT_EXECUTED` |
| `default_pr_execution_state` | string | yes | Must match execution_state_enum |
| `runtime` | string | yes | Must match runtime_enum |
| `platform` | string | yes | Must match platform_enum |
| `capabilities` | string[] | yes | Subset of capability_enum |
| `comparability` | string | yes | Branch/main comparability prerequisite |
| `artifact_expectation` | string | yes | Must match artifact_expectation_enum |
| `risk_gate_eligibility` | string | yes | Must match risk_gate_eligibility_enum |
| `source_status` | string | yes | Must match source_status_enum |

### Group vocabulary (canonical order)

1. **SOURCE_STATIC** — Source-only static contract tests
2. **EXECUTED_FAKE** — Fake/stub runtime contract tests
3. **BROWSER_REAL_LOCAL** — Tests executed in Playwright Chromium with real browser rendering
4. **PROCESS_REAL_LOCAL** — Tests executed in a real local process without browser rendering
5. **DB_ENGINE** — Disposable PostgreSQL engine tests
6. **PYTHON_SUPPLEMENTAL** — Python tests outside default Node CI
7. **REMOTE_OR_PROVIDER_MANUAL** — Manual or remote/provider-gated scripts
8. **FULL_DEFAULT_REGRESSION** — Aggregate of all default-CI groups

### Membership semantics

- **classification_layer**: Membership is determined by the evidence layer in `tests/test-layer-classification.json`. All files with the matching layer are members.
- **package_glob**: Membership is determined by the `node --test` command globs in `package.json`. Only `FULL_DEFAULT_REGRESSION` uses this.
- **path_pattern**: Membership is determined by a file path pattern (e.g., `tests/db-engine/*.test.cjs` for DB_ENGINE, `*.py` for PYTHON_SUPPLEMENTAL).
- **explicit_list**: Membership is an explicit array of repository-relative paths.

### Aggregate semantics

`FULL_DEFAULT_REGRESSION` is an aggregate group. It derives its membership from the package `node --test` command globs. It does not duplicate paths as a second path authority. Its count equals the total default-CI enumerated file count.

## Reporter contract

### Fixed inputs

The reporter reads exactly four fixed repository-relative paths:

1. `package.json` — for the test command and DB-engine script references
2. `.github/workflows/ci.yml` — for the verify-static workflow command references
3. `tests/test-layer-classification.json` — for evidence-layer classification
4. `tests/ci-test-group-registry.json` — for execution-group definitions

Repository root is derived from `__dirname`, not from `process.cwd()`. No alternate path, URL, credential, environment-selected file, or caller-supplied command definition is accepted.

### Supported modes

1. Default mode (no arguments): human-readable summary
2. `--json` mode: machine-readable JSON summary

Unknown arguments fail closed with `UNSUPPORTED_ARGUMENT` and non-zero exit.

### Output contract

Both modes report at minimum:

- schema/version
- source baseline SHA
- default-CI total and per-layer counts
- supplemental totals by supported supplemental layer
- execution groups in canonical order with per-group path count or aggregate membership rule
- command reference
- runtime/platform/capability metadata
- default-PR execution state
- artifact expectation
- branch/main comparability prerequisites
- validation outcome (PASS/FAIL)

### Deterministic ordering

- Group order follows `group_enum` exactly
- Path order is lexicographic within each group
- All output is deterministic: identical repository content produces byte-identical output

### Byte stability

No timestamps, random IDs, absolute host paths, temp paths, process IDs, locale-sensitive output, or environment-dependent fields are embedded.

## Error vocabulary

| Code | Meaning |
|------|---------|
| `REGISTRY_PARSE_ERROR` | Registry or source file cannot be read or parsed |
| `REGISTRY_SCHEMA_ERROR` | Registry schema validation fails |
| `UNKNOWN_ENUM` | Unknown enum value in registry or classification |
| `DUPLICATE_GROUP` | Duplicate group ID in registry |
| `DUPLICATE_PATH` | Duplicate path in classification or supplemental |
| `OVERLAPPING_MEMBERSHIP` | Path belongs to multiple groups |
| `STALE_PATH` | Path in registry or classification does not exist on disk |
| `UNCLASSIFIED_DEFAULT_PATH` | Default-CI test file is not classified |
| `UNCLASSIFIED_SUPPLEMENTAL_PATH` | Supplemental path is not classified |
| `DEFAULT_SUPPLEMENTAL_CONFLICT` | Path appears in both default and supplemental |
| `PACKAGE_COMMAND_MISMATCH` | Package test command does not match expected shape |
| `WORKFLOW_COMMAND_MISMATCH` | Workflow command set does not match expected shape |
| `LAYER_RECONCILIATION_MISMATCH` | Evidence-layer reconciliation fails |
| `UNSUPPORTED_ARGUMENT` | Unknown CLI argument |

Raw parser errors, absolute paths, environment values, credentials, private URLs, provider payloads, or stack traces must not enter normal reporter output.

## Security and privacy boundary

- The reporter reads only repository-owned JSON and YAML files.
- It never accesses databases, network, providers, browsers, Docker, or external systems.
- It never prints credentials, tokens, cookies, private URLs, DB connection strings, environment values, or row data.
- It never executes child processes, shell commands, npm scripts, or test runners.
- It never writes to source files.

## Non-execution guarantee

This child creates source authority and deterministic reporting only. It does not:

- Execute any registered test, script, or command
- Run `npm test`, `npm run`, or any npm script
- Launch a browser, Playwright, or Chromium
- Connect to a database, network, or provider
- Start Docker or PostgreSQL containers
- Access Preview, staging, or Production environments

## Rollback

Repository-only rollback: revert the implementation PR. No workflow state, branch-protection state, runtime state, database state, provider state, environment state, or Production state is created.

## Work not authorized by this child

The following remain out of scope and are not partially implemented:

- Actual branch/main dual test execution
- Risk-tier gate selection and workflow partitioning
- Workflow wiring or path filtering
- Artifact upload or storage
- Nightly or scheduled CI
- Retry, rerun, timeout change, or sleep
- Flaky-test classification, governance, or metrics
- Branch-protection or required-check changes
- Any later ordered child under #3670

Refs #3685.
Refs #3670 — Keep OPEN.
Refs #3671 — completed.
Refs #3676 — merged.
Refs #3664.
Refs #3662.
Refs #3657 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3425 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #3437 — Keep OPEN.
Refs #1882 — Keep OPEN.
