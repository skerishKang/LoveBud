'use strict';

/**
 * Source-only read-only target attribution & catalog parity preflight core.
 *
 * Attributes a target only by bounded non-secret classes and compares sanitized
 * catalog fingerprints against committed expected-schema authority without
 * mutating the target. Dependency-injected, deterministic, descriptor-safe,
 * sanitized, frozen/detached, and incapable of reading environment variables,
 * filesystem paths, URLs, credentials, arbitrary SQL, or provider identifiers.
 *
 * The core never opens a database connection and never executes SQL. A caller
 * supplies only bounded sanitized expected authority and exactly one injected
 * read-only collection effect.
 *
 * Refs #3860, #3458, #1882
 */

const OPERATION = 'READ_ONLY_TARGET_ATTRIBUTION_CATALOG_PARITY';
const TARGET_CLASS = 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET';
const ENVIRONMENT_CLASS = 'CI_EPHEMERAL';

const PARITY_OUTCOMES = Object.freeze({
  PARITY_CONFIRMED: 'PARITY_CONFIRMED',
  PARITY_MISMATCH: 'PARITY_MISMATCH',
  TARGET_ATTRIBUTION_INVALID: 'TARGET_ATTRIBUTION_INVALID',
  APPROVAL_INVALID: 'APPROVAL_INVALID',
  AUTHORITY_ADOPTION_REQUIRED: 'AUTHORITY_ADOPTION_REQUIRED',
  EXPECTED_SCHEMA_INVALID: 'EXPECTED_SCHEMA_INVALID',
  CATALOG_COLLECTION_FAILED: 'CATALOG_COLLECTION_FAILED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

const ALLOWED_CONFIG_KEYS = Object.freeze([
  'operation',
  'targetClass',
  'environmentClass',
  'boundaryApproval',
  'releaseSha',
  'committedAuthority',
  'dependencies',
]);

const ALLOWED_DEPENDENCY_KEYS = Object.freeze(['collectCatalogEvidence']);

const ALLOWED_AUTHORITY_KEYS = Object.freeze(['status', 'critical_objects']);

const ALLOWED_EVIDENCE_KEYS = Object.freeze(['format_version', 'normalizer_version', 'objects']);

const ALLOWED_OBJECT_KEYS = Object.freeze(['name', 'fingerprint']);

const OBJECT_NAME_PATTERN =
  /^(?:table|view|materialized_view):[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;

const RELEASE_SHA_PATTERN = /^[a-f0-9]{40}$/;

const ADOPTION_REQUIRED = 'ADOPTION_REQUIRED';

const SUPPORTED_FORMAT_VERSION = '1.0';
const SUPPORTED_NORMALIZER_VERSION = '1.0';

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
  } catch {
    return false;
  }
  let proto;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return false;
  }
  return proto === Object.prototype || proto === null;
}

function categoryOf(error, fallback) {
  if (error && typeof error === 'object' && typeof error.category === 'string') {
    return error.category;
  }
  return fallback;
}

function fail(category, context) {
  const err = new Error(category);
  err.category = category;
  err.context = context && typeof context === 'object' ? { ...context } : {};
  throw err;
}

function readOwnEnumerableDataProperty(object, key, failure) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    fail(failure, { field: key });
  }
  if (!descriptor) {
    fail(failure, { field: key });
  }
  if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    fail(failure, { field: key });
  }
  if (descriptor.enumerable !== true || !('value' in descriptor)) {
    fail(failure, { field: key });
  }
  return descriptor.value;
}

function readExactKeys(record, failure) {
  let keys;
  try {
    keys = Object.keys(record);
  } catch {
    fail(failure, { field: 'keys' });
  }
  return keys;
}

function hasOwnSafe(record, key, failure) {
  try {
    return Object.prototype.hasOwnProperty.call(record, key);
  } catch {
    fail(failure, { field: key });
  }
}

function requirePlainRecord(value, failure) {
  if (!isPlainRecord(value)) fail(failure);
}

function requireExactKeySet(keys, allowed, failure) {
  if (keys.length !== allowed.length) fail(failure, { field: 'keys' });
  for (const key of keys) {
    if (!allowed.includes(key)) fail(failure, { field: key });
  }
}

function requireKeysSubset(keys, allowed, failure) {
  for (const key of keys) {
    if (!allowed.includes(key)) fail(failure, { field: key });
  }
}

function requireNonEmptyString(value, failure, field) {
  if (typeof value !== 'string' || value.length === 0) fail(failure, { field });
  return value;
}

