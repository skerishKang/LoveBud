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
  if (obj === null || typeof obj !== 'object') return false;
  try {
    if (Array.isArray(obj)) return false;
  } catch (e) {
    return false;
  }
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
  if (obj === null || typeof obj !== 'object') return true;
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

function validatePreconditionRegistry(registry) {
  const errors = [];

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

    if (hasForbiddenKeys(entry)) {
      errors.push('REGISTRY_ENTRY_FORBIDDEN_AUTHORITY_KEY');
    }

    if (!validatePlainObjectShape(entry, ALLOWED_ENTRY_KEYS)) {
      errors.push('REGISTRY_ENTRY_INVALID_KEYS');
      continue;
    }

    const { migration_id, checks } = entry;

    if (typeof migration_id !== 'string' || migration_id.trim().length === 0) {
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

    const seenCheckIds = new Set();
    for (let j = 0; j < checks.length; j++) {
      const check = checks[j];

      if (hasForbiddenKeys(check)) {
        errors.push('REGISTRY_CHECK_FORBIDDEN_AUTHORITY_KEY');
      }

      if (!validatePlainObjectShape(check, ALLOWED_CHECK_KEYS)) {
        errors.push('REGISTRY_CHECK_INVALID_KEYS');
        continue;
      }

      const { check_id, query_reference, expected } = check;

      if (typeof check_id !== 'string' || check_id.trim().length === 0) {
        errors.push('REGISTRY_CHECK_ID_INVALID');
      }

      if (typeof query_reference !== 'string' || query_reference.trim().length === 0) {
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
 *
 * ADOPTION_REQUIRED manifest + ADOPTION_REQUIRED registry (= empty = matching) → OK
 * ADOPTION_REQUIRED manifest + ACTIVE registry → FAIL (registry cannot be ACTIVE when manifest is not adopted)
 * ACTIVE manifest + ADOPTION_REQUIRED registry with empty migrations → FAIL (manifest is ACTIVE but registry not adopted)
 * ACTIVE both: each migration has exactly 1 entry, each entry has exactly 1 migration (one-to-one)
 * No orphan entries, no duplicate entries
 */
function validateRegistryManifestBinding(registry, migrationManifest) {
  const errors = [];

  if (!migrationManifest || typeof migrationManifest !== 'object') {
    errors.push('REGISTRY_BINDING_MANIFEST_UNAVAILABLE');
    return { ok: false, errors };
  }

  // Validate manifest is a safe plain object
  let manifestProto;
  try {
    manifestProto = Object.getPrototypeOf(migrationManifest);
  } catch (e) {
    errors.push('REGISTRY_BINDING_MANIFEST_UNSAFE');
    return { ok: false, errors };
  }
  if (manifestProto !== Object.prototype && manifestProto !== null) {
    errors.push('REGISTRY_BINDING_MANIFEST_NOT_PLAIN');
    return { ok: false, errors };
  }

  const manifestStatus = migrationManifest.status;
  const manifestMigrations = Array.isArray(migrationManifest.migrations) ? migrationManifest.migrations : [];
  const registryStatus = registry.status;
  const registryEntries = Array.isArray(registry.entries) ? registry.entries : [];

  // ADOPTION_REQUIRED manifest → registry must be ADOPTION_REQUIRED
  if (manifestStatus === 'ADOPTION_REQUIRED') {
    if (registryStatus === 'ACTIVE') {
      errors.push('REGISTRY_BINDING_MANIFEST_INACTIVE_REGISTRY_ACTIVE');
    }
    // ADOPTION_REQUIRED + both empty or both have content → OK (not yet adopted)
    return { ok: errors.length === 0, errors };
  }

  // ACTIVE manifest
  if (manifestStatus === 'ACTIVE') {
    if (registryStatus !== 'ACTIVE') {
      errors.push('REGISTRY_BINDING_MANIFEST_ACTIVE_REGISTRY_NOT_ACTIVE');
      return { ok: false, errors };
    }

    // One-to-one binding: each migration has exactly 1 entry, each entry references exactly 1 migration
    const registryEntryIds = new Set(registryEntries.map(e => e.migration_id));
    const manifestMigrationIds = new Set(manifestMigrations.map(m => m.id));

    for (const migration of manifestMigrations) {
      if (!registryEntryIds.has(migration.id)) {
        errors.push(`REGISTRY_BINDING_MIGRATION_MISSING_ENTRY:${migration.id}`);
      }
    }

    for (const entry of registryEntries) {
      if (!manifestMigrationIds.has(entry.migration_id)) {
        errors.push(`REGISTRY_BINDING_ORPHAN_ENTRY:${entry.migration_id}`);
      }
    }

    // Check duplicate migrations in manifest
    if (manifestMigrations.length !== manifestMigrationIds.size) {
      errors.push('REGISTRY_BINDING_DUPLICATE_MANIFEST_MIGRATIONS');
    }

    return { ok: errors.length === 0, errors };
  }

  // Unknown manifest status
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
  validatePreconditionRegistry,
  validateRegistryManifestBinding,
  validatePlainObjectShape,
  safeOwnKeyDescriptors,
  keysMatchExactSet,
  hasForbiddenKeys
};
