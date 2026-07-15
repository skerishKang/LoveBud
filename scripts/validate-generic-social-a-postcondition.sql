-- Read-only postcondition validator for historical generic-social Migration A.
-- Requires exact Migration A post-state on both tables.
-- No mutation statements. No row-payload output.
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
  n int;
  c_def text;
  c_norm text;
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
  actual_hash text;
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

  -- Semantic anchors on pair/kind checks exact
  SELECT pg_get_constraintdef(oid, false) INTO c_def FROM pg_constraint WHERE conname = 'social_idempotency_generic_target_pair_check' AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> 'c77f0945aee59e0335790265e8df825ea52dd013082b30b2d59b916d98d3db8d' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT pg_get_constraintdef(oid, false) INTO c_def FROM pg_constraint WHERE conname = 'social_idempotency_generic_target_kind_check' AND conrelid = 'public.social_idempotency'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '007a87be5a8c9a7cd5884cd13218eb0172cc6ad62a4428a455caddeaca0f6f48' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT pg_get_constraintdef(oid, false) INTO c_def FROM pg_constraint WHERE conname = 'social_audit_log_generic_target_pair_check' AND conrelid = 'public.social_audit_log'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '5da1378af245ad9a1386748e12b2a5e6ffa1f993159657660b074f696cec91a9' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT pg_get_constraintdef(oid, false) INTO c_def FROM pg_constraint WHERE conname = 'social_audit_log_generic_target_kind_check' AND conrelid = 'public.social_audit_log'::regclass;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '62558ce79f045d9ff015a5e35a839d6a4136358b3fa664d30db463c3f8bcad28' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  -- ── Functions exact ─────────────────────────────────────────────────────
  -- sync_social_idempotency_generic_target_from_legacy_memory
  expected_func := to_regprocedure('public.sync_social_idempotency_generic_target_from_legacy_memory()');
  IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), ''), p.prosrc
  INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
  FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = expected_func;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;
  f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'sync_social_idempotency_generic_target_from_legacy_memory', coalesce(f_args, ''), coalesce(f_ret, ''), f_lang, f_sec::text, f_vol, f_par, f_leak::text, f_strict::text, f_config, f_norm), 'utf8')), 'hex');
  IF actual_hash <> '6fbfdc41a3365c064f364861c02fcace2cbe9c59411474c9bf431eba92641f71' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  -- sync_social_audit_generic_target_from_legacy_memory
  expected_func := to_regprocedure('public.sync_social_audit_generic_target_from_legacy_memory()');
  IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'sync_social_audit_generic_target_from_legacy_memory';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), ''), p.prosrc
  INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
  FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = expected_func;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;
  f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'sync_social_audit_generic_target_from_legacy_memory', coalesce(f_args, ''), coalesce(f_ret, ''), f_lang, f_sec::text, f_vol, f_par, f_leak::text, f_strict::text, f_config, f_norm), 'utf8')), 'hex');
  IF actual_hash <> 'b42090df51a9fe76fc18d454cb952fe39995400b1781ddd35d7bb59cf6b65d87' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'; END IF;

  -- Triggers: exactly the two intended, correct shape
  SELECT count(*)::int INTO n FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN (
    'trg_social_idempotency_sync_generic_target',
    'trg_social_audit_log_sync_generic_target'
  );
  IF n <> 2 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgisinternal, t.tgtype, t.tgenabled, pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_triggerdef(t.oid, false), t.tgfoid
  INTO t_isinternal, t_type, t_enabled, tf_schema, tf_name, tf_args, t_def, t_func
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE t.tgname = 'trg_social_idempotency_sync_generic_target' AND t.tgrelid = 'public.social_idempotency'::regclass AND NOT t.tgisinternal;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF t_type <> 23 OR t_enabled <> 'O' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  
  SELECT p.oid INTO expected_func FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'sync_social_idempotency_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  c_norm := trim(both from regexp_replace(replace(replace(t_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'trg_social_idempotency_sync_generic_target', t_isinternal::text, t_type::text, t_enabled, tf_schema, tf_name, coalesce(tf_args, ''), c_norm), 'utf8')), 'hex');
  IF actual_hash <> '8ba5f85b551331e33152e594d05181acdeb16fc02247ff727044b47a333c8fb3' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgisinternal, t.tgtype, t.tgenabled, pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_triggerdef(t.oid, false), t.tgfoid
  INTO t_isinternal, t_type, t_enabled, tf_schema, tf_name, tf_args, t_def, t_func
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE t.tgname = 'trg_social_audit_log_sync_generic_target' AND t.tgrelid = 'public.social_audit_log'::regclass AND NOT t.tgisinternal;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
  IF t_type <> 23 OR t_enabled <> 'O' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  SELECT p.oid INTO expected_func FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'sync_social_audit_generic_target_from_legacy_memory';
  IF t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;

  c_norm := trim(both from regexp_replace(replace(replace(t_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'trg_social_audit_log_sync_generic_target', t_isinternal::text, t_type::text, t_enabled, tf_schema, tf_name, coalesce(tf_args, ''), c_norm), 'utf8')), 'hex');
  IF actual_hash <> '0b1540d7896554971cce5ad614dedb3d9482b943db540adcc42c00b5aa3b1ef1' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED'; END IF;
END $$;
