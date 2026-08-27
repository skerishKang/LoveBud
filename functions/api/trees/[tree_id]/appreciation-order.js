// #4237 route-specific appreciation-order direct-Neon POST candidate.
//
// POST + LB_APPRECIATION_ORDER_WRITE_RUNTIME=direct_neon enters the bounded
// direct-Neon writer. GET, default/unset/modal/unknown POST, and unsupported
// methods remain delegated to the established catch-all so #4236 Modal and 405
// authority stays unchanged.

import { onRequest as catchAllOnRequest } from '../../[[path]].js';
import {
  handleAppreciationOrderDirectNeon,
  isAppreciationOrderDirectNeonSelected,
  isAppreciationOrderDirectNeonWriteRequest
} from '../../../_shared/appreciation-order-direct-neon.js';
import { getOrCreateRequestId } from '../../../_shared/request-id.js';

export async function handleAppreciationOrderRoute(context, directOverrides = {}) {
  const { request, env } = context;

  if (
    isAppreciationOrderDirectNeonWriteRequest(request)
    && isAppreciationOrderDirectNeonSelected(env || {})
  ) {
    const requestId = getOrCreateRequestId(request);
    return handleAppreciationOrderDirectNeon(
      request,
      env || {},
      requestId,
      directOverrides
    );
  }

  return catchAllOnRequest(context);
}

export async function onRequest(context) {
  return handleAppreciationOrderRoute(context);
}
