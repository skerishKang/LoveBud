/**
 * LoveBud - i18n (Internationalization) Module
 * v20260416-1
 * 
 * MVP 수준의 간단한 한국어/영어 지원
 * - localStorage에 언어 설정 저장
 * - dictionary 기반 번역
 * - 사용자 생성 콘텐츠는 번역하지 않음
 */

(function() {
    // 현재 언어获取
    window.getCurrentLang = function() {
        var saved = localStorage.getItem('lovebud_lang');
        return saved === 'en' ? 'en' : 'ko';
    };

    // 언어 설정
    window.setCurrentLang = function(lang) {
        if (lang !== 'en' && lang !== 'ko') lang = 'ko';
        localStorage.setItem('lovebud_lang', lang);
        return lang;
    };

    // 번역 함수
    window.t = function(key) {
        var lang = getCurrentLang();
        var dict = TRANSLATIONS[lang];
        return dict && dict[key] ? dict[key] : (TRANSLATIONS['ko'][key] || key);
    };

    // 번역 dictionary
    var TRANSLATIONS = {
        ko: {
            // 헤더 메뉴
            'nav.home': '첫화면',
            'nav.intro': '소개',
            'nav.search': '둘러보기',
            'nav.myTrees': '내 러브트리',
            'nav.editor': '편집하기',
            
            // Auth
            'auth.login': '로그인',
            'auth.logout': '로그아웃',
            'auth.myAccount': '내 계정',
            'auth.settings': '설정',
            
            // Home (index)
            'home.badge': '💝 나만의 러브트리',
            'home.heroTitle': '사랑하는 것들의\n성장 과정을 기록하다',
            'home.heroSubtitle': '좋아하는 아이돌의 첫 번째 순간부터 지금까지, 당신의 팬심이 자라가는 과정을 하나의 나무로 만들어보세요.',
            'home.cta.start': '내 러브트리 시작하기',
            'home.cta.browse': '둘러보기',
            'home.intro': '입덕의 순간을 기록하고,\n사랑이 자라는 과정을 보세요.',
            
            // Login
            'login.title': '다시 여기에 오신 것을\n환영합니다',
            'login.subtitle': '당신의 러브트리에 오신 것을 환영합니다.\n시작하려면 로그인해 주세요.',
            'login.googleBtn': '구글로 시작하기',
            'login.emailBtn': '이메일로 시작하기',
            'login.emailModal.title': '이메일로 로그인',
            'login.emailModal.helper': '이미 만든 이메일 계정으로 로그인합니다.',
            'login.emailModal.toggle': '계정이 없나요? 회원가입으로 전환',
            'login.signup.title': '이메일로 회원가입',
            'login.signup.helper': '새 이메일 계정을 만들고 로그인합니다.',
            'login.signup.toggle': '이미 계정이 있나요? 로그인으로 전환',
            
            // My Trees
            'myTrees.title': '내 러브트리',
            'myTrees.empty.title': '아직 러브트리가 없어요',
            'myTrees.empty.desc': '첫 번째 순간을 기록하고 당신만의 사랑 나무를 시작해보세요.\n입덕 순간부터 지금까지의 감정을 하나의 경로로 연결합니다.',
            'myTrees.create': '새 러브트리 만들기',
            'myTrees.loading': '러브트리 목록을 불러오는 중...',
            'myTrees.card.private': '비공개',
            'myTrees.card.public': '공개',
            
            // Search
            'search.title': '러브트리 감상하기',
            'search.subtitle': '누군가의 입덕 순간부터 지금까지, 어떤 감정들이 쌓여갔을까요?\n다른 사람들이 완성한 사랑의 경로를 둘러보세요.',
            'search.filter.all': '전체',
            'search.filter.newbie': '입덕',
            'search.filter.growing': '성장',
            'search.filter.fan': '최애',
            'search.empty.title': '러브트리가 자라나는 중입니다',
            'search.empty.desc': '아직 공개된 러브트리가 없어요.\n첫 번째 순간을 기록하고 당신의 나무를 키워보세요!',
            'search.noResult.title': '이런 러브트리는 아직 없네요',
            'search.noResult.desc': '다른 키워드나 단계로 찾아보세요',
            'search.loading': '기억들을 불러오는 중...',
            'search.moments': '개 순간',
            
            // Detail
            'detail.back': '돌아가기',
            'detail.related': '이어진 기억들',
            'detail.notFound.title': '기억을 찾지 못했어요',
            'detail.notFound.desc': '요청하신 기억이 존재하지 않거나\n접근할 수 없는 상태입니다.',
            
            // Editor
            'editor.title': '러브트리 편집',
            'editor.addMemory': '영상 추가',
            'editor.form.url': 'YouTube 링크',
            'editor.form.urlPlaceholder': 'https://youtube.com/...',
            'editor.form.title': '제목 (선택)',
            'editor.form.titlePlaceholder': '새로운 기억',
            'editor.form.memo': '메모 (선택)',
            'editor.form.memoPlaceholder': '이 기억에 대한感想을 적어보세요...',
            'editor.form.cancel': '취소',
            'editor.form.confirm': '추가하기',
            'editor.toast.noUrl': 'YouTube 링크를 입력해주세요.',
            'editor.toast.invalidUrl': '유효한 YouTube 링크가 아닙니다.',
            'editor.empty.title': '첫 번째 기억',
            'editor.empty.desc': '아직 등록된 기억이 없습니다. "영상 추가" 버튼을 클릭하여 첫 번째 추억을 기록해보세요.',
            
            // Common
            'common.loading': '로딩 중...',
            'common.error': '오류가 발생했습니다.',
            'common.cancel': '취소',
            'common.confirm': '확인',
            'common.save': '저장',
            'common.delete': '삭제',
            
            // Intro page
            'intro.whatIs': 'LoveTree란?',
            'intro.whatIsDesc1': 'LoveTree는 특정 인물이나 그룹(주로 가수, 배우, 캐릭터 등)에 대한 감정과 기억을 시각적으로 기록하는 팬 다이어리 서비스입니다. 단순한 텍스트 일기가 아니라, 당신이 좋아하는 영상/음악의 한 장면을 기억에 남기고, 그 감정의 연결 고리를 나무 모양으로 시각화합니다.',
            'intro.whatIsDesc2': '각 기억은 "입덕 순간", "최애 직캠", "성장 메모" 등 감정 태그와 함께 노드에 저장됩니다. 시간이 지나도 다시あの頃に戻れる — LoveTree는 그런 공간입니다.',
            'intro.howToTitle': '어떻게 쓰나요?',
            'intro.howToSubtitle': '세 가지 단계로 당신만의 LoveTree를 완성하세요.',
            'intro.step1Title': '영상 추가',
            'intro.step1Desc': 'YouTube 링크를 붙여넣으면 자동으로 썸네일을 가져와 노드에 저장됩니다. 가장 좋아하는 장면 한 컷을 골라보세요.',
            'intro.step2Title': '감정 메모',
            'intro.step2Desc': '그 순간 느꼈던 감정을 태그와 함께 메모로 남기세요. 입덕, 설렘, 감사, 그리움 — 모든 감정이 모여 나무가 됩니다.',
            'intro.step3Title': '트리 확인',
            'intro.step3Desc': '편집 화면에서 기억들이 나무처럼 연결된 당신만의 LoveTree를 확인하고, 완성되면 둘러보기에 공유하세요.',
            'intro.valueTitle': '이건 어떤 공간인가요?',
            'intro.value1Title': '감정의 아카이브',
            'intro.value1Desc': '단순한 기록이 아니라, 특정 시점에 느낀 감정의 결을 남기는 공간입니다.',
            'intro.value2Title': '함께 나누는 기쁨',
            'intro.value2Desc': '완성된 LoveTree를 둘러보기에 올리면, 같은 취향의 다른 사람과 감정을 나눌 수 있습니다.',
            'intro.value3Title': '보물 같은 추억',
            'intro.value3Desc': '시간이 지나도あの頃の 감정이 생생하게 남아 있습니다.',
            'intro.ctaTitle': '이제 당신의 LoveTree를 시작하세요',
            'intro.ctaDesc': '좋아하는 것의 첫 번째 기억을 기록하는 그 순간을 놓치지 마세요.',
        },
        
        en: {
            // Header Menu
            'nav.home': 'Home',
            'nav.intro': 'About',
            'nav.search': 'Explore',
            'nav.myTrees': 'My Trees',
            'nav.editor': 'Edit',
            
            // Auth
            'auth.login': 'Login',
            'auth.logout': 'Logout',
            'auth.myAccount': 'My Account',
            'auth.settings': 'Settings',
            
            // Home (index)
            'home.badge': '💝 My LoveTree',
            'home.heroTitle': 'Document the growth\nof what you love',
            'home.heroSubtitle': 'Create a tree that tracks your fan journey from the first moment you stan to today.',
            'home.cta.start': 'Start My Tree',
            'home.cta.browse': 'Explore',
            'home.intro': 'Capture your first stan moment\nand watch your love grow.',
            
            // Login
            'login.title': 'Welcome back',
            'login.subtitle': 'Welcome to your LoveTree.\nSign in to continue.',
            'login.googleBtn': 'Continue with Google',
            'login.emailBtn': 'Continue with Email',
            'login.emailModal.title': 'Email Login',
            'login.emailModal.helper': 'Sign in with your email account.',
            'login.emailModal.toggle': 'Need an account? Sign up',
            'login.signup.title': 'Email Sign Up',
            'login.signup.helper': 'Create a new email account and sign in.',
            'login.signup.toggle': 'Already have an account? Sign in',
            
            // My Trees
            'myTrees.title': 'My Trees',
            'myTrees.empty.title': 'No trees yet',
            'myTrees.empty.desc': 'Record your first moment and start your own love tree.\nConnect your emotions from your first stan to today in one path.',
            'myTrees.create': 'Create New Tree',
            'myTrees.loading': 'Loading trees...',
            'myTrees.card.private': 'Private',
            'myTrees.card.public': 'Public',
            
            // Search
            'search.title': 'Explore LoveTrees',
            'search.subtitle': 'What emotions have accumulated from someone\'s first stan moment to now?\nBrowse the love paths others have created.',
            'search.filter.all': 'All',
            'search.filter.newbie': 'Newbie',
            'search.filter.growing': 'Growing',
            'search.filter.fan': 'Diehard',
            'search.empty.title': 'Trees are growing',
            'search.empty.desc': 'No public trees yet.\nRecord your first moment and grow your tree!',
            'search.noResult.title': 'No trees found',
            'search.noResult.desc': 'Try a different keyword or category',
            'search.loading': 'Loading memories...',
            'search.moments': 'moments',
            
            // Detail
            'detail.back': 'Go Back',
            'detail.related': 'Connected Memories',
            'detail.notFound.title': 'Memory not found',
            'detail.notFound.desc': 'The memory you requested doesn\'t exist or is not accessible.',
            
            // Editor
            'editor.title': 'Edit Tree',
            'editor.addMemory': 'Add Video',
            'editor.form.url': 'YouTube Link',
            'editor.form.urlPlaceholder': 'https://youtube.com/...',
            'editor.form.title': 'Title (optional)',
            'editor.form.titlePlaceholder': 'New Memory',
            'editor.form.memo': 'Note (optional)',
            'editor.form.memoPlaceholder': 'Write your thoughts about this memory...',
            'editor.form.cancel': 'Cancel',
            'editor.form.confirm': 'Add',
            'editor.toast.noUrl': 'Please enter a YouTube link.',
            'editor.toast.invalidUrl': 'Invalid YouTube link.',
            'editor.empty.title': 'First Memory',
            'editor.empty.desc': 'No memories yet. Click "Add Video" to record your first moment.',
            
            // Common
            'common.loading': 'Loading...',
            'common.error': 'An error occurred.',
            'common.cancel': 'Cancel',
            'common.confirm': 'Confirm',
            'common.save': 'Save',
            'common.delete': 'Delete',
            
            // Intro page
            'intro.whatIs': 'What is LoveTree?',
            'intro.whatIsDesc1': 'LoveTree is a fan diary service that visually records emotions and memories about a specific person or group (usually singers, actors, characters, etc.). It\'s not just a text journal — you can save moments from videos or music you love and visualize the emotional connections as a tree.',
            'intro.whatIsDesc2': 'Each memory is stored as a node with emotion tags like "First Stan", "Favorite Cam", "Growth Note". You can always go back to that moment in time — that\'s what LoveTree is for.',
            'intro.howToTitle': 'How to use it?',
            'intro.howToSubtitle': 'Complete your own LoveTree in three steps.',
            'intro.step1Title': 'Add Video',
            'intro.step1Desc': 'Paste a YouTube link and it automatically fetches the thumbnail. Pick your favorite moment as a node.',
            'intro.step2Title': 'Add Emotion Note',
            'intro.step2Desc': 'Write down the emotions you felt at that moment with tags. Stan, excitement, gratitude, nostalgia — all emotions come together to form the tree.',
            'intro.step3Title': 'View Your Tree',
            'intro.step3Desc': 'Check your LoveTree connected like branches in the editor, then share it on Explore when complete.',
            'intro.valueTitle': 'What kind of space is this?',
            'intro.value1Title': 'Archive of Emotions',
            'intro.value1Desc': 'It\'s not just recording — it\'s leaving behind the threads of emotions you felt at specific moments.',
            'intro.value2Title': 'Joy of Sharing',
            'intro.value2Desc': 'When you share your completed LoveTree on Explore, you can share emotions with others who have the same taste.',
            'intro.value3Title': 'Treasured Memories',
            'intro.value3Desc': 'Even over time, those emotions from back then remain vivid.',
            'intro.ctaTitle': 'Start your LoveTree now',
            'intro.ctaDesc': 'Don\'t miss the moment when you record your first memory of something you love.',
        }
    };

    // 페이지 로드 시 번역 적용
    function applyTranslations() {
        var lang = getCurrentLang();
        
        // data-i18n 속성이 있는 요소 번역
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            var translated = t(key);
            if (translated !== key) {
                el.textContent = translated;
            }
        });
        
        // data-i18n-placeholder 속성
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            var translated = t(key);
            if (translated !== key) {
                el.placeholder = translated;
            }
        });
        
        // data-i18n-title 속성
        document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-title');
            var translated = t(key);
            if (translated !== key) {
                el.title = translated;
            }
        });
    }

    // 언어 변경 후 페이지 번역 적용
    window.applyI18n = function() {
        applyTranslations();
        // 페이지 새로고침 (필요시)
        // location.reload(); 
    };

    // DOM 준비 시 번역 적용
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyTranslations);
    } else {
        applyTranslations();
    }
})();