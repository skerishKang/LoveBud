/**
 * LoveBud protected route helper
 * Provides auth-ready gating for protected pages.
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
  };
})();