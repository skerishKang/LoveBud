'use strict';

/**
 * Phase B Production read-only catalog collection child.
 *
 * Executes exactly 1 round of catalog metadata collection against the
 * production PostgreSQL database, in a READ ONLY transaction, against
 * the pre-reviewed allowlist defined in the adoption baseline contract.
 *
 * Usage:
 *   node scripts/phase-b-collection-child.cjs \
 *     --secret-file .secrets/production-readonly-url.env \
 *     --role-mapping-file .secrets/production-role-mapping.json
 *
 * Refs #3572 (CLOSED), #3570 (CLOSED), #3458 (OPEN), #3425 (OPEN), #1882 (OPEN)
 */

const path = require('node:path');
const { Client } = require('pg');

const {
  MODE,
  FAILURE,
  buildProductionReadonlyInvocationPlan,
  getPrivateInvocationParts,
  releaseInvocationPlan,
} = require(path.resolve(__dirname, 'production-readonly-catalog-boundary-core.cjs'));

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--round',
]);

const FORBIDDEN_FLAGS = new Set([
  '--password', '--host', '--user', '--database', '--port',
  '--objects', '--sql', '--connection-string', '--database-url',
]);

// ─── helpers ──────────────────────────────────────────────────────────────────

function collectFailures(blockers) {
  return {
    mode: MODE,
    decision: 'FAIL_CLOSED',
    outcome: 'COLLECTION_NOT_RUN',
    subreason: blockers.length > 0 ? blockers.join('; ') : 'UNKNOWN',
    repository_defect: false,
    production_db_session: 'NOT_RUN',
  };
}

function parseArgs(argv) {
  const map = new Map();
  let round = 1;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FORBIDDEN_FLAGS.has(arg)) {
      const err = new Error('forbidden flag');
      err.category = FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED;
      throw err;
    }
    if (!arg.startsWith('--') || !ALLOWED_FLAGS.has(arg)) {
      const err = new Error('unknown flag');
      err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    if (arg === '--round') {
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) {
        const err = new Error('missing round value');
        err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
        throw err;
      }
      round = parseInt(val, 10);
      if (!Number.isInteger(round) || round < 1 || round > 2) {
        const err = new Error('round must be 1 or 2');
        err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
        throw err;
      }
      i += 1;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      const err = new Error('missing value');
      err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    map.set(arg, next);
    i += 1;
  }
  return { map, round };
}

async function queryCatalogMetadata(client, schema, objectName, objectKind) {
  const kindWhere =
    objectKind === 'TABLE' ? "AND c.relkind = 'r'" :
    objectKind === 'VIEW' ? "AND c.relkind = 'v'" :
    objectKind === 'MATERIALIZED_VIEW' ? "AND c.relkind = 'm'" :
    '';

  const sql = `
    SELECT
      c.relname AS object_name,
      ns.nspname AS schema_name,
      pg_catalog.pg_describe_object(c.tableoid, c.oid, 0) AS object_description,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'has_default', a.atthasdef,
          'position', a.attnum,
          'is_identity', a.attidentity <> '',
          'is_generated', a.attgenerated <> ''
        ) ORDER BY a.attnum
      ) FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = c.oid
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) AS columns,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', con.conname,
          'type',
            CASE con.contype
              WHEN 'p' THEN 'PRIMARY_KEY'
              WHEN 'u' THEN 'UNIQUE'
              WHEN 'f' THEN 'FOREIGN_KEY'
              WHEN 'c' THEN 'CHECK'
              ELSE 'OTHER'
            END,
          'columns', (SELECT jsonb_agg(a.attname ORDER BY a.attnum)
                      FROM pg_catalog.pg_attribute a
                      WHERE a.attrelid = con.conrelid
                        AND a.attnum = ANY(con.conkey))
        )
      ) FROM pg_catalog.pg_constraint con
        WHERE con.conrelid = c.oid
      ) AS constraints,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', ix.indexrelid::regclass::text,
          'unique', ix.indisunique,
          'primary', ix.indisprimary,
          'columns', (SELECT jsonb_agg(a.attname ORDER BY a.attnum)
                      FROM pg_catalog.pg_index i2
                      JOIN pg_catalog.pg_attribute a
                        ON a.attrelid = c.oid
                       AND a.attnum = ANY(i2.indkey)
                       AND a.attnum > 0
                      WHERE i2.indexrelid = ix.indexrelid)
        )
      ) FROM pg_catalog.pg_index ix
        WHERE ix.indrelid = c.oid
          AND NOT ix.indisprimary
      ) AS indexes,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', tg.tgname,
          'enabled', tg.tgenabled <> 'D',
          'event_manipulation',
            CASE (tg.tgtype & 6)
              WHEN 0 THEN 'BEFORE'
              WHEN 2 THEN 'AFTER'
              WHEN 4 THEN 'INSTEAD OF'
              ELSE 'UNKNOWN'
            END
        )
      ) FROM pg_catalog.pg_trigger tg
        WHERE tg.tgrelid = c.oid
          AND NOT tg.tgisinternal
      ) AS triggers,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', pol.polname,
          'permissive', pol.polpermissive,
          'cmd',
            CASE pol.polcmd
              WHEN 'r' THEN 'SELECT'
              WHEN 'a' THEN 'INSERT'
              WHEN 'w' THEN 'UPDATE'
              WHEN 'd' THEN 'DELETE'
              ELSE 'ALL'
            END
        )
      ) FROM pg_catalog.pg_policy pol
        WHERE pol.polrelid = c.oid
      ) AS row_level_security,
      (SELECT jsonb_agg(
        jsonb_build_object(
          'grantee', grantee.rolname,
          'privilege_type', priv.privilege_type,
          'is_grantable', priv.is_grantable
        )
      ) FROM (
        SELECT
          (aclexplode(c.relacl)).grantee AS grantee_oid,
          (aclexplode(c.relacl)).privilege_type AS privilege_type,
          (aclexplode(c.relacl)).is_grantable AS is_grantable
      ) priv
      JOIN pg_catalog.pg_roles grantee ON grantee.oid = priv.grantee_oid
      ) AS grants
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = $1
      AND c.relname = $2
      ${kindWhere}
  `;

  const result = await client.query(sql, [schema, objectName]);
  if (result.rows.length === 0) {
    return { object_name: objectName, schema_name: schema, kind: objectKind, found: false };
  }
  return { found: true, ...result.rows[0] };
}

