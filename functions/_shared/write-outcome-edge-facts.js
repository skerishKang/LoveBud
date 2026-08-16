// Issue #4080 — Write-boundary edge-facts adapter (parent #3461).
//
// Pure adapter that maps a Cloudflare proxy-boundary write observation into
// the bounded facts record consumed by the write-outcome classifier core
// (js/observability/reliability-write-outcome-classifier-core.js).
//
// This module is a PURE SOURCE AUTHORITY. It:
//   - carries NO capability (no network, provider, database, SQL, filesystem
//     write, process, timer, retry, alert, or deployment);
//   - never fetches, never executes a write, never retries, never reconciles,
//     and never mutates the user write path or any response status/body;
//   - is NOT wired into any live route in this child; it is a classification
//     helper only;
//   - is provider-neutral and fail-closed: it accepts only bounded numeric
//     status / boolean transport observations and never reads or emits a
//     header value, body, URL, identifier, credential, payload, SQL, raw
//     error, or provider/connection identity;
//   - classifies every undecidable timeout / unavailable commit state as
//     WRITE_STATUS_UNKNOWN with retry_safe=false so an unknown write is never
//     blindly retried.
//
// Refs #4080.
// Refs #3461 — Keep OPEN.
// Refs #3457.
// Refs #3835.
// Refs #4058.
// Refs #1882 — Keep OPEN.

export const EDGE_FACTS_CONTRACT_VERSION = '1';

export const EDGE_ERROR_CODES = Object.freeze({
  OBSERVATION_NOT_OBJECT: 'OBSERVATION_NOT_OBJECT',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
  PRIVATE_FIELD_REJECTED: 'PRIVATE_FIELD_REJECTED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_OBSERVATION_VALUE: 'INVALID_OBSERVATION_VALUE'
});

const ALLOWED_OBSERVATION_FIELDS = Object.freeze([
  'dispatched',
  'timedOut',
  'networkError',
  'upstreamStatus'
]);

const ALLOWED_OBSERVATION_FIELD_SET = Object.freeze(
  ALLOWED_OBSERVATION_FIELDS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {})
);

// Privacy-sensitive keys rejected on the observation. The edge adapter never
// reads a header value, body, URL, identifier, credential, or provider id.
const PRIVATE_OBSERVATION_KEYS = Object.freeze([
  'token',
  'cookie',
  'authorization',
  'email',
  'user_id',
  'uid',
  'owner_id',
  'tree_id',
  'memory_id',
  'title',
  'content',
  'memo',
  'url',
  'payload',
  'request_body',
  'response_body',
  'sql',
  'raw_error',
  'exception',
  'stack',
  'database_url',
  'request_id',
  'provider',
  'provider_id',
  'connection',
  'account_id',
  'project_id',
  'secret',
  'headers',
  'body'
]);

const PRIVATE_OBSERVATION_KEY_SET = Object.freeze(
  PRIVATE_OBSERVATION_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {})
);

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateObservation(observation) {
  const errors = [];

  if (!isPlainRecord(observation)) {
    return { ok: false, errors: [EDGE_ERROR_CODES.OBSERVATION_NOT_OBJECT] };
  }

  for (const key of Object.keys(observation)) {
    if (hasOwn(PRIVATE_OBSERVATION_KEY_SET, key)) {
      errors.push(EDGE_ERROR_CODES.PRIVATE_FIELD_REJECTED);
    } else if (!hasOwn(ALLOWED_OBSERVATION_FIELD_SET, key)) {
      errors.push(EDGE_ERROR_CODES.UNKNOWN_FIELD);
    }
  }

  const boolFields = ['dispatched', 'timedOut', 'networkError'];
  for (const field of boolFields) {
    if (!hasOwn(observation, field) || observation[field] === undefined || observation[field] === null) {
      errors.push(EDGE_ERROR_CODES.MISSING_REQUIRED_FIELD);
    } else if (typeof observation[field] !== 'boolean') {
      errors.push(EDGE_ERROR_CODES.INVALID_OBSERVATION_VALUE);
    }
  }

  if (hasOwn(observation, 'upstreamStatus')) {
    const status = observation.upstreamStatus;
    if (status !== null && status !== undefined) {
      if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
        errors.push(EDGE_ERROR_CODES.INVALID_OBSERVATION_VALUE);
      }
    }
  }

  const unique = [...new Set(errors)].sort();
  return { ok: unique.length === 0, errors: unique };
}

function upstreamStatusClass(status) {
  if (status === null || status === undefined) return 'unknown';
  if (status >= 200 && status < 300) return 'success_2xx';
  if (status >= 400 && status < 500) return 'client_error_4xx';
  if (status >= 500 && status < 600) return 'server_error_5xx';
  return 'unknown';
}

/**
 * Map a bounded edge write observation into the facts record consumed by the
 * write-outcome classifier core. Pure and total over validated observations.
 *
 * At the Cloudflare proxy boundary the DB commit state is never directly
 * observable. An upstream 2xx only proves the upstream accepted the request
 * (REQUEST_ACCEPTED); the commit/RETURNING/reread facts remain unknown at the
 * edge and are classified by the Modal-side authority. An upstream 4xx proves
 * the write was rejected before any DB side effect. A timeout, network error,
 * or upstream 5xx leaves the commit state undecidable.
 *
 * Throws TypeError with a single fixed EDGE_ERROR_CODE on invalid input.
 */
export function buildEdgeWriteFacts(observation) {
  const validation = validateObservation(observation);
  if (!validation.ok) {
    throw new TypeError(validation.errors[0]);
  }

  const dispatched = observation.dispatched === true;
  const timedOut = observation.timedOut === true;
  const networkError = observation.networkError === true;
  const status = hasOwn(observation, 'upstreamStatus') ? observation.upstreamStatus : null;
  const statusClass = upstreamStatusClass(status);

  if (!dispatched) {
    return Object.freeze({
      transport: 'not_dispatched',
      commit: 'not_reached',
      returning: 'not_reached',
      reread: 'not_attempted',
      validation_rejected: false,
      upstream_status_class: statusClass,
      client_visible: false
    });
  }

  if (timedOut) {
    return Object.freeze({
      transport: 'timeout',
      commit: 'unknown',
      returning: 'unknown',
      reread: 'unknown',
      validation_rejected: false,
      upstream_status_class: 'unknown',
      client_visible: false
    });
  }

  if (networkError) {
    return Object.freeze({
      transport: 'network_error',
      commit: 'unknown',
      returning: 'unknown',
      reread: 'unknown',
      validation_rejected: false,
      upstream_status_class: 'unknown',
      client_visible: false
    });
  }

  if (statusClass === 'client_error_4xx') {
    return Object.freeze({
      transport: 'ok',
      commit: 'not_reached',
      returning: 'not_reached',
      reread: 'not_attempted',
      validation_rejected: true,
      upstream_status_class: statusClass,
      client_visible: false
    });
  }

  // Upstream 2xx / 5xx / unknown: transport reached the upstream, but the DB
  // commit state is not observable at the edge.
  return Object.freeze({
    transport: 'ok',
    commit: 'unknown',
    returning: 'unknown',
    reread: 'unknown',
    validation_rejected: false,
    upstream_status_class: statusClass,
    client_visible: false
  });
}
