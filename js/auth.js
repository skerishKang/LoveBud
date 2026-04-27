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

var __authStateModule = window.LoveBudAuthState || null;
var __authUiModule = window.LoveBudAuthUI || null;
var __authSessionModule = window.LoveBudAuthSession || null;
var __authFirebaseModule = window.LoveBudAuthFirebase || null;
var EMAIL_AUTH_MODE = __authStateModule
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
    })();
var AUTH_INIT_FLAG = __authStateModule ? __authStateModule.AUTH_INIT_FLAG : '__lovebudAuthInitialized';
var AUTH_READY_FLAG = __authStateModule ? __authStateModule.AUTH_READY_FLAG : '__lovebudAuthReady';
var DROPDOWN_LISTENER_ATTACHED = __authStateModule
  ? __authStateModule.isDropdownListenerAttached()
  : false;

window.LoveBudAuthBootstrap = window.LoveBudAuthBootstrap || (function() {
  var resolved = false;
  var lastUser = null;
  var waiters = [];

  function flush(user) {
    var pending = waiters.splice(0, waiters.length);
    pending.forEach(function(fn) {
      try {
        fn(user);
      } catch (error) {
        console.error('[auth] Bootstrap waiter error:', error);
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
    return new Promise(function(resolveFn) {
      waiters.push(resolveFn);
    });
  }

  function getSnapshot() {
    return {
      ready: resolved,
      user: lastUser
    };
  }

  return {
    resolve: resolve,
    whenReady: whenReady,
    getSnapshot: getSnapshot,
    getResolvedUser: function() {
      return lastUser;
    }
  };
})();

function resolveAuthBootstrap(user) {
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

function syncEmailAuthModeUi(options) {
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
  if (!isLoginPage()) return;

  EMAIL_AUTH_MODE = resolveEmailAuthMode();
  if (__authStateModule) __authStateModule.setEmailAuthMode(EMAIL_AUTH_MODE);

  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect');
  var noticeEl = document.getElementById('redirect-notice');
  if (noticeEl) {
    noticeEl.style.display = redirect ? 'block' : 'none';
  }

  syncEmailAuthModeUi({
    titleEl: document.getElementById('email-auth-title'),
    helperEl: document.getElementById('email-auth-helper'),
    submitBtn: document.getElementById('email-auth-submit'),
    toggleBtn: document.getElementById('email-auth-toggle'),
    badgeEl: document.getElementById('auth-mode-badge')
  });
}

// ── Auth Ready Callbacks (배열 패턴) ─────────────────────────────────────────
// 여러 모듈이 등록해도 덮어쓰기 문제 없음
window.__onAuthReadyCallbacks = window.__onAuthReadyCallbacks || [];
var __authCallbacksModule = window.LoveBudAuthCallbacks || null;

/**
 * 인증 준비 후 실행할 콜백 등록
 * @param {Function} callback - user 객체를 받는 콜백 함수
 */
window.registerOnAuthReady = function(callback) {
  if (__authCallbacksModule) {
    __authCallbacksModule.registerOnAuthReady(callback, AUTH_READY_FLAG);
    return;
  }
  if (typeof callback !== 'function') return;
  window.__onAuthReadyCallbacks.push(callback);
  if (window[AUTH_READY_FLAG]) {
    var user = window.__lastAuthUser || null;
    try { callback(user); } catch (e) { console.error('[auth] Callback error:', e); }
  }
};

/**
 * 모든 등록된 콜백 실행 (auth.js 내부 사용)
 */
function fireAuthReadyCallbacks(user) {
  if (__authCallbacksModule) {
    __authCallbacksModule.fireAuthReadyCallbacks(user);
    return;
  }
  window.__lastAuthUser = user;
  window.__onAuthReadyCallbacks.forEach(function(callback) {
    try { callback(user); } catch (e) { console.error('[auth] Callback error:', e); }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
var __authCacheModule = window.LoveBudAuthCache || null;

function isInvalidAuthSessionError(error) {
  if (__authCacheModule) return __authCacheModule.isInvalidAuthSessionError(error);
  var message = String((error && (error.code || error.message)) || '');
  return /USER_NOT_FOUND|user-not-found|invalid-user-token|token.*expired|user token/i.test(message);
}

function clearStaleFirebaseAuthState() {
  if (__authCacheModule) {
    __authCacheModule.clearStaleFirebaseAuthState();
    return;
  }
  var prefixes = ['firebase:authUser:', 'firebase:pendingRedirect:', 'firebase:redirectUser:'];
  function clearStorage(storage) {
    if (!storage) return;
    var keys = [];
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key && prefixes.some(function (p) { return key.indexOf(p) === 0; })) {
        keys.push(key);
      }
    }
    keys.forEach(function (k) { try { storage.removeItem(k); } catch (e) {} });
  }
  try { clearStorage(window.localStorage); } catch (e) {}
  try { clearStorage(window.sessionStorage); } catch (e) {}
}

function getCachedAuthUser() {
  if (__authCacheModule) {
    return __authCacheModule.getCachedAuthUser(AUTH_CACHE_KEY, AUTH_CONFIRMED_KEY);
  }
  try {
    if (localStorage.getItem(AUTH_CONFIRMED_KEY) !== 'true') return null;
    var raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw || raw === 'null') return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function setConfirmedAuthCache(user) {
  if (__authCacheModule) {
    __authCacheModule.setConfirmedAuthCache(user, AUTH_CACHE_KEY, AUTH_CONFIRMED_KEY, AUTH_TOKEN_KEY);
    return;
  }
  try {
    if (user && user.uid) {
      var cacheData = { uid: user.uid, displayName: user.displayName || '', email: user.email || '' };
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(AUTH_CONFIRMED_KEY, 'true');
      return;
    }
  } catch (e) {}
  clearConfirmedAuthCache();
}

function clearConfirmedAuthCache() {
  if (__authCacheModule) {
    __authCacheModule.clearConfirmedAuthCache(AUTH_CACHE_KEY, AUTH_CONFIRMED_KEY, AUTH_TOKEN_KEY);
    return;
  }
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
    localStorage.removeItem(AUTH_CONFIRMED_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {}
}

function getCachedAuthToken() {
  if (__authCacheModule) {
    return __authCacheModule.getCachedAuthToken(AUTH_TOKEN_KEY);
  }
  try {
    var raw = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw || raw === 'null') return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.token || !parsed.expiresAt) return null;
    if (Date.now() >= Number(parsed.expiresAt) - 30000) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

async function persistConfirmedAuthSession(user) {
  if (__authCacheModule) {
    await __authCacheModule.persistConfirmedAuthSession(user, AUTH_CACHE_KEY, AUTH_CONFIRMED_KEY, AUTH_TOKEN_KEY);
    return;
  }
  try {
    if (!user || !user.uid) {
      clearConfirmedAuthCache();
      return;
    }

    var cacheData = {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || ''
    };

    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(AUTH_CONFIRMED_KEY, 'true');

    if (typeof user.getIdTokenResult === 'function') {
      var tokenResult = await user.getIdTokenResult();
      if (tokenResult && tokenResult.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({
          uid: user.uid,
          token: tokenResult.token,
          expiresAt: new Date(tokenResult.expirationTime).getTime()
        }));
      }
    }
  } catch (e) {
    console.warn('[auth] Failed to persist confirmed session:', e);
  }
}

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

// ── Core Auth ─────────────────────────────────────────────────────────────────

/**
 * Apply cached auth state for fast initial render (prevents flicker).
 *
 * If we have a previously confirmed authenticated user, render the cached
 * dropdown immediately and let Firebase revalidate in the background.
 * If no confirmed cache exists, show a neutral skeleton that preserves layout.
 */
function applyCachedAuthState() {
  if (__authFirebaseModule) {
    return __authFirebaseModule.applyCachedAuthState({
      isLoginPage: isLoginPage,
      getCachedAuthUser: getCachedAuthUser,
      buildUserDropdown: buildUserDropdown
    });
  }
  var path = window.location.pathname;
  var isLoginPage = path.indexOf('/pages/login.html') !== -1 ||
                    path.indexOf('/pages/login') !== -1 ||
                    path.indexOf('login.html') !== -1;
  if (isLoginPage) return false;

  var authNav = document.getElementById('auth-nav');
  if (!authNav) return false;

  try {
    var cachedUser = getCachedAuthUser();
    if (cachedUser) {
      authNav.innerHTML = buildUserDropdown(cachedUser);
      authNav.style.cssText = 'pointer-events:auto;opacity:1;transition:opacity 0.2s ease;min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;';
      authNav.classList.add('auth-ready');
      return true;
    }

    // If there is no confirmed cache, keep a neutral skeleton until Firebase answers.
    authNav.innerHTML = '<div class="auth-skeleton" style="width:36px;height:36px;border-radius:18px;background:var(--surface-container-highest, #e8e8e8);pointer-events:none;"></div>';
  } catch(e) {}
  return false;
}

function initAuth() {
  if (__authFirebaseModule) {
    __authFirebaseModule.initAuth({
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
      authReadyFlag: AUTH_READY_FLAG
    });
    return;
  }
  EMAIL_AUTH_MODE = resolveEmailAuthMode();
  if (__authStateModule) __authStateModule.setEmailAuthMode(EMAIL_AUTH_MODE);
  setupLoginPageAuthUi();

  // Apply confirmed cached state immediately to prevent flicker
  var hasImmediateAuthUI = applyCachedAuthState();

  // Cached authenticated UI can stay visible while Firebase revalidates in background.
  window[AUTH_READY_FLAG] = !!hasImmediateAuthUI;
  if (!hasImmediateAuthUI) {
    markAuthLoading();
  }

  // 안전장치: 2초 타임아웃 (MVP 공격적 축소) - Firebase 응답 없을 때 오프라인 모드로 전환
  // confirmed session cache가 있으면 즉시 진입하므로 긴 대기 불필요
  var authTimeout = setTimeout(function() {
    if (!window[AUTH_READY_FLAG]) {
      console.warn('[auth] Firebase auth timeout (2s) - switching to offline mode');
      initOfflineAuth();
    }
  }, 2000);

  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded. Auth running in offline mode.');
    clearTimeout(authTimeout);
    initOfflineAuth();
    return;
  }

  if (typeof initFirebase === 'function') initFirebase();

  if (!firebase.apps || !firebase.apps.length) {
    console.error('Firebase not initialized. Auth setup aborted.');
    clearTimeout(authTimeout);
    initOfflineAuth();
    return;
  }

  if (window[AUTH_INIT_FLAG]) {
    clearTimeout(authTimeout);
    return;
  }
  window[AUTH_INIT_FLAG] = true;

  attachDropdownListener();

  firebase.auth().onAuthStateChanged(async function (user) {
    clearTimeout(authTimeout); // 정상 응답 - 타임아웃 취소
    
    if (user) {
      try {
        if (typeof user.reload === 'function') await user.reload();
      } catch (error) {
        if (isInvalidAuthSessionError(error)) {
          console.warn('Invalid Firebase session detected. Signing out.');
          await firebase.auth().signOut().catch(function () {});
          clearStaleFirebaseAuthState();
          clearConfirmedAuthCache();
          resolveAuthBootstrap(null);
          return;
        }
      }
    }
    // Auth 상태 확인 완료 후 세션 캐시 저장 및 UI 업데이트
    await persistConfirmedAuthSession(user);
    markAuthReady();
    updateNavUI(user);
    resolveAuthBootstrap(user);

    // 배열 콜백 패턴으로 모든 등록된 콜백 실행
    fireAuthReadyCallbacks(user);
  });

  setupGoogleBtn();
  setupEmailAuthForm();
  setupSignupForm();
  setupSignupGoogleBtn();
}

// ── Offline Fallback ──────────────────────────────────────────────────────────

function initOfflineAuth() {
  if (__authFirebaseModule) {
    __authFirebaseModule.initOfflineAuth({
      markAuthReady: markAuthReady,
      updateNavUI: updateNavUI,
      getCachedAuthUser: getCachedAuthUser,
      resolveAuthBootstrap: resolveAuthBootstrap,
      fireAuthReadyCallbacks: fireAuthReadyCallbacks
    });
    return;
  }
  var cachedUser = getCachedAuthUser();
  // Offline 모드에서도 ready 상태로 전환 후 UI 표시
  // 순서 중요: markAuthReady 먼저, updateNavUI 나중
  markAuthReady();
  var user = cachedUser && cachedUser.uid ? cachedUser : null;
  updateNavUI(user);
  resolveAuthBootstrap(user);
  // Offline 모드에서도 콜백 실행
  fireAuthReadyCallbacks(user);
}

// ── Loading State (prevent flash) ────────────────────────────────────────────

/**
 * Show auth nav loading state - neutral skeleton with pointer-events blocked.
 *
 * IMPORTANT: During loading, the skeleton container is completely non-interactive.
 * This prevents any stale cached auth UI from being clickable before Firebase
 * confirms the actual auth state.
 */
function markAuthLoading() {
  if (__authUiModule) {
    __authUiModule.markAuthLoading();
    return;
  }
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  // During loading: layout-preserving skeleton that is completely non-interactive.
  // pointer-events:none ensures no click/keyboard interaction until AUTH_READY_FLAG.
  var loadingStyle = 'pointer-events:none;opacity:0.6;transition:opacity 0.2s ease;min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:none;';
  if (authNav) {
    authNav.style.cssText = loadingStyle;
  }
  if (authContainer) {
    authContainer.style.cssText = loadingStyle;
  }
}

/**
 * Mark auth as ready and reveal the nav UI with smooth fade-in.
 * index.html의 로딩 스피너를 지우고 실제 UI를 표시.
 * pointer-events:auto explicit 설정으로 interactive 전환을 보장.
 */
function markAuthReady() {
  if (__authUiModule) {
    __authUiModule.markAuthReady(AUTH_READY_FLAG);
    return;
  }
  window[AUTH_READY_FLAG] = true;
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  // Ready 후: 스피너 제거 + pointer-events 복원 + 부드럽게 표시
  var visibleStyle = 'pointer-events:auto;opacity:1;transition:opacity 0.2s ease;min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;';
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
  var path = window.location.pathname;
  var isPagesContext = path.indexOf('/pages/') !== -1;
  return isPagesContext ? '' : 'pages/';
}

// 전역으로 노출
window.getBasePath = getBasePath;

function escapeHtml(value) {
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
  var basePath = getBasePath();
  var loginHref = basePath + 'login.html';
  return '<a href="' + loginHref + '" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>';
}

function getUserAvatarInitial(user) {
  if (__authUiModule) return __authUiModule.getUserAvatarInitial(user);
  var source = '';

  if (user) {
    source = String(user.displayName || user.email || '').trim();
  }

  if (!source) return 'L';

  var firstChar = source.charAt(0).toUpperCase();
  return /[A-Z0-9가-힣]/.test(firstChar) ? firstChar : 'L';
}

/**
 * Build user dropdown HTML.
 *
 * Fixed avatar shell that stays in place - only inner content changes.
 * This prevents visual "flicker" when photoURL loads.
 *
 * @param {Object} user - Firebase user object
 */
function buildUserDropdown(user) {
  if (__authUiModule) return __authUiModule.buildUserDropdown(user);
  var userName = '';
  var hasPhoto = !!(user && user.photoURL);

  if (user) {
    userName = user.displayName || user.email || '';
  }

  var safeUserName = escapeHtml(userName);
  var safePhotoUrl = hasPhoto ? escapeHtml(user.photoURL) : '';

  // Determine context (root vs pages folder)
  var isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;
  var settingsHref = isPagesContext ? 'settings.html' : 'pages/settings.html';
  var myTreesHref = isPagesContext ? 'my-trees.html' : 'pages/my-trees.html';

  var avatarInitial = getUserAvatarInitial(user);

  // Shell stays constant - only content inside changes
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
  if (__authFirebaseModule) return __authFirebaseModule.getEnvironmentCheckError();
  var protocol = window.location.protocol || '';
  // Check file:// protocol
  if (protocol === 'file:') {
    return '이 페이지는 파일:// 프로토콜에서 열 수 없습니다. http:// 또는 https:// 주소에서 접근해 주세요.';
  }
  // Check web storage availability
  try {
    var testKey = '__lovebud_storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
  } catch (e) {
    return '브라우저 저장소(storage)가 비활성화되어 있습니다. 쿠키/저장소를 허용한 후 다시 시도해 주세요.';
  }
  // Check https requirement for some browsers
  if (protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Allow http on localhost for dev, warn otherwise
    console.warn('[auth] Running on http:// - some features may be restricted');
  }
  return null;
}

/**
 * Convert Firebase error to user-friendly Korean message.
 * Original error is logged to console for developers.
 */
function getFriendlyErrorMessage(error, isGoogleLogin) {
  if (__authFirebaseModule) return __authFirebaseModule.getFriendlyErrorMessage(error, isGoogleLogin);
  if (!error) return '알 수 없는 오류가 발생했습니다.';
  var code = error.code || '';
  var message = error.message || '';
  // Log full error for devs
  console.error('Auth error (developer only):', error);
  
  // Environment-related errors
  if (message.indexOf('location.protocol') !== -1 || message.indexOf('not supported in the environment') !== -1) {
    return '이 브라우저 환경에서는 로그인할 수 없습니다. http:// 또는 https:// 주소(localhost 가능)에서 다시 시도해 주세요.';
  }
  if (message.indexOf('web storage') !== -1 || message.indexOf('storage') !== -1) {
    return '브라우저 저장소(storage)가 비활성화되어 있습니다. 쿠키와 저장소를 허용한 후 다시 시도해 주세요.';
  }
   
   // Common auth errors
   switch (code) {
     case 'auth/popup-closed-by-user':
       return null; // User cancelled, no message needed
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
       return '이미 사용 중인Credential입니다.';
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
       // Generic fallback - don't expose raw message
       return '로그인에 실패했습니다. 다시 시도해 주세요.';
   }
}

async function signInWithGoogle() {
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
  // Environment check first
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

  var provider = new firebase.auth.GoogleAuthProvider();
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) {}

  var loginPage = isLoginPage();

  try {
    var authResult = await firebase.auth().signInWithPopup(provider);
    // 세션 캐시 저장 및 redirect target 데이터 preload (비동기, 실패 무시)
    await persistConfirmedAuthSession(authResult && authResult.user ? authResult.user : firebase.auth().currentUser);
    preloadRedirectTargetData();
    window.location.href = getRedirectTarget();
  } catch (error) {
    console.error('Google login failed:', error);

    var popupFallbackCodes = {
      'auth/popup-blocked': true,
      'auth/web-storage-unsupported': true,
      'auth/cancelled-popup-request': true
    };

    var shouldTryRedirectFallback =
      loginPage &&
      popupFallbackCodes[error && error.code];

    if (shouldTryRedirectFallback) {
      try {
        alert('팝업 로그인에 실패해 리디렉션 방식으로 다시 시도합니다.');
        await firebase.auth().signInWithRedirect(provider);
        return;
      } catch (redirectError) {
        console.error('Google redirect fallback failed:', redirectError);
        var redirectMessage = getFriendlyErrorMessage(redirectError, true);
        if (redirectMessage) {
          alert(redirectMessage);
        }
        return;
      }
    }

    var friendlyMessage = getFriendlyErrorMessage(error, true);
    if (friendlyMessage) {
      alert(friendlyMessage);
    }
  }
}

async function signOut() {
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
  var googleBtn = document.getElementById('login-btn-google');
  if (!googleBtn) return;
  googleBtn.onclick = null;
  googleBtn.addEventListener('click', function (e) {
    e.preventDefault();
    signInWithGoogle();
  });
}

async function signUpWithGoogle() {
  // Signup also uses Google Auth, but keeps separate semantic entry point.
  await signInWithGoogle();
}

function setupSignupGoogleBtn() {
  var signupGoogleBtn = document.getElementById('signup-btn-google');
  if (!signupGoogleBtn) return;
  signupGoogleBtn.onclick = null;
  signupGoogleBtn.addEventListener('click', function (e) {
    e.preventDefault();
    signUpWithGoogle();
  });
}

// ── Email Auth Form ───────────────────────────────────────────────────────────

function setupEmailAuthForm() {
  var form = document.getElementById('email-auth-form');
  if (!form) return;
  if (typeof firebase === 'undefined' || !firebase.auth) return;

   var emailInput = document.getElementById('email-auth-email');
   var passwordInput = document.getElementById('email-auth-password');
   var displayNameInput = document.getElementById('email-auth-display-name');
   var submitBtn = document.getElementById('email-auth-submit');
  var toggleBtn = document.getElementById('email-auth-toggle');
  var modal = document.getElementById('email-auth-modal');
  var titleEl = document.getElementById('email-auth-title');
  var helperEl = document.getElementById('email-auth-helper');

   function updateModeUi() {
     syncEmailAuthModeUi({
       titleEl: titleEl,
       helperEl: helperEl,
       submitBtn: submitBtn,
       toggleBtn: toggleBtn,
       badgeEl: document.getElementById('auth-mode-badge')
     });
   }

   function syncDisplayNameVisibility() {
     if (!displayNameInput) return;
     var wrapper = displayNameInput.closest('[data-auth-display-name-wrap]');
     if (!wrapper) return;
     wrapper.style.display = EMAIL_AUTH_MODE === 'signup' ? 'block' : 'none';
     displayNameInput.required = EMAIL_AUTH_MODE === 'signup';
   }

   updateModeUi();
   syncDisplayNameVisibility();

   if (toggleBtn) {
     toggleBtn.addEventListener('click', function () {
      EMAIL_AUTH_MODE = EMAIL_AUTH_MODE === 'login' ? 'signup' : 'login';
      if (__authStateModule) __authStateModule.setEmailAuthMode(EMAIL_AUTH_MODE);
       updateModeUi();
       syncDisplayNameVisibility();
     });
   }

   var emailBtn = document.getElementById('login-btn-email');
  if (emailBtn) {
    emailBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (modal) modal.style.display = 'flex';
    });
  }

  var closeBtn = document.getElementById('email-auth-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (modal) modal.style.display = 'none';
    });
  }
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

form.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    // Environment check
    var envError = getEnvironmentCheckError();
    if (envError) {
      alert(envError);
      return;
    }
    
    if (!emailInput || !passwordInput || !submitBtn) return;

     var email = String(emailInput.value || '').trim();
     var password = String(passwordInput.value || '').trim();
     var displayName = String(displayNameInput?.value || '').trim();

     if (!email || !password) { alert('이메일과 비밀번호를 모두 입력해 주세요.'); return; }
     if (EMAIL_AUTH_MODE === 'signup' && !displayName) { alert('닉네임을 입력해 주세요.'); return; }
     if (password.length < 6) { alert('비밀번호는 최소 6자 이상이어야 합니다.'); return; }

    submitBtn.disabled = true;
    var originalText = submitBtn.textContent;
    submitBtn.textContent = EMAIL_AUTH_MODE === 'login' ? '로그인 중...' : '가입 중...';

    if (typeof initFirebase === 'function') initFirebase();
    if (!firebase.apps || !firebase.apps.length) {
      alert('Firebase가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

     try {
       var authUser;
       if (EMAIL_AUTH_MODE === 'login') {
         var loginResult = await firebase.auth().signInWithEmailAndPassword(email, password);
         authUser = loginResult && loginResult.user ? loginResult.user : firebase.auth().currentUser;
       } else {
         var signupResult = await firebase.auth().createUserWithEmailAndPassword(email, password);
         if (signupResult && signupResult.user && typeof signupResult.user.updateProfile === 'function') {
           await signupResult.user.updateProfile({ displayName: displayName });
         }
         authUser = signupResult && signupResult.user ? signupResult.user : firebase.auth().currentUser;
       }
       // 세션 캐시 저장 및 redirect target 데이터 preload (비동기, 실패 무시)
       await persistConfirmedAuthSession(authUser);
       preloadRedirectTargetData();
       window.location.href = getRedirectTarget();
    } catch (error) {
      console.error('Email auth error:', error);
      if (isInvalidAuthSessionError(error)) {
        await firebase.auth().signOut().catch(function () {});
        clearStaleFirebaseAuthState();
      }
      var friendlyMessage = getFriendlyErrorMessage(error, false);
      var fallbackMessage = friendlyMessage || '인증 중 오류가 발생했습니다.';
      if (
        window.LoveBudLoginPageAuthError &&
        typeof window.LoveBudLoginPageAuthError.show === 'function'
      ) {
        window.LoveBudLoginPageAuthError.show(fallbackMessage);
      } else {
        alert(fallbackMessage);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function setupSignupForm() {
  var signupForm = document.getElementById('signup-form');
  if (!signupForm) return;
  if (typeof firebase === 'undefined' || !firebase.auth) return;

   var displayNameInput = document.getElementById('signup-display-name');
   var emailInput = document.getElementById('signup-email');
   var passwordInput = document.getElementById('signup-password');
   var submitBtn = document.getElementById('signup-submit');

  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    var envError = getEnvironmentCheckError();
    if (envError) {
      alert(envError);
      return;
    }

     var displayName = String(displayNameInput?.value || '').trim();
     var email = String(emailInput?.value || '').trim();
     var password = String(passwordInput?.value || '').trim();

     if (!displayName || !email || !password) {
       alert('닉네임, 이메일, 비밀번호를 입력해주세요.');
       return;
     }
    if (password.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }
    var originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.textContent = '가입 중...';
    }

    try {
      if (typeof initFirebase === 'function') initFirebase();
      if (!firebase.apps || !firebase.apps.length) {
        throw new Error('Firebase not initialized');
      }

       var signupResult = await firebase.auth().createUserWithEmailAndPassword(email, password);
       if (signupResult && signupResult.user && typeof signupResult.user.updateProfile === 'function') {
         await signupResult.user.updateProfile({ displayName: displayName });
       }
       window.location.href = getRedirectTarget();
    } catch (error) {
      console.error('Signup error:', error);
      var friendlyMessage = getFriendlyErrorMessage(error, false);
      alert(friendlyMessage || '회원가입 중 오류가 발생했습니다.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
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
