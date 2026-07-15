'use strict';

/**
 * Canonical Migration A object fingerprints (PG 17.4 catalog).
 * Hash algorithm: SHA-256 over deterministic canonical UTF-8 strings.
 * Never logs raw definitions, bodies, or trigger DDL.
 *
 * Refs: #3536, #3534, #3458, #1882
 */

const crypto = require('node:crypto');

function normalizeWs(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .replace(/\s+/g, ' ');
}

function sha256Hex(canonical) {
  return crypto.createHash('sha256').update(String(canonical), 'utf8').digest('hex');
}

function joinParts(parts) {
  return parts.map((p) => (p == null ? '' : String(p))).join('\n');
}

const LABEL_ORDER = [
  'GENERIC_SOCIAL_A_IDEM_PAIR_CHECK_SHA256',
  'GENERIC_SOCIAL_A_IDEM_KIND_CHECK_SHA256',
  'GENERIC_SOCIAL_A_AUDIT_PAIR_CHECK_SHA256',
  'GENERIC_SOCIAL_A_AUDIT_KIND_CHECK_SHA256',
  'GENERIC_SOCIAL_A_IDEM_FUNCTION_SHA256',
  'GENERIC_SOCIAL_A_AUDIT_FUNCTION_SHA256',
  'GENERIC_SOCIAL_A_IDEM_TRIGGER_SHA256',
  'GENERIC_SOCIAL_A_AUDIT_TRIGGER_SHA256',
];

/**
 * Query catalog components only (no logging of raw text) and return label→hash map.
 * @param {import('pg').Client} client
 */
async function computeFingerprintMap(client) {
  const checkRows = await client.query(`
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name,
      con.contype::text AS contype,
      con.convalidated::text AS convalidated,
      pg_get_constraintdef(con.oid, false) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.conname = ANY ($1::text[])
    ORDER BY con.conname
  `, [[
    'social_idempotency_generic_target_pair_check',
    'social_idempotency_generic_target_kind_check',
    'social_audit_log_generic_target_pair_check',
    'social_audit_log_generic_target_kind_check',
  ]]);

  const byCon = new Map(checkRows.rows.map((r) => [r.constraint_name, r]));

  function checkHash(name) {
    const r = byCon.get(name);
    if (!r) return null;
    const canonical = joinParts([
      r.schema_name,
      r.table_name,
      r.constraint_name,
      r.contype,
      r.convalidated,
      normalizeWs(r.def),
    ]);
    return sha256Hex(canonical);
  }

  const fnRows = await client.query(`
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_function_result(p.oid) AS return_type,
      l.lanname AS language,
      p.prosecdef::text AS prosecdef,
      p.provolatile::text AS provolatile,
      p.proparallel::text AS proparallel,
      p.proleakproof::text AS proleakproof,
      p.proisstrict::text AS proisstrict,
      COALESCE(
        (
          SELECT string_agg(cfg, ',' ORDER BY cfg)
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        ),
        ''
      ) AS proconfig_norm,
      p.prosrc AS prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.proname = ANY ($1::text[])
    ORDER BY p.proname
  `, [[
    'sync_social_idempotency_generic_target_from_legacy_memory',
    'sync_social_audit_generic_target_from_legacy_memory',
  ]]);

  const byFn = new Map(fnRows.rows.map((r) => [r.function_name, r]));

  function functionHash(name) {
    const r = byFn.get(name);
    if (!r) return null;
    const canonical = joinParts([
      r.schema_name,
      r.function_name,
      r.identity_args,
      r.return_type,
      r.language,
      r.prosecdef,
      r.provolatile,
      r.proparallel,
      r.proleakproof,
      r.proisstrict,
      r.proconfig_norm,
      normalizeWs(r.prosrc),
    ]);
    return sha256Hex(canonical);
  }

  const tgRows = await client.query(`
    SELECT
      n.nspname AS schema_name,
      c.relname AS relation_name,
      t.tgname AS trigger_name,
      t.tgisinternal::text AS tgisinternal,
      t.tgtype::text AS tgtype,
      t.tgenabled::text AS tgenabled,
      pn.nspname AS func_schema,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_identity_args,
      pg_get_triggerdef(t.oid, false) AS triggerdef
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname = ANY ($1::text[])
    ORDER BY t.tgname
  `, [[
    'trg_social_idempotency_sync_generic_target',
    'trg_social_audit_log_sync_generic_target',
  ]]);

  const byTg = new Map(tgRows.rows.map((r) => [r.trigger_name, r]));

  function triggerHash(name) {
    const r = byTg.get(name);
    if (!r) return null;
    const canonical = joinParts([
      r.schema_name,
      r.relation_name,
      r.trigger_name,
      r.tgisinternal,
      r.tgtype,
      r.tgenabled,
      r.func_schema,
      r.func_name,
      r.func_identity_args,
      normalizeWs(r.triggerdef),
    ]);
    return sha256Hex(canonical);
  }

  const map = {
    GENERIC_SOCIAL_A_IDEM_PAIR_CHECK_SHA256: checkHash('social_idempotency_generic_target_pair_check'),
    GENERIC_SOCIAL_A_IDEM_KIND_CHECK_SHA256: checkHash('social_idempotency_generic_target_kind_check'),
    GENERIC_SOCIAL_A_AUDIT_PAIR_CHECK_SHA256: checkHash('social_audit_log_generic_target_pair_check'),
    GENERIC_SOCIAL_A_AUDIT_KIND_CHECK_SHA256: checkHash('social_audit_log_generic_target_kind_check'),
    GENERIC_SOCIAL_A_IDEM_FUNCTION_SHA256: functionHash(
      'sync_social_idempotency_generic_target_from_legacy_memory'
    ),
    GENERIC_SOCIAL_A_AUDIT_FUNCTION_SHA256: functionHash(
      'sync_social_audit_generic_target_from_legacy_memory'
    ),
    GENERIC_SOCIAL_A_IDEM_TRIGGER_SHA256: triggerHash('trg_social_idempotency_sync_generic_target'),
    GENERIC_SOCIAL_A_AUDIT_TRIGGER_SHA256: triggerHash('trg_social_audit_log_sync_generic_target'),
  };

  return map;
}

/**
 * Emit only stable label=hash lines. Never prints raw catalog text.
 * @param {Record<string, string|null>} map
 */
function printFingerprintLabels(map) {
  for (const label of LABEL_ORDER) {
    const value = map[label];
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
      throw new Error(`GENERIC_SOCIAL_A_FINGERPRINT_CAPTURE_FAILED missing_or_invalid=${label}`);
    }
    process.stdout.write(`${label}=${value}\n`);
  }
}

/**
 * SQL fragment helpers for validators: same normalization as Node.
 * Used only for documentation / static contracts; validators embed equivalent SQL.
 */
const SQL_NORMALIZE_EXPR = `trim(both from regexp_replace(replace(%s, E'\\r\\n', E'\\n'), E'\\\\s+', ' ', 'g'))`;

module.exports = {
  LABEL_ORDER,
  normalizeWs,
  sha256Hex,
  joinParts,
  computeFingerprintMap,
  printFingerprintLabels,
  SQL_NORMALIZE_EXPR,
};
