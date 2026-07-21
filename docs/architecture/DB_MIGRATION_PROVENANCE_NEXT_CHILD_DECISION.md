# LoveBud DB Migration Provenance Next-Child Decision

## Decision Summary

| Field | Value |
| --- | --- |
| Outcome | `NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT` |
| Decision basis | Current-state audit at `de1c4e416e33e2669157b2202a7bbd021779ad59` |
| Prerequisite | Operator input: dedicated read-only credentials and abstract role mapping file |
| Proposed operator-readiness child | Create an adoption collection operator checklist and role mapping template |

The source-contract and disposable-CI predecessors needed to prepare the current Phase-B Production-readonly collection boundary are merged.

This does not mean all #3458 implementation is complete. Migration runner, canonical stream, reconstruction, deployment enforcement, observability, and retirement work remain incomplete.

**Scope note**

## Candidate Children Considered

### 1. Retry Production catalog collection

| Criterion | Assessment |
| --- | --- |
| Operator input needed | Yes - credentials and role mapping must be provided by operator |
| Production access needed | Yes - read-only catalog collection from Production |
| Safe to start now | **NO** |
| Reason | #3569 closed as `COLLECTION_NOT_RUN_CONNECTION_BOUNDARY`. #3572 closed as `COLLECTION_NOT_RUN_CONNECTION_BOUNDARY`; subreason: `DEDICATED_INPUTS_UNAVAILABLE`; retry session not started. The dedicated secret and role mapping do not exist in the repository. |

### 2. Ledger bootstrap design

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Adoption baseline attested, owner approval for first canonical migration |
| Safe to start now | **NO** |
| Reason | Architecture doc: "The first canonical entry may be added only after the adoption baseline and runner design are separately approved." Adoption has not occurred. |

### 3. Migration runner implementation

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Ledger relation must exist, canonical migrations must exist |
| Safe to start now | **NO** |
| Reason | No canonical migrations exist. No ledger relation exists. A runner with no migrations and no ledger has nothing to run. |

### 4. Canonical manifest tooling

| Criterion | Assessment |
| --- | --- |
| Current implementation overlap | ID validation, checksum validation, inventory checks already exist in `scripts/migration-provenance-core.cjs`; fingerprint normalizer in `scripts/migration-catalog-fingerprint-core.cjs`; candidate builder in `scripts/expected-schema-candidate-core.cjs` |
| Safe to start now | **NO** |
| Reason | Core manifest tooling is already implemented. Additional tooling (dependency graph, migration scaffolding) would operate on an empty manifest. Creating tooling for an empty manifest is inventing work. |

### 5. Clean-database reconstruction

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Migration runner, canonical migrations, expected-schema manifest |
| Safe to start now | **NO** |
| Reason | Depends on runner + migrations + expected-schema manifest. All three are not yet active. |

### 6. Deployment gate integration

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Target adapter, Production catalog collection, adoption attestation, ledger bootstrap, runner, reconstruction |
| Safe to start now | **NO** |
| Reason | Depends on most of the provenance pipeline being active. Not a near-term candidate. |

### 7. Sanitized observability

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Gate integration, target adapter |
| Safe to start now | **NO** |
| Reason | Depends on gate integration which depends on most of the provenance chain. |

### 8. Legacy path retirement

| Criterion | Assessment |
| --- | --- |
| Prerequisites | Adoption baseline, canonical migration stream maturity |
| Safe to start now | **NO** |
| Reason | Legacy retirement without an active canonical stream would leave no migration path at all. |

### 9. Documentation reconciliation

| Criterion | Assessment |
| --- | --- |
| Current implementation overlap | This audit (`DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md`) already serves as the definitive current-state reference. |
| Safe to start now | Partial |
| Reason | `DB_MIGRATION_PROVENANCE_GATE.md` Section J is outdated but cannot be modified in this PR scope. A future child can update it when operator input unblocks the next phase. |

## Dependency Analysis

