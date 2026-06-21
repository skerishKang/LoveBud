(function () {
  if (window.LoveBudAuthFirebase) return;

  /* ── Embedded browser detection ──
     Embedded browsers (preview iframes inside the app, in-app web
     views, sandboxed WebViews) typically can't show OAuth popups —
     they fail silently with about:blank, leaving the user staring
     at a blank tab. signInWithRedirect works in those environments
     because it uses the same tab for navigation instead of spawning a
     popup window. */
  function isEmbeddedBrowser() {
    try {
      // Running inside a frame/iframe
      if (window.self !== window.top) return true;
    } catch (e) {
      // Cross-origin frame access throws; treat as embedded
      return true;
    }

    var ua = String((navigator && navigator.userAgent) || '').toLowerCase();
    // Common embedded WebView markers
    var embeddedMarkers = ['wv', 'webview', 'inapp', 'app_webview'];
    for (var i = 0; i < embeddedMarkers.length; i++) {
      if (ua.indexOf(embeddedMarkers[i]) !== -1) return true;
    }

    return false;
  }

  function getEnvironmentCheckError() {
    var protocol = window.location.protocol || '';
    if (protocol === 'file:') {
      return '이 페이지는 file:// 환경에서 열 수 없습니다. http:// 또는 https:// 환경에서 다시 시도해 주세요.';
    }

    try {
      var testKey = '__lovebud_storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
    } catch (e) {
      return '브라우저 저장소를 사용할 수 없어 로그인할 수 없습니다. 쿠키/스토리지를 허용한 뒤 다시 시도해 주세요.';
    }

    return null;
  }

  function getFriendlyErrorMessage(error, isGoogleLogin) {
    if (!error) return '알 수 없는 오류가 발생했습니다.';
    var code = error.code || '';
    var message = error.message || '';

    console.error('Auth error (developer only):', error);

    if (message.indexOf('location.protocol') !== -1 || message.indexOf('not supported in the environment') !== -1) {
      return '이 브라우저 환경에서는 로그인할 수 없습니다. http:// 또는 https:// 주소(localhost 포함)에서 다시 시도해 주세요.';
    }
    if (message.indexOf('web storage') !== -1 || message.indexOf('storage') !== -1) {
      return '브라우저 저장소(storage)가 비활성화되어 있습니다. 쿠키와 저장소를 허용한 후 다시 시도해 주세요.';
    }

    switch (code) {
      case 'auth/popup-closed-by-user':
        return null;
      case 'auth/cancelled-popup-request':
        return '로그인이 취소되었습니다.';
      case 'auth/popup-blocked':
        return '브라우저가 로그인 팝업을 차단했습니다. 팝업 허용 후 다시 시도해 주세요.';
      case 'auth/web-storage-unsupported':
        return '브라우저 저장소를 사용할 수 없어 로그인할 수 없습니다. 시크릿 모드/보안 설정을 확인해 주세요.';
      case 'auth/unauthorized-domain':
        return '현재 도메인이 Firebase 인증 허용 도메인에 등록되지 않았습니다.';
      case 'auth/account-exists-with-different-credential':
        return '이미 다른 방법으로 가입된 계정이 있습니다.';
      case 'auth/credential-already-in-use':
        return '이미 사용 중인 인증 정보입니다.';
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일 주소입니다.';
      case 'auth/user-disabled':
        return '비활성화된 계정입니다. 관리자에게 문의해 주세요.';
      case 'auth/user-not-found':
        return '가입되지 않은 이메일 주소입니다.';
      case 'auth/wrong-password':
        return '비밀번호가 올바르지 않습니다.';
      case 'auth/invalid-email':
        return '유효하지 않은 이메일 주소입니다.';
      case 'auth/operation-not-allowed':
        return '이 로그인 방법은 사용할 수 없습니다.';
      case 'auth/requires-recent-login':
        return '보안을 위해 다시 로그인해 주세요.';
      case 'auth/too-many-requests':
        return '시도 횟수 초과. 잠시 후 다시 시도해 주세요.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인해 주세요.';
      default:
        return '로그인에 실패했습니다. 다시 시도해 주세요.';
    }
  }

  function applyCachedAuthState(options) {
    var isLoginPage = options && options.isLoginPage;
    var getCachedAuthUser = options && options.getCachedAuthUser;
    var buildUserDropdown = options && options.buildUserDropdown;

    var loginPage = typeof isLoginPage === 'function' ? isLoginPage() : false;
    if (loginPage) return false;

    var authNav = document.getElementById('auth-nav');
    if (!authNav) return false;

    try {
      var cachedUser = typeof getCachedAuthUser === 'function' ? getCachedAuthUser() : null;
      if (cachedUser) {
        authNav.innerHTML = (typeof buildUserDropdown === 'function' ? buildUserDropdown(cachedUser) : '');
        authNav.style.cssText = 'pointer-events:auto;opacity:1;transition:opacity 0.2s ease;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;';
        authNav.classList.add('auth-ready');
        return true;
      }

      authNav.innerHTML = '<div class="auth-skeleton" style="width:36px;height:36px;border-radius:18px;background:var(--surface-container-highest, #e8e8e8);pointer-events:none;"></div>';
    } catch (e) {}

    return false;
  }

  function isProtectedRoute() {
    var path = window.location.pathname || '';
    return /^\/(?:pages\/)?(?:my-trees|editor|settings)(?:\.html)?$/.test(path);
  }

  function initOfflineAuth(options) {
    var markAuthReady = options && options.markAuthReady;
    var updateNavUI = options && options.updateNavUI;
    var getCachedAuthUser = options && options.getCachedAuthUser;
    var fireAuthReadyCallbacks = options && options.fireAuthReadyCallbacks;
    var resolveAuthBootstrap = options && options.resolveAuthBootstrap;

    var cachedUser = typeof getCachedAuthUser === 'function' ? getCachedAuthUser() : null;
    var user = !isProtectedRoute() && cachedUser && cachedUser.uid ? cachedUser : null;

    if (typeof markAuthReady === 'function') {
      markAuthReady();
    }
    if (typeof updateNavUI === 'function') {
      updateNavUI(user);
    }
    if (typeof resolveAuthBootstrap === 'function') {
      resolveAuthBootstrap(user);
    }
    if (typeof fireAuthReadyCallbacks === 'function') {
      fireAuthReadyCallbacks(user);
    }
  }

  async function signInWithGoogle(options) {
    var getEnvironmentCheckError = options && options.getEnvironmentCheckError;
    var isLoginPage = options && options.isLoginPage;
    var persistConfirmedAuthSession = options && options.persistConfirmedAuthSession;
    var preloadRedirectTargetData = options && options.preloadRedirectTargetData;
    var getRedirectTarget = options && options.getRedirectTarget;

    var envError = typeof getEnvironmentCheckError === 'function' ? getEnvironmentCheckError() : null;
    if (envError) {
      alert(envError);
      return;
    }

    if (!firebase.apps || !firebase.apps.length) {
      if (typeof initFirebase === 'function') initFirebase();
    }
    if (!firebase.apps || !firebase.apps.length) {
      console.error('Firebase not initialized before signInWithGoogle');
      alert('로그인 시스템을 초기화할 수 없습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    var provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) {}

    var embedded = isEmbeddedBrowser();
    var redirectTarget = typeof getRedirectTarget === 'function' ? getRedirectTarget() : 'pages/my-trees.html';

    /* Embedded browsers (preview iframes, in-app web views, sandboxed
       WebViews) cannot show OAuth popups — the popup fails silently
       and the user is left staring at about:blank. Skip the popup
       entirely on embedded environments and go straight to
       signInWithRedirect, which uses the same tab for navigation. */
    if (embedded) {
      try {
        if (typeof preloadRedirectTargetData === 'function') {
          preloadRedirectTargetData();
        }
        await firebase.auth().signInWithRedirect(provider);
        return;
      } catch (redirectError) {
        console.error('Google redirect (embedded) failed:', redirectError);
        var embeddedMessage = getFriendlyErrorMessage(redirectError, true);
        if (embeddedMessage) alert(embeddedMessage);
        return;
      }
    }

    try {
      var authResult = await firebase.auth().signInWithPopup(provider);
      var authUser = authResult && authResult.user ? authResult.user : firebase.auth().currentUser;

      if (typeof persistConfirmedAuthSession === 'function') {
        await persistConfirmedAuthSession(authUser);
      }
      if (typeof preloadRedirectTargetData === 'function') {
        preloadRedirectTargetData();
      }
      window.location.href = redirectTarget;
    } catch (error) {
      console.error('Google login failed:', error);

      // All popup errors on non-embedded pages now fall back to
      // signInWithRedirect (previously this only ran on the login page).
      var popupFallbackCodes = {
        'auth/popup-blocked': true,
        'auth/web-storage-unsupported': true,
        'auth/cancelled-popup-request': true,
        'auth/popup-closed-by-user': true,
        'auth/internal-error': true
      };

      var shouldTryRedirectFallback = popupFallbackCodes[error && error.code];

      if (shouldTryRedirectFallback) {
        try {
          if (typeof preloadRedirectTargetData === 'function') {
            preloadRedirectTargetData();
          }
          await firebase.auth().signInWithRedirect(provider);
          return;
        } catch (redirectError) {
          console.error('Google redirect fallback failed:', redirectError);
          var redirectMessage = getFriendlyErrorMessage(redirectError, true);
          if (redirectMessage) alert(redirectMessage);
          return;
        }
      }

      var friendlyMessage = getFriendlyErrorMessage(error, true);
      if (friendlyMessage) alert(friendlyMessage);
    }
  }

  function clearAuthDependentCaches(options) {
    var clearFirebaseState = !!(options && options.clearFirebaseState);
    var clearStaleFirebaseAuthState = options && options.clearStaleFirebaseAuthState;
    var clearConfirmedAuthCache = options && options.clearConfirmedAuthCache;

    if (clearFirebaseState) {
      try {
        if (typeof clearStaleFirebaseAuthState === 'function') {
          clearStaleFirebaseAuthState();
        }
      } catch (e) {}
    }

    try {
      localStorage.removeItem('isLoggedIn');
    } catch (e) {}

    try {
      if (window.clearPrivateCaches) {
        window.clearPrivateCaches();
      }
    } catch (e) {}

    try {
      if (window.apiClient && typeof window.apiClient.clearCommunityCaches === 'function') {
        window.apiClient.clearCommunityCaches();
      }
    } catch (e) {}

    try {
      if (typeof clearConfirmedAuthCache === 'function') {
        clearConfirmedAuthCache();
      }
    } catch (e) {}
  }

  async function signOut(options) {
    var clearStaleFirebaseAuthState = options && options.clearStaleFirebaseAuthState;
    var clearConfirmedAuthCache = options && options.clearConfirmedAuthCache;

    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        await firebase.auth().signOut();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }

    clearAuthDependentCaches({
      clearFirebaseState: true,
      clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
      clearConfirmedAuthCache: clearConfirmedAuthCache
    });

    window.location.reload();
  }

  function createProtectedRouteBridge(options) {
    options = options || {};

    return {
      applyCachedAuthState: function () {
        return applyCachedAuthState({
          isLoginPage: options.isLoginPage,
          getCachedAuthUser: options.getCachedAuthUser,
          buildUserDropdown: options.buildUserDropdown
        });
      },
      initAuth: function () {
        initAuth({
          resolveEmailAuthMode: options.resolveEmailAuthMode,
          setupLoginPageAuthUi: options.setupLoginPageAuthUi,
          applyCachedAuthState: options.applyCachedAuthState,
          markAuthLoading: options.markAuthLoading,
          markAuthReady: options.markAuthReady,
          initOfflineAuth: options.initOfflineAuth,
          attachDropdownListener: options.attachDropdownListener,
          persistConfirmedAuthSession: options.persistConfirmedAuthSession,
          updateNavUI: options.updateNavUI,
          fireAuthReadyCallbacks: options.fireAuthReadyCallbacks,
          resolveAuthBootstrap: options.resolveAuthBootstrap,
          isInvalidAuthSessionError: options.isInvalidAuthSessionError,
          clearStaleFirebaseAuthState: options.clearStaleFirebaseAuthState,
          clearConfirmedAuthCache: options.clearConfirmedAuthCache,
          setupGoogleBtn: options.setupGoogleBtn,
          setupEmailAuthForm: options.setupEmailAuthForm,
          setupSignupForm: options.setupSignupForm,
          setupSignupGoogleBtn: options.setupSignupGoogleBtn,
          authInitFlag: options.authInitFlag,
          authReadyFlag: options.authReadyFlag,
          isLoginPage: options.isLoginPage,
          getRedirectTarget: options.getRedirectTarget
        });
      },
      initOfflineAuth: function () {
        initOfflineAuth({
          markAuthReady: options.markAuthReady,
          updateNavUI: options.updateNavUI,
          getCachedAuthUser: options.getCachedAuthUser,
          resolveAuthBootstrap: options.resolveAuthBootstrap,
          fireAuthReadyCallbacks: options.fireAuthReadyCallbacks
        });
      },
      getEnvironmentCheckError: getEnvironmentCheckError,
      getFriendlyErrorMessage: getFriendlyErrorMessage,
      signInWithGoogle: function () {
        return signInWithGoogle({
          getEnvironmentCheckError: options.getEnvironmentCheckError,
          isLoginPage: options.isLoginPage,
          persistConfirmedAuthSession: options.persistConfirmedAuthSession,
          preloadRedirectTargetData: options.preloadRedirectTargetData,
          getRedirectTarget: options.getRedirectTarget
        });
      },
      signOut: function () {
        return signOut({
          clearStaleFirebaseAuthState: options.clearStaleFirebaseAuthState,
          clearConfirmedAuthCache: options.clearConfirmedAuthCache
        });
      }
    };
  }

  function initAuth(options) {
    var resolveEmailAuthMode = options && options.resolveEmailAuthMode;
    var setupLoginPageAuthUi = options && options.setupLoginPageAuthUi;
    var applyCachedAuthStateFn = options && options.applyCachedAuthState;
    var markAuthLoading = options && options.markAuthLoading;
    var markAuthReady = options && options.markAuthReady;
    var initOfflineAuthFn = options && options.initOfflineAuth;
    var attachDropdownListener = options && options.attachDropdownListener;
    var persistConfirmedAuthSession = options && options.persistConfirmedAuthSession;
    var updateNavUI = options && options.updateNavUI;
    var fireAuthReadyCallbacks = options && options.fireAuthReadyCallbacks;
    var resolveAuthBootstrap = options && options.resolveAuthBootstrap;
    var isInvalidAuthSessionError = options && options.isInvalidAuthSessionError;
    var clearStaleFirebaseAuthState = options && options.clearStaleFirebaseAuthState;
    var clearConfirmedAuthCache = options && options.clearConfirmedAuthCache;
    var setupGoogleBtn = options && options.setupGoogleBtn;
    var setupEmailAuthForm = options && options.setupEmailAuthForm;
    var setupSignupForm = options && options.setupSignupForm;
    var setupSignupGoogleBtn = options && options.setupSignupGoogleBtn;
    var authInitFlag = options && options.authInitFlag;
    var authReadyFlag = options && options.authReadyFlag;
    var isLoginPage = options && options.isLoginPage;
    var getRedirectTarget = options && options.getRedirectTarget;

    if (typeof resolveEmailAuthMode === 'function') {
      window.EMAIL_AUTH_MODE = resolveEmailAuthMode();
    }
    if (typeof setupLoginPageAuthUi === 'function') {
      setupLoginPageAuthUi();
    }

    var hasImmediateAuthUI = typeof applyCachedAuthStateFn === 'function'
      ? applyCachedAuthStateFn()
      : false;

    if (authReadyFlag) {
      window[authReadyFlag] = !!hasImmediateAuthUI;
    }

    if (!hasImmediateAuthUI && typeof markAuthLoading === 'function') {
      markAuthLoading();
    }

    var AUTH_WAIT_MS =
      typeof window.__LOVEBUD_AUTH_WAIT_MS === 'number' &&
      window.__LOVEBUD_AUTH_WAIT_MS > 0
        ? window.__LOVEBUD_AUTH_WAIT_MS
        : 8000;

    var authTimeout = setTimeout(function() {
      if (!authReadyFlag || !window[authReadyFlag]) {
        console.warn('[auth] Firebase auth timeout (' + AUTH_WAIT_MS + 'ms) - switching to offline mode');
        if (typeof initOfflineAuthFn === 'function') {
          initOfflineAuthFn();
        }
      }
    }, AUTH_WAIT_MS);

    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded. Auth running in offline mode.');
      clearTimeout(authTimeout);
      if (typeof initOfflineAuthFn === 'function') initOfflineAuthFn();
      return;
    }

    if (typeof initFirebase === 'function') initFirebase();

    if (!firebase.apps || !firebase.apps.length) {
      console.error('Firebase not initialized. Auth setup aborted.');
      clearTimeout(authTimeout);
      if (typeof initOfflineAuthFn === 'function') initOfflineAuthFn();
      return;
    }

    if (authInitFlag && window[authInitFlag]) {
      clearTimeout(authTimeout);
      return;
    }
    if (authInitFlag) {
      window[authInitFlag] = true;
    }

    if (typeof attachDropdownListener === 'function') {
      attachDropdownListener();
    }

    /* Handle the redirect callback from signInWithRedirect.
       Firebase delivers the auth state via onAuthStateChanged after the
       redirect completes, but getRedirectResult() surfaces any error
       that occurred during the redirect flow (e.g. auth/internal-error,
       auth/network-request-failed). Without this call the user sees the
       redirect succeed but no session, with no error message. */
    if (typeof firebase.auth().getRedirectResult === 'function') {
      firebase.auth().getRedirectResult().then(function(result) {
        if (result && result.user) {
          if (typeof persistConfirmedAuthSession === 'function') {
            persistConfirmedAuthSession(result.user).catch(function() {});
          }
          var redirectDest = typeof getRedirectTarget === 'function'
            ? getRedirectTarget()
            : 'pages/my-trees.html';
          if (typeof isLoginPage === 'function' && isLoginPage()) {
            window.location.replace(redirectDest);
          }
        }
      }).catch(function(redirectError) {
        if (redirectError && redirectError.code !== 'auth/no-auth-event') {
          console.warn('Google redirect result error:', redirectError);
          var friendly = typeof getFriendlyErrorMessage === 'function'
            ? getFriendlyErrorMessage(redirectError, true)
            : null;
          if (friendly) {
            try { alert(friendly); } catch (e) {}
          }
        }
      });
    }

    firebase.auth().onAuthStateChanged(async function(user) {
      clearTimeout(authTimeout);

      if (user) {
        try {
          if (typeof user.reload === 'function') await user.reload();
        } catch (error) {
          if (typeof isInvalidAuthSessionError === 'function' && isInvalidAuthSessionError(error)) {
            console.warn('Invalid Firebase session detected. Signing out.');
            await firebase.auth().signOut().catch(function() {});
            clearAuthDependentCaches({
              clearFirebaseState: true,
              clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
              clearConfirmedAuthCache: clearConfirmedAuthCache
            });
            if (typeof resolveAuthBootstrap === 'function') {
              resolveAuthBootstrap(null);
            }
            return;
          }
        }
      } else {
        clearAuthDependentCaches({
          clearConfirmedAuthCache: clearConfirmedAuthCache
        });
      }

      if (typeof persistConfirmedAuthSession === 'function') {
        await persistConfirmedAuthSession(user);
      }
      if (typeof markAuthReady === 'function') {
        markAuthReady();
      }
      if (typeof updateNavUI === 'function') {
        updateNavUI(user);
      }
      if (typeof resolveAuthBootstrap === 'function') {
        resolveAuthBootstrap(user);
      }
      if (typeof fireAuthReadyCallbacks === 'function') {
        fireAuthReadyCallbacks(user);
      }
      if (user && typeof isLoginPage === 'function' && isLoginPage()) {
        window.location.replace(typeof getRedirectTarget === 'function' ? getRedirectTarget() : 'my-trees.html');
      }
    });

    if (typeof setupGoogleBtn === 'function') setupGoogleBtn();
    if (typeof setupEmailAuthForm === 'function') setupEmailAuthForm();
    if (typeof setupSignupForm === 'function') setupSignupForm();
    if (typeof setupSignupGoogleBtn === 'function') setupSignupGoogleBtn();
  }

  window.LoveBudAuthFirebase = {
    getEnvironmentCheckError: getEnvironmentCheckError,
    getFriendlyErrorMessage: getFriendlyErrorMessage,
    applyCachedAuthState: applyCachedAuthState,
    initOfflineAuth: initOfflineAuth,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    initAuth: initAuth,
    createProtectedRouteBridge: createProtectedRouteBridge
  };
})();
