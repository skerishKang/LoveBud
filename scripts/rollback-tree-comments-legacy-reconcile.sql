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

-- ── Purpose-specific normalizers (top-level, dropped before COMMIT) ──
-- These MUST stay byte-for-byte in sync with the migration script's
-- _lb_norm_default / _lb_norm_check so the rollback accepts exactly the same
-- reconciled schema the migration produces. See the migration file for the full
-- behavioral contract and the schema-qualification / collision policy.
CREATE FUNCTION _lb_norm_default(p_expr text) RETURNS text AS $$
DECLARE
  v text := lower(coalesce(p_expr, ''));
BEGIN
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := regexp_replace(v, '::(character varying|varchar|timestamp with time zone|timestamptz|text|bpchar|boolean|jsonb|integer|bigint)', '', 'g');
  v := regexp_replace(v, '^\s+|\s+$', '', 'g');
  v := regexp_replace(v, '^''(.*)''$', '\1');   -- strip surrounding quotes of a string-literal default
  RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION _lb_norm_check(p_expr text) RETURNS text AS $$
DECLARE
  v text := lower(coalesce(p_expr, ''));
  n integer;
  i integer;
  j integer;
  k integer;
  m integer;
  d integer;
  prev text;
  nxt text;
  inner_txt text;
  changed boolean := true;
