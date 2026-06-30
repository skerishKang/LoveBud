/**
 * LoveBud - Email Auth Entry Module
 * 
 * Standalone module that binds email login/signup buttons to open the
 * shared email auth modal.  Independent of Firebase — pure UI binding
 * that runs on DOMContentLoaded so the buttons are guaranteed to work
 * even when Firebase isn't ready yet.
 * 
 * Version: 1.0.0
 */
(function () {
  'use strict';

  if (window.LoveBudAuthEmailEntry) return;
  window.LoveBudAuthEmailEntry = true;

  /* ── Helpers ────────────────────────────────────────────────────── */

  function byId(id) {
    try { return document.getElementById(id); } catch (e) { return null; }
  }

  function isLoginPage() {
    var path = window.location.pathname || '';
    return path.indexOf('/pages/login') !== -1 ||
           path.indexOf('login.html') !== -1;
  }

  function isSignupPage() {
    var path = window.location.pathname || '';
    return path.indexOf('/pages/signup') !== -1 ||
           path.indexOf('signup.html') !== -1;
  }

  /* ── Focus-return tracking ──────────────────────────────────────── */

  var lastTriggerButton = null;

  /* ── Sync display name & reset visibility for mode ──────────────── */

  function syncSignupModeUi(mode) {
    var isSignup = mode === 'signup';
    var displayNameInput = byId('email-auth-display-name');
    var displayNameWrap =
      displayNameInput &&
      (displayNameInput.closest
        ? displayNameInput.closest('[data-auth-display-name-wrap]')
        : null);
    var resetWrap = byId('email-auth-reset-wrap');
    var resetBtn = byId('email-auth-reset');
    var submitBtn = byId('email-auth-submit');
    var titleEl = byId('email-auth-title');
    var helperEl = byId('email-auth-helper');
    var badgeEl = byId('auth-mode-badge');
    var toggleBtn = byId('email-auth-toggle');

    // Display name
    if (displayNameWrap) {
      displayNameWrap.style.display = isSignup ? 'block' : 'none';
    }
    if (displayNameInput) {
      displayNameInput.required = isSignup;
    }

    // Reset password
    if (resetWrap) {
      resetWrap.hidden = isSignup;
      resetWrap.style.display = isSignup ? 'none' : '';
    }
    if (resetBtn) {
      resetBtn.disabled = isSignup;
    }

    // Badge
    if (badgeEl) {
      badgeEl.textContent = isSignup ? '회원가입' : '로그인';
      badgeEl.style.background = isSignup
        ? 'var(--secondary, #d8839a)'
        : 'var(--primary, #904951)';
    }

    // Title
    if (titleEl) {
      titleEl.textContent = isSignup
        ? '이메일로 회원가입'
        : '이메일로 로그인';
    }

    // Helper
    if (helperEl) {
      helperEl.textContent = isSignup
        ? '새 이메일 계정을 만들고 로그인합니다.'
        : '이미 만든 이메일 계정으로 로그인합니다.';
    }

    // Submit button
    if (submitBtn) {
      submitBtn.textContent = isSignup ? '회원가입' : '로그인';
    }

    // Toggle button
    if (toggleBtn) {
      toggleBtn.textContent = isSignup
        ? '이미 계정이 있나요? 로그인으로 전환'
        : '계정이 없나요? 회원가입으로 전환';
    }
  }

  /* ── Open modal ─────────────────────────────────────────────────── */

  function openEmailAuthModal(initialMode) {
    var modal = byId('email-auth-modal');
    if (!modal) return;

    // Set initial auth mode so downstream modules (auth.js etc.) pick it up
    window.__initialAuthMode = initialMode || 'login';

    // Sync modal UI for the chosen mode
    syncSignupModeUi(initialMode || 'login');

    // Show modal
    modal.style.display = 'flex';

    // Focus first input
    var emailInput = byId('email-auth-email');
    if (emailInput) {
      try { emailInput.focus(); } catch (e) {}
    }
  }

  function closeEmailAuthModal() {
    var modal = byId('email-auth-modal');
    if (!modal) return;
    modal.style.display = 'none';

    // Restore focus to the trigger button
    if (lastTriggerButton && typeof lastTriggerButton.focus === 'function') {
      try { lastTriggerButton.focus(); } catch (e) {}
      lastTriggerButton = null;
    }
  }

  /* ── Bind buttons ───────────────────────────────────────────────── */

  function bindEmailEntryButtons() {
    // Prevent double-binding
    if (window.__lovebudEmailEntryBound) return;
    window.__lovebudEmailEntryBound = true;

    var loginBtn = byId('login-btn-email');
    var signupBtn = byId('signup-btn-email');
    var modal = byId('email-auth-modal');
    var closeBtn = byId('email-auth-close');
    var toggleBtn = byId('email-auth-toggle');

    // ── open triggers ──

    if (loginBtn) {
      loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        lastTriggerButton = loginBtn;
        openEmailAuthModal('login');
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', function (e) {
        e.preventDefault();
        lastTriggerButton = signupBtn;
        openEmailAuthModal('signup');
      });
    }

    // ── close triggers ──

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeEmailAuthModal();
      });
    }

    if (modal) {
      // Backdrop click
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeEmailAuthModal();
        }
      });

      // Escape key
      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          closeEmailAuthModal();
        }
      });
    }

    // ── login/signup toggle inside modal ──

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var currentMode = window.__initialAuthMode || 'login';
        var nextMode = currentMode === 'login' ? 'signup' : 'login';
        window.__initialAuthMode = nextMode;
        syncSignupModeUi(nextMode);

        // Focus email input after toggle
        var emailInput = byId('email-auth-email');
        if (emailInput) {
          try { emailInput.focus(); } catch (e) {}
        }
      });
    }

    // ── Keyboard accessibility: trap focus in modal when open ──

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

  /* ── Init ────────────────────────────────────────────────────────── */

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        bindEmailEntryButtons();
      });
    } else {
      bindEmailEntryButtons();
    }
  }

  init();
})();