```
Missing Operator Inputs
- dedicated Production-readonly credential
- abstract role mapping              <-- BLOCKED
    |
Separate Phase B execution approval
    |
    v
Phase B: Production catalog collection                    <-- DEPENDS on operator input
    |
    v
Phase C: Owner review of evidence + drift classification  <-- DEPENDS on Phase B
    |
    v
Phase D: Manifest activation (ADOPTION_REQUIRED -> ACTIVE) <-- DEPENDS on Phase C
    |
    v
Phase E: Ledger bootstrap migration                       <-- DEPENDS on Phase D
    |
    v
Migration runner implementation                           <-- DEPENDS on Phase E
    |
    v
Canonical migration stream                                <-- DEPENDS on runner
    |
    v
Clean-database reconstruction                             <-- DEPENDS on stream
    |
    v
Deployment gate integration                               <-- DEPENDS on reconstruction
    |
    v
Sanitized observability + Legacy retirement               <-- DEPENDS on gate integration
```

All paths to implementation lead through the operator-input boundary at the top of the chain.

## Operator-Input Separation

### BLOCKED_OPERATOR_INPUT (repository-external inputs not present)

| # | Input | Owner | Repository Reference |
| --- | --- | --- | --- |
| OI-1 | `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL` under `.secrets/` | Repository owner or operator | `db/migration-provenance/production-readonly-catalog-boundary-contract.json` |
| OI-2 | Abstract role mapping file (PostgreSQL roles -> abstract classes) | Repository owner or operator | `db/migration-provenance/adoption-baseline-collection-plan-contract.json` |

### SEPARATE_APPROVAL_REQUIRED (future owner decisions, not missing inputs)

| Phase | Decision | Depends On |
| --- | --- | --- |
| Phase B | Production read-only catalog collection execution approval | OI-1, OI-2 |
| Phase C | Owner review of collected sanitized evidence and drift classification | Phase B complete |
| Phase D | Manifest activation (ADOPTION_REQUIRED -> ACTIVE) | Phase C approved |
| Phase E | Ledger bootstrap, migration runner, and canonical migration stream approval | Phase D complete |

