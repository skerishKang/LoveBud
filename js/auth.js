/**
 * LoveBud - Authentication Module (Firebase Auth)
 * v20260415-15
 *
 * Auth state observer updates #auth-nav (non-login pages) or
 * #auth-nav-container (login.html) using innerHTML container pattern.
 *
 * Loading state: neutral skeleton ONLY - no interactive content before Firebase confirms auth.
 * This prevents stale cached state from showing wrong UI (e.g., "내 계정" for logged-out user).
 *
 * Version: ?v=20260415-15
 */

var EMAIL_AUTH_MODE = 'login';
var AUTH_INIT_FLAG = '__lovebudAuthInitialized';
var DROPDOWN_LISTENER_ATTACHED = false;
var AUTH_READY_FLAG = '__lovebudAuthReady';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isInvalidAuthSessionError(error) {
  var message = String((error && (error.code || error.message)) || '');
  return /USER_NOT_FOUND|user-not-found|invalid-user-token|token.*expired|user token/i.test(message);
}

function clearStaleFirebaseAuthState() {
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

// ── Core Auth ─────────────────────────────────────────────────────────────────

/**
 * Apply cached auth state for fast initial render (prevents flicker).
 *
 * IMPORTANT: This renders a NEUTRAL SKELETON ONLY. No interactive auth content
 * is shown here because Firebase hasn't confirmed the actual auth state yet.
 * Showing cached "logged in" UI when the session is actually expired is worse
 * than showing a skeleton — it creates a false sense of authentication.
 *
 * The skeleton preserves layout space. Actual UI is set by updateNavUI()
 * after onAuthStateChanged fires.
 */
function applyCachedAuthState() {
  var isLoginPage = window.location.pathname.indexOf('login.html') !== -1;
  if (isLoginPage) return false;

  var authNav = document.getElementById('auth-nav');
  if (!authNav) return false;

  // Always show neutral skeleton — never show cached interactive state.
  // This ensures we never display stale "내 계정" or "로그인" based on cache
  // before Firebase has confirmed the actual auth state.
  try {
    authNav.innerHTML = '<div class="auth-skeleton" style="width:100px;height:36px;border-radius:18px;background:var(--surface-container-highest, #e8e8e8);pointer-events:none;"></div>';
  } catch(e) {}
  return true;
}

function initAuth() {
  // Apply cached state immediately to prevent flicker
  applyCachedAuthState();

  // Ready 전 상태로 초기화 - 완전히 숨김
  window[AUTH_READY_FLAG] = false;
  markAuthLoading();

  // 안전장치: 5초 타임아웃 - Firebase 응답 없을 때 오프라인 모드로 전환
  var authTimeout = setTimeout(function() {
    if (!window[AUTH_READY_FLAG]) {
      console.warn('[auth] Firebase auth timeout - switching to offline mode');
      initOfflineAuth();
    }
  }, 5000);

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
          return;
        }
      }
    }
    // Auth 상태 확인 완료 후 UI 업데이트 및 표시
    markAuthReady();
    updateNavUI(user);

    if (typeof window.onAuthReady === 'function') {
      window.onAuthReady(user);
    }
  });

  setupGoogleBtn();
  setupEmailAuthForm();
}

// ── Offline Fallback ──────────────────────────────────────────────────────────

