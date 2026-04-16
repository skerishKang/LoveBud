/**
 * LoveBud - Shared Header Component
 * v20260416-1
 * 
 * 모든 페이지에 공통 헤더를 렌더링합니다.
 * - 현재 페이지에 맞는 active 메뉴 자동 표시
 * - 상대경로 차이 자동 처리 (root vs pages)
 * - auth.js가 붙을 #auth-nav 또는 #auth-nav-container 계약 유지
 * 
 * 사용법:
 * <script src="js/shared-header.js"></script>
 * <div id="shared-header"></div>
 * <script>renderSharedHeader();</script>
 */

(function() {
    // 페이지 유형별 메뉴 설정
    var MENU_CONFIG = {
        // root (index.html)
        'root': {
            home: { text: '첫화면', href: 'index.html', active: true },
            intro: { text: '소개', href: 'pages/intro.html' },
            search: { text: '둘러보기', href: 'pages/search.html' },
            myTrees: { text: '내 러브트리', href: 'pages/my-trees.html' },
            editor: null // root에서는 에디터 숨김
        },
        // pages 폴더 내 페이지
        'pages': {
            home: { text: '첫화면', href: '../index.html' },
            intro: { text: '소개', href: 'intro.html' },
            search: { text: '둘러보기', href: 'search.html' },
            myTrees: { text: '내 러브트리', href: 'my-trees.html' },
            editor: { text: '편집하기', href: 'editor.html' }
        }
    };

    // 페이지별 active 메뉴 매핑
    var PAGE_ACTIVE_MAP = {
        'index.html': 'home',
        'intro.html': 'intro',
        'search.html': 'search',
        'detail.html': 'search', // detail은 둘러보기 섹션
        'my-trees.html': 'myTrees',
        'editor.html': 'editor',
        'login.html': null // login은 메뉴 active 없음
    };

    // 현재 페이지 감지
    function getCurrentPage() {
        var path = window.location.pathname;
        var filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    // 루트(index.html)인지 pages 폴더인지 감지
    function getContextType() {
        var path = window.location.pathname;
        // path에 /pages/가 포함되거나, root 바로 아래 html이면 pages 타입
        if (path.indexOf('/pages/') !== -1 || path.endsWith('.html') && path.split('/').length <= 2) {
            // index.html은 root, others는 pages
            var filename = path.split('/').pop();
            if (filename === 'index.html' || filename === '') return 'root';
            return 'pages';
        }
        // 기본은 pages (pages 폴더内的 기본값)
        return 'pages';
    }

    // 에디터 페이지인지 확인
    function isEditorPage() {
        return window.location.pathname.indexOf('editor.html') !== -1;
    }

    // 로그인 페이지인지 확인
    function isLoginPage() {
        return window.location.pathname.indexOf('login.html') !== -1;
    }

    // 헤더 HTML 생성
    function buildHeaderHTML() {
        var contextType = getContextType();
        var currentPage = getCurrentPage();
        var activeKey = PAGE_ACTIVE_MAP[currentPage] || null;
        var menuConfig = MENU_CONFIG[contextType];
        
        // auth 영역: login 페이지면 #auth-nav-container, 아니면 #auth-nav
        var authContainerId = isLoginPage() ? 'auth-nav-container' : 'auth-nav';
        
        // auth 영역 초기 HTML (auth.js가 나중에 교체)
        var authHTML = isLoginPage() 
            ? '<div id="auth-nav-container"></div>'
            : '<div id="auth-nav" style="min-width:100px;height:36px;display:flex;align-items:center;justify-content:flex-end;"><span class="material-symbols-outlined" style="color:var(--on-surface-variant);animation:spin 1s linear infinite;font-size:20px;">progress_activity</span></div>';

        // 루트 경로 (로고 클릭 시 이동)
        var logoHref = contextType === 'root' ? 'index.html' : '../index.html';

        // 메뉴 링크 생성
        var navLinksHTML = '';
        
        // 첫화면
        if (menuConfig.home) {
            var activeClass = activeKey === 'home' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.home.href + '"' + activeClass + '>' + menuConfig.home.text + '</a>';
        }
        
        // 소개
        if (menuConfig.intro) {
            var activeClass = activeKey === 'intro' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.intro.href + '"' + activeClass + '>' + menuConfig.intro.text + '</a>';
        }
        
        // 둘러보기
        if (menuConfig.search) {
            var activeClass = activeKey === 'search' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.search.href + '"' + activeClass + '>' + menuConfig.search.text + '</a>';
        }
        
        // 내 러브트리 (에디터 페이지에서는 숨김)
        if (menuConfig.myTrees && !isEditorPage()) {
            var activeClass = activeKey === 'myTrees' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.myTrees.href + '"' + activeClass + '>' + menuConfig.myTrees.text + '</a>';
        }
        
        // 편집하기 (에디터 페이지에서만 표시)
        if (menuConfig.editor && isEditorPage()) {
            var activeClass = ' class="active"';
            navLinksHTML += '<a href="' + menuConfig.editor.href + '"' + activeClass + '>' + menuConfig.editor.text + '</a>';
        }

        return [
            '<header class="nav-bar">',
                '<div class="headline" style="font-size: 1.5rem; font-weight: 900; color: var(--on-surface); letter-spacing: -0.04em; cursor: pointer;" onclick="location.href=\'' + logoHref + '\'">Lovetree</div>',
                '<nav class="main-nav">',
                    '<div class="nav-links">',
                        navLinksHTML,
                    '</div>',
                    '<div style="display: flex; align-items: center; gap: 20px;">',
                        '<div class="lang-toggle">',
                            '<button class="lang-btn active">KR</button>',
                            '<button class="lang-btn">EN</button>',
                        '</div>',
                        authHTML,
                    '</div>',
                '</nav>',
            '</header>'
        ].join('');
    }

    // 공통 헤더 렌더링
    window.renderSharedHeader = function() {
        var container = document.getElementById('shared-header');
        if (!container) {
            console.warn('[shared-header] #shared-header container not found');
            return;
        }
        container.innerHTML = buildHeaderHTML();
        console.log('[shared-header] Rendered for:', getCurrentPage(), '| context:', getContextType());
    };

    // DOM 준비 완료 시 자동 렌더링 (선택적)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // 자동 렌더링은 선택 - 나중에手動 호출 가능
        });
    }
})();