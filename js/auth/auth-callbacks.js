/**
 * LoveBud auth callback registry
 * Maintains auth-ready callback list with immediate fire support.
 */
(function () {
  if (window.LoveBudAuthCallbacks) return;

  window.__onAuthReadyCallbacks = window.__onAuthReadyCallbacks || [];

  function preserveEarlyAuthReadyFallback() {
    if (typeof window.onAuthReady !== "function") return;
    if (window.onAuthReady.__lovebudPreservedAuthReadyFallback === true) return;

    var earlyCallback = window.onAuthReady;
    earlyCallback.__lovebudPreservedAuthReadyFallback = true;

    if (window.__onAuthReadyCallbacks.indexOf(earlyCallback) === -1) {
      window.__onAuthReadyCallbacks.push(earlyCallback);
    }
  }

  preserveEarlyAuthReadyFallback();

  function registerOnAuthReady(callback, authReadyFlagKey) {
    if (typeof callback !== "function") return;
    if (window.__onAuthReadyCallbacks.indexOf(callback) === -1) {
      window.__onAuthReadyCallbacks.push(callback);
    }

    if (authReadyFlagKey && window[authReadyFlagKey]) {
      var user = window.__lastAuthUser || null;
      try {
        callback(user);
      } catch (e) {
        console.error("[auth] Callback error:", e);
      }
    }
  }

  function fireAuthReadyCallbacks(user) {
    window.__lastAuthUser = user;
    window.__onAuthReadyCallbacks.forEach(function (callback) {
      try {
        callback(user);
      } catch (e) {
        console.error("[auth] Callback error:", e);
      }
    });
  }

  function createAuthReadyCallbackBridge(options) {
    options = options || {};
    var authReadyFlagKey = options.authReadyFlagKey;

    return {
      registerOnAuthReady: function (callback) {
        preserveEarlyAuthReadyFallback();
        registerOnAuthReady(callback, authReadyFlagKey);
      },
      fireAuthReadyCallbacks: fireAuthReadyCallbacks,
    };
  }

  window.LoveBudAuthCallbacks = {
    registerOnAuthReady: registerOnAuthReady,
    fireAuthReadyCallbacks: fireAuthReadyCallbacks,
    createAuthReadyCallbackBridge: createAuthReadyCallbackBridge,
    preserveEarlyAuthReadyFallback: preserveEarlyAuthReadyFallback,
  };
})();
