'use strict';

/**
 * Read-only PostgreSQL pg_catalog adapter for sanitized catalog fingerprints.
 *
 * Explicit disposable connection only. No client injection, no transaction bypass,
 * no DATABASE_URL / secrets / env fallback.
 *
 * Refs #3544, #3542, #3458, #3425
 */

const { Client } = require('pg');
const path = require('node:path');
const {
  defaultContractPath,
  loadJson,
  buildCatalogEvidence,
  canonicalizeCatalogObject,
  validateCatalogMetadataContract,
  compareCodePoint,
} = require('./migration-catalog-fingerprint-core.cjs');

const ADAPTER_FAILURE = Object.freeze({
  CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID: 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID',
  CATALOG_ADAPTER_SERVER_VERSION_MISMATCH: 'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH',
  CATALOG_ADAPTER_READ_ONLY_REQUIRED: 'CATALOG_ADAPTER_READ_ONLY_REQUIRED',
  CATALOG_ADAPTER_INPUT_INVALID: 'CATALOG_ADAPTER_INPUT_INVALID',
  CATALOG_ADAPTER_OBJECT_MISSING: 'CATALOG_ADAPTER_OBJECT_MISSING',
  CATALOG_ADAPTER_OBJECT_KIND_MISMATCH: 'CATALOG_ADAPTER_OBJECT_KIND_MISMATCH',
  CATALOG_ADAPTER_OBJECT_DUPLICATE: 'CATALOG_ADAPTER_OBJECT_DUPLICATE',
  CATALOG_ADAPTER_SCHEMA_PROHIBITED: 'CATALOG_ADAPTER_SCHEMA_PROHIBITED',
  CATALOG_ADAPTER_CATALOG_SHAPE_INVALID: 'CATALOG_ADAPTER_CATALOG_SHAPE_INVALID',
  CATALOG_ADAPTER_ROLE_MAPPING_INVALID: 'CATALOG_ADAPTER_ROLE_MAPPING_INVALID',
  CATALOG_ADAPTER_GRANTEE_UNMAPPED: 'CATALOG_ADAPTER_GRANTEE_UNMAPPED',
  CATALOG_ADAPTER_BOUNDS_EXCEEDED: 'CATALOG_ADAPTER_BOUNDS_EXCEEDED',
  CATALOG_ADAPTER_QUERY_FAILED: 'CATALOG_ADAPTER_QUERY_FAILED',
  CATALOG_ADAPTER_SANITIZATION_FAILED: 'CATALOG_ADAPTER_SANITIZATION_FAILED',
  CATALOG_ADAPTER_MUTATION_DETECTED: 'CATALOG_ADAPTER_MUTATION_DETECTED',
  CATALOG_ADAPTER_UNSUPPORTED_RELATION: 'CATALOG_ADAPTER_UNSUPPORTED_RELATION',
});

const REQUIRED_SERVER_VERSION_NUM = 170004;
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROHIBITED_SCHEMAS = new Set([
  'pg_catalog',
  'information_schema',
  'pg_toast',
  'pg_temp',
  'pg_toast_temp',
]);
const SUPPORTED_KINDS = new Set(['TABLE', 'VIEW', 'MATERIALIZED_VIEW']);
const RELKIND_BY_OBJECT_KIND = Object.freeze({
  TABLE: 'r',
  VIEW: 'v',
  MATERIALIZED_VIEW: 'm',
});
const OBJECT_KIND_BY_RELKIND = Object.freeze({
  r: 'TABLE',
  v: 'VIEW',
  m: 'MATERIALIZED_VIEW',
});
const GRANTEE_CLASSES = new Set([
  'PUBLIC',
  'APPLICATION',
  'AUTHENTICATED',
  'SERVICE',
  'OWNER_CLASS',
]);
const PRIVILEGE_MAP = Object.freeze({
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  TRUNCATE: 'TRUNCATE',
  REFERENCES: 'REFERENCES',
  TRIGGER: 'TRIGGER',
});