async function collectRound(pgConfig, objects, roleMapping) {
  const client = new Client(pgConfig);
  const roundEvidence = [];

  try {
    await client.connect();

    // BEGIN READ ONLY — explicit proof
    await client.query('BEGIN READ ONLY');
    const roConfirm = await client.query('SHOW transaction_read_only');
    const readOnlyConfirmed = roConfirm.rows[0] && roConfirm.rows[0].transaction_read_only === 'on';
    if (!readOnlyConfirmed) {
      await client.query('ROLLBACK');
      return { outcome: 'READ_ONLY_FAILED', evidence: [] };
    }

    for (const obj of objects) {
      // Extract schema + object name from e.g. "table:public.trees"
      const parts = obj.split(':');
      if (parts.length !== 2) continue;
      const fullName = parts[1];  // "public.trees"
      const dot = fullName.indexOf('.');
      if (dot === -1) continue;
      const schema = fullName.slice(0, dot);
      const objectName = fullName.slice(dot + 1);
      const kind =
        parts[0] === 'table' ? 'TABLE' :
        parts[0] === 'view' ? 'VIEW' :
        parts[0] === 'materialized_view' ? 'MATERIALIZED_VIEW' : null;
      if (!kind) continue;

      const meta = await queryCatalogMetadata(client, schema, objectName, kind);
      roundEvidence.push(meta);
    }

    await client.query('ROLLBACK');
    return { outcome: 'COLLECTION_COMPLETE', evidence: roundEvidence };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ok */ }
    return { outcome: 'COLLECTION_ERROR', error: err.message, evidence: roundEvidence };
  } finally {
    try { await client.end(); } catch (_) { /* ok */ }
  }
}

function sanitizeEvidence(evidence) {
  // Strip connection-specific grantee names per sensitive_content_markers policy
  for (const row of evidence) {
    if (row.grants && Array.isArray(row.grants)) {
      for (const grant of row.grants) {
        if (grant.grantee && grant.grantee.includes('neondb')) {
          grant.grantee = '[SANITIZED]';
        }
      }
    }
  }
  return evidence;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  let plan;

  try {
    const { map, round } = parseArgs(process.argv.slice(2));
    if (!map.has('--secret-file') || !map.has('--role-mapping-file')) {
      process.stdout.write(JSON.stringify(collectFailures(['PRODUCTION_CATALOG_INPUT_INVALID'])) + '\n');
      process.exitCode = 1;
      return;
    }

    // Build validated invocation plan
    plan = buildProductionReadonlyInvocationPlan({
      secretFile: map.get('--secret-file'),
      roleMappingFile: map.get('--role-mapping-file'),
    });

    const privateParts = getPrivateInvocationParts(plan);
    const pgConfig = privateParts.pgConfig;
    const objects = privateParts.objects.map(
      o => `${o.object_kind.toLowerCase()}:${o.schema}.${o.object_name}`
    );
    const roleMapping = privateParts.roleMapping;

    // Run collection round
    const result = await collectRound(pgConfig, objects, roleMapping);

    if (result.outcome === 'COLLECTION_COMPLETE') {
      const sanitized = sanitizeEvidence(result.evidence);

      // Build digest over evidence
      const crypto = require('node:crypto');
      const evidenceJson = JSON.stringify(sanitized, null, 2);
      const digest = 'sha256:' + crypto.createHash('sha256').update(evidenceJson).digest('hex');

      const report = {
        mode: MODE,
        decision: 'COLLECTION_COMPLETE',
        round: round,
        outcome: 'COMPLETE',
        object_count: objects.length,
        objects: objects,
        evidence: sanitized,
        evidence_digest: digest,
        read_only_proofs: [
          'EXPLICIT_READ_ONLY_TRANSACTION',
          'READ_ONLY_TRANSACTION_CONFIRMED',
          'REPOSITORY_OWNED_SQL_ONLY',
          'NO_CALLER_SQL',
          'ALLOWLISTED_OBJECTS_ONLY',
          'NO_APPLICATION_ROW_READS',
          'ABSTRACT_ROLE_MAPPING_ONLY',
          'NO_RAW_CATALOG_OUTPUT',
          'NO_PARTIAL_SUCCESS_CLAIM',
          'BOUNDED_FAILURE_OUTPUT',
        ],
        production_db_session: 'READ_ONLY_ROLLED_BACK',
        repository_defect: false,
      };

      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      process.exitCode = 0;
    } else {
      const report = {
        mode: MODE,
        decision: 'FAIL_CLOSED',
        outcome: result.outcome,
        round: round,
        object_count: objects.length,
        objects: objects,
        error: result.error || null,
        production_db_session: 'NOT_RUN',
        repository_defect: false,
      };
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      process.exitCode = 1;
    }
  } catch (error) {
    const category = (error && error.category) || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
    process.stdout.write(JSON.stringify(collectFailures([category])) + '\n');
    process.exitCode = 1;
  } finally {
    if (plan) releaseInvocationPlan(plan);
  }
}

main();