function initOfflineAuth() {
  var isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  // Offline 모드에서도 ready 상태로 전환 후 UI 표시
  // 순서 중요: markAuthReady 먼저, updateNavUI 나중
  markAuthReady();
  updateNavUI(isLoggedIn ? { uid: 'offline', email: 'offline@example.com' } : null);
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
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  // During loading: layout-preserving skeleton that is completely non-interactive.
  // pointer-events:none ensures no click/keyboard interaction until AUTH_READY_FLAG.
  var loadingStyle = 'pointer-events:none;opacity:0.6;transition:opacity 0.2s ease;min-width:100px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:none;';
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
  window[AUTH_READY_FLAG] = true;
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');
  // Ready 후: 스피너 제거 + pointer-events 복원 + 부드럽게 표시
  var visibleStyle = 'pointer-events:auto;opacity:1;transition:opacity 0.2s ease;min-width:100px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;';
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

function buildLoginButton() {
  return '<a href="login.html" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>';
}

/**
 * Build user dropdown HTML.
 *
 * Header trigger label: always "내 계정" (never displayName/email).
 * User identity (name/email) is shown only as small helper text inside the dropdown menu.
 *
 * @param {Object} user - Firebase user object
 */
function buildUserDropdown(user) {
  // Real name/email only shown as secondary text INSIDE the dropdown
  var userSubtitle = '';
  if (user) {
    var name = user.displayName || user.email || '';
    if (name) userSubtitle = '<span style="font-size:11px;color:var(--on-surface-variant,#888);margin-left:4px;">' + name + '</span>';
  }

  return [
    '<div class="user-dropdown" id="userDropdown">',
    '<button class="user-dropdown-trigger btn-round btn-primary" style="padding:8px 16px;display:flex;align-items:center;gap:6px;" aria-label="User menu">',
    '<span class="material-symbols-outlined">account_circle</span>',
    '<span>내 계정</span>',
    userSubtitle,
    '</button>',
    '<div class="user-dropdown-menu">',
    '<a href="my-trees.html" class="user-dropdown-item"><span class="material-symbols-outlined">account_tree</span>내 러브트리</a>',
    '<button class="user-dropdown-item" disabled style="cursor:default;opacity:0.6;"><span class="material-symbols-outlined">settings</span>설정</button>',
    '<div class="dropdown-divider"></div>',
    '<button class="user-dropdown-item" onclick="signOut()"><span class="material-symbols-outlined">logout</span>로그아웃</button>',
    '</div>',
    '</div>'
  ].join('');
}

// ── Auth State → Nav UI ───────────────────────────────────────────────────────

/**
 * Update right-side nav area based on auth state.
 * Container #auth-nav / #auth-nav-container is never destroyed —
 * only its innerHTML is replaced.
 *
 * Called by onAuthStateChanged whenever Firebase auth state changes.
 */
function updateNavUI(user) {
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');

  // Ready 전에는 innerHTML 교체하지 않음 (보이지 않는 상태)
  if (!window[AUTH_READY_FLAG]) {
    return;
  }

  // Update Cache
  try {
    if (user) {
      var cacheData = { uid: user.uid, displayName: user.displayName, email: user.email };
      localStorage.setItem('lovebud_auth_cache', JSON.stringify(cacheData));
    } else {
      localStorage.setItem('lovebud_auth_cache', 'null');
    }
  } catch(e) {}

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
  if (DROPDOWN_LISTENER_ATTACHED) return;
  DROPDOWN_LISTENER_ATTACHED = true;

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
  var params = new URLSearchParams(window.location.search);
  return params.get('redirect') || 'my-trees.html';
}

/**
 * Check if current environment supports Firebase Auth.
 * Returns null if supported, or error message string if not.
 */
function getEnvironmentCheckError() {
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

  try {
    await firebase.auth().signInWithPopup(provider);
    window.location.href = getRedirectTarget();
  } catch (error) {
    console.error('Google login failed:', error);
    var friendlyMessage = getFriendlyErrorMessage(error, true);
    if (friendlyMessage) {
      alert(friendlyMessage);
    }
  }
}

async function signOut() {
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
    localStorage.removeItem('lovebud_auth_cache');
  } catch (e) {}
  window.location.reload();
}

// ── Google Btn (login.html) ───────────────────────────────────────────────────

function setupGoogleBtn() {
  var googleBtn = document.querySelector('.login-btn-google');
  if (!googleBtn) return;
  googleBtn.onclick = null;
  googleBtn.addEventListener('click', function (e) {
    e.preventDefault();
    signInWithGoogle();
  });
}

// ── Email Auth Form ───────────────────────────────────────────────────────────

function setupEmailAuthForm() {
  var form = document.getElementById('email-auth-form');
  if (!form) return;
  if (typeof firebase === 'undefined' || !firebase.auth) return;

  var emailInput = document.getElementById('email-auth-email');
  var passwordInput = document.getElementById('email-auth-password');
  var submitBtn = document.getElementById('email-auth-submit');
  var toggleBtn = document.getElementById('email-auth-toggle');
  var modal = document.getElementById('email-auth-modal');
  var titleEl = document.getElementById('email-auth-title');
  var helperEl = document.getElementById('email-auth-helper');

  function updateModeUi() {
    if (!submitBtn || !toggleBtn) return;
    if (EMAIL_AUTH_MODE === 'login') {
      if (titleEl) titleEl.textContent = '이메일로 로그인';
      if (helperEl) helperEl.textContent = '이미 만든 이메일 계정으로 로그인합니다.';
      submitBtn.textContent = '로그인';
      if (toggleBtn) toggleBtn.textContent = '계정이 없나요? 회원가입으로 전환';
    } else {
      if (titleEl) titleEl.textContent = '이메일로 회원가입';
      if (helperEl) helperEl.textContent = '새 이메일 계정을 만들고 로그인합니다.';
      submitBtn.textContent = '회원가입';
      if (toggleBtn) toggleBtn.textContent = '이미 계정이 있나요? 로그인으로 전환';
    }
  }

  updateModeUi();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      EMAIL_AUTH_MODE = EMAIL_AUTH_MODE === 'login' ? 'signup' : 'login';
      updateModeUi();
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

    if (!email || !password) { alert('이메일과 비밀번호를 모두 입력해 주세요.'); return; }
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
      if (EMAIL_AUTH_MODE === 'login') {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } else {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
      }
      if (modal) modal.style.display = 'none';
      window.location.href = getRedirectTarget();
    } catch (error) {
      console.error('Email auth error:', error);
      if (isInvalidAuthSessionError(error)) {
        await firebase.auth().signOut().catch(function () {});
        clearStaleFirebaseAuthState();
      }
      var friendlyMessage = getFriendlyErrorMessage(error, false);
      alert(friendlyMessage || '인증 중 오류가 발생했습니다.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ── Exports ────────────────────────────────────────────────────────────────────
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.initAuth = initAuth;
window.getEnvironmentCheckError = getEnvironmentCheckError;
window.getFriendlyErrorMessage = getFriendlyErrorMessage;

document.addEventListener('DOMContentLoaded', initAuth);