function sortByName(list) {
  return list.slice().sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

function validateCriticalObjectVocabulary(criticalObjects, emptyFailure, objectFailure) {
  if (!Array.isArray(criticalObjects)) {
    fail(objectFailure, { field: 'critical_objects' });
  }
  if (criticalObjects.length === 0) {
    fail(emptyFailure, { field: 'critical_objects' });
  }
  const seen = new Set();
  const normalized = [];
  for (const object of criticalObjects) {
    if (!isPlainRecord(object)) {
      fail(objectFailure, { field: 'critical_object' });
    }
    const keys = readExactKeys(object, objectFailure);
    requireExactKeySet(keys, ALLOWED_OBJECT_KEYS, objectFailure);
    const name = readOwnEnumerableDataProperty(object, 'name', objectFailure);
    const fingerprint = readOwnEnumerableDataProperty(object, 'fingerprint', objectFailure);
    requireNonEmptyString(name, objectFailure, 'name');
    requireNonEmptyString(fingerprint, objectFailure, 'fingerprint');
    if (!OBJECT_NAME_PATTERN.test(name)) {
      fail(objectFailure, { field: 'name' });
    }
    if (!FINGERPRINT_PATTERN.test(fingerprint)) {
      fail(objectFailure, { field: 'fingerprint' });
    }
    if (seen.has(name)) {
      fail(objectFailure, { field: 'name' });
    }
    seen.add(name);
    normalized.push({ name, fingerprint });
  }
  return sortByName(normalized);
}

function validateCommittedAuthority(committedAuthority) {
  requirePlainRecord(committedAuthority, PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID);
  const keys = readExactKeys(committedAuthority, PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID);
  requireExactKeySet(keys, ALLOWED_AUTHORITY_KEYS, PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID);
  const status = readOwnEnumerableDataProperty(
    committedAuthority,
    'status',
    PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID
  );
  const criticalObjects = readOwnEnumerableDataProperty(
    committedAuthority,
    'critical_objects',
    PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID
  );
  if (status !== ADOPTION_REQUIRED) {
    fail(PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID, { field: 'status' });
  }
  const normalized = validateCriticalObjectVocabulary(
    criticalObjects,
    PARITY_OUTCOMES.AUTHORITY_ADOPTION_REQUIRED,
    PARITY_OUTCOMES.EXPECTED_SCHEMA_INVALID
  );
  return { status, critical_objects: normalized };
}

function validateConfig(config) {
  requirePlainRecord(config, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  const keys = readExactKeys(config, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  requireKeysSubset(keys, ALLOWED_CONFIG_KEYS, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  for (const required of ['operation', 'targetClass', 'environmentClass', 'committedAuthority', 'dependencies']) {
    if (!keys.includes(required)) {
      fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: required });
    }
  }
  if (!hasOwnSafe(config, 'boundaryApproval', PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID)) {
    fail(PARITY_OUTCOMES.APPROVAL_INVALID, { field: 'boundaryApproval' });
  }

  const operation = readOwnEnumerableDataProperty(
    config,
    'operation',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );
  const targetClass = readOwnEnumerableDataProperty(
    config,
    'targetClass',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );
  const environmentClass = readOwnEnumerableDataProperty(
    config,
    'environmentClass',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );
  const boundaryApproval = readOwnEnumerableDataProperty(
    config,
    'boundaryApproval',
    PARITY_OUTCOMES.APPROVAL_INVALID
  );
  const releaseSha = hasOwnSafe(config, 'releaseSha', PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID)
    ? readOwnEnumerableDataProperty(config, 'releaseSha', PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID)
    : undefined;
  const committedAuthority = readOwnEnumerableDataProperty(
    config,
    'committedAuthority',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );
  const dependencies = readOwnEnumerableDataProperty(
    config,
    'dependencies',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );

  if (operation !== OPERATION) {
    fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: 'operation' });
  }
  if (targetClass !== TARGET_CLASS) {
    fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: 'targetClass' });
  }
  if (environmentClass !== ENVIRONMENT_CLASS) {
    fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: 'environmentClass' });
  }
  if (releaseSha !== undefined) {
    if (typeof releaseSha !== 'string' || !RELEASE_SHA_PATTERN.test(releaseSha)) {
      fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: 'releaseSha' });
    }
  }
  if (boundaryApproval !== true) {
    fail(PARITY_OUTCOMES.APPROVAL_INVALID, { field: 'boundaryApproval' });
  }

  return {
    operation,
    targetClass,
    environmentClass,
    boundaryApproval,
    releaseSha,
    committedAuthority,
    dependencies,
  };
}

