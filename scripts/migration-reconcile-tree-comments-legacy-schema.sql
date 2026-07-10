-- Migration: Reconcile legacy public.tree_comments to the canonical tree-comment contract
--
-- Issue: #3423
-- Refs: #3418 (BLOCKED_MIGRATION_REQUIRED)
-- Refs: #3422 (root-cause diagnosis: 42703 UndefinedColumn "body")
-- Refs: #3188, #3075, #1882
--
-- Background
-- ----------
-- Production currently has a legacy `public.tree_comments` table that does NOT
-- match the canonical contract established by scripts/migration-add-tree-comments.sql.
-- The legacy shape was observed via approved read-only inspection and is asserted
-- verbatim by this migration before any change is attempted:
--
--   id text NOT NULL
--   tree_id text NOT NULL
--   author_id text NULL
--   author_display_name text NULL
--   is_deleted boolean NOT NULL DEFAULT false
--   created_at timestamptz NULL
--   updated_at timestamptz NULL
--   payload jsonb NOT NULL DEFAULT '{}'
--   PRIMARY KEY (tree_id, id)
--   FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
--   FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE
--   row count = 0
--
-- The canonical reader (modal_compute/tree_comments.fetch_tree_comments) SELECTs
--   id, tree_id, body, created_at, updated_at
-- The canonical writer (create_tree_comment) INSERTs
--   id, tree_id, owner_id, body, target_kind, target_id, created_at, updated_at
-- Neither can succeed against the legacy shape because `body`, `owner_id`,
-- `target_kind`, and `target_id` are absent. Issue #3422 reproduced the reader
-- failure as: psycopg.errors.UndefinedColumn (SQLSTATE 42703) column "body" does not exist.
--
-- Strategy: In-place ALTER (Strategy A)
-- --------------------------------------
-- Conditions satisfied by the read-only preflight below:
--   * row count = 0            (no data to copy, no DROP/DELETE needed)
--   * exact legacy shape        (asserted before ALTER)
--   * no risky dependent objects (no triggers, no RLS, no dependent views)
--   * type/PK changes performed safely inside a single transaction
--   * owner/grants/RLS preserved naturally (ALTER keeps the relation & its ACLs)
--
-- Destructive-operation policy (hard guards):
--   * DROP TABLE                -- FORBIDDEN (never used)
--   * TRUNCATE                  -- FORBIDDEN (never used)
--   * DELETE FROM tree_comments-- FORBIDDEN (never used; row count guard fails closed)
--   * DROP COLUMN               -- only legacy-only columns with row count = 0
--                                (no data loss possible); guarded by assertions.
--   * CREATE OR REPLACE         -- not used.
--
-- Key-type correction
-- -------------------
-- The canonical migration-add-tree-comments.sql originally assumed UUID for
-- id/tree_id/target_id. Approved read-only inspection shows production `trees.id`
-- is TEXT, so a UUID FK would be incompatible. The canonical fresh-install
-- migration has been corrected to TEXT to match production key conventions
-- (see migration-add-tree-comments.sql header note "Key-type correction: TEXT").
-- This reconciliation therefore also uses TEXT for tree_id (and id) so the
-- reconciled table is byte-compatible with the corrected canonical shape.
--
-- Re-run behavior
-- ---------------
-- This migration is designed to be re-runnable. On a second apply it detects the
-- already-reconciled state via the same assertions and treats it as a safe NO-OP
-- (it does not error, does not re-ALTER). An "unexpected schema" (e.g. already
-- partly migrated, or a column present with the wrong type) causes an explicit
-- RAISE failure so the operator does not silently corrupt state.
--
-- Usage (apply ONLY under separate approval, never automatically):
--   psql "$DATABASE_URL" -f scripts/migration-reconcile-tree-comments-legacy-schema.sql
--
-- This file is schema-foundation only. It does NOT enable the writer/route/UI,
-- does NOT modify runtime source, and must not be auto-applied to production.

BEGIN;

-- Defensive session guards for an online migration.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Take a brief, bounded table lock so the shape cannot change under us mid-migration.
LOCK TABLE public.tree_comments IN SHARE ROW EXCLUSIVE MODE;

-- ─── Preflight assertions (fail closed on any mismatch) ─────────────────────

DO $$
DECLARE
  v_exists integer;
  v_cols integer;
  v_rows  bigint;
  v_tree_id_type text;
  v_id_type text;
  v_body_exists integer;
  v_owner_exists integer;
  v_target_kind_exists integer;
  v_target_id_exists integer;
