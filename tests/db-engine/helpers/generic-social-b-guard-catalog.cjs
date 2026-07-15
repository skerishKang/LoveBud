'use strict';

/**
 * Catalog fingerprint helpers for Migration B execution-guard engine tests.
 * Complete preservation projection + approved-delta separation.
 * Refs #3538, #3459, #1882
 */

const ALLOWED = new Map([
  ['idem', { schema: 'public', table: 'social_idempotency' }],
  ['audit', { schema: 'public', table: 'social_audit_log' }],
  ['unrelated', { schema: 'public', table: 'lb_unrelated_marker' }],
]);

const COMPLETE_CATALOG_PROJECTION_FIELDS = [
  'schema',
  'relationName',
  'relkind',
  'owner',
  'acl',
  'legacyColumnMetadata',
  'allColumnMetadata',
  'pkAndPreexistingConstraints',
  'constraintDefinitionsAndValidation',
  'allIndexesIncludingPrimary',
  'indexUniquePrimaryValid',
  'normalizedIndexDef',
  'triggerNameTypeEnabledRelationFunctionOid',
  'functionFullAttributeBodyFingerprint',
];

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function quoteIdent(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fail('INVALID_IDENT');
  return `"${name}"`;
}

async function query(client, text, params = []) {
  return (await client.query(text, params)).rows;
}

async function ordinaryExists(client, table) {
  const rows = await query(
    client,
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=$1 AND c.relkind='r'`,
    [table]
  );
  return rows.length > 0;
}

async function getFullRowFingerprint(client, key, opts) {
  const mapping = ALLOWED.get(key);
  if (!mapping) fail('FINGERPRINT_TABLE_NOT_ALLOWED');
  if (!(await ordinaryExists(client, mapping.table))) return { count: 0, rowFp: '' };
  const options = opts || {};
  let sql;
  if (Array.isArray(options.columns) && options.columns.length) {
    const proj = options.columns.map((c) => quoteIdent(c)).join(', ');
    sql = `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(md5(row_to_json(s)::text),'|' ORDER BY md5(row_to_json(s)::text))),'') AS row_fp
            FROM (SELECT ${proj} FROM ${quoteIdent(mapping.schema)}.${quoteIdent(mapping.table)}) s`;
  } else {
    sql = `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(md5(row_to_json(t)::text),'|' ORDER BY md5(row_to_json(t)::text))),'') AS row_fp
            FROM ${quoteIdent(mapping.schema)}.${quoteIdent(mapping.table)} t`;
  }
  const rows = await query(client, sql);
  return { count: rows[0].n, rowFp: rows[0].row_fp };
}

async function getColumnNames(client, table) {
  const rows = await query(
    client,
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function getCompleteTableProjection(client, table) {
  if (!(await ordinaryExists(client, table))) {
    return { exists: false };
  }
  const rel = await query(
    client,
    `SELECT n.nspname AS schema, c.relname AS relation_name, c.relkind::text AS relkind,
            pg_get_userbyid(c.relowner) AS owner,
            COALESCE(c.relacl::text, '') AS acl
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=$1 AND c.relkind='r'`,
    [table]
  );
  const cols = await query(
    client,
    `SELECT column_name, udt_name, data_type, is_nullable,
            column_default IS NOT NULL AS has_default,
            COALESCE(column_default, '') AS column_default,
            character_maximum_length, ordinal_position
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  const constraints = await query(
    client,
    `SELECT c.conname, c.contype::text AS contype, c.convalidated,
            pg_get_constraintdef(c.oid, false) AS def
     FROM pg_constraint c
     WHERE c.conrelid=($1::text)::regclass
     ORDER BY c.conname`,
    [`public.${table}`]
  );
  const indexes = await query(
    client,
    `SELECT i.relname AS index_name, ix.indisunique, ix.indisprimary, ix.indisvalid,
            pg_get_indexdef(ix.indexrelid) AS indexdef
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     WHERE ix.indrelid=($1::text)::regclass
     ORDER BY i.relname`,
    [`public.${table}`]
  );
  const triggers = await query(
    client,
    `SELECT t.tgname, t.tgtype::int AS tgtype, t.tgenabled::text AS enabled,
            t.tgrelid::regclass::text AS relation,
            t.tgfoid::oid::text AS function_oid,
            p.proname AS function_name
     FROM pg_trigger t
     JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid=($1::text)::regclass AND NOT t.tgisinternal
     ORDER BY t.tgname`,
    [`public.${table}`]
  );

  const legacyName = table === 'social_idempotency' ? 'target_memory_id' : 'memory_id';
  const legacy = cols.filter((c) => c.column_name === legacyName);

  return {
    exists: true,
    schema: rel[0].schema,
    relationName: rel[0].relation_name,
    relkind: rel[0].relkind,
    owner: rel[0].owner,
    acl: rel[0].acl,
    legacyColumnMetadata: legacy.map((c) => ({
      n: c.column_name,
      u: c.udt_name,
      null: c.is_nullable,
      d: c.has_default,
      def: c.column_default,
      len: c.character_maximum_length,
    })),
    allColumnMetadata: cols.map((c) => ({
      n: c.column_name,
      u: c.udt_name,
      dt: c.data_type,
      null: c.is_nullable,
      d: c.has_default,
      def: c.column_default,
      len: c.character_maximum_length,
      ord: c.ordinal_position,
    })),
    pkAndPreexistingConstraints: constraints.map((c) => ({
      n: c.conname,
      t: c.contype,
      v: c.convalidated,
      def: c.def,
    })),
    constraintDefinitionsAndValidation: constraints.map((c) => ({
      n: c.conname,
      t: c.contype,
      v: c.convalidated,
      def: c.def,
    })),
    allIndexesIncludingPrimary: indexes.map((i) => ({
      n: i.index_name,
      u: i.indisunique,
      p: i.indisprimary,
      valid: i.indisvalid,
      def: i.indexdef,
    })),
    indexUniquePrimaryValid: indexes.map((i) => ({
      n: i.index_name,
      u: i.indisunique,
      p: i.indisprimary,
      valid: i.indisvalid,
    })),
    normalizedIndexDef: indexes.map((i) => ({
      n: i.index_name,
      def: String(i.indexdef || '').replace(/\s+/g, ' ').trim(),
    })),
    triggerNameTypeEnabledRelationFunctionOid: triggers.map((t) => ({
      n: t.tgname,
      t: t.tgtype,
      e: t.enabled,
      r: t.relation,
      foid: t.function_oid,
      fn: t.function_name,
    })),
  };
}

