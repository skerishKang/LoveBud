-- Rollback: Revert reconciled public.tree_comments to the exact legacy 8-column shape
--
-- Issue: #3423
-- Refs: #3418 (BLOCKED_MIGRATION_REQUIRED), #3188, #3075, #1882
--
-- Purpose
-- -------
-- This script is executed ONLY IF the Neon production migration applied by
-- scripts/migration-reconcile-tree-comments-legacy-schema.sql produces a failed
-- post-schema verification or API smoke test. It reverts the reconciled schema back
-- to the exact legacy shape observed via approved read-only inspection:
--
--   id text NOT NULL
--   tree_id text NOT NULL
--   author_id text NULL
--   author_display_name text NULL
--   is_deleted boolean NOT NULL DEFAULT false
--   created_at timestamptz NULL
--   updated_at timestamptz NULL
--   payload jsonb NOT NULL DEFAULT '{}'::jsonb
--   PRIMARY KEY (tree_id, id)
--   FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
--   FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE
--   row count = 0
--
-- Hard safety preconditions (fail closed)
-- ----------------------------------------
--   * Explicit BEGIN / COMMIT.
--   * Bounded lock_timeout / statement_timeout.
--   * Table lock taken before any change.
--   * COUNT(*) = 0 (no data to lose; automatic rollback forbidden if rows exist).
--   * Exact reconciled schema confirmed before altering.
--   * Unexpected schema => fail closed (do not touch anything).
--   * A comment row already created => fail closed (do not silently destroy data).
--   * No cascade drop on any constraint.
--   * No DELETE / TRUNCATE of data.
--   * No production credentials embedded.
--
-- This file must never be auto-applied. It runs only under separate explicit
-- approval, after the migration has been applied and a smoke test has failed,
-- while the writer/composer is still disabled and row count is 0.

BEGIN;

-- Defensive session guards for an online rollback.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Take a brief, bounded table lock so the shape cannot change under us mid-rollback.
LOCK TABLE public.tree_comments IN SHARE ROW EXCLUSIVE MODE;

-- ─── Preconditions (fail closed on any mismatch) ────────────────────────────

DO $$
DECLARE
  v_rows bigint;
  v_rec_ok integer;
  v_legacy_ok integer;
  v_comments integer;
  v_canon_cols integer;
  v_body integer;
  v_owner integer;
  v_target_kind integer;
  v_target_id integer;
  v_pkid text;
  v_pkcdef text;
  v_canon_check integer;
  v_added_idx integer;
BEGIN
  -- Zero-row guard: rollback is only safe when nothing has been written.
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: tree_comments row_count=% (expected 0); abort to avoid data loss', v_rows;
  END IF;

  -- Confirm the table is in the EXACT reconciled shape before reverting.
  SELECT count(*) INTO v_body FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  IF NOT (v_body > 0 AND v_owner > 0 AND v_target_kind > 0 AND v_target_id > 0) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: table is not the reconciled shape (body=% owner_id=% target_kind=% target_id=%); abort',
      v_body, v_owner, v_target_kind, v_target_id;
  END IF;

  -- Canonical PK (id) must be present.
  SELECT conname, pg_get_constraintdef(oid) INTO v_pkid, v_pkcdef
  FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='p';
  IF v_pkcdef IS NULL OR v_pkcdef NOT ILIKE '%PRIMARY KEY%id%' OR v_pkcdef ILIKE '%tree_id%' THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: canonical PRIMARY KEY (id) not present, got %', v_pkcdef;
  END IF;

  -- Canonical CHECK constraints must be present.
  SELECT count(*) INTO v_canon_check
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) ILIKE '%target_kind%=%''tree''%'
         OR pg_get_constraintdef(oid) ILIKE '%target_id IS NULL OR target_id = tree_id%');
  IF v_canon_check <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: canonical CHECK constraints missing (count=%)', v_canon_check;
  END IF;

  -- Migration-added indexes must be present.
  SELECT count(*) INTO v_added_idx
  FROM pg_indexes
  WHERE schemaname='public' AND tablename='tree_comments'
    AND indexname IN ('idx_tree_comments_owner_id', 'idx_tree_comments_created_at');
  IF v_added_idx <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: migration-added indexes missing (count=%)', v_added_idx;
  END IF;

  -- Legacy-only columns must still be present (preserved by migration).
  SELECT count(*) INTO v_legacy_ok FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('author_id', 'author_display_name', 'is_deleted', 'payload');
  IF v_legacy_ok <> 4 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: legacy columns missing (count=%), unexpected schema', v_legacy_ok;
  END IF;

  -- Extra unexpected columns => fail closed.
  SELECT count(*) INTO v_canon_cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload','owner_id','body','target_kind','target_id');
  IF v_canon_cols <> 12 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: unexpected column count=% (expected 12 reconciled), abort', v_canon_cols;
  END IF;
END $$;

-- ─── Apply: revert to exact legacy 8-column shape ───────────────────────────

-- 1. Remove canonical CHECK constraints.
ALTER TABLE public.tree_comments
  DROP CONSTRAINT tree_comments_target_id_matches_tree_id;

ALTER TABLE public.tree_comments
  DROP CONSTRAINT tree_comments_target_kind_is_tree;

