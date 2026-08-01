'use strict';

/**
 * Fixed migration precondition evaluator adapter (#3802 / Step 5).
 *
 * Dependency-injected fail-closed adapter that converts the already-resolved
 * fixed source authority (registry/catalog loader-resolver) into the canonical
 * runtime migration-gate precondition status.
 *
 * It does not own the registry, catalog, SQL text, migration manifest, lock
 * lifecycle, database connection, or orchestration sequence. It only consumes
 * `resolvePreconditionAuthority({ targetMigrationId })` and the pinned-session
 * broker `queryLockedSession({ lockHandle, query: { name, text, values } })`.
 *
 * Every public result is a frozen plain record with exactly one enumerable own
 * key: `status` (`PASS` | `FAIL` | `UNAVAILABLE` | `NOT_EVALUATED`). No raw
 * evidence, raw error, SQL row, lock handle, migration ID, or console output is
 * ever exposed. Hardening follows the fixed authority loader-resolver core:
 * descriptor-safe plain-record snapshots, native-Promise-only awaiting with no
 * direct `then` reads, and dense-array snapshots. Refs #3802. Refs #3657.
 * Refs #3458. Refs #3425. Refs #3435. Refs #3437. Refs #1882.
 */

const { types: utilTypes } = require('node:util');

const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FACTORY_ERROR = 'MIGRATION_PRECONDITION_EVALUATOR_CONFIG_INVALID';
const BOOLEAN_SINGLE_ROW = 'BOOLEAN_SINGLE_ROW';

// Collision-proof internal failure sentinel (never exposed publicly).
const INTERNAL_FAILURE = Object.freeze({
  [Symbol('migration.precondition.evaluator.internal.failure')]: true,
});

function makeResult(status) {
  return Object.freeze({ status: status });
}

const PASS_RESULT = makeResult('PASS');
const FAIL_RESULT = makeResult('FAIL');
const UNAVAILABLE_RESULT = makeResult('UNAVAILABLE');
const NOT_EVALUATED_RESULT = makeResult('NOT_EVALUATED');

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

function safeIsArray(value) {
  if (!isObjectLike(value)) return false;
  try {
    return Array.isArray(value);
  } catch (error) {
    return false;
  }
}

function hasPlainPrototype(value) {
  if (!isObjectLike(value) || safeIsArray(value) || isProxy(value)) return false;
  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    return false;
  }
  return prototype === Object.prototype || prototype === null;
}

// Reflect.ownKeys + Object.getOwnPropertyDescriptor, Proxy-free, getter-free.
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
    descriptors.push({ key: key, descriptor: descriptor });
  }
  return descriptors;
}

// Exact own enumerable data key set on a plain prototype; rejects arrays,
// functions, proxies, symbol keys, accessors, extra/non-enumerable keys.
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

// Descriptor-safe dense array: prototype === Array.prototype, canonical
// non-enumerable length, exactly length + 0..length-1 own keys, enumerable
// data index properties, no sparse/accessor/symbol/extra keys.
function snapshotDenseArray(value) {
  if (!safeIsArray(value) || isProxy(value)) return undefined;
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
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors.find(({ key }) => key === String(index));
    if (!descriptor || typeof descriptor.key !== 'string') return undefined;
    if (!('value' in descriptor.descriptor) || descriptor.descriptor.enumerable !== true) {
      return undefined;
    }
    values.push(descriptor.descriptor.value);
  }
  return values;
}

// Fixed JSON scalars only: null, string, boolean, finite number.
function isFixedJsonScalar(value) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function snapshotQueryValues(value) {
  const values = snapshotDenseArray(value);
  if (values === undefined) return undefined;
  for (const item of values) {
    if (!isFixedJsonScalar(item)) return undefined;
  }
  return Object.freeze(values);
}

function snapshotResultContract(value) {
  const snapshot = snapshotExactPlainDataObject(value, ['kind', 'field']);
  if (!snapshot) return undefined;
  if (snapshot.kind !== BOOLEAN_SINGLE_ROW) return undefined;
  if (!isNonEmptyString(snapshot.field)) return undefined;
  return Object.freeze({ kind: snapshot.kind, field: snapshot.field });
}