async function getFunctionFingerprints(client) {
  const funcs = await query(
    client,
    `SELECT p.proname,
            pg_get_function_identity_arguments(p.oid) AS args,
            pg_get_function_result(p.oid) AS result,
            l.lanname,
            p.prosecdef,
            p.provolatile::text AS vol,
            p.proparallel::text AS par,
            p.proleakproof,
            p.proisstrict,
            COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), '') AS config,
            encode(sha256(convert_to(concat_ws(E'\\n',
              'public', p.proname,
              coalesce(pg_get_function_identity_arguments(p.oid), ''),
              coalesce(pg_get_function_result(p.oid), ''),
              l.lanname,
              p.prosecdef::text,
              p.provolatile::text,
              p.proparallel::text,
              p.proleakproof::text,
              p.proisstrict::text,
              COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), ''),
              trim(both from regexp_replace(replace(replace(p.prosrc, E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g'))
            ), 'utf8')), 'hex') AS body_hash
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
     JOIN pg_language l ON l.oid=p.prolang
     WHERE n.nspname='public' AND p.proname IN (
       'sync_social_idempotency_generic_target_from_legacy_memory',
       'sync_social_audit_generic_target_from_legacy_memory'
     )
     ORDER BY p.proname, p.oid`
  );
  return funcs.map((f) => ({
    n: f.proname,
    args: f.args,
    result: f.result,
    l: f.lanname,
    s: f.prosecdef,
    vol: f.vol,
    par: f.par,
    leak: f.proleakproof,
    strict: f.proisstrict,
    config: f.config,
    h: f.body_hash,
  }));
}

