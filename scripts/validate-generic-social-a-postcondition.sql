-- Read-only postcondition validator for historical generic-social Migration A.
-- Requires exact Migration A post-state on both tables.
-- No mutation statements. No row-payload output.
--
-- Refs #3536, #3534, #3262, #3458, #1882

DO $$
DECLARE
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
BEGIN
  -- Relations ordinary
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'social_idempotency' AND c.relkind = 'r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'social_audit_log' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  -- Legacy columns unchanged
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_memory_id' AND udt_name = 'uuid'
      AND is_nullable = 'NO' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'memory_id' AND udt_name = 'uuid'
      AND is_nullable = 'NO' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  -- Generic columns exact on both tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_kind' AND data_type = 'character varying'
      AND character_maximum_length = 16 AND is_nullable = 'YES' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_idempotency'
      AND column_name = 'target_id' AND udt_name = 'uuid'
      AND is_nullable = 'YES' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'target_kind' AND data_type = 'character varying'
      AND character_maximum_length = 16 AND is_nullable = 'YES' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_audit_log'
      AND column_name = 'target_id' AND udt_name = 'uuid'
      AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  -- Exactly four intended CHECK constraints present and validated
  SELECT count(*)::int INTO n FROM pg_constraint
  WHERE contype = 'c' AND convalidated AND conname IN (
    'social_idempotency_generic_target_pair_check',
    'social_idempotency_generic_target_kind_check',
    'social_audit_log_generic_target_pair_check',
    'social_audit_log_generic_target_kind_check'
  );
  IF n <> 4 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  -- Semantic anchors on pair/kind checks
  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_pair_check'
    AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := regexp_replace(upper(coalesce(c_def, '')), '\s+', ' ', 'g');
  IF position('TARGET_KIND IS NULL' IN c_norm) = 0 OR position('TARGET_ID IS NOT NULL' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO c_def FROM pg_constraint
  WHERE conname = 'social_idempotency_generic_target_kind_check'
    AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := regexp_replace(upper(coalesce(c_def, '')), '\s+', ' ', 'g');
  IF position('MEMORY' IN c_norm) = 0 OR position('TREE' IN c_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  -- Functions
  SELECT l.lanname, p.prorettype::regtype, p.prosecdef, p.pronargs, p.prosrc
  INTO f_lang, f_ret, f_sec, f_nargs, f_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';
  IF f_lang IS NULL OR f_lang <> 'plpgsql' OR f_ret::text <> 'trigger'
     OR f_sec IS TRUE OR f_nargs <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;
  f_norm := regexp_replace(upper(f_src), '\s+', ' ', 'g');
  IF position('TARGET_MEMORY_ID' IN f_norm) = 0 OR position('PARTIAL GENERIC TARGET PAIR' IN f_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
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
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;
  f_norm := regexp_replace(upper(f_src), '\s+', ' ', 'g');
  IF position('MEMORY_ID' IN f_norm) = 0 OR position('PARTIAL GENERIC TARGET PAIR' IN f_norm) = 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;

  -- Triggers: exactly the two intended, correct shape
  SELECT count(*)::int INTO n FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN (
    'trg_social_idempotency_sync_generic_target',
    'trg_social_audit_log_sync_generic_target'
  );
  IF n <> 2 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname = 'trg_social_idempotency_sync_generic_target'
    AND t.tgrelid = 'public.social_idempotency'::regclass AND NOT t.tgisinternal;
  IF t_type IS NULL OR t_enabled = 'D' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF (t_type::int & 23) <> 23 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF (t_type::int & 8) <> 0 OR (t_type::int & 32) <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;
  SELECT p.oid INTO expected_func FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname = 'trg_social_audit_log_sync_generic_target'
    AND t.tgrelid = 'public.social_audit_log'::regclass AND NOT t.tgisinternal;
  IF t_type IS NULL OR t_enabled = 'D' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF (t_type::int & 23) <> 23 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF (t_type::int & 8) <> 0 OR (t_type::int & 32) <> 0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED';
  END IF;
  SELECT p.oid INTO expected_func FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_social_audit_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
END $$;
