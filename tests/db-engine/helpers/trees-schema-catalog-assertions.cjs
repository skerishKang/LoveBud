'use strict';

/**
 * Catalog assertions for public.trees foothold migration engine tests.
 * Failure messages are bounded codes only — no row payloads or secrets.
 *
 * Refs: #3532, #3435, #3459, #1882
 */

const TARGET_COLUMNS = [
  { name: 'owner_id', udt: 'text', data_type: 'text', array: false },
  { name: 'title', udt: 'text', data_type: 'text', array: false },
  { name: 'visibility', udt: 'text', data_type: 'text', array: false },
  { name: 'group_name', udt: 'text', data_type: 'text', array: false },
  { name: 'keywords', udt: '_text', data_type: 'ARRAY', array: true },
  { name: 'created_at', udt: 'timestamptz', data_type: 'timestamp with time zone', array: false },
  { name: 'updated_at', udt: 'timestamptz', data_type: 'timestamp with time zone', array: false },
];

const TARGET_NAMES = TARGET_COLUMNS.map((c) => c.name);

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

async function query(client, text, params = []) {
  const res = await client.query(text, params);
  return res.rows;
}

async function tableExists(client, name) {
  const rows = await query(
    client,
    `SELECT 1
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
    [name]
  );
  return rows.length > 0;
}

async function getTreesColumnMeta(client) {
  if (!(await tableExists(client, 'trees'))) return [];
  return query(
    client,
    `SELECT column_name, data_type, udt_schema, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'trees'
     ORDER BY ordinal_position`
  );
}

async function getTreesColumnNames(client) {
  const meta = await getTreesColumnMeta(client);
  return meta.map((r) => r.column_name);
}

async function getTreesPkColumns(client) {
  if (!(await tableExists(client, 'trees'))) return [];
  const rows = await query(
    client,
    `SELECT array_agg(a.attname::text ORDER BY k.ord) AS cols
     FROM pg_constraint c
     CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.conrelid = 'public.trees'::regclass AND c.contype = 'p'`
  );
  return rows[0] && rows[0].cols ? rows[0].cols : [];
}

async function getTreesConstraintCounts(client) {
  if (!(await tableExists(client, 'trees'))) {
    return { p: 0, f: 0, c: 0, u: 0, x: 0, other: 0, total: 0 };
  }
  const rows = await query(
    client,
    `SELECT contype, count(*)::int AS n
     FROM pg_constraint
     WHERE conrelid = 'public.trees'::regclass
     GROUP BY contype`
  );
  const out = { p: 0, f: 0, c: 0, u: 0, x: 0, other: 0, total: 0 };
  for (const r of rows) {
    out.total += r.n;
    if (Object.prototype.hasOwnProperty.call(out, r.contype)) out[r.contype] = r.n;
    else out.other += r.n;
  }
  return out;
}

async function getTreesSecondaryIndexes(client) {
  if (!(await tableExists(client, 'trees'))) return [];
  const rows = await query(
    client,
    `SELECT c.relname AS name
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = 'public.trees'::regclass
       AND NOT i.indisprimary
     ORDER BY c.relname`
  );
  return rows.map((r) => r.name);
}

async function getTreesUserTriggerCount(client) {
  if (!(await tableExists(client, 'trees'))) return 0;
  const rows = await query(
    client,
    `SELECT count(*)::int AS n
     FROM pg_trigger
     WHERE tgrelid = 'public.trees'::regclass AND NOT tgisinternal`
  );
  return rows[0].n;
}

async function getTreesRlsEnabled(client) {
  if (!(await tableExists(client, 'trees'))) return false;
  const rows = await query(
    client,
    `SELECT relrowsecurity AS enabled
     FROM pg_class
     WHERE oid = 'public.trees'::regclass`
  );
  return Boolean(rows[0] && rows[0].enabled);
}

async function getTreesOwnerAclFingerprint(client) {
  if (!(await tableExists(client, 'trees'))) {
    return { owner: '', acl: '' };
  }
  const rows = await query(
    client,
    `SELECT pg_get_userbyid(c.relowner) AS owner,
            coalesce(array_to_string(c.relacl::text[], ','), '') AS acl
     FROM pg_class c
     WHERE c.oid = 'public.trees'::regclass`
  );
  return {
    owner: rows[0] ? String(rows[0].owner) : '',
    // Normalize empty/null ACL only; do not log the raw string in tests.
    acl: rows[0] && rows[0].acl ? 'present' : 'empty',
  };
}

async function getTreesRowFingerprint(client) {
  if (!(await tableExists(client, 'trees'))) {
    return { count: 0, idFp: '' };
  }
  // Damaged/unsupported shapes may lack id; fingerprint without assuming the column.
  const names = await getTreesColumnNames(client);
  if (!names.includes('id')) {
    const rows = await query(client, `SELECT count(*)::int AS n FROM public.trees`);
    return { count: rows[0].n, idFp: 'NO_ID_COLUMN' };
  }
  const rows = await query(
    client,
    `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(id::text, '|' ORDER BY id::text)), '') AS id_fp
     FROM public.trees`
  );
  return { count: rows[0].n, idFp: rows[0].id_fp };
}

async function getNonNullTargetCount(client) {
  if (!(await tableExists(client, 'trees'))) return 0;
  const names = await getTreesColumnNames(client);
  const present = TARGET_NAMES.filter((n) => names.includes(n));
  if (present.length === 0) return 0;
  const preds = present.map((n) => `${quoteIdent(n)} IS NOT NULL`).join(' OR ');
  const rows = await query(client, `SELECT count(*)::int AS n FROM public.trees WHERE ${preds}`);
  return rows[0].n;
}

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error('INVALID_IDENT');
  }
  return `"${name}"`;
}

async function getPublicRelations(client) {
  const rows = await query(
    client,
    `SELECT c.relname AS name, c.relkind AS kind
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
     ORDER BY c.relname`
  );
  return rows.map((r) => `${r.kind}:${r.name}`);
}

async function getSentinelFingerprint(client) {
  if (!(await tableExists(client, 'lb_sentinel_dependent'))) {
    return { count: 0, fp: '' };
  }
  const rows = await query(
    client,
    `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(id || ':' || tree_id, '|' ORDER BY id)), '') AS fp
     FROM public.lb_sentinel_dependent`
  );
  return { count: rows[0].n, fp: rows[0].fp };
}

async function getUnrelatedFingerprint(client) {
  if (!(await tableExists(client, 'lb_unrelated_marker'))) {
    return { count: 0, fp: '' };
  }
  const rows = await query(
    client,
    `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(id || ':' || v, '|' ORDER BY id)), '') AS fp
     FROM public.lb_unrelated_marker`
  );
  return { count: rows[0].n, fp: rows[0].fp };
}

async function getCatalogFingerprint(client) {
  const columns = await getTreesColumnMeta(client);
  return {
    relations: await getPublicRelations(client),
    treesExists: await tableExists(client, 'trees'),
    columns: columns.map((c) => ({
      name: c.column_name,
      data_type: c.data_type,
      udt_schema: c.udt_schema,
      udt_name: c.udt_name,
      is_nullable: c.is_nullable,
      column_default: c.column_default,
    })),
    pk: await getTreesPkColumns(client),
    cons: await getTreesConstraintCounts(client),
    secondaryIndexes: await getTreesSecondaryIndexes(client),
    triggers: await getTreesUserTriggerCount(client),
    rls: await getTreesRlsEnabled(client),
    rows: await getTreesRowFingerprint(client),
    ownerAcl: await getTreesOwnerAclFingerprint(client),
    sentinel: await getSentinelFingerprint(client),
    unrelated: await getUnrelatedFingerprint(client),
  };
}

function fingerprintEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function expectTargetMeta(metaByName, col) {
  const c = metaByName.get(col.name);
  if (!c) fail(`EXPECTED_COLUMN_PRESENT_${col.name}`);
  if (c.udt_schema !== 'pg_catalog' || c.udt_name !== col.udt) {
    fail(`EXPECTED_UDT_${col.name}_${col.udt}`);
  }
  if (col.array) {
    if (c.data_type !== 'ARRAY') fail(`EXPECTED_ARRAY_${col.name}`);
  } else if (c.data_type !== col.data_type && !(col.udt === 'text' && c.data_type === 'text')) {
    // text is fine; timestamptz maps to timestamp with time zone
    if (!(col.udt === 'timestamptz' && c.data_type === 'timestamp with time zone')) {
      fail(`EXPECTED_DATA_TYPE_${col.name}`);
    }
  }
  if (c.is_nullable !== 'YES') fail(`EXPECTED_NULLABLE_${col.name}`);
  if (c.column_default != null) fail(`EXPECTED_NO_DEFAULT_${col.name}`);
}

async function assertDamagedCatalog(client) {
  if (!(await tableExists(client, 'trees'))) fail('EXPECTED_TREES_ORDINARY_TABLE');
  const names = await getTreesColumnNames(client);
  if (!names.includes('id')) fail('EXPECTED_ID_PRESENT');
  for (const n of TARGET_NAMES) {
    if (names.includes(n)) fail(`EXPECTED_TARGET_ABSENT_${n}`);
  }
  const meta = await getTreesColumnMeta(client);
  const id = meta.find((c) => c.column_name === 'id');
  if (!id || !['text', 'character varying', 'character'].includes(id.data_type)) {
    fail('EXPECTED_ID_TEXT_COMPATIBLE');
  }
  if (id.is_nullable !== 'NO') fail('EXPECTED_ID_NOT_NULL');
  const pk = await getTreesPkColumns(client);
  if (pk.length !== 1 || pk[0] !== 'id') fail('EXPECTED_SOLE_PK_ID');
  const rows = await getTreesRowFingerprint(client);
  if (rows.count < 1) fail('EXPECTED_SYNTHETIC_ROWS_PRESENT');
}

async function assertRepairedCatalog(client) {
  if (!(await tableExists(client, 'trees'))) fail('EXPECTED_TREES_ORDINARY_TABLE');
  const meta = await getTreesColumnMeta(client);
  const byName = new Map(meta.map((c) => [c.column_name, c]));
  const id = byName.get('id');
  if (!id) fail('EXPECTED_ID_PRESENT');
  if (!['text', 'character varying', 'character'].includes(id.data_type)) {
    fail('EXPECTED_ID_TEXT_COMPATIBLE');
  }
  if (id.is_nullable !== 'NO') fail('EXPECTED_ID_NOT_NULL');
  if (id.column_default != null) fail('EXPECTED_ID_NO_DEFAULT');
  const pk = await getTreesPkColumns(client);
  if (pk.length !== 1 || pk[0] !== 'id') fail('EXPECTED_SOLE_PK_ID');

  for (const col of TARGET_COLUMNS) {
    expectTargetMeta(byName, col);
  }

  const nonNullTargets = await getNonNullTargetCount(client);
  if (nonNullTargets !== 0) fail(`EXPECTED_ALL_NEW_COLS_NULL_ACTUAL_${nonNullTargets}`);

  // No secondary indexes / FK / CHECK / triggers / RLS introduced by foothold.
  const idxs = await getTreesSecondaryIndexes(client);
  if (idxs.length !== 0) fail(`EXPECTED_SECONDARY_INDEX_0_ACTUAL_${idxs.length}`);
  const cons = await getTreesConstraintCounts(client);
  if (cons.f !== 0) fail(`EXPECTED_FK_0_ACTUAL_${cons.f}`);
  if (cons.c !== 0) fail(`EXPECTED_CHECK_0_ACTUAL_${cons.c}`);
  if ((await getTreesUserTriggerCount(client)) !== 0) fail('EXPECTED_TRIGGER_0');
  if (await getTreesRlsEnabled(client)) fail('EXPECTED_RLS_DISABLED');
}

module.exports = {
  TARGET_COLUMNS,
  TARGET_NAMES,
  tableExists,
  getTreesColumnMeta,
  getTreesColumnNames,
  getTreesPkColumns,
  getTreesConstraintCounts,
  getTreesSecondaryIndexes,
  getTreesUserTriggerCount,
  getTreesRlsEnabled,
  getTreesOwnerAclFingerprint,
  getTreesRowFingerprint,
  getNonNullTargetCount,
  getPublicRelations,
  getSentinelFingerprint,
  getUnrelatedFingerprint,
  getCatalogFingerprint,
  fingerprintEqual,
  assertDamagedCatalog,
  assertRepairedCatalog,
};