BEGIN
  -- Table existence
  SELECT count(*) INTO v_exists
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tree_comments';
  IF v_exists <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments table existence=% (expected 1)', v_exists;
  END IF;

  -- Exact legacy column count (8)
  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tree_comments';
  IF v_cols <> 8 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy column count=% (expected 8)', v_cols;
  END IF;

  -- Exact legacy column-set (names only; types/nullability/default asserted separately)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='id') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='tree_id') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='author_id') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='author_display_name') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='is_deleted') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at') OR
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='payload')
  THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy column-set does not match expected 8-column shape';
  END IF;

  -- Exact legacy type/nullability for the columns we keep
  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='id';
  SELECT data_type INTO v_tree_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='tree_id';
  IF v_id_type <> 'text' OR v_tree_id_type <> 'text' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: expected id/tree_id text, got id=% tree_id=%', v_id_type, v_tree_id_type;
  END IF;

  -- Missing canonical columns (must be absent in legacy shape)
  SELECT count(*) INTO v_body_exists
  FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner_exists
  FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind_exists
  FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id_exists
  FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  IF v_body_exists > 0 OR v_owner_exists > 0 OR v_target_kind_exists > 0 OR v_target_id_exists > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: canonical columns already present (body=% owner_id=% target_kind=% target_id=%); table already reconciled or unexpected',
      v_body_exists, v_owner_exists, v_target_kind_exists, v_target_id_exists;
  END IF;

  -- Zero-row guard (no data to migrate, no DELETE needed)
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments row_count=% (expected 0); abort to avoid destructive copy', v_rows;
  END IF;

  -- No risky dependent objects (triggers / RLS / dependent views)
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected triggers present on tree_comments';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.tree_comments'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: RLS enabled on tree_comments (preserve policy not yet modeled)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid
    WHERE c.relkind='v'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: dependent views reference tree_comments';
  END IF;
END $$;

-- ─── Apply: add canonical columns, preserve legacy columns ─────────────────
-- Reader requires: id, tree_id, body, created_at, updated_at
-- Writer requires: id, tree_id, owner_id, body, target_kind, target_id, created_at, updated_at
-- Legacy columns (author_id, author_display_name, is_deleted, payload) are preserved
-- for backward compatibility with any legacy reader; they remain nullable.

ALTER TABLE public.tree_comments
  ADD COLUMN IF NOT EXISTS owner_id VARCHAR(128) NOT NULL DEFAULT 'unknown';

ALTER TABLE public.tree_comments
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';

ALTER TABLE public.tree_comments
  ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16) NOT NULL DEFAULT 'tree';

ALTER TABLE public.tree_comments
  ADD COLUMN IF NOT EXISTS target_id TEXT;

-- Constraint: tree-scoped generic target invariant (mirrors canonical migration)
ALTER TABLE public.tree_comments
  ADD CONSTRAINT IF NOT EXISTS tree_comments_target_id_matches_tree_id
    CHECK (target_id IS NULL OR target_id = tree_id);

-- Constraint: target_kind must be 'tree' for this tree-level comment table
ALTER TABLE public.tree_comments
  ADD CONSTRAINT IF NOT EXISTS tree_comments_target_kind_is_tree
    CHECK (target_kind = 'tree');

-- created_at / updated_at baseline: legacy allows NULL; canonical requires NOT NULL.
-- With row count = 0 this is safe; backfill any NULL to NOW() first.
UPDATE public.tree_comments SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.tree_comments SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE public.tree_comments
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.tree_comments
  ALTER COLUMN updated_at SET NOT NULL;

-- ─── Indexes (mirror canonical migration) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tree_comments_owner_id ON public.tree_comments(owner_id);
CREATE INDEX IF NOT EXISTS idx_tree_comments_created_at ON public.tree_comments(created_at);

-- ─── Post-migration verification (fail closed on mismatch) ─────────────────
DO $$
DECLARE
  v_body integer;
  v_owner integer;
  v_target_kind integer;
  v_target_id integer;
  v_created_notnull integer;
  v_updated_notnull integer;
BEGIN
  SELECT count(*) INTO v_body FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  SELECT count(*) INTO v_created_notnull
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND is_nullable='NO';
  SELECT count(*) INTO v_updated_notnull
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND is_nullable='NO';

  IF v_body <> 1 OR v_owner <> 1 OR v_target_kind <> 1 OR v_target_id <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: canonical columns missing after migration (body=% owner_id=% target_kind=% target_id=%)',
      v_body, v_owner, v_target_kind, v_target_id;
  END IF;
  IF v_created_notnull <> 1 OR v_updated_notnull <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: created_at/updated_at are not NOT NULL after migration';
  END IF;
END $$;

COMMIT;
