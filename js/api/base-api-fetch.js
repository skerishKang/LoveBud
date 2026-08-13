(function () {
  // auth-state.js의 AUTH_TOKEN_KEY 상수를 재사용, fallback으로 기존 문자열 유지
  const AUTH_CACHE_KEY = (window.LoveBudAuthState && window.LoveBudAuthState.AUTH_CACHE_KEY) || 'lovebud_auth_cache';
  const AUTH_CONFIRMED_KEY = (window.LoveBudAuthState && window.LoveBudAuthState.AUTH_CONFIRMED_KEY) || 'lovebud_auth_confirmed';
  const AUTH_TOKEN_KEY = (window.LoveBudAuthState && window.LoveBudAuthState.AUTH_TOKEN_KEY) || 'lovebud_auth_token';

  function getTokenStorage() {
    try {
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  }

  function removeLegacyDurableTokenRecord() {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (e) {}
  }

  function clearCachedTokenRecord() {
    removeLegacyDurableTokenRecord();
    try {
      const storage = getTokenStorage();
      if (storage) storage.removeItem(AUTH_TOKEN_KEY);
    } catch (e) {}
  }

  function resolvePrincipalId(principal) {
    if (!principal || typeof principal !== 'object') return null;
    const candidate = principal.id != null ? principal.id : principal.uid;
    if (candidate == null) return null;
    const normalized = String(candidate).trim();
    return normalized || null;
  }

  function createFirebaseAuthTokenProvider() {
    return {
      isReady() {
        try {
          return !!(
            window.__lovebudAuthReady &&
            window.firebase &&
            typeof window.firebase.auth === 'function'
          );
        } catch (e) {
          return false;
        }
      },
      getCurrentPrincipal() {
        try {
          if (!window.firebase || typeof window.firebase.auth !== 'function') return null;
          const user = window.firebase.auth().currentUser;
          if (!user || !user.uid) return null;
          return {
            id: String(user.uid),
            provider: 'firebase',
          };
        } catch (e) {
          return null;
        }
      },
      async getAccessToken() {
        try {
          if (!window.firebase || typeof window.firebase.auth !== 'function') return null;
          const user = window.firebase.auth().currentUser;
          if (!user || !user.uid) return null;
          const tokenResult = typeof user.getIdTokenResult === 'function'
            ? await user.getIdTokenResult()
            : null;
          const token = tokenResult ? tokenResult.token : await user.getIdToken();
          if (!token) return null;
          return {
            principalId: String(user.uid),
            token,
            expiresAt: tokenResult && tokenResult.expirationTime
              ? new Date(tokenResult.expirationTime).getTime()
              : null,
          };
        } catch (e) {
          throw e;
        }
      },
    };
  }

  const firebaseAuthTokenProvider = createFirebaseAuthTokenProvider();

  function isValidAuthTokenProvider(provider) {
    return !!(
      provider &&
      typeof provider.isReady === 'function' &&
      typeof provider.getCurrentPrincipal === 'function' &&
      typeof provider.getAccessToken === 'function'
    );
  }

  function getAuthTokenProvider() {
    try {
      if (isValidAuthTokenProvider(window.LoveBudAuthTokenProvider)) {
        return window.LoveBudAuthTokenProvider;
      }
    } catch (e) {}
    return firebaseAuthTokenProvider;
  }

  function resolveExpectedAuthUid() {
    // Phase A keeps the cache field name `uid` for compatibility, while the
    // live principal source is provider-neutral. When no live principal is
    // available (normal bootstrap), fall back to the confirmed session cache.
    try {
      const principal = getAuthTokenProvider().getCurrentPrincipal();
      const principalId = resolvePrincipalId(principal);
      if (principalId) return principalId;
    } catch (e) {}
    try {
      if (localStorage.getItem(AUTH_CONFIRMED_KEY) === 'true') {
        const raw = localStorage.getItem(AUTH_CACHE_KEY);
        if (!raw || raw === 'null') return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.uid) {
          return String(parsed.uid);
        }
      }
    } catch (e) {}
    return null;
  }

  function getCachedTokenRecord() {
    removeLegacyDurableTokenRecord();
    try {
      const storage = getTokenStorage();
      if (!storage) return null;
      const raw = storage.getItem(AUTH_TOKEN_KEY);
      if (!raw || raw === 'null') return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.token || !parsed.expiresAt) return null;
      if (Date.now() >= Number(parsed.expiresAt) - 30000) {
        storage.removeItem(AUTH_TOKEN_KEY);
        return null;
      }
      // Reject cached tokens that belong to a different authenticated user
      // (e.g. account switch with a stale session-scoped token).
      const expectedUid = resolveExpectedAuthUid();
      if (expectedUid) {
        const tokenUid = parsed.uid ? String(parsed.uid) : '';
        if (!tokenUid || tokenUid !== expectedUid) {
          storage.removeItem(AUTH_TOKEN_KEY);
          return null;
        }
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setCachedTokenRecord(principal, tokenResult) {
    removeLegacyDurableTokenRecord();
    try {
      const principalId = resolvePrincipalId(principal);
      if (!principalId || !tokenResult || !tokenResult.token) return;
      const expiresAt = tokenResult.expiresAt != null
        ? Number(tokenResult.expiresAt)
        : new Date(tokenResult.expirationTime).getTime();
      if (!Number.isFinite(expiresAt)) return;
      const storage = getTokenStorage();
      if (!storage) return;
      storage.setItem(AUTH_TOKEN_KEY, JSON.stringify({
        uid: principalId,
        token: tokenResult.token,
        expiresAt,
      }));
    } catch (e) {}
  }

  async function waitForAuthToken(extraMs) {
    const waitMs = Number(extraMs || 0);
    if (waitMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function waitForAuthBootstrapReady(maxMs) {
    const bootstrap = window.LoveBudAuthBootstrap;
    if (!bootstrap || typeof bootstrap.whenReady !== 'function') return;
    try {
      const snapshot = typeof bootstrap.getSnapshot === 'function' ? bootstrap.getSnapshot() : null;
      if (snapshot && snapshot.ready) return;
      await Promise.race([
        bootstrap.whenReady(),
        new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(maxMs || 0))))
      ]);
    } catch (e) {}
  }

  function clearConfirmedAuthState() {
    try {
      localStorage.removeItem(AUTH_CACHE_KEY);
      localStorage.removeItem(AUTH_CONFIRMED_KEY);
    } catch (e) {}
    clearCachedTokenRecord();

    try {
      if (window.clearPrivateCaches) {
        window.clearPrivateCaches();
      }
    } catch (e) {}

    try {
      if (
        window.LoveBudProtectedRoute &&
        typeof window.LoveBudProtectedRoute.setAuthState === 'function'
      ) {
        window.LoveBudProtectedRoute.setAuthState(true, null);
      }
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('lovebud-auth-cache-cleared', {
        detail: { reason: 'api-auth-failure' }
      }));
    } catch (e) {}
  }

  async function getAuthHeaders(options = {}) {
    const policy = window.LoveTreeAuthPolicy;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (options.skipAuth === true || options.publicRead === true) {
      return headers;
    }
    const requireAuth = !!options.requireAuth;

    const cachedToken = getCachedTokenRecord();
    if (cachedToken && cachedToken.token) {
      headers.Authorization = `Bearer ${cachedToken.token}`;
      return headers;
    }

    if (requireAuth && policy.hasConfirmedAuthSession()) {
      await waitForAuthBootstrapReady(Math.max(policy.AUTH_WAIT_MS, 3000));
    }

    let attempts = 0;
    const forceLongWait = !!options.forceLongWait;
    const maxAttempts = policy.getAuthWaitAttempts(forceLongWait);

    while (attempts < maxAttempts) {
      const nextCachedToken = getCachedTokenRecord();
      if (nextCachedToken && nextCachedToken.token) {
        headers.Authorization = `Bearer ${nextCachedToken.token}`;
        return headers;
      }
      const authTokenProvider = getAuthTokenProvider();
      let providerReady = false;
      try {
        providerReady = authTokenProvider.isReady() === true;
      } catch (e) {}
      if (providerReady) {
        const principal = authTokenProvider.getCurrentPrincipal();
        const principalId = resolvePrincipalId(principal);
        if (principalId) {
          const tokenResult = await authTokenProvider.getAccessToken({ forceRefresh: false });
          if (tokenResult && tokenResult.token) {
            const tokenPrincipalId = tokenResult.principalId != null
              ? String(tokenResult.principalId).trim()
              : '';
            if (!tokenPrincipalId || tokenPrincipalId !== principalId) {
              clearCachedTokenRecord();
              throw new Error('Authentication principal mismatch');
            }
            headers.Authorization = `Bearer ${tokenResult.token}`;
            if (tokenResult.expiresAt != null || tokenResult.expirationTime) {
              setCachedTokenRecord({ id: principalId }, tokenResult);
            }
            return headers;
          }
        } else if (!requireAuth || !policy.hasConfirmedAuthSession()) {
          return headers;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, policy.AUTH_POLL_INTERVAL_MS));
      attempts++;
    }
    return headers;
  }

  function resolveStatusClass(status) {
    if (!status || status === 0) return 'none';
    if (status >= 500) return 'server';
    if (status >= 400) return 'client';
    return 'success';
  }

  function emitSafeLifecycle(onLifecycle, payload) {
    if (!onLifecycle) return;
    try {
      onLifecycle({
        phase: payload.phase,
        attempt: payload.attempt === 2 ? 2 : 1,
        retried: payload.retried === true,
        authHeaderPresent: payload.authHeaderPresent === true,
        statusClass: payload.statusClass || 'none'
      });
    } catch (e) {}
  }

  async function apiFetch(endpoint, options = {}) {
    const policy = window.LoveTreeAuthPolicy;
    const skipAuth = options.skipAuth === true || options.publicRead === true;
    const onLifecycle = typeof options.onLifecycle === 'function' ? options.onLifecycle : null;
    const fetchOptions = { ...options };
    delete fetchOptions.skipAuth;
    delete fetchOptions.publicRead;
    delete fetchOptions.onLifecycle;
    const requiresAuth = !skipAuth && policy.endpointLikelyRequiresAuth(endpoint);
    let authHeaders;
    try {
      authHeaders = await getAuthHeaders({
        forceLongWait: requiresAuth && policy.hasConfirmedAuthSession(),
        requireAuth: requiresAuth,
        skipAuth
      });
    } catch (authPrepareErr) {
      const error = new Error('Failed to prepare request authentication');
      error._phase = 'auth_prepare_failed';
      error._attempt = 1;
      error._retried = false;
      error._authHeaderPresent = false;
      emitSafeLifecycle(onLifecycle, {
        phase: 'auth_prepare_failed',
        attempt: 1,
        retried: false,
        authHeaderPresent: false,
        statusClass: 'none'
      });
      throw error;
    }
    const hadAuthHeader = !!authHeaders.Authorization;

    let attempt = 1;
    let retried = false;
    let requestAuthHeaderPresent = hadAuthHeader;

    const stripAuthorizationHeader = (headers) => {
      const safeHeaders = { ...headers };
      Object.keys(safeHeaders).forEach((key) => {
        if (key.toLowerCase() === 'authorization') {
          delete safeHeaders[key];
        }
      });
      return safeHeaders;
    };

    const buildConfig = (baseHeaders) => {
      const headers = {
        ...baseHeaders,
        ...fetchOptions.headers
      };
      return {
        ...fetchOptions,
        headers: skipAuth ? stripAuthorizationHeader(headers) : headers
      };
    };

    let config = buildConfig(authHeaders);
    let response;
    try {
      response = await fetch(`/api${endpoint}`, config);
    } catch (fetchErr) {
      const error = new Error(fetchErr && fetchErr.message ? fetchErr.message : 'Network request failed');
      error._phase = 'fetch_rejected';
      error._attempt = attempt;
      error._retried = retried;
      error._authHeaderPresent = requestAuthHeaderPresent;
      emitSafeLifecycle(onLifecycle, {
        phase: 'fetch_rejected',
        attempt: attempt,
        retried: retried,
        authHeaderPresent: requestAuthHeaderPresent,
        statusClass: 'none'
      });
      throw error;
    }

    if (
      (response.status === 401 || response.status === 403) &&
      !hadAuthHeader &&
      requiresAuth &&
      policy.hasConfirmedAuthSession()
    ) {
      await waitForAuthToken(Math.min(1200, policy.AUTH_WAIT_MS));
      let retryHeaders;
      try {
        retryHeaders = await getAuthHeaders({ forceLongWait: true, requireAuth: true });
      } catch (retryAuthPrepareErr) {
        const error = new Error('Failed to prepare retry authentication');
        error._phase = 'auth_prepare_failed';
        error._attempt = 2;
        error._retried = true;
        error._authHeaderPresent = false;
        emitSafeLifecycle(onLifecycle, {
          phase: 'auth_prepare_failed',
          attempt: 2,
          retried: true,
          authHeaderPresent: false,
          statusClass: 'none'
        });
        throw error;
      }
      if (retryHeaders.Authorization) {
        attempt = 2;
        retried = true;
        requestAuthHeaderPresent = true;
        config = buildConfig(retryHeaders);
        try {
          response = await fetch(`/api${endpoint}`, config);
        } catch (retryFetchErr) {
          const error = new Error(retryFetchErr && retryFetchErr.message ? retryFetchErr.message : 'Network request failed');
          error._phase = 'fetch_rejected';
          error._attempt = attempt;
          error._retried = retried;
          error._authHeaderPresent = requestAuthHeaderPresent;
          emitSafeLifecycle(onLifecycle, {
            phase: 'fetch_rejected',
            attempt: attempt,
            retried: retried,
            authHeaderPresent: requestAuthHeaderPresent,
            statusClass: 'none'
          });
          throw error;
        }
      }
    }

    if (!response.ok) {
      if (response.status === 401 && requiresAuth && policy.hasConfirmedAuthSession()) {
        clearConfirmedAuthState();
      }

      let errorMsg = `HTTP Error ${response.status}`;
      let errorData = null;
      try {
        errorData = await response.json();
        if (errorData) {
          errorMsg = errorData.error || errorMsg;
        }
      } catch (e) {}

      const error = new Error(errorMsg);
      error.status = response.status;
      error.statusCode = response.status;
      error._phase = 'http_error';
      error._attempt = attempt;
      error._retried = retried;
      error._authHeaderPresent = requestAuthHeaderPresent;

      if (errorData) {
        error.data = errorData;
        if (errorData.code) {
          error.code = errorData.code;
        }
      }

      emitSafeLifecycle(onLifecycle, {
        phase: 'http_error',
        attempt: attempt,
        retried: retried,
        authHeaderPresent: requestAuthHeaderPresent,
        statusClass: resolveStatusClass(response.status)
      });
      throw error;
    }

    try {
      const parsed = await response.json();
      emitSafeLifecycle(onLifecycle, {
        phase: 'response_ok',
        attempt: attempt,
        retried: retried,
        authHeaderPresent: requestAuthHeaderPresent,
        statusClass: 'success'
      });
      return parsed;
    } catch (parseErr) {
      const error = new Error('Failed to parse response');
      error.status = response.status;
      error.statusCode = response.status;
      error._phase = 'json_parse_failed';
      error._attempt = attempt;
      error._retried = retried;
      error._authHeaderPresent = requestAuthHeaderPresent;
      emitSafeLifecycle(onLifecycle, {
        phase: 'json_parse_failed',
        attempt: attempt,
        retried: retried,
        authHeaderPresent: requestAuthHeaderPresent,
        statusClass: 'success'
      });
      throw error;
    }
  }

  window.LoveTreeBaseApiFetch = {
    ERROR_PHASE: {
      AUTH_PREPARE_FAILED: 'auth_prepare_failed',
      FETCH_REJECTED: 'fetch_rejected',
      HTTP_ERROR: 'http_error',
      JSON_PARSE_FAILED: 'json_parse_failed',
    },
    getTokenStorage,
    getAuthTokenProvider,
    getCachedTokenRecord,
    setCachedTokenRecord,
    clearCachedTokenRecord,
    waitForAuthToken,
    waitForAuthBootstrapReady,
    clearConfirmedAuthState,
    getAuthHeaders,
    apiFetch,
  };
})();
