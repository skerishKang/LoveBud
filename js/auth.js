/**
 * LoveBud - Authentication Module (Firebase Auth)
 * v20260422-3
 *
 * Auth state observer updates #auth-nav (non-login pages) or
 * #auth-nav-container (login.html) using innerHTML container pattern.
 *
 * Loading state: show confirmed cached auth UI immediately when available,
 * otherwise fall back to a neutral skeleton until Firebase confirms auth.
 *
 * Version: ?v=20260422-3
 */

var __authBootstrapCompat = window.LoveBudAuthState &&
  typeof window.LoveBudAuthState.createBootstrapCompatibilityBoundary === 'function'
  ? window.LoveBudAuthState.createBootstrapCompatibilityBoundary()
  : null;
var __authStateModule = __authBootstrapCompat
  ? __authBootstrapCompat.authStateModule
  : (window.LoveBudAuthState || null);
var __authUiModule = __authBootstrapCompat
  ? __authBootstrapCompat.authUiModule
  : (window.LoveBudAuthUI || null);
var __authUiTemplates = window.LoveBudAuthUiTemplates || null;
var __authSessionModule = __authBootstrapCompat
  ? __authBootstrapCompat.authSessionModule
  : (window.LoveBudAuthSession || null);
var __authFirebaseModule = __authBootstrapCompat
  ? __authBootstrapCompat.authFirebaseModule
  : (window.LoveBudAuthFirebase || null);
var EMAIL_AUTH_MODE = __authBootstrapCompat
  ? __authBootstrapCompat.emailAuthMode
  : (__authStateModule
      ? __authStateModule.getEmailAuthMode()
      : (function() {
          try {
            if (window.__initialAuthMode === 'signup' || window.__initialAuthMode === 'login') {
              return window.__initialAuthMode;
            }
            var params = new URLSearchParams(window.location.search);
            var mode = params.get('mode');
            return mode === 'signup' ? 'signup' : 'login';
          } catch (e) {
            return 'login';
          }
        })());
var AUTH_INIT_FLAG = __authBootstrapCompat
  ? __authBootstrapCompat.authInitFlag
  : (__authStateModule ? __authStateModule.AUTH_INIT_FLAG : '__lovebudAuthInitialized');
var AUTH_READY_FLAG = __authBootstrapCompat
  ? __authBootstrapCompat.authReadyFlag
  : (__authStateModule ? __authStateModule.AUTH_READY_FLAG : '__lovebudAuthReady');
var DROPDOWN_LISTENER_ATTACHED = __authBootstrapCompat
  ? __authBootstrapCompat.dropdownListenerAttached
  : (__authStateModule ? __authStateModule.isDropdownListenerAttached() : false);

function resolveAuthBootstrap(user) {
  if (__authBootstrapCompat && typeof __authBootstrapCompat.resolveAuthBootstrap === 'function') {
    __authBootstrapCompat.resolveAuthBootstrap(user);
    return;
  }
  if (!window.LoveBudAuthBootstrap || typeof window.LoveBudAuthBootstrap.resolve !== 'function') {
    return;
  }
  window.LoveBudAuthBootstrap.resolve(user || null);
}

// 인증 캐시 키 정책:
// - lovebud_auth_cache: {uid, displayName, email} - 사용자 기본 정보 (로그아웃 시 삭제)
// - lovebud_auth_confirmed: 'true' 문자열 - 인증 확인 플래그 (로그아웃 시 삭제)
// - lovebud_auth_token: {uid, token, expiresAt} - Firebase ID 토큰 (로그아웃 시 삭제)
// TTL: 토큰은 Firebase 기본 1시간, 캐시는 명시적 로그아웃 전까지 유지
var AUTH_CACHE_KEY = __authStateModule ? __authStateModule.AUTH_CACHE_KEY : 'lovebud_auth_cache';
var AUTH_CONFIRMED_KEY = __authStateModule ? __authStateModule.AUTH_CONFIRMED_KEY : 'lovebud_auth_confirmed';
var AUTH_TOKEN_KEY = __authStateModule ? __authStateModule.AUTH_TOKEN_KEY : 'lovebud_auth_token';

