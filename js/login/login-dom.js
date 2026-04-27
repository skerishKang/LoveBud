(function (global) {
  'use strict';

  var SELECTORS = Object.freeze({
    loginGoogleButton: 'login-btn-google',
    signupGoogleButton: 'signup-btn-google',
    emailAuthForm: 'email-auth-form',
    signupForm: 'signup-form',
    emailAuthModal: 'email-auth-modal',
    emailAuthToggle: 'email-auth-toggle',
    signupDisplayName: 'signup-display-name'
  });

  function byId(id, root) {
    var scope = root && typeof root.getElementById === 'function' ? root : global.document;
    return scope && id ? scope.getElementById(id) : null;
  }

  function getLoginElements(root) {
    return {
      loginGoogleButton: byId(SELECTORS.loginGoogleButton, root),
      signupGoogleButton: byId(SELECTORS.signupGoogleButton, root),
      emailAuthForm: byId(SELECTORS.emailAuthForm, root),
      signupForm: byId(SELECTORS.signupForm, root),
      emailAuthModal: byId(SELECTORS.emailAuthModal, root),
      emailAuthToggle: byId(SELECTORS.emailAuthToggle, root),
      signupDisplayName: byId(SELECTORS.signupDisplayName, root)
    };
  }

  global.LoveBudLoginDom = Object.freeze({
    SELECTORS: SELECTORS,
    byId: byId,
    getLoginElements: getLoginElements
  });
})(window);
