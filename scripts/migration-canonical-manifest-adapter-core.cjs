'use strict';

/**
 * Canonical manifest loader adapter — source-tested contract (#3652).
 *
 * Source-only adapter: reads one fixed repository JSON file, parses it exactly
 * once, delegates to the existing `validateMigrationManifest` validator, and
 * returns a frozen detached projection of the validated manifest.
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

const PROTOCOL_SIX_KEYS = Object.freeze(['id', 'checksum', 'depends_on', 'transaction_mode', 'risk_class', 'destructive_operations']);

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

function keysMatchExactSet(descriptors, allowedKeys) {
  const stringKeys = descriptors.filter((d) => typeof d.key === 'string');
  if (stringKeys.length !== allowedKeys.length) return false;
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
  for (const { key, desc } of descriptors) {
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

  const ok = okDesc.desc.value;
  return { valid: true, ok };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDenseArrayOfNonEmptyStrings(value) {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i += 1) {
    if (i in value === false) return false;
    if (!isNonEmptyString(value[i])) return false;
  }
  return true;
}

function validateProjection(manifest) {
  if (manifest === null || typeof manifest !== 'object') return { valid: false };
  try {
    if (Array.isArray(manifest)) return { valid: false };
  } catch (e) {
    return { valid: false };
  }

  let proto;
  try {
    proto = Object.getPrototypeOf(manifest);
  } catch (e) {
    return { valid: false };
  }
  if (proto !== Object.prototype && proto !== null) return { valid: false };

  const desc = safeOwnKeyDescriptors(manifest);
  if (desc === undefined) return { valid: false };

  const statusDesc = desc.find((d) => d.key === 'status');
  if (!statusDesc) return { valid: false };
  if ('get' in statusDesc.desc || 'set' in statusDesc.desc) return { valid: false };
  if (statusDesc.desc.enumerable !== true) return { valid: false };
  if (typeof statusDesc.desc.value !== 'string') return { valid: false };
  if (!VALID_STATUS_VALUES.has(statusDesc.desc.value)) return { valid: false };

  const migrationsDesc = desc.find((d) => d.key === 'migrations');
  if (!migrationsDesc) return { valid: false };
  if ('get' in migrationsDesc.desc || 'set' in migrationsDesc.desc) return { valid: false };
  if (migrationsDesc.desc.enumerable !== true) return { valid: false };
  if (!Array.isArray(migrationsDesc.desc.value)) return { valid: false };

  const migrations = migrationsDesc.desc.value;

  for (let i = 0; i < migrations.length; i += 1) {
    if (i in migrations === false) return { valid: false };
    const m = migrations[i];
    if (m === null || typeof m !== 'object') return { valid: false };
    try {
      if (Array.isArray(m)) return { valid: false };
    } catch (e) {
      return { valid: false };
    }

    let mProto;
    try {
      mProto = Object.getPrototypeOf(m);
    } catch (e) {
      return { valid: false };
    }
    if (mProto !== Object.prototype && mProto !== null) return { valid: false };

    if (!isNonEmptyString(m.id)) return { valid: false };
    if (!isNonEmptyString(m.checksum)) return { valid: false };
    if (!Array.isArray(m.depends_on)) return { valid: false };
    if (!isDenseArrayOfNonEmptyStrings(m.depends_on)) return { valid: false };
    if (!isNonEmptyString(m.transaction_mode)) return { valid: false };
    if (!isNonEmptyString(m.risk_class)) return { valid: false };
    if (!Array.isArray(m.destructive_operations)) return { valid: false };
    if (!isDenseArrayOfNonEmptyStrings(m.destructive_operations)) return { valid: false };
  }

  return { valid: true, status: statusDesc.desc.value, migrations };
}

function projectMigration(source) {
  return Object.freeze({
    id: source.id,
    checksum: source.checksum,
    depends_on: Object.freeze([...source.depends_on]),
    transaction_mode: source.transaction_mode,
    risk_class: source.risk_class,
    destructive_operations: Object.freeze([...source.destructive_operations])
  });
}

function createMigrationCanonicalManifestAdapter(config) {
  let readFn = defaultReadFixedManifestText;
  let validatorFn = validateMigrationManifest;

  if (config !== undefined) {
    if (config === null) {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    if (typeof config !== 'object') {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    try {
      if (Array.isArray(config)) {
        throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
      }
    } catch (e) {
      if (e.message === FACTORY_ERROR_INVALID_DEPENDENCY) throw e;
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    let configProto;
    try {
      configProto = Object.getPrototypeOf(config);
    } catch (e) {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    if (configProto !== Object.prototype && configProto !== null) {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    const configDescriptors = safeOwnKeyDescriptors(config);
    if (configDescriptors === undefined) {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    for (const { key, desc } of configDescriptors) {
      if (typeof key === 'symbol') throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
      if ('get' in desc || 'set' in desc) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
      if (desc.enumerable !== true) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }

    const configOwnKeys = [];
    for (const { key } of configDescriptors) {
      if (typeof key === 'string') configOwnKeys.push(key);
    }
    for (const k of configOwnKeys) {
      if (!ALLOWED_CONFIG_KEYS.includes(k)) {
        throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
      }
    }

    for (const { key, desc } of configDescriptors) {
      if (key === 'readFixedManifestText') {
        if (!('value' in desc)) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        readFn = desc.value;
      }
      if (key === 'validateMigrationManifest') {
        if (!('value' in desc)) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
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

    const projection = validateProjection(parsed);
    if (!projection.valid) {
      return Promise.reject(createSanitizedError(PUBLIC_ERROR_UNAVAILABLE));
    }

    const projectedMigrations = projection.migrations.map(projectMigration);

    return Object.freeze({
      status: projection.status,
      migrations: Object.freeze(projectedMigrations)
    });
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
