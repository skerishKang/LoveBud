/**
 * LoveBud - i18n Module
 * v20260416-2
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
    // shared-header.js - 네비게이션
    'nav.home': {
      ko: '첫화면',
      en: 'Home'
    },
    'nav.intro': {
      ko: '소개',
      en: 'About'
    },
    'nav.search': {
      ko: '둘러보기',
      en: 'Browse'
    },
    'nav.myTrees': {
      ko: '내 러브트리',
      en: 'My Trees'
    },
    'nav.editor': {
      ko: '편집하기',
      en: 'Edit'
    },
    // detail.html - 댓글/공유 (준비중)
    'action_coming_soon': {
      ko: '준비중',
      en: 'Coming soon'
    },

    // my-trees.js
    'empty_state_title': {
      ko: '아직 러브트리가 없어요',
      en: 'No LoveTrees yet'
    },
'empty_state_desc': {
 ko: '새 러브트리를 만들어 첫 추억의 씨앗을 심어보세요. 영상을 추가하고 감정을 기록하면 나무가 자라납니다.',
 en: 'Create your first LoveTree and plant a seed of memory. Add videos and record emotions to watch it grow.'
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
     'rename_tree_prompt': {
       ko: '트리 이름을 입력하세요:',
       en: 'Enter a tree name:'
     },
     'rename_success': {
       ko: '트리 이름이 변경되었습니다.',
       en: 'Tree name updated.'
     },
     'rename_fail': {
       ko: '이름 변경에 실패했습니다.',
       en: 'Failed to rename tree.'
     },
     'delete_tree_confirm': {
       ko: '정말 "{title}" 트리를 삭제하시겠습니까?',
       en: 'Are you sure you want to delete "{title}"?'
     },
     'delete_success': {
       ko: '트리가 삭제되었습니다.',
       en: 'Tree deleted.'
     },
     'delete_fail': {
       ko: '삭제에 실패했습니다.',
       en: 'Failed to delete tree.'
     },
     'api_not_available': {
       ko: 'API를 사용할 수 없습니다.',
       en: 'API is not available.'
     },
     'rename': {
       ko: '이름 변경',
       en: 'Rename'
     },
     'delete': {
       ko: '삭제',
       en: 'Delete'
     },

     // my-trees.js - State messages (UX hardening)
     'myTrees.loading': {
       ko: '러브트리 목록을 불러오는 중...',
       en: 'Loading your LoveTrees...'
     },
     'myTrees.error_title': {
       ko: '불러오기에 실패했습니다',
       en: 'Failed to load'
     },
     'myTrees.error_desc': {
       ko: '네트워크 연결을 확인하고 다시 시도해주세요.',
       en: 'Please check your network connection and try again.'
     },
     'myTrees.retry': {
       ko: '다시 시도',
       en: 'Retry'
     },
     'myTrees.offline_mode': {
       ko: '오프라인 모드 - 캐시된 데이터를 표시합니다',
       en: 'Offline mode - Showing cached data'
     },
     'myTrees.load_failed': {
       ko: '트리 목록을 불러오는데 실패했습니다',
       en: 'Failed to load trees'
     },

     // editor.js - Save status (UX hardening)
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
      ko: '🌱 새 트리의 시작',
      en: '🌱 New Tree Start'
    },
    'no_memory_yet': {
      ko: '🎉 첫 번째 순간을 추가해보세요! "영상 추가" 버튼을 클릭하면 감정이 시작됩니다.',
      en: '🎉 Click "Add Video" to add your first moment!'
    },
    'enter_youtube': {
      ko: 'YouTube 링크를 입력해주세요.',
      en: 'Please enter a YouTube link.'
    },
     'invalid_youtube': {
       ko: '유효한 YouTube 링크가 아닙니다.',
       en: 'Invalid YouTube link.'
     },
     'invalid_youtube_format': {
       ko: '전체 YouTube 링크를 붙여넣어 주세요.',
       en: 'Please paste the full YouTube URL.'
     },
     'invalid_youtube_unsupported': {
       ko: 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.',
       en: 'Only YouTube links are supported. Please use a youtube.com or youtu.be link.'
     },
     'invalid_youtube_id_length': {
       ko: '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.',
       en: 'The link looks incomplete. Please copy the full YouTube URL again.'
     },
     'tree_context_viewing': {
       ko: '감상 중',
       en: 'Viewing'
     },
     'tree_context_moment': {
       ko: '기억의 순간',
       en: 'Moment of Memory'
     },
     'tree_context_solo_view': {
       ko: '이 순간을 단독으로 감상하고 있어요. 트리 전체 경로를 보시려면 둘러보기에서 선택해주세요.',
       en: 'You are viewing this moment alone. Browse to see the full tree path.'
     },
     'tree_info_missing': {
       ko: '트리 정보 없음',
       en: 'Tree Info Missing'
     },
     'tree_load_failed_desc': {
       ko: '트리 정보를 불러오지 못했어요. 순간 감상은 계속할 수 있어요.',
       en: 'Could not load tree info. You can still view this moment.'
     },
     'tree_path_missing': {
       ko: '트리 경로 정보가 없어요',
       en: 'No tree path information'
     },
     'find_tree_in_browse': {
       ko: '둘러보기에서 트리 찾기',
       en: 'Find Tree in Browse'
     },
     'no_siblings_in_path': {
       ko: '같은 경로의 다른 순간이 없어요',
       en: 'No other moments in this path'
     },
     'browse_label': {
       ko: '둘러보기',
       en: 'Browse'
     },
     'editor_label': {
       ko: '편집 중',
       en: 'Editing'
     },
     'my_trees_label': {
       ko: '내 러브트리',
       en: 'My LoveTrees'
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
      en: 'Already have an account? Switch to login'
    },


    // intro.html
    'intro.heroTitle': {
      ko: '사랑하는 것들의',
      en: 'The things you love'
    },
    'intro.heroTitleSpan': {
      ko: '성장 과정을 기록하다',
      en: 'Record their growth'
    },
    'intro.heroLead': {
      ko: '러브트리는 좋아하는 대상의 입덕 순간부터 지금까지, 당신이 경험한 감정의 전 과정을 하나의 나무로 기록하는 공간입니다. 벚꽃이 피고 열매 맺는 것처럼, 당신의 팬심도 하나의 나무로 자라납니다.',
      en: 'LoveTree is a space to record the entire journey of emotions from your first fandom moment to now as a single tree. Like cherry blossoms blooming and bearing fruit, your fandom grows into a tree.'
    },
    'intro.visualizeGrowthTitle': {
      ko: '성장 과정 한눈에 보기',
      en: 'Visualize Your Growth'
    },
    'intro.visualizeGrowthDesc': {
      ko: '얼마나 좋아졌는지, 어떤 감정을 지나왔는지 한눈에 볼 수 있습니다.',
      en: 'See at a glance how much you have grown and what emotions you have experienced.'
    },
    'intro.whatIsDesc2Fixed': {
      ko: '시간이 지나도 그때 그 감정으로 돌아갈 수 있는 공간입니다.',
      en: 'A space where you can return to those feelings even as time passes.'
    },
    'intro.step3DescFixed': {
      ko: '편집 화면에서 기억들이 가지처럼 연결된 당신만의 러브트리를 확인하고, 완성되면 둘러보기에 공유하세요.',
      en: 'In the editor, see your memories connected like branches, and share to browse when complete.'
    },
    'intro.value3DescFixed': {
      ko: '시간이 지나도 그때의 감정이 생생하게 남아 있습니다.',
      en: 'Even as time passes, those feelings remain vivid.'
    },
    'nav.myTrees': {
      ko: '내 러브트리 시작하기',
      en: 'Start My LoveTrees'
    },
    'nav.browseOthers': {
      ko: '다른 트리 둘러보기',
      en: 'Browse Other Trees'
    },

    // search.html
    'search.previewTitle': {
      ko: '러브트리 미리보기',
      en: 'LoveTree Preview'
    },
    'search.previewPlaceholder': {
      ko: '트리를 선택하여 감상하기',
      en: 'Select a tree to view'
    },
    'search.placeholder': {
      ko: '예: 아티스트명 · 러브트리 주제 · 감정 태그',
      en: 'e.g., artist, theme, emotion tag'
    },

    // intro.html - hero section
    'intro.whatIs': {
      ko: '러브트리란?',
      en: 'What is LoveTree?'
    },
    'intro.whatIsDesc1': {
      ko: '러브트리는 특정 인물이나 그룹(주로 가수, 배우, 캐릭터 등)에 대한 감정과 기억을 시각적으로 기록하는 팬 다이어리 서비스입니다. 단순한 텍스트 일기가 아니라, 당신이 좋아하는 영상/음악의 한 장면을 기억에 남기고, 그 감정의 연결 고리를 나무 모양으로 시각화합니다.',
      en: 'LoveTree is a fan diary service that visually records emotions and memories for specific people or groups. Not just text diaries, but saving scenes from videos/music you love and visualizing the emotional connections as a tree.'
    },
    'intro.howToTitle': {
      ko: '어떻게 쓰나요?',
      en: 'How to use?'
    },
    'intro.howToSubtitle': {
      ko: '세 가지 단계로 당신만의 러브트리를 완성하세요.',
      en: 'Complete your LoveTree in three steps.'
    },
    'intro.step1Title': {
      ko: '영상 추가',
      en: 'Add Video'
    },
    'intro.step1Desc': {
      ko: 'YouTube 링크를 붙여넣으면 자동으로 썸네일을 가져와 노드에 저장됩니다. 가장 좋아하는 장면 한 컷을 골라보세요.',
      en: 'Paste a YouTube link to automatically fetch the thumbnail and save to a node. Pick your favorite scene.'
    },
    'intro.step2Title': {
      ko: '감정 메모',
      en: 'Emotion Memo'
    },
    'intro.step2Desc': {
      ko: '그 순간 느꼈던 감정을 태그와 함께 메모로 남기세요. 입덕, 설렘, 감사, 그리움 — 모든 감정이 모여 나무가 됩니다.',
      en: 'Leave a memo with tags about emotions felt at that moment. First love, excitement, gratitude, longing — all emotions become a tree.'
    },
    'intro.step3Title': {
      ko: '트리 확인',
      en: 'View Tree'
    },
    'intro.valueTitle': {
      ko: '이건 어떤 공간인가요?',
      en: 'What is this space?'
    },
    'intro.value1Title': {
      ko: '감정의 아카이브',
      en: 'Emotion Archive'
    },
    'intro.value1Desc': {
      ko: '단순한 기록이 아니라, 특정 시점에 느낀 감정의 결을 남기는 공간입니다.',
      en: 'Not just records, but a space to leave the texture of emotions felt at specific moments.'
    },
    'intro.value2Title': {
      ko: '함께 나누는 기쁨',
      en: 'Shared Joy'
    },
    'intro.value2Desc': {
      ko: '완성된 러브트리를 둘러보기에 올리면, 같은 취향의 다른 사람과 감정을 나눌 수 있습니다.',
      en: 'Share your completed LoveTree to browse and connect with others who have similar tastes.'
    },
    'intro.value3Title': {
      ko: '보물 같은 추억',
      en: 'Treasured Memories'
    },
    'intro.ctaTitle': {
      ko: '이제 당신의 러브트리를 시작하세요',
      en: 'Start Your LoveTree Now'
    },
    'intro.ctaDesc': {
      ko: '좋아하는 것의 첫 번째 기억을 기록하는 그 순간을 놓치지 마세요.',
      en: "Don't miss the moment to record the first memory of what you love."
    },
    'home.cta.start': {
      ko: '내 러브트리 시작하기',
      en: 'Start My LoveTree'
    },
    'home.cta.browse': {
      ko: '둘러보기',
      en: 'Browse'
    },

    // ── 누락 key 보충: index.html ──
    'home.badge': {
      ko: '💝 나만의 러브트리',
      en: '💝 My LoveTree'
    },
    'home.heroTitle': {
      ko: '사랑하는 것의\n모든 순간이 하나의 나무가 된다',
      en: 'Everything you love,\nevery moment becomes a tree'
    },
    'home.heroSubtitle': {
      ko: '입덕의 첫 설렘, 가장 감동했던 그 장면, 그리고 지금 이 순간까지.\n당신이 느낀 감정의 결을 남기고, 하나의 나무로 완성하세요.',
      en: 'From the first excitement of fandom, the most moving scene, to this very moment.\nLeave the texture of your emotions and complete them as a single tree.'
    },
    'home.intro': {
      ko: '더 알고 싶으세요?',
      en: 'Want to know more?'
    },

    // ── 누락 key 보충: search.html ──
    'search.title': {
      ko: '둘러보기',
      en: 'Browse'
    },
    'search.subtitle': {
      ko: '다른 팬들이 남긴 감정의 경로를 따라가보세요.\n어떤 순간들이 그들의 러브트리를 만들었을까요?',
      en: "Follow the emotional paths left by other fans.\nWhat moments made their LoveTrees?"
    },
    'search.filter.all': {
      ko: '전체 경로',
      en: 'All Paths'
    },
    'search.filter.newbie': {
      ko: '입덕 순간',
      en: 'First Fandom'
    },
    'search.filter.growing': {
      ko: '성장 과정',
      en: 'Growing'
    },
    'search.filter.fan': {
      ko: '최애 확정',
      en: 'Ultimate Fan'
    },

    // ── 누락 key 보충: nav ──
    'nav.intro': {
      ko: 'LoveTree 소개 보기',
      en: 'About LoveTree'
    },

    // ── 누락 key 보충: editor.js ──
'memory_added': {
 ko: '기억이 성공적으로 추가되었습니다',
 en: 'Memory added successfully'
 },
'memory_added_local': {
 ko: '기억이 저장되었습니다 (로컬만)',
 en: 'Memory saved locally'
 },
    'firebase_init_fail': {
      ko: 'Firebase 준비 실패. 페이지를 새로고침해 주세요.',
      en: 'Firebase failed to initialize. Please refresh the page.'
    },

    'myTrees.loading': {
      ko: '러브트리 목록을 불러오는 중...',
      en: 'Loading your LoveTrees...'
    },

    // ── editor.js placeholder/fallback 키 ──
    'default_tree_title': {
      ko: '새 러브트리',
      en: 'New LoveTree'
    },
    'private_info': {
      ko: '나만 볼 수 있는 트리입니다',
      en: 'Only you can see this tree'
    },

     // ── editor.js 알림 메시지 ──
     'no_permission_local': {
       ko: '저장 권한이 없습니다. 로컬에만 추가됩니다.',
       en: 'No save permission. Added to local only.'
     },
    'server_fail_local': {
      ko: '서버 연결 실패. 로컬에만 추가됩니다.',
      en: 'Server connection failed. Added to local only.'
    },

    // ── detail.js ──
    'lovetree_brand': {
      ko: '러브트리',
      en: 'LoveTree'
    },
    'edit_action': {
      ko: '편집하기',
      en: 'Edit'
    },
    'memory_record_prefix': {
      ko: '기록 — ',
      en: 'Recorded — '
    },
    'my_trees_short': {
      ko: '내 트리',
      en: 'My Trees'
    },
    'retry': {
      ko: '다시 시도',
      en: 'Retry'
    },
    'go_to_my_trees': {
      ko: '내 트리로 가기',
      en: 'Go to My Trees'
    },
    'tree_load_fail_title': {
      ko: '트리를 불러올 수 없어요',
      en: 'Unable to load tree'
    },
    'tree_load_error_title': {
      ko: '트리를 여는 중 문제가 발생했어요',
      en: 'Error opening tree'
    },
    'tree_not_found_title': {
      ko: '트리를 찾을 수 없어요',
      en: 'Tree not found'
    },
    'tree_load_api_unavailable': {
      ko: '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해주세요.',
      en: 'Tree API is unavailable. Please try again later.'
    },
    'tree_load_error_desc': {
      ko: '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 내 트리 목록으로 돌아가 주세요.',
      en: 'This may be a temporary server issue or permission problem. Please retry or go back to your trees.'
    },
    'tree_load_not_found_desc': {
      ko: '잘못된 링크이거나 접근 권한이 없는 트리입니다.',
      en: 'Invalid link or you do not have permission to access this tree.'
    },
    'local_save_badge': {
      ko: '로컬 저장',
      en: 'Local Save'
    },
    'current_tree': {
      ko: '현재 트리',
      en: 'Current Tree'
    },
    'waiting_first_moment': {
      ko: '첫 순간을 기다리고 있어요',
      en: 'Waiting for the first moment'
    },
    'empty_panel_hint': {
      ko: '아직 선택된 순간이 없습니다. 첫 번째 영상을 추가하면 이 패널에 순간 정보가 표시됩니다.',
      en: 'No moment selected yet. Add your first video to see moment details here.'
    },
    'start_moment': {
      ko: '시작 순간',
      en: 'Starting Moment'
    },
    'selected_moment': {
      ko: '선택된 순간',
      en: 'Selected Moment'
    },
    'empty_tree_memo': {
      ko: '이 트리는 아직 비어 있습니다. "영상 추가" 버튼으로 첫 순간을 기록해 보세요.',
      en: 'This tree is empty. Click "Add Video" to record your first moment.'
    },
    'root_moment_hint': {
      ko: '이 순간은 현재 트리의 시작점입니다',
      en: 'This moment is the starting point of the tree'
    },
    'path_moment_hint': {
      ko: '이 순간은 감정 경로의 한 지점입니다',
      en: 'This moment is a point along the emotional path'
    },
    'moment_detail': {
      ko: '순간 상세',
      en: 'Moment Detail'
    },
    'empty_tree_title': {
      ko: '새 트리가 비어있어요',
      en: 'New Tree is Empty'
    },
    'empty_tree_desc': {
      ko: '"영상 추가" 버튼을 클릭하여 첫 번째 감정을 기록해보세요!',
      en: 'Click "Add Video" to record your first emotion!'
    },
    'record_error': {
      ko: '기록 저장 중 오류가 발생했습니다',
      en: 'Error occurred while saving the record'
    },
    'tag_record': {
      ko: '기록',
      en: 'Record'
    },

    // ── 순간 수정/삭제 메시지 ──
    'edit_memory': {
      ko: '순간 수정',
      en: 'Edit Moment'
    },
    'delete_memory': {
      ko: '순간 삭제',
      en: 'Delete Moment'
    },
    'delete_confirm': {
      ko: '정말 이 순간을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      en: 'Are you sure you want to delete this moment? This action cannot be undone.'
    },
    'memory_updated': {
      ko: '순간이 수정되었습니다',
      en: 'Moment updated successfully'
    },
    'memory_deleted': {
      ko: '순간이 삭제되었습니다',
      en: 'Moment deleted successfully'
    },
    'update_failed': {
      ko: '수정에 실패했습니다',
      en: 'Update failed'
    },
    'delete_failed': {
      ko: '삭제에 실패했습니다',
      en: 'Delete failed'
    },
    'cancel': {
      ko: '취소',
      en: 'Cancel'
    },
    'save': {
      ko: '저장',
      en: 'Save'
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
    // textContent 번역
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });
    
    // placeholder 번역
    var placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key);
      }
    });
    
    console.log('[i18n] Applied to', elements.length, 'elements,', placeholderElements.length, 'placeholders');
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
