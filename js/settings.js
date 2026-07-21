/**
 * LoveBud - Settings Module
 * v20260504-639-stay
 *
 * Settings should stay on settings.html after entry.
 * v20260721-3583: add read-only Profile / Account foundation.
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
    var t = window.t || function(key) { return key; };
    function safeText(key, fallback) {
      var translated = t(key);
      return translated && translated !== key ? translated : fallback;
    }
    function interpolate(template, vars) {
      return template.replace(/\{(\w+)\}/g, function(_, name) {
        return vars[name] !== undefined ? vars[name] : '{' + name + '}';
      });
    }
    var avatarEl = document.getElementById('settingsProfileAvatar');
    var nameEl = document.getElementById('settingsProfileName');
    var emailEl = document.getElementById('settingsProfileEmail');

    if (avatarEl) {
      avatarEl.textContent = '';
      var hasPhoto = vm.photoURL && /^https?:\/\//.test(vm.photoURL);
      var photoLabel = interpolate(safeText('settings.profile.avatarPhoto', 'Profile photo for ' + vm.displayName), { displayName: vm.displayName });
      var fallbackLabel = interpolate(safeText('settings.profile.avatarFallback', 'Profile for ' + vm.displayName), { displayName: vm.displayName });
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
    if (emailEl) emailEl.textContent = vm.email || '';
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
      if (vm.passwordInfo === 'google') {
        passwordValueEl.textContent = safeText('settings.account.password.googleManaged', '비밀번호는 Google 계정에서 관리됩니다.');
      } else if (vm.passwordInfo === 'deferred') {
        passwordValueEl.textContent = safeText('settings.account.password.deferred', '비밀번호 관리는 다음 단계에서 지원됩니다.');
      } else {
        passwordValueEl.textContent = safeText('settings.account.password.unavailable', '현재 로그인 방식에서는 비밀번호 관리 기능을 확인할 수 없습니다.');
      }
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

    // Render Profile / Account sections
    var vm = resolveSettingsAccountViewModel(effectiveUser);
    renderProfileSection(vm);
    renderAccountSection(vm);

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
})();