function snapshotQuery(value) {
  const snapshot = snapshotExactPlainDataObject(value, ['name', 'text', 'values', 'resultContract']);
  if (!snapshot) return undefined;
  if (!isNonEmptyString(snapshot.name) || !isNonEmptyString(snapshot.text)) return undefined;
  const values = snapshotQueryValues(snapshot.values);
  if (values === undefined) return undefined;
  const resultContract = snapshotResultContract(snapshot.resultContract);
  if (resultContract === undefined) return undefined;
  return Object.freeze({
    name: snapshot.name,
    text: snapshot.text,
    values: values,
    resultContract: resultContract,
  });
}

function snapshotCheck(value) {
  const snapshot = snapshotExactPlainDataObject(value, ['checkId', 'expected', 'query']);
  if (!snapshot) return undefined;
  if (!isNonEmptyString(snapshot.checkId) || !KEBAB_CASE_PATTERN.test(snapshot.checkId)) {
    return undefined;
  }
  if (typeof snapshot.expected !== 'boolean') return undefined;
  const query = snapshotQuery(snapshot.query);
  if (query === undefined) return undefined;
  return Object.freeze({
    checkId: snapshot.checkId,
    expected: snapshot.expected,
    query: query,
  });
}

// Validates the ENTIRE resolved envelope before the first broker call.
function snapshotResolvedChecks(value) {
  const checksSource = snapshotDenseArray(value);
  if (checksSource === undefined) return undefined;
  const checks = [];
  for (const checkSource of checksSource) {
    const check = snapshotCheck(checkSource);
    if (check === undefined) return undefined;
    checks.push(check);
  }
  return checks;
}

// Broker result: plain non-Proxy record with an own data `rows` property.
// Top-level metadata may be present and is ignored; `rows` accessor/Proxy/symbol
// are rejected. Returns the dense rows snapshot or undefined.
function snapshotBrokerResultRows(value) {
  if (!hasPlainPrototype(value)) return undefined;
  const descriptors = safeOwnDescriptors(value);
  if (!descriptors) return undefined;
  const rowsDescriptor = descriptors.find(({ key }) => key === 'rows');
  if (!rowsDescriptor) return undefined;
  if (!('value' in rowsDescriptor.descriptor) || rowsDescriptor.descriptor.enumerable !== true) {
    return undefined;
  }
  return snapshotDenseArray(rowsDescriptor.descriptor.value);
}

// BOOLEAN_SINGLE_ROW interpretation. Returns the boolean value or undefined for
// every malformed shape. Raw rows or metadata are never returned or logged.
function interpretBooleanSingleRow(rows, field) {
  if (!rows || rows.length !== 1) return undefined;
  const row = rows[0];
  const rowSnapshot = snapshotExactPlainDataObject(row, [field]);
  if (!rowSnapshot) return undefined;
  const value = rowSnapshot[field];
  if (typeof value !== 'boolean') return undefined;
  return value;
}

// Thenable-safe dependency invocation. Never reads `raw.then`, never
// assimilates an arbitrary thenable, never exposes a raw error, and returns a
// collision-proof internal sentinel on failure.
async function invokeDependency(call, argument) {
  let raw;
  try {
    raw = Reflect.apply(call, undefined, [argument]);
  } catch (error) {
    return INTERNAL_FAILURE;
  }

  if (isProxy(raw)) return INTERNAL_FAILURE;

  let value = raw;
  if (isObjectLike(raw) && utilTypes.isPromise(raw)) {
    if (!isNativePromise(raw)) return INTERNAL_FAILURE;
    try {
      value = await raw;
    } catch (error) {
      return INTERNAL_FAILURE;
    }
    if (isProxy(value)) return INTERNAL_FAILURE;
  }

  // Reject any dependency result that carries an own `then` property (non-native
  // thenable or hostile then getter) without reading the property value or
  // invoking a getter.
  if (isObjectLike(value)) {
    if (isProxy(value)) return INTERNAL_FAILURE;
    const descriptors = safeOwnDescriptors(value);
    if (descriptors === undefined) return INTERNAL_FAILURE;
    if (descriptors.some(({ key }) => key === 'then')) return INTERNAL_FAILURE;
  }

  // Wrap so this async function never assimilates a direct arbitrary thenable.
  return Object.freeze({ value: value });
}

