import { buildPlatformRouteUnavailableResponse } from './core.js';

/**
 * Source-only canonical service entry boundary for the future love-platform-api.
 *
 * This child intentionally has no route table, service binding, authentication
 * provider, database binding, database driver, or Production capability. Until a
 * later bounded child explicitly attaches a reviewed route, every request fails
 * closed without an external network or database call.
 */
export default {
  async fetch(request) {
    return buildPlatformRouteUnavailableResponse(request);
  }
};
