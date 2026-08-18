import {
  buildPlatformRouteUnavailableResponse,
  createCapabilitySet
} from './core.js';
import {
  handlePublicGrowingRead,
  isPublicGrowingReadRequest
} from './public-growing-read.js';

/**
 * Create the source-only love-platform-api Worker with explicitly injected
 * provider-neutral capabilities.
 *
 * #4099 attaches only the LoveBud Growing public-read route. The default export
 * still has no query provider, database binding, database driver, auth provider,
 * service binding, or Production capability; a matched Growing request therefore
 * fails closed unless a reviewed caller explicitly injects a Query capability.
 */
export function createLovePlatformApiWorker({ query = null } = {}) {
  const capabilities = createCapabilitySet({ query });

  return Object.freeze({
    async fetch(request) {
      if (isPublicGrowingReadRequest(request)) {
        return handlePublicGrowingRead(request, capabilities);
      }
      return buildPlatformRouteUnavailableResponse(request);
    }
  });
}

export default createLovePlatformApiWorker();