BEGIN
  v := regexp_replace(v, '^check\s*\(', '', 'i');   -- strip leading CHECK (
  v := regexp_replace(v, '\)$', '');                  -- strip CHECK's trailing )
  v := regexp_replace(v, '::(character varying|varchar|timestamp with time zone|timestamptz|text|bpchar|boolean|jsonb|integer|bigint)', '', 'g');
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := regexp_replace(v, '^\s+|\s+$', '', 'g');
  WHILE changed LOOP
    changed := false;
    n := length(v);
    IF n > 0 AND left(v, 1) = '(' AND right(v, 1) = ')' THEN
      d := 0; j := 0;
      FOR k IN 1..n LOOP
        IF substring(v FROM k FOR 1) = '(' THEN d := d + 1;
        ELSIF substring(v FROM k FOR 1) = ')' THEN
          d := d - 1;
          IF d = 0 THEN j := k; EXIT; END IF;
        END IF;
      END LOOP;
      IF j = n THEN
        v := substring(v FROM 2 FOR n - 2);
        changed := true;
        CONTINUE;
      END IF;
    END IF;
    i := 0;
    FOR k IN 1..n LOOP
      IF substring(v FROM k FOR 1) = '(' THEN
        d := 0;
        FOR m IN k..n LOOP
          IF substring(v FROM m FOR 1) = '(' THEN d := d + 1;
          ELSIF substring(v FROM m FOR 1) = ')' THEN
            d := d - 1;
            IF d = 0 THEN j := m; EXIT; END IF;
          END IF;
        END LOOP;
        prev := CASE WHEN k = 1 THEN '' ELSE substring(v FROM k - 1 FOR 1) END;
        nxt := CASE WHEN j = n THEN '' ELSE substring(v FROM j + 1 FOR 1) END;
        inner_txt := substring(v FROM k + 1 FOR j - k - 1);
        IF (k = 1 OR prev IN ('(', ' ', ','))
           AND (j = n OR nxt IN (')', ' ', ','))
           AND inner_txt !~* '\s(or|and)\s'
        THEN
          v := left(v, k - 1) || inner_txt || substring(v FROM j + 1);
          changed := true;
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── Preconditions (fail closed on any mismatch) ────────────────────────────

DO $$
DECLARE
  v_rows bigint;
  v_total_cols integer;
  v_legacy_markers integer;
  v_canon_extra integer;
  v_trees_id_type text;
  v_trees_id_udt text;
  v_trees_id_null text;
  v_pk_cols text[];
  v_all_con integer;
  v_check_con integer;
  v_fk_total integer;
  v_fk_tree integer;
  v_fk_author integer;
  v_chk_kind integer;
  v_chk_tid integer;
  v_inbound_fk integer;
  v_idx_tree integer;
  v_idx_owner integer;
  v_idx_created integer;
  v_idx_pk integer;
  v_idx_secondary integer;
  v_idx_unexpected integer;
  v_trig integer;
  v_rls integer;
  v_views integer;
  v_matviews integer;
BEGIN
  -- ── Zero-row guard: rollback is only safe when nothing has been written. ─────
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: tree_comments row_count=% (expected 0); abort to avoid data loss', v_rows;
  END IF;

  -- ── Runtime assertion that public.trees.id is text (FK compatibility premise) ─
  SELECT data_type, udt_name, is_nullable INTO v_trees_id_type, v_trees_id_udt, v_trees_id_null
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'id';
  IF v_trees_id_type IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.trees.id must be text (column not found)';
  END IF;
  IF v_trees_id_type <> 'text' OR v_trees_id_udt <> 'text' OR v_trees_id_null <> 'NO' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.trees.id must be text (got %/%/%)', v_trees_id_type, v_trees_id_udt, v_trees_id_null;
  END IF;

  -- ── Exact reconciled 12-column shape (8 legacy markers + 4 canonical-only) ───
  SELECT count(*) INTO v_total_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments';
  SELECT count(*) INTO v_legacy_markers
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload');
  SELECT count(*) INTO v_canon_extra
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('owner_id','body','target_kind','target_id');
  IF NOT (v_total_cols = 12 AND v_legacy_markers = 8 AND v_canon_extra = 4) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: table is not the exact reconciled 12-column shape (total=%, legacy_markers=%, canonical_only=%)',
      v_total_cols, v_legacy_markers, v_canon_extra;
  END IF;

  -- ── Exact canonical column metadata (type / udt / length / nullable / default)
  -- id: text NOT NULL, no default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: id must be text NOT NULL with no default';
  END IF;
  -- tree_id: text NOT NULL, no default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='tree_id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: tree_id must be text NOT NULL with no default';
  END IF;
  -- owner_id: varchar(128) NOT NULL, no default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='owner_id' AND data_type='character varying' AND udt_name='varchar'
    AND character_maximum_length=128 AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: owner_id must be varchar(128) NOT NULL with no default';
  END IF;
  -- body: text NOT NULL, no default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='body' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: body must be text NOT NULL with no default';
  END IF;
  -- target_kind: varchar(16) NOT NULL DEFAULT 'tree'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='target_kind' AND data_type='character varying' AND udt_name='varchar'
    AND character_maximum_length=16 AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'tree') THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: target_kind must be varchar(16) NOT NULL DEFAULT ''tree''';
  END IF;
  -- target_id: text NULL, no default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='target_id' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: target_id must be text NULL with no default';
  END IF;
  -- created_at: timestamptz NOT NULL DEFAULT now()
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='created_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz'
    AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: created_at must be timestamptz NOT NULL DEFAULT now()';
  END IF;
  -- updated_at: timestamptz NOT NULL DEFAULT now()
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='updated_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz'
    AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: updated_at must be timestamptz NOT NULL DEFAULT now()';
  END IF;

  -- Legacy-preserved columns must exist with exact metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='author_id' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: author_id must be text NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='author_display_name' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: author_display_name must be text NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='is_deleted' AND data_type='boolean' AND udt_name='bool' AND is_nullable='NO' AND column_default IN ('false','FALSE')) THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: is_deleted must be boolean NOT NULL DEFAULT false';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='payload' AND data_type='jsonb' AND udt_name='jsonb' AND is_nullable='NO' AND column_default = '''{}''::jsonb') THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: payload must be jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;

  -- ── Exact canonical PRIMARY KEY = [id] (catalog array comparison) ────────────
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';
  IF v_pk_cols IS DISTINCT FROM ARRAY['id']::text[] THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: canonical PRIMARY KEY must be exactly [id], got %', v_pk_cols;
  END IF;

  -- ── Exact allowed constraint set: 1 PK + 2 FK + 2 CHECK = 5, nothing else ────
  SELECT count(*) INTO v_all_con FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass;
  IF v_all_con <> 5 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: reconciled constraint set must be exactly 5 (1 PK + 2 FK + 2 CHECK), got %', v_all_con;
  END IF;
  -- Reject any UNIQUE (u) / EXCLUDE (x) / other constraint type.
  SELECT count(*) INTO v_check_con FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype NOT IN ('p','f','c');
  IF v_check_con <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: unexpected UNIQUE/EXCLUDE constraint(s) present (count=%)', v_check_con;
  END IF;
  SELECT count(*) INTO v_fk_total FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='f';
  IF v_fk_total <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: expected exactly 2 FKs, got %', v_fk_total;
  END IF;

  -- Legacy tree FK: tree_id -> public.trees(id) ON DELETE CASCADE (exact catalog).
  SELECT count(*) INTO v_fk_tree
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f'
    AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1
    AND a.attname='tree_id' AND c.confrelid='public.trees'::regclass AND fa.attname='id'
    AND c.confdeltype='c';
  IF v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: legacy tree FK tree_id -> public.trees(id) ON DELETE CASCADE not exact (matches=%)', v_fk_tree;
  END IF;
  -- Legacy author FK: author_id -> public.users(id) ON DELETE SET NULL (exact catalog).
  SELECT count(*) INTO v_fk_author
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f'
    AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1
    AND a.attname='author_id' AND c.confrelid='public.users'::regclass AND fa.attname='id'
    AND c.confdeltype='n';
  IF v_fk_author <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: legacy author FK author_id -> public.users(id) ON DELETE SET NULL not exact (matches=%)', v_fk_author;
  END IF;

  -- Canonical CHECK constraints must both be present (exact normalized expression).
  SELECT count(*) INTO v_chk_kind FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND _lb_norm_check(pg_get_constraintdef(oid)) = 'target_kind = ''tree''';
  SELECT count(*) INTO v_chk_tid FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND _lb_norm_check(pg_get_constraintdef(oid)) = 'target_id is null or target_id = tree_id';
  IF v_chk_kind <> 1 OR v_chk_tid <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: canonical CHECK constraints missing or incorrect (kind=% tid=%)', v_chk_kind, v_chk_tid;
  END IF;

  -- ── No unexpected inbound foreign keys referencing tree_comments ────────────
  SELECT count(*) INTO v_inbound_fk
  FROM pg_constraint WHERE contype='f' AND confrelid='public.tree_comments'::regclass;
  IF v_inbound_fk <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: unexpected inbound FK(s) reference tree_comments (count=%)', v_inbound_fk;
  END IF;

  -- ── Exact index inventory (corrected: zero-secondary-index legacy state) ──
  -- The corrected migration creates ONLY three canonical secondary indexes and NO
  -- compound (tree_id, created_at) index. The rolledback state therefore has exactly
  -- 3 secondary indexes + the canonical PK backing (id) = 4 total. The legacy PK
  -- (tree_id, id) is restored separately by the apply phase below; its backing index
  -- is the legacy PK backing index, not the canonical [id] one. Rollback preflight
  -- expects the EXACT canonical reconciled index set: PK (id) + 3 canonical secondary,
  -- compound = 0, unexpected = 0.
  SELECT count(*) INTO v_idx_secondary
  FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary;
  IF v_idx_secondary <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: expected exactly 3 secondary indexes (canonical, no compound) (got %)', v_idx_secondary;
  END IF;

  SELECT count(*) INTO v_idx_pk FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND i.indisprimary;
  IF v_idx_pk <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: canonical PK backing index (id) not found (count=%)', v_idx_pk;
  END IF;

  SELECT count(*) INTO v_idx_tree FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_tree_id' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id']::text[];
  SELECT count(*) INTO v_idx_owner FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_owner_id' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['owner_id']::text[];
  SELECT count(*) INTO v_idx_created FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_created_at' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['created_at']::text[];
  IF v_idx_tree <> 1 OR v_idx_owner <> 1 OR v_idx_created <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: migration-added indexes missing (tree=% owner=% created=%)', v_idx_tree, v_idx_owner, v_idx_created;
  END IF;

  SELECT count(*) INTO v_idx_unexpected
  FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname NOT IN ('idx_tree_comments_tree_id','idx_tree_comments_owner_id','idx_tree_comments_created_at');
  IF v_idx_unexpected <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: unexpected index(es) present before rollback (count=%)', v_idx_unexpected;
  END IF;

  -- ── No risky dependent objects (triggers / RLS / views / matviews) ──────────
  SELECT count(*) INTO v_trig FROM pg_trigger WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;
  IF v_trig <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: unexpected triggers present on tree_comments (count=%)', v_trig;
  END IF;
  SELECT count(*) INTO v_rls FROM pg_class WHERE oid='public.tree_comments'::regclass AND relrowsecurity;
  IF v_rls <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: RLS enabled on tree_comments';
  END IF;
  SELECT count(*) INTO v_views FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='v';
  SELECT count(*) INTO v_matviews FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='m';
  IF v_views <> 0 OR v_matviews <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK PRECONDITION FAIL: dependent view/materialized view references tree_comments (v=% m=%)', v_views, v_matviews;
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
  v_pk_cols text[];
