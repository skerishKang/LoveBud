// #4217 specific Hub Layout route.
//
// The route intercepts only explicitly gated direct-Neon PUT requests. GET,
// default/unset/modal/unknown PUT, and unsupported methods delegate to the
// existing catch-all handler so all established Modal/405 semantics stay owned
// by functions/api/[[path]].js.

import { onRequest as catchAllOnRequest } from '../../[[path]].js';
import {
  handleHubLayoutDirectNeon,
  isHubLayoutDirectNeonSelected,
  isHubLayoutDirectNeonWriteRequest
} from '../../../_shared/hub-layout-direct-neon.js';
import { getOrCreateRequestId } from '../../../_shared/request-id.js';

export async function handleHubLayoutRoute(context, directOverrides = {}) {
  const { request, env } = context;
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
