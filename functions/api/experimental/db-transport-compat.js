// Bounded experimental route for #4093 DB transport compatibility proving.
//
// This is not a Product route and is disabled by default. It can execute only
// against owner-approved TEST_ISOLATION_ONLY resources after the dedicated gate,
// environment classification, benchmark token, and transport-specific binding or
// secret are all present. There is no fallback to Product DATABASE_URL or writer
// credentials.

import {
  DB_TRANSPORT,
  DB_TRANSPORT_ENV,
  DB_TRANSPORT_ERROR,
  DB_TRANSPORT_REQUIRED_ENVIRONMENT,
  DbTransportCompatError,
  createDbTransportCompatTransport,
  getDbTransportCapabilities,
  isKnownDbTransport,
  isKnownDbTransportScenario,
  readDbTransportCompatConfig,
  runDbTransportCompatScenario,
  sanitizeDbTransportCompatError,
  timingSafeEqualText,
} from '../../_shared/db/db-transport-compat-core.js';
import {
  readBoundedRequestBody,
} from '../../_shared/bounded-request-body.js';

export const DB_TRANSPORT_COMPAT_SEAM_PATH = '/api/experimental/db-transport-compat';
export const DB_TRANSPORT_COMPAT_MAX_BODY_BYTES = 16 * 1024;
export const DB_TRANSPORT_COMPAT_TOKEN_HEADER = 'x-lovebud-benchmark-token';

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-lovebud-experimental': 'db-transport-compat-4093',
      ...extraHeaders,
    },
  });
}

function errorResponse(status, code, routeStatus) {
  return jsonResponse(status, {
    error: 'db transport compatibility probe unavailable',
    code,
  }, {
    'x-lovebud-route-status': routeStatus,
  });
}

function getEnvString(env, name) {
  return env && typeof env[name] === 'string' ? env[name] : '';
}

async function readProbeRequest(request) {
  const bounded = await readBoundedRequestBody(request, DB_TRANSPORT_COMPAT_MAX_BODY_BYTES);
  if (bounded.status === 'tooLarge') {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'request body too large', { status: 413 });
  }
  if (bounded.status !== 'ok') {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'request body read failed', { status: 400 });
  }
  if (!bounded.body || bounded.body.byteLength === 0) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'request body required', { status: 400 });
  }

  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bounded.body));
  } catch {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'invalid json', { status: 400 });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.REQUEST_INVALID, 'request object required', { status: 400 });
  }

  const transport = typeof parsed.transport === 'string' ? parsed.transport : '';
  const scenario = typeof parsed.scenario === 'string' ? parsed.scenario : '';
  if (!isKnownDbTransport(transport)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.TRANSPORT_UNSUPPORTED, 'transport unsupported', { status: 422 });
  }
  if (!isKnownDbTransportScenario(scenario)) {
    throw new DbTransportCompatError(DB_TRANSPORT_ERROR.SCENARIO_UNSUPPORTED, 'scenario unsupported', { status: 422 });
  }
  return Object.freeze({ transport, scenario });
}

function isAuthorizedBenchmarkRequest(request, env) {
  const expected = getEnvString(env, DB_TRANSPORT_ENV.BENCH_TOKEN);
  const supplied = request && request.headers
    ? (request.headers.get(DB_TRANSPORT_COMPAT_TOKEN_HEADER) || '')
    : '';
  return expected.length > 0 && timingSafeEqualText(supplied, expected);
}

export async function buildDbTransportCompatResponse({
  request,
  env = {},
  adapterOverride = null,
  pgImporter,
  neonImporter,
} = {}) {
  // Hide the entire seam unless explicitly opted in. No request-body read,
  // transport import, connection construction, or DB query occurs before this.
  if (getEnvString(env, DB_TRANSPORT_ENV.ENABLED_FLAG) !== 'true') {
    return errorResponse(404, DB_TRANSPORT_ERROR.EXPERIMENT_DISABLED, 'disabled');
  }

  if (!request || String(request.method || 'GET').toUpperCase() !== 'POST') {
    return jsonResponse(405, {
      error: 'Method not allowed',
      code: DB_TRANSPORT_ERROR.REQUEST_INVALID,
    }, {
      allow: 'POST',
      'x-lovebud-route-status': 'method-not-allowed',
    });
  }

  if (getEnvString(env, DB_TRANSPORT_ENV.ENVIRONMENT) !== DB_TRANSPORT_REQUIRED_ENVIRONMENT) {
    return errorResponse(503, DB_TRANSPORT_ERROR.NONPROD_ENV_REQUIRED, 'nonprod-required');
  }

  if (!getEnvString(env, DB_TRANSPORT_ENV.BENCH_TOKEN)) {
    return errorResponse(503, DB_TRANSPORT_ERROR.CONFIG_MISSING, 'bench-auth-unconfigured');
  }

  if (!isAuthorizedBenchmarkRequest(request, env)) {
    return errorResponse(403, DB_TRANSPORT_ERROR.BENCH_AUTH_REQUIRED, 'bench-auth-failed');
  }

  try {
    const { transport, scenario } = await readProbeRequest(request);
    const config = readDbTransportCompatConfig(env, transport);
    if (!config.ready) {
      throw new DbTransportCompatError(DB_TRANSPORT_ERROR.CONFIG_MISSING, 'dedicated nonprod transport config missing', { status: 503 });
    }

    const adapter = adapterOverride || await createDbTransportCompatTransport({
      transport,
      connectionString: config.connectionString,
      pgImporter,
      neonImporter,
    });

    const result = await runDbTransportCompatScenario({
      transport,
      scenario,
      adapter,
      startedAt: Date.now(),
    });

    return jsonResponse(200, {
      ...result,
      capabilities: getDbTransportCapabilities(transport),
    }, {
      'x-lovebud-route-status': result.outcome,
      'x-lovebud-experimental-source': transport,
    });
  } catch (error) {
    const sanitized = sanitizeDbTransportCompatError(error);
    return jsonResponse(sanitized.status, sanitized.body, {
      'x-lovebud-route-status': 'probe-failed',
    });
  }
}

export async function onRequest(context) {
  return buildDbTransportCompatResponse({
    request: context && context.request,
    env: context && context.env || {},
  });
}

// Keep transport identifiers exported from the route for narrow smoke tooling
// without requiring callers to infer capabilities from URL names.
export { DB_TRANSPORT };
