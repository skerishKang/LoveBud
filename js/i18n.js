/**
 * LoveBud - i18n Module
 * v20260416-1
 *
 * 언어 설정 관리 및 다국어 지원
 * - 기본 언어: 한국어 (ko)
 * - 영어 지원 (en)
 * - localStorage 저장
 */

(function() {
  var I18N_KEY = 'lovebud_lang';
  var DEFAULT_LANG = 'ko';

  // 번역 딕셔너리
  var dictionary = {
    // my-trees.js
    'empty_state_title': {
      ko: '아직 러브트리가 없어요',
      en: 'No LoveTrees yet'
    },
    'empty_state_desc': {
      ko: '첫 번째 순간을 기록하고 당신만의 사랑 나무를 시작해보세요.입덕 순간부터 지금까지의 감정을 하나의 경로로 연결합니다.',
      en: 'Record your first moment and start your own love tree.Connect your emotions from your first fandom moment to now.'
    },
    'create_tree_btn': {
      ko: '새 러브트리 만들기',
      en: 'Create New LoveTree'
    },
    'creating': {
      ko: '만드는 중...',
      en: 'Creating...'
    },
    'demo_mode': {
      ko: '데모 모드입니다. 실제 트리는 생성되지 않습니다.',
      en: 'Demo mode. No actual tree will be created.'
    },
    'create_tree_fail': {
      ko: '러브트리 만들기 실패. 다시 시도해 주세요.',
      en: 'Failed to create LoveTree. Please try again.'
    },
    'visibility_public': {
      ko: '공개',
      en: 'Public'
    },
    'visibility_private': {
      ko: '비공개',
      en: 'Private'
    },

    // detail.js
    'memory_not_found_title': {
      ko: '기억을 찾지 못했어요',
      en: 'Memory not found'
    },
    'memory_not_found_desc': {
      ko: '요청하신 기억이 존재하지 않거나접근할 수 없는 상태입니다.',
      en: 'The requested memory does not existor is inaccessible.'
    },
    'back_to_home': {
      ko: '첫화면으로',
      en: 'Home'
    },
    'browse_lovetrees': {
      ko: '러브트리 둘러보기',
      en: 'Browse LoveTrees'
    },
    'viewing_lovetree': {
      ko: '러브트리 감상 중',
      en: 'Viewing LoveTree'
    },
    'from_browse': {
      ko: '둘러보기에서 선택한 트리의 첫 순간',
      en: 'First moment from browse selection'
    },
    'from_my_trees': {
      ko: '내 러브트리의 감정 경로',
      en: 'Emotional path of my LoveTree'
    },
    'no_video': {
      ko: '비디오가 없습니다',
      en: 'No video available'
    },
    'unknown_artist': {
      ko: 'Unknown',
      en: 'Unknown'
    },

    // editor.js
    'need_login': {
      ko: '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
      en: 'Login required. Redirecting to login page.'
    },
    'data_load_fail_demo': {
      ko: '데이터를 불러올 수 없습니다. 데모 모드로 전환됩니다.',
      en: 'Failed to load data. Switching to demo mode.'
    },
    'first_memory': {
      ko: '첫 번째 기억',
      en: 'First Memory'
    },
    'no_memory_yet': {
      ko: '아직 등록된 기억이 없습니다. "영상 추가" 버튼을 클릭하여 첫 번째 추억을 기록해보세요.',
      en: 'No memories yet. Click "Add Video" to record your first memory.'
    },
    'enter_youtube': {
      ko: 'YouTube 링크를 입력해주세요.',
      en: 'Please enter a YouTube link.'
    },
    'invalid_youtube': {
      ko: '유효한 YouTube 링크가 아닙니다.',
      en: 'Invalid YouTube link.'
    },
    'new_memory': {
      ko: '새로운 기억',
      en: 'New Memory'
    },
    'no_permission_local': {
      ko: '저장 권한이 없습니다. 로컬에만 추가됩니다.',
      en: 'No save permission. Added to local only.'
    },
    'check_input': {
      ko: '입력값을 확인해주세요.',
      en: 'Please check your input.'
    },
    'server_fail_local': {
      ko: '서버 연결 실패. 로컬에만 추가됩니다.',
      en: 'Server connection failed. Added to local only.'
    },
    'default_tree_title': {
      ko: '나의 첫 러브트리',
      en: 'My First LoveTree'
    },

    // login.html
    'login_title': {
      ko: '당신의 감정 나무를 시작하세요',
      en: 'Start Your Emotional Tree'
    },
    'login_desc': {
      ko: '처음 사랑에 빠진 순간부터, 팬이 되어가는 모든 경로를영상과 메모로 연결해 기록하세요.',
      en: 'From your first fandom moment to becoming a fan,record your journey with videos and memos.'
    },
    'google_login': {
      ko: 'Google로 시작하기',
      en: 'Start with Google'
    },
    'or_email': {
      ko: '또는 이메일로 시작하기',
      en: 'Or start with email'
    },
    'email_login': {
      ko: '이메일로 시작하기',
      en: 'Start with email'
    },
    'badge_first_moment': {
      ko: '첫 순간 기록',
      en: 'First Moment'
    },
    'badge_tree_grow': {
      ko: '감정 나무 성장',
      en: 'Growing Tree'
    },
    'badge_safe': {
      ko: '안전한 보관',
      en: 'Safe Storage'
    },
    'later': {
      ko: '나중에 시작하기',
      en: 'Start later'
    },
    'email_modal_title_login': {
      ko: '이메일로 로그인',
      en: 'Login with Email'
    },
    'email_modal_desc_login': {
      ko: '이미 만든 이메일 계정으로 로그인합니다',
      en: 'Login with your existing email account'
    },
    'email_modal_title_signup': {
      ko: '이메일로 회원가입',
      en: 'Sign up with Email'
    },
    'email_modal_desc_signup': {
      ko: '새로운 이메일 계정을 만듭니다',
      en: 'Create a new email account'
    },
    'email_label': {
      ko: '이메일',
      en: 'Email'
    },
    'password_label': {
      ko: '비밀번호',
      en: 'Password'
    },
    'login_btn': {
      ko: '로그인',
      en: 'Login'
    },
    'signup_btn': {
      ko: '회원가입',
      en: 'Sign up'
    },
    'switch_to_signup': {
      ko: '계정이 없나요? 회원가입으로 전환',
      en: 'No account? Switch to sign up'
    },
    'switch_to_login': {
      ko: '이미 계정이 있나요? 로그인으로 전환',
      en: 'Have an account? Switch to login'
    },
    'close': {
      ko: '닫기',
      en: 'Close'
    }
  };

  // 현재 언어 가져오기
  function getCurrentLang() {
    try {
      var stored = localStorage.getItem(I18N_KEY);
      if (stored && (stored === 'ko' || stored === 'en')) {
        return stored;
      }
    } catch (e) {
      console.warn('[i18n] Failed to read language:', e);
    }
    return DEFAULT_LANG;
  }

  // 언어 설정하기
  function setCurrentLang(lang) {
    if (lang !== 'ko' && lang !== 'en') {
      console.warn('[i18n] Invalid language:', lang);
      return false;
    }
    try {
      localStorage.setItem(I18N_KEY, lang);
      console.log('[i18n] Language set to:', lang);
      return true;
    } catch (e) {
      console.warn('[i18n] Failed to save language:', e);
      return false;
    }
  }

  // 번역 텍스트 가져오기
  function t(key) {
    var lang = getCurrentLang();
    var entry = dictionary[key];
    if (!entry) {
      console.warn('[i18n] Missing key:', key);
      return key;
    }
    return entry[lang] || entry[DEFAULT_LANG] || key;
  }

  // data-i18n 속성을 가진 요소들에 번역 적용
  function applyI18n() {
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });
    console.log('[i18n] Applied to', elements.length, 'elements');
  }

  // 언어 변경 이벤트 리스너 (shared-header.js에서 호출)
  function onLangChange(callback) {
    window.addEventListener('lovebud-lang-change', function(e) {
      callback(e.detail.lang);
    });
  }

  // 언어 변경 이벤트 발생
  function triggerLangChange(lang) {
    window.dispatchEvent(new CustomEvent('lovebud-lang-change', {
      detail: { lang: lang }
    }));
  }

  // 전역 노출
  window.getCurrentLang = getCurrentLang;
  window.setCurrentLang = setCurrentLang;
  window.t = t;
  window.applyI18n = applyI18n;
  window.onLangChange = onLangChange;
  window.triggerLangChange = triggerLangChange;
  window.i18nDictionary = dictionary; // 디버깅용
})();
