'use strict';

/**
 * Deterministic sanitized catalog fingerprint normalizer.
 * Source-only. No database, network, or shell.
 * Refs #3542, #3458, #3425
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const FAILURE = Object.freeze({
  CATALOG_INPUT_READ_FAILED: 'CATALOG_INPUT_READ_FAILED',
  CATALOG_INPUT_JSON_INVALID: 'CATALOG_INPUT_JSON_INVALID',
  CATALOG_INPUT_TOO_LARGE: 'CATALOG_INPUT_TOO_LARGE',
  CATALOG_FORMAT_VERSION_UNSUPPORTED: 'CATALOG_FORMAT_VERSION_UNSUPPORTED',
  CATALOG_NORMALIZER_VERSION_UNSUPPORTED: 'CATALOG_NORMALIZER_VERSION_UNSUPPORTED',
  CATALOG_TOP_LEVEL_FIELD_UNKNOWN: 'CATALOG_TOP_LEVEL_FIELD_UNKNOWN',
  CATALOG_OBJECT_FIELD_UNKNOWN: 'CATALOG_OBJECT_FIELD_UNKNOWN',
  CATALOG_FIELD_PROHIBITED: 'CATALOG_FIELD_PROHIBITED',
  CATALOG_SENSITIVE_MARKER_DETECTED: 'CATALOG_SENSITIVE_MARKER_DETECTED',
  CATALOG_REQUIRED_FIELD_MISSING: 'CATALOG_REQUIRED_FIELD_MISSING',
  CATALOG_FIELD_TYPE_INVALID: 'CATALOG_FIELD_TYPE_INVALID',
  CATALOG_OBJECT_KIND_UNSUPPORTED: 'CATALOG_OBJECT_KIND_UNSUPPORTED',
  CATALOG_OBJECT_IDENTITY_INVALID: 'CATALOG_OBJECT_IDENTITY_INVALID',
  CATALOG_OBJECT_DUPLICATE: 'CATALOG_OBJECT_DUPLICATE',
  CATALOG_COMPONENT_DUPLICATE: 'CATALOG_COMPONENT_DUPLICATE',
  CATALOG_ENUM_INVALID: 'CATALOG_ENUM_INVALID',
  CATALOG_BOUNDS_EXCEEDED: 'CATALOG_BOUNDS_EXCEEDED',
  CATALOG_DEFINITION_INVALID: 'CATALOG_DEFINITION_INVALID',
  CATALOG_DEFINITION_UNTERMINATED_QUOTE: 'CATALOG_DEFINITION_UNTERMINATED_QUOTE',
  CATALOG_DEFINITION_COMMENT_UNSUPPORTED: 'CATALOG_DEFINITION_COMMENT_UNSUPPORTED',
  CATALOG_OBJECT_SHAPE_INVALID: 'CATALOG_OBJECT_SHAPE_INVALID',
  EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH: 'EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH',
  GATE_CATALOG_NORMALIZER_VERSION_MISMATCH: 'GATE_CATALOG_NORMALIZER_VERSION_MISMATCH',
  GATE_CATALOG_FORMAT_VERSION_MISMATCH: 'GATE_CATALOG_FORMAT_VERSION_MISMATCH',
});

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context || {};
  throw err;
}

function compareCodePoint(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'number' });
    return JSON.stringify(value);
  }
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort(compareCodePoint);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'value' });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function defaultContractPath(repoRoot) {
  return path.join(repoRoot, 'db', 'migration-provenance', 'catalog-metadata-contract.json');
}

function validateCatalogMetadataContract(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'contract' });
  }
  if (contract.format_version !== '1.0') fail(FAILURE.CATALOG_FORMAT_VERSION_UNSUPPORTED);
  if (contract.normalizer_version !== '1.0') fail(FAILURE.CATALOG_NORMALIZER_VERSION_UNSUPPORTED);
  for (const key of [
    'allowed_top_level_fields',
    'supported_object_kinds',
    'limits',
    'enums',
    'fingerprint',
    'prohibited_object_fields',
  ]) {
    if (contract[key] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: key });
  }
  return true;
}

function hasControlOrNul(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) return true;
  }
  return false;
}

function assertIdentifier(value, field) {
  if (typeof value !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field });
  if (!value || value.trim() !== value || !value.trim()) {
    fail(FAILURE.CATALOG_OBJECT_IDENTITY_INVALID, { field });
  }
  if (value.length > 63) fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field });
  if (hasControlOrNul(value) || value.includes('/') || value.includes('\\') || value.includes('.')) {
    fail(FAILURE.CATALOG_OBJECT_IDENTITY_INVALID, { field });
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    fail(FAILURE.CATALOG_OBJECT_IDENTITY_INVALID, { field });
  }
}

function assertBoolean(value, field) {
  if (typeof value !== 'boolean') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field });
}

function assertEnum(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(FAILURE.CATALOG_ENUM_INVALID, { field });
  }
}

function assertNoSensitive(text, field) {
  if (typeof text !== 'string') return;
  const lower = text;
  const markers = [
    'postgres://',
    'postgresql://',
    'Authorization:',
    'Bearer ',
    'BEGIN PRIVATE KEY',
    'password=',
    'token=',
    'secret=',
  ];
  for (const marker of markers) {
    if (lower.includes(marker)) {
      fail(FAILURE.CATALOG_SENSITIVE_MARKER_DETECTED, { field });
    }
  }
}

function assertStringOrNull(value, field, maxLen) {
  if (value === null) return;
  if (typeof value !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field });
  if (value.length > maxLen) fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field });
  if (hasControlOrNul(value.replace(/\t|\n|\r/g, ''))) {
    // allow common whitespace in definitions; control chars otherwise fail in normalizer
  }
  assertNoSensitive(value, field);
}

function assertExactKeys(obj, allowed, categoryUnknown, categoryProhibited, prohibited) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'object' });
  }
  for (const key of Object.keys(obj)) {
    if (prohibited.includes(key)) fail(categoryProhibited, { field: key });
    if (!allowed.includes(key)) fail(categoryUnknown, { field: key });
  }
}

function normalizeSqlDefinition(input) {
  if (input === null) return null;
  if (typeof input !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'definition' });
  if (input.includes('\u0000')) fail(FAILURE.CATALOG_DEFINITION_INVALID, { field: 'definition' });

  let text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.normalize('NFC');

  let state = 'NORMAL';
  let dollarTag = null;
  let out = '';
  let i = 0;
  let pendingSpace = false;

  const flushSpace = () => {
    if (pendingSpace && out.length > 0) out += ' ';
    pendingSpace = false;
  };

  while (i < text.length) {
    const ch = text[i];
    const code = text.charCodeAt(i);

    if (state === 'NORMAL') {
      if (ch === '-' && text[i + 1] === '-') {
        fail(FAILURE.CATALOG_DEFINITION_COMMENT_UNSUPPORTED, { field: 'definition' });
      }
      if (ch === '/' && text[i + 1] === '*') {
        fail(FAILURE.CATALOG_DEFINITION_COMMENT_UNSUPPORTED, { field: 'definition' });
      }
      if (ch === "'") {
        flushSpace();
        state = 'SINGLE_QUOTED';
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        flushSpace();
        state = 'DOUBLE_QUOTED';
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '$') {
        // dollar quote: $tag$
        let j = i + 1;
        while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j += 1;
        if (text[j] === '$') {
          flushSpace();
          dollarTag = text.slice(i, j + 1);
          out += dollarTag;
          state = 'DOLLAR_QUOTED';
          i = j + 1;
          continue;
        }
      }
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\v') {
        pendingSpace = true;
        i += 1;
        continue;
      }
      if (code < 32) fail(FAILURE.CATALOG_DEFINITION_INVALID, { field: 'definition' });
      flushSpace();
      out += ch;
      i += 1;
      continue;
    }

    if (state === 'SINGLE_QUOTED') {
      out += ch;
      if (ch === "'" && text[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'NORMAL';
        i += 1;
        continue;
      }
      if (code === 0) fail(FAILURE.CATALOG_DEFINITION_INVALID, { field: 'definition' });
      i += 1;
      continue;
    }

    if (state === 'DOUBLE_QUOTED') {
      out += ch;
      if (ch === '"' && text[i + 1] === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        state = 'NORMAL';
        i += 1;
        continue;
      }
      if (code === 0) fail(FAILURE.CATALOG_DEFINITION_INVALID, { field: 'definition' });
      i += 1;
      continue;
    }

    if (state === 'DOLLAR_QUOTED') {
      if (text.startsWith(dollarTag, i)) {
        out += dollarTag;
        i += dollarTag.length;
        state = 'NORMAL';
        dollarTag = null;
        continue;
      }
      if (code === 0) fail(FAILURE.CATALOG_DEFINITION_INVALID, { field: 'definition' });
      out += ch;
      i += 1;
      continue;
    }
  }

  if (state !== 'NORMAL') fail(FAILURE.CATALOG_DEFINITION_UNTERMINATED_QUOTE, { field: 'definition' });
  return out.trim();
}

function canonicalName(schema, objectName, objectKind) {
  if (objectKind === 'TABLE') return `table:${schema}.${objectName}`;
  if (objectKind === 'VIEW') return `view:${schema}.${objectName}`;
  if (objectKind === 'MATERIALIZED_VIEW') return `materialized_view:${schema}.${objectName}`;
  fail(FAILURE.CATALOG_OBJECT_KIND_UNSUPPORTED, { field: 'object_kind' });
}

function uniqueBy(items, keyFn, component) {
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) fail(FAILURE.CATALOG_COMPONENT_DUPLICATE, { component });
    seen.add(key);
  }
}

function sortByKey(items, keyFn) {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function normalizeColumns(columns, contract, objectOrdinal) {
  if (!Array.isArray(columns)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'columns' });
  if (columns.length > contract.limits.max_columns_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'columns' });
  }
  const allowed = contract.column_fields;
  const out = [];
  for (const col of columns) {
    assertExactKeys(col, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (col[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertIdentifier(col.name, 'column.name');
    if (typeof col.type_identity !== 'string' || !col.type_identity.trim()) {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'type_identity' });
    }
    assertNoSensitive(col.type_identity, 'type_identity');
    assertBoolean(col.nullable, 'nullable');
    if (col.default_definition !== null && typeof col.default_definition !== 'string') {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'default_definition' });
    }
    if (typeof col.default_definition === 'string') {
      assertNoSensitive(col.default_definition, 'default_definition');
      if (col.default_definition.length > contract.limits.max_definition_length) {
        fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'default_definition' });
      }
    }
    assertEnum(col.generated_kind, contract.enums.generated_kind, 'generated_kind');
    assertEnum(col.identity_kind, contract.enums.identity_kind, 'identity_kind');
    out.push({
      name: col.name,
      type_identity: col.type_identity,
      nullable: col.nullable,
      default_definition:
        col.default_definition === null ? null : normalizeSqlDefinition(col.default_definition),
      generated_kind: col.generated_kind,
      identity_kind: col.identity_kind,
    });
  }
  uniqueBy(out, (c) => c.name, 'column');
  return sortByKey(out, (c) => c.name);
}

function normalizeConstraints(constraints, contract) {
  if (!Array.isArray(constraints)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'constraints' });
  if (constraints.length > contract.limits.max_constraints_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'constraints' });
  }
  const allowed = contract.constraint_fields;
  const out = [];
  for (const c of constraints) {
    assertExactKeys(c, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (c[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertIdentifier(c.name, 'constraint.name');
    assertEnum(c.constraint_kind, contract.enums.constraint_kind, 'constraint_kind');
    assertBoolean(c.validated, 'validated');
    if (typeof c.definition !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'definition' });
    if (c.definition.length > contract.limits.max_definition_length) {
      fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'definition' });
    }
    const isFk = c.constraint_kind === 'FOREIGN_KEY';
    if (isFk) {
      assertEnum(c.fk_on_update, contract.enums.fk_action, 'fk_on_update');
      assertEnum(c.fk_on_delete, contract.enums.fk_action, 'fk_on_delete');
    } else {
      if (c.fk_on_update !== null || c.fk_on_delete !== null) {
        fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field: 'fk_action' });
      }
    }
    out.push({
      name: c.name,
      constraint_kind: c.constraint_kind,
      validated: c.validated,
      definition: normalizeSqlDefinition(c.definition),
      fk_on_update: isFk ? c.fk_on_update : null,
      fk_on_delete: isFk ? c.fk_on_delete : null,
    });
  }
  uniqueBy(out, (c) => c.name, 'constraint');
  return sortByKey(out, (c) => c.name);
}

function normalizeIndexes(indexes, contract) {
  if (!Array.isArray(indexes)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'indexes' });
  if (indexes.length > contract.limits.max_indexes_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'indexes' });
  }
  const allowed = contract.index_fields;
  const out = [];
  for (const idx of indexes) {
    assertExactKeys(idx, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (idx[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertIdentifier(idx.name, 'index.name');
    assertBoolean(idx.primary, 'primary');
    assertBoolean(idx.unique, 'unique');
    assertBoolean(idx.valid, 'valid');
    if (typeof idx.definition !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'definition' });
    if (idx.definition.length > contract.limits.max_definition_length) {
      fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'definition' });
    }
    out.push({
      name: idx.name,
      primary: idx.primary,
      unique: idx.unique,
      valid: idx.valid,
      definition: normalizeSqlDefinition(idx.definition),
    });
  }
  uniqueBy(out, (i) => i.name, 'index');
  return sortByKey(out, (i) => i.name);
}

function normalizeTriggers(triggers, contract) {
  if (!Array.isArray(triggers)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'triggers' });
  if (triggers.length > contract.limits.max_triggers_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'triggers' });
  }
  const allowed = contract.trigger_fields;
  const out = [];
  for (const tg of triggers) {
    assertExactKeys(tg, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (tg[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertIdentifier(tg.name, 'trigger.name');
    assertEnum(tg.timing, contract.enums.trigger_timing, 'timing');
    if (!Array.isArray(tg.events) || tg.events.length === 0) {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'events' });
    }
    const events = [];
    const seen = new Set();
    for (const ev of tg.events) {
      assertEnum(ev, contract.enums.trigger_event, 'events');
      if (seen.has(ev)) fail(FAILURE.CATALOG_COMPONENT_DUPLICATE, { component: 'event' });
      seen.add(ev);
      events.push(ev);
    }
    events.sort(compareCodePoint);
    assertEnum(tg.level, contract.enums.trigger_level, 'level');
    assertEnum(tg.enabled, contract.enums.trigger_enabled, 'enabled');
    if (typeof tg.function_identity !== 'string' || !tg.function_identity.trim()) {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'function_identity' });
    }
    assertNoSensitive(tg.function_identity, 'function_identity');
    // schema-qualified signature-ish form: public.fn()
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\([^)]*\)$/.test(tg.function_identity)) {
      fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field: 'function_identity' });
    }
    if (typeof tg.definition !== 'string') fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'definition' });
    if (tg.definition.length > contract.limits.max_definition_length) {
      fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'definition' });
    }
    out.push({
      name: tg.name,
      timing: tg.timing,
      events,
      level: tg.level,
      enabled: tg.enabled,
      function_identity: tg.function_identity,
      definition: normalizeSqlDefinition(tg.definition),
    });
  }
  uniqueBy(out, (t) => t.name, 'trigger');
  return sortByKey(out, (t) => t.name);
}

function normalizeRls(rls, contract) {
  if (!rls || typeof rls !== 'object' || Array.isArray(rls)) {
    fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'row_level_security' });
  }
  assertExactKeys(
    rls,
    contract.rls_fields,
    FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN,
    FAILURE.CATALOG_FIELD_PROHIBITED,
    contract.prohibited_object_fields
  );
  assertBoolean(rls.enabled, 'row_level_security.enabled');
  assertBoolean(rls.forced, 'row_level_security.forced');
  if (!Array.isArray(rls.policies)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'policies' });
  if (rls.policies.length > contract.limits.max_policies_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'policies' });
  }
  const allowed = contract.policy_fields;
  const policies = [];
  for (const p of rls.policies) {
    assertExactKeys(p, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (p[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertIdentifier(p.name, 'policy.name');
    assertEnum(p.command, contract.enums.policy_command, 'command');
    assertBoolean(p.permissive, 'permissive');
    assertEnum(p.role_scope, contract.enums.role_scope, 'role_scope');
    if (p.using_expression !== null && typeof p.using_expression !== 'string') {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'using_expression' });
    }
    if (p.check_expression !== null && typeof p.check_expression !== 'string') {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'check_expression' });
    }
    if (typeof p.using_expression === 'string') {
      assertNoSensitive(p.using_expression, 'using_expression');
      if (p.using_expression.length > contract.limits.max_definition_length) {
        fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'using_expression' });
      }
    }
    if (typeof p.check_expression === 'string') {
      assertNoSensitive(p.check_expression, 'check_expression');
      if (p.check_expression.length > contract.limits.max_definition_length) {
        fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'check_expression' });
      }
    }
    policies.push({
      name: p.name,
      command: p.command,
      permissive: p.permissive,
      role_scope: p.role_scope,
      using_expression:
        p.using_expression === null ? null : normalizeSqlDefinition(p.using_expression),
      check_expression:
        p.check_expression === null ? null : normalizeSqlDefinition(p.check_expression),
    });
  }
  uniqueBy(policies, (p) => `${p.name}|${p.command}|${p.role_scope}`, 'policy');
  return {
    enabled: rls.enabled,
    forced: rls.forced,
    policies: sortByKey(policies, (p) => `${p.name}|${p.command}|${p.role_scope}`),
  };
}

function normalizeGrants(grants, contract) {
  if (!Array.isArray(grants)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'grants' });
  if (grants.length > contract.limits.max_grants_per_object) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'grants' });
  }
  const allowed = contract.grant_fields;
  const out = [];
  for (const g of grants) {
    assertExactKeys(g, allowed, FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, FAILURE.CATALOG_FIELD_PROHIBITED, contract.prohibited_object_fields);
    for (const f of allowed) {
      if (g[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
    }
    assertEnum(g.grantee_class, contract.enums.grantee_class, 'grantee_class');
    assertBoolean(g.grantable, 'grantable');
    if (!Array.isArray(g.privileges) || g.privileges.length === 0) {
      fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'privileges' });
    }
    const privs = [];
    const seen = new Set();
    for (const priv of g.privileges) {
      assertEnum(priv, contract.enums.privilege, 'privileges');
      if (seen.has(priv)) fail(FAILURE.CATALOG_COMPONENT_DUPLICATE, { component: 'privilege' });
      seen.add(priv);
      privs.push(priv);
    }
    privs.sort(compareCodePoint);
    out.push({
      grantee_class: g.grantee_class,
      privileges: privs,
      grantable: g.grantable,
    });
  }
  uniqueBy(out, (g) => `${g.grantee_class}|${g.grantable}|${g.privileges.join(',')}`, 'grant');
  return sortByKey(out, (g) => `${g.grantee_class}|${g.grantable}|${g.privileges.join(',')}`);
}

function canonicalizeCatalogObject(rawObject, contract, ordinal) {
  if (!rawObject || typeof rawObject !== 'object' || Array.isArray(rawObject)) {
    fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'object' });
  }
  for (const key of Object.keys(rawObject)) {
    if (contract.prohibited_object_fields.includes(key)) {
      fail(FAILURE.CATALOG_FIELD_PROHIBITED, { field: key });
    }
  }

  const required = rawObject.object_kind === 'TABLE'
    ? contract.table_required_fields
    : contract.view_required_fields;

  for (const f of required) {
    if (rawObject[f] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: f });
  }
  for (const key of Object.keys(rawObject)) {
    if (!required.includes(key)) fail(FAILURE.CATALOG_OBJECT_FIELD_UNKNOWN, { field: key });
  }

  assertIdentifier(rawObject.schema, 'schema');
  assertIdentifier(rawObject.object_name, 'object_name');
  if (!contract.supported_object_kinds.includes(rawObject.object_kind)) {
    fail(FAILURE.CATALOG_OBJECT_KIND_UNSUPPORTED, { field: 'object_kind' });
  }
  const expectedRel = contract.relation_kind_by_object_kind[rawObject.object_kind];
  if (rawObject.relation_kind !== expectedRel) {
    fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field: 'relation_kind' });
  }

  const shape = contract.object_shape_rules[rawObject.object_kind];
  let viewDefinition = rawObject.view_definition;
  if (shape.view_definition === 'must_be_null') {
    if (viewDefinition !== null) fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field: 'view_definition' });
  } else {
    if (typeof viewDefinition !== 'string' || !viewDefinition.trim()) {
      fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field: 'view_definition' });
    }
    if (viewDefinition.length > contract.limits.max_definition_length) {
      fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'view_definition' });
    }
    assertNoSensitive(viewDefinition, 'view_definition');
    viewDefinition = normalizeSqlDefinition(viewDefinition);
  }

  const requireEmpty = (arr, field, rule) => {
    if (!Array.isArray(arr)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field });
    if (rule === 'must_be_empty_array' && arr.length !== 0) {
      fail(FAILURE.CATALOG_OBJECT_SHAPE_INVALID, { field });
    }
  };
  requireEmpty(rawObject.constraints, 'constraints', shape.constraints);
  requireEmpty(rawObject.indexes, 'indexes', shape.indexes);
  requireEmpty(rawObject.triggers, 'triggers', shape.triggers);

  const columns = normalizeColumns(rawObject.columns, contract, ordinal);
  const constraints =
    shape.constraints === 'must_be_empty_array'
      ? []
      : normalizeConstraints(rawObject.constraints, contract);
  const indexes =
    shape.indexes === 'must_be_empty_array' ? [] : normalizeIndexes(rawObject.indexes, contract);
  const triggers =
    shape.triggers === 'must_be_empty_array' ? [] : normalizeTriggers(rawObject.triggers, contract);
  const rowLevelSecurity = normalizeRls(rawObject.row_level_security, contract);
  const grants = normalizeGrants(rawObject.grants, contract);

  return {
    schema: rawObject.schema,
    object_name: rawObject.object_name,
    object_kind: rawObject.object_kind,
    relation_kind: rawObject.relation_kind,
    columns,
    constraints,
    indexes,
    triggers,
    row_level_security: rowLevelSecurity,
    grants,
    view_definition: viewDefinition,
  };
}

function fingerprintObject(canonicalObject, contract) {
  const envelope = {
    domain: contract.fingerprint.domain,
    format_version: contract.format_version,
    normalizer_version: contract.normalizer_version,
    object: canonicalObject,
  };
  // Fixed key order (not alphabetical generic) for the envelope.
  const serialized =
    `{"domain":${JSON.stringify(envelope.domain)}` +
    `,"format_version":${JSON.stringify(envelope.format_version)}` +
    `,"normalizer_version":${JSON.stringify(envelope.normalizer_version)}` +
    `,"object":${stableStringify(envelope.object)}}`;
  const hash = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

function validateCatalogMetadata(input, contract) {
  validateCatalogMetadataContract(contract);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'input' });
  }
  for (const key of Object.keys(input)) {
    if (!contract.allowed_top_level_fields.includes(key)) {
      fail(FAILURE.CATALOG_TOP_LEVEL_FIELD_UNKNOWN, { field: key });
    }
  }
  for (const key of contract.allowed_top_level_fields) {
    if (input[key] === undefined) fail(FAILURE.CATALOG_REQUIRED_FIELD_MISSING, { field: key });
  }
  if (input.format_version !== contract.format_version) {
    fail(FAILURE.CATALOG_FORMAT_VERSION_UNSUPPORTED);
  }
  if (input.normalizer_version !== contract.normalizer_version) {
    fail(FAILURE.CATALOG_NORMALIZER_VERSION_UNSUPPORTED);
  }
  if (!Array.isArray(input.objects)) fail(FAILURE.CATALOG_FIELD_TYPE_INVALID, { field: 'objects' });
  if (input.objects.length > contract.limits.max_objects) {
    fail(FAILURE.CATALOG_BOUNDS_EXCEEDED, { field: 'objects' });
  }
  return true;
}

function buildCatalogEvidence(input, contract) {
  validateCatalogMetadata(input, contract);
  const names = new Set();
  const objects = [];
  input.objects.forEach((raw, index) => {
    const canonical = canonicalizeCatalogObject(raw, contract, index);
    const name = canonicalName(canonical.schema, canonical.object_name, canonical.object_kind);
    if (names.has(name)) fail(FAILURE.CATALOG_OBJECT_DUPLICATE, { field: 'name' });
    names.add(name);
    const fingerprint = fingerprintObject(canonical, contract);
    objects.push({ name, fingerprint });
  });
  objects.sort((a, b) => compareCodePoint(a.name, b.name));
  return {
    format_version: contract.format_version,
    normalizer_version: contract.normalizer_version,
    objects,
  };
}

function readCatalogMetadataFile(inputPath, options = {}) {
  const maxBytes = options.maxInputBytes || 1048576;
  let stat;
  try {
    stat = fs.statSync(inputPath);
  } catch {
    fail(FAILURE.CATALOG_INPUT_READ_FAILED);
  }
  if (!stat.isFile()) fail(FAILURE.CATALOG_INPUT_READ_FAILED);
  if (stat.size > maxBytes) fail(FAILURE.CATALOG_INPUT_TOO_LARGE);
  let raw;
  try {
    raw = fs.readFileSync(inputPath);
  } catch {
    fail(FAILURE.CATALOG_INPUT_READ_FAILED);
  }
  if (raw.length > maxBytes) fail(FAILURE.CATALOG_INPUT_TOO_LARGE);
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    fail(FAILURE.CATALOG_INPUT_JSON_INVALID);
  }
  return parsed;
}

function assertRepoRelativeInput(repoRoot, inputPath) {
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(inputPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    fail(FAILURE.CATALOG_INPUT_READ_FAILED);
  }
  return resolved;
}

function bindExpectedSchemaNormalizer(expectedSchemaManifest, contract) {
  if (!expectedSchemaManifest || typeof expectedSchemaManifest !== 'object') {
    return { ok: false, errors: [FAILURE.EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH] };
  }
  const errors = [];
  if (expectedSchemaManifest.normalizer_version && expectedSchemaManifest.normalizer_version !== contract.normalizer_version) {
    errors.push(FAILURE.EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH);
  }
  if (
    expectedSchemaManifest.metadata_contract_path &&
    expectedSchemaManifest.metadata_contract_path !== 'db/migration-provenance/catalog-metadata-contract.json'
  ) {
    errors.push(FAILURE.EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH);
  }
  return { ok: errors.length === 0, errors };
}

function bindCatalogEvidenceVersions(catalogEvidence, contract) {
  const errors = [];
  if (!catalogEvidence || typeof catalogEvidence !== 'object') return { ok: true, errors };
  if (catalogEvidence.format_version && catalogEvidence.format_version !== contract.format_version) {
    errors.push(FAILURE.GATE_CATALOG_FORMAT_VERSION_MISMATCH);
  }
  if (
    catalogEvidence.normalizer_version &&
    catalogEvidence.normalizer_version !== contract.normalizer_version
  ) {
    errors.push(FAILURE.GATE_CATALOG_NORMALIZER_VERSION_MISMATCH);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  FAILURE,
  validateCatalogMetadataContract,
  validateCatalogMetadata,
  normalizeSqlDefinition,
  canonicalizeCatalogObject,
  buildCatalogEvidence,
  stableStringify,
  fingerprintObject,
  loadJson,
  defaultContractPath,
  readCatalogMetadataFile,
  assertRepoRelativeInput,
  bindExpectedSchemaNormalizer,
  bindCatalogEvidenceVersions,
  compareCodePoint,
};
