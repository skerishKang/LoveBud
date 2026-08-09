/**
 * LoveBud auth cache helpers
 * Handles confirmed-session cache, token cache and stale firebase cleanup.
 */
(function () {
  if (window.LoveBudAuthCache) return;

  var PRIVATE_OWNER_UID_KEY = "lovebud_private_cache_owner_uid";
  var PRIVATE_EXACT_KEYS = [
    "lovebud_my_trees_list_cache",
    "lovebud_trees_cache",
  ];
  var PRIVATE_PREFIXES = ["tree_detail_", "tree_memories_"];
  var privateOwnerUid = null;
  var privateOwnerEpoch = 0;

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

  function getTokenStorage() {
    try {
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  }

  function clearAuthTokenCache(tokenKey) {
    try {
      localStorage.removeItem(tokenKey);
    } catch (e) {}
    try {
      var tokenStorage = getTokenStorage();
      if (tokenStorage) tokenStorage.removeItem(tokenKey);
    } catch (e) {}
  }

  function isOwnedPrivateCacheKey(key) {
    if (!key) return false;
    if (PRIVATE_EXACT_KEYS.indexOf(key) !== -1) return true;
    return PRIVATE_PREFIXES.some(function (prefix) {
      return key.indexOf(prefix) === 0;
    });
  }

  function clearPrivateMemoryCaches() {
    try {
      if (window.LoveBudCache && typeof window.LoveBudCache.clear === "function") {
        window.LoveBudCache.clear("my_trees_list");
      } else {
        if (window.loveBudCache) delete window.loveBudCache.lb_my_trees_list;
        if (window.sessionStorage) window.sessionStorage.removeItem("lb_my_trees_list");
      }
    } catch (e) {}
  }

  function clearPrivateCaches() {
    privateOwnerEpoch += 1;
    privateOwnerUid = null;

    try {
      var storage = window.localStorage;
      if (storage) {
        var keys = [];
        for (var i = 0; i < storage.length; i++) {
          var key = storage.key(i);
          if (key && isOwnedPrivateCacheKey(key)) keys.push(key);
        }
        keys.forEach(function (key) {
          try {
            storage.removeItem(key);
          } catch (e) {}
        });
        storage.removeItem(PRIVATE_OWNER_UID_KEY);
      }
    } catch (e) {}

    clearPrivateMemoryCaches();
  }

  function syncConfirmedPrivateOwner(uid) {
    var nextUid = uid ? String(uid) : "";
    if (!nextUid) {
      clearPrivateCaches();
      return null;
    }

    var persistedUid = null;
    try {
      persistedUid = localStorage.getItem(PRIVATE_OWNER_UID_KEY);
    } catch (e) {}

    var knownUid = privateOwnerUid || persistedUid;
    if (knownUid !== nextUid) {
      clearPrivateCaches();
    }

    privateOwnerUid = nextUid;
    try {
      localStorage.setItem(PRIVATE_OWNER_UID_KEY, nextUid);
    } catch (e) {}

    return {
      uid: privateOwnerUid,
      epoch: privateOwnerEpoch,
    };
  }

  function getPrivateCacheOwnerUid() {
    return privateOwnerUid;
  }

  function capturePrivateCacheAuthority(expectedUid) {
    var uid = expectedUid ? String(expectedUid) : "";
    if (!uid || uid !== privateOwnerUid) return null;
    return {
      uid: uid,
      epoch: privateOwnerEpoch,
    };
  }

  function isPrivateCacheAuthorityCurrent(authority) {
    return !!(
      authority &&
      authority.uid &&
      authority.uid === privateOwnerUid &&
      Number(authority.epoch) === Number(privateOwnerEpoch)
    );
  }

  function removeOwnedPrivateCacheKey(key) {
    if (!isOwnedPrivateCacheKey(key)) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function readPrivateCacheRecord(key, expectedUid) {
    var uid = expectedUid ? String(expectedUid) : "";
    if (!isOwnedPrivateCacheKey(key) || !uid || uid !== privateOwnerUid) {
      return null;
    }

    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.uid !== uid) {
        removeOwnedPrivateCacheKey(key);
        return null;
      }
      return parsed;
    } catch (e) {
      removeOwnedPrivateCacheKey(key);
      return null;
    }
  }

  function writePrivateCacheRecord(key, expectedUid, record, authority) {
    var uid = expectedUid ? String(expectedUid) : "";
    if (
      !isOwnedPrivateCacheKey(key) ||
      !uid ||
      uid !== privateOwnerUid ||
      !isPrivateCacheAuthorityCurrent(authority) ||
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      return false;
    }

    var scopedRecord = Object.assign({}, record, { uid: uid });
    try {
      localStorage.setItem(key, JSON.stringify(scopedRecord));
      return true;
    } catch (e) {
      return false;
    }
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
    clearPrivateCaches();
    try {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(confirmedKey);
    } catch (e) {}
    clearAuthTokenCache(tokenKey);
  }

  function setConfirmedAuthCache(user, cacheKey, confirmedKey, tokenKey) {
    try {
      if (user && user.uid) {
        syncConfirmedPrivateOwner(user.uid);
        var cacheData = {
          uid: user.uid,
          displayName: user.displayName || "",
          email: user.email || "",
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        localStorage.setItem(confirmedKey, "true");
        clearAuthTokenCache(tokenKey);
        return;
      }
    } catch (e) {}
    clearConfirmedAuthCache(cacheKey, confirmedKey, tokenKey);
  }

  function getCachedAuthToken(tokenKey) {
    try {
      localStorage.removeItem(tokenKey);
    } catch (e) {}
    try {
      var tokenStorage = getTokenStorage();
      if (!tokenStorage) return null;
      var raw = tokenStorage.getItem(tokenKey);
      if (!raw || raw === "null") return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.token || !parsed.expiresAt) return null;
      if (Date.now() >= Number(parsed.expiresAt) - 30000) {
        tokenStorage.removeItem(tokenKey);
        return null;
      }
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

      syncConfirmedPrivateOwner(user.uid);
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
          try {
            localStorage.removeItem(tokenKey);
          } catch (e) {}
          var tokenStorage = getTokenStorage();
          if (tokenStorage) {
            tokenStorage.setItem(
              tokenKey,
              JSON.stringify({
                uid: user.uid,
                token: tokenResult.token,
                expiresAt: new Date(tokenResult.expirationTime).getTime(),
              })
            );
          }
        }
      }
    } catch (e) {
      console.warn("[auth] Failed to persist confirmed session:", e);
    }
  }

  function createConfirmedAuthCacheBridge(options) {
    var cacheKey = options && options.cacheKey;
    var confirmedKey = options && options.confirmedKey;
    var tokenKey = options && options.tokenKey;

    return {
      isInvalidAuthSessionError: isInvalidAuthSessionError,
      clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
      getCachedAuthUser: function () {
        return getCachedAuthUser(cacheKey, confirmedKey);
      },
      setConfirmedAuthCache: function (user) {
        return setConfirmedAuthCache(user, cacheKey, confirmedKey, tokenKey);
      },
      clearConfirmedAuthCache: function () {
        return clearConfirmedAuthCache(cacheKey, confirmedKey, tokenKey);
      },
      getCachedAuthToken: function () {
        return getCachedAuthToken(tokenKey);
      },
      persistConfirmedAuthSession: function (user) {
        return persistConfirmedAuthSession(user, cacheKey, confirmedKey, tokenKey);
      },
    };
  }

  window.clearPrivateCaches = clearPrivateCaches;
  window.LoveBudAuthCache = {
    PRIVATE_OWNER_UID_KEY: PRIVATE_OWNER_UID_KEY,
    isInvalidAuthSessionError: isInvalidAuthSessionError,
    clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
    getTokenStorage: getTokenStorage,
    clearAuthTokenCache: clearAuthTokenCache,
    getCachedAuthUser: getCachedAuthUser,
    setConfirmedAuthCache: setConfirmedAuthCache,
    clearConfirmedAuthCache: clearConfirmedAuthCache,
    getCachedAuthToken: getCachedAuthToken,
    persistConfirmedAuthSession: persistConfirmedAuthSession,
    createConfirmedAuthCacheBridge: createConfirmedAuthCacheBridge,
    isOwnedPrivateCacheKey: isOwnedPrivateCacheKey,
    clearPrivateCaches: clearPrivateCaches,
    syncConfirmedPrivateOwner: syncConfirmedPrivateOwner,
    getPrivateCacheOwnerUid: getPrivateCacheOwnerUid,
    capturePrivateCacheAuthority: capturePrivateCacheAuthority,
    isPrivateCacheAuthorityCurrent: isPrivateCacheAuthorityCurrent,
    readPrivateCacheRecord: readPrivateCacheRecord,
    writePrivateCacheRecord: writePrivateCacheRecord,
  };
})();
