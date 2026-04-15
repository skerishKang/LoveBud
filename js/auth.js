/**
 * LoveBud - Authentication Module (Firebase Auth)
 *
 * Safe to call on any page — gracefully degrades if Firebase SDK is absent.
 * Auth state observer updates #auth-nav (non-login pages) or #auth-nav-container (login.html).
 */

var EMAIL_AUTH_MODE = 'login';
var AUTH_INIT_FLAG = '__lovebudAuthInitialized';

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

function initAuth() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded. Auth running in offline mode.');
    initOfflineAuth();
    return;
  }

  if (typeof initFirebase === 'function') initFirebase();

  if (!firebase.apps || !firebase.apps.length) {
    console.error('Firebase not initialized. Auth setup aborted.');
    initOfflineAuth();
    return;
  }

  if (window[AUTH_INIT_FLAG]) return;
  window[AUTH_INIT_FLAG] = true;

  firebase.auth().onAuthStateChanged(async function (user) {
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
  updateNavUI(isLoggedIn ? { uid: 'offline', displayName: 'Offline User' } : null);
}

// ── UI Builders ───────────────────────────────────────────────────────────────

function buildLoginButton() {
  return '<a href="login.html" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>';
}

function buildUserDropdown(user) {
  var name = (user && (user.displayName || user.email || '내 계정')) || '내 계정';
  return [
    '<div class="user-dropdown" id="userDropdown">',
    '<button class="user-dropdown-trigger btn-round btn-primary" style="padding:8px 16px;display:flex;align-items:center;gap:8px;" aria-label="User menu">',
    '<span class="material-symbols-outlined">account_circle</span>',
    '<span>' + name + '</span>',
    '</button>',
    '<div class="user-dropdown-menu">',
    '<a href="editor.html" class="user-dropdown-item"><span class="material-symbols-outlined">account_tree</span>내 러브트리</a>',
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
 * - Non-login pages: writes to #auth-nav innerHTML
 * - Login page: writes to #auth-nav-container (always present, initially empty)
 *
 * Never destroys surrounding nav elements.
 */
function updateNavUI(user) {
  // Determine which container to use
  var authNav = document.getElementById('auth-nav');
  var authContainer = document.getElementById('auth-nav-container');

  if (user) {
    // ── Logged in: show user dropdown ──
    var html = buildUserDropdown(user);
    if (authNav) authNav.innerHTML = html;
    if (authContainer) authContainer.innerHTML = html;
    setupDropdownToggle();
  } else {
    // ── Logged out: show login button ──
    var html = buildLoginButton();
    if (authNav) authNav.innerHTML = html;
    // authContainer stays empty on login page (it has its own login form)
  }
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

var dropdownToggleInitialized = false;
function setupDropdownToggle() {
  if (dropdownToggleInitialized) return;
  dropdownToggleInitialized = true;
  // Event delegation for dropdown toggle
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.user-dropdown-trigger');
    if (trigger) {
      e.stopPropagation();
      var dropdown = trigger.closest('.user-dropdown');
      if (!dropdown) return;
      var menu = dropdown.querySelector('.user-dropdown-menu');
      if (!menu) return;
      // close other open menus
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        if (m !== menu) m.classList.remove('show');
      });
      menu.classList.toggle('show');
      return;
    }
    // click outside any dropdown closes all
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
  return params.get('redirect') || 'editor.html';
}

async function signInWithGoogle() {
  if (!firebase.apps || !firebase.apps.length) {
    if (typeof initFirebase === 'function') initFirebase();
  }
  if (!firebase.apps || !firebase.apps.length) {
    console.error('Firebase not initialized before signInWithGoogle');
    return;
  }

  var provider = new firebase.auth.GoogleAuthProvider();
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) {}

  try {
    await firebase.auth().signInWithPopup(provider);
    window.location.href = getRedirectTarget();
  } catch (error) {
    console.error('Google login failed:', error);
    if (error.code !== 'auth/popup-closed-by-user') {
      alert('로그인에 실패했습니다: ' + error.message);
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
  try { localStorage.removeItem('isLoggedIn'); } catch (e) {}
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
    if (!emailInput || !passwordInput || !submitBtn) return;

    var email = String(emailInput.value || '').trim();
    var password = String(passwordInput.value || '');

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
      alert('인증 중 오류가 발생했습니다: ' + error.message);
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

document.addEventListener('DOMContentLoaded', initAuth);