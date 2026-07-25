'use strict';

/**
 * Precondition registry source validator (#3659).
 *
 * Source-static validator: validates a precondition-registry.json object
 * against the fixed schema and cross-binds with the canonical migration
 * manifest. No runtime evaluation, SQL execution, or DB access.
 *
 * Refs #3659
 * Refs #3657
 * Refs #3658
 * Refs #3652
 * Refs #3650
 * Refs #3646
 *
 * Refs #3458 — Keep OPEN.
 * Refs #3425 — Keep OPEN.
 * Refs #3435 — Keep OPEN.
 * Refs #3437 — Keep OPEN.
 * Refs #1882 — Keep OPEN.
 */

const { types: utilTypes } = require('node:util');

const ALLOWED_TOP_LEVEL_KEYS = Object.freeze(['format_version', 'status', 'entries']);
const ALLOWED_ENTRY_KEYS = Object.freeze(['migration_id', 'checks']);
const ALLOWED_CHECK_KEYS = Object.freeze(['check_id', 'query_reference', 'expected']);
const FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  'query', 'text', 'sql', 'path', 'url', 'env', 'credential',
  'operator', 'hostname', 'caller_path', 'dynamic_source',
  'allowlist', 'evidence_contract', 'kind', 'field'
]);
const VALID_FORMAT_VERSION = '1.0';
const VALID_STATUSES = Object.freeze(['ADOPTION_REQUIRED', 'ACTIVE']);

// Canonical migration ID grammar: 14-digit timestamp + underscore + kebab-case slug
const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Stable kebab-case for check_id and query_reference
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isNonProxyObject(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  try {
    if (utilTypes.isProxy(value)) return false;
  } catch (e) {
    return false;
  }
  if (Array.isArray(value)) return false;
  return true;
}

function safeOwnKeyDescriptors(obj) {
  let keys;
  try {
    keys = Reflect.ownKeys(obj);
  } catch (e) {
    return undefined;
  }
  const descriptors = [];
  for (const key of keys) {
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(obj, key);
    } catch (e) {
      return undefined;
    }
    if (desc === undefined) return undefined;
    descriptors.push({ key, desc });
  }
  return descriptors;
}

function keysMatchExactSet(descriptors, allowedKeys) {
  if (descriptors.length !== allowedKeys.length) return false;
  const allowed = new Set(allowedKeys);
  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return false;
    if (!allowed.has(key)) return false;
    if ('get' in desc || 'set' in desc) return false;
    if (desc.enumerable !== true) return false;
  }
  return true;
}

function validatePlainObjectShape(obj, allowedKeys) {
  if (!isNonProxyObject(obj)) return false;
  let proto;
  try {
    proto = Object.getPrototypeOf(obj);
  } catch (e) {
    return false;
  }
  if (proto !== Object.prototype && proto !== null) return false;
  const descriptors = safeOwnKeyDescriptors(obj);
  if (descriptors === undefined) return false;
  return keysMatchExactSet(descriptors, allowedKeys);
}

function hasForbiddenKeys(obj) {
  if (!isNonProxyObject(obj)) return true;
  const descriptors = safeOwnKeyDescriptors(obj);
  if (descriptors === undefined) return true;
  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return true;
    if ('get' in desc || 'set' in desc) return true;
    if (desc.enumerable !== true) return true;
    if (FORBIDDEN_AUTHORITY_KEYS.includes(key)) return true;
  }
  return false;
}

function isDenseArray(value) {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) {
    if (!(i in value)) return false;
  }
  return true;
}

function safeEnumerableDataPropertyValue(obj, key) {
  const descriptors = safeOwnKeyDescriptors(obj);
  if (descriptors === undefined) return { valid: false };
  const match = descriptors.find((item) => item.key === key);
  if (!match || !('value' in match.desc) || match.desc.enumerable !== true) {
    return { valid: false };
  }
  return { valid: true, value: match.desc.value };
}

function safeDenseArrayValues(value) {
  try {
    if (utilTypes.isProxy(value)) return { valid: false };
  } catch (e) {
    return { valid: false };
  }
  if (!Array.isArray(value)) return { valid: false };

  let lengthDesc;
  try {
    lengthDesc = Object.getOwnPropertyDescriptor(value, 'length');
  } catch (e) {
    return { valid: false };
  }
  if (!lengthDesc || !('value' in lengthDesc) || !Number.isSafeInteger(lengthDesc.value) || lengthDesc.value < 0) {
    return { valid: false };
  }

  const values = [];
  for (let i = 0; i < lengthDesc.value; i++) {
    let itemDesc;
    try {
      itemDesc = Object.getOwnPropertyDescriptor(value, String(i));
    } catch (e) {
      return { valid: false };
    }
    if (!itemDesc || !('value' in itemDesc) || itemDesc.enumerable !== true) {
      return { valid: false };
    }
    values.push(itemDesc.value);
  }
  return { valid: true, values };
}

