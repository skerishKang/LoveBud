-- Migration: Reconcile legacy public.tree_comments to the canonical tree-comment contract
--
-- Issue: #3423
-- Refs: #3418 (BLOCKED_MIGRATION_REQUIRED)
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
--   payload jsonb NOT NULL DEFAULT '{}'::jsonb
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
-- `target_kind`, and `target_id` are absent. The reader failure manifests as
-- SQLSTATE 42703 (UndefinedColumn: column "body" does not exist).
--
-- Strategy: In-place ALTER (Strategy A)
-- --------------------------------------
-- Conditions satisfied by the read-only preflight below:
--   * row count = 0            (no data to copy, no DROP/DELETE needed)
--   * exact legacy shape        (asserted before ALTER)
--   * no risky dependent objects (no triggers, no RLS, no dependent views, no unexpected inbound FK)
--   * type/PK changes performed safely inside a single transaction
--   * owner/grants/RLS preserved naturally (ALTER keeps the relation & its ACLs)
--
-- Destructive-operation policy (hard guards):
--   * DROP TABLE                -- FORBIDDEN (never used)
--   * TRUNCATE                  -- FORBIDDEN (never used)
--   * DELETE FROM tree_comments-- FORBIDDEN (never used; row count guard fails closed)
--   * DROP COLUMN               -- FORBIDDEN entirely (legacy columns are preserved, never dropped)
--   * CREATE OR REPLACE         -- not used.
--
-- Key-type correction
-- -------------------
-- The canonical migration-add-tree-comments.sql originally assumed UUID for
-- id/tree_id/target_id. Approved read-only inspection shows production `trees.id`
-- is TEXT, so a UUID FK would be incompatible. The canonical fresh-install
-- migration has been corrected to TEXT to match production key conventions.
-- This reconciliation therefore also uses TEXT for tree_id (and id) so the
-- reconciled table is byte-compatible with the corrected canonical shape.
--
-- Re-run policy (explicit stop, NOT a silent NO-OP)
-- --------------------------------------------------
--   * EXACT LEGACY schema  -> migration runs (adds canonical columns, converts PK).
--   * RECONCILED schema    -> migration raises:
--         PREFLIGHT STOP: tree_comments already reconciled
--       and aborts WITHOUT changing anything. A second run is therefore a safe,
--       explicit STOP, never a success "no-op" that silently skips work.
--   * PARTIAL / UNEXPECTED schema -> migration raises:
--         PREFLIGHT FAIL
--       and aborts WITHOUT changing anything.
--
-- Usage (apply ONLY under separate approval, never automatically):
--   psql "$DATABASE_URL" -f scripts/migration-reconcile-tree-comments-legacy-schema.sql
--
-- This file is schema-foundation only. It does NOT enable the writer/route/UI,
-- does NOT modify runtime source, and must not be auto-applied.

BEGIN;

-- Defensive session guards for an online migration.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Take a brief, bounded table lock so the shape cannot change under us mid-migration.
LOCK TABLE public.tree_comments IN SHARE ROW EXCLUSIVE MODE;

-- ─── Preflight assertions (fail/stop closed on any mismatch) ─────────────────

