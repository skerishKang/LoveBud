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
 * ever exposed. Refs #3802. Refs #3657. Refs #3458. Refs #3425. Refs #3435.
 * Refs #3437. Refs #1882.
 */

const { types: utilTypes } = require('node:util');

const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FACTORY_ERROR = 'MIGRATION_PRECONDITION_EVALUATOR_CONFIG_INVALID';

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

function safeObjectKeys(value) {
  try {
    return Object.keys(value);
  } catch (error) {
    return undefined;
  }
}

function safeArrayIsArray(value) {
  try {
    return Array.isArray(value);
  } catch (error) {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

// Reads an own property WITHOUT invoking a getter or trap: returns the
// descriptor, or undefined for accessor/inherited/missing properties.
function safeOwnDataDescriptor(obj, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (!descriptor) return undefined;
    if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
      return undefined;
    }
    if (!('value' in descriptor)) return undefined;
    return descriptor;
  } catch (error) {
    return undefined;
  }
}

// Exact two-key call envelope: enumerable own data keys only, no Proxy,
// accessor, inherited, symbol, or extra key. Getter traps are never invoked.
function snapshotCallEnvelope(input) {
  if (!isObjectLike(input) || isProxy(input)) return undefined;
  const keys = safeObjectKeys(input);
  if (!keys || keys.length !== 2) return undefined;
  if (!keys.includes('targetMigrationId') || !keys.includes('lockHandle')) return undefined;
  const targetMigrationIdDescriptor = safeOwnDataDescriptor(input, 'targetMigrationId');
  const lockHandleDescriptor = safeOwnDataDescriptor(input, 'lockHandle');
  if (!targetMigrationIdDescriptor || !lockHandleDescriptor) return undefined;
  return {
    targetMigrationId: targetMigrationIdDescriptor.value,
    lockHandle: lockHandleDescriptor.value,
  };
}

// Dense primitive-only array snapshot (fully detached + frozen).
function snapshotValues(source) {
  if (!safeArrayIsArray(source) || isProxy(source)) return undefined;
  const output = [];
  for (let index = 0; index < source.length; index++) {
    if (!(index in source)) return undefined; // sparse
    const value = source[index];
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return undefined; // only primitives are detached safely
    }
    output.push(value);
  }
  return Object.freeze(output);
}

function snapshotResultContract(source) {
  if (!isObjectLike(source) || isProxy(source)) return undefined;
  const keys = safeObjectKeys(source);
  if (!keys || keys.length !== 2) return undefined;
  if (!keys.includes('kind') || !keys.includes('field')) return undefined;
  const kindDescriptor = safeOwnDataDescriptor(source, 'kind');
  const fieldDescriptor = safeOwnDataDescriptor(source, 'field');
  if (!kindDescriptor || !fieldDescriptor) return undefined;
  if (kindDescriptor.value !== 'BOOLEAN_SINGLE_ROW') return undefined; // unknown kind fails closed
  if (!isNonEmptyString(fieldDescriptor.value)) return undefined;
  return Object.freeze({ kind: kindDescriptor.value, field: fieldDescriptor.value });
}

function snapshotQuery(source) {
  if (!isObjectLike(source) || isProxy(source)) return undefined;
  const keys = safeObjectKeys(source);
  if (!keys || keys.length !== 4) return undefined;
  if (!keys.includes('name') || !keys.includes('text') || !keys.includes('values') || !keys.includes('resultContract')) {
    return undefined;
  }
  const nameDescriptor = safeOwnDataDescriptor(source, 'name');
  const textDescriptor = safeOwnDataDescriptor(source, 'text');
  const valuesDescriptor = safeOwnDataDescriptor(source, 'values');
  const resultContractDescriptor = safeOwnDataDescriptor(source, 'resultContract');
  if (!nameDescriptor || !textDescriptor || !valuesDescriptor || !resultContractDescriptor) return undefined;
  if (!isNonEmptyString(nameDescriptor.value) || !isNonEmptyString(textDescriptor.value)) return undefined;
  const values = snapshotValues(valuesDescriptor.value);
  if (values === undefined) return undefined;
  const resultContract = snapshotResultContract(resultContractDescriptor.value);
  if (resultContract === undefined) return undefined;
  return Object.freeze({
    name: nameDescriptor.value,
    text: textDescriptor.value,
    values: values,
    resultContract: resultContract,
  });
}

