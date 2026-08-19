import { proxyMemoryRouteRequest } from '../_shared/memory-route-proxy.js';
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

export async function onRequestPost(context) {
  // #4122 is read-only. Memory creation remains on the existing Modal/write
  // authority regardless of the owner-read runtime gate.
  return proxyMemoryRouteRequest(context);
}
