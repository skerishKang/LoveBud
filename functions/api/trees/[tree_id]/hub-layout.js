// #4217/#4238 specific Hub Layout route.
//
// Exact direct-Neon gates are independent by method:
// - GET + LB_HUB_LAYOUT_READ_RUNTIME=direct_neon -> #4238 read helper
// - PUT + LB_HUB_LAYOUT_WRITE_RUNTIME=direct_neon -> existing #4217 writer
// All default/unset/modal/unknown gates and unsupported methods delegate to the
// established catch-all so Modal/405 authority remains unchanged.

import { onRequest as catchAllOnRequest } from '../../[[path]].js';
import {
  handleHubLayoutReadDirectNeon,
  isHubLayoutDirectNeonReadRequest,
  isHubLayoutReadDirectNeonSelected
} from '../../../_shared/hub-layout-read-direct-neon.js';
import {
  handleHubLayoutDirectNeon,
  isHubLayoutDirectNeonSelected,
  isHubLayoutDirectNeonWriteRequest
} from '../../../_shared/hub-layout-direct-neon.js';
import { getOrCreateRequestId } from '../../../_shared/request-id.js';

export async function handleHubLayoutRoute(context, directOverrides = {}) {
  const { request, env } = context;

  if (
    isHubLayoutDirectNeonReadRequest(request)
    && isHubLayoutReadDirectNeonSelected(env || {})
  ) {
    const requestId = getOrCreateRequestId(request);
    return handleHubLayoutReadDirectNeon(
      request,
      env || {},
      requestId,
      directOverrides
    );
  }

  if (
    isHubLayoutDirectNeonWriteRequest(request)
    && isHubLayoutDirectNeonSelected(env || {})
  ) {
    const requestId = getOrCreateRequestId(request);
    return handleHubLayoutDirectNeon(
      request,
      env || {},
      requestId,
      directOverrides
    );
  }

  return catchAllOnRequest(context);
}

export async function onRequest(context) {
  return handleHubLayoutRoute(context);
}
