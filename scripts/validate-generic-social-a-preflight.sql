-- Read-only preflight validator for historical generic-social Migration A.
-- Accepts only: (A) exact legacy pre-A state, or (B) exact Migration A post-state.
-- All other mixed/partial/incompatible object shapes fail closed.
--
-- Mutation statements are forbidden in this file.
-- Does not print row payloads, constraint definitions, or function bodies.
--
-- Refs #3536, #3534, #3262, #3458, #1882

DO $$
DECLARE
  idem_relkind "char";
  audit_relkind "char";
  idem_legacy_ok boolean;
  audit_legacy_ok boolean;
  idem_kind_present boolean;
  idem_id_present boolean;
  audit_kind_present boolean;
  audit_id_present boolean;
  idem_state text;
  audit_state text;
  n int;
  c_def text;
  c_norm text;
  f_lang text;
  f_ret regtype;
  f_sec boolean;
  f_nargs int;
  f_src text;
  f_norm text;
  t_type int2;
  t_enabled "char";
  t_func oid;
  expected_func oid;
  pair_norm_idem text := 'CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))';
  pair_norm_audit text := 'CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))';
  kind_norm text := 'CHECK (((target_kind IS NULL) OR ((target_kind)::text = ANY ((ARRAY[''memory''::character varying, ''tree''::character varying])::text[]))))';
