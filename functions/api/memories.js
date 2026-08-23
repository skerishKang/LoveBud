import {
  buildMemoryPayloadTooLargeResponse,
  buildMemoryReadFailureResponse,
  proxyMemoryRouteRequest
} from '../_shared/memory-route-proxy.js';
import {
  REQUEST_ID_HEADER,
  getOrCreateRequestId
} from '../_shared/request-id.js';
import {
  buildOwnerMemoryIntegerLimitValidationBody,
  handleOwnerMemoriesDirectNeon,
  hasFractionalOwnerMemoryLimit,
  isOwnerMemoriesDirectNeonSelected
} from '../_shared/owner-memory-list-direct-neon.js';
import { readBoundedRequestBody } from '../_shared/bounded-request-body.js';
import {
  isMemoryCreateDirectNeonSelected,
  handleMemoryCreateDirectNeon
} from '../_shared/memory-create-direct-neon.js';

function buildDirectOwnerMemoryLimitValidationResponse(rawLimit, requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon',
    'x-lovebud-route-status': 'invalid-limit'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify(buildOwnerMemoryIntegerLimitValidationBody(rawLimit)), {
    status: 422,
    headers
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (isOwnerMemoriesDirectNeonSelected(env)) {
    const requestId = getOrCreateRequestId(request);
    const rawLimit = new URL(request.url).searchParams.get('limit');
    if (hasFractionalOwnerMemoryLimit(rawLimit)) {
      return buildDirectOwnerMemoryLimitValidationResponse(rawLimit, requestId);
    }
    return handleOwnerMemoriesDirectNeon(request, env || {}, requestId);
  }

  // Absent/unknown gate keeps the existing authenticated Modal collection
  // authority exactly as before.
  return proxyMemoryRouteRequest(context);
}

function rebuildPostRequestForModalPath(request, bodyBytes) {
  // The incoming Request stream was consumed exactly once at the route
  // boundary; the unchanged Modal proxy path re-reads the buffered bytes from
  // a fresh equivalent Request so deferral never double-reads a live stream.
  return new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bodyBytes || undefined
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // #4178 gated explicit-public Memory create direct-Neon candidate dispatch.
  // With the gate unset/modal/unknown the existing Modal POST behavior below
  // is unchanged. With LB_MEMORY_CREATE_WRITE_RUNTIME=direct_neon selected,
  // only an exact visibility:"public" runs the direct-Neon candidate;
  // omitted/null (parent-Tree inheritance may resolve private), explicit
  // private (Plus/private-storage entitlement stays Modal-owned), and any
  // other value defer to the unchanged Modal authority BEFORE any direct DB
  // connection or transaction. After direct execution begins there is no
  // per-request direct -> Modal fallback.
  if (isMemoryCreateDirectNeonSelected(env)) {
    const requestId = getOrCreateRequestId(request);
    let bodyResult;
    try {
      bodyResult = await readBoundedRequestBody(request);
    } catch {
      bodyResult = { status: 'readError', body: null };
    }
    // Bounded-body failures keep the exact existing proxy response shapes on
    // both gated and ungated paths.
    if (bodyResult.status === 'tooLarge') {
      return buildMemoryPayloadTooLargeResponse(requestId);
    }
    if (bodyResult.status === 'readError') {
      return buildMemoryReadFailureResponse(requestId);
    }
    const directResponse = await handleMemoryCreateDirectNeon(
      request,
      env || {},
      requestId,
      { boundedBodyResult: bodyResult }
    );
    if (directResponse !== null) return directResponse;

    // Deferred: hand the already-buffered payload to the UNCHANGED Modal path
    // over a fresh equivalent Request (the original stream was consumed once).
    return proxyMemoryRouteRequest({
      ...context,
      request: rebuildPostRequestForModalPath(request, bodyResult.body)
    });
  }

  // #4122 is read-only. Memory creation remains on the existing Modal/write
  // authority regardless of the owner-read runtime gate.
  return proxyMemoryRouteRequest(context);
}