function snapshotCheck(source) {
  if (!isObjectLike(source) || isProxy(source)) return undefined;
  const keys = safeObjectKeys(source);
  if (!keys || keys.length !== 3) return undefined;
  if (!keys.includes('checkId') || !keys.includes('expected') || !keys.includes('query')) return undefined;
  const checkIdDescriptor = safeOwnDataDescriptor(source, 'checkId');
  const expectedDescriptor = safeOwnDataDescriptor(source, 'expected');
  const queryDescriptor = safeOwnDataDescriptor(source, 'query');
  if (!checkIdDescriptor || !expectedDescriptor || !queryDescriptor) return undefined;
  if (!isNonEmptyString(checkIdDescriptor.value) || !KEBAB_CASE_PATTERN.test(checkIdDescriptor.value)) return undefined;
  if (typeof expectedDescriptor.value !== 'boolean') return undefined;
  const query = snapshotQuery(queryDescriptor.value);
  if (query === undefined) return undefined;
  return Object.freeze({
    checkId: checkIdDescriptor.value,
    expected: expectedDescriptor.value,
    query: query,
  });
}

// Validates the ENTIRE resolved envelope before the first broker call so a
// malformed later check can never cause partial execution.
function snapshotResolvedChecks(resolverResult) {
  if (!isObjectLike(resolverResult) || isProxy(resolverResult)) return undefined;
  const checksDescriptor = safeOwnDataDescriptor(resolverResult, 'checks');
  if (!checksDescriptor) return undefined;
  const checksSource = checksDescriptor.value;
  if (!safeArrayIsArray(checksSource) || isProxy(checksSource)) return undefined;
  const checks = [];
  for (let index = 0; index < checksSource.length; index++) {
    if (!(index in checksSource)) return undefined; // sparse
    const check = snapshotCheck(checksSource[index]);
    if (check === undefined) return undefined;
    checks.push(check);
  }
  return checks;
}

// BOOLEAN_SINGLE_ROW interpretation. Returns true/false for a valid boolean
// row, or undefined for every malformed shape. Top-level result metadata is
// ignored; raw rows or metadata are never returned.
function interpretBooleanSingleRow(brokerResult, field) {
  if (!isObjectLike(brokerResult) || isProxy(brokerResult)) return undefined;
  const rowsDescriptor = safeOwnDataDescriptor(brokerResult, 'rows');
  if (!rowsDescriptor) return undefined;
  const rows = rowsDescriptor.value;
  if (!safeArrayIsArray(rows) || isProxy(rows)) return undefined;
  if (rows.length !== 1) return undefined;
  if (!(0 in rows)) return undefined; // sparse
  const row = rows[0];
  if (!isObjectLike(row) || isProxy(row)) return undefined;
  const prototype = Object.getPrototypeOf(row);
  if (prototype !== Object.prototype) return undefined; // custom/null prototype
  const ownNames = Object.getOwnPropertyNames(row);
  if (ownNames.length !== 1 || ownNames[0] !== field) return undefined; // extra or missing field
  if (Object.getOwnPropertySymbols(row).length !== 0) return undefined; // symbol key
  const fieldDescriptor = safeOwnDataDescriptor(row, field);
  if (!fieldDescriptor) return undefined; // accessor / missing own data
  if (typeof fieldDescriptor.value !== 'boolean') return undefined;
  return fieldDescriptor.value;
}

