'use strict';

/**
 * Catalog + full-row fingerprint helpers for generic-social Migration A engine tests.
 * Returns only counts/hashes/bounded codes — never raw row payloads.
 *
 * Refs: #3534, #3262, #3459, #1882
 */

const TABLES = {
  idem: 'social_idempotency',
  audit: 'social_audit_log',
  unrelated: 'lb_unrelated_marker',
};

const GENERIC_COLS = ['target_kind', 'target_id'];
const LEGACY_IDEM = 'target_memory_id';
const LEGACY_AUDIT = 'memory_id';

const EXPECTED_CHECKS = [
  'social_idempotency_generic_target_pair_check',
  'social_idempotency_generic_target_kind_check',
  'social_audit_log_generic_target_pair_check',
  'social_audit_log_generic_target_kind_check',
];

const EXPECTED_TRIGGERS = [
  { name: 'trg_social_idempotency_sync_generic_target', rel: 'social_idempotency' },
  { name: 'trg_social_audit_log_sync_generic_target', rel: 'social_audit_log' },
];

const EXPECTED_FUNCS = [
  'sync_social_idempotency_generic_target_from_legacy_memory',
  'sync_social_audit_generic_target_from_legacy_memory',
];

const ALLOWED_FINGERPRINT_TABLES = new Map([
  ['idem', { schema: 'public', table: 'social_idempotency' }],
  ['audit', { schema: 'public', table: 'social_audit_log' }],
  ['unrelated', { schema: 'public', table: 'lb_unrelated_marker' }],
]);

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function quoteIdent(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    fail('INVALID_IDENT');
  }
  return `"${name}"`;
}

async function query(client, text, params = []) {
  const res = await client.query(text, params);
  return res.rows;
}

async function tableExistsOrdinary(client, name) {
  const rows = await query(
    client,
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
    [name]
  );
  return rows.length > 0;
}

async function getColumnMeta(client, table) {
  if (!(await tableExistsOrdinary(client, table))) return [];
  return query(
    client,
    `SELECT column_name, data_type, udt_name, character_maximum_length,
            is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
}

async function getColumnNames(client, table) {
  return (await getColumnMeta(client, table)).map((r) => r.column_name);
}

async function getFullRowFingerprint(client, tableKey, opts) {
  const mapping = ALLOWED_FINGERPRINT_TABLES.get(tableKey);
  if (!mapping) fail(`FINGERPRINT_TABLE_NOT_ALLOWED_${String(tableKey)}`);
  if (!(await tableExistsOrdinary(client, mapping.table))) {
    return { count: 0, rowFp: '' };
  }

  const options = opts || {};
  let columnList = null;
  if (Array.isArray(options.columns) && options.columns.length > 0) {
    columnList = [];
    for (const c of options.columns) {
      if (typeof c !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
        fail('FINGERPRINT_INVALID_COLUMN_IDENT');
      }
      columnList.push(c);
    }
  }

  let sql;
  if (columnList) {
    const proj = columnList.map((c) => quoteIdent(c)).join(', ');
    sql = `
      SELECT count(*)::int AS n,
             coalesce(
               md5(string_agg(md5(row_to_json(s)::text), '|' ORDER BY md5(row_to_json(s)::text))),
               ''
             ) AS row_fp
      FROM (
        SELECT ${proj}
        FROM ${quoteIdent(mapping.schema)}.${quoteIdent(mapping.table)}
      ) AS s`;
  } else {
    sql = `
      SELECT count(*)::int AS n,
             coalesce(
               md5(string_agg(md5(row_to_json(t)::text), '|' ORDER BY md5(row_to_json(t)::text))),
               ''
             ) AS row_fp
      FROM ${quoteIdent(mapping.schema)}.${quoteIdent(mapping.table)} AS t`;
  }
  const rows = await query(client, sql);
  return { count: rows[0].n, rowFp: rows[0].row_fp };
}

async function getCheckNames(client, table) {
  if (!(await tableExistsOrdinary(client, table))) return [];
  const rows = await query(
    client,
    `SELECT c.conname AS name
     FROM pg_constraint c
     WHERE c.conrelid = ($1::text)::regclass AND c.contype = 'c'
     ORDER BY c.conname`,
    [`public.${table}`]
  );
  return rows.map((r) => r.name);
}

async function getTriggerNames(client, table) {
  if (!(await tableExistsOrdinary(client, table))) return [];
  const rows = await query(
    client,
    `SELECT t.tgname AS name
     FROM pg_trigger t
     WHERE t.tgrelid = ($1::text)::regclass AND NOT t.tgisinternal
     ORDER BY t.tgname`,
    [`public.${table}`]
  );
  return rows.map((r) => r.name);
}

async function getFunctionDefHash(client, name) {
  const rows = await query(
    client,
    `SELECT coalesce(md5(pg_get_functiondef(p.oid)), '') AS h
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = $1`,
    [name]
  );
  return rows[0] ? rows[0].h : '';
}

async function getSecondaryIndexNames(client, table) {
  if (!(await tableExistsOrdinary(client, table))) return [];
  const rows = await query(
    client,
    `SELECT c.relname AS name
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = ($1::text)::regclass AND NOT i.indisprimary
     ORDER BY c.relname`,
    [`public.${table}`]
  );
  return rows.map((r) => r.name);
}

async function getOwnerAcl(client, table) {
  if (!(await tableExistsOrdinary(client, table))) return { owner: '', acl: 'empty' };
  const rows = await query(
    client,
    `SELECT pg_get_userbyid(c.relowner) AS owner,
            coalesce(array_to_string(c.relacl::text[], ','), '') AS acl
     FROM pg_class c
     WHERE c.oid = ($1::text)::regclass`,
    [`public.${table}`]
  );
  return {
    owner: rows[0] ? String(rows[0].owner) : '',
    acl: rows[0] && rows[0].acl ? 'present' : 'empty',
  };
}

async function getBackfillStats(client, table, legacyCol) {
  const rows = await query(
    client,
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL)::int AS null_pair,
       count(*) FILTER (
         WHERE (target_kind IS NULL AND target_id IS NOT NULL)
            OR (target_kind IS NOT NULL AND target_id IS NULL)
       )::int AS partial_pair,
       count(*) FILTER (WHERE target_kind IS NOT NULL AND target_kind <> 'memory')::int AS non_memory,
       count(*) FILTER (
         WHERE target_kind IS NOT NULL AND target_id IS NOT NULL
           AND target_id IS DISTINCT FROM ${quoteIdent(legacyCol)}
       )::int AS mismatch,
       count(*) FILTER (
         WHERE target_kind = 'memory' AND target_id IS NOT DISTINCT FROM ${quoteIdent(legacyCol)}
       )::int AS memory_matched
     FROM public.${quoteIdent(table)}`
  );
  return rows[0];
}