function isLoginPage() {
  if (__authStateModule) return __authStateModule.isLoginPage();
  var path = window.location.pathname || '';
  return path.indexOf('/pages/login.html') !== -1 ||
         path.indexOf('/pages/login') !== -1 ||
         path.indexOf('login.html') !== -1;
}

function resolveEmailAuthMode() {
  if (__authStateModule) return __authStateModule.resolveEmailAuthMode();
  try {
    if (window.__initialAuthMode === 'signup' || window.__initialAuthMode === 'login') {
      return window.__initialAuthMode;
    }
    var params = new URLSearchParams(window.location.search);
    var mode = params.get('mode');
    return mode === 'signup' ? 'signup' : 'login';
  } catch (e) {
    return 'login';
  }
}

function callLoginPageModule(methodName, args) {
  if (
    window.LoveBudAuthLoginPage &&
    typeof window.LoveBudAuthLoginPage.callLoginPageModule === 'function'
  ) {
    return window.LoveBudAuthLoginPage.callLoginPageModule(methodName, args);
  }
  return false;
}

function setEmailAuthMode(emailAuthMode) {
  EMAIL_AUTH_MODE = emailAuthMode === 'signup' ? 'signup' : 'login';
  if (__authStateModule) __authStateModule.setEmailAuthMode(EMAIL_AUTH_MODE);
}

function syncEmailAuthModeUi(options) {
  if (callLoginPageModule('syncEmailAuthModeUi', [{
    emailAuthMode: EMAIL_AUTH_MODE,
    titleEl: options && options.titleEl,
    helperEl: options && options.helperEl,
    submitBtn: options && options.submitBtn,
    toggleBtn: options && options.toggleBtn,
    badgeEl: options && options.badgeEl,
    applyI18n: window.applyI18n
  }])) {
    return;
  }

  var titleEl = options && options.titleEl;
  var helperEl = options && options.helperEl;
  var submitBtn = options && options.submitBtn;
  var toggleBtn = options && options.toggleBtn;
  var badgeEl = options && options.badgeEl;

  var isSignup = EMAIL_AUTH_MODE === 'signup';

  if (badgeEl) {
    badgeEl.textContent = isSignup ? '회원가입' : '로그인';
    badgeEl.style.background = isSignup ? 'var(--secondary)' : 'var(--primary)';
  }

  if (titleEl) {
    titleEl.textContent = isSignup ? '이메일로 회원가입' : '이메일로 로그인';
    titleEl.setAttribute('data-i18n', isSignup ? 'email_modal_title_signup' : 'email_modal_title_login');
  }

  if (helperEl) {
    helperEl.textContent = isSignup
      ? '새 이메일 계정을 만들고 로그인합니다.'
      : '이미 만든 이메일 계정으로 로그인합니다.';
    helperEl.setAttribute('data-i18n', isSignup ? 'email_modal_desc_signup' : 'email_modal_desc_login');
  }

  if (submitBtn) {
    submitBtn.textContent = isSignup ? '회원가입' : '로그인';
    submitBtn.setAttribute('data-i18n', isSignup ? 'signup_btn' : 'login_btn');
  }

  if (toggleBtn) {
    toggleBtn.textContent = isSignup
      ? '이미 계정이 있나요? 로그인으로 전환'
      : '계정이 없나요? 회원가입으로 전환';
    toggleBtn.setAttribute('data-i18n', isSignup ? 'switch_to_login' : 'switch_to_signup');
  }

  if (window.applyI18n) {
    window.applyI18n();
  }
}

function setupLoginPageAuthUi() {
  callLoginPageModule('setupLoginPageAuthUi', [{
    isLoginPage: isLoginPage,
    resolveEmailAuthMode: resolveEmailAuthMode,
    setEmailAuthMode: setEmailAuthMode,
    syncEmailAuthModeUi: syncEmailAuthModeUi
  }]);
}

// ── Auth Ready Callbacks (배열 패턴) ─────────────────────────────────────────
// 여러 모듈이 등록해도 덮어쓰기 문제 없음
var __authCallbacksModule = window.LoveBudAuthCallbacks || null;
var __authReadyCallbackBridge = __authCallbacksModule.createAuthReadyCallbackBridge({
  authReadyFlagKey: AUTH_READY_FLAG
});