/** Full catalog fingerprint for mutation detection. */
async function getCatalogFingerprint(client) {
  return {
    idem: await getCompleteTableProjection(client, 'social_idempotency'),
    audit: await getCompleteTableProjection(client, 'social_audit_log'),
    unrelated: await getCompleteTableProjection(client, 'lb_unrelated_marker'),
    functionFullAttributeBodyFingerprint: await getFunctionFingerprints(client),
    rows: {
      idem: await getFullRowFingerprint(client, 'idem'),
      audit: await getFullRowFingerprint(client, 'audit'),
      unrelated: await getFullRowFingerprint(client, 'unrelated'),
    },
  };
}

/**
 * Preservation projection: items that must not change across Migration B
 * (excludes intentional B delta fields).
 */
function extractPreservationProjection(fp) {
  function stripTable(t) {
    if (!t || !t.exists) return t;
    // Drop intentional B deltas from column nullability of legacy/generic and B checks / function body
    const preserveCols = (t.allColumnMetadata || []).map((c) => {
      if (['target_memory_id', 'memory_id', 'target_kind', 'target_id'].includes(c.n)) {
        // Keep type/default/name; nullability is approved delta
        return { n: c.n, u: c.u, dt: c.dt, d: c.d, def: c.def, len: c.len, ord: c.ord };
      }
      return c;
    });
    const preserveConstraints = (t.pkAndPreexistingConstraints || []).filter(
      (c) =>
        ![
          'social_idempotency_memory_legacy_match_check',
          'social_idempotency_tree_legacy_null_check',
          'social_audit_log_memory_legacy_match_check',
          'social_audit_log_tree_legacy_null_check',
        ].includes(c.n)
    );
    return {
      schema: t.schema,
      relationName: t.relationName,
      relkind: t.relkind,
      owner: t.owner,
      acl: t.acl,
      allColumnMetadata: preserveCols,
      pkAndPreexistingConstraints: preserveConstraints,
      allIndexesIncludingPrimary: t.allIndexesIncludingPrimary,
      normalizedIndexDef: t.normalizedIndexDef,
      // trigger names/type/enabled/relation preserved; function OID may change with body replace
      triggersShape: (t.triggerNameTypeEnabledRelationFunctionOid || []).map((x) => ({
        n: x.n,
        t: x.t,
        e: x.e,
        r: x.r,
        fn: x.fn,
      })),
    };
  }
  return {
    idem: stripTable(fp.idem),
    audit: stripTable(fp.audit),
    unrelated: fp.unrelated,
    rows: fp.rows,
  };
}

/** Approved delta after first Migration B apply. */
function extractApprovedDelta(fp) {
  function colNull(t, name) {
    const c = (t.allColumnMetadata || []).find((x) => x.n === name);
    return c ? c.null : null;
  }
  function checkNames(t) {
    return (t.pkAndPreexistingConstraints || [])
      .filter((c) => c.t === 'c')
      .map((c) => c.n)
      .sort();
  }
  return {
    idemLegacyNull: colNull(fp.idem, 'target_memory_id'),
    auditLegacyNull: colNull(fp.audit, 'memory_id'),
    idemKindNull: colNull(fp.idem, 'target_kind'),
    idemIdNull: colNull(fp.idem, 'target_id'),
    auditKindNull: colNull(fp.audit, 'target_kind'),
    auditIdNull: colNull(fp.audit, 'target_id'),
    checks: {
      idem: checkNames(fp.idem),
      audit: checkNames(fp.audit),
    },
    funcs: (fp.functionFullAttributeBodyFingerprint || []).map((f) => ({ n: f.n, h: f.h })),
  };
}

function fingerprintEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  COMPLETE_CATALOG_PROJECTION_FIELDS,
  getFullRowFingerprint,
  getCatalogFingerprint,
  getCompleteTableProjection,
  getColumnNames,
  getFunctionFingerprints,
  extractPreservationProjection,
  extractApprovedDelta,
  fingerprintEqual,
  ordinaryExists,
};