function validatePreconditionRegistry(registry) {
  const errors = [];

  if (!isNonProxyObject(registry)) {
    errors.push('REGISTRY_NOT_VALID_OBJECT');
    return { ok: false, errors };
  }

  if (!validatePlainObjectShape(registry, ALLOWED_TOP_LEVEL_KEYS)) {
    errors.push('REGISTRY_TOP_LEVEL_KEYS_INVALID');
    return { ok: false, errors };
  }

  const { format_version, status, entries } = registry;

  if (format_version !== VALID_FORMAT_VERSION) {
    errors.push('REGISTRY_FORMAT_VERSION_INVALID');
  }

  if (!VALID_STATUSES.includes(status)) {
    errors.push('REGISTRY_STATUS_INVALID');
  }

  if (!Array.isArray(entries)) {
    errors.push('REGISTRY_ENTRIES_NOT_ARRAY');
    return { ok: false, errors };
  }

  if (!isDenseArray(entries)) {
    errors.push('REGISTRY_ENTRIES_SPARSE');
  }

  if (status === 'ADOPTION_REQUIRED') {
    if (entries.length !== 0) {
      errors.push('REGISTRY_ADOPTION_REQUIRED_NONEMPTY_ENTRIES');
    }
  } else if (status === 'ACTIVE') {
    if (entries.length === 0) {
      errors.push('REGISTRY_ACTIVE_EMPTY_ENTRIES');
    }
  }

  const seenMigrationIds = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!(i in entries)) continue; // sparse slot guard

    if (hasForbiddenKeys(entry)) {
      errors.push('REGISTRY_ENTRY_FORBIDDEN_AUTHORITY_KEY');
    }

    if (!validatePlainObjectShape(entry, ALLOWED_ENTRY_KEYS)) {
      errors.push('REGISTRY_ENTRY_INVALID_KEYS');
      continue;
    }

    const { migration_id, checks } = entry;

    if (typeof migration_id !== 'string' || !MIGRATION_ID_PATTERN.test(migration_id)) {
      errors.push('REGISTRY_ENTRY_MIGRATION_ID_INVALID');
    }

    if (migration_id && seenMigrationIds.has(migration_id)) {
      errors.push(`REGISTRY_ENTRY_DUPLICATE_MIGRATION_ID:${migration_id}`);
    }
    if (migration_id) {
      seenMigrationIds.add(migration_id);
    }

    if (!Array.isArray(checks)) {
      errors.push('REGISTRY_ENTRY_CHECKS_NOT_ARRAY');
      continue;
    }

    if (!isDenseArray(checks)) {
      errors.push('REGISTRY_ENTRY_CHECKS_SPARSE');
    }

    if (status === 'ACTIVE' && checks.length === 0) {
      errors.push('REGISTRY_ENTRY_CHECKS_EMPTY');
    }

    const seenCheckIds = new Set();
    for (let j = 0; j < checks.length; j++) {
      const check = checks[j];

      if (!(j in checks)) continue; // sparse slot guard

      if (hasForbiddenKeys(check)) {
        errors.push('REGISTRY_CHECK_FORBIDDEN_AUTHORITY_KEY');
      }

      if (!validatePlainObjectShape(check, ALLOWED_CHECK_KEYS)) {
        errors.push('REGISTRY_CHECK_INVALID_KEYS');
        continue;
      }

      const { check_id, query_reference, expected } = check;

      if (typeof check_id !== 'string' || !KEBAB_CASE_PATTERN.test(check_id)) {
        errors.push('REGISTRY_CHECK_ID_INVALID');
      }

      if (typeof query_reference !== 'string' || !KEBAB_CASE_PATTERN.test(query_reference)) {
        errors.push('REGISTRY_CHECK_QUERY_REFERENCE_INVALID');
      }

      if (typeof expected !== 'boolean') {
        errors.push('REGISTRY_CHECK_EXPECTED_NOT_BOOLEAN');
      }

      if (check_id && seenCheckIds.has(check_id)) {
        errors.push(`REGISTRY_CHECK_DUPLICATE_ID:${check_id}`);
      }
      if (check_id) {
        seenCheckIds.add(check_id);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Cross-validate precondition registry against canonical migration manifest.
 */
function validateRegistryManifestBinding(registry, migrationManifest) {
  const errors = [];

  if (!isNonProxyObject(registry)) {
    errors.push('REGISTRY_BINDING_REGISTRY_UNAVAILABLE');
    return { ok: false, errors };
  }

  if (!isNonProxyObject(migrationManifest)) {
    errors.push('REGISTRY_BINDING_MANIFEST_UNAVAILABLE');
    return { ok: false, errors };
  }

  let registryProto;
  let manifestProto;
  try {
    registryProto = Object.getPrototypeOf(registry);
    manifestProto = Object.getPrototypeOf(migrationManifest);
  } catch (e) {
    errors.push('REGISTRY_BINDING_INPUT_UNSAFE');
    return { ok: false, errors };
  }
  if (registryProto !== Object.prototype && registryProto !== null) {
    errors.push('REGISTRY_BINDING_REGISTRY_NOT_PLAIN');
    return { ok: false, errors };
  }
  if (manifestProto !== Object.prototype && manifestProto !== null) {
    errors.push('REGISTRY_BINDING_MANIFEST_NOT_PLAIN');
    return { ok: false, errors };
  }

  const manifestStatusSnapshot = safeEnumerableDataPropertyValue(migrationManifest, 'status');
  const manifestMigrationsSnapshot = safeEnumerableDataPropertyValue(migrationManifest, 'migrations');
  const registryStatusSnapshot = safeEnumerableDataPropertyValue(registry, 'status');
  const registryEntriesSnapshot = safeEnumerableDataPropertyValue(registry, 'entries');
  if (!manifestStatusSnapshot.valid || !manifestMigrationsSnapshot.valid ||
      !registryStatusSnapshot.valid || !registryEntriesSnapshot.valid) {
    errors.push('REGISTRY_BINDING_INPUT_ACCESSOR_OR_MISSING');
    return { ok: false, errors };
  }

  const manifestMigrationsSnapshotValues = safeDenseArrayValues(manifestMigrationsSnapshot.value);
  const registryEntriesSnapshotValues = safeDenseArrayValues(registryEntriesSnapshot.value);
  if (!manifestMigrationsSnapshotValues.valid || !registryEntriesSnapshotValues.valid) {
    errors.push('REGISTRY_BINDING_COLLECTION_UNSAFE');
    return { ok: false, errors };
  }

  const manifestStatus = manifestStatusSnapshot.value;
  const registryStatus = registryStatusSnapshot.value;
  const manifestMigrations = manifestMigrationsSnapshotValues.values;
  const registryEntries = registryEntriesSnapshotValues.values;

  // ADOPTION_REQUIRED manifest -> registry must be ADOPTION_REQUIRED
  if (manifestStatus === 'ADOPTION_REQUIRED') {
    if (registryStatus === 'ACTIVE') {
      errors.push('REGISTRY_BINDING_MANIFEST_INACTIVE_REGISTRY_ACTIVE');
    }
    return { ok: errors.length === 0, errors };
  }

  // ACTIVE manifest
  if (manifestStatus === 'ACTIVE') {
    if (registryStatus !== 'ACTIVE') {
      errors.push('REGISTRY_BINDING_MANIFEST_ACTIVE_REGISTRY_NOT_ACTIVE');
      return { ok: false, errors };
    }

    const registryEntryIds = new Set();
    for (const entry of registryEntries) {
      if (!isNonProxyObject(entry)) {
        errors.push('REGISTRY_BINDING_REGISTRY_ENTRY_UNSAFE');
        return { ok: false, errors };
      }
      const migrationIdSnapshot = safeEnumerableDataPropertyValue(entry, 'migration_id');
      if (!migrationIdSnapshot.valid) {
        errors.push('REGISTRY_BINDING_REGISTRY_ENTRY_UNSAFE');
        return { ok: false, errors };
      }
      registryEntryIds.add(migrationIdSnapshot.value);
    }

    const manifestMigrationIds = new Set();
    const manifestIds = [];
    for (const migration of manifestMigrations) {
      if (!isNonProxyObject(migration)) {
        errors.push('REGISTRY_BINDING_MANIFEST_MIGRATION_UNSAFE');
        return { ok: false, errors };
      }
      const idSnapshot = safeEnumerableDataPropertyValue(migration, 'id');
      if (!idSnapshot.valid) {
        errors.push('REGISTRY_BINDING_MANIFEST_MIGRATION_UNSAFE');
        return { ok: false, errors };
      }
      manifestIds.push(idSnapshot.value);
      manifestMigrationIds.add(idSnapshot.value);
    }

    for (const migrationId of manifestIds) {
      if (!registryEntryIds.has(migrationId)) {
        errors.push(`REGISTRY_BINDING_MIGRATION_MISSING_ENTRY:${migrationId}`);
      }
    }

    for (const migrationId of registryEntryIds) {
      if (!manifestMigrationIds.has(migrationId)) {
        errors.push(`REGISTRY_BINDING_ORPHAN_ENTRY:${migrationId}`);
      }
    }

    if (manifestMigrations.length !== manifestMigrationIds.size) {
      errors.push('REGISTRY_BINDING_DUPLICATE_MANIFEST_MIGRATIONS');
    }

    return { ok: errors.length === 0, errors };
  }

  errors.push('REGISTRY_BINDING_MANIFEST_STATUS_UNKNOWN');
  return { ok: false, errors };
}

module.exports = {
  ALLOWED_TOP_LEVEL_KEYS,
  ALLOWED_ENTRY_KEYS,
  ALLOWED_CHECK_KEYS,
  FORBIDDEN_AUTHORITY_KEYS,
  VALID_FORMAT_VERSION,
  VALID_STATUSES,
  MIGRATION_ID_PATTERN,
  KEBAB_CASE_PATTERN,
  validatePreconditionRegistry,
  validateRegistryManifestBinding,
  validatePlainObjectShape,
  isNonProxyObject,
  safeOwnKeyDescriptors,
  keysMatchExactSet,
  hasForbiddenKeys,
  isDenseArray
};