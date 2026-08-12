# Canonical Memory Lineage Branch Prototype — #4005

Parent: #4004  
Track: #4005  
Prototype date: 2026-08-12  
LoveBud base: `cc6cb26854e4cc692d3109debe05b0de1ab23a89`  
LoveTree source commit inspected: `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`

## Purpose

Validate the first additive LoveTree schema refinement against a child branch of the canonical-candidate LoveBud Neon database without mutating Production.

## Source-grounded LoveTree shape

The exact LoveTree Drizzle schema at the inspected commit defines Memory lineage fields as:

- `client_key`: nullable text
- `sort_order`: nullable integer
- unique `(tree_id, client_key)`
- partial unique `(tree_id, sort_order)` where `sort_order IS NOT NULL`

No NOT NULL/default requirement is attached to either field.

This prototype intentionally ports only those two nullable fields and their two supporting uniqueness indexes. It does not port LoveTree enums, JSONB conversions, strict Tree foreign keys, wholesale NOT NULL constraints, PostgreSQL 18, or other unrelated schema differences.

## Isolated Neon branch

```text
name: schema-4005-memory-lineage-prototype-20260812
branch id: br-bitter-shape-a1yp6iup
parent: br-little-fire-a18brh25
```

The branch is non-default and was created only for #4005 prototype work.

## Pre-change snapshot

Before any DDL on the child branch:

```text
Memory rows: 287
ID checksum: c2778e6e50352a4f0b59afd32038f1b3
client_key column: absent
sort_order column: absent
both target indexes: absent
```

The checksum is over ordered Memory IDs only; no private Memory text/content was emitted.

## Prototype DDL outcome

The child branch now contains:

```text
memories.client_key  text     NULL allowed, no default
memories.sort_order  integer  NULL allowed, no default
```

and:

```text
memories_tree_client_key_uniq
  UNIQUE (tree_id, client_key)

memories_tree_sort_order_uniq_partial
  UNIQUE (tree_id, sort_order)
  WHERE sort_order IS NOT NULL
```

## Post-change verification

```text
Memory rows:                         287
ID checksum:                         c2778e6e50352a4f0b59afd32038f1b3
client_key NULL rows:                287
sort_order NULL rows:                287
duplicate non-null client-key groups: 0
duplicate non-null sort-order groups: 0
```

The row count and ordered-ID checksum are identical before and after the additive DDL. Existing rows were not backfilled or rewritten with synthetic lineage values.

## Interpretation

This proves the narrow schema addition is compatible with the current canonical snapshot when introduced as nullable metadata.

It does **not** yet authorize a Production migration. The next required layer is the write contract:

1. define which new Memory-create paths generate/accept `client_key`;
2. define ordering semantics and collision handling for `sort_order`;
3. prove idempotent retry behavior;
4. decide whether historical rows ever need backfill;
5. validate the migration path separately before applying to the parent branch.

Legacy orphan Memory/Tree state identified by the parent audit remains unchanged and is intentionally outside this prototype.

## Verdict

```text
GO_ADDITIVE_MEMORY_LINEAGE_SCHEMA
HOLD_PRODUCTION_MIGRATION
```

## Safety

- no Production DDL/DML
- no existing Memory value changed
- no data copy/delete
- no strict FK expansion
- no enum/JSONB conversion
- no PostgreSQL version upgrade
- no Cloudflare/Firebase/Modal mutation
- no LoveTree runtime/database mutation
- no merge requested

Refs #4004
Refs #4005
