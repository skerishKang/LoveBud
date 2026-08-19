import {
  hasAuthorizationHeader,
  proxyMemoryRouteRequest
} from '../../_shared/memory-route-proxy.js';
import { getOrCreateRequestId } from '../../_shared/request-id.js';
import { handlePublicMemoryDetailDirectNeon } from '../../_shared/public-memory-detail-direct-neon.js';

function withMemoryId(context) {
  return { memoryId: context.params?.id || null };
}

export async function handleMemoryDetailGet(context, { executorOverride = null } = {}) {
  const routeOptions = withMemoryId(context);

  // Preserve the authenticated/private authority exactly: an Authorization
  // header always stays on the existing Modal-backed owner path, regardless of
  // the anonymous public runtime gate.
  if (hasAuthorizationHeader(context.request)) {
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  const runtime = typeof context.env?.LB_PUBLIC_MEMORY_DETAIL_RUNTIME === 'string'
    ? context.env.LB_PUBLIC_MEMORY_DETAIL_RUNTIME.trim()
    : '';

  if (runtime === 'direct_neon') {
    const requestId = getOrCreateRequestId(context.request);
    return handlePublicMemoryDetailDirectNeon(
      context.request,
      context.env || {},
      routeOptions.memoryId,
      requestId,
      { executorOverride }
    );
  }

  // Gate absent/unknown retains the existing anonymous Modal behavior.
  return proxyMemoryRouteRequest(context, routeOptions);
}

export async function onRequestGet(context) {
  return handleMemoryDetailGet(context);
}

export async function onRequestPut(context) {
  return proxyMemoryRouteRequest(context, withMemoryId(context));
}

export async function onRequestDelete(context) {
  return proxyMemoryRouteRequest(context, withMemoryId(context));
}