function validateDependencies(dependencies) {
  requirePlainRecord(dependencies, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  const keys = readExactKeys(dependencies, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  requireExactKeySet(keys, ALLOWED_DEPENDENCY_KEYS, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
  const collector = readOwnEnumerableDataProperty(
    dependencies,
    'collectCatalogEvidence',
    PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID
  );
  if (typeof collector !== 'function') {
    fail(PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID, { field: 'collectCatalogEvidence' });
  }
  return collector;
}

function validateObservedEvidence(evidence) {
  requirePlainRecord(evidence, PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE);
  const keys = readExactKeys(evidence, PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE);
  requireExactKeySet(keys, ALLOWED_EVIDENCE_KEYS, PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE);
  const formatVersion = readOwnEnumerableDataProperty(
    evidence,
    'format_version',
    PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE
  );
  const normalizerVersion = readOwnEnumerableDataProperty(
    evidence,
    'normalizer_version',
    PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE
  );
  const objects = readOwnEnumerableDataProperty(
    evidence,
    'objects',
    PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE
  );
  if (formatVersion !== SUPPORTED_FORMAT_VERSION || normalizerVersion !== SUPPORTED_NORMALIZER_VERSION) {
    fail(PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE, { field: 'version' });
  }
  return validateCriticalObjectVocabulary(
    objects,
    PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE,
    PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE
  );
}

function compareVocabularies(expected, observed) {
  const expectedMap = new Map(expected.map((object) => [object.name, object.fingerprint]));
  const observedMap = new Map(observed.map((object) => [object.name, object.fingerprint]));
  const names = new Set([...expectedMap.keys(), ...observedMap.keys()]);
  const mismatchedObjects = [...names].sort().filter((name) => {
    if (!observedMap.has(name)) return true;
    return observedMap.get(name) !== expectedMap.get(name);
  });
  return {
    confirmed: mismatchedObjects.length === 0,
    mismatchedObjects,
    expectedObjectCount: expected.length,
    observedObjectCount: observed.length,
  };
}

function freezeResult(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (Array.isArray(item)) {
        Object.freeze(item);
        for (const element of item) freezeResult(element);
      } else {
        freezeResult(item);
      }
    }
  }
  return value;
}

/**
 * Run the read-only target attribution & catalog parity preflight.
 * Never throws; always resolves to one bounded frozen result.
 */
async function runParityPreflight(config) {
  let collector = null;
  let committed = null;
  try {
    const parsed = validateConfig(config);
    collector = validateDependencies(parsed.dependencies);
    committed = validateCommittedAuthority(parsed.committedAuthority);
  } catch (error) {
    const outcome = categoryOf(error, PARITY_OUTCOMES.TARGET_ATTRIBUTION_INVALID);
    return freezeResult({
      outcome,
      collectionEffectCount: 0,
      frozen: true,
    });
  }

  let evidence;
  let collectionFailed = false;
  try {
    evidence = await collector();
  } catch {
    collectionFailed = true;
  }
  if (collectionFailed) {
    return freezeResult({
      outcome: PARITY_OUTCOMES.CATALOG_COLLECTION_FAILED,
      collectionEffectCount: 1,
      authorityStatus: committed.status,
      frozen: true,
    });
  }

  let observed;
  try {
    observed = validateObservedEvidence(evidence);
  } catch (error) {
    const outcome = categoryOf(error, PARITY_OUTCOMES.INSUFFICIENT_EVIDENCE);
    return freezeResult({
      outcome,
      collectionEffectCount: 1,
      authorityStatus: committed.status,
      frozen: true,
    });
  }

  const comparison = compareVocabularies(committed.critical_objects, observed);
  const base = {
    collectionEffectCount: 1,
    authorityStatus: committed.status,
    expectedObjectCount: comparison.expectedObjectCount,
    observedObjectCount: comparison.observedObjectCount,
    frozen: true,
  };
  if (comparison.confirmed) {
    return freezeResult({
      ...base,
      outcome: PARITY_OUTCOMES.PARITY_CONFIRMED,
      mismatchedObjects: [],
    });
  }
  return freezeResult({
    ...base,
    outcome: PARITY_OUTCOMES.PARITY_MISMATCH,
    mismatchedObjects: comparison.mismatchedObjects.slice(),
  });
}

module.exports = {
  OPERATION,
  TARGET_CLASS,
  ENVIRONMENT_CLASS,
  ADOPTION_REQUIRED,
  PARITY_OUTCOMES,
  ALLOWED_CONFIG_KEYS,
  ALLOWED_DEPENDENCY_KEYS,
  ALLOWED_AUTHORITY_KEYS,
  ALLOWED_EVIDENCE_KEYS,
  ALLOWED_OBJECT_KEYS,
  OBJECT_NAME_PATTERN,
  FINGERPRINT_PATTERN,
  RELEASE_SHA_PATTERN,
  runParityPreflight,
  validateCommittedAuthority,
  validateObservedEvidence,
  compareVocabularies,
};