/** Repository-owned query constants only. */
const Q = Object.freeze({
  BEGIN_RO: 'BEGIN READ ONLY',
  SHOW_RO: 'SHOW transaction_read_only',
  SHOW_VER: 'SHOW server_version_num',
  ROLLBACK: 'ROLLBACK',
  // No relkind filter — classify missing vs unsupported after fetch.
  RELATION: `SELECT c.oid::bigint AS oid,
            c.relkind::text AS relkind,
            c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS rls_forced
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1
       AND c.relname = $2`,
  COLUMNS: `SELECT a.attname::text AS name,
            format_type(a.atttypid, a.atttypmod) AS type_identity,
            NOT a.attnotnull AS nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS default_definition,
            a.attgenerated::text AS attgenerated,
            a.attidentity::text AS attidentity
     FROM pg_attribute a
     LEFT JOIN pg_attrdef ad
       ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE a.attrelid = $1
       AND a.attnum > 0
       AND NOT a.attisdropped
     ORDER BY a.attnum`,
  CONSTRAINTS: `SELECT c.conname::text AS name,
            c.contype::text AS contype,
            c.convalidated AS validated,
            pg_get_constraintdef(c.oid, true) AS definition,
            c.confupdtype::text AS confupdtype,
            c.confdeltype::text AS confdeltype
     FROM pg_constraint c
     WHERE c.conrelid = $1
     ORDER BY c.conname`,
  INDEXES: `SELECT i.relname::text AS name,
            ix.indisprimary AS is_primary,
            ix.indisunique AS is_unique,
            ix.indisvalid AS is_valid,
            pg_get_indexdef(ix.indexrelid) AS definition
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     WHERE ix.indrelid = $1
     ORDER BY i.relname`,
  TRIGGERS: `SELECT t.tgname::text AS name,
            t.tgtype AS tgtype,
            t.tgenabled::text AS tgenabled,
            pg_get_triggerdef(t.oid, true) AS definition,
            n.nspname::text AS fn_schema,
            p.proname::text AS fn_name,
            pg_get_function_identity_arguments(p.oid) AS fn_args
     FROM pg_trigger t
     JOIN pg_proc p ON p.oid = t.tgfoid
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE t.tgrelid = $1
       AND NOT t.tgisinternal
     ORDER BY t.tgname`,
  POLICIES: `SELECT pol.polname::text AS name,
            pol.polcmd::text AS polcmd,
            pol.polpermissive AS permissive,
            pol.polroles::oid[] AS polroles,
            pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expression
     FROM pg_policy pol
     WHERE pol.polrelid = $1
     ORDER BY pol.polname`,
  ROLE_NAME: `SELECT rolname::text AS rolname FROM pg_roles WHERE oid = $1`,
  // Actual ACL including PUBLIC (grantee oid 0). Bounded explode; no raw dump.
  GRANTS: `SELECT
       CASE
         WHEN acl.grantee = 0 THEN 'PUBLIC'
         ELSE r.rolname::text
       END AS grantee,
       acl.privilege_type::text AS privilege_type,
       acl.is_grantable AS is_grantable
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN LATERAL aclexplode(c.relacl) AS acl(grantor, grantee, privilege_type, is_grantable)
     LEFT JOIN pg_roles r ON r.oid = acl.grantee AND acl.grantee <> 0
     WHERE n.nspname = $1
       AND c.relname = $2
       AND c.relacl IS NOT NULL`,
  VIEWDEF: `SELECT pg_get_viewdef($1::oid, true) AS def`,
});

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context && typeof context === 'object' ? { ...context } : {};
  throw err;
}

function assertIdentifier(value, field) {
  if (typeof value !== 'string' || !value || !IDENT_RE.test(value) || value.length > 63) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field });
  }
  if (value !== value.trim()) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field });
  }
}

function isProhibitedSchema(schema) {
  if (PROHIBITED_SCHEMAS.has(schema)) return true;
  if (schema.startsWith('pg_temp') || schema.startsWith('pg_toast_temp')) return true;
  return false;
}

