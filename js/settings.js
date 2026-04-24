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

  function isSafeReturnTarget(value) {
    return /^\.?\/?[a-zA-Z0-9_\-/]+\.html(?:\?.*)?$/.test(value || '');
  }

  function getReturnToHref() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var returnTo = params.get('returnTo');
      if (returnTo && isSafeReturnTarget(returnTo)) {
        return returnTo;
      }
    } catch (e) {
      console.warn('[settings] Failed to parse returnTo:', e);
    }

    try {
      if (document.referrer) {
        var refUrl = new URL(document.referrer, window.location.origin);
        var sameOrigin = refUrl.origin === window.location.origin;
        var isSettingsRef = /\/settings\.html(?:$|\?)/.test(refUrl.pathname);
        if (sameOrigin && !isSettingsRef) {
          return refUrl.pathname + refUrl.search + refUrl.hash;
        }
      }
    } catch (e) {
      console.warn('[settings] Failed to parse referrer:', e);
    }

    return '../index.html';
  }

  function closeSettings() {
    var fallbackHref = getReturnToHref();

    try {
      if (window.history.length > 1 && document.referrer) {
        window.history.back();
        return;
      }
    } catch (e) {
      console.warn('[settings] history.back failed:', e);
    }

    window.location.href = fallbackHref;
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

  // UI 초기화
  function initSettings() {
    var settings = loadSettings();

    bindCloseInteractions();
    
    // i18n 텍스트 적용 (renderSharedHeader 후 호출되어야 하므로 지연)
    setTimeout(function() {
      applyI18nText();
      if (typeof window.applyI18n === 'function') {
        window.applyI18n();
      }
      applyHeaderNavFallbacks();
    }, 0);

    console.log('[settings] Initialized with browse introduction guidance:', settings);
  }

  // 로그아웃 처리
  function handleLogout() {
    if (typeof window.signOut === 'function') {
      window.signOut().then(function() {
        window.location.href = '../index.html';
      }).catch(function() {
        window.location.href = '../index.html';
      });
    } else {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(function() {
          window.location.href = '../index.html';
        }).catch(function() {
          window.location.href = '../index.html';
        });
      } else {
        window.location.href = '../index.html';
      }
    }
  }

  window.initSettings = initSettings;
  window.handleLogout = handleLogout;
  window.getLoveBudSettings = loadSettings;
})();