// Await a dependency call without thenable assimilation and without exposing a
// raw error. Only native Promises may be awaited; hostile returns fail closed.
async function awaitDependencyCall(call, argument) {
  let raw;
  try {
    raw = call(argument);
  } catch (error) {
    return 'HOSTILE';
  }
  if (isObjectLike(raw) && isProxy(raw)) return 'HOSTILE';
  if (isObjectLike(raw) && typeof raw.then === 'function') {
    if (!(raw instanceof Promise)) return 'HOSTILE'; // non-native thenable
  }
  try {
    return await raw;
  } catch (error) {
    return 'HOSTILE';
  }
}

function createMigrationPreconditionEvaluatorAdapter(config) {
  if (!isObjectLike(config) || isProxy(config)) throw new Error(FACTORY_ERROR);
  const configKeys = safeObjectKeys(config);
  if (!configKeys || configKeys.length !== 2) throw new Error(FACTORY_ERROR);
  if (!configKeys.includes('resolvePreconditionAuthority') || !configKeys.includes('queryLockedSession')) {
    throw new Error(FACTORY_ERROR);
  }
  const resolverDescriptor = safeOwnDataDescriptor(config, 'resolvePreconditionAuthority');
  const brokerDescriptor = safeOwnDataDescriptor(config, 'queryLockedSession');
  if (!resolverDescriptor || !brokerDescriptor) throw new Error(FACTORY_ERROR);
  if (typeof resolverDescriptor.value !== 'function' || typeof brokerDescriptor.value !== 'function') {
    throw new Error(FACTORY_ERROR);
  }
  const resolvePreconditionAuthority = resolverDescriptor.value;
  const queryLockedSession = brokerDescriptor.value;

  async function evaluatePrecondition(input) {
    const envelope = snapshotCallEnvelope(input);
    if (envelope === undefined) return UNAVAILABLE_RESULT;
    if (typeof envelope.targetMigrationId !== 'string' || !MIGRATION_ID_PATTERN.test(envelope.targetMigrationId)) {
      return UNAVAILABLE_RESULT;
    }

    const resolverResult = await awaitDependencyCall(resolvePreconditionAuthority, {
      targetMigrationId: envelope.targetMigrationId,
    });
    if (resolverResult === 'HOSTILE') return UNAVAILABLE_RESULT;
    if (!isObjectLike(resolverResult) || isProxy(resolverResult)) return UNAVAILABLE_RESULT;

    const statusDescriptor = safeOwnDataDescriptor(resolverResult, 'status');
    if (!statusDescriptor) return UNAVAILABLE_RESULT;
    const status = statusDescriptor.value;
    if (status === 'ADOPTION_REQUIRED') return NOT_EVALUATED_RESULT;
    if (status === 'NOT_FOUND') return NOT_EVALUATED_RESULT;
    if (status === 'UNAVAILABLE') return UNAVAILABLE_RESULT;
    if (status !== 'RESOLVED') return UNAVAILABLE_RESULT;

    const checks = snapshotResolvedChecks(resolverResult);
    if (checks === undefined) return UNAVAILABLE_RESULT;
    if (checks.length === 0) return NOT_EVALUATED_RESULT;

    let hasFail = false;
    for (const check of checks) {
      const query = Object.freeze({
        name: check.query.name,
        text: check.query.text,
        values: check.query.values,
      });
      const brokerResult = await awaitDependencyCall(queryLockedSession, {
        lockHandle: envelope.lockHandle,
        query: query,
      });
      if (brokerResult === 'HOSTILE') return UNAVAILABLE_RESULT;
      const actual = interpretBooleanSingleRow(brokerResult, check.query.resultContract.field);
      if (actual === undefined) return UNAVAILABLE_RESULT; // stops later checks
      if (actual !== check.expected) hasFail = true;
    }

    return hasFail ? FAIL_RESULT : PASS_RESULT;
  }

  return Object.freeze({ evaluatePrecondition: evaluatePrecondition });
}

const frozenFactory = Object.freeze(createMigrationPreconditionEvaluatorAdapter);

module.exports = {
  createMigrationPreconditionEvaluatorAdapter: frozenFactory,
};