The reviewed frozen collection plan and allowlist (PR #3556) are in the repository. Input absence and future approval decisions are separate categories. None of these inputs or approvals can be created by an agent.

## Selected Next Child

### Outcome: `NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT`

No migration implementation child can safely proceed. An **operator-readiness child** is proposed to unblock the operator-input boundary.

### Proposed Operator-Readiness Child

**Proposed issue title**: `[Architecture][DB][Adoption] Create adoption collection operator checklist and role mapping template`

**Clarification**: This is an operator-readiness documentation child, NOT a Production collection implementation. It does not contain actual secret values, raw role mappings, or executable collection code. It documents the actions, inputs, and approval boundaries that an operator must follow to unblock Phase B.

**Objective**: Produce a structured operator-facing document that lists exact steps to unblock Phase B Production catalog collection, provides a role mapping template (structure only), documents approval gates and expected outputs at each adoption phase, and references repository contracts.

**Exact files**: `docs/architecture/DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md` (new file only)

**Prohibited areas**: No database connection, no SQL execution, no secret creation, no Production/staging/provider access, no manifest activation, no migration/ledger/runner implementation. No existing file modification (checklist is a new file).

**Dependencies complete**: Current-state audit (#3620), all source-contract and disposable-CI work is merged.

**Test layers**: SOURCE_STATIC (validate checklist references correct contract paths, covers operator inputs, no secret patterns)

**Production access**: NONE

**Approval needed**: Owner review of the checklist

**Rollback posture**: Code rollback only (delete file). No database state affected.

**Completion boundary**: Checklist accurately documents all operator inputs identified in the current-state audit and references correct repository contracts.

## Exact Scope (This PR #3620)

1. `docs/architecture/DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md` - current-state audit
2. `docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md` - next-child decision
3. `tests/contracts/db-migration-provenance-current-state-audit-contract.test.cjs` - document contract test
4. `tests/test-layer-classification.json` - minimal SOURCE_STATIC entry for new contract test

## Exact Non-Goals

- No operator checklist is created in this PR (deferred)
- No database connection, SQL execution, or migration application
- No manifest activation or population
- No ledger relation creation or runner implementation
- No Production, staging, or provider access
- No credential creation, rotation, or handling
- No existing file modification (except `tests/test-layer-classification.json` minimal SOURCE_STATIC entry)
- No deployment or CI workflow changes

## Allowed Files

1. `docs/architecture/DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md`
2. `docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md`
3. `tests/contracts/db-migration-provenance-current-state-audit-contract.test.cjs`
4. `tests/test-layer-classification.json` (minimal SOURCE_STATIC entry only)

## Prohibited Files

All existing files, particularly: `docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md`, `docs/architecture/migration-path-inventory.json`, `db/migration-provenance/**`, `db/migrations/**`, `scripts/**`, `tests/contracts/**` (except new contract test), `tests/test-layer-classification.json` (except minimal entry), `tests/db-engine/**`, `package.json`, `package-lock.json`, `.github/**`, `functions/**`, `pages/**`, `js/**`, `css/**`, `migrations/**`, `_headers`

## Required Test Layers

- SOURCE_STATIC (contract test validates document structure, vocabulary, references, and prohibitions)

## Failure Categories

| Category | Meaning |
| --- | --- |
| CONTRACT_TEST_FAILURE | Document structure, vocabulary, or reference validation fails |
| COMMIT_SCOPE_VIOLATION | A file outside the 4 authorized files is changed |
| PUSH_REJECTED | Remote push is rejected |
| CI_FAILURE | CI pipeline fails |

## Rollback and Forward-Fix Posture

Documentation and contract-only PR. Rollback: close PR without merge. Forward-fix: subsequent correction PR. No database or Production state affected.

## Model Assignment

### DESIGN_REVIEW_MODEL: DeepSeek V4 Pro
- **Reason**: Cross-layer reasoning across historical migrations, source contracts, disposable CI tests, Production-readonly boundaries, and GitHub issue/PR history. Required for accurate classification of 12 acceptance criteria, 30 artifacts, and 6 test layers.
- **Decision authority**: Reviews audit classification, dependency map, and next-child decision. Can request re-classification if evidence is misinterpreted.

### INDEPENDENT_ARCHITECTURE_VERIFIER: Nemotron 3 Ultra
- **Reason**: Independent verification of the audit's conclusions requires a model with strong systems-thinking capability that is not the same as the auditor. Nemotron 3 Ultra provides a different reasoning architecture to catch classification errors, missed dependencies, or unsupported claims.
- **Decision authority**: Validates that each COMPLETE/PARTIAL/BLOCKED classification is supported by evidence. Flags unsupported claims. Can override classifications if evidence is insufficient.

### IMPLEMENTATION_MODEL: DeepSeek V4 Pro
- **Reason**: The operator-readiness child is a high-precision documentation task that must accurately cross-reference contracts, audit findings, and operator procedures. DeepSeek V4 Pro's precision with complex cross-referencing is required. The child does not involve large code generation.
- **Decision authority**: Implements the operator checklist document according to the scope defined above. No authority to modify contracts, manifests, or existing files.

### LOW_RISK_SUPPORT_MODEL: Laguna XS 2.1
- **Reason**: The contract test is a structural validation with fixed assertions against known file paths and vocabulary. Laguna XS 2.1 is sufficient for this low-risk, bounded task.
- **Decision authority**: Implements the contract test file only. No authority to modify any other file.

## Production Mutation Authority

Production mutation (applying migrations, activating manifests, creating ledger relation) requires repository owner explicit approval and CTO review. Models assigned in this decision do not have Production mutation authority. This authority is not delegated to any model in this document.

## Completion Boundary

This child (#3620) is complete when:
1. The current-state audit accurately classifies all #3458 acceptance criteria against `main` evidence
2. The next-child decision selects exactly one outcome (`NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT`)
3. The contract test validates document structure, vocabulary, references, and prohibitions
4. All three files pass syntax check, contract test, and CI
5. Draft PR is created with verification results

## Deferred Work

| Work Item | When | Depends On |
| --- | --- | --- |
| Operator checklist creation | Future child after #3620 merges | #3620 audit acceptance |
| Production catalog collection retry | After operator provides OI-1, OI-2 | Operator input |
| Adoption attestation | After Phase B catalog collection + owner review | Phase B + Phase C |
| Manifest activation | After adoption attestation | Phase D |
| Ledger bootstrap + migration runner + canonical stream | After manifest activation | Phase E |
| Clean-database reconstruction + deployment gate + observability + legacy retirement | After canonical stream is established | Canonical stream maturity |

Refs #3620.
Refs #3458 — Keep #3458 OPEN.
Refs #3425 — Keep #3425 OPEN.
Refs #3435 — Keep #3435 OPEN.
Refs #3437 — Keep #3437 OPEN.
Refs #1882 — Keep #1882 OPEN.
