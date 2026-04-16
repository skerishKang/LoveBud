/**
 * LoveBud - Settings Module
 * v20260416-1
 * 
 * localStorage 기반 설정 관리
 * - 기본 공개 범위 (defaultVisibility)
 */

(function() {
  var SETTINGS_KEY = 'lovebud_user_settings';
  var DEFAULT_SETTINGS = {
    defaultVisibility: 'private'
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

  // UI 초기화
  function initSettings() {
    var settings = loadSettings();
    
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
