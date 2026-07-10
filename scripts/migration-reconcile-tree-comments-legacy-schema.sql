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
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/migration-reconcile-tree-comments-legacy-schema.sql
--
-- The `-v ON_ERROR_STOP=1` flag is REQUIRED so that a SQL error aborts psql with a
-- non-zero exit immediately. The whole script is wrapped in a single transaction
-- (BEGIN ... COMMIT), so psql aborting on error rolls the transaction back. Without
-- this flag psql would keep processing subsequent statements and could finish with a
-- zero exit, misreporting failure as success. On command failure the rollback script
-- is NOT run automatically; first confirm the transaction was rolled back, then run
-- scripts/rollback-tree-comments-legacy-reconcile.sql only as a separate approved step.
--
-- This file is schema-foundation only. It does NOT enable the writer/route/UI,
-- does NOT modify runtime source, and must not be auto-applied.

BEGIN;

-- Defensive session guards for an online migration.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Take a brief, bounded table lock so the shape cannot change under us mid-migration.
LOCK TABLE public.tree_comments IN SHARE ROW EXCLUSIVE MODE;

-- ── Purpose-specific normalizers (top-level, dropped before COMMIT) ──
-- A single shared normalizer for both DEFAULTs and CHECKs produced wrong
-- results on canonical catalog expressions (e.g. it stripped the trailing ')'
-- of now(), and kept the surrounding quotes of a string-literal default). The
-- two helpers below are purpose-specific and MUST stay in sync between the
-- migration and the rollback script so both accept the exact same reconciled
-- schema form.
--
-- Schema qualification policy: both helpers are created UNQUALIFIED in the
-- public (default) schema, inside the migration transaction, used only by the
-- validator / post-verification / preflight in this same file, and dropped
-- before COMMIT. They are dropped on transaction abort too, so they never
-- persist on the database. Names are prefixed with `_lb_` to avoid collision
-- with application functions.

-- _lb_norm_default: normalizes a column DEFAULT expression for EXACT comparison.
--   'tree'::character varying  -> tree      (string-literal quotes stripped)
--   now()                      -> now()     (function-call parens preserved)
-- It strips deterministic casts, collapses whitespace, and removes the
-- surrounding quotes of a string-literal default. It NEVER strips parentheses
-- from a function call, so now() keeps its trailing ().
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

