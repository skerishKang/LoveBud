'use strict';

/**
 * Fixed migration precondition composition root (#3809 / Step 6).
 *
 * Wires the already-merged authorities into one frozen orchestrator-facing
 * dependency surface without changing any of them:
 *
 *   createMigrationPreconditionAuthorityResolver   (fixed repository authority)
 *   createPostgresMigrationSessionLockAdapter      (injected openSession boundary)
 *   createMigrationPreconditionEvaluatorAdapter    (resolver + same lock broker)
 *
 * The returned surface exposes exactly:
 *
 *   { acquireAdvisoryLock, evaluatePrecondition, checkAdvisoryLock, releaseAdvisoryLock }
 *
 * `evaluatePrecondition` receives `queryLockedSession` from the SAME lock-adapter
 * instance that supplies acquire/check/release. No queryLockedSession, raw
 * resolver, session, lock handle, SQL, provider state, authority file content,
 * or internal configuration is exposed. No retry, timeout, sleep, network,
 * driver, environment fallback, or caller-selected authority path is added.
 *
 * Bounded test seam (construction-time only, documented by the child): an
 * optional `authorityResolverFactory` returns a plain `{ resolvePreconditionAuthority }`
 * surface so synthetic ACTIVE authority evidence can exercise the composed
 * pinned-session broker. The runtime surface never selects authority paths or
 * SQL. Refs #3809. Refs #3657. Refs #3458. Refs #3425. Refs #3435. Refs #3437.
 * Refs #1882.
 */

const { types: utilTypes } = require('node:util');

const { createMigrationPreconditionAuthorityResolver } = require('./migration-precondition-authority-loader-resolver-core.cjs');
const { createPostgresMigrationSessionLockAdapter } = require('./migration-postgres-session-lock-adapter-core.cjs');
const { createMigrationPreconditionEvaluatorAdapter } = require('./migration-precondition-evaluator-adapter-core.cjs');

const FACTORY_ERROR = 'MIGRATION_PRECONDITION_COMPOSITION_ROOT_CONFIG_INVALID';
const ALLOWED_CONFIG_KEYS = Object.freeze(['openSession', 'authorityResolverFactory']);

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

// Exact own enumerable data key set on a plain prototype.
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

// Own enumerable data keys drawn from an allowed set (subset allowed).
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

function factoryError() {
  throw new Error(FACTORY_ERROR);
}

function createMigrationPreconditionCompositionRoot(config) {
  const configSnapshot = snapshotPlainDataObjectWithAllowedKeys(config, ALLOWED_CONFIG_KEYS);
  if (!configSnapshot) factoryError();
  if (!Object.prototype.hasOwnProperty.call(configSnapshot, 'openSession')) factoryError();
  if (
    typeof configSnapshot.openSession !== 'function'
    || isProxy(configSnapshot.openSession)
  ) {
    factoryError();
  }
  const openSession = configSnapshot.openSession;

  // One resolver from the fixed repository authority, or from the documented
  // bounded construction-time test seam. Never a runtime path/SQL selector.
  let resolvePreconditionAuthority;
  if (Object.prototype.hasOwnProperty.call(configSnapshot, 'authorityResolverFactory')) {
    const authorityResolverFactory = configSnapshot.authorityResolverFactory;
    if (typeof authorityResolverFactory !== 'function' || isProxy(authorityResolverFactory)) {
      factoryError();
    }
    let produced;
    try {
      produced = Reflect.apply(authorityResolverFactory, undefined, []);
    } catch (error) {
      factoryError();
    }
    if (isObjectLike(produced) && utilTypes.isPromise(produced)) factoryError();
    if (isObjectLike(produced) && isProxy(produced)) factoryError();
    const resolverSurface = snapshotExactPlainDataObject(produced, ['resolvePreconditionAuthority']);
    if (!resolverSurface) factoryError();
    if (
      typeof resolverSurface.resolvePreconditionAuthority !== 'function'
      || isProxy(resolverSurface.resolvePreconditionAuthority)
    ) {
      factoryError();
    }
    resolvePreconditionAuthority = resolverSurface.resolvePreconditionAuthority;
  } else {
    const resolverSurface = snapshotExactPlainDataObject(
      createMigrationPreconditionAuthorityResolver(),
      ['resolvePreconditionAuthority'],
    );
    if (!resolverSurface || typeof resolverSurface.resolvePreconditionAuthority !== 'function') {
      factoryError();
    }
    resolvePreconditionAuthority = resolverSurface.resolvePreconditionAuthority;
  }

  // Exactly one pinned-session lock adapter owns acquire/check/release and the
  // evaluator broker. There is no path that creates a second instance.
  const lockAdapter = createPostgresMigrationSessionLockAdapter({ openSession: openSession });
  const evaluator = createMigrationPreconditionEvaluatorAdapter({
    resolvePreconditionAuthority: resolvePreconditionAuthority,
    queryLockedSession: lockAdapter.queryLockedSession,
  });

  return Object.freeze({
    acquireAdvisoryLock: lockAdapter.acquireAdvisoryLock,
    evaluatePrecondition: evaluator.evaluatePrecondition,
    checkAdvisoryLock: lockAdapter.checkAdvisoryLock,
    releaseAdvisoryLock: lockAdapter.releaseAdvisoryLock,
  });
}

const frozenFactory = Object.freeze(createMigrationPreconditionCompositionRoot);

module.exports = {
  createMigrationPreconditionCompositionRoot: frozenFactory,
};
