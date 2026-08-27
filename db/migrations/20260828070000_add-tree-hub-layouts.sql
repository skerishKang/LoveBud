-- Migration: add canonical Hub Layout persistence for Tree
--
-- Refs #4277
-- Refs #3923
-- Refs #4217
-- Refs #4238
-- Refs #1882
--
-- This canonical migration creates the dedicated public.tree_hub_layouts
-- relation that the current Modal runtime (modal_compute/hub_layouts.py)
-- and the gated Cloudflare direct-Neon GET/PUT candidate
-- (functions/_shared/hub-layout-direct-neon.js,
--  functions/_shared/hub-layout-read-direct-neon.js) already consume.
--
-- Schema derivation (read from current runtime authorities):
--   - modal_compute/hub_layouts.py:
--       INSERT INTO tree_hub_layouts
--         (id, tree_id, revision, layout_mode, manual_positions,
--          created_at, updated_at)
--       VALUES (%s, %s, %s, %s, %s::jsonb, NOW(), NOW())
--   - functions/_shared/hub-layout-direct-neon.js:
--       INSERT_LAYOUT_SQL with the same column list and NOW() defaults
--   - functions/_shared/hub-layout-read-direct-neon.js:
--       HUB_LAYOUT_LATEST_READ_SQL selects revision, layout_mode,
--         manual_positions, updated_at from tree_hub_layouts
--   - The synthetic regression test
--       (tests/db-engine/hub-layout-revision-concurrency-3923.py)
--     builds the same shape with id PK, text tree_id NOT NULL,
--     integer revision NOT NULL, text layout_mode NOT NULL,
--     jsonb manual_positions NOT NULL, timestamptz created_at/updated_at
--     NOT NULL DEFAULT NOW().
--
-- (tree_id, revision) UNIQUE — explicit decision:
--   #3923 acceptance criteria state: "If a `(tree_id, revision)` unique DB
--   constraint is required, treat schema mutation as a separately reviewed
--   migration step rather than assuming it exists." This migration is
--   exactly that separately reviewed step. Current runtime authorities
--   do NOT depend on a DB-level UNIQUE for optimistic concurrency:
--   the application layer reads the latest revision, takes a
--   transaction-scoped pg_advisory_xact_lock, compares baseRevision, and
--   inserts revision = latest + 1 inside the same transaction
--   (modal_compute/hub_layouts.py::save_hub_layout). The regression test
--   confirms exactly one writer wins and one competitor receives 409.
--   This migration therefore does NOT declare UNIQUE(tree_id, revision):
--   doing so would change a runtime invariant to a database invariant
--   without a separate owner-approved decision, and would convert the
--   documented 409 conflict path into a 23505 unique-violation path
--   for any future schema-mutation anomaly. The decision is recorded
--   here and in the migration manifest so a future maintainer who wants
--   to add the unique defense-in-depth constraint must do so via a
--   separate, owner-reviewed forward migration.
--
-- FK ON DELETE CASCADE matches the runtime/UI ownership of Hub Layout
-- with the parent Tree lifetime: when a Tree is deleted, its Hub Layout
-- history rows must follow. This is the same intent the appreciation-
-- order migration registers for the same parent.
--
-- RLS, triggers, extra indexes, and sequences are intentionally absent:
--   - RLS state remains OFF at this stage; row access is enforced by the
--     runtime ownership boundary (require_tree_owner / legacyOwnerId
--     match), which is consistent with the synthetic regression test and
--     the direct-Neon GET/PUT gate contract.
--   - No triggers: there is no authority requiring audit, denormalization,
--     or any side-effect on this relation.
--   - No extra indexes: queries always filter by tree_id and the relation
--     cardinality per Tree is bounded (one row per revision; revisions
--     grow linearly with manual layout edits). The implicit PK index on
--     id is sufficient for current read paths, and the latest-revision
--     read uses ORDER BY revision DESC LIMIT 1 which is correct for the
--     bounded cardinality. A future (tree_id, revision DESC) index is
--     deferred and must be a separately reviewed migration if the
--     revision history grows.
--   - No sequence: id is application-generated (uuid4 in both Modal and
--     direct-Neon runtimes), so no DB-side sequence is required.
--
-- This migration does NOT modify trees.id, public.trees, any other
-- Tree/Memory/social relation, any runtime route, any privilege, or any
-- Production/Preview database. The destructive FK_CASCADE_EXPANSION
-- signal is registered in canonical-migrations.json to satisfy the
-- static destructive-DDL approval contract (docs/architecture/
-- db-destructive-ddl-approval-contract.md); the cascade only ever
-- affects this new child table when its parent Tree row is deleted,
-- and the migration is applied only through the fail-closed canonical
-- runner protocol (docs/architecture/db-canonical-runner-protocol-
-- contract.md) with the separately approved adoption baseline
-- (canonical-migrations.json status remains ADOPTION_REQUIRED).

CREATE TABLE IF NOT EXISTS public.tree_hub_layouts (
    id              TEXT PRIMARY KEY,
    tree_id         TEXT NOT NULL,
    revision        INTEGER NOT NULL,
    layout_mode     TEXT NOT NULL,
    manual_positions JSONB NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT tree_hub_layouts_tree_id_fkey
        FOREIGN KEY (tree_id) REFERENCES public.trees(id) ON DELETE CASCADE
);
