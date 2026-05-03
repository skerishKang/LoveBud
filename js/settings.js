/**
 * LoveBud - Settings Module
 * v20260428-1
 * 
 * localStorage 기반 설정 관리
 * - 설정 화면 닫기 / 로그아웃
 * - 둘러보기 소개 안내 표시
 */

(function() {
  var SETTINGS_KEY = 'lovebud_user_settings';
  var SETTINGS_LOGIN_REDIRECT_KEY = 'lovebud_settings_login_redirect_at';
  var SETTINGS_AUTH_PENDING_MS = 2000;
  var SETTINGS_AUTH_RETRY_MS = 500;
  var SETTINGS_REDIRECT_LOOP_WINDOW_MS = 10000;
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
      return url.pathname === '/' || /\/[a-zA-Z0-9_-]+\.html$/.test(url.pathname);
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
    return { ...DEFAULT_SETTINGS };
  }

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
    
    var titleEl = document.querySelector('.settings-card h1');
    if (titleEl) {
      titleEl.textContent = safeText('settings.title', '설정');
    }
    
    var subtitleEl = document.querySelector('.settings-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = safeText('settings.subtitle', '러브트리를 어떻게 소개할지 살펴봅니다');
    }

    var browseIntroTitleEl = document.getElementById('settingsBrowseIntroTitle');
    if (browseIntroTitleEl) {
      browseIntroTitleEl.innerHTML = '<span class="material-symbols-outlined">travel_explore</span>' + safeText('settings.browseIntroTitle', '둘러보기 소개');
    }

    var browseIntroCardTitleEl = document.getElementById('settingsBrowseIntroCardTitle');
    if (browseIntroCardTitleEl) {
      browseIntroCardTitleEl.textContent = safeText('settings.browseIntroCardTitle', '둘러보기에 소개될 트리로 키우기');
    }

    var browseIntroDescEl = document.getElementById('settingsBrowseIntroDesc');
    if (browseIntroDescEl) {
      browseIntroDescEl.textContent = safeText(
        'settings.browseIntroDesc',
        '좋아하는 순간을 3개 이상 남기면 이 트리를 둘러보기에 소개할 수 있어요. 소개 여부는 각 러브트리에서 조건을 채운 뒤 선택할 수 있어요.'
      );
    }

    var plusTitleEl = document.getElementById('settingsPlusTitle');
    if (plusTitleEl) {
      plusTitleEl.textContent = safeText('settings.privateStorageTitle', '프라이빗 보관');
    }

    var plusDescEl = document.getElementById('settingsPlusDesc');
    if (plusDescEl) {
      plusDescEl.textContent = safeText(
        'settings.privateStorageDesc',
        '나만 보는 러브트리를 조용히 보관하는 기능은 Plus에서 준비 중이에요.'
      );
    }
    
    var logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.innerHTML = '<span class="material-symbols-outlined">logout</span>' + safeText('logout_btn', '로그아웃');
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

    document.addEventListener('click', function(e) {
      var trigger = e.target.closest('.user-dropdown-trigger');
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  var settingsStarted = false;
  var settingsRedirected = false;
  var settingsAuthRedirectTimer = null;
  var settingsAuthenticatedEntry = false;
  var settingsAuthWaitStartedAt = 0;

  function getSettingsLoginHref() {
    var returnTo = '';
    try {
      var params = new URLSearchParams(window.location.search || '');
      returnTo = params.get('returnTo') || '';
    } catch (e) {}
    var redirect = 'settings.html';
    if (returnTo) {
      redirect += '?returnTo=' + encodeURIComponent(returnTo);
    } else if (window.location.search) {
      redirect += window.location.search;
    }
    return 'login.html?redirect=' + encodeURIComponent(redirect);
  }

  function redirectToLogin() {
    if (settingsRedirected) return;
    if (settingsAuthenticatedEntry || settingsStarted || hasAnyAuthEvidence() || isSettingsAuthStillPending()) {
      return;
    }
    settingsRedirected = true;
    try {
      sessionStorage.setItem(SETTINGS_LOGIN_REDIRECT_KEY, String(Date.now()));
    } catch (e) {}
    window.location.replace(getSettingsLoginHref());
  }

  function getRecentSettingsLoginRedirectAge() {
    try {
      var raw = sessionStorage.getItem(SETTINGS_LOGIN_REDIRECT_KEY);
      var timestamp = Number(raw || 0);
      if (!timestamp) return Infinity;
      return Math.max(0, Date.now() - timestamp);
    } catch (e) {
      return Infinity;
    }
  }

  function clearSettingsLoginRedirectMarker() {
    try {
      sessionStorage.removeItem(SETTINGS_LOGIN_REDIRECT_KEY);
    } catch (e) {}
    settingsAuthWaitStartedAt = 0;
  }

  function startSettings() {
    if (settingsStarted) return;
    settingsStarted = true;
    settingsAuthenticatedEntry = true;
    if (settingsAuthRedirectTimer) {
      clearTimeout(settingsAuthRedirectTimer);
      settingsAuthRedirectTimer = null;
    }
    document.body.classList.remove('settings-auth-pending');

    var settings = loadSettings();

    bindCloseInteractions();

    setTimeout(function() {
      applyI18nText();
      if (typeof window.applyI18n === 'function') {
        window.applyI18n();
      }
      applyHeaderNavFallbacks();
    }, 0);

    console.log('[settings] Initialized with browse introduction guidance:', settings);
  }

  function getConfirmedSessionUser() {
    try {
      if (window.getConfirmedAuthUser) {
        return window.getConfirmedAuthUser();
      }
      if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
        var raw = localStorage.getItem('lovebud_auth_cache');
        if (raw && raw !== 'null') {
          var parsed = JSON.parse(raw);
          return parsed && parsed.uid ? parsed : null;
        }
      }
    } catch (e) {}
    return null;
  }

  function getCurrentFirebaseUser() {
    try {
      if (
        typeof firebase !== 'undefined' &&
        firebase.auth &&
        typeof firebase.auth === 'function'
      ) {
        var auth = firebase.auth();
        return auth && auth.currentUser && auth.currentUser.uid ? auth.currentUser : null;
      }
    } catch (e) {}
    return null;
  }

  function getBootstrapSnapshot() {
    try {
      if (
        window.LoveBudAuthBootstrap &&
        typeof window.LoveBudAuthBootstrap.getSnapshot === 'function'
      ) {
        return window.LoveBudAuthBootstrap.getSnapshot();
      }
    } catch (e) {}
    return null;
  }

  function getBootstrapSnapshotUser() {
    var snapshot = getBootstrapSnapshot();
    if (snapshot && snapshot.user && snapshot.user.uid) {
      return snapshot.user;
    }
    return null;
  }

  function getAuthReadyFlagKey() {
    try {
      if (window.LoveBudAuthState && window.LoveBudAuthState.AUTH_READY_FLAG) {
        return window.LoveBudAuthState.AUTH_READY_FLAG;
      }
    } catch (e) {}
    return '__lovebudAuthReady';
  }

  function normalizeAuthUser(result) {
    if (result && result.uid) return result;
    if (result && result.user && result.user.uid) return result.user;
    return null;
  }

  function hasAnyAuthEvidence() {
    return !!(
      getCurrentFirebaseUser() ||
      getBootstrapSnapshotUser() ||
      getConfirmedSessionUser()
    );
  }

  function getSettingsAuthMaxWaitMs() {
    var authWaitMs = 8000;
    try {
      if (typeof window.__LOVEBUD_AUTH_WAIT_MS === 'number' && window.__LOVEBUD_AUTH_WAIT_MS > 0) {
        authWaitMs = window.__LOVEBUD_AUTH_WAIT_MS;
      }
    } catch (e) {}
    return Math.max(SETTINGS_REDIRECT_LOOP_WINDOW_MS, authWaitMs + SETTINGS_AUTH_PENDING_MS);
  }

  function isSettingsAuthStillPending() {
    if (hasAnyAuthEvidence()) {
      return false;
    }

    var snapshot = getBootstrapSnapshot();
    if (snapshot && snapshot.ready) {
      return false;
    }

    try {
      if (window[getAuthReadyFlagKey()]) {
        return false;
      }
    } catch (e) {}

    if (!settingsAuthWaitStartedAt) {
      return true;
    }

    return Date.now() - settingsAuthWaitStartedAt < getSettingsAuthMaxWaitMs();
  }

  function handleSettingsAuthUser(result) {
    var user = normalizeAuthUser(result) ||
      getCurrentFirebaseUser() ||
      getBootstrapSnapshotUser() ||
      getConfirmedSessionUser();

    if (user) {
      clearSettingsLoginRedirectMarker();
      startSettings();
      return;
    }

    if (settingsAuthenticatedEntry || settingsStarted) {
      return;
    }

    waitForSettledLogoutBeforeRedirect();
  }

  function waitForSettledLogoutBeforeRedirect() {
    if (settingsAuthenticatedEntry || settingsStarted || settingsRedirected || settingsAuthRedirectTimer) {
      return;
    }

    if (!settingsAuthWaitStartedAt) {
      settingsAuthWaitStartedAt = Date.now();
    }

    var delayMs = SETTINGS_AUTH_PENDING_MS;
    var recentRedirectAge = getRecentSettingsLoginRedirectAge();
    if (recentRedirectAge < SETTINGS_REDIRECT_LOOP_WINDOW_MS) {
      delayMs = Math.max(delayMs, SETTINGS_REDIRECT_LOOP_WINDOW_MS - recentRedirectAge);
    }

    settingsAuthRedirectTimer = setTimeout(function() {
      settingsAuthRedirectTimer = null;

      if (settingsAuthenticatedEntry || settingsStarted) {
        return;
      }

      var settledUser = getCurrentFirebaseUser() ||
        getBootstrapSnapshotUser() ||
        getConfirmedSessionUser();

      if (settledUser) {
        clearSettingsLoginRedirectMarker();
        startSettings();
        return;
      }

      if (isSettingsAuthStillPending()) {
        waitForSettledLogoutBeforeRedirect();
        return;
      }

      redirectToLogin();
    }, Math.min(delayMs, SETTINGS_AUTH_RETRY_MS));
  }

  function initSettings() {
    var cachedUser = getConfirmedSessionUser();

    if (cachedUser) {
      startSettings();
    }

    if (
      window.LoveBudAuthBootstrap &&
      typeof window.LoveBudAuthBootstrap.whenReady === 'function'
    ) {
      try {
        window.LoveBudAuthBootstrap.whenReady()
          .then(handleSettingsAuthUser)
          .catch(function() {
            if (!cachedUser && typeof window.registerOnAuthReady === 'function') {
              window.registerOnAuthReady(handleSettingsAuthUser);
            } else if (!cachedUser) {
              waitForSettledLogoutBeforeRedirect();
            }
          });
      } catch (e) {
        if (!cachedUser && typeof window.registerOnAuthReady === 'function') {
          window.registerOnAuthReady(handleSettingsAuthUser);
        } else if (!cachedUser) {
          waitForSettledLogoutBeforeRedirect();
        }
      }
      return;
    }

    if (typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(handleSettingsAuthUser);
      return;
    }

    if (cachedUser) {
      startSettings();
      return;
    }

    waitForSettledLogoutBeforeRedirect();
  }

  function redirectAfterLogout() {
    window.location.href = '../index.html';
  }

  function getCanonicalLogoutOptions() {
    return {
      clearStaleFirebaseAuthState: function() {
        if (window.LoveBudAuthCache && typeof window.LoveBudAuthCache.clearStaleFirebaseAuthState === 'function') {
          window.LoveBudAuthCache.clearStaleFirebaseAuthState();
        }
      },
      clearConfirmedAuthCache: function() {
        if (window.LoveBudAuthCache && typeof window.LoveBudAuthCache.clearConfirmedAuthCache === 'function') {
          window.LoveBudAuthCache.clearConfirmedAuthCache('lovebud_auth_cache', 'lovebud_auth_confirmed', 'lovebud_auth_token');
        }
      }
    };
  }

  function handleLogout() {
    if (window.LoveBudAuthFirebase && typeof window.LoveBudAuthFirebase.signOut === 'function') {
      Promise.resolve(window.LoveBudAuthFirebase.signOut(getCanonicalLogoutOptions()))
        .catch(redirectAfterLogout);
      return;
    }

    if (typeof window.signOut === 'function') {
      window.signOut().then(redirectAfterLogout).catch(redirectAfterLogout);
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
})();
