# Legacy Orphan Tree Entity Repair Runbook

**Issue:** #3455
**Refs:** #3437, #3435, #3441, #1882
**Status:** Package prepared (validate + dry-run only)

## Overview

This runbook describes the procedure for repairing orphan tree entities identified
by the #3441 browser recovery audit. The repair uses a private-input mapping file
produced by the browser recovery process to insert missing tree rows into the
`public.trees` table.

## Principles

- **No raw recovery data enters the repository.** All mapping files remain
  repository-external and are referenced by absolute path only.
- **No ownership inference.** Owner ID must come from authoritative browser
  recovery evidence, not from memory/social data analysis.
- **Public-first default.** Ordinary recovered trees use `visibility = 'public'`.
  Private visibility requires explicit authoritative private evidence from the
  browser recovery audit.
- **Browse eligibility is separate.** `publicMomentCount >= 3` is checked at
  Browse listing time, not during tree entity repair.
- **TEXT ID preservation.** Original tree IDs are preserved as-is. No UUID
  coercion.
- **No dependent data mutation.** The repair inserts only the tree entity row.
  No memories, comments, likes, or other social data are created, moved, or
  reassigned.

## Prerequisites

1. Completed #3441 browser recovery audit with private mapping evidence
2. Access to the repository-external mapping JSON file
3. Production database read-only access (for preflight)
4. CTO approval for Production apply step

## Step-by-step Procedure

### Step 1: Verify #3441 Private Mapping Provenance

Before using any mapping data, verify:

- [ ] The mapping file was produced by the #3441 browser recovery process
- [ ] The source classification matches the evidence collected
- [ ] Each record has a traceable source reference
- [ ] No fabricated or fallback markers are present

### Step 2: Create Repository-External Mapping File

The mapping file must be placed **outside** the repository directory.

```json
{
  "schemaVersion": 1,
  "sourceClassification": "AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND",
  "records": [
    {
      "treeId": "original-text-id",
      "ownerId": "firebase-uid",
      "title": "Recovered Tree Title",
      "visibility": "public",
      "groupName": null,
      "keywords": [],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-02T00:00:00.000Z"
    }
  ]
}
```

### Step 3: Compute Artifact Hash

```bash
sha256sum /path/to/mapping.json > /path/to/mapping.json.sha256
```

Record the hash for audit trail.

### Step 4: Run `--validate`

```bash
node scripts/prepare-legacy-tree-entity-repair.cjs \
  --validate /absolute/path/to/mapping.json
```

Expected result: `✅ Validation PASSED`

If validation fails, review the error messages and correct the mapping file.
Common failures:
- Malformed JSON
- Missing required fields
- Unsupported schema version
- Duplicate or conflicting tree IDs
- Private visibility without explicit evidence
- UUID-formatted treeId (TEXT ID expected)

### Step 5: Run `--dry-run`

```bash
node scripts/prepare-legacy-tree-entity-repair.cjs \
  --dry-run /absolute/path/to/mapping.json
```

Expected output: Aggregate summary with record counts only.
No raw tree ID, owner ID, or title values are displayed.

Review the aggregate:
- Total records vs valid records (should be equal)
- Public vs private record count
- Browse-eligible record estimate

### Step 6: Production Read-Only Preflight

With read-only database access, verify:

- [ ] Which tree IDs from the mapping already exist in `public.trees`?
  ```sql
  SELECT id FROM public.trees WHERE id = ANY($1::text[]);
  ```
- [ ] Are any existing IDs associated with different owners?
- [ ] What is the current total tree count?

Existing IDs must be removed from the repair set before proceed.

### Step 7: Review Exact Aggregate

Compare the dry-run aggregate with the production preflight results.
Document any discrepancies.

Required approvals at this point:
- [ ] CTO confirms aggregate matches expectations
- [ ] No unexpected existing-row conflicts
- [ ] No ownership discrepancies

### Step 8: Obtain Separate User Approval

Production apply requires explicit approval from:

- [ ] CTO sign-off
- [ ] Mapping file provenance verified
- [ ] Dry-run aggregate reviewed
- [ ] Preflight results reviewed
- [ ] Rollback plan confirmed

**Do not proceed without all approvals.**

### Step 9: Execute Transaction Repair

```sql
BEGIN;

INSERT INTO public.trees (id, owner_id, title, visibility, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, $6),
  ...;

COMMIT;
```

Replace placeholders with values from the mapping file.
Use original TEXT IDs. Do not insert dependent data.

**Transaction constraints:**
- INSERT only (no UPDATE for existing rows)
- Skip any IDs that appeared in preflight as existing
- Use original TEXT ID (not UUID)
- No ON CONFLICT clause — fail on duplicate

### Step 10: Post-Verify

After successful transaction:

- [ ] Confirm inserted row count matches planned inserts
- [ ] Verify each inserted tree is queryable
- [ ] Verify visibility is correctly set
- [ ] Run `public.trees` count check

### Step 11: Browse Production Verification

Verify the repaired trees appear correctly in Browse:

- [ ] Public trees are visible in browse listing
- [ ] Title and metadata render correctly
- [ ] Tree detail page loads
- [ ] Browse eligibility (publicMomentCount >= 3) works correctly

### Step 12: Rollback Conditions

Execute rollback if any of the following occurs:

1. **Transaction failure:** Any INSERT throws an error → ROLLBACK immediately
2. **Wrong owner:** Post-verify reveals incorrect owner assignment
3. **Wrong visibility:** Public/private mismatch with authoritative evidence
4. **Duplicate created:** An existing entity was inadvertently duplicated
5. **Browse breakage:** Repair causes Browse listing errors or incorrect display

Rollback SQL:

```sql
BEGIN;

DELETE FROM public.trees
WHERE id = ANY($1::text[]);

COMMIT;
```

Rollback preconditions:
- Confirm the DELETE targets only the inserted rows
- No dependent data (memories, comments) exists for these IDs
- Post-rollback count matches pre-repair count

## Artifact Hash Record

After each repair execution, record:

```
date:       YYYY-MM-DD
repair_id:  REPAIR-YYYY-MMDD-N
input_hash: <sha256 of mapping file>
inserted:   N
skipped:    N (existing)
rollback:   YES/NO
approver:   <CTO name>
```

## Production Approval Gate

The `--apply` flag is **intentionally blocked** in the prepare-legacy-tree-entity-repair
script. Production execution requires:

1. This runbook followed through Step 7
2. CTO explicit sign-off
3. A separate execution command (not provided in this package)
4. Transaction with rollback prepared
5. Post-verify script ready

**No production mutation is performed by this package.**

## References

- #3435 — Orphan tree identification
- #3437 — Browse recovery scope
- #3441 — Browser recovery audit (private mapping source)
- #3455 — This issue (repair package preparation)