async function getGenericColumnMeta(client, table) {
  const meta = await getColumnMeta(client, table);
  const by = new Map(meta.map((m) => [m.column_name, m]));
  return {
    target_kind: by.get('target_kind') || null,
    target_id: by.get('target_id') || null,
  };
}

function expectGenericNullableNoDefault(col, name, udt) {
  if (!col) fail(`EXPECTED_GENERIC_COL_PRESENT_${name}`);
  if (col.udt_name !== udt) fail(`EXPECTED_GENERIC_UDT_${name}_${udt}`);
  if (name === 'target_kind') {
    if (col.data_type !== 'character varying' || col.character_maximum_length !== 16) {
      fail('EXPECTED_TARGET_KIND_VARCHAR16');
    }
  }
  if (name === 'target_id' && col.data_type !== 'uuid' && col.udt_name !== 'uuid') {
    fail('EXPECTED_TARGET_ID_UUID');
  }
  if (col.is_nullable !== 'YES') fail(`EXPECTED_GENERIC_NULLABLE_${name}`);
  if (col.column_default != null) fail(`EXPECTED_GENERIC_NO_DEFAULT_${name}`);
}

async function assertLegacySchema(client) {
  for (const t of [TABLES.idem, TABLES.audit]) {
    if (!(await tableExistsOrdinary(client, t))) fail(`EXPECTED_LEGACY_TABLE_${t}`);
    const names = await getColumnNames(client, t);
    if (names.includes('target_kind') || names.includes('target_id')) {
      fail(`EXPECTED_NO_GENERIC_COLS_PRE_${t}`);
    }
  }
  const idem = await getColumnMeta(client, TABLES.idem);
  const audit = await getColumnMeta(client, TABLES.audit);
  const idemBy = new Map(idem.map((c) => [c.column_name, c]));
  const auditBy = new Map(audit.map((c) => [c.column_name, c]));
  const mem = idemBy.get(LEGACY_IDEM);
  if (!mem || mem.udt_name !== 'uuid' || mem.is_nullable !== 'NO') {
    fail('EXPECTED_IDEM_LEGACY_UUID_NOT_NULL');
  }
  const aud = auditBy.get(LEGACY_AUDIT);
  if (!aud || aud.udt_name !== 'uuid' || aud.is_nullable !== 'NO') {
    fail('EXPECTED_AUDIT_LEGACY_UUID_NOT_NULL');
  }
}

