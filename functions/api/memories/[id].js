import {
  hasAuthorizationHeader,
  proxyMemoryRouteRequest
} from '../../_shared/memory-route-proxy.js';
import { getOrCreateRequestId } from '../../_shared/request-id.js';
import { handlePublicMemoryDetailDirectNeon } from '../../_shared/public-memory-detail-direct-neon.js';
import {
  handleOwnerMemoryDetailDirectNeon
} from '../../_shared/owner-memory-detail-direct-neon.js';
import {
  handleMemoryUpdateDirectNeon,
  isMemoryUpdateDirectNeonSelected
} from '../../_shared/memory-update-direct-neon.js';
import {
  handleMemoryDeleteDirectNeon,
  isMemoryDeleteDirectNeonSelected
} from '../../_shared/memory-delete-direct-neon.js';

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

export async function handleMemoryDetailPut(
  context,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  const routeOptions = withMemoryId(context);

  // Preserve the existing Cloudflare write-auth guard even when the direct
  // candidate is explicitly selected. Missing Authorization never reaches a
  // verifier or direct DB capability and keeps the current 401 response shape.
  if (!hasAuthorizationHeader(context.request)) {
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  if (!isMemoryUpdateDirectNeonSelected(context.env || {})) {
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  // The direct helper must inspect the bounded JSON body to preserve the
  // explicit-private entitlement split. Clone BEFORE the direct attempt so a
  // private update can still be forwarded to the existing Modal proxy with an
  // untouched body stream. Once direct DB execution begins, the helper never
  // falls back to Modal.
  const modalFallbackRequest = context.request.clone();
  const requestId = getOrCreateRequestId(context.request);
  const directResponse = await handleMemoryUpdateDirectNeon(
    context.request,
    routeOptions.memoryId,
    context.env || {},
    requestId,
    {
      verifyTokenOverride,
      neonImporter,
      transactionAdapterOverride
    }
  );

  if (directResponse !== null) return directResponse;

  return proxyMemoryRouteRequest(
    { ...context, request: modalFallbackRequest },
    { ...routeOptions, requestId }
  );
}

export async function onRequestPut(context) {
  if (!isMemoryUpdateDirectNeonSelected(context.env || {})) {
    return proxyMemoryRouteRequest(context, withMemoryId(context));
  }
  return handleMemoryDetailPut(context);
}

export async function handleMemoryDetailDelete(
  context,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  const routeOptions = withMemoryId(context);

  // Preserve the existing Memory proxy auth-presence guard. Missing auth never
  // reaches Firebase verification or direct DB capability acquisition.
  if (!hasAuthorizationHeader(context.request)) {
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  if (!isMemoryDeleteDirectNeonSelected(context.env || {})) {
    return proxyMemoryRouteRequest(context, routeOptions);
  }

  const requestId = getOrCreateRequestId(context.request);
  return handleMemoryDeleteDirectNeon(
    context.request,
    routeOptions.memoryId,
    context.env || {},
    requestId,
    {
      verifyTokenOverride,
      neonImporter,
      transactionAdapterOverride
    }
  );
}

export async function onRequestDelete(context) {
  if (!isMemoryDeleteDirectNeonSelected(context.env || {})) {
    return proxyMemoryRouteRequest(context, withMemoryId(context));
  }
  return handleMemoryDetailDelete(context);
}
