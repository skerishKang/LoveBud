-- Read-only preflight for historical generic-social Migration B.
-- Accepts only: both tables exact Migration A post-state (STATE_A), or
-- both tables exact Migration B post-state (STATE_B).
-- No DDL/DML. No row payloads. Fail closed with bounded categories.
--
-- Refs #3538, #3459, #3458, #3425, #1882

DO $$
DECLARE
  n int;
  c_def text;
  c_norm text;
  actual_hash text;
  f_args text;
  f_ret text;
  f_lang text;
  f_sec boolean;
  f_vol "char";
  f_par "char";
  f_leak boolean;
  f_strict boolean;
  f_config text;
  f_src text;
  f_norm text;
  t_isinternal boolean;
  t_type int2;
  t_enabled "char";
  tf_schema text;
  tf_name text;
  tf_args text;
  t_def text;
  t_func oid;
  expected_func oid;
  idem_state text;
  audit_state text;
  idem_leg_null text;
  audit_leg_null text;
  idem_kind_null text;
  idem_id_null text;
  audit_kind_null text;
  audit_id_null text;
  has_b_checks int;
  has_a_checks int;
BEGIN
  -- ── Relations ordinary ──────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'social_idempotency' AND c.relkind = 'r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'social_audit_log' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED';
  END IF;

  -- ── Column shapes ───────────────────────────────────────────────────────
  SELECT is_nullable INTO idem_leg_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_memory_id'
    AND udt_name='uuid' AND column_default IS NULL;
  SELECT is_nullable INTO audit_leg_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='memory_id'
    AND udt_name='uuid' AND column_default IS NULL;
  IF idem_leg_null IS NULL OR audit_leg_null IS NULL THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH';
  END IF;

  SELECT is_nullable INTO idem_kind_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_kind'
    AND data_type='character varying' AND character_maximum_length=16 AND column_default IS NULL;
  SELECT is_nullable INTO idem_id_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_id'
    AND udt_name='uuid' AND column_default IS NULL;
  SELECT is_nullable INTO audit_kind_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='target_kind'
    AND data_type='character varying' AND character_maximum_length=16 AND column_default IS NULL;
  SELECT is_nullable INTO audit_id_null FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='target_id'
    AND udt_name='uuid' AND column_default IS NULL;
  IF idem_kind_null IS NULL OR idem_id_null IS NULL OR audit_kind_null IS NULL OR audit_id_null IS NULL THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;

  -- Classify table state from nullability (STATE_A: legacy NO + generic YES; STATE_B: legacy YES + generic NO)
  IF idem_leg_null = 'NO' AND audit_leg_null = 'NO'
     AND idem_kind_null = 'YES' AND idem_id_null = 'YES'
     AND audit_kind_null = 'YES' AND audit_id_null = 'YES' THEN
    idem_state := 'A'; audit_state := 'A';
  ELSIF idem_leg_null = 'YES' AND audit_leg_null = 'YES'
     AND idem_kind_null = 'NO' AND idem_id_null = 'NO'
     AND audit_kind_null = 'NO' AND audit_id_null = 'NO' THEN
    idem_state := 'B'; audit_state := 'B';
  ELSE
    -- Mixed nullability across tables or columns
    IF idem_leg_null IS DISTINCT FROM audit_leg_null
       OR idem_kind_null IS DISTINCT FROM audit_kind_null
       OR idem_id_null IS DISTINCT FROM audit_id_null
       OR idem_kind_null IS DISTINCT FROM idem_id_null
       OR audit_kind_null IS DISTINCT FROM audit_id_null THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED';
    END IF;
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH';
  END IF;

  IF idem_state IS DISTINCT FROM audit_state THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED';
  END IF;

  -- ── Migration A CHECK quartet always required ───────────────────────────
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname = 'social_idempotency_generic_target_pair_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname = 'social_idempotency_generic_target_kind_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname = 'social_audit_log_generic_target_pair_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname = 'social_audit_log_generic_target_kind_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='social_idempotency_generic_target_pair_check'
    AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_generic_target_pair_check' AND conrelid='public.social_idempotency'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> 'c77f0945aee59e0335790265e8df825ea52dd013082b30b2d59b916d98d3db8d' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='social_idempotency_generic_target_kind_check'
    AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_generic_target_kind_check' AND conrelid='public.social_idempotency'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '007a87be5a8c9a7cd5884cd13218eb0172cc6ad62a4428a455caddeaca0f6f48' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='social_audit_log_generic_target_pair_check'
    AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_generic_target_pair_check' AND conrelid='public.social_audit_log'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '5da1378af245ad9a1386748e12b2a5e6ffa1f993159657660b074f696cec91a9' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='social_audit_log_generic_target_kind_check'
    AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_generic_target_kind_check' AND conrelid='public.social_audit_log'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '62558ce79f045d9ff015a5e35a839d6a4136358b3fa664d30db463c3f8bcad28' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH';
  END IF;

  SELECT count(*)::int INTO has_b_checks FROM pg_constraint WHERE conname IN (
    'social_idempotency_memory_legacy_match_check',
    'social_idempotency_tree_legacy_null_check',
    'social_audit_log_memory_legacy_match_check',
    'social_audit_log_tree_legacy_null_check'
  );

  IF idem_state = 'A' THEN
    -- STATE_A: B CHECKs must be absent
    IF has_b_checks <> 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'; END IF;

    -- Data: complete memory pairs only
    SELECT count(*)::int INTO n FROM social_idempotency
    WHERE target_kind IS NULL OR target_id IS NULL
       OR (target_kind IS NULL) IS DISTINCT FROM (target_id IS NULL)
       OR target_kind IS DISTINCT FROM 'memory'
       OR target_id IS DISTINCT FROM target_memory_id
       OR target_memory_id IS NULL;
    IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH'; END IF;
    SELECT count(*)::int INTO n FROM social_audit_log
    WHERE target_kind IS NULL OR target_id IS NULL
       OR (target_kind IS NULL) IS DISTINCT FROM (target_id IS NULL)
       OR target_kind IS DISTINCT FROM 'memory'
       OR target_id IS DISTINCT FROM memory_id
       OR memory_id IS NULL;
    IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH'; END IF;

    -- A function bodies
    expected_func := to_regprocedure('public.sync_social_idempotency_generic_target_from_legacy_memory()');
    IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'; END IF;
    SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname='sync_social_idempotency_generic_target_from_legacy_memory';
    IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'; END IF;
    SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
           COALESCE((SELECT string_agg(cfg,',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) AS cfg),''), p.prosrc
    INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
    FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=expected_func;
    IF NOT FOUND OR f_ret IS DISTINCT FROM 'trigger' OR f_lang IS DISTINCT FROM 'plpgsql' OR f_sec OR f_vol IS DISTINCT FROM 'v' OR f_par IS DISTINCT FROM 'u' OR f_leak OR f_strict THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH';
    END IF;
    f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
    IF position('Tree targets must not populate legacy target_memory_id' in f_src) = 0
       OR position('Unknown target_kind' in f_src) = 0
       OR position('target_kind = ''tree''' in f_src) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH';
    END IF;

    expected_func := to_regprocedure('public.sync_social_audit_generic_target_from_legacy_memory()');
    IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH'; END IF;
    SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname='sync_social_audit_generic_target_from_legacy_memory';
    IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH'; END IF;
    SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
           COALESCE((SELECT string_agg(cfg,',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) AS cfg),''), p.prosrc
    INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
    FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=expected_func;
    IF NOT FOUND OR f_ret IS DISTINCT FROM 'trigger' OR f_lang IS DISTINCT FROM 'plpgsql' OR f_sec OR f_vol IS DISTINCT FROM 'v' OR f_par IS DISTINCT FROM 'u' OR f_leak OR f_strict THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH';
    END IF;
    f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
    IF position('Tree targets must not populate legacy memory_id' in f_src) = 0
       OR position('Unknown target_kind' in f_src) = 0
       OR position('target_kind = ''tree''' in f_src) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH';
    END IF;
    IF position('Tree targets must not populate legacy memory_id' in f_src) = 0
       OR position('Unknown target_kind' in f_src) = 0
       OR position('target_kind = ''tree''' in f_src) = 0
       OR position('Partial generic target pair' in f_src) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH';
    END IF;
  END IF;

  -- ── Triggers (same shape both states; function OID matches current body) ─
  SELECT count(*)::int INTO n FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN (
    'trg_social_idempotency_sync_generic_target',
    'trg_social_audit_log_sync_generic_target'
  );
  IF n <> 2 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'; END IF;

  SELECT t.tgisinternal, t.tgtype, t.tgenabled, pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_triggerdef(t.oid,false), t.tgfoid
  INTO t_isinternal, t_type, t_enabled, tf_schema, tf_name, tf_args, t_def, t_func
  FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
  WHERE t.tgname='trg_social_idempotency_sync_generic_target' AND t.tgrelid='public.social_idempotency'::regclass AND NOT t.tgisinternal;
  IF NOT FOUND OR t_type <> 23 OR t_enabled <> 'O' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH';
  END IF;
  expected_func := to_regprocedure('public.sync_social_idempotency_generic_target_from_legacy_memory()');
  IF expected_func IS NULL OR t_func IS DISTINCT FROM expected_func THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH';
  END IF;

  SELECT t.tgisinternal, t.tgtype, t.tgenabled, pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_triggerdef(t.oid,false), t.tgfoid
  INTO t_isinternal, t_type, t_enabled, tf_schema, tf_name, tf_args, t_def, t_func
  FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
  WHERE t.tgname='trg_social_audit_log_sync_generic_target' AND t.tgrelid='public.social_audit_log'::regclass AND NOT t.tgisinternal;
  IF NOT FOUND OR t_type <> 23 OR t_enabled <> 'O' THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH';
  END IF;
  expected_func := to_regprocedure('public.sync_social_audit_generic_target_from_legacy_memory()');
  IF expected_func IS NULL OR t_func IS DISTINCT FROM expected_func THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH';
  END IF;
END $$;