/** Pure: true only when SHOW transaction_read_only reports on. */
function isTransactionReadOnlyOn(value) {
  return String(value).toLowerCase() === 'on';
}

/** Pure: parse server_version_num. */
function parseServerVersionNum(value) {
  return Number(value);
}

/** Pure: map relkind to supported object kind or null if unsupported. */
function objectKindFromRelkind(relkind) {
  return OBJECT_KIND_BY_RELKIND[relkind] || null;
}

/**
 * Pure classifier for relation lookup rows.
 * @returns {{ oid, relkind, rls_enabled, rls_forced, object_kind }}
 */
function classifyRelationRows(rows, expectedKind) {
  if (!Array.isArray(rows) || rows.length === 0) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_MISSING);
  }
  if (rows.length > 1) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'relation' });
  }
  const row = rows[0];
  const actualKind = objectKindFromRelkind(row.relkind);
  if (!actualKind) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_UNSUPPORTED_RELATION);
  }
  if (actualKind !== expectedKind) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_KIND_MISMATCH);
  }
  return {
    oid: row.oid,
    relkind: row.relkind,
    rls_enabled: Boolean(row.rls_enabled),
    rls_forced: Boolean(row.rls_forced),
    object_kind: actualKind,
  };
}

function mapFkAction(code) {
  switch (code) {
    case 'a':
      return 'NO_ACTION';
    case 'r':
      return 'RESTRICT';
    case 'c':
      return 'CASCADE';
    case 'n':
      return 'SET_NULL';
    case 'd':
      return 'SET_DEFAULT';
    default:
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'fk_action' });
  }
}

function mapConstraintKind(contype) {
  switch (contype) {
    case 'p':
      return 'PRIMARY_KEY';
    case 'u':
      return 'UNIQUE';
    case 'c':
      return 'CHECK';
    case 'f':
      return 'FOREIGN_KEY';
    case 'x':
      return 'EXCLUSION';
    default:
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'constraint_kind' });
  }
}

function mapGenerated(attgenerated) {
  if (attgenerated === 's') return 'STORED';
  if (!attgenerated) return 'NONE';
  fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'generated_kind' });
}

function mapIdentity(attidentity) {
  if (attidentity === 'a') return 'ALWAYS';
  if (attidentity === 'd') return 'BY_DEFAULT';
  if (!attidentity) return 'NONE';
  fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'identity_kind' });
}

function decodeTriggerType(tgtype) {
  const type = Number(tgtype);
  const level = type & 1 ? 'ROW' : 'STATEMENT';
  let timing = 'AFTER';
  if (type & 2) timing = 'BEFORE';
  else if (type & 64) timing = 'INSTEAD_OF';
  const events = [];
  if (type & 4) events.push('INSERT');
  if (type & 8) events.push('DELETE');
  if (type & 16) events.push('UPDATE');
  if (type & 32) events.push('TRUNCATE');
  if (events.length === 0) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'events' });
  }
  events.sort(compareCodePoint);
  return { timing, events, level };
}

function mapTriggerEnabled(tgenabled) {
  switch (tgenabled) {
    case 'O':
      return 'ORIGIN';
    case 'D':
      return 'DISABLED';
    case 'R':
      return 'REPLICA';
    case 'A':
      return 'ALWAYS';
    default:
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'enabled' });
  }
}

function mapPolicyCommand(polcmd) {
  switch (polcmd) {
    case '*':
      return 'ALL';
    case 'r':
      return 'SELECT';
    case 'a':
      return 'INSERT';
    case 'w':
      return 'UPDATE';
    case 'd':
      return 'DELETE';
    default:
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'command' });
  }
}

function mapPrivilegeType(priv) {
  if (typeof priv !== 'string' || !PRIVILEGE_MAP[priv]) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'privilege' });
  }
  return PRIVILEGE_MAP[priv];
}

function mapGranteeToClass(grantee, roleMap) {
  if (grantee == null || grantee === '') {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_GRANTEE_UNMAPPED);
  }
  const key = String(grantee).toLowerCase();
  if (key === 'public') return 'PUBLIC';
  if (!roleMap.has(key)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_GRANTEE_UNMAPPED);
  }
  return roleMap.get(key);
}