/**
 * 인증 준비 후 실행할 콜백 등록
 * @param {Function} callback - user 객체를 받는 콜백 함수
 */
window.registerOnAuthReady = function(callback) {
  __authReadyCallbackBridge.registerOnAuthReady(callback);
};

/**
 * 모든 등록된 콜백 실행 (auth.js 내부 사용)
 */
function fireAuthReadyCallbacks(user) {
  __authReadyCallbackBridge.fireAuthReadyCallbacks(user);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
var __authCacheModule = window.LoveBudAuthCache || null;
var __authCacheBridge = __authCacheModule &&
  typeof __authCacheModule.createConfirmedAuthCacheBridge === 'function'
  ? __authCacheModule.createConfirmedAuthCacheBridge({
      cacheKey: AUTH_CACHE_KEY,
      confirmedKey: AUTH_CONFIRMED_KEY,
      tokenKey: AUTH_TOKEN_KEY
    })
  : null;

function isInvalidAuthSessionError(error) { return __authCacheBridge.isInvalidAuthSessionError(error); }
function clearStaleFirebaseAuthState() { __authCacheBridge.clearStaleFirebaseAuthState(); }
function getCachedAuthUser() { return __authCacheBridge.getCachedAuthUser(); }
function setConfirmedAuthCache(user) { __authCacheBridge.setConfirmedAuthCache(user); }
function clearConfirmedAuthCache() { __authCacheBridge.clearConfirmedAuthCache(); }
function getCachedAuthToken() { return __authCacheBridge.getCachedAuthToken(); }
async function persistConfirmedAuthSession(user) { await __authCacheBridge.persistConfirmedAuthSession(user); }

var __authProtectedRouteBridge = __authFirebaseModule &&
  typeof __authFirebaseModule.createProtectedRouteBridge === 'function'
  ? __authFirebaseModule.createProtectedRouteBridge({
      resolveEmailAuthMode: resolveEmailAuthMode,
      setupLoginPageAuthUi: setupLoginPageAuthUi,
      applyCachedAuthState: applyCachedAuthState,
      markAuthLoading: markAuthLoading,
      markAuthReady: markAuthReady,
      initOfflineAuth: initOfflineAuth,
      attachDropdownListener: attachDropdownListener,
      persistConfirmedAuthSession: persistConfirmedAuthSession,
      updateNavUI: updateNavUI,
      fireAuthReadyCallbacks: fireAuthReadyCallbacks,
      resolveAuthBootstrap: resolveAuthBootstrap,
      isInvalidAuthSessionError: isInvalidAuthSessionError,
      clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
      clearConfirmedAuthCache: clearConfirmedAuthCache,
      setupGoogleBtn: setupGoogleBtn,
      setupEmailAuthForm: setupEmailAuthForm,
      setupSignupForm: setupSignupForm,
      setupSignupGoogleBtn: setupSignupGoogleBtn,
      authInitFlag: AUTH_INIT_FLAG,
      authReadyFlag: AUTH_READY_FLAG,
      isLoginPage: isLoginPage,
      getCachedAuthUser: getCachedAuthUser,
      buildUserDropdown: buildUserDropdown,
      getEnvironmentCheckError: getEnvironmentCheckError,
      preloadRedirectTargetData: preloadRedirectTargetData,
      getRedirectTarget: getRedirectTarget
    })
  : null;

// ── Preload redirect target data after login ────────────────────────────────────
function preloadRedirectTargetData() {
  if (__authSessionModule) {
    __authSessionModule.preloadRedirectTargetData({
      getRedirectTarget: getRedirectTarget,
      apiClient: window.apiClient,
      logger: console
    });
    return;
  }
  // Fire-and-forget: 로그인 직후 redirect 대상에 필요한 데이터 preload
  var redirectTarget = getRedirectTarget();
  var isEditorTarget = redirectTarget.indexOf('editor.html') !== -1;
  var isMyTreesTarget = redirectTarget.indexOf('my-trees.html') !== -1;

  try {
    // 1. my-trees 또는 editor 모두에 필요한 trees 목록 preload
    if (window.apiClient && window.apiClient.getTrees) {
      window.apiClient.getTrees().then(function(trees) {
        if (trees && trees.length > 0) {
          localStorage.setItem('lovebud_trees_cache', JSON.stringify({
            data: trees,
            timestamp: Date.now()
          }));
          console.log('[auth] Preloaded my-trees cache:', trees.length, 'trees');

          // 2. editor 진입 시 첫 번째 트리 상세도 preload
          if ((isEditorTarget || isMyTreesTarget) && trees[0]) {
            var firstTreeId = trees[0].id || trees[0];
            if (firstTreeId) {
              Promise.all([
                window.apiClient.getTree ? window.apiClient.getTree(firstTreeId).catch(function() {}) : Promise.resolve(),
                window.apiClient.getMemoriesByTree ? window.apiClient.getMemoriesByTree(firstTreeId).catch(function() {}) : Promise.resolve()
              ]).then(function(results) {
                var treeDetail = results[0];
                var memories = results[1];
                if (treeDetail) {
                  localStorage.setItem('tree_detail_' + firstTreeId, JSON.stringify({
                    data: treeDetail,
                    timestamp: Date.now()
                  }));
                }
                if (memories && Array.isArray(memories)) {
                  localStorage.setItem('tree_memories_' + firstTreeId, JSON.stringify({
                    data: memories,
                    timestamp: Date.now()
                  }));
                }
                console.log('[auth] Preloaded first tree detail for editor:', firstTreeId, 'memories:', memories ? memories.length : 0);
              }).catch(function(err) {
                console.warn('[auth] Preload first tree detail failed:', err.message);
              });
            }
          }
        }
      }).catch(function(err) {
        // preload 실패는 무시 (console만)
        console.warn('[auth] Preload trees cache failed:', err.message);
      });
    }
  } catch (e) {
    console.warn('[auth] Preload redirect target data error:', e);
  }
}

function applyCachedAuthState() {
  if (__authProtectedRouteBridge) {
    return __authProtectedRouteBridge.applyCachedAuthState();
  }
  return false;
}

function initAuth() {
  if (__authProtectedRouteBridge) {
    __authProtectedRouteBridge.initAuth();
    return;
  }
  console.warn('Auth Firebase boundary not loaded. Auth running in offline mode.');
  initOfflineAuth();
}

function initOfflineAuth() {
  if (__authProtectedRouteBridge) {
    __authProtectedRouteBridge.initOfflineAuth();
    return;
  }
  markAuthReady();
  updateNavUI(null);
  resolveAuthBootstrap(null);
  fireAuthReadyCallbacks(null);
}

function markAuthLoading() {
  if (__authUiModule) {
    __authUiModule.markAuthLoading();
    return;
  }
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  var loadingStyle = 'pointer-events:none;opacity:0.6;transition:opacity 0.2s ease;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:none;';
  if (authNav) {
    authNav.style.cssText = loadingStyle;
  }
  if (authContainer) {
    authContainer.style.cssText = loadingStyle;
  }
}

function markAuthReady() {
  if (__authUiModule) {
    __authUiModule.markAuthReady(AUTH_READY_FLAG);
    return;
  }
  window[AUTH_READY_FLAG] = true;
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  // Ready 후: 스피너 제거 + pointer-events 복원 + 부드럽게 표시
  var visibleStyle = 'pointer-events:auto;opacity:1;transition:opacity 0.2s ease;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;';
  if (authNav) {
    // 로딩 스피너 제거 (index.html의 초기 스피너)
    var spinner = authNav.querySelector('.material-symbols-outlined');
    if (spinner && spinner.textContent === 'progress_activity') {
      spinner.remove();
    }
    authNav.style.cssText = visibleStyle;
    authNav.classList.add('auth-ready');
  }
  if (authContainer) {
    var spinner = authContainer.querySelector('.material-symbols-outlined');
    if (spinner && spinner.textContent === 'progress_activity') {
      spinner.remove();
    }
    authContainer.style.cssText = visibleStyle;
    authContainer.classList.add('auth-ready');
  }
}

// ── UI Builders ───────────────────────────────────────────────────────────────

function getBasePath() {
  if (__authUiModule) return __authUiModule.getBasePath();
  if (__authUiTemplates) return __authUiTemplates.getBasePath();
  var path = window.location.pathname;
  var isPagesContext = path.indexOf('/pages/') !== -1;
  return isPagesContext ? '' : 'pages/';
}

// 전역으로 노출
window.getBasePath = getBasePath;

function escapeHtml(value) {
  var sec = window.LoveBudSecurity;
  if (sec) return sec.escapeHtml(value);
  if (__authUiModule) return __authUiModule.escapeHtml(value);
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLoginButton() {
  if (__authUiModule) return __authUiModule.buildLoginButton();
  if (__authUiTemplates) return __authUiTemplates.buildLoginButton();
  return '<a href="' + (getBasePath() + 'login.html') + '" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>';
}

function getUserAvatarInitial(user) {
  if (__authUiModule) return __authUiModule.getUserAvatarInitial(user);
  if (__authUiTemplates) return __authUiTemplates.getUserAvatarInitial(user);
  var src = String(user ? (user.displayName || user.email || '') : '').trim();
  var first = src.charAt(0).toUpperCase();
  return /[A-Z0-9가-힣]/.test(first) ? first : 'L';
}

function buildUserDropdown(user) {
  var options = { escapeHtml: escapeHtml };
  if (__authUiModule) return __authUiModule.buildUserDropdown(user, options);
  if (__authUiTemplates) return __authUiTemplates.buildUserDropdown(user, options);
  var userName = '';
  var hasPhoto = !!(user && user.photoURL);

  if (user) {
    userName = user.displayName || user.email || '';
  }

  var safeUserName = escapeHtml(userName);
  var safePhotoUrl = hasPhoto ? escapeHtml(user.photoURL) : '';

  var isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;
  var myTreesHref = isPagesContext ? 'my-trees.html' : 'pages/my-trees.html';

  var avatarInitial = getUserAvatarInitial(user);

  var avatarContent = hasPhoto
    ? '<img src="' + safePhotoUrl + '" alt="" class="user-avatar-image" referrerpolicy="no-referrer">'
    : '<span class="user-avatar-initial" aria-hidden="true">' + escapeHtml(avatarInitial) + '</span>';

  return [
    '<div class="user-dropdown" id="userDropdown">',
    '<button class="user-dropdown-trigger user-dropdown-trigger-icon" aria-label="내 계정 메뉴">',
    '<span class="user-avatar-shell">',
    avatarContent,
    '</span>',
    '</button>',
    '<div class="user-dropdown-menu">',
    safeUserName ? '<div class="user-dropdown-meta">' + safeUserName + '</div>' : '',
    '<a href="' + myTreesHref + '" class="user-dropdown-item"><span class="material-symbols-outlined">account_tree</span>내 러브트리</a>',
    '<button class="user-dropdown-item" disabled style="cursor:default;opacity:0.6;"><span class="material-symbols-outlined">settings</span>설정</button>',
    '<div class="dropdown-divider"></div>',
    '<button type="button" class="user-dropdown-item" data-auth-action="logout"><span class="material-symbols-outlined">logout</span>로그아웃</button>',
    '</div>',
    '</div>'
  ].join('');
}

// ── Auth State → Nav UI ───────────────────────────────────────────────────────

/**
 * Update right-side nav area based on auth state.
 * Container #auth-nav / #auth-nav-container is never destroyed -
 * only its innerHTML is replaced.
 *
 * Called by onAuthStateChanged whenever Firebase auth state changes.
 */
function updateHeaderLangToggleVisibility(isLoggedIn) {
    var headerLangToggle = document.querySelector('.header-lang-toggle');
    if (!headerLangToggle) return;

    if (isLoggedIn) {
          headerLangToggle.hidden = true;
          headerLangToggle.style.setProperty('display', 'none', 'important');
    } else {
          headerLangToggle.hidden = false;
          headerLangToggle.style.removeProperty('display');
    }
}

function updateNavUI(user) {
    updateHeaderLangToggleVisibility(!!user);

  if (__authUiModule) {
    __authUiModule.updateNavUI({
      user: user,
      authReadyFlagKey: AUTH_READY_FLAG,
      persistConfirmedAuthSession: persistConfirmedAuthSession,
      buildUserDropdown: buildUserDropdown,
      buildLoginButton: buildLoginButton
    });
    return;
  }
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');

  // Ready 전에는 innerHTML 교체하지 않음 (보이지 않는 상태)
  if (!window[AUTH_READY_FLAG]) {
    return;
  }

  persistConfirmedAuthSession(user);

  if (user) {
    var html = buildUserDropdown(user);
    if (authNav) authNav.innerHTML = html;
    if (authContainer) authContainer.innerHTML = html;
  } else {
    var html = buildLoginButton();
    if (authNav) authNav.innerHTML = html;
    // authContainer stays empty on login page (has its own form)
  }
}

// ── Dropdown (event delegation — attached once) ─────────────────────────────

/**
 * Attach a SINGLE delegated click listener to document for all dropdowns.
 * Called once on initAuth, never again.
 * Uses document-level delegation so survives innerHTML replacements.
 */
function attachDropdownListener() {
  if (__authUiModule) {
    __authUiModule.attachDropdownListener({
      isAttached: function () {
        return !!DROPDOWN_LISTENER_ATTACHED;
      },
      setAttached: function (attached) {
        DROPDOWN_LISTENER_ATTACHED = !!attached;
        if (__authStateModule) __authStateModule.setDropdownListenerAttached(!!attached);
      }
    });
    return;
  }
  if (DROPDOWN_LISTENER_ATTACHED) return;
  DROPDOWN_LISTENER_ATTACHED = true;
  if (__authStateModule) __authStateModule.setDropdownListenerAttached(true);

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.user-dropdown-trigger');
    if (trigger) {
      e.stopPropagation();
      var dropdown = trigger.closest('.user-dropdown');
      if (!dropdown) return;
      var menu = dropdown.querySelector('.user-dropdown-menu');
      if (!menu) return;
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        if (m !== menu) m.classList.remove('show');
      });
      menu.classList.toggle('show');
      return;
    }
    var logoutButton = e.target.closest('[data-auth-action="logout"]');
    if (logoutButton) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        m.classList.remove('show');
      });
      if (typeof signOut === 'function') {
        signOut();
      }
      return;
    }
    if (!e.target.closest('.user-dropdown')) {
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        m.classList.remove('show');
      });
    }
  });
}

