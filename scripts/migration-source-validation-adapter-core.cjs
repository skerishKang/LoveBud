'use strict';

/**
 * Migration source-validation adapter — source-tested contract (#3650).
 *
 * Source-only adapter: reads four fixed repository JSON files via a loader,
 * parses each exactly once, delegates to the existing `validateSourceConfiguration`
 * validator plus the precondition registry validator, and returns
 * PASS|FAIL|UNAVAILABLE.
 *
 * Supported loader/validator return types:
 *   - synchronous plain object
 *   - genuine native Promise (resolved to plain object)
 * Proxy-wrapped Promises and arbitrary thenables are not assimilated.
 *
 * Sources:
 *   1. docs/architecture/migration-path-inventory.json
 *   2. db/migration-provenance/canonical-migrations.json
 *   3. db/migration-provenance/expected-schema-manifest.json
 *   4. db/migration-provenance/precondition-registry.json
 *
 * Refs #3650
 * Refs #3659
 * Refs #3657
 * Refs #3658
 * Refs #3652
 * Refs #3646
 * Refs #3458 - Keep #3458 OPEN.
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const fs = require('node:fs');
const path = require('node:path');
const { types: utilTypes } = require('node:util');
const { validateSourceConfiguration } = require('./migration-provenance-core.cjs');
const {
  validatePreconditionRegistry,
  validateRegistryManifestBinding
} = require('./migration-precondition-registry-validator-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_VALIDATION_RESULTS = Object.freeze({
  PASS: Object.freeze({ status: 'PASS' }),
  FAIL: Object.freeze({ status: 'FAIL' }),
  UNAVAILABLE: Object.freeze({ status: 'UNAVAILABLE' })
});

const SOURCE_LOAD_STATUSES = Object.freeze({
  LOADED: 'LOADED',
  INVALID: 'INVALID',
  UNAVAILABLE: 'UNAVAILABLE'
});

const FACTORY_ERROR_INVALID_DEPENDENCY = 'SOURCE_VALIDATION_ADAPTER_INVALID_DEPENDENCY';

const INVENTORY_RELATIVE = path.join('docs', 'architecture', 'migration-path-inventory.json');
const CANONICAL_MIGRATIONS_RELATIVE = path.join('db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_RELATIVE = path.join('db', 'migration-provenance', 'expected-schema-manifest.json');
const PRECONDITION_REGISTRY_RELATIVE = path.join('db', 'migration-provenance', 'precondition-registry.json');

const ALLOWED_CONFIG_KEYS = Object.freeze(['loadFixedSources', 'validateSourceConfiguration']);

const LOADED_EXACT_KEYS = Object.freeze([
  'status', 'inventoryText', 'migrationManifestText',
  'expectedSchemaManifestText', 'preconditionRegistryText'
]);

const INVALID_EXACT_KEYS = Object.freeze(['status']);

const REGISTRY_VALIDATOR_RESULT_KEYS = Object.freeze(['ok', 'errors']);

function isGenuinePromise(value) {
  try {
    return utilTypes.isPromise(value);
  } catch {
    return false;
  }
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

function defaultLoadFixedSources() {
  const invReal = resolveConfinedRegularFile(INVENTORY_RELATIVE);
  if (invReal === undefined) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }
  let invText;
  try {
    invText = fs.readFileSync(invReal, 'utf8');
  } catch (e) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }

  const migReal = resolveConfinedRegularFile(CANONICAL_MIGRATIONS_RELATIVE);
  if (migReal === undefined) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }
  let migText;
  try {
    migText = fs.readFileSync(migReal, 'utf8');
  } catch (e) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }

  const schReal = resolveConfinedRegularFile(EXPECTED_SCHEMA_RELATIVE);
  if (schReal === undefined) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }
  let schText;
  try {
    schText = fs.readFileSync(schReal, 'utf8');
  } catch (e) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }

  const regReal = resolveConfinedRegularFile(PRECONDITION_REGISTRY_RELATIVE);
  if (regReal === undefined) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }
  let regText;
  try {
    regText = fs.readFileSync(regReal, 'utf8');
  } catch (e) {
    return { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }

  return {
    status: SOURCE_LOAD_STATUSES.LOADED,
    inventoryText: invText,
    migrationManifestText: migText,
    expectedSchemaManifestText: schText,
    preconditionRegistryText: regText
  };
}

function parseSnapshotLoaderResult(raw) {
  const descriptors = safeDescriptorSnapshot(raw);
  if (descriptors === undefined) return { valid: false };

  const statusDesc = descriptors.find((d) => d.key === 'status');
  if (!statusDesc || !('value' in statusDesc.desc)) return { valid: false };
  if (statusDesc.desc.enumerable !== true) return { valid: false };
  const status = statusDesc.desc.value;
  if (typeof status !== 'string') return { valid: false };

  if (status === SOURCE_LOAD_STATUSES.UNAVAILABLE) {
    if (!keysMatchExactSet(descriptors, INVALID_EXACT_KEYS)) return { valid: false };
    return { valid: true, loadStatus: SOURCE_LOAD_STATUSES.UNAVAILABLE };
  }

  if (status === SOURCE_LOAD_STATUSES.INVALID) {
    if (!keysMatchExactSet(descriptors, INVALID_EXACT_KEYS)) return { valid: false };
    return { valid: true, loadStatus: SOURCE_LOAD_STATUSES.INVALID };
  }

  if (status !== SOURCE_LOAD_STATUSES.LOADED) {
    return { valid: false };
  }

  if (!keysMatchExactSet(descriptors, LOADED_EXACT_KEYS)) return { valid: false };

  const invDesc = descriptors.find((d) => d.key === 'inventoryText');
  if (!invDesc || !('value' in invDesc.desc)) return { valid: false };
  if (invDesc.desc.enumerable !== true) return { valid: false };
  if (typeof invDesc.desc.value !== 'string') return { valid: false };

  const migDesc = descriptors.find((d) => d.key === 'migrationManifestText');
  if (!migDesc || !('value' in migDesc.desc)) return { valid: false };
  if (migDesc.desc.enumerable !== true) return { valid: false };
  if (typeof migDesc.desc.value !== 'string') return { valid: false };

  const schDesc = descriptors.find((d) => d.key === 'expectedSchemaManifestText');
  if (!schDesc || !('value' in schDesc.desc)) return { valid: false };
  if (schDesc.desc.enumerable !== true) return { valid: false };
  if (typeof schDesc.desc.value !== 'string') return { valid: false };

  const regDesc = descriptors.find((d) => d.key === 'preconditionRegistryText');
  if (!regDesc || !('value' in regDesc.desc)) return { valid: false };
  if (regDesc.desc.enumerable !== true) return { valid: false };
  if (typeof regDesc.desc.value !== 'string') return { valid: false };

  return {
    valid: true,
    loadStatus: SOURCE_LOAD_STATUSES.LOADED,
    inventoryText: invDesc.desc.value,
    migrationManifestText: migDesc.desc.value,
    expectedSchemaManifestText: schDesc.desc.value,
    preconditionRegistryText: regDesc.desc.value
  };
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

/**
 * Registry-validator-result parser (#3659).
 *
 * Enforces exact { ok: boolean, errors: string[] } shape.
 * Proxy detection via utilTypes.isProxy() before any reflective
 * inspection. No getter, Proxy trap, or code-path execution.
 */