function canonicalObjectName(schema, objectName, objectKind) {
  if (objectKind === 'TABLE') return `table:${schema}.${objectName}`;
  if (objectKind === 'VIEW') return `view:${schema}.${objectName}`;
  if (objectKind === 'MATERIALIZED_VIEW') return `materialized_view:${schema}.${objectName}`;
  fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'object_kind' });
}

function validateConnectionConfig(connection) {
  if (!connection || typeof connection !== 'object' || Array.isArray(connection)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID);
  }
  const { host, port, user, password, database } = connection;
  if (
    typeof host !== 'string' ||
    typeof user !== 'string' ||
    typeof password !== 'string' ||
    typeof database !== 'string'
  ) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID);
  }
  if (!host || !user || !password || !database) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID);
  }
  if (!ALLOWED_HOSTS.has(host)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID, { field: 'host' });
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID, { field: 'port' });
  }
  if (!database.startsWith('lovebud_ci_')) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID, { field: 'database' });
  }
  return {
    host,
    port: portNum,
    user,
    password,
    database,
    connectionTimeoutMillis: 10000,
  };
}

function validateRoleMapping(roleMapping) {
  if (!roleMapping || typeof roleMapping !== 'object' || Array.isArray(roleMapping)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_ROLE_MAPPING_INVALID);
  }
  const keys = Object.keys(roleMapping);
  if (keys.length === 0 || keys.length > 64) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_ROLE_MAPPING_INVALID);
  }
  const map = new Map();
  for (const raw of keys) {
    assertIdentifier(raw, 'role_mapping.key');
    const cls = roleMapping[raw];
    if (typeof cls !== 'string' || !GRANTEE_CLASSES.has(cls)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_ROLE_MAPPING_INVALID);
    }
    if (map.has(raw.toLowerCase())) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_ROLE_MAPPING_INVALID);
    }
    map.set(raw.toLowerCase(), cls);
  }
  if (!map.has('public')) {
    map.set('public', 'PUBLIC');
  }
  return map;
}

function validateObjectAllowlist(objects, maxObjects) {
  if (!Array.isArray(objects) || objects.length === 0) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'objects' });
  }
  if (objects.length > maxObjects) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_BOUNDS_EXCEEDED, { field: 'objects' });
  }
  const seen = new Set();
  const out = [];
  for (const item of objects) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'object' });
    }
    for (const k of Object.keys(item)) {
      if (k !== 'schema' && k !== 'object_name' && k !== 'object_kind') {
        fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: k });
      }
    }
    if (item.fingerprint !== undefined || item.name !== undefined) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'fingerprint' });
    }
    assertIdentifier(item.schema, 'schema');
    assertIdentifier(item.object_name, 'object_name');
    if (!SUPPORTED_KINDS.has(item.object_kind)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'object_kind' });
    }
    if (isProhibitedSchema(item.schema)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SCHEMA_PROHIBITED, { field: 'schema' });
    }
    const key = `${item.schema}.${item.object_name}.${item.object_kind}`;
    if (seen.has(key)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_DUPLICATE);
    }
    const idKey = `${item.schema}.${item.object_name}`;
    if (seen.has(`id:${idKey}`)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_OBJECT_DUPLICATE);
    }
    seen.add(key);
    seen.add(`id:${idKey}`);
    out.push({
      schema: item.schema,
      object_name: item.object_name,
      object_kind: item.object_kind,
    });
  }
  out.sort((a, b) =>
    compareCodePoint(
      canonicalObjectName(a.schema, a.object_name, a.object_kind),
      canonicalObjectName(b.schema, b.object_name, b.object_kind)
    )
  );
  return out;
}

function rejectBypassOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID);
  }
  if (Object.prototype.hasOwnProperty.call(options, 'client')) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'client' });
  }
  if (Object.prototype.hasOwnProperty.call(options, 'manageTransaction')) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'manageTransaction' });
  }
}

// --- Pure row mappers (unit-testable; no DB) ---

