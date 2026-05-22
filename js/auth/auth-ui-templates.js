(function() {
  function getBasePath() {
    var path = window.location.pathname;
    var isPagesContext = path.indexOf('/pages/') !== -1;
    return isPagesContext ? '' : 'pages/';
  }

  function escapeHtml(value) {
    // TODO: Consider dependency injection for escapeHtml in the future for a pure template module
    var sec = window.LoveBudSecurity;
    if (sec) return sec.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildLoginButton() {
    var basePath = getBasePath();
    var loginHref = basePath + 'login.html';
    return '<a href="' + loginHref + '" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>';
  }

  function getUserAvatarInitial(user) {
    var source = '';
    if (user) {
      source = String(user.displayName || user.email || '').trim();
    }
    if (!source) return 'L';
    var firstChar = source.charAt(0).toUpperCase();
    return /[A-Z0-9가-힣]/.test(firstChar) ? firstChar : 'L';
  }

  function buildUserDropdown(user) {
    var userName = '';
    var hasPhoto = !!(user && user.photoURL);

    if (user) {
      userName = user.displayName || user.email || '';
    }

    var safeUserName = escapeHtml(userName);
    var safePhotoUrl = hasPhoto ? escapeHtml(user.photoURL) : '';

    var isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;
    // TODO: settings not yet implemented
    var myTreesHref = isPagesContext ? 'my-trees.html' : 'pages/my-trees.html';

    var avatarInitial = getUserAvatarInitial(user);

    var avatarContent = hasPhoto
      ? '<img src="' + safePhotoUrl + '" alt="" class="user-avatar-image" referrerpolicy="no-referrer">'
      : '<span class="user-avatar-initial" aria-hidden="true">' + escapeHtml(avatarInitial) + '</span>';

    return [
      '<div class="user-dropdown" id="userDropdown">',
      '<button class="user-dropdown-trigger user-dropdown-trigger-icon" aria-label="내 계정 메뉴">',
      '<span class="user-avatar-shell">',
      avatarContent,
      '</span>',
      '</button>',
      '<div class="user-dropdown-menu">',
      safeUserName ? '<div class="user-dropdown-meta">' + safeUserName + '</div>' : '',
      '<a href="' + myTreesHref + '" class="user-dropdown-item"><span class="material-symbols-outlined">account_tree</span>내 러브트리</a>',
      '<button class="user-dropdown-item" disabled style="cursor:default;opacity:0.6;"><span class="material-symbols-outlined">settings</span>설정</button>',
      '<div class="dropdown-divider"></div>',
      '<button type="button" class="user-dropdown-item" data-auth-action="logout"><span class="material-symbols-outlined">logout</span>로그아웃</button>',
      '</div>',
      '</div>'
    ].join('');
  }

  window.LoveBudAuthUiTemplates = {
    getBasePath: getBasePath,
    escapeHtml: escapeHtml,
    buildLoginButton: buildLoginButton,
    getUserAvatarInitial: getUserAvatarInitial,
    buildUserDropdown: buildUserDropdown
  };
})();
