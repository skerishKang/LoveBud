(function (global) {
  'use strict';

  if (global.LoveBudAuthLoginPage) return;

  function getDom() {
    return global.LoveBudLoginDom || null;
  }

  function getController() {
    return global.LoveBudLoginPageController || null;
  }

  /**
   * Delegates UI sync to the controller
   */
  function syncEmailAuthModeUi(options) {
    var controller = getController();
    if (controller && typeof controller.syncEmailAuthModeUi === 'function') {
      controller.syncEmailAuthModeUi(options);
    }
  }


  /**
   * Delegates Auth UI setup to the controller
   */
  function setupLoginPageAuthUi(options) {
    var controller = getController();
    if (controller && typeof controller.setupLoginPageAuthUi === 'function') {
      controller.setupLoginPageAuthUi(options);
    }
  }

  /**
   * Delegates Google button setup to the controller
   */
  function setupGoogleBtn(options) {
    var controller = getController();
    if (controller && typeof controller.setupGoogleBtn === 'function') {
      controller.setupGoogleBtn(options);
    }
  }

  /**
   * Delegates Signup Google button setup to the controller
   */
  function setupSignupGoogleBtn(options) {
    var controller = getController();
    if (controller && typeof controller.setupSignupGoogleBtn === 'function') {
      controller.setupSignupGoogleBtn(options);
    }
  }

  /**
   * Sets up the email auth form. 
   * This remains here as it's heavily tied to Firebase/Auth logic.
   */
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

    var dom = getDom();
    var elements = dom && typeof dom.getLoginElements === 'function' ? dom.getLoginElements() : {};
    var form = elements.emailAuthForm || document.getElementById('email-auth-form');

    if (!form) return;
    if (typeof firebaseRef === 'undefined' || !firebaseRef.auth) return;

    var controller = getController();
    if (controller && typeof controller.setupEmailAuthForm === 'function') {
      // Setup UI parts (modal, toggle, display name visibility) via controller
      controller.setupEmailAuthForm(options);
    }

    var emailInput = elements.emailAuthEmail || document.getElementById('email-auth-email');
    var passwordInput = elements.emailAuthPassword || document.getElementById('email-auth-password');
    var displayNameInput = elements.emailAuthDisplayName || document.getElementById('email-auth-display-name');
    var submitBtn = elements.emailAuthSubmit || document.getElementById('email-auth-submit');

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

  /**
   * Sets up the signup form (deprecated/rarely used in current flow but kept for compatibility)
   */
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

  global.LoveBudAuthLoginPage = {
    syncEmailAuthModeUi: syncEmailAuthModeUi,
    setupLoginPageAuthUi: setupLoginPageAuthUi,
    setupGoogleBtn: setupGoogleBtn,
    setupSignupGoogleBtn: setupSignupGoogleBtn,
    setupEmailAuthForm: setupEmailAuthForm,
    setupSignupForm: setupSignupForm
  };
})(window);
