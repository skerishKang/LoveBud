(function () {
  const AUTH_CONFIRMED_KEY = 'lovebud_auth_confirmed';
  const AUTH_CACHE_KEY = 'lovebud_auth_cache';
  const AUTH_WAIT_MS = typeof window.__LOVEBUD_AUTH_WAIT_MS === 'number' && window.__LOVEBUD_AUTH_WAIT_MS > 0 ? window.__LOVEBUD_AUTH_WAIT_MS : 2000;
  const AUTH_POLL_INTERVAL_MS = 100;

  function getCachedAuthUser() {
    try {
      const raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (!raw || raw === 'null') return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.uid ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function hasConfirmedAuthSession() {
    try {
      if (localStorage.getItem(AUTH_CONFIRMED_KEY) !== 'true') return false;
      return !!getCachedAuthUser();
    } catch (e) {
      return false;
    }
  }

  function shouldWaitLongerForAuth() {
    try {
      if (hasConfirmedAuthSession()) return true;
      if (window.__lovebudAuthReady === true) return false;
      if (typeof firebase !== 'undefined' && firebase.auth) return true;
    } catch (e) {}
    return false;
  }

  function getAuthWaitAttempts(forceLongWait) {
    const shouldLongWait = forceLongWait || shouldWaitLongerForAuth();
    if (!shouldLongWait) {
      return Math.max(1, Math.floor(500 / AUTH_POLL_INTERVAL_MS));
    }
    return Math.max(1, Math.floor(AUTH_WAIT_MS / AUTH_POLL_INTERVAL_MS));
  }

  function endpointLikelyRequiresAuth(endpoint) {
    return !String(endpoint || '').startsWith('/community/');
  }

  window.LoveTreeAuthPolicy = {
    AUTH_WAIT_MS,
    AUTH_POLL_INTERVAL_MS,
    getCachedAuthUser,
    hasConfirmedAuthSession,
    shouldWaitLongerForAuth,
    getAuthWaitAttempts,
    endpointLikelyRequiresAuth,
  };
})();