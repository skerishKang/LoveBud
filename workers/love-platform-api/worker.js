import {
  PLATFORM_ERROR,
  PlatformApiError,
  buildPlatformRouteUnavailableResponse,
  createCapabilitySet
} from './core.js';
import {
  handlePublicGrowingRead,
  isPublicGrowingReadRequest
} from './public-growing-read.js';

/**
 * Create the source-only love-platform-api Worker with explicitly injected
 * provider-neutral capabilities and identity boundaries.
 *
 * #4099 attaches only the LoveBud Growing public-read route. #4100 adds a
 * provider-neutral read-principal composition seam without selecting an auth
 * provider in this Worker. The default export still has no query provider,
 * identity resolver, database binding, database driver, auth SDK, service
 * binding, or Production capability.
 */
export function createLovePlatformApiWorker({
  query = null,
  readPrincipal = null
} = {}) {
  if (readPrincipal !== null && typeof readPrincipal !== 'function') {
    throw new TypeError('readPrincipal must be a function');
  }

  const capabilities = createCapabilitySet({ query });

  return Object.freeze({
    async fetch(request) {
      if (isPublicGrowingReadRequest(request)) {
        return handlePublicGrowingRead(request, capabilities);
      }
      return buildPlatformRouteUnavailableResponse(request);
    },

    async resolveReadPrincipal(request) {
      if (readPrincipal === null) {
        throw new PlatformApiError(PLATFORM_ERROR.CAPABILITY_UNSUPPORTED);
      }
      return readPrincipal(request);
    }
  });
}

export default createLovePlatformApiWorker();
