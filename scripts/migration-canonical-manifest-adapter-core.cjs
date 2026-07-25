'use strict';

/**
 * Canonical manifest loader adapter — source-tested contract (#3652).
 *
 * Source-only adapter: reads one fixed repository JSON file, parses it exactly
 * once, snapshots all runner projection values from the parsed source via
 * descriptors BEFORE invoking the existing validator, then delegates to
 * validateMigrationManifest. The frozen projection is built from captured
 * values only — the validator never re-reads the parsed source.
 *
 * Supported reader/validator return types:
 *   - synchronous result
 *   - genuine native Promise (resolved to result)
 * Proxy-wrapped Promises and arbitrary thenables are not assimilated.
 *
 * Refs #3652
 * Refs #3650
 * Refs #3458 - Keep #3458 OPEN.
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const fs = require('node:fs');
const path = require('node:path');
const { types: utilTypes } = require('node:util');
const { validateMigrationManifest } = require('./migration-provenance-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

const MANIFEST_RELATIVE_PATH = path.join('db', 'migration-provenance', 'canonical-migrations.json');

const ALLOWED_CONFIG_KEYS = Object.freeze(['readFixedManifestText', 'validateMigrationManifest']);

const VALID_STATUS_VALUES = Object.freeze(new Set(['ADOPTION_REQUIRED', 'ACTIVE']));

const FACTORY_ERROR_INVALID_DEPENDENCY = 'MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY';

const PUBLIC_ERROR_UNAVAILABLE = 'MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE';

function createSanitizedError(message) {
  const error = new Error(message);

  try {
    Object.defineProperty(error, 'stack', {
      value: undefined,
      enumerable: false,
      writable: false,
      configurable: false
    });
  } catch {
    // Do not expose the original construction error.
  }

  return error;
}

function isGenuinePromise(value) {
  try {
    return utilTypes.isPromise(value);
  } catch {
    return false;
  }
}

function safeOwnKeyDescriptors(obj) {
  let keys;
  try {
    keys = Reflect.ownKeys(obj);
  } catch (error) {
    return undefined;
  }
  const descriptors = [];
  for (const key of keys) {
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(obj, key);
    } catch (error) {
      return undefined;
    }
    if (desc === undefined) return undefined;
    descriptors.push({ key, desc });
  }
  return descriptors;
}

function safeDescriptorSnapshot(obj) {
  if (obj === null || typeof obj !== 'object') return undefined;
  try {
    if (Array.isArray(obj)) return undefined;
  } catch (e) {
    return undefined;
  }
  let proto;
  try {
    proto = Object.getPrototypeOf(obj);
  } catch (e) {
    return undefined;
  }
  if (proto !== Object.prototype && proto !== null) return undefined;
  return safeOwnKeyDescriptors(obj);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCallEnvelope(arg) {
  if (arg === undefined || arg === null) return false;
  if (typeof arg !== 'object') return false;
  try {
    if (Array.isArray(arg)) return false;
  } catch (e) {
    return false;
  }

  let proto;
  try {
    proto = Object.getPrototypeOf(arg);
  } catch (e) {
    return false;
  }
  if (proto !== Object.prototype && proto !== null) return false;

  const descriptors = safeOwnKeyDescriptors(arg);
  if (descriptors === undefined) return false;

  for (const { key, desc } of descriptors) {
    if (typeof key === 'symbol') return false;
    if ('get' in desc || 'set' in desc) return false;
    if (desc.enumerable !== true) return false;
  }

  const ownKeys = [];
  for (const { key } of descriptors) {
    if (typeof key === 'string') ownKeys.push(key);
  }

  if (ownKeys.length !== 1) return false;
  if (ownKeys[0] !== 'targetMigrationId') return false;

  const targetDesc = descriptors.find((d) => d.key === 'targetMigrationId');
  if (!targetDesc) return false;
  if (!('value' in targetDesc.desc)) return false;

  const target = targetDesc.desc.value;
  if (typeof target !== 'string') return false;
  if (target.trim().length === 0) return false;

  return true;
}

function resolveConfinedRegularFile(relativePath) {
  const lexicalTarget = path.resolve(REPO_ROOT, relativePath);
  const lexicalRoot = path.resolve(REPO_ROOT);

  if (!lexicalTarget.startsWith(lexicalRoot + path.sep) && lexicalTarget !== lexicalRoot) {
    return undefined;
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync(REPO_ROOT);
  } catch (e) {
    return undefined;
  }

  let realTarget;
  try {
    realTarget = fs.realpathSync(lexicalTarget);
  } catch (e) {
    return undefined;
  }

  if (!realTarget.startsWith(realRoot + path.sep) && realTarget !== realRoot) {
    return undefined;
  }

  let stat;
  try {
    stat = fs.statSync(realTarget);
  } catch (e) {
    return undefined;
  }

  if (!stat.isFile()) {
    return undefined;
  }

  return realTarget;
}

function defaultReadFixedManifestText() {
  const realTarget = resolveConfinedRegularFile(MANIFEST_RELATIVE_PATH);
  if (realTarget === undefined) {
    throw createSanitizedError(PUBLIC_ERROR_UNAVAILABLE);
  }
  return fs.readFileSync(realTarget, 'utf8');
}

function parseValidatorResult(raw) {
  const descriptors = safeDescriptorSnapshot(raw);
  if (descriptors === undefined) return { valid: false };

  const okDesc = descriptors.find((d) => d.key === 'ok');
  if (!okDesc) return { valid: false };
  if ('get' in okDesc.desc || 'set' in okDesc.desc) return { valid: false };
  if (okDesc.desc.enumerable !== true) return { valid: false };

  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return { valid: false };
    if ('get' in desc || 'set' in desc) return { valid: false };
    if (desc.enumerable !== true) return { valid: false };
  }

  const ok = okDesc.desc.value;
  return { valid: true, ok };
}

function snapshotDenseArray(value, snapshotElement) {
  if (!Array.isArray(value)) return undefined;

  let proto;
  try {
    proto = Object.getPrototypeOf(value);
  } catch (e) {
    return undefined;
  }
  if (proto !== Array.prototype) return undefined;

  const descriptors = safeOwnKeyDescriptors(value);
  if (descriptors === undefined) return undefined;

  let lengthDesc;
  for (const { key, desc } of descriptors) {
    if (key === 'length') {
      if ('get' in desc || 'set' in desc) return undefined;
      if (desc.enumerable !== false) return undefined;
      if (!('value' in desc)) return undefined;
      lengthDesc = desc;
    }
  }

  if (!lengthDesc) return undefined;
  const length = lengthDesc.value;
  if (!Number.isInteger(length) || length < 0) return undefined;

  const stringKeys = descriptors.filter((d) => typeof d.key === 'string');
  const expectedKeys = new Set(['length']);
  for (let i = 0; i < length; i += 1) {
    expectedKeys.add(String(i));
  }

  if (stringKeys.length !== expectedKeys.size) return undefined;

  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return undefined;
    if (!expectedKeys.has(key)) return undefined;
    if (key !== 'length') {
      if ('get' in desc || 'set' in desc) return undefined;
      if (desc.enumerable !== true) return undefined;
      if (!('value' in desc)) return undefined;
    }
  }

  const captured = [];
  for (let i = 0; i < length; i += 1) {
    const indexDesc = descriptors.find((d) => d.key === String(i));
    if (!indexDesc) return undefined;
    const elementResult = snapshotElement(indexDesc.desc.value);
    if (elementResult === undefined) return undefined;
    captured.push(elementResult);
  }

  return captured;
}

function snapshotNonEmptyString(value) {
  if (typeof value !== 'string') return undefined;
  if (value.trim().length === 0) return undefined;
  return value;
}

function snapshotMigrationRecord(value) {
  const descriptors = safeDescriptorSnapshot(value);
  if (descriptors === undefined) return undefined;

  const fieldMap = {};
  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return undefined;
    if ('get' in desc || 'set' in desc) return undefined;
    if (desc.enumerable !== true) return undefined;
    if (!('value' in desc)) return undefined;
    fieldMap[key] = desc.value;
  }

  const id = snapshotNonEmptyString(fieldMap.id);
  if (id === undefined) return undefined;

  const checksum = snapshotNonEmptyString(fieldMap.checksum);
  if (checksum === undefined) return undefined;

  const dependsOnRaw = fieldMap.depends_on;
  const dependsOn = snapshotDenseArray(dependsOnRaw, snapshotNonEmptyString);
  if (dependsOn === undefined) return undefined;

  const transactionMode = snapshotNonEmptyString(fieldMap.transaction_mode);
  if (transactionMode === undefined) return undefined;

  const riskClass = snapshotNonEmptyString(fieldMap.risk_class);
  if (riskClass === undefined) return undefined;

  const destructiveRaw = fieldMap.destructive_operations;
  const destructiveOperations = snapshotDenseArray(destructiveRaw, snapshotNonEmptyString);
  if (destructiveOperations === undefined) return undefined;

  return Object.freeze({
    id,
    checksum,
    depends_on: Object.freeze(dependsOn),
    transaction_mode: transactionMode,
    risk_class: riskClass,
    destructive_operations: Object.freeze(destructiveOperations)
  });
}

function snapshotManifest(parsed) {
  const descriptors = safeDescriptorSnapshot(parsed);
  if (descriptors === undefined) return undefined;

  const fieldMap = {};
  for (const { key, desc } of descriptors) {
    if (typeof key !== 'string') return undefined;
    if ('get' in desc || 'set' in desc) return undefined;
    if (desc.enumerable !== true) return undefined;
    if (!('value' in desc)) return undefined;
    fieldMap[key] = desc.value;
  }

  const status = fieldMap.status;
  if (typeof status !== 'string') return undefined;
  if (!VALID_STATUS_VALUES.has(status)) return undefined;

  const migrationsRaw = fieldMap.migrations;
  const migrations = snapshotDenseArray(migrationsRaw, snapshotMigrationRecord);
  if (migrations === undefined) return undefined;

  return Object.freeze({
    status,
    migrations: Object.freeze(migrations)
  });
}

function createMigrationCanonicalManifestAdapter(config) {
  let readFn = defaultReadFixedManifestText;
  let validatorFn = validateMigrationManifest;

  if (config !== undefined) {
    if (config === null) {
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    if (typeof config !== 'object') {
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    try {
      if (Array.isArray(config)) {
        throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
      }
    } catch (e) {
      if (e.message === FACTORY_ERROR_INVALID_DEPENDENCY) throw e;
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    let configProto;
    try {
      configProto = Object.getPrototypeOf(config);
    } catch (e) {
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    if (configProto !== Object.prototype && configProto !== null) {
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    const configDescriptors = safeOwnKeyDescriptors(config);
    if (configDescriptors === undefined) {
      throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    for (const { key, desc } of configDescriptors) {
      if (typeof key === 'symbol') throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
      if ('get' in desc || 'set' in desc) throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
      if (desc.enumerable !== true) throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    const configOwnKeys = [];
    for (const { key } of configDescriptors) {
      if (typeof key === 'string') configOwnKeys.push(key);
    }
    for (const k of configOwnKeys) {
      if (!ALLOWED_CONFIG_KEYS.includes(k)) {
        throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
      }
    }

    for (const { key, desc } of configDescriptors) {
      if (key === 'readFixedManifestText') {
        if (!('value' in desc)) throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
        readFn = desc.value;
      }
      if (key === 'validateMigrationManifest') {
        if (!('value' in desc)) throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw createSanitizedError(FACTORY_ERROR_INVALID_DEPENDENCY);
        validatorFn = desc.value;
      }
    }
  }

  async function loadManifest(arg) {
    if (!validateCallEnvelope(arg)) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    let text;
    try {
      text = readFn();
    } catch (e) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    let raw;
    try {
      if (isGenuinePromise(text)) {
        raw = await text;
      } else {
        raw = text;
      }
    } catch (e) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    if (typeof raw !== 'string') {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    const snapshot = snapshotManifest(parsed);
    if (snapshot === undefined) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    let validatorResult;
    try {
      validatorResult = validatorFn(parsed, REPO_ROOT);
    } catch (e) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    let vr;
    try {
      if (isGenuinePromise(validatorResult)) {
        vr = await validatorResult;
      } else {
        vr = validatorResult;
      }
    } catch (e) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    const vSnapshot = parseValidatorResult(vr);
    if (!vSnapshot.valid) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    if (vSnapshot.ok !== true) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    return snapshot;
  }

  return Object.freeze({
    loadManifest
  });
}

module.exports = {
  FACTORY_ERROR_INVALID_DEPENDENCY,
  PUBLIC_ERROR_UNAVAILABLE,
  MANIFEST_RELATIVE_PATH,
  createMigrationCanonicalManifestAdapter
};
