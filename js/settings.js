/**
 * LoveBud - Settings Module
 * v20260421-2
 * 
 * localStorage 기반 설정 관리
 * - 기본 공개 범위 (defaultVisibility)
 */

(function() {
  var SETTINGS_KEY = 'lovebud_user_settings';
  var DEFAULT_SETTINGS = {
    defaultVisibility: 'public'
  };

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

  // 설정 저장하기
  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.warn('[settings] Failed to save settings:', e);
      return false;
    }
  }

  // i18n 텍스트 적용
  function applyI18nText() {
    var t = window.t || function(key) { return key; };

    function safeText(key, fallback) {
      var translated = t(key);
      return translated && translated !== key ? translated : fallback;
    }
    // 뒤로 가기 링크
    var backLinkText = document.getElementById('settingsBackLinkText');
    if (backLinkText) {
      backLinkText.textContent = safeText('settings.backToMyTrees', '내 러브트리로 돌아가기');
    }
    
    // 제목
    var titleEl = document.querySelector('.settings-card h1');
    if (titleEl) {
      titleEl.textContent = safeText('settings.title', '설정');
    }
    
    // 부제목
    var subtitleEl = document.querySelector('.settings-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = safeText('settings.subtitle', '러브트리를 어떻게 공개할지 정합니다');
    }
    
    // 기본 공개 범위 제목
    var visibilityTitleEl = document.querySelector('.settings-section-title');
    if (visibilityTitleEl) {
      visibilityTitleEl.innerHTML = '<span class="material-symbols-outlined">visibility</span>' + (safeText('settings.visibilityTitle', '기본 공개 범위'));
    }
    
    // 비공개 옵션
    var privateLabel = document.querySelector('#radio-private .radio-label');
    var privateDesc = document.querySelector('#radio-private .radio-description');
    if (privateLabel) {
      privateLabel.textContent = safeText('settings.private', '비공개');
    }
    if (privateDesc) {
      privateDesc.textContent = safeText('settings.privateDesc', '새로 만드는 러브트리에 기본으로 적용돼요.');
    }
    
    // 공개 옵션
    var publicLabel = document.querySelector('#radio-public .radio-label');
    var publicDesc = document.querySelector('#radio-public .radio-description');
    if (publicLabel) {
      publicLabel.textContent = safeText('settings.public', '공개');
    }
    if (publicDesc) {
      publicDesc.textContent = safeText('settings.publicDesc', '다른 팬들과 내 러브트리를 공유할 수 있어요');
    }
    
    // 로그아웃 버튼
    var logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.innerHTML = '<span class="material-symbols-outlined">logout</span>' + safeText('logout_btn', '로그아웃');
    }
  }

  // UI 초기화
  function initSettings() {
    var settings = loadSettings();
    
    // i18n 텍스트 적용 (renderSharedHeader 후 호출되어야 하므로 지연)
    setTimeout(applyI18nText, 0);
    
    // 라디오 버튼 상태 설정
    var radioPrivate = document.querySelector('#radio-private input[value="private"]');
    var radioPublic = document.querySelector('#radio-public input[value="public"]');
    
    if (settings.defaultVisibility === 'public') {
      if (radioPublic) radioPublic.checked = true;
      if (radioPrivate) radioPrivate.checked = false;
      updateRadioStyles('public');
    } else {
      if (radioPrivate) radioPrivate.checked = true;
      if (radioPublic) radioPublic.checked = false;
      updateRadioStyles('private');
    }

    // 라디오 버튼 변경 이벤트
    document.querySelectorAll('input[name="visibility"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var value = this.value;
        settings.defaultVisibility = value;
        saveSettings(settings);
        updateRadioStyles(value);
        console.log('[settings] Default visibility changed to:', value);
      });
    });

    console.log('[settings] Initialized with:', settings);
  }

  // 라디오 버튼 스타일 업데이트
  function updateRadioStyles(selectedValue) {
    var privateOption = document.getElementById('radio-private');
    var publicOption = document.getElementById('radio-public');
    
    if (privateOption) {
      privateOption.classList.toggle('selected', selectedValue === 'private');
    }
    if (publicOption) {
      publicOption.classList.toggle('selected', selectedValue === 'public');
    }
  }

  // 로그아웃 처리
  function handleLogout() {
    if (typeof window.signOut === 'function') {
      window.signOut().then(function() {
        window.location.href = '../index.html';
      }).catch(function() {
        // 실패해도 홈으로 이동
        window.location.href = '../index.html';
      });
    } else {
      // auth.js가 로드되지 않은 경우 직접 Firebase 로그아웃 시도
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

  // 전역 노출
  window.initSettings = initSettings;
  window.handleLogout = handleLogout;
  window.getLoveBudSettings = loadSettings;
})();
