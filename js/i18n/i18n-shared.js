/**
 * LoveBud - i18n Shared Dictionary
 * v20260425-1
 *
 * 공통 번역 키 (네비게이션, 버튼, 상태 메시지 등)
 */

(function() {
  'use strict';

  window.i18nShared = {
    // 네비게이션 (nav.*)
    'nav.home': {
      ko: '처음으로',
      en: 'Home'
    },
    'nav.intro': {
      ko: '러브트리',
      en: 'About'
    },
    'nav.search': {
      ko: '둘러보기',
      en: 'Browse'
    },
    'nav.myTrees': {
      ko: '나의트리',
      en: 'My Trees'
    },
    'nav.editor': {
      ko: '편집하기',
      en: 'Edit'
    },
    'nav.settings': {
      ko: '설정',
      en: 'Settings'
    },
    'nav.browseOthers': {
      ko: '다른 트리 둘러보기',
      en: 'Browse Other Trees'
    },

    // 홈 화면 (home.*)
    'home.badge': {
      ko: '💝 나만의 러브트리',
      en: '💝 My LoveTree'
    },
    'home.heroTitle': {
      ko: '<span class="title-line">사랑하는 것의</span><span class="title-line title-accent">모든 순간이</span><span class="title-line">하나의 나무가 된다</span>',
      en: '<span class="title-line">Every moment</span><span class="title-line title-accent">of what you love</span><span class="title-line">becomes a single tree</span>'
    },
    'home.heroSubtitle': {
      ko: '좋아하게 된 순간들을 남기면, 내 러브트리로 이어집니다.',
      en: 'Save the moments that stayed with you, and let them grow into your LoveTree.'
    },
    'home.cta.start': {
      ko: '내 러브트리 시작하기',
      en: 'Start My LoveTree'
    },
    'home.cta.browse': {
      ko: '공개 러브트리 감상하기',
      en: 'Explore Public LoveTrees'
    },
    'home.flow.one': {
      ko: '첫 순간 남기기',
      en: 'Save the first moment'
    },
    'home.flow.two': {
      ko: '마음 이어가기',
      en: 'Follow the feeling'
    },
    'home.flow.three': {
      ko: '내 트리 바라보기',
      en: 'Watch my tree grow'
    },
    'home.supportCopy': {
      ko: '바로 시작하거나 먼저 감상해보세요.',
      en: 'Start right away, or browse first.'
    },
    'home.intro': {
      ko: '직접 만들어보기 전에 미리 둘러보고 싶다면',
      en: 'If you want to look around before creating your own'
    },

    // 공통 버튼/액션
    'login_btn': {
      ko: '로그인',
      en: 'Login'
    },
    'signup_btn': {
      ko: '회원가입',
      en: 'Sign up'
    },
    'cancel': {
      ko: '취소',
      en: 'Cancel'
    },
    'save': {
      ko: '저장',
      en: 'Save'
    },
    'close': {
      ko: '닫기',
      en: 'Close'
    },
    'rename': {
      ko: '이름 변경',
      en: 'Rename'
    },
    'delete': {
      ko: '삭제',
      en: 'Delete'
    },
    'retry': {
      ko: '다시 시도',
      en: 'Retry'
    },
    'back_to_home': {
      ko: '첫화면으로',
      en: 'Home'
    },

    // 공통 상태/레이블
    'visibility_public': {
      ko: '공개',
      en: 'Public'
    },
    'visibility_private': {
      ko: '비공개',
      en: 'Private'
    },
    'lovetree_brand': {
      ko: '러브트리',
      en: 'LoveTree'
    },
    'my_trees_short': {
      ko: '내 트리',
      en: 'My Trees'
    },
    'local_save_badge': {
      ko: '로컬 저장',
      en: 'Local Save'
    },
    'tag_record': {
      ko: '기록',
      en: 'Record'
    },
    'api_not_available': {
      ko: 'API를 사용할 수 없습니다.',
      en: 'API is not available.'
    },

    // 저장 상태
    'save_saving': {
      ko: '저장 중...',
      en: 'Saving...'
    },
    'save_saved': {
      ko: '저장됨',
      en: 'Saved'
    },
    'save_failed': {
      ko: '저장 실패',
      en: 'Save failed'
    },
    'save_saved_local': {
      ko: '로컬 저장됨',
      en: 'Saved locally'
    },

    // 준비중
    'action_coming_soon': {
      ko: '준비중',
      en: 'Coming soon'
    },

    // 설정 페이지
    'settings.backToMyTrees': {
      ko: '내 러브트리로 돌아가기',
      en: 'Back to My Trees'
    },
    'settings.title': {
      ko: '설정',
      en: 'Settings'
    },
    'settings.subtitle': {
      ko: '러브트리를 어떻게 소개할지 살펴봅니다',
      en: 'Review how your LoveTree can be introduced'
    },
    'settings.browseIntroTitle': {
      ko: '둘러보기 소개',
      en: 'Browse introduction'
    },
    'settings.browseIntroCardTitle': {
      ko: '둘러보기에 소개될 트리로 키우기',
      en: 'Grow this tree toward Browse introduction'
    },
    'settings.browseIntroDesc': {
      ko: '좋아하는 순간을 3개 이상 남기면 이 트리를 둘러보기에 소개할 수 있어요. 소개 여부는 각 러브트리에서 조건을 채운 뒤 선택할 수 있어요.',
      en: 'Save 3 or more favorite moments, and this tree can be introduced in Browse. You can choose introduction after each LoveTree meets the condition.'
    },
    'settings.privateStorageTitle': {
      ko: '프라이빗 보관',
      en: 'Private storage'
    },
    'settings.privateStorageDesc': {
      ko: '나만 보는 러브트리를 조용히 보관하는 기능은 Plus에서 준비 중이에요.',
      en: 'Quiet storage for LoveTrees only you can see is being prepared for Plus.'
    },
    'settings.visibilityTitle': {
      ko: '기본 공개 범위',
      en: 'Default Visibility'
    },
    'settings.private': {
      ko: '비공개',
      en: 'Private'
    },
    'settings.privateDesc': {
      ko: '새로 만드는 러브트리에 기본으로 적용돼요.',
      en: 'This applies by default to new LoveTrees.'
    },
    'settings.public': {
      ko: '공개',
      en: 'Public'
    },
    'settings.publicDesc': {
      ko: '다른 팬들과 내 러브트리를 공유할 수 있어요',
      en: 'Share your LoveTrees with other fans'
    },
    'logout_btn': {
      ko: '로그아웃',
      en: 'Logout'
    },

    // 감정 태그 (emotion tags)
    '예술': {
      ko: '예술',
      en: 'Art'
    },
    '컨셉': {
      ko: '컨셉',
      en: 'Concept'
    }
  };
})();
