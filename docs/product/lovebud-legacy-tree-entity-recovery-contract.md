# Legacy Tree Entity Recovery Design Contract

**Issue:** #3516
**Refs:** #3437, #3435, #3455, #3441, #1882
**Status:** Design contract only. No production SQL included.

## A. Incident facts

Only GitHub-recordable aggregate facts are stored in this document.

- Legacy dependent tree identities requiring entity recovery: **45**
- Raw tree IDs: **NOT RECORDED** (see Section K)
- Raw owner identifiers: **NOT RECORDED**
- Raw titles/private values: **NOT RECORDED**

The number `45` is an aggregate evidence count. Individual tree identities must not
be listed, committed, or referenced in any GitHub issue, PR, test fixture, or log.

## B. Identity preservation

1. **Original `trees.id` is TEXT.** The `trees` schema defines `id TEXT PRIMARY KEY`,
   not UUID. Recovery preserves the original TEXT ID exactly as-is.

2. **TEXT → UUID conversion is prohibited.** Recovery must not cast, normalize, or
   regenerate tree IDs to UUID format. UUID-shaped strings are valid TEXT values
   and are accepted without transformation.

3. **New ID issuance is prohibited.** Recovery must not issue new IDs and then
   reconnect memories/social records to the new ID.

4. **Identity merging or splitting is prohibited** unless separately proven and
   explicitly approved by CTO.

## C. Evidence hierarchy

Only the following evidence sources are authoritative for tree entity recovery.
They are ordered by authority.

1. **Verified browser cache/export with user consent**
2. **Authenticated owner backup/export**
3. **Historical application artifact with confirmed provenance**
4. **Existing authoritative tree entity snapshot**

### Prohibited ownership inference

The following relationships **must not** be used as ownership evidence:

- Memory (moment) author
- Commenter
- Liker
- Reaction actor
- Follower
- Viewer
- Users-table membership
- Most active user by engagement count
- Same email/display name heuristic

These relationships are not ownership evidence.

## D. Visibility reconstruction

1. **Ordinary recovered legacy tree visibility defaults to public.**
2. **Private requires explicit authoritative evidence.**

   The only accepted private-evidence classifications are:

   - PLUS_ENTITLEMENT_CONFIRMED
   - GRANDFATHERED_PRIVATE_CONFIRMED

   Any missing, inferred, ambiguous, or unsupported private evidence defaults to
   the ordinary recovered visibility rule: public.
3. **`publicMomentCount >= 3` is Browse/Search eligibility only.**
4. **`publicMomentCount 0-2` does not make a tree private.**
5. **Missing visibility metadata does not imply private.**

## E. Browse eligibility

Browse/Search eligibility is separate from visibility.

```
visibility = public
AND publicMomentCount >= 3
```

Classification for recovered trees:

| Classification | Conditions |
|---|---|
| `RECOVERED_PUBLIC_BROWSE_ELIGIBLE` | visibility = public AND publicMomentCount >= 3 |
| `RECOVERED_PUBLIC_GROWING` | visibility = public AND publicMomentCount < 3 |
| `RECOVERED_PRIVATE_EXPLICIT` | visibility = private with valid evidence |

## F. Missing owner/title states

| Status | Meaning |
|---|---|
| `RECOVERY_METADATA_COMPLETE` | Owner and title both recovered authoritatively |
| `RECOVERY_OWNER_UNRESOLVED` | Owner identity not recoverable from evidence |
| `RECOVERY_TITLE_UNRESOLVED` | Title not recoverable from evidence |
| `RECOVERY_OWNER_AND_TITLE_UNRESOLVED` | Neither owner nor title recoverable |
| `RECOVERY_QUARANTINED` | Entity has conflicting or unreliable evidence |
| `RECOVERY_RECLAIMABLE` | Entity exists but owner can claim through separate auth process |

### Rules

1. Ownership fabrication is prohibited.
2. Synthetic title must not be presented as historical fact.
3. Reclamation requires a separate authentication and evidence process.
4. Unresolved-owner trees must not be assigned to arbitrary accounts.

## G. New-vs-legacy isolation

1. Legacy recovery cohort marker required.
2. Post-foothold creation excluded (after #3435).
3. Explicit recovery provenance per record.
4. Idempotent targeting across multiple dry-runs.
5. Ordinary new-tree rows unaffected.

### Prohibited targeting

```sql
-- PROHIBITED: too broad, catches unrelated rows
WHERE owner_id IS NULL
   OR title IS NULL
   OR visibility IS NULL
```

Recovery must use an explicit allowlist from the authorized recovery artifact.

## H. Dependent data preservation

1. Memories must not be deleted.
2. Comments, reactions, likes, social records must not be deleted.
3. `tree_id` must not be rewritten.
4. Orphan records must not be reassigned to a different tree.
5. Public moment count computation must not mutate original source rows.

## I. Future execution gates

1. Reviewed recovery artifact
2. Aggregate-safe preflight
3. Exact target cohort
4. Transaction boundary
5. Dry-run or no-write validation
6. Row-count expectations
7. Post-verify
8. Rollback artifact
9. Explicit Production approval
10. Production visual verification

## J. Rollback posture

1. Simple DELETE rollback is prohibited.
2. Rollback must use a dedicated compensating SQL script.
3. Rollback script must pass its own contract test.

## K. Privacy and GitHub hygiene

The following must never appear in GitHub artifacts:

- Raw legacy tree IDs (use synthetic IDs like `legacy-tree-alpha`)
- UIDs (use synthetic IDs like `owner-evidence-a`)
- Emails
- Titles
- Memory content
- Private visibility evidence details
- Tokens, secrets, or credentials

### Test fixture identity rules

1. Use only synthetic IDs in tests.
2. Example: `legacy-tree-alpha`, `owner-evidence-a`, `title-evidence-b`.
3. Do not copy Production IDs or similar values.

---

**End of design contract.**