function mapColumnRows(rows) {
  if (!Array.isArray(rows)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'columns' });
  }
  return rows.map((row) => ({
    name: row.name,
    type_identity: row.type_identity,
    nullable: Boolean(row.nullable),
    default_definition: row.default_definition == null ? null : String(row.default_definition),
    generated_kind: mapGenerated(row.attgenerated || ''),
    identity_kind: mapIdentity(row.attidentity || ''),
  }));
}

function mapConstraintRows(rows) {
  if (!Array.isArray(rows)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'constraints' });
  }
  return rows.map((row) => {
    const kind = mapConstraintKind(row.contype);
    const isFk = kind === 'FOREIGN_KEY';
    return {
      name: row.name,
      constraint_kind: kind,
      validated: Boolean(row.validated),
      definition: String(row.definition),
      fk_on_update: isFk ? mapFkAction(row.confupdtype) : null,
      fk_on_delete: isFk ? mapFkAction(row.confdeltype) : null,
    };
  });
}

function mapIndexRows(rows) {
  if (!Array.isArray(rows)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'indexes' });
  }
  return rows.map((row) => ({
    name: row.name,
    primary: Boolean(row.is_primary),
    unique: Boolean(row.is_unique),
    valid: Boolean(row.is_valid),
    definition: String(row.definition),
  }));
}

function mapTriggerRows(rows) {
  if (!Array.isArray(rows)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'triggers' });
  }
  return rows.map((row) => {
    const decoded = decodeTriggerType(row.tgtype);
    const fnArgs = row.fn_args == null ? '' : String(row.fn_args);
    return {
      name: row.name,
      timing: decoded.timing,
      events: decoded.events,
      level: decoded.level,
      enabled: mapTriggerEnabled(row.tgenabled),
      function_identity: `${row.fn_schema}.${row.fn_name}(${fnArgs})`,
      definition: String(row.definition),
    };
  });
}

/**
 * Pure grant aggregation from ACL rows.
 * Unknown privilege types fail closed (no silent continue).
 */
