-- Read-only postcondition for historical generic-social Migration B.
-- Requires exact STATE_B on both tables. All failures:
--   GENERIC_SOCIAL_B_POSTCONDITION_FAILED
-- No DDL/DML. No row payloads.
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
  t_type int2;
  t_enabled "char";
  t_func oid;
  expected_func oid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='social_idempotency' AND c.relkind='r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='social_audit_log' AND c.relkind='r'
  ) THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  -- Legacy nullable UUID no default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_memory_id'
      AND udt_name='uuid' AND is_nullable='YES' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='memory_id'
      AND udt_name='uuid' AND is_nullable='YES' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  -- Generic NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_kind'
      AND data_type='character varying' AND character_maximum_length=16 AND is_nullable='NO' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_idempotency' AND column_name='target_id'
      AND udt_name='uuid' AND is_nullable='NO' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='target_kind'
      AND data_type='character varying' AND character_maximum_length=16 AND is_nullable='NO' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_audit_log' AND column_name='target_id'
      AND udt_name='uuid' AND is_nullable='NO' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  -- A CHECKs unique + validated + hash
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_idempotency_generic_target_pair_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_generic_target_pair_check' AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> 'c77f0945aee59e0335790265e8df825ea52dd013082b30b2d59b916d98d3db8d' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_idempotency_generic_target_kind_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_generic_target_kind_check' AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '007a87be5a8c9a7cd5884cd13218eb0172cc6ad62a4428a455caddeaca0f6f48' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_audit_log_generic_target_pair_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_generic_target_pair_check' AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_pair_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '5da1378af245ad9a1386748e12b2a5e6ffa1f993159657660b074f696cec91a9' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_audit_log_generic_target_kind_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_generic_target_kind_check' AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_generic_target_kind_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF actual_hash <> '62558ce79f045d9ff015a5e35a839d6a4136358b3fa664d30db463c3f8bcad28' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  -- B CHECKs
  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_idempotency_memory_legacy_match_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_memory_legacy_match_check' AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_memory_legacy_match_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF position('IS DISTINCT FROM' in c_norm) = 0 OR position('memory' in c_norm) = 0 OR position('target_memory_id' in c_norm) = 0 OR position('target_id' in c_norm) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_idempotency_tree_legacy_null_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_idempotency_tree_legacy_null_check' AND conrelid='public.social_idempotency'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_idempotency', 'social_idempotency_tree_legacy_null_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF position('IS DISTINCT FROM' in c_norm) = 0 OR position('tree' in c_norm) = 0 OR position('target_memory_id' in c_norm) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_audit_log_memory_legacy_match_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_memory_legacy_match_check' AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_memory_legacy_match_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF position('IS DISTINCT FROM' in c_norm) = 0 OR position('memory' in c_norm) = 0 OR position('memory_id' in c_norm) = 0 OR position('target_id' in c_norm) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  SELECT count(*)::int INTO n FROM pg_constraint WHERE conname='social_audit_log_tree_legacy_null_check';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_constraintdef(oid,false) INTO c_def FROM pg_constraint
  WHERE conname='social_audit_log_tree_legacy_null_check' AND conrelid='public.social_audit_log'::regclass AND contype='c' AND convalidated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  c_norm := trim(both from regexp_replace(replace(replace(c_def, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  actual_hash := encode(sha256(convert_to(concat_ws(E'\n', 'public', 'social_audit_log', 'social_audit_log_tree_legacy_null_check', 'c', 'true', c_norm), 'utf8')), 'hex');
  IF position('IS DISTINCT FROM' in c_norm) = 0 OR position('tree' in c_norm) = 0 OR position('memory_id' in c_norm) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  -- Functions B
  expected_func := to_regprocedure('public.sync_social_idempotency_generic_target_from_legacy_memory()');
  IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.proname='sync_social_idempotency_generic_target_from_legacy_memory';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
         COALESCE((SELECT string_agg(cfg,',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) AS cfg),''), p.prosrc
  INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
  FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=expected_func;
  IF NOT FOUND OR f_ret IS DISTINCT FROM 'trigger' OR f_lang IS DISTINCT FROM 'plpgsql' OR f_sec THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  IF position('Tree targets must not populate legacy target_memory_id' in f_src)=0 OR position('target_kind = ''tree''' in f_src)=0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
  END IF;
  IF position('Tree targets must not populate legacy target_memory_id' in f_src) = 0
       OR position('Unknown target_kind' in f_src) = 0
       OR position('target_kind = ''tree''' in f_src) = 0
       OR position('Partial generic target pair' in f_src) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  expected_func := to_regprocedure('public.sync_social_audit_generic_target_from_legacy_memory()');
  IF expected_func IS NULL THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT count(*)::int INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.proname='sync_social_audit_generic_target_from_legacy_memory';
  IF n <> 1 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.prosecdef, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
         COALESCE((SELECT string_agg(cfg,',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) AS cfg),''), p.prosrc
  INTO f_args, f_ret, f_lang, f_sec, f_vol, f_par, f_leak, f_strict, f_config, f_src
  FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=expected_func;
  IF NOT FOUND OR f_ret IS DISTINCT FROM 'trigger' OR f_lang IS DISTINCT FROM 'plpgsql' OR f_sec THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  f_norm := trim(both from regexp_replace(replace(replace(f_src, E'\r\n', E'\n'), E'\r', E'\n'), E'\\s+', ' ', 'g'));
  IF position('Tree targets must not populate legacy memory_id' in f_src)=0 OR position('target_kind = ''tree''' in f_src)=0 THEN
    RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
  END IF;
  IF position('Tree targets must not populate legacy memory_id' in f_src) = 0
       OR position('Unknown target_kind' in f_src) = 0
       OR position('target_kind = ''tree''' in f_src) = 0
       OR position('Partial generic target pair' in f_src) = 0 THEN
      RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED';
    END IF;

  -- Triggers
  SELECT count(*)::int INTO n FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
    'trg_social_idempotency_sync_generic_target','trg_social_audit_log_sync_generic_target');
  IF n <> 2 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname='trg_social_idempotency_sync_generic_target' AND t.tgrelid='public.social_idempotency'::regclass AND NOT t.tgisinternal;
  IF NOT FOUND OR t_type <> 23 OR t_enabled <> 'O' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  expected_func := to_regprocedure('public.sync_social_idempotency_generic_target_from_legacy_memory()');
  IF expected_func IS NULL OR t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid INTO t_type, t_enabled, t_func
  FROM pg_trigger t
  WHERE t.tgname='trg_social_audit_log_sync_generic_target' AND t.tgrelid='public.social_audit_log'::regclass AND NOT t.tgisinternal;
  IF NOT FOUND OR t_type <> 23 OR t_enabled <> 'O' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  expected_func := to_regprocedure('public.sync_social_audit_generic_target_from_legacy_memory()');
  IF expected_func IS NULL OR t_func IS DISTINCT FROM expected_func THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;

  -- Data aggregates
  SELECT count(*)::int INTO n FROM social_idempotency
  WHERE target_kind IS NULL OR target_id IS NULL OR target_kind NOT IN ('memory','tree')
     OR (target_kind='memory' AND target_memory_id IS NOT NULL AND target_id IS DISTINCT FROM target_memory_id)
     OR (target_kind='tree' AND target_memory_id IS NOT NULL);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
  SELECT count(*)::int INTO n FROM social_audit_log
  WHERE target_kind IS NULL OR target_id IS NULL OR target_kind NOT IN ('memory','tree')
     OR (target_kind='memory' AND memory_id IS NOT NULL AND target_id IS DISTINCT FROM memory_id)
     OR (target_kind='tree' AND memory_id IS NOT NULL);
  IF n > 0 THEN RAISE EXCEPTION 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED'; END IF;
END $$;
