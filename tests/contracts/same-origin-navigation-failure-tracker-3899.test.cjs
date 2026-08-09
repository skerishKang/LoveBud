'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSameOriginNavigationFailureTracker,
} = require('../helpers/same-origin-navigation-failure-tracker.cjs');

function createFakePage() {
  const handlers = new Map();
  return {
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(handler);
    },
    off(event, handler) {
      if (handlers.has(event)) handlers.get(event).delete(handler);
    },
    emit(event, value) {
      for (const handler of handlers.get(event) || []) handler(value);
    },
  };
}

function createFakeRequest(url, resourceType) {
  let errorText = null;
  return {
    url: () => url,
    resourceType: () => resourceType,
    failure: () => (errorText ? { errorText } : null),
    failWith(nextErrorText) {
      errorText = nextErrorText;
    },
  };
}

test('#3899 ignores a delayed pre-navigation fetch/xhr ERR_ABORTED candidate', () => {
  const page = createFakePage();
  const failures = [];
  const tracker = createSameOriginNavigationFailureTracker(
    page,
    'http://127.0.0.1:4321',
    failures
  );

  const preNavigationFetch = createFakeRequest(
    'http://127.0.0.1:4321/api/community/trees',
    'fetch'
  );
  page.emit('request', preNavigationFetch);
  tracker.beginIntentionalNavigation();

  // Reproduce the CI lifecycle: page.goto()/the intentional navigation can
  // complete before Playwright emits requestfailed for the cancelled fetch.
  tracker.endIntentionalNavigation();
  preNavigationFetch.failWith('net::ERR_ABORTED');
  page.emit('requestfailed', preNavigationFetch);
  assert.deepEqual(failures, [], 'the delayed snapshotted navigation abort is excluded');

  tracker.dispose();
});

test('#3899 records genuine or out-of-boundary same-origin failures', () => {
  const page = createFakePage();
  const failures = [];
  const tracker = createSameOriginNavigationFailureTracker(
    page,
    'http://127.0.0.1:4321',
    failures
  );

  const genuineFailure = createFakeRequest(
    'http://127.0.0.1:4321/api/community/trees',
    'xhr'
  );
  page.emit('request', genuineFailure);
  tracker.beginIntentionalNavigation();
  tracker.endIntentionalNavigation();
  genuineFailure.failWith('net::ERR_FAILED');
  page.emit('requestfailed', genuineFailure);
  assert.deepEqual(
    failures,
    ['http://127.0.0.1:4321/api/community/trees - net::ERR_FAILED'],
    'a non-navigation failure remains visible even for a snapshotted request'
  );

  failures.length = 0;
  const postBoundaryAbort = createFakeRequest(
    'http://127.0.0.1:4321/api/community/memories?treeId=late',
    'fetch'
  );
  page.emit('request', postBoundaryAbort);
  postBoundaryAbort.failWith('net::ERR_ABORTED');
  page.emit('requestfailed', postBoundaryAbort);
  assert.deepEqual(
    failures,
    ['http://127.0.0.1:4321/api/community/memories?treeId=late - net::ERR_ABORTED'],
    'a request started after the snapshot is not treated as an expected navigation abort'
  );

  failures.length = 0;
  const unexpectedAbort = createFakeRequest(
    'http://127.0.0.1:4321/api/community/trees',
    'fetch'
  );
  page.emit('request', unexpectedAbort);
  unexpectedAbort.failWith('net::ERR_ABORTED');
  page.emit('requestfailed', unexpectedAbort);
  assert.deepEqual(
    failures,
    ['http://127.0.0.1:4321/api/community/trees - net::ERR_ABORTED'],
    'ERR_ABORTED outside an intentional navigation snapshot still fails'
  );

  tracker.dispose();
});

test('#3899 does not classify document requests as expected fetch/xhr aborts', () => {
  const page = createFakePage();
  const failures = [];
  const tracker = createSameOriginNavigationFailureTracker(
    page,
    'http://127.0.0.1:4321',
    failures
  );

  const documentRequest = createFakeRequest(
    'http://127.0.0.1:4321/pages/search.html',
    'document'
  );
  page.emit('request', documentRequest);
  tracker.beginIntentionalNavigation();
  tracker.endIntentionalNavigation();
  documentRequest.failWith('net::ERR_ABORTED');
  page.emit('requestfailed', documentRequest);
  assert.deepEqual(
    failures,
    ['http://127.0.0.1:4321/pages/search.html - net::ERR_ABORTED'],
    'a navigation/document abort remains observable'
  );

  tracker.dispose();
});