// ── Sign In/Out ───────────────────────────────────────────────────────────────

function getRedirectTarget() {
  if (__authSessionModule) {
    return __authSessionModule.getRedirectTarget(getBasePath);
  }
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');
  if (redirect) return redirect;
  var basePath = getBasePath();
  return basePath + 'my-trees.html';
}

/**
 * Check if current environment supports Firebase Auth.
 * Returns null if supported, or error message string if not.
 */
function getEnvironmentCheckError() {
  if (__authProtectedRouteBridge) return __authProtectedRouteBridge.getEnvironmentCheckError();
  if (__authFirebaseModule) return __authFirebaseModule.getEnvironmentCheckError();
  return null;
}

/**
 * Convert Firebase error to user-friendly Korean message.
 * Original error is logged to console for developers.
 */
function getFriendlyErrorMessage(error, isGoogleLogin) {
  if (__authProtectedRouteBridge) return __authProtectedRouteBridge.getFriendlyErrorMessage(error, isGoogleLogin);
  if (__authFirebaseModule) return __authFirebaseModule.getFriendlyErrorMessage(error, isGoogleLogin);
  if (!error) return '알 수 없는 오류가 발생했습니다.';
  console.error('Auth error (developer only):', error);
  return '로그인에 실패했습니다. 다시 시도해 주세요.';
}