function parseRegistryValidatorResult(raw) {
  if (raw === null || typeof raw !== 'object') {
    return { valid: false };
  }

  // Proxy rejection before any reflective operation
  try {
    if (utilTypes.isProxy(raw)) {
      return { valid: false };
    }
  } catch {
    return { valid: false };
  }

  // Array rejection
  try {
    if (Array.isArray(raw)) return { valid: false };
  } catch {
    return { valid: false };
  }

  // Prototype check
  let proto;
  try {
    proto = Object.getPrototypeOf(raw);
  } catch {
    return { valid: false };
  }
  if (proto !== Object.prototype && proto !== null) return { valid: false };

  // Descriptor snapshot: exact keys, own enumerable data only
  const descriptors = safeOwnKeyDescriptors(raw);
  if (descriptors === undefined) return { valid: false };

  if (!keysMatchExactSet(descriptors, REGISTRY_VALIDATOR_RESULT_KEYS)) {
    return { valid: false };
  }

  // ok must be boolean
  const okDesc = descriptors.find((d) => d.key === 'ok');
  if (!okDesc || !('value' in okDesc.desc)) return { valid: false };
  if (typeof okDesc.desc.value !== 'boolean') return { valid: false };

  // errors must be dense array of strings
  const errorsDesc = descriptors.find((d) => d.key === 'errors');
  if (!errorsDesc || !('value' in errorsDesc.desc)) return { valid: false };
  const errorsValue = errorsDesc.desc.value;
  if (!Array.isArray(errorsValue)) return { valid: false };
  for (let i = 0; i < errorsValue.length; i++) {
    if (!(i in errorsValue)) return { valid: false };
    if (typeof errorsValue[i] !== 'string') return { valid: false };
  }

  return { valid: true, ok: okDesc.desc.value };
}

