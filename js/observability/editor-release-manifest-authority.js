// #3852 / #3886 — bounded same-origin release manifest authority. Registered
// before the memory form-save runtime (load order preserved from the original
// inline block in pages/editor.html). At most one no-store same-origin fetch
// per page, initiated lazily on the first read so page load never issues a
// network request (environments without the manifest never surface a 404
// console error). The manifest contract is enforced exactly: only the own
// keys release_sha (40-char lowercase hex data property) and
// contract_version ("1") are accepted; extra keys, missing keys, accessor
// keys, inherited keys, non-"1" contract versions, invalid SHAs, non-ok
// HTTP responses, missing response.json, and malformed JSON all map to
// UNAVAILABLE. State distinguishes PENDING / READY / UNAVAILABLE.
// getCurrent() is synchronous; getState() exposes the state; whenReady()
// is the bounded async readiness seam that monitoring awaits, sharing the
// single in-flight fetch promise. Never persists to storage, never
// retries, never schedules timers, and never emits dynamic console output.
window.LoveBudReleaseManifestAuthority = (function () {
  var state = 'PENDING';
  var releaseSha = null;
  var requestPromise = null;

  function isValidReleaseSha(value) {
    return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
  }

  // Exact own-key contract. Object.keys never invokes getters, and every
  // own key must be an enumerable DATA property (accessor and inherited
  // keys are rejected so no getter can ever run during a read).
  function hasExactManifestKeys(data) {
    var keys;
    try {
      keys = Object.keys(data).sort();
    } catch (e) {
      return false;
    }
    if (keys.length !== 2) return false;
    if (keys[0] !== 'contract_version' || keys[1] !== 'release_sha') return false;
    for (var i = 0; i < keys.length; i++) {
      var descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(data, keys[i]);
      } catch (e) {
        return false;
      }
      if (!descriptor || !('value' in descriptor)) return false;
    }
    return true;
  }

  function applyManifest(data) {
    if (!data || typeof data !== 'object' || data === null) {
      state = 'UNAVAILABLE';
      return;
    }
    if (!hasExactManifestKeys(data)) {
      state = 'UNAVAILABLE';
      return;
    }
    if (data.contract_version !== '1') {
      state = 'UNAVAILABLE';
      return;
    }
    if (!isValidReleaseSha(data.release_sha)) {
      state = 'UNAVAILABLE';
      return;
    }
    releaseSha = data.release_sha;
    state = 'READY';
  }

  function boundedResult() {
    if (state === 'READY' && releaseSha !== null) {
      return Object.freeze({ ok: true, releaseSha: releaseSha });
    }
    return Object.freeze({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' });
  }

  // Returns the single in-flight request promise (or resolves the terminal
  // state). Starts the lazy fetch on first use; never a second fetch, and
  // never retries.
  function readBoundedManifest() {
    if (requestPromise) return requestPromise;
    requestPromise = new Promise(function (resolve) {
      function settleUnavailable() {
        state = 'UNAVAILABLE';
        resolve(boundedResult());
      }
      try {
        if (typeof window.fetch !== 'function') {
          settleUnavailable();
          return;
        }
        window
          .fetch('/.well-known/release.json', {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          })
          .then(function (response) {
            if (!response || response.ok !== true || typeof response.json !== 'function') {
              settleUnavailable();
              return null;
            }
            return response.json();
          })
          .then(function (data) {
            applyManifest(data);
            resolve(boundedResult());
          })
          .catch(function () {
            settleUnavailable();
          });
      } catch (e) {
        settleUnavailable();
      }
    });
    return requestPromise;
  }

  return Object.freeze({
    getCurrent: function () {
      if (state === 'PENDING') {
        readBoundedManifest();
      }
      return boundedResult();
    },
    getState: function () {
      return state;
    },
    whenReady: function () {
      if (state !== 'PENDING') {
        return Promise.resolve(boundedResult());
      }
      return readBoundedManifest();
    }
  });
})();
