/**
        var avatarHref = currentPage === 'settings.html'
            ? (getContextType() === 'root' ? 'pages/my-trees.html' : './my-trees.html')
            : (getContextType() === 'root' ? 'pages/settings.html' : './settings.html');
        var avatarLabel = currentPage === 'settings.html' ? '내 러브트리로 돌아가기' : '설정 열기';

        return [
            '<a href="' + avatarHref + '" title="' + avatarLabel + '" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;cursor:pointer;">',
                '<div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:500;">',
                    initial,
                '</div>',
                '<span style="font-size:14px;color:var(--on-surface);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + displayName + '</span>',
            '</a>'
        ].join('');
    }

    // 로그인 페이지인지 확인
    function isLoginPage() {
        return getCurrentPage() === 'login.html';
    }

    function getLoginRedirectHref(targetHref) {
        var loginHref = getContextType() === 'root' ? 'pages/login.html' : 'login.html';
        return loginHref + '?redirect=' + encodeURIComponent(targetHref);
    }

    function buildLangToggleHTML(isHidden) {
        var hiddenAttr = isHidden ? ' hidden' : '';
        var hiddenStyle = isHidden ? ' style="display:none !important;"' : '';
        return [
            '<div class="lang-toggle header-lang-toggle"' + hiddenAttr + hiddenStyle + '>',
                '<button type="button" class="btn-round btn-outline lang-menu-trigger" style="text-decoration:none;display:flex;align-items:center;gap:4px;padding:6px 12px;height:36px;font-size:14px;font-weight:500;">',
                    '<span class="material-symbols-outlined" style="font-size:18px;">language</span>',
                    '<span>언어</span>',
                '</button>',
                '<div class="lang-dropdown">',
                    '<button type="button" class="lang-option" data-lang="ko">한국어</button>',
                    '<button type="button" class="lang-option" data-lang="en">English</button>',
                '</div>',
            '</div>'
        ].join('');
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
        var isLoggedIn = !!cachedUser;
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