function createMigrationSourceValidationAdapter(config) {
  let loadFixedSourcesFn = defaultLoadFixedSources;
  let validatorFn = validateSourceConfiguration;

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
      if (key === 'loadFixedSources') {
        if (!('value' in desc)) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        loadFixedSourcesFn = desc.value;
      }
      if (key === 'validateSourceConfiguration') {
        if (!('value' in desc)) throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        if (typeof desc.value !== 'function') throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
        validatorFn = desc.value;
      }
    }
  }

  async function validateSource(arg) {
    if (!validateCallEnvelope(arg)) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let loadResult;
    try {
      loadResult = loadFixedSourcesFn();
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    let raw;
    try {
      if (isGenuinePromise(loadResult)) {
        raw = await loadResult;
      } else {
        raw = loadResult;
      }
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    const snapshot = parseSnapshotLoaderResult(raw);
    if (!snapshot.valid) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    if (snapshot.loadStatus === SOURCE_LOAD_STATUSES.UNAVAILABLE) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    if (snapshot.loadStatus === SOURCE_LOAD_STATUSES.INVALID) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let inventory;
    try {
      inventory = JSON.parse(snapshot.inventoryText);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let migrationManifest;
    try {
      migrationManifest = JSON.parse(snapshot.migrationManifestText);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let expectedSchemaManifest;
    try {
      expectedSchemaManifest = JSON.parse(snapshot.expectedSchemaManifestText);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let preconditionRegistry;
    try {
      preconditionRegistry = JSON.parse(snapshot.preconditionRegistryText);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    // Validate registry structure (with failure mapping)
    let registryResult;
    try {
      registryResult = validatePreconditionRegistry(preconditionRegistry);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }
    if (isGenuinePromise(registryResult)) {
      try {
        registryResult = await registryResult;
      } catch (e) {
        return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
      }
    }
    const regSnapshot = parseRegistryValidatorResult(registryResult);
    if (!regSnapshot.valid) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }
    if (!regSnapshot.ok) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    // Validate registry-manifest cross-binding (with failure mapping)
    let bindingResult;
    try {
      bindingResult = validateRegistryManifestBinding(preconditionRegistry, migrationManifest);
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }
    if (isGenuinePromise(bindingResult)) {
      try {
        bindingResult = await bindingResult;
      } catch (e) {
        return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
      }
    }
    const bindSnapshot = parseRegistryValidatorResult(bindingResult);
    if (!bindSnapshot.valid) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }
    if (!bindSnapshot.ok) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let rawValidatorResult;
    try {
      rawValidatorResult = validatorFn({
        repoRoot: REPO_ROOT,
        inventory,
        migrationManifest,
        expectedSchemaManifest
      });
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    let validatorResult;
    try {
      if (isGenuinePromise(rawValidatorResult)) {
        validatorResult = await rawValidatorResult;
      } else {
        validatorResult = rawValidatorResult;
      }
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    const vSnapshot = parseValidatorResult(validatorResult);
    if (!vSnapshot.valid) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    if (vSnapshot.ok === true) {
      return SOURCE_VALIDATION_RESULTS.PASS;
    }

    return SOURCE_VALIDATION_RESULTS.FAIL;
  }

  return Object.freeze({
    validateSource
  });
}

module.exports = {
  SOURCE_VALIDATION_RESULTS,
  SOURCE_LOAD_STATUSES,
  FACTORY_ERROR_INVALID_DEPENDENCY,
  createMigrationSourceValidationAdapter,
  validateSourceConfiguration,
  validatePreconditionRegistry,
  validateRegistryManifestBinding,
  parseRegistryValidatorResult
};
