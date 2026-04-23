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
    isLoginPage: isLoginPage,
    isDropdownListenerAttached: function () {
      return !!authState.DROPDOWN_LISTENER_ATTACHED;
    },
    setDropdownListenerAttached: function (attached) {
      authState.DROPDOWN_LISTENER_ATTACHED = !!attached;
    },
  };
})();
