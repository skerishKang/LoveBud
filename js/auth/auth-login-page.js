(function () {
  if (window.LoveBudAuthLoginPage) return;

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
    var redirect = params.get('redirect');
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

  function setupEmailAuthForm(options) {
    var firebaseRef = options && options.firebase;
    var initFirebase = options && options.initFirebase;
    var getEnvironmentCheckError = options && options.getEnvironmentCheckError;
    var getFriendlyErrorMessage = options && options.getFriendlyErrorMessage;
    var getEmailAuthMode = options && options.getEmailAuthMode;
    var setEmailAuthMode = options && options.setEmailAuthMode;
    var syncEmailAuthModeUiFn = options && options.syncEmailAuthModeUi;
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
    var toggleBtn = document.getElementById('email-auth-toggle');
    var modal = document.getElementById('email-auth-modal');
    var titleEl = document.getElementById('email-auth-title');
    var helperEl = document.getElementById('email-auth-helper');

    function updateModeUi() {
      if (typeof syncEmailAuthModeUiFn !== 'function') return;
      syncEmailAuthModeUiFn({
        emailAuthMode: typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login',
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
      var isSignup = (typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login') === 'signup';
      wrapper.style.display = isSignup ? 'block' : 'none';
      displayNameInput.required = isSignup;
    }

    updateModeUi();
    syncDisplayNameVisibility();

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var nextMode = (typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login') === 'login'
          ? 'signup'
          : 'login';
        if (typeof setEmailAuthMode === 'function') {
          setEmailAuthMode(nextMode);
        }
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
      if (password.length < 6) {
        alert('비밀번호는 최소 6자 이상이어야 합니다.');
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
    syncEmailAuthModeUi: syncEmailAuthModeUi,
    setupLoginPageAuthUi: setupLoginPageAuthUi,
    setupGoogleBtn: setupGoogleBtn,
    setupSignupGoogleBtn: setupSignupGoogleBtn,
    setupEmailAuthForm: setupEmailAuthForm,
    setupSignupForm: setupSignupForm
  };
})();
