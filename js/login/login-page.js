(function (global) {
  'use strict';

  function noop() {}

  var LoginPageController = Object.freeze({
    syncEmailAuthModeUi: noop,
    setupLoginPageAuthUi: noop,
    setupGoogleBtn: noop,
    setupSignupGoogleBtn: noop,
    setupEmailAuthForm: noop,
    setupSignupForm: noop
  });

  global.LoveBudLoginPageController = LoginPageController;
})(window);
