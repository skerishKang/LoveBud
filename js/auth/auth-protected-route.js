/**
 * LoveBud protected route helper
 * Provides auth-ready gating for protected pages.
 *
 * Central auth state manager - single source of truth for auth state.
 *
 * Keeps existing global contracts:
 * - window.registerOnAuthReady
 * - window.__lovebudAuthReady
 * - window.LoveBudAuth*
 */
(function () {
  if (window.LoveBudProtectedRoute) return;

  var DEFAULT_REDIRECT = './login.html';

  /**
   * Central auth state - single source of truth
   */
  var authState = {
    user: null,
    ready: false
  };

  var authSubscribers = [];

  /**
   * Get current auth state
   */
  function getAuthState() {
    return {
      user: authState.user,
      ready: authState.ready
    };
  }

  /**
   * Subscribe to auth state changes
   * Returns unsubscribe function
   */
  function subscribeAuth(callback) {
    if (typeof callback !== 'function') return function() {};
    authSubscribers.push(callback);
    callback(getAuthState());
    return function() {
      var idx = authSubscribers.indexOf(callback);
      if (idx > -1) authSubscribers.splice(idx, 1);
    };
  }

  /**
   * Notify all subscribers of auth state change
   */
  function notifyAuthSubscribers() {
    var state = getAuthState();
    authSubscribers.forEach(function(cb) {
      try {
        cb(state);
      } catch (e) {
        console.error('[protected-route] subscriber error:', e);
      }
    });
  }

  /**
   * Set auth state - central method
   */
  function setAuthState(ready, user) {
    authState.ready = ready;
    authState.user = user;
    window.__lovebudAuthReady = ready;
    window.__lastAuthUser = user;
    notifyAuthSubscribers();
  }

  /**
   * Initialize central auth state from existing globals
   */
function initCentralAuthState() {
    // Use the existing __lovebudAuthReady and __lastAuthUser first
    if (window.__lovebudAuthReady === true) {
      setAuthState(true, window.__lastAuthUser || null);
      return;
    }
    // Try Firebase directly as fallback
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        var currentUser = firebase.auth().currentUser;
        if (currentUser) {
          setAuthState(true, currentUser);
          return;
        }
      }
    } catch (e) {}
    setAuthState(false, null);
  }

  // Set up single onAuthStateChanged subscription if available
  if (typeof window.LoveBudAuthFirebase !== 'undefined' &&
      window.LoveBudAuthFirebase &&
      typeof window.LoveBudAuthFirebase.onAuthStateChanged === 'function') {
    window.LoveBudAuthFirebase.onAuthStateChanged(function(user) {
      setAuthState(true, user || null);
    });
  } else if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
      if (typeof firebase.auth().onAuthStateChanged === 'function') {
        firebase.auth().onAuthStateChanged(function(user) {
          setAuthState(true, user || null);
        });
      }
    } catch (e) {}
  }

  // Initialize from existing globals
  initCentralAuthState();

  /**


  /**
   * Wait for auth to be confirmed ready.
   * Returns Promise that resolves when auth is ready.
   */
  function waitForAuthReady() {
    return new Promise(function (resolve) {
      if (window.__lovebudAuthReady === true) {
        resolve(window.__lastAuthUser || null);
        return;
      }
      if (typeof window.registerOnAuthReady === 'function') {
        window.registerOnAuthReady(function (user) {
          resolve(user || null);
        });
        return;
      }
      if (typeof window.onAuthReady === 'function') {
        window.onAuthReady(function (user) {
          resolve(user || null);
        });
        return;
      }
      resolve(null);
    });
  }

  /**
   * Check if user is authenticated.
   * Returns user object or null.
   */
  function getAuthenticatedUser() {
    try {
      if (window.getConfirmedAuthUser) {
        return window.getConfirmedAuthUser();
      }
      if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
        var raw = localStorage.getItem('lovebud_auth_cache');
        if (raw && raw !== 'null') {
          return JSON.parse(raw);
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Check if auth is ready/confirmed.
   */
  function isAuthReady() {
    return window.__lovebudAuthReady === true;
  }

  /**
   * Redirect to login page with optional returnTo.
   */
  function redirectToLogin(redirectTo) {
    var target = redirectTo || DEFAULT_REDIRECT;
    var returnTo = target;
    try {
      var currentPath = window.location.pathname + window.location.search + window.location.hash;
      if (currentPath.indexOf('/pages/login') === -1 && currentPath.indexOf('login.html') === -1) {
        var separator = target.indexOf('?') === -1 ? '?' : '&';
        target = target + separator + 'returnTo=' + encodeURIComponent(currentPath);
      }
    } catch (e) {}
    window.location.href = target;
  }

  /**
   * Require authenticated page.
   * Options:
   *   - onAuthenticated(user): callback when auth is ready and user is logged in
   *   - onUnauthenticated(): callback when auth is ready but user is NOT logged in
   *   - redirectTo: login redirect path (default: ./login.html)
   *   - returnTo: return URL after login
   *   - allowCachedUser: if true, allow using cached user before auth is fully ready
   */
  function requireAuthenticatedPage(options) {
    options = options || {};
    var onAuthenticated = options.onAuthenticated;
    var onUnauthenticated = options.onUnauthenticated;
    var redirectTo = options.redirectTo || DEFAULT_REDIRECT;
    var returnTo = options.returnTo;
    var allowCachedUser = options.allowCachedUser !== false;

    function handleReady(user) {
      if (user && user.uid) {
        if (typeof onAuthenticated === 'function') {
          onAuthenticated(user);
        }
      } else {
        if (typeof onUnauthenticated === 'function') {
          onUnauthenticated();
        } else {
          redirectToLogin(redirectTo + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : ''));
        }
      }
    }

    if (isAuthReady()) {
      var user = allowCachedUser ? (getAuthenticatedUser() || window.__lastAuthUser) : window.__lastAuthUser;
      handleReady(user);
      return;
    }

    waitForAuthReady().then(function (user) {
      handleReady(user);
    });
  }

  /**
   * Check if current user is logged in.
   * Use this for quick UI checks, not for gating.
   */
  function isLoggedIn() {
    var user = getAuthenticatedUser();
    return !!(user && user.uid);
  }

  window.LoveBudProtectedRoute = {
    waitForAuthReady: waitForAuthReady,
    getAuthenticatedUser: getAuthenticatedUser,
    isAuthReady: isAuthReady,
    isLoggedIn: isLoggedIn,
    redirectToLogin: redirectToLogin,
    requireAuthenticatedPage: requireAuthenticatedPage,
    getAuthState: getAuthState,
    subscribeAuth: subscribeAuth,
    setAuthState: setAuthState,
    initCentralAuthState: initCentralAuthState,
  };
})();