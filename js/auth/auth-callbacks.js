/**
 * LoveBud auth callback registry
 * Maintains auth-ready callback list with immediate fire support.
 */
(function () {
  if (window.LoveBudAuthCallbacks) return;

  window.__onAuthReadyCallbacks = window.__onAuthReadyCallbacks || [];

  function registerOnAuthReady(callback, authReadyFlagKey) {
    if (typeof callback !== "function") return;
    window.__onAuthReadyCallbacks.push(callback);

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

  window.LoveBudAuthCallbacks = {
    registerOnAuthReady: registerOnAuthReady,
    fireAuthReadyCallbacks: fireAuthReadyCallbacks,
  };
})();
