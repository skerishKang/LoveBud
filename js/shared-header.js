/**
 * LoveBud - Shared Header Component
 * v20260421-2
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
    // i18n 헬퍼 ( fallback: 키 반환)
    function t(key) {
        if (window.t && typeof window.t === 'function') {
            return window.t(key);
        }
        return key;
    }

    // 페이지 유형별 메뉴 설정 (i18n 키 사용)
    var MENU_CONFIG = {
        // root (index.html)
        'root': {
            home: { textKey: 'nav.home', href: 'index.html', active: true },
            intro: { textKey: 'nav.intro', href: 'pages/intro.html' },
            search: { textKey: 'nav.search', href: 'pages/search.html' },
            myTrees: { textKey: 'nav.myTrees', href: 'pages/my-trees.html' },
            settings: { textKey: 'nav.settings', href: 'pages/settings.html' },
            editor: null // root에서는 에디터 숨김
        },
        // pages 폴더 내 페이지
        'pages': {
            home: { textKey: 'nav.home', href: '../index.html' },
            intro: { textKey: 'nav.intro', href: 'intro.html' },
            search: { textKey: 'nav.search', href: 'search.html' },
            myTrees: { textKey: 'nav.myTrees', href: 'my-trees.html' },
            settings: { textKey: 'nav.settings', href: 'settings.html' },
            editor: { textKey: 'nav.editor', href: 'editor.html' }
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
        'login.html': null, // login은 메뉴 active 없음
        'settings.html': 'settings'
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
        var filename = path.split('/').pop();

        if (path === '/' || filename === 'index.html' || filename === '') {
            return 'root';
        }

        if (path.indexOf('/pages/') !== -1) {
            return 'pages';
        }

        if (path.endsWith('.html') && path.split('/').length <= 2) {
            return 'pages';
        }

        return 'pages';
    }

    function isEditorPage() {
        return getCurrentPage() === 'editor.html';
    }

    // Confirmed session helper - 헤더 즉시 렌더링용
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

    // 캐시된 유저 정보로부터 아바타 HTML 생성
    function buildCachedUserAvatar(cachedUser) {
        if (!cachedUser) return '';
        var displayName = cachedUser.displayName || cachedUser.email || 'User';
        var initial = displayName.charAt(0).toUpperCase();
        return [
            '<div style="display:flex;align-items:center;gap:8px;">',
                '<div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:500;">',
                    initial,
                '</div>',
                '<span style="font-size:14px;color:var(--on-surface);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + displayName + '</span>',
            '</div>'
        ].join('');
    }

    // 로그인 페이지인지 확인
    function isLoginPage() {
        return getCurrentPage() === 'login.html';
    }

    // 헤더 HTML 생성
    function buildHeaderHTML() {
        var contextType = getContextType();
        var currentPage = getCurrentPage();
        var activeKey = PAGE_ACTIVE_MAP[currentPage] || null;
        var menuConfig = MENU_CONFIG[contextType];
        
        // auth 영역: login 페이지면 #auth-nav-container, 아니면 #auth-nav
        var authContainerId = isLoginPage() ? 'auth-nav-container' : 'auth-nav';
        
        // auth 영역 초기 HTML - confirmed session 있으면 즉시 프로필 표시
        var cachedUser = !isLoginPage() ? getConfirmedSessionUser() : null;
        var authHTML;
        
        if (isLoginPage()) {
            authHTML = '<div id="auth-nav-container"></div>';
        } else if (cachedUser) {
            // Confirmed session 있으면 즉시 사용자 아바타 표시 (로딩 없음)
            authHTML = '<div id="auth-nav" style="min-width:100px;height:36px;display:flex;align-items:center;justify-content:flex-end;">' + buildCachedUserAvatar(cachedUser) + '</div>';
            console.log('[shared-header] Rendering cached user immediately:', cachedUser.displayName || cachedUser.email);
        } else {
            // Session 없으면 로딩 스피너 표시 (auth.js가 나중에 교체)
            authHTML = '<div id="auth-nav" style="min-width:100px;height:36px;display:flex;align-items:center;justify-content:flex-end;"><span class="material-symbols-outlined" style="color:var(--on-surface-variant);animation:spin 1s linear infinite;font-size:20px;">progress_activity</span></div>';
        }

        // 루트 경로 (로고 클릭 시 이동)
        var logoHref = contextType === 'root' ? 'index.html' : '../index.html';

        // 메뉴 링크 생성
        var navLinksHTML = '';
        
        // 첫화면
        if (menuConfig.home) {
            var activeClass = activeKey === 'home' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.home.href + '"' + activeClass + '>' + t(menuConfig.home.textKey) + '</a>';
        }
        
        // 소개
        if (menuConfig.intro) {
            var activeClass = activeKey === 'intro' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.intro.href + '"' + activeClass + '>' + t(menuConfig.intro.textKey) + '</a>';
        }
        
        // 둘러보기
        if (menuConfig.search) {
            var activeClass = activeKey === 'search' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.search.href + '"' + activeClass + '>' + t(menuConfig.search.textKey) + '</a>';
        }
        
        // 내 러브트리 (에디터 페이지에서는 숨김)
        if (menuConfig.myTrees && !isEditorPage()) {
            var activeClass = activeKey === 'myTrees' ? ' class="active"' : '';
            navLinksHTML += '<a href="' + menuConfig.myTrees.href + '"' + activeClass + '>' + t(menuConfig.myTrees.textKey) + '</a>';
        }
        
        // 에디터 페이지에서는 "편집하기" 메뉴 숨김 (이미 편집 화면 안에 있음)

        return [
            '<header class="nav-bar">',
                '<div class="headline" style="font-size: 1.5rem; font-weight: 900; color: var(--on-surface); letter-spacing: -0.04em; cursor: pointer;" onclick="location.href=\'' + logoHref + '\'">LoveTree</div>',
                '<button class="mobile-nav-toggle" id="mobileNavToggle" type="button" aria-label="메뉴 열기" aria-expanded="false">',
                    '<span class="material-symbols-outlined">menu</span>',
                '</button>',
                '<nav class="main-nav" id="mainNav">',
                    '<div class="main-nav-panel" id="mainNavPanel">',
                        '<div class="nav-links">',
                            navLinksHTML,
                        '</div>',
                        '<div class="nav-actions">',
                            authHTML,
                        '</div>',
                    '</div>',
                '</nav>',
            '</header>',
        ].join('');
    }

    function setupMobileNav() {
        var toggleBtn = document.getElementById('mobileNavToggle');
        var panel = document.getElementById('mainNavPanel');
        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = panel.classList.toggle('show');
            toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', function(e) {
            if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
                panel.classList.remove('show');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });

        panel.querySelectorAll('a, button').forEach(function(el) {
            el.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    panel.classList.remove('show');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    // 공통 헤더 렌더링
    window.renderSharedHeader = function() {
        var container = document.getElementById('shared-header');
        if (!container) {
            console.warn('[shared-header] #shared-header container not found');
            return;
        }
        container.innerHTML = buildHeaderHTML();
        setupMobileNav();
        // 헤더가 동적으로 렌더된 뒤 auth 컨테이너가 생기므로,
        // auth.js가 DOMContentLoaded 시점을 놓쳤더라도 다시 바인딩되게 한다.
        if (typeof window.initAuth === 'function') {
            try {
                window.initAuth();
            } catch (e) {
                console.error('[shared-header] initAuth after render failed:', e);
            }
        }
        console.log('[shared-header] Rendered for:', getCurrentPage(), '| context:', getContextType());
    };

    function bindSharedHeaderLangRefresh() {
        if (window.__lovebudSharedHeaderLangBound) return;
        window.__lovebudSharedHeaderLangBound = true;
        window.addEventListener('lovebud-lang-change', function() {
            if (typeof window.renderSharedHeader === 'function') {
                window.renderSharedHeader();
            }
        });
    }

    bindSharedHeaderLangRefresh();

    // DOM 준비 완료 시 자동 렌더링 (선택적)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // 자동 렌더링은 선택 - 나중에手動 호출 가능
        });
    }
})();