async function assertMigrationACatalog(client) {
  for (const t of [TABLES.idem, TABLES.audit]) {
    const g = await getGenericColumnMeta(client, t);
    expectGenericNullableNoDefault(g.target_kind, 'target_kind', 'varchar');
    // information_schema udt_name for uuid is 'uuid'
    if (!g.target_id || g.target_id.udt_name !== 'uuid' || g.target_id.is_nullable !== 'YES') {
      fail(`EXPECTED_TARGET_ID_UUID_NULLABLE_${t}`);
    }
    if (g.target_id.column_default != null) fail(`EXPECTED_TARGET_ID_NO_DEFAULT_${t}`);

    // Legacy NOT NULL preserved
    const meta = await getColumnMeta(client, t);
    const by = new Map(meta.map((c) => [c.column_name, c]));
    const legacy = t === TABLES.idem ? by.get(LEGACY_IDEM) : by.get(LEGACY_AUDIT);
    if (!legacy || legacy.is_nullable !== 'NO' || legacy.udt_name !== 'uuid') {
      fail(`EXPECTED_LEGACY_STILL_NOT_NULL_${t}`);
    }
  }

  const checksIdem = await getCheckNames(client, TABLES.idem);
  const checksAudit = await getCheckNames(client, TABLES.audit);
  for (const name of EXPECTED_CHECKS) {
    const list = name.startsWith('social_idempotency') ? checksIdem : checksAudit;
    if (!list.includes(name)) fail(`EXPECTED_CHECK_${name}`);
  }
  if (checksIdem.length !== 2) fail(`EXPECTED_IDEM_CHECK_COUNT_2_ACTUAL_${checksIdem.length}`);
  if (checksAudit.length !== 2) fail(`EXPECTED_AUDIT_CHECK_COUNT_2_ACTUAL_${checksAudit.length}`);

  for (const tr of EXPECTED_TRIGGERS) {
    const names = await getTriggerNames(client, tr.rel);
    if (!names.includes(tr.name)) fail(`EXPECTED_TRIGGER_${tr.name}`);
    if (names.length !== 1) fail(`EXPECTED_TRIGGER_COUNT_1_${tr.rel}_ACTUAL_${names.length}`);
  }

  for (const fn of EXPECTED_FUNCS) {
    const h = await getFunctionDefHash(client, fn);
    if (!h) fail(`EXPECTED_FUNCTION_${fn}`);
  }

  const stIdem = await getBackfillStats(client, TABLES.idem, LEGACY_IDEM);
  const stAudit = await getBackfillStats(client, TABLES.audit, LEGACY_AUDIT);
  for (const [label, st] of [
    ['idem', stIdem],
    ['audit', stAudit],
  ]) {
    if (st.null_pair !== 0) fail(`EXPECTED_NULL_PAIR_0_${label}`);
    if (st.partial_pair !== 0) fail(`EXPECTED_PARTIAL_PAIR_0_${label}`);
    if (st.non_memory !== 0) fail(`EXPECTED_NON_MEMORY_0_${label}`);
    if (st.mismatch !== 0) fail(`EXPECTED_MISMATCH_0_${label}`);
    if (st.memory_matched !== st.total) fail(`EXPECTED_ALL_MEMORY_MATCHED_${label}`);
  }
}

async function getCatalogFingerprint(client) {
  async function tableFp(table) {
    return {
      exists: await tableExistsOrdinary(client, table),
      columns: (await getColumnMeta(client, table)).map((c) => ({
        name: c.column_name,
        data_type: c.data_type,
        udt_name: c.udt_name,
        char_len: c.character_maximum_length,
        nullable: c.is_nullable,
        has_default: c.column_default != null,
      })),
      checks: await getCheckNames(client, table),
      triggers: await getTriggerNames(client, table),
      indexes: await getSecondaryIndexNames(client, table),
      ownerAcl: await getOwnerAcl(client, table),
    };
  }
  return {
    idem: await tableFp(TABLES.idem),
    audit: await tableFp(TABLES.audit),
    unrelated: await tableFp(TABLES.unrelated),
    funcs: Object.fromEntries(
      await Promise.all(EXPECTED_FUNCS.map(async (f) => [f, await getFunctionDefHash(client, f)]))
    ),
    rows: {
      idem: await getFullRowFingerprint(client, 'idem'),
      audit: await getFullRowFingerprint(client, 'audit'),
      unrelated: await getFullRowFingerprint(client, 'unrelated'),
    },
  };
}

function fingerprintEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  TABLES,
  GENERIC_COLS,
  LEGACY_IDEM,
  LEGACY_AUDIT,
  EXPECTED_CHECKS,
  EXPECTED_TRIGGERS,
  EXPECTED_FUNCS,
  tableExistsOrdinary,
  getColumnMeta,
  getColumnNames,
  getFullRowFingerprint,
  getCheckNames,
  getTriggerNames,
  getFunctionDefHash,
  getSecondaryIndexNames,
  getOwnerAcl,
  getBackfillStats,
  getGenericColumnMeta,
  assertLegacySchema,
  assertMigrationACatalog,
  getCatalogFingerprint,
  fingerprintEqual,
};