function createMigrationPreconditionEvaluatorAdapter(config) {
  const configSnapshot = snapshotExactPlainDataObject(config, [
    'resolvePreconditionAuthority',
    'queryLockedSession',
  ]);
  if (!configSnapshot) throw new Error(FACTORY_ERROR);
  if (
    typeof configSnapshot.resolvePreconditionAuthority !== 'function'
    || isProxy(configSnapshot.resolvePreconditionAuthority)
    || typeof configSnapshot.queryLockedSession !== 'function'
    || isProxy(configSnapshot.queryLockedSession)
  ) {
    throw new Error(FACTORY_ERROR);
  }
  const resolvePreconditionAuthority = configSnapshot.resolvePreconditionAuthority;
  const queryLockedSession = configSnapshot.queryLockedSession;

  async function evaluatePrecondition(input) {
    const envelope = snapshotExactPlainDataObject(input, ['targetMigrationId', 'lockHandle']);
    if (!envelope) return UNAVAILABLE_RESULT;
    if (
      typeof envelope.targetMigrationId !== 'string'
      || !MIGRATION_ID_PATTERN.test(envelope.targetMigrationId)
    ) {
      return UNAVAILABLE_RESULT;
    }

    const resolverOutcome = await invokeDependency(resolvePreconditionAuthority, {
      targetMigrationId: envelope.targetMigrationId,
    });
    if (resolverOutcome === INTERNAL_FAILURE) return UNAVAILABLE_RESULT;
    const resolverValue = resolverOutcome.value;

    // RESOLVED is a two-key record { status, checks }.
    const resolvedEnvelope = snapshotExactPlainDataObject(resolverValue, ['status', 'checks']);
    if (resolvedEnvelope && resolvedEnvelope.status === 'RESOLVED') {
      const checks = snapshotResolvedChecks(resolvedEnvelope.checks);
      if (checks === undefined) return UNAVAILABLE_RESULT;
      if (checks.length === 0) return NOT_EVALUATED_RESULT;

      let hasFail = false;
      for (const check of checks) {
        const query = Object.freeze({
          name: check.query.name,
          text: check.query.text,
          values: check.query.values,
        });
        const brokerOutcome = await invokeDependency(queryLockedSession, {
          lockHandle: envelope.lockHandle,
          query: query,
        });
        if (brokerOutcome === INTERNAL_FAILURE) return UNAVAILABLE_RESULT;

        const rows = snapshotBrokerResultRows(brokerOutcome.value);
        if (rows === undefined) return UNAVAILABLE_RESULT;
        const actual = interpretBooleanSingleRow(rows, check.query.resultContract.field);
        if (actual === undefined) return UNAVAILABLE_RESULT; // stops later checks
        if (actual !== check.expected) hasFail = true;
      }

      return hasFail ? FAIL_RESULT : PASS_RESULT;
    }

    // Non-RESOLVED status records are exactly one key: { status }.
    const statusEnvelope = snapshotExactPlainDataObject(resolverValue, ['status']);
    if (!statusEnvelope) return UNAVAILABLE_RESULT;
    const status = statusEnvelope.status;
    if (status === 'ADOPTION_REQUIRED') return NOT_EVALUATED_RESULT;
    if (status === 'NOT_FOUND') return NOT_EVALUATED_RESULT;
    if (status === 'UNAVAILABLE') return UNAVAILABLE_RESULT;
    return UNAVAILABLE_RESULT;
  }

  return Object.freeze({ evaluatePrecondition: evaluatePrecondition });
}

const frozenFactory = Object.freeze(createMigrationPreconditionEvaluatorAdapter);

module.exports = {
  createMigrationPreconditionEvaluatorAdapter: frozenFactory,
};
