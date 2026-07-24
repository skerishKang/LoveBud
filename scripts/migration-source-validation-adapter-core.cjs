'use strict';

/**
 * Migration source-validation adapter — source-tested contract (#3650).
 *
 * This is a source-tested adapter that reads three fixed repository JSON files
 * and delegates to the existing `validateSourceConfiguration` validator. It does
 * NOT execute SQL, open a database connection, import `pg`, access network,
 * modify manifests, or perform any side effect beyond reading three fixed files.
 *
 * Fixed source paths (relative to repository root):
 *   1. docs/architecture/migration-path-inventory.json
 *   2. db/migration-provenance/canonical-migrations.json
 *   3. db/migration-provenance/expected-schema-manifest.json
 *
 * Refs #3650
 * Refs #3458 - Keep #3458 OPEN.
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const fs = require('node:fs');
const path = require('node:path');
const { validateSourceConfiguration } = require('./migration-provenance-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_VALIDATION_RESULTS = Object.freeze({
  PASS: Object.freeze({ status: 'PASS' }),
  FAIL: Object.freeze({ status: 'FAIL' }),
  UNAVAILABLE: Object.freeze({ status: 'UNAVAILABLE' })
});

const FACTORY_ERROR_MISSING_DEPENDENCY = 'SOURCE_VALIDATION_ADAPTER_MISSING_DEPENDENCY';
const FACTORY_ERROR_INVALID_DEPENDENCY = 'SOURCE_VALIDATION_ADAPTER_INVALID_DEPENDENCY';
const ERROR_INVALID_INPUT = 'SOURCE_VALIDATION_ADAPTER_INVALID_INPUT';

const INVENTORY_RELATIVE = path.join('docs', 'architecture', 'migration-path-inventory.json');
const CANONICAL_MIGRATIONS_RELATIVE = path.join('db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_RELATIVE = path.join('db', 'migration-provenance', 'expected-schema-manifest.json');

const INV_PATH = path.resolve(REPO_ROOT, INVENTORY_RELATIVE);
const MIGRATIONS_PATH = path.resolve(REPO_ROOT, CANONICAL_MIGRATIONS_RELATIVE);
const SCHEMA_PATH = path.resolve(REPO_ROOT, EXPECTED_SCHEMA_RELATIVE);

function safeGetOwnDataProperty(obj, key) {
  try {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc === undefined) return undefined;
    if ('get' in desc || 'set' in desc) return undefined;
    return desc.value;
  } catch (e) {
    return undefined;
  }
}

function safeIsPlainRecord(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
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

function assertPathContainment(filePath, repoRoot, repoReal) {
  const normalized = path.resolve(repoRoot, filePath);
  const lexicalRoot = path.resolve(repoRoot);

  if (!normalized.startsWith(lexicalRoot + path.sep) && normalized !== lexicalRoot) {
    return false;
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync(repoRoot);
  } catch (e) {
    return false;
  }

  let realTarget;
  try {
    realTarget = fs.realpathSync(normalized);
  } catch (e) {
    return false;
  }

  if (!realTarget.startsWith(realRoot + path.sep) && realTarget !== realRoot) {
    return false;
  }

  let stat;
  try {
    stat = fs.statSync(realTarget);
  } catch (e) {
    return false;
  }

  if (!stat.isFile()) {
    return false;
  }

  return true;
}

function readAndParseSource(filePath, repoRoot) {
  if (!assertPathContainment(filePath, repoRoot)) {
    return { ok: false, unavailable: true };
  }

  const fullPath = path.resolve(repoRoot, filePath);
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch (e) {
    return { ok: false, unavailable: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { ok: false, unavailable: false, parseError: true };
  }

  return { ok: true, parsed };
}

function defaultLoadFixedSources() {
  const inventory = readAndParseSource(INVENTORY_RELATIVE, REPO_ROOT);
  if (!inventory.ok) {
    return { available: false, inventory: null, migrations: null, schema: null };
  }

  const migrations = readAndParseSource(CANONICAL_MIGRATIONS_RELATIVE, REPO_ROOT);
  if (!migrations.ok) {
    return { available: false, inventory: null, migrations: null, schema: null };
  }

  const schema = readAndParseSource(EXPECTED_SCHEMA_RELATIVE, REPO_ROOT);
  if (!schema.ok) {
    return { available: false, inventory: null, migrations: null, schema: null };
  }

  return {
    available: true,
    inventory: inventory.parsed,
    migrations: migrations.parsed,
    schema: schema.parsed
  };
}

function createMigrationSourceValidationAdapter(config) {
  const cfg = config || {};

  let loadFixedSources = defaultLoadFixedSources;
  let validatorFn = validateSourceConfiguration;

  if ('loadFixedSources' in cfg) {
    const loader = safeGetOwnDataProperty(cfg, 'loadFixedSources');
    if (typeof loader !== 'function') {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    loadFixedSources = loader;
  }

  if ('validateSourceConfiguration' in cfg) {
    const validator = safeGetOwnDataProperty(cfg, 'validateSourceConfiguration');
    if (typeof validator !== 'function') {
      throw new Error(FACTORY_ERROR_INVALID_DEPENDENCY);
    }
    validatorFn = validator;
  }

  async function validateSource(arg) {
    if (!validateCallEnvelope(arg)) {
      return SOURCE_VALIDATION_RESULTS.FAIL;
    }

    let sources;
    try {
      sources = loadFixedSources();
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    if (!sources || !sources.available) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    let result;
    try {
      const raw = validatorFn({
        repoRoot: REPO_ROOT,
        inventory: sources.inventory,
        migrationManifest: sources.migrations,
        expectedSchemaManifest: sources.schema
      });
      result = await raw;
    } catch (e) {
      return SOURCE_VALIDATION_RESULTS.UNAVAILABLE;
    }

    if (result && result.ok === true) {
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
  FACTORY_ERROR_MISSING_DEPENDENCY,
  FACTORY_ERROR_INVALID_DEPENDENCY,
  ERROR_INVALID_INPUT,
  createMigrationSourceValidationAdapter,
  validateSourceConfiguration
};
