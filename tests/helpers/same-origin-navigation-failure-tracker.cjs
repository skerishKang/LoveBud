'use strict';

/**
 * Same-origin request-failure tracker for intentional Playwright operations
 * (page.goto, keyboard-driven re-renders).
 *
 * Failure classification:
 *   1. A same-origin fetch-like request that was ALREADY pending (its
 *      'request' event already delivered) when the intentional operation
 *      began may legitimately be cancelled by it (net::ERR_ABORTED) —
 *      excused via exact request identity.
 *   2. A same-origin fetch-like request aborted with net::ERR_ABORTED whose
 *      'request' event was delivered inside a PROVEN-QUIESCENT
 *      intentional-navigation window is likewise classified as an
 *      intentional-navigation cancellation and recorded separately in
 *      `intentionalNavigationAborts`. The window is only armed when the
 *      caller proved immediately before beginning that no same-origin
 *      fetch-like request was in flight (empty pending set re-checked after
 *      a fresh CDP roundtrip) AND two consecutive animation frames have
 *      since elapsed, so a fetch initiated by an already-rendered frame
 *      callback has already been observed. Under that proof, a request
 *      observed inside the window was initiated by the intentional
 *      operation's own execution and can only be killed by that same
 *      operation. Membership is recorded at 'request'-event time, so
 *      classification stays correct even when the terminal 'requestfailed'
 *      event is delivered after the window closes (CDP delivery lag).
 *      This closes the residual race left by rule 1 alone: a request whose
 *      CDP 'request' event was still in flight at snapshot time escapes the
 *      allowance — observed again on PR #4184 attempt 1,
 *      /api/community/memories?treeId=a11y-1&limit=100.
 *   3. EVERY other same-origin request failure — including any non-abort
 *      error, and any net::ERR_ABORTED outside the proven-quiescent window —
 *      is reported in `failures`. Detection of genuine
 *      same-origin/network/application failures is never weakened.
 */

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
  const quiescentWindowRequests = new Set();
  const intentionalNavigationAborts = [];
  let intentionalWindowQuiescent = false;

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
      if (intentionalWindowQuiescent) {
        quiescentWindowRequests.add(request);
      }
    }
  };

  const onRequestFinished = (request) => {
    pendingFetchLike.delete(request);
    navigationAbortCandidates.delete(request);
    quiescentWindowRequests.delete(request);
  };

  const onRequestFailed = (request) => {
    const failure = request.failure();
    const isAbort =
      Boolean(failure) &&
      failure.errorText === 'net::ERR_ABORTED';
    const expectedNavigationAbort =
      navigationAbortCandidates.has(request) &&
      isAbort;
    const intentionalNavigationAbort =
      !expectedNavigationAbort &&
      quiescentWindowRequests.has(request) &&
      isAbort;

    pendingFetchLike.delete(request);
    navigationAbortCandidates.delete(request);
    quiescentWindowRequests.delete(request);

    if (intentionalNavigationAbort) {
      intentionalNavigationAborts.push(
        `${request.url()} - ${failure.errorText} (proven-quiescent window)`
      );
    }
    if (isSameOrigin(request) && failure && !expectedNavigationAbort && !intentionalNavigationAbort) {
      failures.push(`${request.url()} - ${failure.errorText}`);
    }
  };

  page.on('request', onRequest);
  page.on('requestfinished', onRequestFinished);
  page.on('requestfailed', onRequestFailed);

  return {
    /**
     * Arm the proven-quiescent intentional-navigation window. Call ONLY after
     * the caller has drained same-origin fetch-like requests to an empty
     * pending set (re-confirmed after a fresh CDP roundtrip) and let two
     * consecutive animation frames elapse, so every fetch initiated by an
     * already-rendered frame callback is already observable. The window ends
     * at endIntentionalNavigation(); requests observed inside it stay covered
     * until their terminal event regardless of delivery timing.
     */
    beginIntentionalNavigation() {
      navigationAbortCandidates.clear();
      for (const request of pendingFetchLike) {
        navigationAbortCandidates.add(request);
      }
      intentionalWindowQuiescent = true;
    },

    endIntentionalNavigation() {
      // Keep unresolved pre-navigation request objects until Playwright emits
      // their terminal requestfinished/requestfailed event. A navigation-abort
      // event can arrive after page.goto() resolves. Exact request identity and
      // exact net::ERR_ABORTED matching keep this allowance tightly bounded.
      intentionalWindowQuiescent = false;
    },

    /**
     * Same-origin fetch-like requests aborted with net::ERR_ABORTED that were
     * observed inside a proven-quiescent intentional-navigation window.
     * Recorded separately so callers can assert on them explicitly; never
     * merged into `failures`.
     */
    getIntentionalNavigationAborts() {
      return intentionalNavigationAborts.slice();
    },

    dispose() {
      pendingFetchLike.clear();
      navigationAbortCandidates.clear();
      quiescentWindowRequests.clear();
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
