(function () {
  const AUTH_TOKEN_KEY = 'lovebud_auth_token';

  function getCachedTokenRecord() {
    try {
      const raw = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!raw || raw === 'null') return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.token || !parsed.expiresAt) return null;
      if (Date.now() >= Number(parsed.expiresAt) - 30000) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setCachedTokenRecord(user, tokenResult) {
    try {
      if (!user || !user.uid || !tokenResult || !tokenResult.token) return;
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({
        uid: user.uid,
        token: tokenResult.token,
        expiresAt: new Date(tokenResult.expirationTime).getTime()
      }));
    } catch (e) {}
  }

  async function waitForAuthToken(extraMs) {
    const waitMs = Number(extraMs || 0);
    if (waitMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function getAuthHeaders(options = {}) {
    const policy = window.LoveTreeAuthPolicy;
    const headers = {
      'Content-Type': 'application/json'
    };

    const cachedToken = getCachedTokenRecord();
    if (cachedToken && cachedToken.token) {
      headers.Authorization = `Bearer ${cachedToken.token}`;
      return headers;
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
      if (window.__lovebudAuthReady && window.firebase && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user) {
          const tokenResult = typeof user.getIdTokenResult === 'function' ? await user.getIdTokenResult() : null;
          const token = tokenResult ? tokenResult.token : await user.getIdToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
            if (tokenResult) setCachedTokenRecord(user, tokenResult);
            return headers;
          }
        } else {
          return headers;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, policy.AUTH_POLL_INTERVAL_MS));
      attempts++;
    }
    return headers;
  }

  async function apiFetch(endpoint, options = {}) {
    const policy = window.LoveTreeAuthPolicy;
    const authHeaders = await getAuthHeaders();
    const hadAuthHeader = !!authHeaders.Authorization;

    const buildConfig = (baseHeaders) => ({
      ...options,
      headers: {
        ...baseHeaders,
        ...options.headers
      }
    });

    let config = buildConfig(authHeaders);
    let response = await fetch(`/api${endpoint}`, config);

    if (
      (response.status === 401 || response.status === 403) &&
      !hadAuthHeader &&
      policy.endpointLikelyRequiresAuth(endpoint) &&
      policy.hasConfirmedAuthSession()
    ) {
      await waitForAuthToken(Math.min(1200, policy.AUTH_WAIT_MS));
      const retryHeaders = await getAuthHeaders({ forceLongWait: true });
      if (retryHeaders.Authorization) {
        config = buildConfig(retryHeaders);
        response = await fetch(`/api${endpoint}`, config);
      }
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    return await response.json();
  }

  window.LoveTreeBaseApiFetch = {
    getCachedTokenRecord,
    setCachedTokenRecord,
    waitForAuthToken,
    getAuthHeaders,
    apiFetch,
  };
})();