-- _lb_norm_check: normalizes a CHECK constraint definition (from
-- pg_get_constraintdef) for EXACT comparison.
--   CHECK (((target_kind)::text = 'tree'::text))            -> target_kind = 'tree'
--   CHECK (((target_id IS NULL) OR (target_id = tree_id)))  -> target_id is null or target_id = tree_id
-- It strips the CHECK wrapper, deterministic casts, whitespace, and redundant
-- parentheses (outer wrapping + inner grouping around identifiers / simple
-- predicates), while preserving string-literal quotes, operators, OR/AND order,
-- and compared identifiers. A paren pair is only treated as redundant grouping
-- when its boundaries are neutral (start/space/(/comma) and its inner content
-- has no top-level OR/AND, so `(a OR b) AND c` is NOT flattened.
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
  -- Iteratively remove redundant parentheses.
  WHILE changed LOOP
    changed := false;
    n := length(v);
    -- 1. Outer wrap: first '(' matches the last character (whole-expr grouping).
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
    -- 2. Inner redundant paren pair (grouping around an atom / simple predicate).
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

-- ── Exact reconciled-state validator (top-level, dropped before COMMIT) ──
-- OUT ok = 1 when the table EXACTLY matches the canonical reconciled shape
-- (12 columns + exact metadata, PK [id], 2 FKs, 2 CHECKs, exact index
-- inventory, no risky deps); otherwise ok = 0 and msg carries the detail.
-- Used by the preflight (BEFORE the explicit STOP) and by post-verification.
CREATE FUNCTION _lb_reconciled_validator(OUT ok integer, OUT msg text)
RETURNS record AS $$
DECLARE
  v_c integer; v_pk_arr text[]; v_f1 integer; v_f2 integer;
  v_c_kind integer; v_c_tid integer;
  v_total_con integer; v_u integer; v_x integer; v_other integer;
  v_i1 integer; v_is integer; v_i2 integer; v_i3 integer; v_i4 integer; v_i5 integer; v_iu integer;
  v_t integer; v_r integer; v_v integer; v_mv integer;
  v_inbound integer;
  v_trees_id_type text; v_trees_id_udt text; v_trees_id_null text;
  v_m text := '';
BEGIN
  ok := 1; msg := '';

  -- Exact 12 columns present (8 legacy markers + 4 canonical-only).
  SELECT count(*) INTO v_c FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload','owner_id','body','target_kind','target_id');
  IF v_c <> 12 THEN ok := 0; v_m := v_m || 'cols=' || v_c || '; '; END IF;

  -- Exact column metadata for ALL 12 columns.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'id; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='tree_id' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'tree_id; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id' AND data_type='character varying' AND udt_name='varchar' AND character_maximum_length=128 AND is_nullable='NO' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'owner_id; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body' AND data_type='text' AND udt_name='text' AND is_nullable='NO' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'body; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind' AND data_type='character varying' AND udt_name='varchar' AND character_maximum_length=16 AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'tree') THEN ok := 0; v_m := v_m || 'target_kind; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_id' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'target_id; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='author_id' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'author_id; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='author_display_name' AND data_type='text' AND udt_name='text' AND is_nullable='YES' AND column_default IS NULL) THEN ok := 0; v_m := v_m || 'author_display_name; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='is_deleted' AND data_type='boolean' AND udt_name='bool' AND is_nullable='NO' AND column_default IN ('false','FALSE')) THEN ok := 0; v_m := v_m || 'is_deleted; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz' AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN ok := 0; v_m := v_m || 'created_at; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz' AND is_nullable='NO' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN ok := 0; v_m := v_m || 'updated_at; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='payload' AND data_type='jsonb' AND udt_name='jsonb' AND is_nullable='NO' AND column_default = '''{}''::jsonb') THEN ok := 0; v_m := v_m || 'payload; '; END IF;

  -- PRIMARY KEY exactly [id].
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO v_pk_arr
  FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';
  IF v_pk_arr IS DISTINCT FROM ARRAY['id']::text[] THEN ok := 0; v_m := v_m || 'pk=' || COALESCE(v_pk_arr::text,'null') || '; '; END IF;

  -- Exactly 2 outbound FKs (exact catalog match).
  SELECT count(*) INTO v_f1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] JOIN pg_attribute fa ON fa.attrelid=c.confrelid AND fa.attnum=c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f' AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1 AND a.attname='tree_id' AND c.confrelid='public.trees'::regclass AND fa.attname='id' AND c.confdeltype='c';
  SELECT count(*) INTO v_f2 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] JOIN pg_attribute fa ON fa.attrelid=c.confrelid AND fa.attnum=c.confkey[1]
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='f' AND array_length(c.conkey,1)=1 AND array_length(c.confkey,1)=1 AND a.attname='author_id' AND c.confrelid='public.users'::regclass AND fa.attname='id' AND c.confdeltype='n';
  IF v_f1 <> 1 OR v_f2 <> 1 THEN ok := 0; v_m := v_m || 'fk=' || v_f1 || '/' || v_f2 || '; '; END IF;

  -- Exact CHECK definitions via normalized full-expression comparison (no substring).
  -- Only these two exact expressions are allowed; anything with extra conjuncts /
  -- disjuncts / different terms fails to match exactly.
  SELECT count(*) INTO v_c_kind FROM pg_constraint c
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='c'
    AND _lb_norm_check(pg_get_constraintdef(c.oid)) = 'target_kind = ''tree''';
  SELECT count(*) INTO v_c_tid FROM pg_constraint c
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='c'
    AND _lb_norm_check(pg_get_constraintdef(c.oid)) = 'target_id is null or target_id = tree_id';
  IF v_c_kind <> 1 OR v_c_tid <> 1 THEN ok := 0; v_m := v_m || 'checks; '; END IF;

  -- Exact TOTAL constraint set = 5 (1 PK + 2 FK + 2 CHECK, 0 UNIQUE/EXCLUDE/other).
  SELECT count(*) INTO v_total_con FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass;
  SELECT count(*) INTO v_u FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='u';
  SELECT count(*) INTO v_x FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='x';
  SELECT count(*) INTO v_other FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype NOT IN ('p','f','c','u','x');
  IF v_total_con <> 5 OR v_u <> 0 OR v_x <> 0 OR v_other <> 0 THEN ok := 0; v_m := v_m || 'constraints=' || v_total_con || '; '; END IF;

  -- No unexpected inbound FK referencing tree_comments.
  SELECT count(*) INTO v_inbound FROM pg_constraint c WHERE c.contype='f' AND c.confrelid='public.tree_comments'::regclass;
  IF v_inbound <> 0 THEN ok := 0; v_m := v_m || 'inbound_fk=' || v_inbound || '; '; END IF;

  -- Runtime parent-key guard: public.trees.id must be text/text/NO (STOP path must see this).
  SELECT data_type, udt_name, is_nullable INTO v_trees_id_type, v_trees_id_udt, v_trees_id_null
  FROM information_schema.columns WHERE table_schema='public' AND table_name='trees' AND column_name='id';
  IF v_trees_id_type IS NULL OR v_trees_id_type <> 'text' OR v_trees_id_udt <> 'text' OR v_trees_id_null <> 'NO' THEN
    ok := 0; v_m := v_m || 'trees.id; ';
  END IF;

  -- Exact index inventory: total 5 (1 primary + 4 secondary). Each secondary is
  -- verified by ordered key array + uniqueness + non-partial + non-expression +
  -- no INCLUDE columns (indnkeyatts = indnatts); migration-added indexes by exact name.
  SELECT count(*) INTO v_i1 FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND i.indisprimary;
  SELECT count(*) INTO v_is FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary;
  SELECT count(*) INTO v_i2 FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND i.indnatts=2 AND i.indnkeyatts=2 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id','created_at']::text[];
  SELECT count(*) INTO v_i3 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_tree_id' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id']::text[];
  SELECT count(*) INTO v_i4 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_owner_id' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['owner_id']::text[];
  SELECT count(*) INTO v_i5 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND c.relname='idx_tree_comments_created_at' AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['created_at']::text[];
  -- Unexpected secondary: not the compound match and not one of the 3 migration-added exact names.
  SELECT count(*) INTO v_iu FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND NOT (i.indnatts=2 AND i.indnkeyatts=2 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id','created_at']::text[])
    AND c.relname NOT IN ('idx_tree_comments_tree_id','idx_tree_comments_owner_id','idx_tree_comments_created_at');
  IF v_i1 <> 1 OR v_is <> 4 OR v_i2 <> 1 OR v_i3 <> 1 OR v_i4 <> 1 OR v_i5 <> 1 OR v_iu <> 0 THEN
    ok := 0; v_m := v_m || 'idx=' || v_i1||'/'||v_is||'/'||v_i2||'/'||v_i3||'/'||v_i4||'/'||v_i5||'/'||v_iu || '; ';
  END IF;

  -- No risky dependent objects (trigger / RLS / view / matview).
  SELECT count(*) INTO v_t FROM pg_trigger WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;
  SELECT count(*) INTO v_r FROM pg_class WHERE oid='public.tree_comments'::regclass AND relrowsecurity;
  SELECT count(*) INTO v_v FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='v';
  SELECT count(*) INTO v_mv FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='m';
  IF v_t <> 0 OR v_r <> 0 OR v_v <> 0 OR v_mv <> 0 THEN ok := 0; v_m := v_m || 'deps; '; END IF;

  msg := v_m;
END;
$$ LANGUAGE plpgsql;

-- ─── Preflight assertions (fail/stop closed on any mismatch) ─────────────────

DO $$
DECLARE
  v_exists integer;
  v_total_cols integer;
  v_legacy_markers integer;   -- how many of the 8 legacy columns are present
  v_canon_extra integer;      -- how many of the 4 canonical-only columns are present
  v_rows  bigint;
  v_trees_id_type text;
  v_trees_id_udt text;
  v_trees_id_null text;
  v_id_type text;
  v_id_udt text;
  v_id_null text;
  v_id_def text;
  v_tree_id_type text;
  v_tree_id_udt text;
  v_tree_id_null text;
  v_tree_id_def text;
  v_inbound_fk integer;
  v_all_con integer;
  v_bad_con integer;
  v_fk_total integer;
  v_fk_tree integer;
  v_fk_author integer;
  v_pk_cols text[];
  v_pk_idx text;
  v_idx_compound integer;
  v_idx_single_tree integer;
  v_secondary_total integer;
  v_reconciled_ok integer;
  v_rc integer;
  v_matviews integer;
  v_msg text;
BEGIN
  -- ── Step 1: Table existence ────────────────────────────────────────────────
  SELECT count(*) INTO v_exists
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tree_comments';
  IF v_exists <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments table existence=% (expected 1)', v_exists;
  END IF;

  -- ── Step 2: Collect full column metadata (counts before any enforcement) ────
  SELECT count(*) INTO v_total_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tree_comments';

  -- Legacy marker columns present (the exact legacy 8-column set).
  SELECT count(*) INTO v_legacy_markers
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('id','tree_id','author_id','author_display_name','is_deleted','created_at','updated_at','payload');

  -- Canonical-only columns present (the 4 columns the reconciliation adds).
  SELECT count(*) INTO v_canon_extra
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments'
    AND column_name IN ('owner_id','body','target_kind','target_id');

  -- ── Step 3: State classifier (exclusive legacy / reconciled / partial) ──────
  -- This runs BEFORE any legacy-only count enforcement so a reconciled 12-column
  -- table reaches the explicit STOP branch instead of a spurious count failure.
  --
  --   * RECONCILED : exactly 12 columns = 8 legacy markers + 4 canonical-only.
  --   * LEGACY     : exactly 8 columns  = 8 legacy markers + 0 canonical-only.
  --   * otherwise  : partial / unexpected schema => fail closed.

  IF v_total_cols = 12 AND v_legacy_markers = 8 AND v_canon_extra = 4 THEN
    -- candidate_reconciled: run the FULL exact canonical validation BEFORE the STOP.
    -- If it matches exactly -> explicit STOP (no mutation). If it diverges
    -- (a malformed 12-column table) -> fail closed with the divergence detail.
    SELECT ok, msg INTO v_reconciled_ok, v_msg FROM _lb_reconciled_validator();
    IF v_reconciled_ok = 1 THEN
      RAISE EXCEPTION 'PREFLIGHT STOP: tree_comments already reconciled';
    ELSE
      RAISE EXCEPTION 'PREFLIGHT FAIL: 12-column schema is not exact reconciled state (%', v_msg;
    END IF;
  ELSIF v_total_cols = 8 AND v_legacy_markers = 8 AND v_canon_extra = 0 THEN
    -- Exact legacy 8-column shape: fall through to detailed legacy assertions.
    NULL;
  ELSE
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments is neither exact legacy (8-col) nor reconciled (12-col) shape (total=%, legacy_markers=%, canonical_only=%)',
      v_total_cols, v_legacy_markers, v_canon_extra;
  END IF;

  -- ── Step 4: Exact legacy column metadata (type / udt / nullable / default) ──
  -- id: text / text / NO / default NULL
  SELECT data_type, udt_name, is_nullable, column_default INTO v_id_type, v_id_udt, v_id_null, v_id_def
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='id';
  IF v_id_type <> 'text' OR v_id_udt <> 'text' OR v_id_null <> 'NO' OR v_id_def IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: id expected text/text NOT NULL with no default, got %/%/% default=%', v_id_type, v_id_udt, v_id_null, v_id_def;
  END IF;

  -- tree_id: text / text / NO / default NULL
  SELECT data_type, udt_name, is_nullable, column_default INTO v_tree_id_type, v_tree_id_udt, v_tree_id_null, v_tree_id_def
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tree_comments' AND column_name='tree_id';
  IF v_tree_id_type <> 'text' OR v_tree_id_udt <> 'text' OR v_tree_id_null <> 'NO' OR v_tree_id_def IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_id expected text/text NOT NULL with no default, got %/%/% default=%', v_tree_id_type, v_tree_id_udt, v_tree_id_null, v_tree_id_def;
  END IF;

  -- author_id: text / text / YES / default NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='author_id' AND data_type='text' AND udt_name='text'
      AND is_nullable='YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: author_id expected text NULL with no default';
  END IF;

  -- author_display_name: text / text / YES / default NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='author_display_name' AND data_type='text' AND udt_name='text'
      AND is_nullable='YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: author_display_name expected text NULL with no default';
  END IF;

  -- is_deleted: boolean / bool / NO / default false
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='is_deleted' AND data_type='boolean' AND udt_name='bool'
      AND is_nullable='NO' AND column_default IN ('false', 'FALSE')
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: is_deleted expected boolean NOT NULL DEFAULT false';
  END IF;

  -- created_at: timestamptz / timestamptz / YES / default NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='created_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz'
      AND is_nullable='YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: created_at expected timestamptz NULL with no default';
  END IF;

  -- updated_at: timestamptz / timestamptz / YES / default NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='updated_at' AND data_type='timestamp with time zone' AND udt_name='timestamptz'
      AND is_nullable='YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: updated_at expected timestamptz NULL with no default';
  END IF;

  -- payload: jsonb / jsonb / NO / default '{}'::jsonb
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tree_comments'
      AND column_name='payload' AND data_type='jsonb' AND udt_name='jsonb'
      AND is_nullable='NO' AND column_default = '''{}''::jsonb'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: payload expected jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;

  -- ── Step 5: Runtime assertion that public.trees.id is text ──────────────────
  -- FK compatibility (tree_id -> trees(id)) and the TEXT key-type correction both
  -- depend on the live production type of trees.id, so assert it directly.
  SELECT data_type, udt_name, is_nullable INTO v_trees_id_type, v_trees_id_udt, v_trees_id_null
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'id';
  IF v_trees_id_type IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.trees.id must be text (column not found)';
  END IF;
  IF v_trees_id_type <> 'text' OR v_trees_id_udt <> 'text' OR v_trees_id_null <> 'NO' THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.trees.id must be text (got %/%/%)', v_trees_id_type, v_trees_id_udt, v_trees_id_null;
  END IF;

  -- ── Step 6: Exact legacy PRIMARY KEY = [tree_id, id] via catalog arrays ──────
  -- Build the ordered PK column-name array from pg_constraint.conkey / pg_attribute.attnum.
  -- String matching (ILIKE '%tree_id%id%') is intentionally NOT used: it would accept
  -- (tree_id, author_id), (id, tree_id), (tree_id, id, author_id), wrong order, etc.
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid = 'public.tree_comments'::regclass AND c.contype = 'p';
  IF v_pk_cols IS DISTINCT FROM ARRAY['tree_id','id']::text[] THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy PRIMARY KEY must be exactly [tree_id, id], got %', v_pk_cols;
  END IF;

  -- ── Step 7: Exact allowed constraint set (1 PK + 2 FK, nothing else) ────────
  SELECT count(*) INTO v_all_con
  FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass;
  IF v_all_con <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy constraint set must be exactly 3 (1 PK + 2 FK), got %', v_all_con;
  END IF;
  -- Reject any UNIQUE (u) / CHECK (c) / EXCLUDE (x) / other constraint type.
  SELECT count(*) INTO v_bad_con
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype NOT IN ('p','f');
  IF v_bad_con <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected UNIQUE/CHECK/EXCLUDE constraint(s) present (count=%)', v_bad_con;
  END IF;
  -- Exactly 2 outbound FKs.
  SELECT count(*) INTO v_fk_total
  FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass AND contype='f';
  IF v_fk_total <> 2 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: expected exactly 2 legacy FKs, got %', v_fk_total;
  END IF;

  -- ── Step 8: Exact legacy FK verification via conkey/confkey/confrelid/confdeltype
  -- tree_id -> public.trees(id) ON DELETE CASCADE (confdeltype='c')
  SELECT count(*) INTO v_fk_tree
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = 'public.tree_comments'::regclass
    AND c.contype = 'f'
    AND array_length(c.conkey, 1) = 1
    AND array_length(c.confkey, 1) = 1
    AND a.attname = 'tree_id'
    AND c.confrelid = 'public.trees'::regclass
    AND fa.attname = 'id'
    AND c.confdeltype = 'c';
  IF v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: FK tree_id -> public.trees(id) ON DELETE CASCADE not found/exact (matches=%)', v_fk_tree;
  END IF;

  -- author_id -> public.users(id) ON DELETE SET NULL (confdeltype='n')
  SELECT count(*) INTO v_fk_author
  FROM pg_constraint c
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = 'public.tree_comments'::regclass
    AND c.contype = 'f'
    AND array_length(c.conkey, 1) = 1
    AND array_length(c.confkey, 1) = 1
    AND a.attname = 'author_id'
    AND c.confrelid = 'public.users'::regclass
    AND fa.attname = 'id'
    AND c.confdeltype = 'n';
  IF v_fk_author <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: FK author_id -> public.users(id) ON DELETE SET NULL not found/exact (matches=%)', v_fk_author;
  END IF;

  -- ── Step 9: No unexpected inbound foreign keys referencing tree_comments ─────
  SELECT count(*) INTO v_inbound_fk
  FROM pg_constraint c
  WHERE c.contype='f' AND c.confrelid='public.tree_comments'::regclass;
  IF v_inbound_fk <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected inbound FK(s) reference tree_comments (count=%)', v_inbound_fk;
  END IF;

  -- ── Step 10: Zero-row guard (no data to migrate, no DELETE needed) ──────────
  SELECT count(*) INTO v_rows FROM public.tree_comments;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: tree_comments row_count=% (expected 0); abort to avoid destructive copy', v_rows;
  END IF;

  -- ── Step 11: Exact legacy index inventory (audited production state) ──────────
  -- Confirmed production legacy index set is EXACTLY ONE secondary index:
  --   * compound (tree_id, created_at)  -- the legacy list-read index
  -- There is NO single-column idx_tree_comments_tree_id in the legacy state; that
  -- index is CREATED by this migration (canonical). The PK (tree_id, id) has its
  -- own backing index but is exercised via the PK constraint, not counted here.
  --
  -- Enforced per-index (NOT a global uncorrelated NOT EXISTS, which would hide an
  -- unexpected index whenever the compound index exists): the total secondary count
  -- must be exactly 1 AND the compound match must be exactly 1 simultaneously.
  SELECT count(*) INTO v_secondary_total
  FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary;
  IF v_secondary_total <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy secondary index count must be exactly 1 (got %)', v_secondary_total;
  END IF;

  SELECT count(*) INTO v_idx_compound
  FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND i.indnatts=2 AND i.indnkeyatts=2 AND i.indnkeyatts = i.indnatts AND NOT i.indisunique
    AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id','created_at']::text[];
  IF v_idx_compound <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: legacy compound index (tree_id, created_at) not found exactly (count=%)', v_idx_compound;
  END IF;

  -- Defense in depth: a single-column tree_id index must NOT exist in the legacy
  -- state (it is migration-added). If present, the total secondary count above is
  -- already > 1; this is an explicit secondary guard that also rejects partial /
  -- expression / unique / INCLUDE / differently-named secondary indexes.
  SELECT count(*) INTO v_idx_single_tree
  FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND (i.indnatts=1
      AND (SELECT array_agg(a.attname::text ORDER BY ord)
          FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id']::text[]
      OR i.indpred IS NOT NULL
      OR i.indexprs IS NOT NULL
      OR i.indnkeyatts <> i.indnatts
      OR i.indisunique);
  IF v_idx_single_tree <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected legacy secondary index present (single-column tree_id / partial / expression / unique / INCLUDE)';
  END IF;

  -- ── Step 12: No risky dependent objects (triggers / RLS / views / matviews) ──
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
  SELECT count(*) INTO v_matviews
  FROM pg_class c
  JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid
  WHERE c.relkind='m';
  IF v_matviews <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: dependent materialized views reference tree_comments (count=%)', v_matviews;
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
  v_pk_cols text[];
BEGIN
  SELECT conname INTO v_pkid
  FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='p';

  IF v_pkid IS NULL THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: no PRIMARY KEY found on tree_comments';
  END IF;

  -- Confirm the legacy PK is EXACTLY [tree_id, id] via catalog arrays before touching it.
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';

  IF v_pk_cols IS DISTINCT FROM ARRAY['tree_id','id']::text[] THEN
    RAISE EXCEPTION 'PK LOOKUP FAIL: legacy PK is not exactly [tree_id, id]: %', v_pk_cols;
  END IF;

  EXECUTE format('ALTER TABLE public.tree_comments DROP CONSTRAINT %I', v_pkid);
END $$;

ALTER TABLE public.tree_comments
  ADD CONSTRAINT tree_comments_pkey PRIMARY KEY (id);

-- ─── Indexes (mirror canonical migration) ──────────────────────────────────
-- The legacy compound (tree_id, created_at) list-read index already exists
-- (audited production state) and is PRESERVED. This migration adds three
-- canonical read indexes; all are created idempotently. If a same-named
-- index already exists with a WRONG definition, the post-verify below will
-- fail closed and roll back the whole transaction.
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
  v_pk_cols text[];
  v_fk_tree integer;
  v_chk_kind integer;
  v_chk_tid integer;
  v_idx_tree integer;
  v_idx_owner integer;
  v_idx_created integer;
  v_idx_pk integer;
  v_idx_compound integer;
  v_legacy_author integer;
  v_legacy_payload integer;
  v_legacy_deleted integer;
  v_rows bigint;
  v_trig integer;
  v_rls integer;
  v_views integer;
  v_matviews integer;
  v_sentinel integer;
  v_reconciled_ok integer;
  v_msg text;
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

  -- Types / nullability / defaults (exact normalized comparison via _lb_norm_default / _lb_norm_check)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='owner_id' AND data_type='character varying' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: owner_id must be varchar(128) NOT NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='body' AND data_type='text' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: body must be text NOT NULL';
  END IF;
  -- target_kind default: exact 'tree' (normalized)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='target_kind' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'tree') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: target_kind default must be exactly ''tree''';
  END IF;
  -- created_at / updated_at defaults: exact 'now()' (normalized)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='created_at' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: created_at default must be exactly now()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tree_comments' AND column_name='updated_at' AND column_default IS NOT NULL AND _lb_norm_default(column_default) = 'now()') THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: updated_at default must be exactly now()';
  END IF;

  -- PRIMARY KEY must be exactly [id] (catalog array comparison, not string match)
  SELECT array_agg(a.attname::text ORDER BY k.ord)
  INTO v_pk_cols
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid='public.tree_comments'::regclass AND c.contype='p';
  IF v_pk_cols IS DISTINCT FROM ARRAY['id']::text[] THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: PRIMARY KEY must be exactly [id], got %', v_pk_cols;
  END IF;

  -- tree_id FK preserved
  SELECT count(*) INTO v_fk_tree FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='f'
    AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY %(tree_id)%REFERENCES %trees%(id)%ON DELETE CASCADE%';
  IF v_fk_tree <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: tree_id FK to trees(id) ON DELETE CASCADE must be preserved';
  END IF;

  -- CHECK constraints present (exact normalized expression comparison)
  SELECT count(*) INTO v_chk_kind FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND _lb_norm_check(pg_get_constraintdef(oid)) = 'target_kind = ''tree''';
  SELECT count(*) INTO v_chk_tid FROM pg_constraint
  WHERE conrelid='public.tree_comments'::regclass AND contype='c'
    AND _lb_norm_check(pg_get_constraintdef(oid)) = 'target_id is null or target_id = tree_id';
  IF v_chk_kind <> 1 OR v_chk_tid <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: target_kind / target_id CHECK constraints missing or incorrect';
  END IF;

  -- Required indexes
  SELECT count(*) INTO v_idx_tree FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_tree_id';
  SELECT count(*) INTO v_idx_owner FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_owner_id';
  SELECT count(*) INTO v_idx_created FROM pg_indexes WHERE schemaname='public' AND tablename='tree_comments' AND indexname='idx_tree_comments_created_at';
  IF v_idx_tree <> 1 OR v_idx_owner <> 1 OR v_idx_created <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: required indexes missing (tree_id/owner_id/created_at)';
  END IF;

  -- Exact index inventory: PK backing (id) + original compound legacy
  -- (tree_id, created_at) + 3 migration-added (tree_id, owner_id, created_at).
  SELECT count(*) INTO v_idx_pk FROM pg_index i WHERE i.indrelid='public.tree_comments'::regclass AND i.indisprimary;
  SELECT count(*) INTO v_idx_compound
  FROM pg_index i
  WHERE i.indrelid='public.tree_comments'::regclass AND NOT i.indisprimary
    AND i.indnatts=2 AND NOT i.indisunique
    AND (SELECT array_agg(a.attname::text ORDER BY ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) = ARRAY['tree_id','created_at']::text[];
  IF v_idx_tree <> 1 OR v_idx_owner <> 1 OR v_idx_created <> 1 OR v_idx_pk <> 1 OR v_idx_compound <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: PK backing + compound (tree_id, created_at) + 3 migration added index inventory wrong (tree=% owner=% created=% pk=% comp=%',
      v_idx_tree, v_idx_owner, v_idx_created, v_idx_pk, v_idx_compound;
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
  SELECT count(*) INTO v_matviews FROM pg_class c JOIN pg_depend d ON d.refobjid='public.tree_comments'::regclass AND d.objid=c.oid WHERE c.relkind='m';
  IF v_trig <> 0 OR v_rls <> 0 OR v_views <> 0 OR v_matviews <> 0 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: unexpected trigger/RLS/dependent view/materialized view appeared after migration';
  END IF;

  -- Final exact reconciled-state validation (same validator as preflight STOP).
  SELECT ok, msg INTO v_reconciled_ok, v_msg FROM _lb_reconciled_validator();
  IF v_reconciled_ok <> 1 THEN
    RAISE EXCEPTION 'POST-VERIFY FAIL: final state is not exact reconciled (%', v_msg;
  END IF;
END $$;

-- Drop the local validator and normalizers (created inside this transaction; auto-removed on COMMIT on success, and never persisted on transaction abort).
DROP FUNCTION IF EXISTS _lb_reconciled_validator();
DROP FUNCTION IF EXISTS _lb_norm_default(text);
DROP FUNCTION IF EXISTS _lb_norm_check(text);

COMMIT;