function mapGrantRows(rows, roleMap) {
  if (!Array.isArray(rows)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'grants' });
  }
  const buckets = new Map();
  for (const row of rows) {
    const priv = mapPrivilegeType(row.privilege_type);
    const granteeClass = mapGranteeToClass(row.grantee, roleMap);
    const grantable = row.is_grantable === true || String(row.is_grantable).toUpperCase() === 'YES';
    const key = `${granteeClass}|${grantable ? '1' : '0'}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        grantee_class: granteeClass,
        grantable,
        privileges: new Set(),
      });
    }
    buckets.get(key).privileges.add(priv);
  }
  const grants = [];
  for (const item of buckets.values()) {
    const privileges = [...item.privileges].sort(compareCodePoint);
    grants.push({
      grantee_class: item.grantee_class,
      privileges,
      grantable: item.grantable,
    });
  }
  grants.sort((a, b) =>
    compareCodePoint(
      `${a.grantee_class}|${a.grantable}`,
      `${b.grantee_class}|${b.grantable}`
    )
  );
  return grants;
}

/**
 * Assemble a raw metadata object from classified relation + component rows.
 * Pure except optional async policy role resolution is pre-done by caller.
 */
function assembleRawCatalogObject(target, rel, components) {
  let { columns, constraints, indexes, triggers, policies, grants, viewDefinition } = components;
  if (target.object_kind === 'VIEW') {
    constraints = [];
    indexes = [];
    triggers = [];
    policies = [];
  }
  if (target.object_kind === 'MATERIALIZED_VIEW') {
    constraints = [];
    triggers = [];
    policies = [];
  }
  if (target.object_kind !== 'TABLE') {
    policies = [];
  }
  return {
    schema: target.schema,
    object_name: target.object_name,
    object_kind: target.object_kind,
    relation_kind: RELKIND_BY_OBJECT_KIND[target.object_kind],
    columns,
    constraints,
    indexes,
    triggers,
    row_level_security: {
      enabled: Boolean(rel.rls_enabled),
      forced: Boolean(rel.rls_forced),
      policies: policies || [],
    },
    grants: grants || [],
    view_definition: viewDefinition,
  };
}

/**
 * Canonicalize and sort objects for deterministic metadata return.
 * Uses #3542 canonicalizeCatalogObject.
 */
function toCanonicalMetadata(rawObjects, contract) {
  const objects = [];
  for (const raw of rawObjects) {
    try {
      objects.push(canonicalizeCatalogObject(raw, contract));
    } catch (error) {
      if (error && error.category && String(error.category).startsWith('CATALOG_')) {
        fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED, { field: error.category });
      }
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED);
    }
  }
  objects.sort((a, b) =>
    compareCodePoint(
      canonicalObjectName(a.schema, a.object_name, a.object_kind),
      canonicalObjectName(b.schema, b.object_name, b.object_kind)
    )
  );
  return {
    format_version: contract.format_version,
    normalizer_version: contract.normalizer_version,
    objects,
  };
}

async function safeQuery(client, text, params) {
  try {
    return await client.query(text, params);
  } catch {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_QUERY_FAILED);
  }
}

async function collectPolicies(client, oid, roleMap) {
  const res = await safeQuery(client, Q.POLICIES, [oid]);
  const policies = [];
  for (const row of res.rows) {
    const roleOids = row.polroles || [];
    let roleScope;
    if (roleOids.length === 0) {
      roleScope = 'PUBLIC';
    } else {
      const classes = new Set();
      for (const oidVal of roleOids) {
        const oidNum = Number(oidVal);
        if (oidNum === 0) {
          classes.add('PUBLIC');
          continue;
        }
        const roleRes = await safeQuery(client, Q.ROLE_NAME, [oidNum]);
        if (roleRes.rows.length !== 1) {
          fail(ADAPTER_FAILURE.CATALOG_ADAPTER_GRANTEE_UNMAPPED);
        }
        classes.add(mapGranteeToClass(roleRes.rows[0].rolname, roleMap));
      }
      if (classes.size !== 1) {
        fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'role_scope' });
      }
      roleScope = [...classes][0];
    }
    policies.push({
      name: row.name,
      command: mapPolicyCommand(row.polcmd),
      permissive: Boolean(row.permissive),
      role_scope: roleScope,
      using_expression: row.using_expression == null ? null : String(row.using_expression),
      check_expression: row.check_expression == null ? null : String(row.check_expression),
    });
  }
  return policies;
}

async function fetchRawObject(client, target, roleMap) {
  const relRes = await safeQuery(client, Q.RELATION, [target.schema, target.object_name]);
  const rel = classifyRelationRows(relRes.rows, target.object_kind);

  const colRes = await safeQuery(client, Q.COLUMNS, [rel.oid]);
  const conRes = await safeQuery(client, Q.CONSTRAINTS, [rel.oid]);
  const idxRes = await safeQuery(client, Q.INDEXES, [rel.oid]);
  const tgRes = await safeQuery(client, Q.TRIGGERS, [rel.oid]);
  const grantRes = await safeQuery(client, Q.GRANTS, [target.schema, target.object_name]);

  let viewDefinition = null;
  if (target.object_kind !== 'TABLE') {
    const vd = await safeQuery(client, Q.VIEWDEF, [rel.oid]);
    if (vd.rows.length !== 1 || vd.rows[0].def == null || !String(vd.rows[0].def).trim()) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CATALOG_SHAPE_INVALID, { field: 'view_definition' });
    }
    viewDefinition = String(vd.rows[0].def);
  }

  const policies =
    target.object_kind === 'TABLE' ? await collectPolicies(client, rel.oid, roleMap) : [];

  return assembleRawCatalogObject(target, rel, {
    columns: mapColumnRows(colRes.rows),
    constraints: mapConstraintRows(conRes.rows),
    indexes: mapIndexRows(idxRes.rows),
    triggers: mapTriggerRows(tgRes.rows),
    policies,
    grants: mapGrantRows(grantRes.rows, roleMap),
    viewDefinition,
  });
}

/**
 * Public collection API — always owns connection and READ ONLY transaction.
 * No options.client / manageTransaction.
 */
async function collectCatalogMetadata(options) {
  rejectBypassOptions(options);
  const contract = options.contract;
  if (!contract) fail(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID, { field: 'contract' });
  try {
    validateCatalogMetadataContract(contract);
  } catch {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED);
  }

  if (options.connection === undefined || options.connection === null) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID);
  }
  const cfg = validateConnectionConfig(options.connection);
  const maxObjects =
    contract.limits && contract.limits.max_objects ? contract.limits.max_objects : 256;
  const objects = validateObjectAllowlist(options.objects, maxObjects);
  const roleMap = validateRoleMapping(options.roleMapping);

  const client = new Client(cfg);
  let startedTxn = false;
  try {
    try {
      await client.connect();
    } catch {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_QUERY_FAILED);
    }

    await safeQuery(client, Q.BEGIN_RO, []);
    startedTxn = true;

    const ro = await safeQuery(client, Q.SHOW_RO, []);
    const roVal = ro.rows[0] && (ro.rows[0].transaction_read_only || Object.values(ro.rows[0])[0]);
    if (!isTransactionReadOnlyOn(roVal)) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED);
    }

    const ver = await safeQuery(client, Q.SHOW_VER, []);
    const verRaw = ver.rows[0] && (ver.rows[0].server_version_num || Object.values(ver.rows[0])[0]);
    if (parseServerVersionNum(verRaw) !== REQUIRED_SERVER_VERSION_NUM) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SERVER_VERSION_MISMATCH);
    }

    const rawObjects = [];
    for (const target of objects) {
      rawObjects.push(await fetchRawObject(client, target, roleMap));
    }

    const metadata = toCanonicalMetadata(rawObjects, contract);

    // Prove evidence path accepts this metadata.
    try {
      buildCatalogEvidence(metadata, contract);
    } catch (error) {
      if (error && error.category && String(error.category).startsWith('CATALOG_')) {
        fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED, { field: error.category });
      }
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED);
    }

    return metadata;
  } finally {
    if (startedTxn) {
      try {
        await client.query(Q.ROLLBACK);
      } catch {
        // ignore
      }
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function collectCatalogEvidence(options) {
  const metadata = await collectCatalogMetadata(options);
  try {
    return buildCatalogEvidence(metadata, options.contract);
  } catch (error) {
    if (error && error.category) {
      fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED, { field: error.category });
    }
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_SANITIZATION_FAILED);
  }
}

/**
 * Full-scope no-mutation proof via two independent read-only collections.
 * Uses complete evidence (not name-only state).
 */
async function assertNoCatalogMutation(options) {
  const a = await collectCatalogEvidence(options);
  const b = await collectCatalogEvidence(options);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail(ADAPTER_FAILURE.CATALOG_ADAPTER_MUTATION_DETECTED);
  }
  return a;
}

function loadContract(repoRoot) {
  return loadJson(defaultContractPath(repoRoot || path.resolve(__dirname, '..')));
}

function executeArbitrarySql() {
  fail(ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED);
}

module.exports = {
  ADAPTER_FAILURE,
  REQUIRED_SERVER_VERSION_NUM,
  Q,
  validateConnectionConfig,
  validateRoleMapping,
  validateObjectAllowlist,
  collectCatalogMetadata,
  collectCatalogEvidence,
  assertNoCatalogMutation,
  loadContract,
  executeArbitrarySql,
  defaultContractPath,
  buildCatalogEvidence,
  // Pure helpers for source-static tests (no DB / no client injection).
  isTransactionReadOnlyOn,
  parseServerVersionNum,
  objectKindFromRelkind,
  classifyRelationRows,
  mapColumnRows,
  mapConstraintRows,
  mapIndexRows,
  mapTriggerRows,
  mapGrantRows,
  mapPrivilegeType,
  assembleRawCatalogObject,
  toCanonicalMetadata,
  canonicalObjectName,
};