async function signInWithGoogle() {
  if (__authProtectedRouteBridge) {
    await __authProtectedRouteBridge.signInWithGoogle();
    return;
  }
  if (__authFirebaseModule) {
    await __authFirebaseModule.signInWithGoogle({
      getEnvironmentCheckError: getEnvironmentCheckError,
      isLoginPage: isLoginPage,
      persistConfirmedAuthSession: persistConfirmedAuthSession,
      preloadRedirectTargetData: preloadRedirectTargetData,
      getRedirectTarget: getRedirectTarget
    });
    return;
  }
  var envError = getEnvironmentCheckError();
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
  console.error('Auth Firebase boundary not loaded before signInWithGoogle.');
  alert('로그인 시스템을 초기화할 수 없습니다. 페이지를 새로고침해 주세요.');
}

async function signOut() {
  if (__authProtectedRouteBridge) {
    await __authProtectedRouteBridge.signOut();
    return;
  }
  if (__authFirebaseModule) {
    await __authFirebaseModule.signOut({
      clearStaleFirebaseAuthState: clearStaleFirebaseAuthState,
      clearConfirmedAuthCache: clearConfirmedAuthCache
    });
    return;
  }
  try {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
      await firebase.auth().signOut();
    }
  } catch (error) {
    console.error('Logout failed:', error);
  }
  clearStaleFirebaseAuthState();
  try {
    localStorage.removeItem('isLoggedIn');
  } catch (e) {}
  // ── Clear user's private caches on logout ──
  // NOTE: public browse cache (lovebud_public_trees_cache) is intentionally kept.
  // It contains non-sensitive public data; my-trees cache is the private one.
  if (window.clearPrivateCaches) {
    window.clearPrivateCaches();
  }
  clearConfirmedAuthCache();
  window.location.reload();
}

