(function (global) {
  'use strict';

  function noop() {}

  function getDom() {
    return global.LoveBudLoginDom || null;
  }

  function byId(id, root) {
    var dom = getDom();
    if (dom && typeof dom.byId === 'function') {
      return dom.byId(id, root);
    }
    var scope = root && typeof root.getElementById === 'function' ? root : global.document;
    return scope && id ? scope.getElementById(id) : null;
  }

  function query(selector, root) {
    var dom = getDom();
    if (dom && typeof dom.query === 'function') {
      return dom.query(selector, root);
    }
    var scope = root && typeof root.querySelector === 'function' ? root : global.document;
    return scope && selector ? scope.querySelector(selector) : null;
  }

  function getSelector(name) {
    var dom = getDom();
    return dom && dom.SELECTORS ? dom.SELECTORS[name] : null;
  }

  function getLoginElements(root) {
    var dom = getDom();
    if (dom && typeof dom.getLoginElements === 'function') {
      return dom.getLoginElements(root);
    }
    return {};
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

  function setupLoginPageAuthUi(options) {
    var isLoginPage = options && options.isLoginPage;
    var resolveEmailAuthMode = options && options.resolveEmailAuthMode;
    var setEmailAuthMode = options && options.setEmailAuthMode;
    var syncEmailAuthModeUiFn = options && options.syncEmailAuthModeUi;
    var root = options && options.root;

    if (typeof isLoginPage === 'function' && !isLoginPage()) return;

    var emailAuthMode = typeof resolveEmailAuthMode === 'function'
      ? resolveEmailAuthMode()
      : 'login';

    if (typeof setEmailAuthMode === 'function') {
      setEmailAuthMode(emailAuthMode);
    }

    var noticeEl = byId(getSelector('redirectNotice') || 'redirect-notice', root);
    if (noticeEl) {
      noticeEl.style.display = global.location && global.location.search ? 'block' : 'none';
    }

    if (typeof syncEmailAuthModeUiFn === 'function') {
      syncEmailAuthModeUiFn({
        emailAuthMode: emailAuthMode,
        titleEl: byId(getSelector('emailAuthTitle') || 'email-auth-title', root),
        helperEl: byId(getSelector('emailAuthHelper') || 'email-auth-helper', root),
        submitBtn: byId(getSelector('emailAuthSubmit') || 'email-auth-submit', root),
        toggleBtn: byId(getSelector('emailAuthToggle') || 'email-auth-toggle', root),
        badgeEl: byId(getSelector('authModeBadge') || 'auth-mode-badge', root)
      });
    }
  }

  function setupGoogleBtn(options) {
    var signInWithGoogle = options && options.signInWithGoogle;
    var root = options && options.root;
    var googleBtn = byId(getSelector('loginGoogleButton') || 'login-btn-google', root);
    if (!googleBtn) return;

    googleBtn.addEventListener('click', function (event) {
      event.preventDefault();
      if (typeof signInWithGoogle === 'function') {
        signInWithGoogle();
      }
    });
  }

  function setupSignupGoogleBtn(options) {
    var signUpWithGoogle = options && options.signUpWithGoogle;
    var root = options && options.root;
    var signupGoogleBtn = byId(getSelector('signupGoogleButton') || 'signup-btn-google', root);
    if (!signupGoogleBtn) return;

    signupGoogleBtn.addEventListener('click', function (event) {
      event.preventDefault();
      if (typeof signUpWithGoogle === 'function') {
        signUpWithGoogle();
      }
    });
  }

  function setupEmailAuthForm(options) {
    var getEmailAuthMode = options && options.getEmailAuthMode;
    var setEmailAuthMode = options && options.setEmailAuthMode;
    var syncEmailAuthModeUiFn = options && options.syncEmailAuthModeUi;
    var root = options && options.root;
    var elements = getLoginElements(root);
    var form = elements.emailAuthForm || byId(getSelector('emailAuthForm') || 'email-auth-form', root);
    if (!form) return;

    var modal = elements.emailAuthModal || byId(getSelector('emailAuthModal') || 'email-auth-modal', root);
    var emailBtn = elements.loginEmailButton || byId(getSelector('loginEmailButton') || 'login-btn-email', root);
    var closeBtn = elements.emailAuthClose || byId(getSelector('emailAuthClose') || 'email-auth-close', root);
    var toggleBtn = elements.emailAuthToggle || byId(getSelector('emailAuthToggle') || 'email-auth-toggle', root);
    var displayNameInput = elements.emailAuthDisplayName || byId(getSelector('emailAuthDisplayName') || 'email-auth-display-name', root);
    var displayNameWrap = elements.emailAuthDisplayNameWrap || query(getSelector('emailAuthDisplayNameWrap') || '[data-auth-display-name-wrap]', root);

    function getMode() {
      return typeof getEmailAuthMode === 'function' ? getEmailAuthMode() : 'login';
    }

    function updateModeUi() {
      if (typeof syncEmailAuthModeUiFn !== 'function') return;
      syncEmailAuthModeUiFn({
        emailAuthMode: getMode(),
        titleEl: elements.emailAuthTitle || byId(getSelector('emailAuthTitle') || 'email-auth-title', root),
        helperEl: elements.emailAuthHelper || byId(getSelector('emailAuthHelper') || 'email-auth-helper', root),
        submitBtn: elements.emailAuthSubmit || byId(getSelector('emailAuthSubmit') || 'email-auth-submit', root),
        toggleBtn: toggleBtn,
        badgeEl: elements.authModeBadge || byId(getSelector('authModeBadge') || 'auth-mode-badge', root)
      });
    }

    function syncDisplayNameVisibility() {
      if (!displayNameInput) return;
      var wrapper = displayNameWrap || (typeof displayNameInput.closest === 'function'
        ? displayNameInput.closest('[data-auth-display-name-wrap]')
        : null);
      if (!wrapper) return;
      var isSignup = getMode() === 'signup';
      wrapper.style.display = isSignup ? 'block' : 'none';
      displayNameInput.required = isSignup;
    }

    updateModeUi();
    syncDisplayNameVisibility();

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var nextMode = getMode() === 'login' ? 'signup' : 'login';
        if (typeof setEmailAuthMode === 'function') {
          setEmailAuthMode(nextMode);
        }
        updateModeUi();
        syncDisplayNameVisibility();
      });
    }

    if (emailBtn) {
      emailBtn.addEventListener('click', function (event) {
        event.preventDefault();
        if (modal) modal.style.display = 'flex';
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (modal) modal.style.display = 'none';
      });
    }

    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) modal.style.display = 'none';
      });
    }
  }

  var LoginPageController = Object.freeze({
    syncEmailAuthModeUi: syncEmailAuthModeUi,
    setupLoginPageAuthUi: setupLoginPageAuthUi,
    setupGoogleBtn: setupGoogleBtn,
    setupSignupGoogleBtn: setupSignupGoogleBtn,
    setupEmailAuthForm: setupEmailAuthForm,
    setupSignupForm: noop
  });

  global.LoveBudLoginPageController = LoginPageController;
})(window);
