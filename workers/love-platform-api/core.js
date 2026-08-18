import {
  REQUEST_ID_HEADER,
  generateRequestId,
  normalizeRequestId,
  getOrCreateRequestId
} from '../../functions/_shared/request-id.js';
import {
  MAX_REQUEST_BODY_BYTES,
  readBoundedRequestBody
} from '../../functions/_shared/bounded-request-body.js';

export const PLATFORM_ERROR = Object.freeze({
  ROUTE_UNAVAILABLE: 'PLATFORM_ROUTE_UNAVAILABLE',
  REQUEST_BODY_TOO_LARGE: 'REQUEST_BODY_TOO_LARGE',
  REQUEST_BODY_READ_FAILED: 'REQUEST_BODY_READ_FAILED',
  CAPABILITY_UNSUPPORTED: 'CAPABILITY_UNSUPPORTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

const ERROR_CONTRACT = Object.freeze({
  [PLATFORM_ERROR.ROUTE_UNAVAILABLE]: Object.freeze({
    status: 404,
    message: 'Platform route unavailable'
  }),
  [PLATFORM_ERROR.REQUEST_BODY_TOO_LARGE]: Object.freeze({
    status: 413,
    message: 'Payload too large'
  }),
  [PLATFORM_ERROR.REQUEST_BODY_READ_FAILED]: Object.freeze({
    status: 503,
    message: 'Request body read failed'
  }),
  [PLATFORM_ERROR.CAPABILITY_UNSUPPORTED]: Object.freeze({
    status: 503,
    message: 'Required platform capability unavailable'
  }),
  [PLATFORM_ERROR.INTERNAL_ERROR]: Object.freeze({
    status: 500,
    message: 'Internal platform error'
  })
});

export class PlatformApiError extends Error {
  constructor(code) {
    const safeCode = Object.hasOwn(ERROR_CONTRACT, code)
      ? code
      : PLATFORM_ERROR.INTERNAL_ERROR;
    super(ERROR_CONTRACT[safeCode].message);
    this.name = 'PlatformApiError';
    this.code = safeCode;
  }
}

export function createQueryCapability(execute) {
  if (typeof execute !== 'function') {
    throw new TypeError('Query capability requires an execute function');
  }
  return Object.freeze({
    kind: 'query',
    execute
  });
}

export function createTransactionCapability(run) {
  if (typeof run !== 'function') {
    throw new TypeError('Transaction capability requires a run function');
  }
  return Object.freeze({
    kind: 'transaction',
    run
  });
}

export function createCapabilitySet({ query = null, transaction = null } = {}) {
  if (query !== null && query?.kind !== 'query') {
    throw new TypeError('Invalid query capability');
  }
  if (transaction !== null && transaction?.kind !== 'transaction') {
    throw new TypeError('Invalid transaction capability');
  }

  return Object.freeze({
    query,
    transaction
  });
}

export function requireCapability(capabilities, kind) {
  const capability = capabilities?.[kind] ?? null;
  if (!capability || capability.kind !== kind) {
    throw new PlatformApiError(PLATFORM_ERROR.CAPABILITY_UNSUPPORTED);
  }
  return capability;
}

export function createRequestContext(request, {
  principal = null,
  capabilities = createCapabilitySet()
} = {}) {
  if (!(request instanceof Request)) {
    throw new TypeError('RequestContext requires a Request');
  }

  const url = new URL(request.url);
  return Object.freeze({
    requestId: getOrCreateRequestId(request),
    method: request.method,
    path: url.pathname,
    principal,
    capabilities
  });
}

export async function readPlatformRequestBody(
  request,
  maxBytes = MAX_REQUEST_BODY_BYTES
) {
  const result = await readBoundedRequestBody(request, maxBytes);
  if (result.status === 'tooLarge') {
    throw new PlatformApiError(PLATFORM_ERROR.REQUEST_BODY_TOO_LARGE);
  }
  if (result.status === 'readError') {
    throw new PlatformApiError(PLATFORM_ERROR.REQUEST_BODY_READ_FAILED);
  }
  return result.body;
}

function safeRequestId(value) {
  return normalizeRequestId(value) ?? generateRequestId();
}

export function buildPlatformErrorResponse(error, requestId = null) {
  const code = error instanceof PlatformApiError && Object.hasOwn(ERROR_CONTRACT, error.code)
    ? error.code
    : PLATFORM_ERROR.INTERNAL_ERROR;
  const contract = ERROR_CONTRACT[code];
  const safeId = safeRequestId(requestId);

  return new Response(JSON.stringify({
    error: {
      code,
      message: contract.message
    }
  }), {
    status: contract.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [REQUEST_ID_HEADER]: safeId,
      'Access-Control-Expose-Headers': REQUEST_ID_HEADER
    }
  });
}

export function buildPlatformRouteUnavailableResponse(request) {
  const context = createRequestContext(request);
  return buildPlatformErrorResponse(
    new PlatformApiError(PLATFORM_ERROR.ROUTE_UNAVAILABLE),
    context.requestId
  );
}

export const PLATFORM_FOUNDATION_CONTRACT = Object.freeze({
  name: 'love-platform-api',
  routed: false,
  productionCapability: 'none',
  requestBodyMaxBytes: MAX_REQUEST_BODY_BYTES,
  errorCategories: Object.freeze(Object.keys(ERROR_CONTRACT))
});
