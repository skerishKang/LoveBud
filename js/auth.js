/**
 * LoveBud - Authentication Module (Firebase Auth)
 * Adapted from 133-relovetree/src/auth.js
 *
 * Prerequisites (must be loaded BEFORE this file):
 *   1. Firebase SDK: firebase-app.js, firebase-auth.js
 *   2. js/firebase-config.js (provides FIREBASE_CONFIG + initFirebase())
 *
 * Supports:
 * - Google sign-in via Firebase Auth
 * - Email/password sign-in & sign-up via Firebase Auth
 * - Auth state persistence via Firebase (no localStorage stub)
 * - Nav UI update across all LoveBud pages
 */

var EMAIL_AUTH_MODE = 'login';
var AUTH_INIT_FLAG = '__lovebudAuthInitialized';

// ── Helpers ──

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

// ── Core Auth ──

/**
 * Initialize Authentication (called on DOMContentLoaded).
 * Safe to call on any page — gracefully degrades if Firebase SDK is absent.
 */
function initAuth() {
    // If Firebase SDK didn't load, fall back to simulated auth
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded. Auth running in offline mode.');
        initOfflineAuth();
        return;
    }

    // Ensure Firebase app is initialized
    if (typeof initFirebase === 'function') {
        initFirebase();
    }

    if (!firebase.apps || !firebase.apps.length) {
        console.error('Firebase not initialized. Auth setup aborted.');
        initOfflineAuth();
        return;
    }

    if (window[AUTH_INIT_FLAG]) return;
    window[AUTH_INIT_FLAG] = true;

    // Auth state observer
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

    // Set up page-specific elements
    setupGoogleBtn();
    setupEmailAuthForm();
}

/**
 * Offline fallback auth (when Firebase SDK is not available).
 * Uses localStorage to preserve basic login/logout nav UI behavior.
 */
function initOfflineAuth() {
    var isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    var navLoginLinks = document.querySelectorAll('a[href="login.html"]');
    if (isLoggedIn) {
        navLoginLinks.forEach(function (link) {
            link.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
            link.style.border = 'none';
            link.style.padding = '0';
            link.href = '#';
            link.onclick = function (e) {
                e.preventDefault();
                if (confirm('로그아웃 하시겠습니까?')) {
                    localStorage.removeItem('isLoggedIn');
                    window.location.reload();
                }
            };
        });
    }
}

/**
 * Sign In with Google
 */
async function signInWithGoogle() {
    if (!firebase.apps || !firebase.apps.length) {
        if (typeof initFirebase === 'function') initFirebase();
    }
    if (!firebase.apps || !firebase.apps.length) {
        console.error('Firebase not initialized before signInWithGoogle');
        return;
    }

    var provider = new firebase.auth.GoogleAuthProvider();
    try {
        provider.setCustomParameters({ prompt: 'select_account' });
    } catch (e) {}

    try {
        await firebase.auth().signInWithPopup(provider);
        // On login.html, redirect to dashboard after success
        if (isLoginPage()) {
            window.location.href = 'editor.html';
        }
    } catch (error) {
        console.error('Google login failed:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            alert('로그인에 실패했습니다: ' + error.message);
        }
    }
}

/**
 * Sign Out
 */
async function signOut() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            await firebase.auth().signOut();
        }
        clearStaleFirebaseAuthState();
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
        clearStaleFirebaseAuthState();
        window.location.reload();
    }
}

/**
 * Check if current page is login.html
 */
function isLoginPage() {
    return /login\.html/i.test(window.location.pathname);
}

// ── UI ──

/**
 * Update nav bar login link across all pages.
 * Logged in → user icon (click to logout)
 * Logged out → "로그인" text link
 */
function updateNavUI(user) {
    var navLoginLinks = document.querySelectorAll('a[href="login.html"]');

    if (user) {
        navLoginLinks.forEach(function (link) {
            link.textContent = '';
            link.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
            link.style.border = 'none';
            link.style.padding = '0';
            link.href = '#';
            link.onclick = function (e) {
                e.preventDefault();
                if (confirm('로그아웃 하시겠습니까?')) signOut();
            };
        });
    } else {
        navLoginLinks.forEach(function (link) {
            link.textContent = '로그인';
            link.style.border = '';
            link.style.padding = '';
            link.href = 'login.html';
            link.onclick = null;
        });
    }
}

/**
 * Wire up the Google sign-in button on login.html
 */
function setupGoogleBtn() {
    var googleBtn = document.querySelector('.login-btn-google');
    if (!googleBtn) return;
    // Remove any existing onclick to avoid double-binding
    googleBtn.onclick = null;
    googleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        signInWithGoogle();
    });
}

/**
 * Set up email auth modal + form on login.html
 */
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

    // Toggle login ↔ signup
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            EMAIL_AUTH_MODE = EMAIL_AUTH_MODE === 'login' ? 'signup' : 'login';
            updateModeUi();
        });
    }

    // Open modal from email button
    var emailBtn = document.getElementById('login-btn-email');
    if (emailBtn) {
        emailBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (modal) modal.style.display = 'flex';
        });
    }

    // Close modal
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

    // Form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!emailInput || !passwordInput || !submitBtn) return;

        var email = String(emailInput.value || '').trim();
        var password = String(passwordInput.value || '');

        if (!email || !password) {
            alert('이메일과 비밀번호를 모두 입력해 주세요.');
            return;
        }
        if (password.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        submitBtn.disabled = true;
        var originalText = submitBtn.textContent;
        submitBtn.textContent = EMAIL_AUTH_MODE === 'login' ? '로그인 중...' : '가입 중...';

        // Ensure Firebase is initialized
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
            // Redirect to dashboard on successful login
            if (isLoginPage()) {
                window.location.href = 'editor.html';
            }
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

// ── Exports ──
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.initAuth = initAuth;

// ── Auto-init ──
document.addEventListener('DOMContentLoaded', initAuth);