DO $$
DECLARE
  v_exists integer;
  v_cols integer;
  v_rows  bigint;
  v_tree_id_type text;
  v_tree_id_udt text;
  v_tree_id_null text;
  v_id_type text;
  v_id_udt text;
  v_id_null text;
  v_body integer;
  v_owner integer;
  v_target_kind integer;
  v_target_id integer;
  v_rec_ok integer;
  v_legacy_ok integer;
  v_inbound_fk integer;
  v_pkid text;
  v_cdef text;
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

  -- Exact legacy type / udt / nullability for id (expected: text / text / NO)
  SELECT data_type, udt_name, is_nullable INTO v_id_type, v_id_udt, v_id_null
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='id';
  IF v_id_type <> 'text' OR v_id_udt <> 'text' OR v_id_null <> 'NO' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: expected id/tree_id text, id expected text/text NOT NULL, got %/%/%', v_id_type, v_id_udt, v_id_null;
  END IF;

  -- Exact legacy type / udt / nullability for tree_id (expected: text / text / NO)
  SELECT data_type, udt_name, is_nullable INTO v_tree_id_type, v_tree_id_udt, v_tree_id_null
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='tree_id';
  IF v_tree_id_type <> 'text' OR v_tree_id_udt <> 'text' OR v_tree_id_null <> 'NO' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_id expected text/text NOT NULL, got %/%/%', v_tree_id_type, v_tree_id_udt, v_tree_id_null;
  END IF;

  -- Exact legacy type/nullability/default for the 6 remaining legacy columns.
  -- author_id: text NULL ; author_display_name: text NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='author_id' AND data_type='text' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: author_id expected text NULL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='author_display_name' AND data_type='text' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: author_display_name expected text NULL';
  END IF;
  -- is_deleted: boolean NOT NULL DEFAULT false
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='is_deleted' AND data_type='boolean' AND is_nullable='NO'
      AND column_default IN ('false', 'FALSE')
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: is_deleted expected boolean NOT NULL DEFAULT false';
  END IF;
  -- created_at: timestamptz NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='created_at' AND data_type='timestamp with time zone' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: created_at expected timestamptz NULL';
  END IF;
  -- updated_at: timestamptz NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='updated_at' AND data_type='timestamp with time zone' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: updated_at expected timestamptz NULL';
  END IF;
  -- payload: jsonb NOT NULL DEFAULT '{}'::jsonb
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='payload' AND data_type='jsonb' AND is_nullable='NO'
      AND column_default = '''{}''::jsonb'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: payload expected jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;

  -- Exact legacy PRIMARY KEY must be (tree_id, id)
  SELECT conname, pg_get_constraintdef(oid) INTO v_pkid, v_cdef
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='p';
  IF v_cdef IS NULL OR v_cdef NOT ILIKE '%tree_id%id%' OR v_cdef NOT ILIKE '%PRIMARY KEY%' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy PRIMARY KEY expected (tree_id, id), got %', v_cdef;
  END IF;

  -- Exact legacy FOREIGN KEYs:
  --   author_id -> users(id) ON DELETE SET NULL
  --   tree_id   -> trees(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.tree_comments'::regclass AND contype='f'
      AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(author_id)%REFERENCES %users%(id)%ON DELETE SET NULL%'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: FK author_id -> users(id) ON DELETE SET NULL not found/changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.tree_comments'::regclass AND contype='f'
      AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(tree_id)%REFERENCES %trees%(id)%ON DELETE CASCADE%'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: FK tree_id -> trees(id) ON DELETE CASCADE not found/changed';
  END IF;

  -- No unexpected INBOUND foreign keys referencing tree_comments.
  SELECT count(*) INTO v_inbound_fk
  FROM pg_constraint c
  WHERE c.contype='f' AND c.confrelid='public.tree_comments'::regclass;
  IF v_inbound_fk <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected inbound FK(s) reference tree_comments (count=%)', v_inbound_fk;
  END IF;

  -- Missing canonical columns (must be absent in legacy shape)
  SELECT count(*) INTO v_body FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  IF v_body > 0 OR v_owner > 0 OR v_target_kind > 0 OR v_target_id > 0 THEN
    -- All four canonical columns present => fully reconciled => explicit STOP.
    -- Some but not all present => partial migration => fail closed.
    IF v_body > 0 AND v_owner > 0 AND v_target_kind > 0 AND v_target_id > 0 THEN
      RAISE EXCEPTION 'PREFLIGHT STOP: tree_comments already reconciled';
    ELSE
      RAISE EXCEPTION 'PREFLIGHT FAIL: partial canonical schema detected (body=% owner_id=% target_kind=% target_id=%); abort',
        v_body, v_owner, v_target_kind, v_target_id;
    END IF;
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

  -- Canonical-state discrimination (final defense): if the table already matches
  -- the full canonical shape, it is reconciled -> explicit STOP.
  SELECT count(*) INTO v_rec_ok FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','owner_id','body','target_kind','target_id','created_at','updated_at');
  IF v_rec_ok = 8 THEN
    RAISE EXCEPTION 'PREFLIGHT STOP: tree_comments already reconciled';
  END IF;

  -- Legacy-only discrimination: the legacy shape has exactly 8 columns and none of the
  -- canonical ones. If we reach here, the table is the exact legacy shape -> proceed.
  SELECT count(*) INTO v_legacy_ok FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload');
  IF v_legacy_ok <> 8 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments is neither exact legacy nor reconciled (partial/unexpected schema)';
  END IF;
END $$;

-- ─── Apply: add canonical columns, preserve legacy columns ─────────────────
-- Reader requires: id, tree_id, body, created_at, updated_at
-- Writer requires: id, tree_id, owner_id, body, target_kind, target_id, created_at, updated_at
-- Legacy columns (author_id, author_display_name, is_deleted, payload) are preserved
-- for backward compatibility with any legacy reader; they remain nullable.
--
-- The table has row count = 0, so added NOT NULL columns need no default and no
-- backfill UPDATE. created_at/updated_at use DEFAULT NOW() (no sentinel value).

ALTER TABLE public.tree_comments
  ADD COLUMN owner_id VARCHAR(128) NOT NULL;

ALTER TABLE public.tree_comments
  ADD COLUMN body TEXT NOT NULL;

ALTER TABLE public.tree_comments
  ADD COLUMN target_kind VARCHAR(16) NOT NULL DEFAULT 'tree';

ALTER TABLE public.tree_comments
  ADD COLUMN target_id TEXT;

-- Constraint: target_kind must be 'tree' for this tree-level comment table.
ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_target_kind_is_tree
    CHECK (target_kind = 'tree');

-- Constraint: tree-scoped generic target invariant (mirrors canonical migration).
ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_target_id_matches_tree_id
    CHECK (target_id IS NULL OR target_id = tree_id);

-- created_at / updated_at: legacy allows NULL; canonical requires NOT NULL with
-- DEFAULT NOW(). Row count = 0 guarantees no sentinel backfill is needed.
ALTER TABLE public.tree_comments
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.tree_comments
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

-- ─── Canonical primary key (PRIMARY KEY (id)) ──────────────────────────────
-- Writer replay reads by WHERE id = %s, so id must be DB-level unique.
-- The exact legacy PK constraint name is NOT assumed; it is read from the catalog
-- and dropped ONLY when its definition is exactly (tree_id, id). Guessing the
-- constraint name is forbidden. tree_id index is preserved for list reads.
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

  -- Confirm the legacy PK is exactly (tree_id, id) before touching it.
  IF v_pkcdef NOT ILIKE '%PRIMARY KEY%'
     OR regexp_replace(v_pkcdef, '.*\((.*)\)', '\1', 'i') NOT ILIKE '%tree_id%id%'
     OR regexp_replace(v_pkcdef, '.*\((.*)\)', '\1', 'i') ILIKE '%owner_id%'
     OR regexp_replace(v_pkcdef, '.*\((.*)\)', '\1', 'i') ILIKE '%target_id%'
  THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: legacy PK definition is not exactly (tree_id, id): %', v_pkcdef;
  END IF;

  EXECUTE format('ALTER TABLE public.tree_comments DROP CONSTRAINT %I', v_pkid);
END $$;

ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_pkey PRIMARY KEY (id);

-- ─── Indexes (mirror canonical migration) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tree_comments_tree_id ON public.tree_comments(tree_id);
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
  v_created_def integer;
  v_updated_def integer;
  v_target_kind_default integer;
  v_pkid text;
  v_pkcdef text;
  v_fk_tree integer;
  v_chk_kind integer;
  v_chk_tid integer;
  v_idx_tree integer;
  v_idx_owner integer;
  v_idx_created integer;
  v_legacy_author integer;
  v_legacy_payload integer;
  v_legacy_deleted integer;
  v_rows bigint;
  v_trig integer;
  v_rls integer;
  v_views integer;
  v_sentinel integer;
BEGIN
  -- Canonical columns present
  SELECT count(*) INTO v_body FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body';
  SELECT count(*) INTO v_owner FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id';
  SELECT count(*) INTO v_target_kind FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind';
  SELECT count(*) INTO v_target_id FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id';
  IF v_body <> 1 OR v_owner <> 1 OR v_target_kind <> 1 OR v_target_id <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: canonical columns missing after migration (body=% owner_id=% target_kind=% target_id=%)',
      v_body, v_owner, v_target_kind, v_target_id;
  END IF;

  -- Types / nullability / defaults
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id' AND data_type='character varying' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: owner_id must be varchar(128) NOT NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body' AND data_type='text' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: body must be text NOT NULL';
  END IF;
  SELECT count(*) INTO v_target_kind_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind' AND column_default ILIKE '%''tree''%';
  IF v_target_kind_default <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: target_kind default must be ''tree''';
  END IF;
  SELECT count(*) INTO v_created_notnull FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND is_nullable='NO';
  SELECT count(*) INTO v_updated_notnull FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND is_nullable='NO';
  IF v_created_notnull <> 1 OR v_updated_notnull <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: created_at/updated_at are not NOT NULL after migration';
  END IF;
  SELECT count(*) INTO v_created_def FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND column_default ILIKE '%now()%';
  SELECT count(*) INTO v_updated_def FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND column_default ILIKE '%now()%';
  IF v_created_def <> 1 OR v_updated_def <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: created_at/updated_at must default to NOW()';
  END IF;

  -- PRIMARY KEY (id)
  SELECT conname, pg_get_constraintdef(oid) INTO v_pkid, v_pkcdef
  FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='p';
  IF v_pkcdef IS NULL OR v_pkcdef NOT ILIKE '%PRIMARY KEY%id%' OR v_pkcdef ILIKE '%tree_id%' THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: PRIMARY KEY must be (id), got %', v_pkcdef;
  END IF;

  -- tree_id FK preserved
  SELECT count(*) INTO v_fk_tree FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='f'
    AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(tree_id)%REFERENCES %trees%(id)%ON DELETE CASCADE%';
  IF v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: tree_id FK to trees(id) ON DELETE CASCADE must be preserved';
  END IF;

  -- CHECK constraints present
  SELECT count(*) INTO v_chk_kind FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%target_kind%=%''tree''%';
  SELECT count(*) INTO v_chk_tid FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%target_id IS NULL OR target_id = tree_id%';
  IF v_chk_kind <> 1 OR v_chk_tid <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: target_kind / target_id CHECK constraints missing';
  END IF;

  -- Required indexes
  SELECT count(*) INTO v_idx_tree FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_tree_id';
  SELECT count(*) INTO v_idx_owner FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_owner_id';
  SELECT count(*) INTO v_idx_created FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_created_at';
  IF v_idx_tree <> 1 OR v_idx_owner <> 1 OR v_idx_created <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: required indexes missing (tree_id/owner_id/created_at)';
  END IF;

  -- Legacy-only columns preserved
  SELECT count(*) INTO v_legacy_author FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='author_id';
  SELECT count(*) INTO v_legacy_payload FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='payload';
  SELECT count(*) INTO v_legacy_deleted FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='is_deleted';
  IF v_legacy_author <> 1 OR v_legacy_payload <> 1 OR v_legacy_deleted <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: legacy-only columns (author_id/payload/is_deleted) not preserved';
  END IF;

  -- Sentinel defaults must not exist
  SELECT count(*) INTO v_sentinel FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND (column_default ILIKE '%''unknown''%' OR column_default = '''''');
  IF v_sentinel <> 0 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: sentinel defaults (''unknown'' / '''') detected';
  END IF;

  -- Row count still 0
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: row count=% after migration (expected 0)', v_rows;
  END IF;

  -- No risky dependent objects introduced
  SELECT count(*) INTO v_trig FROM pg_trigger WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;
  SELECT count(*) INTO v_rls FROM pg_class WHERE oid='public.tree_comments'::regclass AND relrowsecurity;
  SELECT count(*) INTO v_views FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='v';
  IF v_trig <> 0 OR v_rls <> 0 OR v_views <> 0 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: unexpected trigger/RLS/dependent view appeared after migration';
  END IF;
END $$;

COMMIT;
