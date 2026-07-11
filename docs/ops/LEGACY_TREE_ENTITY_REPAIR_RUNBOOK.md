# Legacy Orphan Tree Entity Repair Runbook

**Issue:** #3455 (corrected)
**Refs:** #3437, #3435, #3441, #1882
**Status:** Package prepared (validate + dry-run + prepare-plan only)

## Overview

This runbook describes the procedure for repairing orphan tree entities identified
by the #3441 browser recovery audit. The repair uses two repository-external input
files:

1. **Mapping file** — produced by the browser recovery process (#3441), containing
   authoritative owner/title/visibility for each orphan tree entity.
2. **Preflight file** — produced by a read-only production database query, containing
   existence status and publicMomentCount for each mapped tree ID.

## Principles

- **No raw recovery data enters the repository.** All mapping, preflight, and plan
  files remain repository-external. The repository contains only the validation
  script, runbook, and contract tests with synthetic values.
- **No ownership inference.** Owner ID and title must come from authoritative
  browser recovery evidence with provenance `AUTHORITATIVE_SERVER_RETURNED_FIELD`.
  No inference from memory, comment, like, reaction, or user membership data.
- **Public-first default.** Ordinary recovered trees use `visibility = 'public'`.
  Private visibility requires explicit evidence classification
  (`PLUS_ENTITLEMENT_CONFIRMED` or `GRANDFATHERED_PRIVATE_CONFIRMED`).
- **Browse eligibility is separate from tree entity identity.** `publicMomentCount >= 3`
  determines Browse listing eligibility. Growing trees have `publicMomentCount 0–2`.
  Private records are excluded from both Browse-eligible and growing counts.
- **TEXT ID preservation.** Original TEXT tree IDs are preserved exactly as-is.
  UUID-shaped strings are valid TEXT values and are accepted.
- **No dependent data mutation.** The repair inserts only the tree entity row.
  No memories, comments, likes, reactions, or views are created, moved, or
  reassigned. Dependent data already exists for these IDs.
- **Existing entities fail-closed.** If `entityExists: true` is detected for any
  record, the pipeline stops. The private mapping or preflight must be reviewed
  and a new artifact created.

## Prerequisites

1. Completed #3441 browser recovery audit with private mapping evidence
2. Repository-external mapping JSON file with authoritative records
3. Repository-external preflight JSON file from read-only production query
4. CTO approval for production execution

## Step-by-step Procedure

### Step 1: Verify #3441 Private Mapping Provenance

Before using any mapping data, verify:

- [ ] The mapping file was produced by the #3441 browser recovery process
- [ ] Source classification is `AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND` or
      `PARTIAL_BROWSER_RECOVERY_SOURCE_FOUND`
- [ ] Each included record has owner/title provenance = `AUTHORITATIVE_SERVER_RETURNED_FIELD`
- [ ] No fabricated, fallback, stale, blocked, or unknown source markers
- [ ] Private records have `privateEvidenceClassification` set to
      `PLUS_ENTITLEMENT_CONFIRMED` or `GRANDFATHERED_PRIVATE_CONFIRMED`

### Step 2: Create Repository-External Input Files

Both files must be placed **outside** the repository directory and must not be
symlinks pointing into the repository.

#### Mapping file

```json
{
  "schemaVersion": 1,
  "sourceClassification": "AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND",
  "mappingArtifactSha256": "<64-hex-sha256>",
  "records": [
    {
      "treeId": "original-text-id",
      "ownerId": "firebase-uid",
      "title": "Authoritatively Recovered Tree Title",
      "ownerProvenance": "AUTHORITATIVE_SERVER_RETURNED_FIELD",
      "titleProvenance": "AUTHORITATIVE_SERVER_RETURNED_FIELD",
      "visibility": "public",
      "groupName": null,
      "keywords": [],
      "createdAt": null,
      "updatedAt": null
    }
  ]
}
```

#### Preflight file

```json
{
  "schemaVersion": 1,
  "sourceClassification": "PRODUCTION_READ_ONLY_PREFLIGHT",
  "records": [
    {
      "treeId": "original-text-id",
      "entityExists": false,
      "publicMomentCount": 4
    }
  ]
}
```

**Constraints:**
- Mapping and preflight tree identity sets must match exactly
- `entityExists` must be boolean
- `publicMomentCount` must be integer >= 0

### Step 3: Compute Artifact Hashes

```bash
sha256sum /path/to/mapping.json > /path/to/mapping.json.sha256
sha256sum /path/to/preflight.json > /path/to/preflight.json.sha256
```

Record both hashes for audit trail.

### Step 4: Run `--validate`

```bash
node scripts/prepare-legacy-tree-entity-repair.cjs \
  --validate /absolute/path/to/mapping.json
```

Expected result: `✅ Mapping validation PASSED`

If validation fails, review the error codes and correct the mapping file.
Error output uses index+code only — no raw treeId/ownerId/title values.

Common failures:
- Unsupported schema version
- Unknown or rejected source classification
- Missing or blank treeId/ownerId/title
- Invalid provenance value
- Private visibility without valid evidence classification
- Duplicate or conflicting tree ID mappings
- Invalid keyword or date format

### Step 5: Run `--dry-run` (with preflight)

```bash
node scripts/prepare-legacy-tree-entity-repair.cjs \
  --dry-run /absolute/path/to/mapping.json \
  --preflight /absolute/path/to/preflight.json
```

Expected result: Aggregate summary with counts only.
No raw tree ID, owner ID, or title values are displayed.

Review the aggregate:
- Mapping records vs preflight records (should match)
- Valid joined records
- Public vs explicit-private count
- Browse-eligible records (public AND publicMomentCount >= 3)
- Growing records (public AND publicMomentCount 0–2)
- Existing-row conflicts (should be 0; if >0, pipeline stops)
- Planned inserts

**Important:** If any `entityExists: true` exists in the preflight, the script
will exit with non-zero. The private mapping or preflight must be reviewed and
a new artifact created. Existing entities are never auto-skipped.

### Step 6: Production Read-Only Preflight

This step is performed independently to produce the preflight input file used
in Step 5. Verify:

- [ ] Mapping tree ID set matches preflight tree ID set exactly
- [ ] `entityExists` flags correctly reflect `public.trees` state
- [ ] `publicMomentCount` values are accurate

### Step 7: Review Exact Aggregate and Obtain Approval

Compare the dry-run aggregate with the production preflight results.
Document any discrepancies.

Required approvals before proceeding to plan generation:

- [ ] Mapping provenance verified
- [ ] Preflight results verified
- [ ] Dry-run aggregate reviewed and matches expectations
- [ ] No existing-row conflicts
- [ ] Rollback plan confirmed (pre-commit)
- [ ] CTO sign-off

### Step 8: Generate Repair Plan

```bash
node scripts/prepare-legacy-tree-entity-repair.cjs \
  --prepare-plan /absolute/path/to/mapping.json \
  --preflight /absolute/path/to/preflight.json \
  --out /absolute/path/output/plan.json
```

Expected output:
```
📋 Plan created: YES
   Record count: N
   Plan SHA-256: <hash>
```

The plan:
- Contains only records where `entityExists = false`
- Includes treeId, ownerId, title, and visibility
- Is created as a repository-external JSON file
- Has no DB connection, SQL, or apply capability

### Step 9: Execute Transaction Repair (Conceptual)

The plan JSON from Step 8 is the source of truth for production execution.
The following is a **parameterized conceptual transaction** — not a command
that can be copied and pasted with raw values.

```sql
BEGIN;

-- Verify plan hash matches recorded value
-- Verify no unexpected existing entities
-- Verify mapping/preflight provenance

INSERT INTO public.trees (id, owner_id, title, visibility)
VALUES
  ($1, $2, $3, $4),
  ... ;

-- Verify inserted count matches planned count
-- Verify owner_id, title, visibility for each inserted row
-- If any check fails: ROLLBACK

COMMIT;
```

**Transaction constraints:**
- INSERT only (no UPDATE, no UPSERT, no ON CONFLICT)
- No dependent data mutation (memories, comments, likes, reactions, views)
- Use exact TEXT ID from mapping (no UUID coercion)
- Verify aggregate BEFORE COMMIT
- ROLLBACK if any verification step fails

**This package does not include or execute a production apply command.**
The `--apply` flag is unconditionally rejected before any input is read.

### Step 10: Post-Verify

After successful COMMIT:

- [ ] Confirm inserted row count matches planned inserts
- [ ] Verify each inserted tree is queryable
- [ ] Verify owner_id, title, visibility are correctly set
- [ ] Run `SELECT COUNT(*) FROM public.trees` for baseline
- [ ] Confirm no unintended side effects on dependent tables

### Step 11: Browse Production Verification

Verify the repaired trees appear correctly in Browse:

- [ ] Public trees with publicMomentCount >= 3 appear in Browse listing
- [ ] Public trees with publicMomentCount 0–2 appear in Growing section
- [ ] Title and metadata render correctly
- [ ] Tree detail page loads without errors

### Step 12: Rollback Conditions

#### Pre-commit rollback (within transaction)

ROLLBACK immediately if any of the following occurs during Step 9:

1. **Wrong count:** Number of rows to insert != planned insert count
2. **Wrong owner:** Post-verify reveals incorrect owner assignment
3. **Wrong visibility:** Public/private mismatch with authoritative evidence
4. **Duplicate:** UNIQUE constraint violation despite preflight
5. **Unexpected existing entity:** entityExists was false but INSERT fails

Simply issue `ROLLBACK;` — no DELETE needed because no rows were committed.

#### Post-commit

**No automatic `DELETE FROM public.trees` rollback is provided.**

Reasoning:
- Deleting the repaired entity returns it to orphan state
- Dependent memories/social rows already exist for these IDs
- FK constraints may prevent deletion or cause cascading failures
- Deleting makes the tree invisible again in Browse (contradicts repair goal)

Post-commit anomalies require:
```
SEPARATE_COMPENSATING_ACTION_APPROVAL_REQUIRED
```

Metadata correction or entity reversal requires:
1. New private mapping with corrected values
2. Read-only production preflight
3. CTO approval
4. Separate compensating action artifact

**Dependent data DELETE or reassignment is always prohibited.**

## Artifact Hash Record

After each repair execution, record:

```
date:             YYYY-MM-DD
repair_id:        REPAIR-YYYY-MMDD-N
mapping_hash:     <sha256 of mapping file>
preflight_hash:   <sha256 of preflight file>
plan_hash:        <sha256 of generated plan>
inserted:         N
existing_skipped: N (preflight conflicts)
rollback:         YES/NO (pre-commit only)
approver:         <CTO name>
```

## Production Approval Gate

The `--apply` flag is **unconditionally rejected** in the
`prepare-legacy-tree-entity-repair` script. Production execution requires:

1. This runbook followed through Step 8
2. Generated plan hash verified against recorded hash
3. CTO explicit sign-off
4. Separate execution command (not provided in this package)
5. Transaction with pre-commit verifiable rollback prepared
6. Post-verify script ready

**No production mutation is performed by this package.**

## References

- #3435 — Orphan tree identification
- #3437 — Browse recovery scope
- #3441 — Browser recovery audit (private mapping source)
- #3455 — This issue (repair package preparation)
