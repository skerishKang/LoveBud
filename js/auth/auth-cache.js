/**
 * LoveBud auth cache helpers
 * Handles confirmed-session cache, token cache and stale firebase cleanup.
 */
(function () {
  if (window.LoveBudAuthCache) return;

  function isInvalidAuthSessionError(error) {
    var message = String((error && (error.code || error.message)) || "");
    return /USER_NOT_FOUND|user-not-found|invalid-user-token|token.*expired|user token/i.test(
      message
    );
  }

  function clearStaleFirebaseAuthState() {
    var prefixes = [
      "firebase:authUser:",
      "firebase:pendingRedirect:",
      "firebase:redirectUser:",
    ];
    function clearStorage(storage) {
      if (!storage) return;
      var keys = [];
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (
          key &&
          prefixes.some(function (p) {
            return key.indexOf(p) === 0;
          })
        ) {
          keys.push(key);
        }
      }
      keys.forEach(function (k) {
        try {
          storage.removeItem(k);
        } catch (e) {}
      });
    }
    try {
      clearStorage(window.localStorage);
    } catch (e) {}
    try {
      clearStorage(window.sessionStorage);
    } catch (e) {}
  }

  function getCachedAuthUser(cacheKey, confirmedKey) {
    try {
      if (localStorage.getItem(confirmedKey) !== "true") return null;
      var raw = localStorage.getItem(cacheKey);
      if (!raw || raw === "null") return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.uid) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearConfirmedAuthCache(cacheKey, confirmedKey, tokenKey) {
    try {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(confirmedKey);
      localStorage.removeItem(tokenKey);
    } catch (e) {}
  }

  function setConfirmedAuthCache(user, cacheKey, confirmedKey, tokenKey) {
    try {
      if (user && user.uid) {
        var cacheData = {
          uid: user.uid,
          displayName: user.displayName || "",
          email: user.email || "",
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        localStorage.setItem(confirmedKey, "true");
        return;
      }
    } catch (e) {}
    clearConfirmedAuthCache(cacheKey, confirmedKey, tokenKey);
  }

  function getCachedAuthToken(tokenKey) {
    try {
      var raw = localStorage.getItem(tokenKey);
      if (!raw || raw === "null") return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.token || !parsed.expiresAt) return null;
      if (Date.now() >= Number(parsed.expiresAt) - 30000) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  async function persistConfirmedAuthSession(
    user,
    cacheKey,
    confirmedKey,
    tokenKey
  ) {
    try {
      if (!user || !user.uid) {
        clearConfirmedAuthCache(cacheKey, confirmedKey, tokenKey);
        return;
      }

      var cacheData = {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      localStorage.setItem(confirmedKey, "true");

      if (typeof user.getIdTokenResult === "function") {
        var tokenResult = await user.getIdTokenResult();
        if (tokenResult && tokenResult.token) {
          localStorage.setItem(
            tokenKey,
            JSON.stringify({
              uid: user.uid,
              token: tokenResult.token,
              expiresAt: new Date(tokenResult.expirationTime).getTime(),
            })
          );
        }
      }
    } catch (e) {
      console.warn("[auth] Failed to persist confirmed session:", e);
    }
  }

  window.LoveBudAuthCache = {
    isInvalidAuthSessionError: isInvalidAuthSessionError,
    clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
    getCachedAuthUser: getCachedAuthUser,
    setConfirmedAuthCache: setConfirmedAuthCache,
    clearConfirmedAuthCache: clearConfirmedAuthCache,
    getCachedAuthToken: getCachedAuthToken,
    persistConfirmedAuthSession: persistConfirmedAuthSession,
  };
})();
