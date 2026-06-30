(function () {
  if (window.LoveBudAuthLoginPage) return;

  function isCurrentLoginPage() {
    var path = window.location.pathname || '';
    return path.indexOf('/pages/login.html') !== -1 ||
      path.indexOf('/pages/login') !== -1 ||
      path.indexOf('login.html') !== -1;
  }

  function getLoginCard() {
    return document.querySelector('.login-card');
  }

  function hideLoginCard() {
    var card = getLoginCard();
    if (!card) return;
    card.style.visibility = 'hidden';
    card.setAttribute('aria-hidden', 'true');
  }

  function showLoginCard() {
    var card = getLoginCard();
    if (!card) return;
    card.style.visibility = '';
    card.setAttribute('aria-hidden', 'false');
  }

  function clearLoginHeaderAuthState() {
    var authContainer = document.getElementById('auth-nav-container');
    if (authContainer) authContainer.innerHTML = '';
  }

  function resolveLoginRedirectTarget() {
    try {
      if (window.LoveBudAuthSession && typeof window.LoveBudAuthSession.getRedirectTarget === 'function') {
        return window.LoveBudAuthSession.getRedirectTarget();
      }
    } catch (error) {
      // fallback below
    }
    // 세션 normalizer 미사용 시 안전한 기본값만 반환
    return 'my-trees.html';
  }

  function bindLoginAuthState() {
    if (!isCurrentLoginPage()) return;
    hideLoginCard();

    if (window.__lovebudLoginAuthStateBound) return;
    window.__lovebudLoginAuthStateBound = true;

    try {
      if (typeof initFirebase === 'function') initFirebase();
      var auth = window.firebase && typeof window.firebase.auth === 'function'
        ? window.firebase.auth()
        : null;
      if (!auth || typeof auth.onAuthStateChanged !== 'function') return;

      auth.onAuthStateChanged(function (user) {
        if (user) {
          window.location.href = resolveLoginRedirectTarget();
          return;
        }
        clearLoginHeaderAuthState();
        showLoginCard();
      });
    } catch (error) {
    }
  }

  function syncEmailAuthModeUi(options) {
    var emailAuthMode = options && options.emailAuthMode;
    var titleEl = options && options.titleEl;
    var helperEl = options && options.helperEl;
    var submitBtn = options && options.submitBtn;
    var toggleBtn = options && options.toggleBtn;
    var badgeEl = options && options.badgeEl;
    var applyI18n = options && options.applyI18n;

    var isSignup = emailAuthMode === 'signup';

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

    if (typeof applyI18n === 'function') {
      applyI18n();
    }
  }

  var EMAIL_AUTH_EXECUTION_METHODS = {
    setupEmailAuthEntry: true,
    setupEmailAuthForm: true,
    setupSignupForm: true
  };

  function getLoginPageModule(methodName) {
    if (methodName && EMAIL_AUTH_EXECUTION_METHODS[methodName]) {
      if (window.LoveBudAuthLoginPage) return window.LoveBudAuthLoginPage;
      return null;
    }
    if (window.LoveBudLoginPageController) return window.LoveBudLoginPageController;
    return window.LoveBudAuthLoginPage || null;
  }

  function callLoginPageModule(methodName, args) {
    var loginPageModule = getLoginPageModule(methodName);
    if (!loginPageModule || typeof loginPageModule[methodName] !== 'function') {
      return false;
    }
    loginPageModule[methodName].apply(loginPageModule, args || []);
    return true;
  }

  function setupLoginPageAuthUi(options) {
    var isLoginPage = options && options.isLoginPage;
    var resolveEmailAuthMode = options && options.resolveEmailAuthMode;
    var setEmailAuthMode = options && options.setEmailAuthMode;
    var syncEmailAuthModeUiFn = options && options.syncEmailAuthModeUi;

    if (typeof isLoginPage === 'function' && !isLoginPage()) return;

    var emailAuthMode = typeof resolveEmailAuthMode === 'function'
      ? resolveEmailAuthMode()
      : 'login';

    if (typeof setEmailAuthMode === 'function') {
      setEmailAuthMode(emailAuthMode);
    }

    var params = new URLSearchParams(window.location.search);
    var redirect = params.get('redirect') || params.get('returnTo');
    var noticeEl = document.getElementById('redirect-notice');
    if (noticeEl) {
      noticeEl.style.display = redirect ? 'block' : 'none';
    }

    if (typeof syncEmailAuthModeUiFn === 'function') {
      syncEmailAuthModeUiFn({
        emailAuthMode: emailAuthMode,
        titleEl: document.getElementById('email-auth-title'),
        helperEl: document.getElementById('email-auth-helper'),
        submitBtn: document.getElementById('email-auth-submit'),
        toggleBtn: document.getElementById('email-auth-toggle'),
        badgeEl: document.getElementById('auth-mode-badge')
      });
    }
  }

  function setupGoogleBtn(options) {
    var signInWithGoogle = options && options.signInWithGoogle;
    var googleBtn = document.getElementById('login-btn-google');
    if (!googleBtn) return;

    googleBtn.onclick = null;
    googleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof signInWithGoogle === 'function') {
        signInWithGoogle();
      }
    });
  }

  function setupSignupGoogleBtn(options) {
    var signUpWithGoogle = options && options.signUpWithGoogle;
    var signupGoogleBtn = document.getElementById('signup-btn-google');
    if (!signupGoogleBtn) return;

    signupGoogleBtn.onclick = null;
    signupGoogleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof signUpWithGoogle === 'function') {
        signUpWithGoogle();
      }
    });
  }

  function setupEmailAuthEntry(options) {
    if (window.__lovebudEmailAuthEntryBound) return;
    window.__lovebudEmailAuthEntryBound = true;

    var setEmailAuthMode = options && options.setEmailAuthMode;
    var getEmailAuthMode = options && options.getEmailAuthMode;
    var syncEmailAuthModeUiFn = options && options.syncEmailAuthModeUi;
    var applyI18n = options && options.applyI18n;
    var initialMode = (options && options.initialMode) || 'login';

    var modal = document.getElementById('email-auth-modal');
    var closeBtn = document.getElementById('email-auth-close');
    var toggleBtn = document.getElementById('email-auth-toggle');
    var emailBtn = document.getElementById('login-btn-email');
    var signupBtn = document.getElementById('signup-btn-email');
    var lastTriggerButton = null;

    // Set canonical mode immediately
    if (typeof setEmailAuthMode === 'function') {
      setEmailAuthMode(initialMode);
    }

    function syncAllUi() {
      var mode = typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login';

      // Title/helper/badge/submit/toggle text via canonical syncEmailAuthModeUi
      if (typeof syncEmailAuthModeUiFn === 'function') {
        syncEmailAuthModeUiFn({
          emailAuthMode: mode,
          titleEl: document.getElementById('email-auth-title'),
          helperEl: document.getElementById('email-auth-helper'),
          submitBtn: document.getElementById('email-auth-submit'),
          toggleBtn: toggleBtn,
          badgeEl: document.getElementById('auth-mode-badge'),
          applyI18n: typeof applyI18n === 'function' ? applyI18n : undefined
        });
      }

      // Display name visibility + required
      var displayNameInput = document.getElementById('email-auth-display-name');
      var displayNameWrap = displayNameInput && (typeof displayNameInput.closest === 'function'
        ? displayNameInput.closest('[data-auth-display-name-wrap]')
        : null);
      if (displayNameInput && displayNameWrap) {
        var isSignup = mode === 'signup';
        displayNameWrap.style.display = isSignup ? 'block' : 'none';
        displayNameInput.required = isSignup;
      }

      // Reset password visibility + disabled
      var resetWrap = document.getElementById('email-auth-reset-wrap');
      var resetBtn = document.getElementById('email-auth-reset');
      if (resetWrap && resetBtn) {
        resetWrap.hidden = mode === 'signup';
        resetBtn.disabled = mode === 'signup';
      }

      // Focus email input
      var emailInput = document.getElementById('email-auth-email');
      if (emailInput) { try { emailInput.focus(); } catch (e) {} }
    }

    function openModal(mode) {
      if (typeof setEmailAuthMode === 'function') {
        setEmailAuthMode(mode);
      }
      syncAllUi();
      if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
      if (modal) modal.style.display = 'none';
      if (lastTriggerButton && typeof lastTriggerButton.focus === 'function') {
        try { lastTriggerButton.focus(); } catch (e) {}
        lastTriggerButton = null;
      }
    }

    // ── login CTA ──
    if (emailBtn) {
      replaceEventListener(emailBtn, '__lovebudEmailEntryLoginOpen', 'click', function (e) {
        e.preventDefault();
        lastTriggerButton = emailBtn;
        openModal('login');
      });
    }

    // ── signup CTA ──
    if (signupBtn) {
      replaceEventListener(signupBtn, '__lovebudEmailEntrySignupOpen', 'click', function (e) {
        e.preventDefault();
        lastTriggerButton = signupBtn;
        openModal('signup');
      });
    }

    // ── close button ──
    if (closeBtn) {
      replaceEventListener(closeBtn, '__lovebudEmailEntryClose', 'click', function () {
        closeModal();
      });
    }

    // ── backdrop + Escape ──
    if (modal) {
      replaceEventListener(modal, '__lovebudEmailEntryBackdrop', 'click', function (e) {
        if (e.target === modal) closeModal();
      });
      replaceEventListener(modal, '__lovebudEmailEntryKeydown', 'keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') closeModal();
      });
    }

    // ── login/signup toggle ──
    if (toggleBtn) {
      replaceEventListener(toggleBtn, '__lovebudEmailEntryToggle', 'click', function () {
        var currentMode = typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login';
        var nextMode = currentMode === 'login' ? 'signup' : 'login';
        if (typeof setEmailAuthMode === 'function') {
          setEmailAuthMode(nextMode);
        }
        syncAllUi();
      });
    }

    // ── Tab focus trap ──
    if (modal) {
      modal.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var focusable = modal.querySelectorAll(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            try { last.focus(); } catch (e2) {}
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            try { first.focus(); } catch (e2) {}
          }
        }
      });
    }
  }

  function setupEmailAuthForm(options) {
    var firebaseRef = options && options.firebase;
    var initFirebase = options && options.initFirebase;
    var getEnvironmentCheckError = options && options.getEnvironmentCheckError;
    var getFriendlyErrorMessage = options && options.getFriendlyErrorMessage;
    var getEmailAuthMode = options && options.getEmailAuthMode;
    var setEmailAuthMode = options && options.setEmailAuthMode;
    var persistConfirmedAuthSession = options && options.persistConfirmedAuthSession;
    var preloadRedirectTargetData = options && options.preloadRedirectTargetData;
    var getRedirectTarget = options && options.getRedirectTarget;
    var isInvalidAuthSessionError = options && options.isInvalidAuthSessionError;
    var clearStaleFirebaseAuthState = options && options.clearStaleFirebaseAuthState;

    var form = document.getElementById('email-auth-form');
    if (!form) return;
    if (typeof firebaseRef === 'undefined' || !firebaseRef.auth) return;

    var emailInput = document.getElementById('email-auth-email');
    var passwordInput = document.getElementById('email-auth-password');
    var displayNameInput = document.getElementById('email-auth-display-name');
    var submitBtn = document.getElementById('email-auth-submit');
    var resetBtn = document.getElementById('email-auth-reset');
    var resetWrap = document.getElementById('email-auth-reset-wrap');

    function syncResetVisibility() {
      var isLogin = typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login';
      isLogin = isLogin === 'login';
      if (resetWrap) resetWrap.hidden = !isLogin;
      if (resetBtn) resetBtn.disabled = !isLogin;
    }

    // Only form submit + password reset — all UI binding is in setupEmailAuthEntry
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var envError = typeof getEnvironmentCheckError === 'function'
        ? getEnvironmentCheckError()
        : null;
      if (envError) {
        alert(envError);
        return;
      }

      if (!emailInput || !passwordInput || !submitBtn) return;

      var email = String(emailInput.value || '').trim();
      var password = String(passwordInput.value || '').trim();
      var displayName = String(displayNameInput && displayNameInput.value || '').trim();
      var emailAuthMode = typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login';

      if (!email || !password) {
        alert('이메일과 비밀번호를 모두 입력해 주세요.');
        return;
      }
      if (emailAuthMode === 'signup' && !displayName) {
        alert('닉네임을 입력해 주세요.');
        return;
      }
      if (password.length < 8) {
        alert('비밀번호는 최소 8자 이상이어야 합니다.');
        return;
      }

      submitBtn.disabled = true;
      var originalText = submitBtn.textContent;
      submitBtn.textContent = emailAuthMode === 'login' ? '로그인 중...' : '가입 중...';

      if (typeof initFirebase === 'function') initFirebase();
      if (!firebaseRef.apps || !firebaseRef.apps.length) {
        alert('Firebase가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      try {
        var authUser;
        if (emailAuthMode === 'login') {
          var loginResult = await firebaseRef.auth().signInWithEmailAndPassword(email, password);
          authUser = loginResult && loginResult.user ? loginResult.user : firebaseRef.auth().currentUser;
        } else {
          var signupResult = await firebaseRef.auth().createUserWithEmailAndPassword(email, password);
          if (signupResult && signupResult.user && typeof signupResult.user.updateProfile === 'function') {
            await signupResult.user.updateProfile({ displayName: displayName });
          }
          authUser = signupResult && signupResult.user ? signupResult.user : firebaseRef.auth().currentUser;
        }

        if (typeof persistConfirmedAuthSession === 'function') {
          await persistConfirmedAuthSession(authUser);
        }
        if (typeof preloadRedirectTargetData === 'function') {
          preloadRedirectTargetData();
        }
        window.location.href = typeof getRedirectTarget === 'function'
          ? getRedirectTarget()
          : 'pages/my-trees.html';
      } catch (error) {
        console.error('Email auth error:', error);
        if (typeof isInvalidAuthSessionError === 'function' && isInvalidAuthSessionError(error)) {
          await firebaseRef.auth().signOut().catch(function () {});
          if (typeof clearStaleFirebaseAuthState === 'function') {
            clearStaleFirebaseAuthState();
          }
        }
        var friendlyMessage = typeof getFriendlyErrorMessage === 'function'
          ? getFriendlyErrorMessage(error, false)
          : '인증 중 오류가 발생했습니다.';
        alert(friendlyMessage || '인증 중 오류가 발생했습니다.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    function getResetLabel(key, fallback) {
      var loginI18n = window.i18nLogin || {};
      var lang = (typeof window.getCurrentLang === 'function' ? window.getCurrentLang() : 'ko') || 'ko';
      var dict = loginI18n[key];
      return dict ? (dict[lang] || dict.ko || fallback) : fallback;
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async function () {
        if (!emailInput) return;

        var email = String(emailInput.value || '').trim();
        if (!email) {
          alert(getResetLabel('password_reset_email_required', '비밀번호를 재설정할 이메일 주소를 입력해 주세요.'));
          emailInput.focus();
          return;
        }

        // Validate email format before calling Firebase
        if (emailInput.checkValidity && !emailInput.checkValidity()) {
          var formatError = typeof getFriendlyErrorMessage === 'function'
            ? getFriendlyErrorMessage({ code: 'auth/invalid-email' }, false)
            : '올바른 이메일 형식이 아닙니다.';
          alert(formatError);
          emailInput.focus();
          return;
        }
        // Simple regex guard for environments where checkValidity may not catch all cases
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          var formatError = typeof getFriendlyErrorMessage === 'function'
            ? getFriendlyErrorMessage({ code: 'auth/invalid-email' }, false)
            : '올바른 이메일 형식이 아닙니다.';
          alert(formatError);
          emailInput.focus();
          return;
        }

        var envError = typeof getEnvironmentCheckError === 'function'
          ? getEnvironmentCheckError()
          : null;
        if (envError) {
          alert(envError);
          return;
        }

        if (typeof initFirebase === 'function') initFirebase();
        if (!firebaseRef.apps || !firebaseRef.apps.length) {
          alert('Firebase가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.');
          return;
        }

        resetBtn.disabled = true;
        var originalText = resetBtn.textContent;
        resetBtn.textContent = getResetLabel('password_reset_sending', '링크 보내는 중…');

        try {
          await firebaseRef.auth().sendPasswordResetEmail(email);
          alert(getResetLabel('password_reset_confirmation', '입력한 이메일이 등록되어 있다면 비밀번호 재설정 링크를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.'));
        } catch (error) {
          console.error('Password reset error:', error);
          if (error.code === 'auth/user-not-found') {
            alert(getResetLabel('password_reset_confirmation', '입력한 이메일이 등록되어 있다면 비밀번호 재설정 링크를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.'));
          } else {
            var friendlyMessage = typeof getFriendlyErrorMessage === 'function'
              ? getFriendlyErrorMessage(error, false)
              : '비밀번호 재설정 중 오류가 발생했습니다.';
            alert(friendlyMessage || '비밀번호 재설정 중 오류가 발생했습니다.');
          }
        } finally {
          resetBtn.textContent = originalText;
          syncResetVisibility();
        }
      });
    }
  }

  function setupSignupForm(options) {
    var firebaseRef = options && options.firebase;
    var initFirebase = options && options.initFirebase;
    var getEnvironmentCheckError = options && options.getEnvironmentCheckError;
    var getFriendlyErrorMessage = options && options.getFriendlyErrorMessage;
    var persistConfirmedAuthSession = options && options.persistConfirmedAuthSession;
    var preloadRedirectTargetData = options && options.preloadRedirectTargetData;
    var getRedirectTarget = options && options.getRedirectTarget;

    var signupForm = document.getElementById('signup-form');
    if (!signupForm) return;
    if (typeof firebaseRef === 'undefined' || !firebaseRef.auth) return;

    var displayNameInput = document.getElementById('signup-display-name');
    var emailInput = document.getElementById('signup-email');
    var passwordInput = document.getElementById('signup-password');
    var submitBtn = document.getElementById('signup-submit');

    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var envError = typeof getEnvironmentCheckError === 'function'
        ? getEnvironmentCheckError()
        : null;
      if (envError) {
        alert(envError);
        return;
      }

      var displayName = String(displayNameInput && displayNameInput.value || '').trim();
      var email = String(emailInput && emailInput.value || '').trim();
      var password = String(passwordInput && passwordInput.value || '').trim();

      if (!displayName || !email || !password) {
        alert('닉네임, 이메일, 비밀번호를 입력해주세요.');
        return;
      }
      if (password.length < 8) {
        alert('비밀번호는 최소 8자 이상이어야 합니다.');
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
        if (!firebaseRef.apps || !firebaseRef.apps.length) {
          throw new Error('Firebase not initialized');
        }

        var signupResult = await firebaseRef.auth().createUserWithEmailAndPassword(email, password);
        if (signupResult && signupResult.user && typeof signupResult.user.updateProfile === 'function') {
          await signupResult.user.updateProfile({ displayName: displayName });
        }

        if (typeof persistConfirmedAuthSession === 'function') {
          await persistConfirmedAuthSession(signupResult && signupResult.user ? signupResult.user : firebaseRef.auth().currentUser);
        }
        if (typeof preloadRedirectTargetData === 'function') {
          preloadRedirectTargetData();
        }
        window.location.href = typeof getRedirectTarget === 'function'
          ? getRedirectTarget()
          : 'pages/my-trees.html';
      } catch (error) {
        console.error('Signup error:', error);
        var friendlyMessage = typeof getFriendlyErrorMessage === 'function'
          ? getFriendlyErrorMessage(error, false)
          : '회원가입 중 오류가 발생했습니다.';
        alert(friendlyMessage || '회원가입 중 오류가 발생했습니다.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  window.LoveBudAuthLoginPage = {
    getLoginPageModule: getLoginPageModule,
    callLoginPageModule: callLoginPageModule,
    syncEmailAuthModeUi: syncEmailAuthModeUi,
    setupLoginPageAuthUi: setupLoginPageAuthUi,
    setupGoogleBtn: setupGoogleBtn,
    setupSignupGoogleBtn: setupSignupGoogleBtn,
    setupEmailAuthEntry: setupEmailAuthEntry,
    setupEmailAuthForm: setupEmailAuthForm,
    setupSignupForm: setupSignupForm
  };

  bindLoginAuthState();
})();