BEGIN
  -- ── Relation identity ───────────────────────────────────────────────────
  SELECT c.relkind INTO idem_relkind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'social_idempotency';

  IF idem_relkind IS NULL THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED';
  END IF;
  IF idem_relkind <> 'r' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED';
  END IF;

  SELECT c.relkind INTO audit_relkind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'social_audit_log';

  IF audit_relkind IS NULL OR audit_relkind <> 'r' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED';
  END IF;

  -- ── Legacy columns ──────────────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_memory_id'
      AND udt_name = 'uuid' AND is_nullable = 'NO' AND column_default IS NULL
  ) INTO idem_legacy_ok;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'memory_id'
      AND udt_name = 'uuid' AND is_nullable = 'NO' AND column_default IS NULL
  ) INTO audit_legacy_ok;

  IF NOT idem_legacy_ok OR NOT audit_legacy_ok THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH';
  END IF;

  -- ── Generic column presence (pair integrity) ────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency' AND column_name = 'target_kind'
  ) INTO idem_kind_present;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency' AND column_name = 'target_id'
  ) INTO idem_id_present;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log' AND column_name = 'target_kind'
  ) INTO audit_kind_present;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log' AND column_name = 'target_id'
  ) INTO audit_id_present;

  IF idem_kind_present IS DISTINCT FROM idem_id_present THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE';
  END IF;
  IF audit_kind_present IS DISTINCT FROM audit_id_present THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE';
  END IF;
  IF idem_kind_present IS DISTINCT FROM audit_kind_present THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED';
  END IF;

  IF NOT idem_kind_present THEN
    -- Exact legacy pre-A: no Migration A objects allowed
    SELECT count(*)::int INTO n FROM pg_constraint
    WHERE conname IN (
      'social_idempotency_generic_target_pair_check',
      'social_idempotency_generic_target_kind_check',
      'social_audit_log_generic_target_pair_check',
      'social_audit_log_generic_target_kind_check'
    );
    IF n > 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED';
    END IF;

    SELECT count(*)::int INTO n FROM pg_trigger
    WHERE NOT tgisinternal AND tgname IN (
      'trg_social_idempotency_sync_generic_target',
      'trg_social_audit_log_sync_generic_target'
    );
    IF n > 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED';
    END IF;

    SELECT count(*)::int INTO n FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname IN (
      'sync_social_idempotency_generic_target_from_legacy_memory',
      'sync_social_audit_generic_target_from_legacy_memory'
    );
    IF n > 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED';
    END IF;

    -- Legacy pre-A accepted
    RETURN;
  END IF;

  -- ── Exact post-state generic columns ────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_kind'
      AND data_type = 'character varying' AND character_maximum_length = 16
      AND udt_name = 'varchar' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_id'
      AND udt_name = 'uuid' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'target_kind'
      AND data_type = 'character varying' AND character_maximum_length = 16
      AND udt_name = 'varchar' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'target_id'
      AND udt_name = 'uuid' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;

  -- Data-state aggregates (counts only; no payload emission)
  SELECT count(*)::int INTO n FROM social_idempotency
  WHERE (target_kind IS NULL AND target_id IS NOT NULL)
     OR (target_kind IS NOT NULL AND target_id IS NULL);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'; END IF;

  SELECT count(*)::int INTO n FROM social_audit_log
  WHERE (target_kind IS NULL AND target_id IS NOT NULL)
     OR (target_kind IS NOT NULL AND target_id IS NULL);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'; END IF;

  SELECT count(*)::int INTO n FROM social_idempotency
  WHERE target_kind IS NOT NULL AND target_kind NOT IN ('memory', 'tree');
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'; END IF;

  SELECT count(*)::int INTO n FROM social_audit_log
  WHERE target_kind IS NOT NULL AND target_kind NOT IN ('memory', 'tree');
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'; END IF;

  SELECT count(*)::int INTO n FROM social_idempotency
  WHERE target_kind = 'tree' OR (target_kind = 'memory' AND target_id IS DISTINCT FROM target_memory_id);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'; END IF;

  SELECT count(*)::int INTO n FROM social_audit_log
  WHERE target_kind = 'tree' OR (target_kind = 'memory' AND target_id IS DISTINCT FROM memory_id);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'; END IF;

  -- ── CHECK constraints exact ─────────────────────────────────────────────
  PERFORM 1 FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_pair_check'
    AND conrelid = 'public.social_idempotency'::regclass
    AND contype = 'c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_pair_check'
    AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := regexp_replace(upper(c_def), '\s+', ' ', 'g');
  IF position('TARGET_KIND IS NULL' IN c_norm) = 0
     OR position('TARGET_ID IS NULL' IN c_norm) = 0
     OR position('TARGET_KIND IS NOT NULL' IN c_norm) = 0
     OR position('TARGET_ID IS NOT NULL' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_kind_check'
    AND conrelid = 'public.social_idempotency'::regclass
    AND contype = 'c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_kind_check'
    AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := regexp_replace(upper(c_def), '\s+', ' ', 'g');
  IF position('MEMORY' IN c_norm) = 0 OR position('TREE' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint
  WHERE conname = 'social_audit_log_generic_target_pair_check'
    AND conrelid = 'public.social_audit_log'::regclass
    AND contype = 'c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_audit_log_generic_target_pair_check'
    AND conrelid = 'public.social_audit_log'::regclass;
  c_norm := regexp_replace(upper(c_def), '\s+', ' ', 'g');
  IF position('TARGET_KIND IS NULL' IN c_norm) = 0
     OR position('TARGET_ID IS NULL' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint
  WHERE conname = 'social_audit_log_generic_target_kind_check'
    AND conrelid = 'public.social_audit_log'::regclass
    AND contype = 'c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_audit_log_generic_target_kind_check'
    AND conrelid = 'public.social_audit_log'::regclass;
  c_norm := regexp_replace(upper(c_def), '\s+', ' ', 'g');
  IF position('MEMORY' IN c_norm) = 0 OR position('TREE' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  -- ── Functions exact ─────────────────────────────────────────────────────
  SELECT l.lanname, p.prorettype::regtype, p.prosecdef, p.pronargs, p.prosrc
  INTO f_lang, f_ret, f_sec, f_nargs, f_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';

  IF f_lang IS NULL OR f_lang <> 'plpgsql' OR f_ret::text <> 'trigger'
     OR f_sec IS TRUE OR f_nargs <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH';
  END IF;
  f_norm := regexp_replace(upper(f_src), '\s+', ' ', 'g');
  IF position('TARGET_KIND' IN f_norm) = 0
     OR position('TARGET_MEMORY_ID' IN f_norm) = 0
     OR position('PARTIAL GENERIC TARGET PAIR' IN f_norm) = 0
     OR position('''MEMORY''' IN f_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH';
  END IF;

  SELECT l.lanname, p.prorettype::regtype, p.prosecdef, p.pronargs, p.prosrc
  INTO f_lang, f_ret, f_sec, f_nargs, f_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_social_audit_generic_target_from_legacy_memory';

  IF f_lang IS NULL OR f_lang <> 'plpgsql' OR f_ret::text <> 'trigger'
     OR f_sec IS TRUE OR f_nargs <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH';
  END IF;
  f_norm := regexp_replace(upper(f_src), '\s+', ' ', 'g');
  IF position('TARGET_KIND' IN f_norm) = 0
     OR position('MEMORY_ID' IN f_norm) = 0
     OR position('PARTIAL GENERIC TARGET PAIR' IN f_norm) = 0
     OR position('''MEMORY''' IN f_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH';
  END IF;

  -- ── Triggers exact ──────────────────────────────────────────────────────
  -- BEFORE + INSERT + UPDATE + ROW => bits 2+4+16+1 = 23
  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname = 'trg_social_idempotency_sync_generic_target'
    AND t.tgrelid = 'public.social_idempotency'::regclass
    AND NOT t.tgisinternal;
  IF t_type IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF;
  IF t_enabled = 'D' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF;
  IF (t_type::int & 1) = 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- ROW
  IF (t_type::int & 2) = 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- BEFORE
  IF (t_type::int & 4) = 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- INSERT
  IF (t_type::int & 16) = 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- UPDATE
  IF (t_type::int & 8) <> 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- no DELETE
  IF (t_type::int & 32) <> 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF; -- no TRUNCATE
  SELECT p.oid INTO expected_func FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH';
  END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname = 'trg_social_audit_log_sync_generic_target'
    AND t.tgrelid = 'public.social_audit_log'::regclass
    AND NOT t.tgisinternal;
  IF t_type IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF;
  IF t_enabled = 'D' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'; END IF;
  IF (t_type::int & 1) = 0 OR (t_type::int & 2) = 0 OR (t_type::int & 4) = 0 OR (t_type::int & 16) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH';
  END IF;
  IF (t_type::int & 8) <> 0 OR (t_type::int & 32) <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH';
  END IF;
  SELECT p.oid INTO expected_func FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_social_audit_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH';
  END IF;

  -- Exact Migration A post-state accepted for second-apply preflight
END $$;
