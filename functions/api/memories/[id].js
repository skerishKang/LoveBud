import {
  hasAuthorizationHeader,
  proxyMemoryRouteRequest
} from '../../_shared/memory-route-proxy.js';
import { getOrCreateRequestId } from '../../_shared/request-id.js';
import { handlePublicMemoryDetailDirectNeon } from '../../_shared/public-memory-detail-direct-neon.js';
import {
  handleOwnerMemoryDetailDirectNeon
} from '../../_shared/owner-memory-detail-direct-neon.js';

function withMemoryId(context) {
  return { memoryId: context.params?.id || null };
}

export async function handleMemoryDetailGet(
  context,
  {
    executorOverride = null,
    verifyTokenOverride = null,
    verifierOptions = null
  } = {}
) {
  const routeOptions = withMemoryId(context);

  // Authenticated/private reads have an independent #4123 runtime gate. With
  // the gate absent/default/unknown they stay on the existing Modal authority.
  // Explicit direct mode verifies the Firebase principal and authorizes through
  // the parent Tree owner. Anonymous requests never enter this branch.
  if (hasAuthorizationHeader(context.request)) {
    // #4123 owner direct-Neon gate referenced by its explicit runtime flag so
    // the owner route selection stays visible in source (enforced by contract).
    const ownerRuntime = typeof context.env?.LB_OWNER_MEMORY_DETAIL_RUNTIME === 'string'
      ? context.env.LB_OWNER_MEMORY_DETAIL_RUNTIME.trim()
      : '';
    if (ownerRuntime === 'direct_neon') {
      const requestId = getOrCreateRequestId(context.request);
      return handleOwnerMemoryDetailDirectNeon(
        context.request,
        context.env || {},
        routeOptions.memoryId,
        requestId,
        {
          executorOverride,
          verifyTokenOverride,
          verifierOptions
        }
      );
    }
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  // #4114 anonymous/public route split remains independent and unchanged.
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