BEGIN
  SELECT conname INTO v_pkid
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='p';

  IF v_pkid IS NULL THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: no PRIMARY KEY found on tree_comments';
  END IF;

  -- Confirm the canonical PK is EXACTLY [id] via catalog arrays before touching it.
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';

  IF v_pk_cols IS DISTINCT FROM ARRAY['id']::text[] THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: canonical PK is not exactly [id]: %', v_pk_cols;
  END IF;

  EXECUTE format('ALTER TABLE public.tree_comments DROP CONSTRAINT %I', v_pkid);
END $$;

-- Restore legacy composite PRIMARY KEY (tree_id, id). This reuses the legacy
-- definition captured at migration time; the migration preserved the original PK.
ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_pkey PRIMARY KEY (tree_id, id);

-- 3. Remove the three migration-added indexes (schema-qualified so a
-- same-named index in another schema is never targeted by mistake).
DROP INDEX IF EXISTS public.idx_tree_comments_tree_id;
DROP INDEX IF EXISTS public.idx_tree_comments_owner_id;
DROP INDEX IF EXISTS public.idx_tree_comments_created_at;
-- The corrected migration creates NO compound (tree_id, created_at) index, so
-- there is nothing compound to preserve or drop. Rollback restores the exact
-- legacy zero-secondary-index state.

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
  v_legacy_markers integer;
  v_canon_extra integer;
  v_rows bigint;
  v_pk_cols text[];
  v_all_con integer;
  v_bad_con integer;
  v_fk_total integer;
  v_fk_author integer;
  v_fk_tree integer;
  v_chk_any integer;
  v_idx_tree integer;
  v_idx_owner integer;
  v_idx_created integer;
  v_idx_pk integer;
  v_idx_secondary integer;
  v_idx_unexpected integer;
  v_trig integer;
  v_rls integer;
  v_views integer;
  v_matviews integer;
