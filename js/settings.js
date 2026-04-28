/**
 * LoveBud - Settings Module
 * v20260425-1
 * 
 * localStorage 기반 설정 관리
 * - 설정 화면 닫기 / 로그아웃
 * - 둘러보기 소개 안내 표시
 */

(function() {
  var SETTINGS_KEY = 'lovebud_user_settings';
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

    // history.back()은 최후의 수단으로만 사용
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

  // 설정 불러오기
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

  // i18n 텍스트 적용
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

  var settingsInitialized = false;
  var settingsBootedFromCache = false;

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
    window.location.replace(getSettingsLoginHref());
  }

  function startSettings() {
    if (settingsInitialized) return;
    settingsInitialized = true;

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
          return JSON.parse(raw);
        }
      }
    } catch (e) {}
    return null;
  }

  function clearConfirmedSessionUser() {
    try {
      localStorage.removeItem('lovebud_auth_cache');
      localStorage.removeItem('lovebud_auth_confirmed');
      localStorage.removeItem('lovebud_auth_token');
    } catch (e) {}
  }

  function bootSettings(user, options) {
    if (settingsInitialized) return;
    settingsInitialized = true;
    settingsBootedFromCache = !!(options && options.fromCache);
    handleSettingsAuthUser(user);
  }

  function reconcileSettingsUser(user) {
    if (user && user.uid) {
      if (!settingsInitialized) {
        bootSettings(user, { fromCache: false });
      }
      return;
    }

    if (settingsBootedFromCache) {
      clearConfirmedSessionUser();
      redirectToLogin();
      return;
    }

    if (!settingsInitialized) {
      bootSettings(null, { fromCache: false });
    }
  }

  function getConfirmedSessionUser() {
    try {
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

  function clearConfirmedSessionUser() {
    try {
      localStorage.removeItem('lovebud_auth_cache');
      localStorage.removeItem('lovebud_auth_confirmed');
      localStorage.removeItem('lovebud_auth_token');
    } catch (e) {}
  }

  function bootSettings(user, options) {
    if (settingsInitialized) return;
    settingsInitialized = true;
    settingsBootedFromCache = !!(options && options.fromCache);
    handleSettingsAuthUser(user);
  }

  function reconcileSettingsUser(user) {
    if (user && user.uid) {
      if (!settingsInitialized) {
        bootSettings(user, { fromCache: false });
      }
      return;
    }

    if (settingsBootedFromCache) {
      clearConfirmedSessionUser();
      redirectToLogin();
      return;
    }

    if (!settingsInitialized) {
      bootSettings(null, { fromCache: false });
    }
  }

  function handleSettingsAuthUser(user) {
    if (!user || !user.uid) {
      redirectToLogin();
      return;
    }
    document.body.classList.remove('settings-auth-pending');
    startSettings();
  }

  // UI 초기화 (auth gate)
  function initSettings() {
    var cachedUser = getConfirmedSessionUser();

    if (cachedUser && cachedUser.uid && !settingsInitialized) {
      bootSettings(cachedUser, { fromCache: true });
    }

    if (
      window.LoveBudAuthBootstrap &&
      typeof window.LoveBudAuthBootstrap.whenReady === 'function'
    ) {
      try {
        window.LoveBudAuthBootstrap.whenReady()
          .then(reconcileSettingsUser)
          .catch(function() {
            reconcileSettingsUser(null);
          });
      } catch (e) {
        reconcileSettingsUser(null);
      }
      return;
    }

    if (typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(function(user) {
        reconcileSettingsUser(user || null);
      });
      return;
    }

    if (!settingsInitialized) {
      bootSettings(cachedUser || null, { fromCache: !!(cachedUser && cachedUser.uid) });
    }
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

  // 로그아웃 처리
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
