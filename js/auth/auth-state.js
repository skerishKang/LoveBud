/**
 * LoveBud auth state module
 * Keeps shared constants and lightweight state helpers.
 */
(function () {
  if (window.LoveBudAuthState) return;

  var authState = {
    EMAIL_AUTH_MODE: "login",
    AUTH_INIT_FLAG: "__lovebudAuthInitialized",
    AUTH_READY_FLAG: "__lovebudAuthReady",
    AUTH_CACHE_KEY: "lovebud_auth_cache",
    AUTH_CONFIRMED_KEY: "lovebud_auth_confirmed",
    AUTH_TOKEN_KEY: "lovebud_auth_token",
    DROPDOWN_LISTENER_ATTACHED: false,
  };

  function resolveEmailAuthMode() {
    try {
      if (
        window.__initialAuthMode === "signup" ||
        window.__initialAuthMode === "login"
      ) {
        return window.__initialAuthMode;
      }
      var params = new URLSearchParams(window.location.search);
      var mode = params.get("mode");
      return mode === "signup" ? "signup" : "login";
    } catch (e) {
      return "login";
    }
  }

  function isLoginPage() {
    var path = window.location.pathname || "";
    return (
      path.indexOf("/pages/login.html") !== -1 ||
      path.indexOf("/pages/login") !== -1 ||
      path.indexOf("login.html") !== -1
    );
  }

  function createBootstrapCompatibilityBoundary() {
    var authStateModule = window.LoveBudAuthState || null;
    var bootstrap = window.LoveBudAuthBootstrap = window.LoveBudAuthBootstrap || (function () {
      var resolved = false;
      var lastUser = null;
      var waiters = [];

      function flush(user) {
        var pending = waiters.splice(0, waiters.length);
        pending.forEach(function (fn) {
          try {
            fn(user);
          } catch (error) {
            console.error("[auth] Bootstrap waiter error:", error);
          }
        });
      }

      function resolve(user) {
        if (resolved) return;
        resolved = true;
        lastUser = user || null;
        flush(lastUser);
      }

      function whenReady() {
        if (resolved) return Promise.resolve(lastUser);
        return new Promise(function (resolveFn) {
          waiters.push(resolveFn);
        });
      }

      function getSnapshot() {
        return {
          ready: resolved,
          user: lastUser,
        };
      }

      return {
        resolve: resolve,
        whenReady: whenReady,
        getSnapshot: getSnapshot,
        getResolvedUser: function () {
          return lastUser;
        },
      };
    })();

    return {
      authStateModule: authStateModule,
      authUiModule: window.LoveBudAuthUI || null,
      authSessionModule: window.LoveBudAuthSession || null,
      authFirebaseModule: window.LoveBudAuthFirebase || null,
      emailAuthMode: authStateModule
        ? authStateModule.getEmailAuthMode()
        : resolveEmailAuthMode(),
      authInitFlag: authStateModule
        ? authStateModule.AUTH_INIT_FLAG
        : authState.AUTH_INIT_FLAG,
      authReadyFlag: authStateModule
        ? authStateModule.AUTH_READY_FLAG
        : authState.AUTH_READY_FLAG,
      dropdownListenerAttached: authStateModule
        ? authStateModule.isDropdownListenerAttached()
        : false,
      resolveAuthBootstrap: function (user) {
        bootstrap.resolve(user || null);
      },
    };
  }

  authState.EMAIL_AUTH_MODE = resolveEmailAuthMode();

  window.LoveBudAuthState = {
    AUTH_INIT_FLAG: authState.AUTH_INIT_FLAG,
    AUTH_READY_FLAG: authState.AUTH_READY_FLAG,
    AUTH_CACHE_KEY: authState.AUTH_CACHE_KEY,
    AUTH_CONFIRMED_KEY: authState.AUTH_CONFIRMED_KEY,
    AUTH_TOKEN_KEY: authState.AUTH_TOKEN_KEY,
    getEmailAuthMode: function () {
      return authState.EMAIL_AUTH_MODE;
    },
    setEmailAuthMode: function (mode) {
      authState.EMAIL_AUTH_MODE = mode === "signup" ? "signup" : "login";
      return authState.EMAIL_AUTH_MODE;
    },
    resolveEmailAuthMode: resolveEmailAuthMode,
    createBootstrapCompatibilityBoundary: createBootstrapCompatibilityBoundary,
    isLoginPage: isLoginPage,
    isDropdownListenerAttached: function () {
      return !!authState.DROPDOWN_LISTENER_ATTACHED;
    },
    setDropdownListenerAttached: function (attached) {
      authState.DROPDOWN_LISTENER_ATTACHED = !!attached;
    },
  };
})();