BEGIN
  -- ── Exactly 8 columns remain = 8 legacy markers, 0 canonical-only. ──────────
  SELECT count(*) INTO v_cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments';
  SELECT count(*) INTO v_legacy_markers FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload');
  SELECT count(*) INTO v_canon_extra FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('owner_id','body','target_kind','target_id');
  IF v_cols <> 8 OR v_legacy_markers <> 8 OR v_canon_extra <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: not exact legacy 8-column shape (total=%, legacy_markers=%, canonical_only=%)',
      v_cols, v_legacy_markers, v_canon_extra;
  END IF;

  -- ── Exact legacy column metadata (type / udt / nullable / default) ──────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: id must be text NOT NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='tree_id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: tree_id must be text NOT NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='author_id' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: author_id must be text NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='author_display_name' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: author_display_name must be text NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='is_deleted' AND data_type='boolean' AND udt_name='bool' AND is_nullable='NO' AND column_default IN ('false','FALSE')) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: is_deleted must be boolean NOT NULL DEFAULT false';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='created_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: created_at must be timestamptz NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='updated_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz' AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: updated_at must be timestamptz NULL with no default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name='payload' AND data_type='jsonb' AND udt_name='jsonb' AND is_nullable='NO' AND column_default = '''{}''::jsonb') THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: payload must be jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;

  -- ── Legacy composite PRIMARY KEY exactly [tree_id, id] (catalog array). ──────
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';
  IF v_pk_cols IS DISTINCT FROM ARRAY['tree_id','id']::text[] THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: legacy PRIMARY KEY must be exactly [tree_id, id], got %', v_pk_cols;
  END IF;

  -- ── Exact allowed constraint set: 1 PK + 2 FK = 3, no CHECK/UNIQUE/EXCLUDE. ──
  SELECT count(*) INTO v_all_con FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass;
  IF v_all_con <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: legacy constraint set must be exactly 3 (1 PK + 2 FK), got %', v_all_con;
  END IF;
  -- Migration-added CHECK constraints must be gone; no unexpected UNIQUE/EXCLUDE.
  SELECT count(*) INTO v_bad_con FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype NOT IN ('p','f');
  IF v_bad_con <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: migration-added CHECK / unexpected constraint(s) still present (count=%)', v_bad_con;
  END IF;
  SELECT count(*) INTO v_chk_any FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c';
  IF v_chk_any <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: canonical CHECK constraints not removed (count=%)', v_chk_any;
  END IF;
  SELECT count(*) INTO v_fk_total FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='f';
  IF v_fk_total <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: expected exactly 2 legacy FKs, got %', v_fk_total;
  END IF;

  -- ── Legacy FKs preserved exactly (catalog conkey/confkey/confrelid/confdeltype)
  SELECT count(*) INTO v_fk_author
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f'
    AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1
    AND a.attname='author_id' AND c.confrelid='public.users'::regclass AND fa.attname='id'
    AND c.confdeltype='n';
  SELECT count(*) INTO v_fk_tree
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f'
    AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1
    AND a.attname='tree_id' AND c.confrelid='public.trees'::regclass AND fa.attname='id'
    AND c.confdeltype='c';
  IF v_fk_author <> 1 OR v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: legacy FKs not preserved exactly (author=% tree=%)', v_fk_author, v_fk_tree;
  END IF;

  -- ── No unexpected inbound FK referencing tree_comments. ─────────────────────
  SELECT count(*) INTO v_all_con FROM pg_constraint WHERE contype='f' AND confrelid='public.tree_comments'::regclass;
  IF v_all_con <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: unexpected inbound FK(s) reference tree_comments (count=%)', v_all_con;
  END IF;

  -- ── Exact final legacy index inventory ──────────────────────────────────
  -- After dropping the 3 migration-added indexes, the table returns to the exact
  -- legacy zero-secondary-index state: only the legacy PK backing index
  -- (tree_id, id) remains. No compound (tree_id, created_at), no single-column
  -- tree_id / owner_id / created_at index, and no unexpected index. The compound
  -- is verified for exact ordered columns, non-unique, non-partial, non-expression
  -- and no INCLUDE columns and MUST be absent (count = 0).
  SELECT count(*) INTO v_idx_secondary
  FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary;
  IF v_idx_secondary <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: expected exactly 0 secondary indexes after rollback (got %)', v_idx_secondary;
  END IF;

  SELECT count(*) INTO v_idx_pk FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND i.indisprimary;
  SELECT count(*) INTO v_idx_tree FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_tree_id';
  SELECT count(*) INTO v_idx_owner FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_owner_id';
  SELECT count(*) INTO v_idx_created FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_created_at';
  IF v_idx_pk <> 1 OR v_idx_tree <> 0 OR v_idx_owner <> 0 OR v_idx_created <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: final index inventory wrong (pk=% tree=% owner=% created=%)',
      v_idx_pk, v_idx_tree, v_idx_owner, v_idx_created;
  END IF;

  SELECT count(*) INTO v_idx_unexpected
  FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary;
  IF v_idx_unexpected <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: unexpected index(es) after rollback (count=%)', v_idx_unexpected;
  END IF;

  -- ── Row count still 0. ──────────────────────────────────────────────────────
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: row count=% after rollback (expected 0)', v_rows;
  END IF;

  -- ── No risky dependent objects (triggers / RLS / views / matviews). ─────────
  SELECT count(*) INTO v_trig FROM pg_trigger WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;
  SELECT count(*) INTO v_rls FROM pg_class WHERE oid='public.tree_comments'::regclass AND relrowsecurity;
  SELECT count(*) INTO v_views FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='v';
  SELECT count(*) INTO v_matviews FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='m';
  IF v_trig <> 0 OR v_rls <> 0 OR v_views <> 0 OR v_matviews <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK POST-VERIFY FAIL: unexpected trigger/RLS/dependent view/materialized view appeared after rollback';
  END IF;
END $$;

-- Drop the normalizer (created inside this transaction; auto-removed on COMMIT on success, never persisted on transaction abort).
DROP FUNCTION IF EXISTS _lb_norm_default(text);
DROP FUNCTION IF EXISTS _lb_norm_check(text);

COMMIT;
