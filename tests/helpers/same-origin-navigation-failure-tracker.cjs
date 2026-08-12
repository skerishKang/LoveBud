'use strict';

function createSameOriginNavigationFailureTracker(page, origin, failures) {
  if (!page || typeof page.on !== 'function') {
    throw new TypeError('page with event listeners is required');
  }
  if (!Array.isArray(failures)) {
    throw new TypeError('failures must be an array');
  }

  const expectedOrigin = new URL(origin).origin;
  const pendingFetchLike = new Set();
  const navigationAbortCandidates = new Set();

  const isSameOrigin = (request) => {
    try {
      return new URL(request.url()).origin === expectedOrigin;
    } catch (error) {
      return false;
    }
  };

  const isFetchLike = (request) => {
    const type = request.resourceType();
    return type === 'fetch' || type === 'xhr';
  };

  const onRequest = (request) => {
    if (isSameOrigin(request) && isFetchLike(request)) {
      pendingFetchLike.add(request);
    }
  };

  const onRequestFinished = (request) => {
    pendingFetchLike.delete(request);
    navigationAbortCandidates.delete(request);
  };

  const onRequestFailed = (request) => {
    const failure = request.failure();
    const expectedNavigationAbort =
      navigationAbortCandidates.has(request) &&
      failure &&
      failure.errorText === 'net::ERR_ABORTED';

    pendingFetchLike.delete(request);
    navigationAbortCandidates.delete(request);

    if (isSameOrigin(request) && failure && !expectedNavigationAbort) {
      failures.push(`${request.url()} - ${failure.errorText}`);
    }
  };

  page.on('request', onRequest);
  page.on('requestfinished', onRequestFinished);
  page.on('requestfailed', onRequestFailed);

  return {
    beginIntentionalNavigation() {
      navigationAbortCandidates.clear();
      for (const request of pendingFetchLike) {
        navigationAbortCandidates.add(request);
      }
    },

    endIntentionalNavigation() {
      // Keep unresolved pre-navigation request objects until Playwright emits
      // their terminal requestfinished/requestfailed event. A navigation-abort
      // event can arrive after page.goto() resolves. Exact request identity and
      // exact net::ERR_ABORTED matching keep this allowance tightly bounded.
    },

    /* Number of same-origin fetch/xhr requests still in flight. Lets a test
     * deterministically settle the page (bounded, no arbitrary sleep) before
     * an intentional navigation snapshot, so the navigation cannot cancel a
     * request that started inside the snapshot window. */
    pendingCount() {
      return pendingFetchLike.size;
    },

    /* Wait until no same-origin fetch/xhr request is in flight, or until
     * maxMs elapses. Returns the remaining pending count. */
    async waitForSettled(maxMs) {
      const deadline = Date.now() + (maxMs || 5000);
      while (pendingFetchLike.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return pendingFetchLike.size;
    },

    dispose() {
      pendingFetchLike.clear();
      navigationAbortCandidates.clear();
      if (typeof page.off !== 'function') return;
      page.off('request', onRequest);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

module.exports = {
  createSameOriginNavigationFailureTracker,
};
