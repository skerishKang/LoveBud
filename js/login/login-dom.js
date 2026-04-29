(function (global) {
  'use strict';

  var SELECTORS = Object.freeze({
    loginGoogleButton: 'login-btn-google',
    signupGoogleButton: 'signup-btn-google',
    emailAuthForm: 'email-auth-form',
    signupForm: 'signup-form',
    emailAuthModal: 'email-auth-modal',
    emailAuthToggle: 'email-auth-toggle',
    signupDisplayName: 'signup-display-name',
    loginEmailButton: 'login-btn-email',
    emailAuthClose: 'email-auth-close',
    emailAuthTitle: 'email-auth-title',
    emailAuthHelper: 'email-auth-helper',
    emailAuthSubmit: 'email-auth-submit',
    emailAuthDisplayName: 'email-auth-display-name',
    authModeBadge: 'auth-mode-badge',
    redirectNotice: 'redirect-notice',
    emailAuthDisplayNameWrap: '[data-auth-display-name-wrap]'
  });

  function byId(id, root) {
    var scope = root && typeof root.getElementById === 'function' ? root : global.document;
    return scope && id ? scope.getElementById(id) : null;
  }

  function query(selector, root) {
    var scope = root && typeof root.querySelector === 'function' ? root : global.document;
    return scope && selector ? scope.querySelector(selector) : null;
  }

  function getLoginElements(root) {
    return {
      loginGoogleButton: byId(SELECTORS.loginGoogleButton, root),
      signupGoogleButton: byId(SELECTORS.signupGoogleButton, root),
      emailAuthForm: byId(SELECTORS.emailAuthForm, root),
      signupForm: byId(SELECTORS.signupForm, root),
      emailAuthModal: byId(SELECTORS.emailAuthModal, root),
      emailAuthToggle: byId(SELECTORS.emailAuthToggle, root),
      signupDisplayName: byId(SELECTORS.signupDisplayName, root),
      loginEmailButton: byId(SELECTORS.loginEmailButton, root),
      emailAuthClose: byId(SELECTORS.emailAuthClose, root),
      emailAuthTitle: byId(SELECTORS.emailAuthTitle, root),
      emailAuthHelper: byId(SELECTORS.emailAuthHelper, root),
      emailAuthSubmit: byId(SELECTORS.emailAuthSubmit, root),
      emailAuthDisplayName: byId(SELECTORS.emailAuthDisplayName, root),
      authModeBadge: byId(SELECTORS.authModeBadge, root),
      redirectNotice: byId(SELECTORS.redirectNotice, root),
      emailAuthDisplayNameWrap: query(SELECTORS.emailAuthDisplayNameWrap, root)
    };
  }

  global.LoveBudLoginDom = Object.freeze({
    SELECTORS: SELECTORS,
    byId: byId,
    query: query,
    getLoginElements: getLoginElements
  });
})(window);
