'use strict';

/**
 * Deterministic PostgreSQL catalog assertions for tree_comments engine tests.
 * Failure messages are bounded codes only — never raw catalog rows or payloads.
 */

const LEGACY_COLUMNS = [
  'id',
  'tree_id',
  'author_id',
  'author_display_name',
  'is_deleted',
  'created_at',
  'updated_at',
  'payload',
];

const CANONICAL_COLUMNS = [
  'id',
  'tree_id',
  'author_id',
  'author_display_name',
  'is_deleted',
  'created_at',
  'updated_at',
  'payload',
  'owner_id',
  'body',
  'target_kind',
  'target_id',
];

const CANONICAL_SECONDARY_INDEXES = [
  { name: 'idx_tree_comments_tree_id', keys: ['tree_id'] },
  { name: 'idx_tree_comments_owner_id', keys: ['owner_id'] },
  { name: 'idx_tree_comments_created_at', keys: ['created_at'] },
];

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

async function query(client, text, params = []) {
  const res = await client.query(text, params);
  return res.rows;
}

async function getColumnNames(client) {
  const rows = await query(
    client,
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tree_comments'
     ORDER BY ordinal_position`
  );
  return rows.map((r) => r.column_name);
}

async function getRowCount(client) {
  const rows = await query(client, 'SELECT count(*)::int AS n FROM public.tree_comments');
  return rows[0].n;
}

async function getPkColumns(client) {
  const rows = await query(
    client,
    `SELECT array_agg(a.attname::text ORDER BY k.ord) AS cols
     FROM pg_constraint c
     CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.conrelid = 'public.tree_comments'::regclass AND c.contype = 'p'`
  );
  return rows[0] && rows[0].cols ? rows[0].cols : [];
}

async function getOutboundFkSummary(client) {
  const rows = await query(
    client,
    `SELECT a.attname AS col,
            conf.relname AS ref_table,
            fa.attname AS ref_col,
            c.confdeltype AS del
     FROM pg_constraint c
     JOIN pg_class conf ON conf.oid = c.confrelid
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
     WHERE c.conrelid = 'public.tree_comments'::regclass
       AND c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND array_length(c.confkey, 1) = 1
     ORDER BY a.attname`
  );
  return rows.map((r) => `${r.col}->${r.ref_table}(${r.ref_col}):${r.del}`);
}

async function getConstraintCounts(client) {
  const rows = await query(
    client,
    `SELECT contype, count(*)::int AS n
     FROM pg_constraint
     WHERE conrelid = 'public.tree_comments'::regclass
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

async function getSecondaryIndexes(client) {
  const rows = await query(
    client,
    `SELECT c.relname AS name,
            i.indisunique AS is_unique,
            i.indpred IS NOT NULL AS is_partial,
            i.indexprs IS NOT NULL AS is_expression,
            (i.indnkeyatts <> i.indnatts) AS has_include,
            (SELECT array_agg(a.attname::text ORDER BY ord)
             FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS keys
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = 'public.tree_comments'::regclass
       AND NOT i.indisprimary
     ORDER BY c.relname`
  );
  return rows.map((r) => ({
    name: r.name,
    isUnique: r.is_unique,
    isPartial: r.is_partial,
    isExpression: r.is_expression,
    hasInclude: r.has_include,
    keys: r.keys || [],
  }));
}

async function getUserTriggerCount(client) {
  const rows = await query(
    client,
    `SELECT count(*)::int AS n
     FROM pg_trigger
     WHERE tgrelid = 'public.tree_comments'::regclass AND NOT tgisinternal`
  );
  return rows[0].n;
}

async function getRlsEnabled(client) {
  const rows = await query(
    client,
    `SELECT relrowsecurity AS enabled
     FROM pg_class
     WHERE oid = 'public.tree_comments'::regclass`
  );
  return Boolean(rows[0] && rows[0].enabled);
}

async function getDependentViewCount(client) {
  // PostgreSQL records view query deps via rewrite rules:
  // pg_depend (classid=pg_rewrite) -> pg_rewrite -> pg_class.ev_class
  const rows = await query(
    client,
    `SELECT count(DISTINCT c.oid)::int AS n
     FROM pg_depend d
     JOIN pg_rewrite r ON r.oid = d.objid
     JOIN pg_class c ON c.oid = r.ev_class
     WHERE d.refobjid = 'public.tree_comments'::regclass
       AND d.refclassid = 'pg_class'::regclass
       AND d.classid = 'pg_rewrite'::regclass
       AND c.relkind = 'v'`
  );
  return rows[0].n;
}

async function getDependentMatviewCount(client) {
  const rows = await query(
    client,
    `SELECT count(DISTINCT c.oid)::int AS n
     FROM pg_depend d
     JOIN pg_rewrite r ON r.oid = d.objid
     JOIN pg_class c ON c.oid = r.ev_class
     WHERE d.refobjid = 'public.tree_comments'::regclass
       AND d.refclassid = 'pg_class'::regclass
       AND d.classid = 'pg_rewrite'::regclass
       AND c.relkind = 'm'`
  );
  return rows[0].n;
}

async function getInboundFkCount(client) {
  const rows = await query(
    client,
    `SELECT count(*)::int AS n
     FROM pg_constraint
     WHERE contype = 'f' AND confrelid = 'public.tree_comments'::regclass`
  );
  return rows[0].n;
}

async function helperFunctionPresent(client, name) {
  const rows = await query(
    client,
    `SELECT count(*)::int AS n
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = $1`,
    [name]
  );
  return rows[0].n > 0;
}

async function getCanonicalOnlyColumnCount(client) {
  const rows = await query(
    client,
    `SELECT count(*)::int AS n
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tree_comments'
       AND column_name IN ('owner_id', 'body', 'target_kind', 'target_id')`
  );
  return rows[0].n;
}

async function getCatalogFingerprint(client) {
  const columns = await getColumnNames(client);
  const pk = await getPkColumns(client);
  const fks = await getOutboundFkSummary(client);
  const cons = await getConstraintCounts(client);
  const idxs = await getSecondaryIndexes(client);
  const rowCount = await getRowCount(client);
  const triggers = await getUserTriggerCount(client);
  const rls = await getRlsEnabled(client);
  const views = await getDependentViewCount(client);
  const matviews = await getDependentMatviewCount(client);
  const inbound = await getInboundFkCount(client);
  const helpers = {
    _lb_norm_default: await helperFunctionPresent(client, '_lb_norm_default'),
    _lb_norm_check: await helperFunctionPresent(client, '_lb_norm_check'),
    _lb_reconciled_validator: await helperFunctionPresent(client, '_lb_reconciled_validator'),
  };
  return {
    columns,
    pk,
    fks,
    cons,
    idxs: idxs.map((i) => ({
      name: i.name,
      keys: i.keys,
      isUnique: i.isUnique,
      isPartial: i.isPartial,
      isExpression: i.isExpression,
      hasInclude: i.hasInclude,
    })),
    rowCount,
    triggers,
    rls,
    views,
    matviews,
    inbound,
    helpers,
  };
}

function fingerprintEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function assertLegacyCatalog(client) {
  const columns = await getColumnNames(client);
  if (columns.length !== 8) fail(`EXPECTED_COLUMN_COUNT_8_ACTUAL_${columns.length}`);
  for (let i = 0; i < LEGACY_COLUMNS.length; i += 1) {
    if (columns[i] !== LEGACY_COLUMNS[i]) {
      fail(`EXPECTED_COLUMN_ORDER_LEGACY_MISMATCH_AT_${i}`);
    }
  }
  const pk = await getPkColumns(client);
  if (pk.length !== 2 || pk[0] !== 'tree_id' || pk[1] !== 'id') {
    fail(`EXPECTED_PK_TREE_ID_ID_ACTUAL_${pk.join('_') || 'NONE'}`);
  }
  const fks = await getOutboundFkSummary(client);
  const expectedFks = [
    'author_id->users(id):n',
    'tree_id->trees(id):c',
  ].sort();
  const actualFks = [...fks].sort();
  if (JSON.stringify(actualFks) !== JSON.stringify(expectedFks)) {
    fail(`EXPECTED_OUTBOUND_FK_LEGACY_2_ACTUAL_${actualFks.length}`);
  }
  const cons = await getConstraintCounts(client);
  if (cons.total !== 3 || cons.p !== 1 || cons.f !== 2 || cons.c !== 0) {
    fail(`EXPECTED_CONSTRAINT_TOTAL_3_ACTUAL_${cons.total}`);
  }
  const idxs = await getSecondaryIndexes(client);
  if (idxs.length !== 0) fail(`EXPECTED_SECONDARY_INDEX_COUNT_0_ACTUAL_${idxs.length}`);
  const rowCount = await getRowCount(client);
  if (rowCount !== 0) fail(`EXPECTED_ROW_COUNT_0_ACTUAL_${rowCount}`);
  if ((await getUserTriggerCount(client)) !== 0) fail('EXPECTED_USER_TRIGGER_COUNT_0');
  if (await getRlsEnabled(client)) fail('EXPECTED_RLS_DISABLED');
  if ((await getDependentViewCount(client)) !== 0) fail('EXPECTED_DEPENDENT_VIEW_COUNT_0');
  if ((await getDependentMatviewCount(client)) !== 0) fail('EXPECTED_DEPENDENT_MATVIEW_COUNT_0');
  if ((await getInboundFkCount(client)) !== 0) fail('EXPECTED_INBOUND_FK_COUNT_0');
  for (const name of ['_lb_norm_default', '_lb_norm_check', '_lb_reconciled_validator']) {
    if (await helperFunctionPresent(client, name)) fail(`EXPECTED_HELPER_ABSENT_${name}`);
  }
}

async function assertCanonicalCatalog(client) {
  const columns = await getColumnNames(client);
  if (columns.length !== 12) fail(`EXPECTED_COLUMN_COUNT_12_ACTUAL_${columns.length}`);
  // Column order after ALTER is legacy order then appended canonical columns.
  const expectedOrder = [
    'id',
    'tree_id',
    'author_id',
    'author_display_name',
    'is_deleted',
    'created_at',
    'updated_at',
    'payload',
    'owner_id',
    'body',
    'target_kind',
    'target_id',
  ];
  for (let i = 0; i < expectedOrder.length; i += 1) {
    if (columns[i] !== expectedOrder[i]) {
      fail(`EXPECTED_COLUMN_ORDER_CANONICAL_MISMATCH_AT_${i}`);
    }
  }
  for (const name of CANONICAL_COLUMNS) {
    if (!columns.includes(name)) fail(`EXPECTED_COLUMN_PRESENT_${name}`);
  }

  const meta = await query(
    client,
    `SELECT column_name, data_type, udt_name, is_nullable,
            character_maximum_length, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tree_comments'`
  );
  const byName = new Map(meta.map((r) => [r.column_name, r]));

  function expectCol(name, pred, code) {
    const c = byName.get(name);
    if (!c || !pred(c)) fail(code);
  }

  expectCol('id', (c) => c.data_type === 'text' && c.udt_name === 'text' && c.is_nullable === 'NO' && c.column_default == null, 'EXPECTED_ID_TEXT_NOT_NULL_NO_DEFAULT');
  expectCol('tree_id', (c) => c.data_type === 'text' && c.udt_name === 'text' && c.is_nullable === 'NO' && c.column_default == null, 'EXPECTED_TREE_ID_TEXT_NOT_NULL_NO_DEFAULT');
  expectCol('author_id', (c) => c.data_type === 'text' && c.is_nullable === 'YES' && c.column_default == null, 'EXPECTED_AUTHOR_ID_TEXT_NULL');
  expectCol('author_display_name', (c) => c.data_type === 'text' && c.is_nullable === 'YES' && c.column_default == null, 'EXPECTED_AUTHOR_DISPLAY_NAME_TEXT_NULL');
  expectCol('is_deleted', (c) => c.data_type === 'boolean' && c.is_nullable === 'NO' && (c.column_default === 'false' || c.column_default === 'FALSE'), 'EXPECTED_IS_DELETED_BOOL_DEFAULT_FALSE');
  expectCol('created_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO' && c.column_default != null && /now\s*\(\s*\)/i.test(c.column_default), 'EXPECTED_CREATED_AT_TIMESTAMPTZ_NOT_NULL_NOW');
  expectCol('updated_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO' && c.column_default != null && /now\s*\(\s*\)/i.test(c.column_default), 'EXPECTED_UPDATED_AT_TIMESTAMPTZ_NOT_NULL_NOW');
  expectCol('payload', (c) => c.data_type === 'jsonb' && c.is_nullable === 'NO' && c.column_default === "'{}'::jsonb", 'EXPECTED_PAYLOAD_JSONB_DEFAULT_EMPTY');
  expectCol('owner_id', (c) => c.data_type === 'character varying' && c.character_maximum_length === 128 && c.is_nullable === 'NO' && c.column_default == null, 'EXPECTED_OWNER_ID_VARCHAR128_NOT_NULL');
  expectCol('body', (c) => c.data_type === 'text' && c.is_nullable === 'NO' && c.column_default == null, 'EXPECTED_BODY_TEXT_NOT_NULL');
  expectCol('target_kind', (c) => c.data_type === 'character varying' && c.character_maximum_length === 16 && c.is_nullable === 'NO' && c.column_default != null && /tree/i.test(c.column_default), 'EXPECTED_TARGET_KIND_VARCHAR16_DEFAULT_TREE');
  expectCol('target_id', (c) => c.data_type === 'text' && c.is_nullable === 'YES' && c.column_default == null, 'EXPECTED_TARGET_ID_TEXT_NULL');

  const pk = await getPkColumns(client);
  if (pk.length !== 1 || pk[0] !== 'id') fail(`EXPECTED_PK_ID_ACTUAL_${pk.join('_') || 'NONE'}`);

  const fks = await getOutboundFkSummary(client);
  const expectedFks = ['author_id->users(id):n', 'tree_id->trees(id):c'].sort();
  const actualFks = [...fks].sort();
  if (JSON.stringify(actualFks) !== JSON.stringify(expectedFks)) {
    fail(`EXPECTED_OUTBOUND_FK_CANONICAL_2_ACTUAL_${actualFks.length}`);
  }

  const cons = await getConstraintCounts(client);
  if (cons.total !== 5 || cons.p !== 1 || cons.f !== 2 || cons.c !== 2) {
    fail(`EXPECTED_CONSTRAINT_TOTAL_5_ACTUAL_${cons.total}`);
  }

  const idxs = await getSecondaryIndexes(client);
  if (idxs.length !== 3) fail(`EXPECTED_SECONDARY_INDEX_COUNT_3_ACTUAL_${idxs.length}`);
  for (const expected of CANONICAL_SECONDARY_INDEXES) {
    const found = idxs.find((i) => i.name === expected.name);
    if (!found) fail(`EXPECTED_SECONDARY_INDEX_PRESENT_${expected.name}`);
    if (found.isUnique || found.isPartial || found.isExpression || found.hasInclude) {
      fail(`EXPECTED_SECONDARY_INDEX_SIMPLE_${expected.name}`);
    }
    if (found.keys.length !== 1 || found.keys[0] !== expected.keys[0]) {
      fail(`EXPECTED_SECONDARY_INDEX_KEYS_${expected.name}`);
    }
  }
  const compound = idxs.filter(
    (i) => i.keys.length === 2 && i.keys[0] === 'tree_id' && i.keys[1] === 'created_at'
  );
  if (compound.length !== 0) fail('EXPECTED_COMPOUND_TREE_ID_CREATED_AT_COUNT_0');
  const unexpected = idxs.filter(
    (i) => !CANONICAL_SECONDARY_INDEXES.some((e) => e.name === i.name)
  );
  if (unexpected.length !== 0) fail(`EXPECTED_UNEXPECTED_SECONDARY_INDEX_COUNT_0_ACTUAL_${unexpected.length}`);

  const rowCount = await getRowCount(client);
  if (rowCount !== 0) fail(`EXPECTED_ROW_COUNT_0_ACTUAL_${rowCount}`);
  if ((await getUserTriggerCount(client)) !== 0) fail('EXPECTED_USER_TRIGGER_COUNT_0');
  if (await getRlsEnabled(client)) fail('EXPECTED_RLS_DISABLED');
  if ((await getDependentViewCount(client)) !== 0) fail('EXPECTED_DEPENDENT_VIEW_COUNT_0');
  if ((await getDependentMatviewCount(client)) !== 0) fail('EXPECTED_DEPENDENT_MATVIEW_COUNT_0');
  if ((await getInboundFkCount(client)) !== 0) fail('EXPECTED_INBOUND_FK_COUNT_0');
  for (const name of ['_lb_norm_default', '_lb_norm_check', '_lb_reconciled_validator']) {
    if (await helperFunctionPresent(client, name)) fail(`EXPECTED_HELPER_ABSENT_${name}`);
  }
}

module.exports = {
  LEGACY_COLUMNS,
  CANONICAL_COLUMNS,
  CANONICAL_SECONDARY_INDEXES,
  getColumnNames,
  getRowCount,
  getPkColumns,
  getOutboundFkSummary,
  getConstraintCounts,
  getSecondaryIndexes,
  getUserTriggerCount,
  getRlsEnabled,
  getDependentViewCount,
  getDependentMatviewCount,
  getInboundFkCount,
  helperFunctionPresent,
  getCanonicalOnlyColumnCount,
  getCatalogFingerprint,
  fingerprintEqual,
  assertLegacyCatalog,
  assertCanonicalCatalog,
};
