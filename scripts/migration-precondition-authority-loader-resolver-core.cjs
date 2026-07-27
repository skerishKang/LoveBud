'use strict';

/**
 * Fixed migration precondition registry/catalog loader-resolver (#3678).
 *
 * This module loads only repository-owned fixed JSON authorities. It does not
 * execute SQL, call a broker, inspect a lock handle, connect to a database, or
 * implement evaluatePrecondition.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { types: utilTypes } = require('node:util');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const REGISTRY_RELATIVE_PATH = 'db/migration-provenance/precondition-registry.json';
const CATALOG_RELATIVE_PATH = 'db/migration-provenance/readonly-query-catalog.json';
const CONFIG_ERROR = 'MIGRATION_PRECONDITION_AUTHORITY_RESOLVER_CONFIG_INVALID';

const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOWER_SNAKE_CASE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

const ADOPTION_REQUIRED_RESULT = Object.freeze({ status: 'ADOPTION_REQUIRED' });
const NOT_FOUND_RESULT = Object.freeze({ status: 'NOT_FOUND' });
const UNAVAILABLE_RESULT = Object.freeze({ status: 'UNAVAILABLE' });

const DEFAULT_DEPENDENCIES = Object.freeze({
  realpath(targetPath) {
    return fs.realpath(targetPath);
  },
  isRegularFile(targetPath) {
    return fs.stat(targetPath).then((stats) => stats.isFile());
  },
  readUtf8File(targetPath) {
    return fs.readFile(targetPath, 'utf8');
  },
  parseJson(text) {
    return JSON.parse(text);
  },
});

const ALLOWED_DEPENDENCY_KEYS = Object.freeze([
  'realpath',
  'isRegularFile',
  'readUtf8File',
  'parseJson',
]);

function isObjectLike(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function isProxy(value) {
  if (!isObjectLike(value)) return false;
  try {
    return utilTypes.isProxy(value);
  } catch (error) {
    return true;
  }
}

function safeOwnDescriptors(value) {
  if (!isObjectLike(value) || isProxy(value)) return undefined;
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch (error) {
    return undefined;
  }

  const descriptors = [];
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch (error) {
      return undefined;
    }
    if (!descriptor) return undefined;
    descriptors.push({ key, descriptor });
  }
  return descriptors;
}

function hasPlainPrototype(value) {
  if (!isObjectLike(value) || Array.isArray(value) || isProxy(value)) return false;
  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    return false;
  }
  return prototype === Object.prototype || prototype === null;
}

function snapshotExactPlainDataObject(value, expectedKeys) {
  if (!hasPlainPrototype(value)) return undefined;
  const descriptors = safeOwnDescriptors(value);
  if (!descriptors || descriptors.length !== expectedKeys.length) return undefined;

  const expected = new Set(expectedKeys);
  const values = Object.create(null);
  for (const { key, descriptor } of descriptors) {
    if (typeof key !== 'string' || !expected.has(key)) return undefined;
    if (!('value' in descriptor) || descriptor.enumerable !== true) return undefined;
    values[key] = descriptor.value;
  }

  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return undefined;
  }
  return values;
}

function snapshotPlainDataObjectWithAllowedKeys(value, allowedKeys) {
  if (!hasPlainPrototype(value)) return undefined;
  const descriptors = safeOwnDescriptors(value);
  if (!descriptors) return undefined;

  const allowed = new Set(allowedKeys);
  const values = Object.create(null);
  for (const { key, descriptor } of descriptors) {
    if (typeof key !== 'string' || !allowed.has(key)) return undefined;
    if (!('value' in descriptor) || descriptor.enumerable !== true) return undefined;
    values[key] = descriptor.value;
  }
  return values;
}

function snapshotPlainDataMapping(value) {
  if (!hasPlainPrototype(value)) return undefined;
  const descriptors = safeOwnDescriptors(value);
  if (!descriptors) return undefined;

  const entries = [];
  for (const { key, descriptor } of descriptors) {
    if (typeof key !== 'string') return undefined;
    if (!('value' in descriptor) || descriptor.enumerable !== true) return undefined;
    entries.push([key, descriptor.value]);
  }
  return entries;
}

function snapshotDenseArray(value) {
  if (!Array.isArray(value) || isProxy(value)) return undefined;
  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    return undefined;
  }
  if (prototype !== Array.prototype) return undefined;

  const descriptors = safeOwnDescriptors(value);
  if (!descriptors) return undefined;
  const lengthDescriptor = descriptors.find(({ key }) => key === 'length');
  if (!lengthDescriptor || !('value' in lengthDescriptor.descriptor)) return undefined;
  const length = lengthDescriptor.descriptor.value;
  if (!Number.isSafeInteger(length) || length < 0) return undefined;
  if (lengthDescriptor.descriptor.enumerable !== false) return undefined;

  const expectedKeys = new Set(['length']);
  for (let index = 0; index < length; index += 1) expectedKeys.add(String(index));
  if (descriptors.length !== expectedKeys.size) return undefined;

  const values = [];
  for (const { key, descriptor } of descriptors) {
    if (typeof key !== 'string' || !expectedKeys.has(key)) return undefined;
    if (key === 'length') continue;
    if (!('value' in descriptor) || descriptor.enumerable !== true) return undefined;
  }

  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors.find(({ key }) => key === String(index));
    if (!descriptor) return undefined;
    values.push(descriptor.descriptor.value);
  }
  return values;
}

function isFixedJsonScalar(value) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return typeof value === 'number' && Number.isFinite(value);
}

function throwConfigError() {
  throw new TypeError(CONFIG_ERROR);
}

function normalizeDependencies(config) {
  if (config === undefined) return DEFAULT_DEPENDENCIES;

  const configSnapshot = snapshotPlainDataObjectWithAllowedKeys(config, ['dependencies']);
  if (!configSnapshot) throwConfigError();

  let overrides = Object.create(null);
  if (Object.prototype.hasOwnProperty.call(configSnapshot, 'dependencies')) {
    overrides = snapshotPlainDataObjectWithAllowedKeys(
      configSnapshot.dependencies,
      ALLOWED_DEPENDENCY_KEYS,
    );
    if (!overrides) throwConfigError();
  }

  const dependencies = Object.create(null);
  for (const key of ALLOWED_DEPENDENCY_KEYS) {
    const candidate = Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : DEFAULT_DEPENDENCIES[key];
    if (typeof candidate !== 'function' || isProxy(candidate)) throwConfigError();
    dependencies[key] = candidate;
  }
  return Object.freeze(dependencies);
}

function isNativePromise(value) {
  if (!isObjectLike(value) || isProxy(value)) return false;
  let promise;
  try {
    promise = utilTypes.isPromise(value);
  } catch (error) {
    return false;
  }
  if (!promise) return false;

  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    return false;
  }
  return prototype === Promise.prototype;
}

async function invokeDependency(dependency, args) {
  let raw;
  try {
    raw = Reflect.apply(dependency, undefined, args);
  } catch (error) {
    throw new Error('UNAVAILABLE');
  }

  if (isProxy(raw)) throw new Error('UNAVAILABLE');

  let value = raw;
  if (isObjectLike(raw) && utilTypes.isPromise(raw)) {
    if (!isNativePromise(raw)) throw new Error('UNAVAILABLE');
    try {
      value = await raw;
    } catch (error) {
      throw new Error('UNAVAILABLE');
    }
    if (isProxy(value)) throw new Error('UNAVAILABLE');
  }

  // Wrap the value so this async function never assimilates a direct arbitrary
  // thenable returned by a dependency.
  return Object.freeze({ value });
}

function isContainedPath(rootPath, targetPath) {
  if (typeof rootPath !== 'string' || typeof targetPath !== 'string') return false;
  if (!path.isAbsolute(rootPath) || !path.isAbsolute(targetPath)) return false;
  const relative = path.relative(rootPath, targetPath);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function fixedLexicalTarget(relativePath) {
  const target = path.resolve(REPOSITORY_ROOT, relativePath);
  if (!isContainedPath(REPOSITORY_ROOT, target)) throw new Error('UNAVAILABLE');
  return target;
}

async function loadFixedJsonAuthority(relativePath, dependencies, context) {
  const lexicalTarget = fixedLexicalTarget(relativePath);

  if (!context.realRepositoryRoot) {
    const rootResult = await invokeDependency(dependencies.realpath, [REPOSITORY_ROOT]);
    if (typeof rootResult.value !== 'string' || !path.isAbsolute(rootResult.value)) {
      throw new Error('UNAVAILABLE');
    }
    context.realRepositoryRoot = rootResult.value;
  }

  const realTargetResult = await invokeDependency(dependencies.realpath, [lexicalTarget]);
  if (typeof realTargetResult.value !== 'string' ||
      !isContainedPath(context.realRepositoryRoot, realTargetResult.value)) {
    throw new Error('UNAVAILABLE');
  }

  const regularFileResult = await invokeDependency(
    dependencies.isRegularFile,
    [realTargetResult.value],
  );
  if (regularFileResult.value !== true) throw new Error('UNAVAILABLE');

  const readResult = await invokeDependency(dependencies.readUtf8File, [realTargetResult.value]);
  if (typeof readResult.value !== 'string') throw new Error('UNAVAILABLE');

  const parseResult = await invokeDependency(dependencies.parseJson, [readResult.value]);
  return parseResult.value;
}

function validateRegistryAuthority(source) {
  const top = snapshotExactPlainDataObject(source, ['format_version', 'status', 'entries']);
  if (!top || top.format_version !== '1.0') return undefined;

  const entries = snapshotDenseArray(top.entries);
  if (!entries) return undefined;

  if (top.status === 'ADOPTION_REQUIRED') {
    if (entries.length !== 0) return undefined;
    return Object.freeze({ status: 'ADOPTION_REQUIRED', entries: Object.freeze([]) });
  }
  if (top.status !== 'ACTIVE' || entries.length === 0) return undefined;

  const seenMigrationIds = new Set();
  const normalizedEntries = [];
  for (const sourceEntry of entries) {
    const entry = snapshotExactPlainDataObject(sourceEntry, ['migration_id', 'checks']);
    if (!entry || typeof entry.migration_id !== 'string' ||
        !MIGRATION_ID_PATTERN.test(entry.migration_id) ||
        seenMigrationIds.has(entry.migration_id)) {
      return undefined;
    }
    seenMigrationIds.add(entry.migration_id);

    const sourceChecks = snapshotDenseArray(entry.checks);
    if (!sourceChecks) return undefined;
    const seenCheckIds = new Set();
    const checks = [];
    for (const sourceCheck of sourceChecks) {
      const check = snapshotExactPlainDataObject(
        sourceCheck,
        ['check_id', 'query_reference', 'expected'],
      );
      if (!check || typeof check.check_id !== 'string' ||
          !KEBAB_CASE_PATTERN.test(check.check_id) ||
          seenCheckIds.has(check.check_id) ||
          typeof check.query_reference !== 'string' ||
          !KEBAB_CASE_PATTERN.test(check.query_reference) ||
          typeof check.expected !== 'boolean') {
        return undefined;
      }
      seenCheckIds.add(check.check_id);
      checks.push(Object.freeze({
        checkId: check.check_id,
        queryReference: check.query_reference,
        expected: check.expected,
      }));
    }

    normalizedEntries.push(Object.freeze({
      migrationId: entry.migration_id,
      checks: Object.freeze(checks),
    }));
  }

  return Object.freeze({ status: 'ACTIVE', entries: Object.freeze(normalizedEntries) });
}

function validateCatalogAuthority(source) {
  const top = snapshotExactPlainDataObject(source, ['format_version', 'status', 'queries']);
  if (!top || top.format_version !== '1.0') return undefined;

  const queryEntries = snapshotPlainDataMapping(top.queries);
  if (!queryEntries) return undefined;

  if (top.status === 'ADOPTION_REQUIRED') {
    if (queryEntries.length !== 0) return undefined;
    return Object.freeze({ status: 'ADOPTION_REQUIRED', queries: new Map() });
  }
  if (top.status !== 'ACTIVE' || queryEntries.length === 0) return undefined;

  const queries = new Map();
  for (const [key, sourceEntry] of queryEntries) {
    if (!KEBAB_CASE_PATTERN.test(key) || queries.has(key)) return undefined;
    const entry = snapshotExactPlainDataObject(
      sourceEntry,
      ['name', 'text', 'values', 'result_contract'],
    );
    if (!entry || entry.name !== key || typeof entry.text !== 'string' ||
        entry.text.length === 0) {
      return undefined;
    }

    const sourceValues = snapshotDenseArray(entry.values);
    if (!sourceValues || !sourceValues.every(isFixedJsonScalar)) return undefined;

    const resultContract = snapshotExactPlainDataObject(
      entry.result_contract,
      ['kind', 'field'],
    );
    if (!resultContract || resultContract.kind !== 'BOOLEAN_SINGLE_ROW' ||
        typeof resultContract.field !== 'string' ||
        !LOWER_SNAKE_CASE_PATTERN.test(resultContract.field)) {
      return undefined;
    }

    queries.set(key, Object.freeze({
      name: entry.name,
      text: entry.text,
      values: Object.freeze([...sourceValues]),
      resultContract: Object.freeze({
        kind: resultContract.kind,
        field: resultContract.field,
      }),
    }));
  }

  return Object.freeze({ status: 'ACTIVE', queries });
}

function snapshotCallEnvelope(input) {
  const snapshot = snapshotExactPlainDataObject(input, ['targetMigrationId']);
  if (!snapshot || typeof snapshot.targetMigrationId !== 'string' ||
      !MIGRATION_ID_PATTERN.test(snapshot.targetMigrationId)) {
    return undefined;
  }
  return snapshot.targetMigrationId;
}

function createResolvedResult(entry, catalog) {
  const checks = [];
  for (const check of entry.checks) {
    const query = catalog.queries.get(check.queryReference);
    if (!query) return UNAVAILABLE_RESULT;

    checks.push(Object.freeze({
      checkId: check.checkId,
      expected: check.expected,
      query: Object.freeze({
        name: query.name,
        text: query.text,
        values: Object.freeze([...query.values]),
        resultContract: Object.freeze({
          kind: query.resultContract.kind,
          field: query.resultContract.field,
        }),
      }),
    }));
  }

  return Object.freeze({
    status: 'RESOLVED',
    checks: Object.freeze(checks),
  });
}

function createMigrationPreconditionAuthorityResolver(config) {
  const dependencies = normalizeDependencies(config);

  async function resolvePreconditionAuthority(input) {
    const targetMigrationId = snapshotCallEnvelope(input);
    if (!targetMigrationId) return UNAVAILABLE_RESULT;

    try {
      const context = { realRepositoryRoot: undefined };
      const registrySource = await loadFixedJsonAuthority(
        REGISTRY_RELATIVE_PATH,
        dependencies,
        context,
      );
      const registry = validateRegistryAuthority(registrySource);
      if (!registry) return UNAVAILABLE_RESULT;
      if (registry.status === 'ADOPTION_REQUIRED') return ADOPTION_REQUIRED_RESULT;

      const targetEntry = registry.entries.find(
        (entry) => entry.migrationId === targetMigrationId,
      );
      if (!targetEntry || targetEntry.checks.length === 0) return NOT_FOUND_RESULT;

      const catalogSource = await loadFixedJsonAuthority(
        CATALOG_RELATIVE_PATH,
        dependencies,
        context,
      );
      const catalog = validateCatalogAuthority(catalogSource);
      if (!catalog || catalog.status !== 'ACTIVE') return UNAVAILABLE_RESULT;

      return createResolvedResult(targetEntry, catalog);
    } catch (error) {
      return UNAVAILABLE_RESULT;
    }
  }

  return Object.freeze({ resolvePreconditionAuthority });
}

module.exports = {
  createMigrationPreconditionAuthorityResolver,
};