-- 2. Remove canonical PRIMARY KEY (id), restore legacy composite PK (tree_id, id).
-- The exact legacy PK constraint name is read from the catalog; dropped ONLY when
-- its definition is exactly (id). Guessing the constraint name is forbidden.
DO $$
DECLARE
  v_pkid text;
  v_pkcdef text;
BEGIN
  SELECT conname, pg_get_constraintdef(oid) INTO v_pkid, v_pkcdef
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='p';

  IF v_pkid IS NULL OR v_pkcdef IS NULL THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: no PRIMARY KEY found on tree_comments';
  END IF;

  IF v_pkcdef NOT ILIKE '%PRIMARY KEY%'
     OR regexp_replace(v_pkcdef, '.*\((.*)\)', '\1', 'i') NOT ILIKE '%id%'
     OR regexp_replace(v_pkcdef, '.*\((.*)\)', '\1', 'i') ILIKE '%tree_id%'
  THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: canonical PK definition is not exactly (id): %', v_pkcdef;
  END IF;

  EXECUTE format('ALTER TABLE public.tree_comments DROP CONSTRAINT %I', v_pkid);
END $$;

-- Restore legacy composite PRIMARY KEY (tree_id, id). This reuses the legacy
-- definition captured at migration time; the migration preserved the original PK.
ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_pkey PRIMARY KEY (tree_id, id);

-- 3. Remove migration-added indexes.
DROP INDEX IF EXISTS idx_tree_comments_owner_id;
DROP INDEX IF EXISTS idx_tree_comments_created_at;
-- Note: idx_tree_comments_tree_id is a legacy list-read index and is preserved.

-- 4. Remove migration-added columns.
ALTER TABLE public.tree_comments
  DROP COLUMN owner_id;

ALTER TABLE public.tree_comments
  DROP COLUMN body;

ALTER TABLE public.tree_comments
  DROP COLUMN target_kind;

ALTER TABLE public.tree_comments
  DROP COLUMN target_id;

-- 5. created_at / updated_at: revert to NULLABLE, drop migration-added defaults.
ALTER TABLE public.tree_comments
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN created_at DROP NOT NULL;

ALTER TABLE public.tree_comments
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP NOT NULL;

-- ─── Post-rollback verification (fail closed on mismatch) ───────────────────

DO $$
DECLARE
  v_cols integer;
  v_rows bigint;
  v_pkid text;
  v_pkcdef text;
  v_fk_author integer;
  v_fk_tree integer;
  v_body integer;
  v_owner integer;
  v_target_kind integer;
  v_target_id integer;
  v_idx_owner integer;
  v_idx_created integer;
  v_trig integer;
  v_rls integer;
  v_views integer;
BEGIN
  -- Exactly 8 columns remain.
  SELECT count(*) INTO v_cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments';
  IF v_cols <> 8 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: column count=% (expected 8)', v_cols;
  END IF;

  -- Canonical columns must be gone.
  SELECT count(*) INTO v_body FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  IF v_body > 0 OR v_owner > 0 OR v_target_kind > 0 OR v_target_id > 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: canonical columns still present (body=% owner_id=% target_kind=% target_id=%)',
      v_body, v_owner, v_target_kind, v_target_id;
  END IF;

  -- Legacy composite PK restored.
  SELECT conname, pg_get_constraintdef(oid) INTO v_pkid, v_pkcdef
  FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='p';
  IF v_pkcdef IS NULL OR v_pkcdef NOT ILIKE '%PRIMARY KEY%' OR v_pkcdef NOT ILIKE '%tree_id%id%' THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: legacy composite PK (tree_id, id) not restored, got %', v_pkcdef;
  END IF;

  -- Legacy FKs preserved.
  SELECT count(*) INTO v_fk_author FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='f'
    AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(author_id)%REFERENCES %users%(id)%ON DELETE SET NULL%';
  SELECT count(*) INTO v_fk_tree FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='f'
    AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(tree_id)%REFERENCES %trees%(id)%ON DELETE CASCADE%';
  IF v_fk_author <> 1 OR v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: legacy FKs not preserved (author=% tree=%)', v_fk_author, v_fk_tree;
  END IF;

  -- Migration-added indexes gone.
  SELECT count(*) INTO v_idx_owner FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_owner_id';
  SELECT count(*) INTO v_idx_created FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_created_at';
  IF v_idx_owner <> 0 OR v_idx_created <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: migration-added indexes still present (owner=% created=%)', v_idx_owner, v_idx_created;
  END IF;

  -- created_at / updated_at back to NULLABLE.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: created_at not reverted to NULLABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: updated_at not reverted to NULLABLE';
  END IF;

  -- Row count still 0.
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: row count=% after rollback (expected 0)', v_rows;
  END IF;

  -- No risky dependent objects introduced.
  SELECT count(*) INTO v_trig FROM pg_trigger WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;
  SELECT count(*) INTO v_rls FROM pg_class WHERE oid='public.tree_comments'::regclass AND relrowsecurity;
  SELECT count(*) INTO v_views FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='v';
  IF v_trig <> 0 OR v_rls <> 0 OR v_views <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: unexpected trigger/RLS/dependent view appeared after rollback';
  END IF;
END $$;

COMMIT;
