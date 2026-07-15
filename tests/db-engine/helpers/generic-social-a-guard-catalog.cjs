'use strict';

/**
 * Catalog fingerprint helpers for Migration A execution-guard engine tests.
 * Full-row hashing in DB; returns count/hash only.
 * Refs #3536, #3534, #1882
 */

const ALLOWED = new Map([
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
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fail('INVALID_IDENT');
  return `"${name}"`;
}

async function query(client, text, params = []) {
  const res = await client.query(text, params);
  return res.rows;
}

async function ordinaryExists(client, table) {
  const rows = await query(
    client,
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relname=$1 AND c.relkind='r'`,
    [table]
  );
  return rows.length > 0;
}

async function getColumnNames(client, table) {
  if (!(await ordinaryExists(client, table))) return [];
  const rows = await query(
    client,
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
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

async function getCatalogFingerprint(client) {
  async function tableFp(table) {
    if (!(await ordinaryExists(client, table))) {
      return { exists: false, cols: [], checks: [], triggers: [] };
    }
    const cols = await query(
      client,
      `SELECT column_name, udt_name, is_nullable, (column_default IS NOT NULL) AS has_default,
              character_maximum_length
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table]
    );
    const checks = await query(
      client,
      `SELECT conname FROM pg_constraint
       WHERE conrelid=($1::text)::regclass AND contype='c' ORDER BY conname`,
      [`public.${table}`]
    );
    const triggers = await query(
      client,
      `SELECT tgname, tgtype::int AS tgtype, tgenabled::text AS en
       FROM pg_trigger WHERE tgrelid=($1::text)::regclass AND NOT tgisinternal
       ORDER BY tgname`,
      [`public.${table}`]
    );
    return {
      exists: true,
      cols: cols.map((c) => ({
        n: c.column_name,
        u: c.udt_name,
        null: c.is_nullable,
        d: c.has_default,
        len: c.character_maximum_length,
      })),
      checks: checks.map((c) => c.conname),
      triggers: triggers.map((t) => ({ n: t.tgname, t: t.tgtype, e: t.en })),
    };
  }
  const funcs = await query(
    client,
    `SELECT p.proname, l.lanname, p.prosecdef,
            md5(regexp_replace(coalesce(p.prosrc,''), '\\s+', ' ', 'g')) AS body_h
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
     JOIN pg_language l ON l.oid=p.prolang
     WHERE n.nspname='public' AND p.proname IN (
       'sync_social_idempotency_generic_target_from_legacy_memory',
       'sync_social_audit_generic_target_from_legacy_memory'
     )
     ORDER BY p.proname`
  );
  return {
    idem: await tableFp('social_idempotency'),
    audit: await tableFp('social_audit_log'),
    unrelated: await tableFp('lb_unrelated_marker'),
    funcs: funcs.map((f) => ({ n: f.proname, l: f.lanname, s: f.prosecdef, h: f.body_h })),
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

async function getBackfillOk(client) {
  const i = await query(
    client,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE target_kind='memory' AND target_id IS NOT DISTINCT FROM target_memory_id)::int AS ok
     FROM public.social_idempotency`
  );
  const a = await query(
    client,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE target_kind='memory' AND target_id IS NOT DISTINCT FROM memory_id)::int AS ok
     FROM public.social_audit_log`
  );
  return i[0].total === i[0].ok && a[0].total === a[0].ok && i[0].total > 0;
}

module.exports = {
  getColumnNames,
  getFullRowFingerprint,
  getCatalogFingerprint,
  fingerprintEqual,
  getBackfillOk,
  ordinaryExists,
};