// ── Google Btn (login.html) ───────────────────────────────────────────────────

function setupGoogleBtn() {
  callLoginPageModule('setupGoogleBtn', [{
    signInWithGoogle: signInWithGoogle
  }]);
}

async function signUpWithGoogle() {
  // Signup also uses Google Auth, but keeps separate semantic entry point.
  await signInWithGoogle();
}

function setupSignupGoogleBtn() {
  callLoginPageModule('setupSignupGoogleBtn', [{
    signUpWithGoogle: signUpWithGoogle
  }]);
}

// ── Email Auth Form ───────────────────────────────────────────────────────────

function setupEmailAuthForm() {
  callLoginPageModule('setupEmailAuthForm', [{
    firebase: typeof firebase !== 'undefined' ? firebase : undefined,
    initFirebase: initFirebase,
    getEnvironmentCheckError: getEnvironmentCheckError,
    getFriendlyErrorMessage: getFriendlyErrorMessage,
    getEmailAuthMode: function () { return EMAIL_AUTH_MODE; },
    setEmailAuthMode: setEmailAuthMode,
    syncEmailAuthModeUi: syncEmailAuthModeUi,
    persistConfirmedAuthSession: persistConfirmedAuthSession,
    preloadRedirectTargetData: preloadRedirectTargetData,
    getRedirectTarget: getRedirectTarget,
    isInvalidAuthSessionError: isInvalidAuthSessionError,
    clearStaleFirebaseAuthState: clearStaleFirebaseAuthState
  }]);
}

function setupSignupForm() {
  callLoginPageModule('setupSignupForm', [{
    firebase: typeof firebase !== 'undefined' ? firebase : undefined,
    initFirebase: initFirebase,
    getEnvironmentCheckError: getEnvironmentCheckError,
    getFriendlyErrorMessage: getFriendlyErrorMessage,
    persistConfirmedAuthSession: persistConfirmedAuthSession,
    preloadRedirectTargetData: preloadRedirectTargetData,
    getRedirectTarget: getRedirectTarget
  }]);
}

// ── Exports ────────────────────────────────────────────────────────────────────
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.initAuth = initAuth;
window.getEnvironmentCheckError = getEnvironmentCheckError;
window.getFriendlyErrorMessage = getFriendlyErrorMessage;

// Confirmed session helpers for protected pages
window.getConfirmedAuthUser = getCachedAuthUser;
window.hasConfirmedAuthSession = function() {
  return !!getCachedAuthUser();
};
window.getCachedAuthToken = getCachedAuthToken;

document.addEventListener('DOMContentLoaded', initAuth);
