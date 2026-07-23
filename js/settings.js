/**
 * LoveBud - Settings Module
 * v20260504-639-stay
 *
 * Settings should stay on settings.html after entry.
 * v20260721-3583: add read-only Profile / Account foundation.
 * v20260724-3635: add password reset email action (Firebase compat sendPasswordResetEmail).
 */

(function() {
  function isSettingsDebugEnabled() {
    return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SETTINGS_DEBUG === true;
  }

  function settingsDebugLog() {
    if (!isSettingsDebugEnabled() || !window.console || typeof console.log !== 'function') return;
    console.log.apply(console, arguments);
  }

  var SETTINGS_KEY = 'lovebud_user_settings';
  var SETTINGS_AUTH_RECOVERY_TIMEOUT_MS = 1200;
  var DEFAULT_SETTINGS = {
    defaultVisibility: 'private'
  };

  function isSettingsPath(pathname) {
    return /(?:^|\/)settings(?:\.html)?$/.test(pathname || '');
  }

  function normalizeReturnTarget(value) {
    var url = new URL(value || '/', window.location.origin);
    return url.pathname + url.search + url.hash;
  }

  function isSafeReturnTarget(value) {
    if (!value || typeof value !== 'string') return false;
    if (/^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return false;
    try {
      var url = new URL(value, window.location.origin);
      var sameOrigin = url.origin === window.location.origin;
      if (!sameOrigin || isSettingsPath(url.pathname)) return false;
      return url.pathname === '/' || /[a-zA-Z0-9_-]+\.html$/.test(url.pathname);
    } catch (e) {
      return false;
    }
  }

  function getReturnToHref() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var returnTo = params.get('returnTo');
      if (returnTo && isSafeReturnTarget(returnTo)) {
        return normalizeReturnTarget(returnTo);
      }
    } catch (e) {
      console.warn('[settings] Failed to parse returnTo:', e);
    }

    try {
      if (document.referrer) {
        var refUrl = new URL(document.referrer, window.location.origin);
        var refTarget = refUrl.pathname + refUrl.search + refUrl.hash;
        if (isSafeReturnTarget(refTarget)) {
          return refTarget;
        }
      }
    } catch (e) {
      console.warn('[settings] Failed to parse referrer:', e);
    }

    return '../index.html';
  }

  function closeSettings() {
    var fallbackHref = getReturnToHref();
    if (fallbackHref) {
      window.location.href = fallbackHref;
      return;
    }

    try {
      if (window.history.length > 1 && document.referrer && !document.referrer.includes('settings.html')) {
        window.history.back();
        return;
      }
    } catch (e) {
      console.warn('[settings] history.back failed:', e);
    }

    window.location.href = '../index.html';
  }

  function loadSettings() {
    try {
      var stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[settings] Failed to load settings:', e);
    }
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function getConfirmedSessionUser() {
    try {
      if (window.LoveBudProtectedRoute) {
        var state = window.LoveBudProtectedRoute.getAuthState();
        if (state.ready && state.user) return state.user;
      }
      if (window.getConfirmedAuthUser) {
        return window.getConfirmedAuthUser();
      }
      if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
        var raw = localStorage.getItem('lovebud_auth_cache');
        if (raw && raw !== 'null') {
          return JSON.parse(raw);
        }
      }
    } catch (e) {}
    return null;
  }

  function isAuthenticatedUser(user) {
    return !!(user && user.uid);
  }

  function resolveEffectiveUser(user) {
    if (isAuthenticatedUser(user)) return user;
    var cachedUser = getConfirmedSessionUser();
    if (isAuthenticatedUser(cachedUser)) return cachedUser;
    return null;
  }

  function getLoginRedirectHref() {
    var target = window.location.pathname + window.location.search + window.location.hash;
    try {
      var params = new URLSearchParams(window.location.search || '');
      var returnTo = params.get('returnTo');
      if (returnTo && isSafeReturnTarget(returnTo)) {
        target = window.location.pathname + '?returnTo=' + encodeURIComponent(normalizeReturnTarget(returnTo));
      }
    } catch (e) {}

    return 'login.html?returnTo=' + encodeURIComponent(target);
  }

  function redirectToLogin() {
    window.location.replace(getLoginRedirectHref());
  }

  function getLiveFirebaseUser() {
    try {
      if (typeof initFirebase === 'function') initFirebase();
      if (typeof firebase === 'undefined' || !firebase.auth) return null;
      return firebase.auth().currentUser || null;
    } catch (e) {
      return null;
    }
  }

  function waitForRecoverableAuthUser() {
    return new Promise(function(resolve) {
      var liveUser = getLiveFirebaseUser();
      if (isAuthenticatedUser(liveUser)) {
        resolve(liveUser);
        return;
      }

      var settled = false;
      var unsubscribe = null;
      var timeoutId = setTimeout(function() {
        if (settled) return;
        settled = true;
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
        } catch (e) {}
        resolve(null);
      }, SETTINGS_AUTH_RECOVERY_TIMEOUT_MS);

      try {
        if (typeof firebase === 'undefined' || !firebase.auth || typeof firebase.auth().onAuthStateChanged !== 'function') {
          clearTimeout(timeoutId);
          settled = true;
          resolve(null);
          return;
        }

        unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
          if (!isAuthenticatedUser(user) || settled) return;
          settled = true;
          clearTimeout(timeoutId);
          try {
            if (typeof unsubscribe === 'function') unsubscribe();
          } catch (e) {}
          resolve(user);
        });
      } catch (e) {
        clearTimeout(timeoutId);
        settled = true;
        resolve(null);
      }
    });
  }

  function recoverSettingsAuthOrRedirect() {
    waitForRecoverableAuthUser().then(function(user) {
      if (isAuthenticatedUser(user)) {
        startSettings(user);
        return;
      }
      redirectToLogin();
    }).catch(function() {
      redirectToLogin();
    });
  }

  /* ──────────────────────────────────────────────────────────
     Settings View Model helpers (pure functions, no DOM)
     ────────────────────────────────────────────────────────── */

  /**
   * Resolve display name with fallback chain.
   * @param {object} user
   * @returns {string}
   */
  function resolveDisplayName(user) {
    if (user && user.displayName && typeof user.displayName === 'string') {
      var trimmed = user.displayName.trim();
      if (trimmed) return trimmed;
    }
    if (user && user.email && typeof user.email === 'string') {
      var at = user.email.indexOf('@');
      if (at > 0) return user.email.substring(0, at);
    }
    return 'LoveBud 사용자';
  }

  /**
   * Resolve initials for avatar fallback.
   * @param {object} user
   * @returns {string}
   */
  function resolveProfileInitials(user) {
    var name = resolveDisplayName(user);
    var parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase() || 'L';
  }

  /**
   * Resolve sign-in methods from providerData.
   * @param {object} user
   * @returns {string[]}
   */
  function resolveSignInMethods(user) {
    if (!user || !user.providerData || !Array.isArray(user.providerData) || user.providerData.length === 0) {
      return ['unknown'];
    }
    var methods = [];
    for (var i = 0; i < user.providerData.length; i++) {
      var providerId = user.providerData[i].providerId;
      var canonical = null;
      if (providerId === 'google.com') {
        canonical = 'google';
      } else if (providerId === 'password') {
        canonical = 'password';
      } else {
        canonical = 'unknown';
      }
      if (canonical && methods.indexOf(canonical) === -1) {
        methods.push(canonical);
      }
    }
    if (methods.length === 0) {
      return ['unknown'];
    }
    return methods;
  }

  /**
   * Build the settings account view model from a Firebase user.
   * @param {object} user
   * @returns {object}
   */
  // --- Display name editing state ---
  // statusKind tracks the semantic status so language changes can retranslate
  // without inferring meaning from rendered DOM text.
  // Values: 'none' | 'saving' | 'nameEmpty' | 'nameTooLong' | 'nameUpdateFailed'
  //         | 'nameUpdated' | 'nameUnchanged'
  var editState = { mode: 'view', originalName: '', saving: false, statusKind: 'none' };
  var settingsLangChangeBound = false;

  // --- Password reset state (v20260724-3635) ---
  // statusKind tracks semantic status so language changes can retranslate
  // without inferring meaning from rendered DOM text.
  // Values: 'none' | 'sending' | 'sent' | 'missingEmail' | 'unavailable' | 'sendFailed'
  // mode: 'none' | 'reset' | 'googleManaged' | 'unavailable' | 'missingEmail'
  var passwordResetState = { sending: false, statusKind: 'none', mode: 'none' };

  function getLiveUser() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser;
      }
    } catch (e) {}
    return null;
  }

  function t(key, fallback) {
    var translated = window.t ? window.t(key) : key;
    return translated && translated !== key ? translated : fallback;
  }

  function validateDisplayName(raw) {
    if (!raw || typeof raw !== 'string') return { valid: false, error: 'empty' };
    var trimmed = raw.trim();
    if (!trimmed) return { valid: false, error: 'empty' };
    if (Array.from(trimmed).length > 50) return { valid: false, error: 'tooLong' };
    return { valid: true, value: trimmed };
  }

  function clearEditStatus() {
    editState.statusKind = 'none';
    var status = document.getElementById('settingsProfileEditStatus');
    if (!status) return;
    status.textContent = '';
    status.className = 'settings-profile-edit-status';
    status.setAttribute('role', 'status');
    status.removeAttribute('aria-live');
    status.setAttribute('aria-live', 'polite');
  }

  function clearResultStatus() {
    // Only clear result status when opening edit or cancelling — not when
    // clearing the edit-local status after a successful result was just set.
    var status = document.getElementById('settingsProfileResultStatus');
    if (!status) return;
    status.textContent = '';
    status.className = 'settings-profile-result-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
  }

  function clearResultStatusAndKind() {
    editState.statusKind = 'none';
    clearResultStatus();
  }

  /**
   * Edit-local status (inside the edit form): validation, write error, saving.
   * @param {string} kind - 'saving' | 'nameEmpty' | 'nameTooLong' | 'nameUpdateFailed'
   * @param {string} type - CSS type: 'saving' | 'error'
   */
  function showEditStatus(kind, type) {
    editState.statusKind = kind || 'none';
    var message = '';
    if (kind === 'saving') {
      message = t('settings.profile.saving', 'Saving\u2026');
    } else if (kind === 'nameEmpty') {
      message = t('settings.profile.nameEmpty', 'Enter a display name.');
    } else if (kind === 'nameTooLong') {
      message = t('settings.profile.nameTooLong', 'Display name must be 50 characters or fewer.');
    } else if (kind === 'nameUpdateFailed') {
      message = t('settings.profile.nameUpdateFailed', 'Could not update the display name. Try again.');
    }
    var status = document.getElementById('settingsProfileEditStatus');
    if (!status) return;
    status.textContent = message;
    status.className = 'settings-profile-edit-status' + (type ? ' settings-profile-edit-status--' + type : '');
    if (type === 'error') {
      status.setAttribute('role', 'alert');
      status.setAttribute('aria-live', 'assertive');
    } else {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
    }
  }

  /**
   * Persistent result status (outside the edit form): success / unchanged.
   * Remains visible after hideEditForm().
   * @param {string} kind - 'nameUpdated' | 'nameUnchanged'
   * @param {string} type - CSS type: 'success' | 'info'
   */
  function showResultStatus(kind, type) {
    editState.statusKind = kind || 'none';
    var message = '';
    if (kind === 'nameUpdated') {
      message = t('settings.profile.nameUpdated', 'Your display name was updated.');
    } else if (kind === 'nameUnchanged') {
      message = t('settings.profile.nameUnchanged', 'The display name was not changed.');
    }
    var status = document.getElementById('settingsProfileResultStatus');
    if (!status) return;
    status.textContent = message;
    status.className = 'settings-profile-result-status' + (type ? ' settings-profile-result-status--' + type : '');
    // Final results are status, never alert/error role.
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
  }

  /** Re-apply the current statusKind text after a language change. */
  function reapplyStatusI18n() {
    var kind = editState.statusKind || 'none';
    if (kind === 'none') return;
    if (kind === 'saving') {
      showEditStatus('saving', 'saving');
    } else if (kind === 'nameEmpty') {
      showEditStatus('nameEmpty', 'error');
    } else if (kind === 'nameTooLong') {
      showEditStatus('nameTooLong', 'error');
    } else if (kind === 'nameUpdateFailed') {
      showEditStatus('nameUpdateFailed', 'error');
    } else if (kind === 'nameUpdated') {
      showResultStatus('nameUpdated', 'success');
    } else if (kind === 'nameUnchanged') {
      showResultStatus('nameUnchanged', 'info');
    }
  }

  function showEditForm(currentDisplayName) {
    editState.mode = 'editing';
    editState.originalName = currentDisplayName || '';
    editState.saving = false;

    var form = document.getElementById('settingsProfileEditForm');
    var btn = document.getElementById('settingsProfileEditBtn');
    var nameView = document.getElementById('settingsProfileName');
    var input = document.getElementById('settingsProfileNameInput');

    if (form) form.hidden = false;
    if (btn) btn.hidden = true;
    if (nameView) nameView.hidden = true;
    if (input) {
      input.disabled = false;
      // Use raw Firebase displayName only — never email-derived fallback text.
      input.value = editState.originalName;
      input.focus();
    }
    clearEditStatus();
    clearResultStatusAndKind();
    updateEditI18n();
  }

  function hideEditForm() {
    editState.mode = 'view';
    editState.saving = false;

    var form = document.getElementById('settingsProfileEditForm');
    var btn = document.getElementById('settingsProfileEditBtn');
    var nameView = document.getElementById('settingsProfileName');
    var input = document.getElementById('settingsProfileNameInput');
    var saveBtn = document.getElementById('settingsProfileSaveBtn');
    var cancelBtn = document.getElementById('settingsProfileCancelBtn');

    if (form) form.hidden = true;
    if (input) input.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (btn) {
      btn.hidden = false;
      btn.focus();
    }
    if (nameView) nameView.hidden = false;
    // Clear edit-local status text only; keep statusKind if a result was just set
    // by the caller after hideEditForm (success/unchanged paths set result after hide).
    var status = document.getElementById('settingsProfileEditStatus');
    if (status) {
      status.textContent = '';
      status.className = 'settings-profile-edit-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
    }
  }

  function setSaving(saving) {
    editState.saving = saving;
    var saveBtn = document.getElementById('settingsProfileSaveBtn');
    var cancelBtn = document.getElementById('settingsProfileCancelBtn');
    var input = document.getElementById('settingsProfileNameInput');

    if (saveBtn) saveBtn.disabled = saving;
    if (cancelBtn) cancelBtn.disabled = saving;
    if (input) input.disabled = saving;
    if (saving) {
      showEditStatus('saving', 'saving');
    }
  }

  function updateEditI18n() {
    var label = document.getElementById('settingsProfileEditLabel');
    var saveBtn = document.getElementById('settingsProfileSaveBtn');
    var cancelBtn = document.getElementById('settingsProfileCancelBtn');
    var editBtnLabel = document.getElementById('settingsProfileEditBtnLabel');
    if (label) label.textContent = t('settings.profile.nameLabel', 'Display name');
    if (saveBtn) saveBtn.textContent = t('settings.profile.save', 'Save');
    if (cancelBtn) cancelBtn.textContent = t('settings.profile.cancel', 'Cancel');
    if (editBtnLabel) editBtnLabel.textContent = t('settings.profile.editName', 'Edit name');
  }

  /**
   * Subscribe once to the canonical product language-change event
   * (lovebud-lang-change via window.onLangChange). Does not reset edit form,
   * input value, or saving state.
   */
  function bindSettingsLangChange() {
    if (settingsLangChangeBound) return;
    if (typeof window.onLangChange !== 'function') return;
    settingsLangChangeBound = true;
    window.onLangChange(function() {
      applyI18nText();
      updateEditI18n();
      reapplyStatusI18n();
      reapplyPasswordResetI18n();
      if (typeof window.applyI18n === 'function') {
        window.applyI18n();
      }
      applyHeaderNavFallbacks();
    });
  }

  function updateProfileUI(vm) {
    var avatarEl = document.getElementById('settingsProfileAvatar');
    var nameEl = document.getElementById('settingsProfileName');

    if (avatarEl) {
      avatarEl.textContent = '';
      var hasPhoto = vm.photoURL && /^https?:\/\//.test(vm.photoURL);
      var fallbackLabel = (t('settings.profile.avatarFallback', 'Profile for ' + vm.displayName)).replace(/\{displayName\}/g, vm.displayName);
      if (hasPhoto) {
        var img = document.createElement('img');
        img.src = vm.photoURL;
        img.alt = '';
        img.className = 'settings-profile-avatar-img';
        img.onerror = function() {
          avatarEl.textContent = '';
          avatarEl.textContent = resolveProfileInitials(vm);
          avatarEl.classList.add('settings-profile-avatar-initials');
          avatarEl.classList.remove('settings-profile-avatar-img-wrap');
          avatarEl.setAttribute('role', 'img');
          avatarEl.setAttribute('aria-label', fallbackLabel);
        };
        avatarEl.appendChild(img);
        avatarEl.classList.add('settings-profile-avatar-img-wrap');
        avatarEl.classList.remove('settings-profile-avatar-initials');
        avatarEl.setAttribute('role', 'img');
        var photoLabel = (t('settings.profile.avatarPhoto', 'Profile photo for ' + vm.displayName)).replace(/\{displayName\}/g, vm.displayName);
        avatarEl.setAttribute('aria-label', photoLabel);
      } else {
        avatarEl.textContent = resolveProfileInitials(vm);
        avatarEl.classList.add('settings-profile-avatar-initials');
        avatarEl.classList.remove('settings-profile-avatar-img-wrap');
        avatarEl.setAttribute('role', 'img');
        avatarEl.setAttribute('aria-label', fallbackLabel);
      }
    }
    if (nameEl) nameEl.textContent = vm.displayName;
  }

  function syncAfterSave(newDisplayName) {
    var liveUser = getLiveUser();
    if (!liveUser) return;

    // Keep the live user object in sync for subsequent reads (tests + same-session UI).
    try {
      liveUser.displayName = newDisplayName;
    } catch (e) {}

    // Update confirmed auth cache
    if (typeof window.persistConfirmedAuthSession === 'function') {
      var updatedUser = Object.assign({}, liveUser, { displayName: newDisplayName });
      window.persistConfirmedAuthSession(updatedUser);
    }

    // Update header nav with the updated name (no full header re-render)
    if (typeof window.updateNavUI === 'function') {
      window.updateNavUI(liveUser);
    }

    // Re-render profile section
    var vm = resolveSettingsAccountViewModel(liveUser);
    vm.displayName = newDisplayName;
    updateProfileUI(vm);
  }

  function handleSaveDisplayName() {
    if (editState.saving) return;

    var input = document.getElementById('settingsProfileNameInput');
    var rawInput = input ? input.value : '';
    var result = validateDisplayName(rawInput);

    if (!result.valid) {
      if (result.error === 'empty') {
        showEditStatus('nameEmpty', 'error');
      } else if (result.error === 'tooLong') {
        showEditStatus('nameTooLong', 'error');
      }
      if (input) input.focus();
      return;
    }

    var liveUser = getLiveUser();
    if (!liveUser || typeof liveUser.updateProfile !== 'function') {
      showEditStatus('nameUpdateFailed', 'error');
      return;
    }

    var currentPersisted = (liveUser.displayName && typeof liveUser.displayName === 'string')
      ? liveUser.displayName.trim()
      : '';
    if (result.value === currentPersisted) {
      hideEditForm();
      showResultStatus('nameUnchanged', 'info');
      return;
    }

    setSaving(true);
    clearResultStatus();

    // Promise.resolve().then(...) captures both sync throws and rejected promises
    // on the same write-error path.
    Promise.resolve()
      .then(function() {
        return liveUser.updateProfile({ displayName: result.value });
      })
      .then(function() {
        syncAfterSave(result.value);
        setSaving(false);
        hideEditForm();
        showResultStatus('nameUpdated', 'success');
      })
      .catch(function() {
        // Fail closed: stay in edit mode, keep input, no profile/cache/header mutation.
        setSaving(false);
        showEditStatus('nameUpdateFailed', 'error');
      });
  }

  function handleCancelEdit() {
    if (editState.saving) return;
    hideEditForm();
    clearResultStatusAndKind();
  }

  function bindNameEditInteractions() {
    var editBtn = document.getElementById('settingsProfileEditBtn');
    var saveBtn = document.getElementById('settingsProfileSaveBtn');
    var cancelBtn = document.getElementById('settingsProfileCancelBtn');
    var input = document.getElementById('settingsProfileNameInput');

    if (editBtn) {
      editBtn.addEventListener('click', function() {
        var liveUser = getLiveUser();
        var currentName = liveUser ? (liveUser.displayName || '') : '';
        showEditForm(currentName);
      });
    }
    if (saveBtn) saveBtn.addEventListener('click', handleSaveDisplayName);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancelEdit);
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (editState.saving) return;
          handleSaveDisplayName();
        }
      });
    }
  }

    function resolveSettingsAccountViewModel(user) {
    var methods = resolveSignInMethods(user);
    var hasPassword = methods.indexOf('password') !== -1;
    var hasGoogle = methods.indexOf('google') !== -1;
    var passwordInfo = hasPassword ? 'deferred' : (hasGoogle ? 'google' : 'unavailable');
    return {
      email: (user && user.email) || '',
      uid: (user && user.uid) || '',
      displayName: resolveDisplayName(user),
      photoURL: (user && user.photoURL) || '',
      signInMethods: methods,
      passwordInfo: passwordInfo
    };
  }

  /* ──────────────────────────────────────────────────────────
     Password reset email (v20260724-3635)
     ────────────────────────────────────────────────────────── */

  function resolvePasswordResetMode(vm) {
    if (!vm) return 'unavailable';
    if (vm.passwordInfo === 'google') return 'googleManaged';
    if (vm.passwordInfo === 'deferred') {
      return vm.email ? 'reset' : 'missingEmail';
    }
    return 'unavailable';
  }

  function renderPasswordResetAction(vm, containerEl) {
    var mode = resolvePasswordResetMode(vm);
    passwordResetState.mode = mode;
    containerEl.textContent = '';

    if (mode === 'googleManaged' || mode === 'unavailable') {
      var noteKey = mode === 'googleManaged'
        ? 'settings.account.password.googleManaged'
        : 'settings.account.password.unavailable';
      var noteFallback = mode === 'googleManaged'
        ? '비밀번호는 Google 계정에서 관리됩니다.'
        : '현재 로그인 방식에서는 비밀번호 관리 기능을 확인할 수 없습니다.';
      var noteEl = document.createElement('p');
      noteEl.id = 'settingsPasswordResetNote';
      noteEl.className = 'settings-password-reset-note';
      noteEl.textContent = t(noteKey, noteFallback);
      containerEl.appendChild(noteEl);
      if (mode === 'unavailable') passwordResetState.statusKind = 'unavailable';
      return;
    }

    if (mode === 'missingEmail') {
      passwordResetState.statusKind = 'missingEmail';
      var missingNoteEl = document.createElement('p');
      missingNoteEl.id = 'settingsPasswordResetNote';
      missingNoteEl.className = 'settings-password-reset-note';
      missingNoteEl.textContent = t('settings.account.password.resetMissingEmail', '계정 이메일을 확인할 수 없어 재설정 이메일을 보낼 수 없습니다.');
      containerEl.appendChild(missingNoteEl);
      return;
    }

    var wrapEl = document.createElement('div');
    wrapEl.id = 'settingsPasswordResetMessage';
    wrapEl.className = 'settings-password-reset';

    var btnEl = document.createElement('button');
    btnEl.id = 'settingsPasswordResetBtn';
    btnEl.type = 'button';
    btnEl.className = 'settings-password-reset-btn';

    var labelEl = document.createElement('span');
    labelEl.id = 'settingsPasswordResetBtnLabel';
    labelEl.textContent = t('settings.account.password.resetAction', '비밀번호 재설정 이메일 보내기');
    btnEl.appendChild(labelEl);

    var statusEl = document.createElement('p');
    statusEl.id = 'settingsPasswordResetStatus';
    statusEl.className = 'settings-password-reset-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    wrapEl.appendChild(btnEl);
    wrapEl.appendChild(statusEl);
    containerEl.appendChild(wrapEl);

    applyPasswordResetStatusI18n();
  }

  function applyPasswordResetStatusI18n() {
    var statusEl = document.getElementById('settingsPasswordResetStatus');
    var labelEl = document.getElementById('settingsPasswordResetBtnLabel');
    var btnEl = document.getElementById('settingsPasswordResetBtn');
    var noteEl = document.getElementById('settingsPasswordResetNote');

    if (noteEl) {
      var noteKey, noteFallback;
      if (passwordResetState.mode === 'googleManaged') {
        noteKey = 'settings.account.password.googleManaged';
        noteFallback = '비밀번호는 Google 계정에서 관리됩니다.';
      } else if (passwordResetState.mode === 'missingEmail') {
        noteKey = 'settings.account.password.resetMissingEmail';
        noteFallback = '계정 이메일을 확인할 수 없어 재설정 이메일을 보낼 수 없습니다.';
      } else {
        noteKey = 'settings.account.password.unavailable';
        noteFallback = '현재 로그인 방식에서는 비밀번호 관리 기능을 확인할 수 없습니다.';
      }
      noteEl.textContent = t(noteKey, noteFallback);
      return;
    }

    if (labelEl) {
      labelEl.textContent = t('settings.account.password.resetAction', '비밀번호 재설정 이메일 보내기');
    }

    if (!statusEl) return;
    var kind = passwordResetState.statusKind;
    var statusMap = {
      sending: { key: 'settings.account.password.resetSending', fallback: '재설정 이메일을 보내는 중입니다…' },
      sent: { key: 'settings.account.password.resetSent', fallback: '비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인하세요.' },
      sendFailed: { key: 'settings.account.password.resetSendFailed', fallback: '재설정 이메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.' },
      missingEmail: { key: 'settings.account.password.resetMissingEmail', fallback: '계정 이메일을 확인할 수 없어 재설정 이메일을 보낼 수 없습니다.' }
    };
    var entry = statusMap[kind];
    if (entry) {
      statusEl.textContent = t(entry.key, entry.fallback);
    } else {
      statusEl.textContent = '';
    }

    statusEl.classList.remove('settings-password-reset-status--sending', 'settings-password-reset-status--success', 'settings-password-reset-status--error');
    if (kind === 'sending') statusEl.classList.add('settings-password-reset-status--sending');
    if (kind === 'sent') statusEl.classList.add('settings-password-reset-status--success');
    if (kind === 'sendFailed' || kind === 'missingEmail') statusEl.classList.add('settings-password-reset-status--error');

    if (btnEl) {
      var disabled = passwordResetState.sending || kind === 'sent';
      btnEl.disabled = disabled;
      if (disabled) {
        btnEl.setAttribute('aria-disabled', 'true');
      } else {
        btnEl.removeAttribute('aria-disabled');
      }
    }
  }

  function reapplyPasswordResetI18n() {
    applyPasswordResetStatusI18n();
  }

  function handlePasswordResetClick() {
    if (passwordResetState.sending || passwordResetState.statusKind === 'sent') return;

    var authInstance = null;
    try {
      if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
        passwordResetState.statusKind = 'sendFailed';
        applyPasswordResetStatusI18n();
        return;
      }
      authInstance = firebase.auth();
    } catch (e) {
      passwordResetState.statusKind = 'sendFailed';
      applyPasswordResetStatusI18n();
      return;
    }

    if (!authInstance || typeof authInstance.sendPasswordResetEmail !== 'function') {
      passwordResetState.statusKind = 'sendFailed';
      applyPasswordResetStatusI18n();
      return;
    }

    var user = getLiveUser();
    var email = (user && user.email) || '';
    if (!email) {
      passwordResetState.statusKind = 'missingEmail';
      applyPasswordResetStatusI18n();
      return;
    }

    passwordResetState.sending = true;
    passwordResetState.statusKind = 'sending';
    applyPasswordResetStatusI18n();

    Promise.resolve()
      .then(function() {
        return authInstance.sendPasswordResetEmail(email);
      })
      .then(function() {
        passwordResetState.sending = false;
        passwordResetState.statusKind = 'sent';
        applyPasswordResetStatusI18n();
      })
      .catch(function() {
        passwordResetState.sending = false;
        passwordResetState.statusKind = 'sendFailed';
        applyPasswordResetStatusI18n();
      });
  }

  function bindPasswordResetInteractions() {
    var btnEl = document.getElementById('settingsPasswordResetBtn');
    if (btnEl) {
      btnEl.addEventListener('click', handlePasswordResetClick);
    }
  }

  /* ──────────────────────────────────────────────────────────
     DOM rendering
     ────────────────────────────────────────────────────────── */

  function applyHeaderNavFallbacks() {
    var t = window.t || function(key) { return key; };
    var navMap = [
      { href: 'index.html', key: 'nav.home', fallback: '첫화면' },
      { href: 'intro.html', key: 'nav.intro', fallback: '소개' },
      { href: 'search.html', key: 'nav.search', fallback: '둘러보기' },
      { href: 'my-trees.html', key: 'nav.myTrees', fallback: '내 러브트리' }
    ];

    document.querySelectorAll('.nav-links a').forEach(function(link) {
      var rawText = (link.textContent || '').trim();
      var href = link.getAttribute('href') || '';
      var match = navMap.find(function(item) {
        return href.indexOf(item.href) !== -1;
      });
      if (!match) return;
      if (rawText === match.key || /^nav\./.test(rawText)) {
        var translated = t(match.key);
        link.textContent = translated && translated !== match.key ? translated : match.fallback;
      }
    });
  }

  function applyI18nText() {
    var t = window.t || function(key) { return key; };

    function safeText(key, fallback) {
      var translated = t(key);
      return translated && translated !== key ? translated : fallback;
    }

    applyHeaderNavFallbacks();

    var closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', safeText('close', '설정 닫기'));
      closeBtn.setAttribute('title', safeText('close', '닫기'));
    }

    var titleEl = document.getElementById('settingsTitle');
    if (titleEl) titleEl.textContent = safeText('settings.title', '설정');

    var subtitleEl = document.getElementById('settingsSubtitle');
    if (subtitleEl) subtitleEl.textContent = safeText('settings.subtitle', '프로필과 로그인 정보를 확인합니다');

    // Profile section
    var profileTitleEl = document.getElementById('settingsProfileTitle');
    if (profileTitleEl) {
      var icon = profileTitleEl.querySelector('.material-symbols-outlined');
      profileTitleEl.textContent = '';
      if (icon) profileTitleEl.appendChild(icon);
      profileTitleEl.appendChild(document.createTextNode(' ' + safeText('settings.profile.title', '프로필')));
    }

    var deferredNote = document.getElementById('settingsProfileDeferredNote');
    if (deferredNote) deferredNote.textContent = safeText('settings.profile.changeDeferred', '프로필 변경 기능은 다음 단계에서 제공됩니다.');

    // Account section
    var accountTitleEl = document.getElementById('settingsAccountTitle');
    if (accountTitleEl) {
      var icon2 = accountTitleEl.querySelector('.material-symbols-outlined');
      accountTitleEl.textContent = '';
      if (icon2) accountTitleEl.appendChild(icon2);
      accountTitleEl.appendChild(document.createTextNode(' ' + safeText('settings.account.title', '계정')));
    }

    var emailLabelEl = document.getElementById('settingsAccountEmailLabel');
    if (emailLabelEl) emailLabelEl.textContent = safeText('settings.account.email', '이메일');

    var idLabelEl = document.getElementById('settingsAccountIdLabel');
    if (idLabelEl) idLabelEl.textContent = safeText('settings.account.id', '계정 ID');

    var signInLabelEl = document.getElementById('settingsAccountSignInLabel');
    if (signInLabelEl) signInLabelEl.textContent = safeText('settings.account.signInMethod', '로그인 방식');

    var passwordLabelEl = document.getElementById('settingsAccountPasswordLabel');
    if (passwordLabelEl) passwordLabelEl.textContent = safeText('settings.account.password', '비밀번호 관리');

    var logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      var logoutIcon = logoutBtn.querySelector('.material-symbols-outlined');
      logoutBtn.textContent = '';
      if (logoutIcon) logoutBtn.appendChild(logoutIcon);
      logoutBtn.appendChild(document.createTextNode(' ' + safeText('logout_btn', '로그아웃')));
    }
  }

  function renderProfileSection(vm) {
    updateProfileUI(vm);
    var emailEl = document.getElementById('settingsProfileEmail');
    if (emailEl) emailEl.textContent = vm.email || '';
    updateEditI18n();
  }

  function renderAccountSection(vm) {
    var t = window.t || function(key) { return key; };

    function safeText(key, fallback) {
      var translated = t(key);
      return translated && translated !== key ? translated : fallback;
    }

    var providerMap = {
      google: 'settings.account.provider.google',
      password: 'settings.account.provider.password',
      unknown: 'settings.account.provider.unknown'
    };
    var providerLabels = vm.signInMethods.map(function(m) {
      return safeText(providerMap[m] || providerMap.unknown, m);
    });
    var providerLabel = providerLabels.join(', ');

    var emailValueEl = document.getElementById('settingsAccountEmailValue');
    if (emailValueEl) emailValueEl.textContent = vm.email || '';

    var idValueEl = document.getElementById('settingsAccountIdValue');
    if (idValueEl) idValueEl.textContent = vm.uid || '';

    var signInValueEl = document.getElementById('settingsAccountSignInValue');
    if (signInValueEl) {
      signInValueEl.textContent = providerLabel;
    }

    var passwordValueEl = document.getElementById('settingsAccountPasswordValue');
    if (passwordValueEl) {
      renderPasswordResetAction(vm, passwordValueEl);
    }
  }

  function bindCloseInteractions() {
    var settingsContent = document.getElementById('settingsContent');
    var settingsCard = document.getElementById('settingsCard');
    var closeBtn = document.getElementById('settingsCloseBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        closeSettings();
      });
    }

    if (settingsContent && settingsCard) {
      settingsContent.addEventListener('click', function(e) {
        if (!settingsCard.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (editState.mode === 'editing') {
          e.preventDefault();
          e.stopPropagation();
          // While saving, Escape must not cancel or close — keep the saving UI visible.
          if (editState.saving) return;
          handleCancelEdit();
          return;
        }
        e.preventDefault();
        closeSettings();
      }
    });
  }

  var settingsStarted = false;

  function startSettings(user) {
    if (settingsStarted) return;
    var effectiveUser = resolveEffectiveUser(user);
    if (!isAuthenticatedUser(effectiveUser)) {
      redirectToLogin();
      return;
    }
    settingsStarted = true;
    document.body.classList.remove('settings-auth-pending');

    loadSettings();
    bindCloseInteractions();

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Bind display name edit interactions
    bindNameEditInteractions();
    // Canonical language-change subscription (lovebud-lang-change via onLangChange)
    bindSettingsLangChange();

    // Render Profile / Account sections
    var vm = resolveSettingsAccountViewModel(effectiveUser);
    renderProfileSection(vm);
    renderAccountSection(vm);
    bindPasswordResetInteractions();

    setTimeout(function() {
      applyI18nText();
      if (typeof window.applyI18n === 'function') window.applyI18n();
      applyHeaderNavFallbacks();
    }, 0);

    settingsDebugLog('[settings] Initialized and staying on settings route');
  }

  function initSettings() {
    if (
      window.LoveBudProtectedRoute &&
      typeof window.LoveBudProtectedRoute.requireAuthenticatedPage === 'function'
    ) {
      window.LoveBudProtectedRoute.requireAuthenticatedPage({
        redirectTo: 'login.html',
        returnTo: window.location.pathname + window.location.search + window.location.hash,
        allowCachedUser: false,
        onAuthenticated: startSettings,
        onUnauthenticated: recoverSettingsAuthOrRedirect
      });
      return;
    }

    if (window.LoveBudAuthBootstrap && typeof window.LoveBudAuthBootstrap.whenReady === 'function') {
      try {
        window.LoveBudAuthBootstrap.whenReady().then(function(user) {
          if (user && user.uid) {
            startSettings(user);
          } else {
            redirectToLogin();
          }
        }).catch(function() {
          redirectToLogin();
        });
      } catch (e) {
        redirectToLogin();
      }
      return;
    }

    if (typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(function(user) {
        if (user && user.uid) {
          startSettings(user);
        } else {
          redirectToLogin();
        }
      });
      return;
    }

    redirectToLogin();
  }

  function redirectAfterLogout() {
    window.location.href = '../index.html';
  }

  function handleLogout() {
    if (typeof window.signOut === 'function') {
      window.signOut().then(redirectAfterLogout).catch(redirectAfterLogout);
      return;
    }

    if (window.LoveBudAuthFirebase && typeof window.LoveBudAuthFirebase.signOut === 'function') {
      Promise.resolve(window.LoveBudAuthFirebase.signOut()).catch(redirectAfterLogout);
      return;
    }

    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().then(redirectAfterLogout).catch(redirectAfterLogout);
      return;
    }

    redirectAfterLogout();
  }

  window.initSettings = initSettings;
  window.handleLogout = handleLogout;
  window.getLoveBudSettings = loadSettings;

  // Export helpers for testing
  window.resolveSettingsAccountViewModel = resolveSettingsAccountViewModel;
  window.resolveDisplayName = resolveDisplayName;
  window.resolveProfileInitials = resolveProfileInitials;
  window.resolveSignInMethods = resolveSignInMethods;
  window._settingsEditState = editState;
  window._settingsValidateDisplayName = validateDisplayName;
  window._settingsShowEditForm = showEditForm;
  window._settingsHideEditForm = hideEditForm;
  window._settingsHandleSaveDisplayName = handleSaveDisplayName;
  window._settingsHandleCancelEdit = handleCancelEdit;
  window._settingsPasswordResetState = passwordResetState;
  window._settingsResolvePasswordResetMode = resolvePasswordResetMode;
  window._settingsHandlePasswordResetClick = handlePasswordResetClick;
})();
