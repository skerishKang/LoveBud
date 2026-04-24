/**
  if (!window[AUTH_READY_FLAG]) {
    return;
  }

  persistConfirmedAuthSession(user);
  
  // 상단 nav 언어 버튼 동적 표시/숨김 (로그인 상태에서 숨김)
  var isLoggedIn = !!user;
  updateHeaderLangToggleVisibility(isLoggedIn);

  if (user) {
    var html = buildUserDropdown(user);
    if (authNav) authNav.innerHTML = html;
    if (authContainer) authContainer.innerHTML = html;
  } else {
    var html = buildLoginButton();
    if (authNav) authNav.innerHTML = html;
    // authContainer stays empty on login page (has its own form)
  }
}

/**
 * 상단 nav 언어 버튼 표시/숨김 업데이트
 * @param {boolean} isLoggedIn - 로그인 여부
 */
function updateHeaderLangToggleVisibility(isLoggedIn) {
  var headerLangToggle = document.querySelector('.header-lang-toggle');
  if (!headerLangToggle) return;
  
  if (isLoggedIn) {
    headerLangToggle.hidden = true;
    headerLangToggle.style.setProperty('display', 'none', 'important');
  } else {
    headerLangToggle.hidden = false;
    headerLangToggle.style.removeProperty('display');
  }
}

// ── Dropdown (event delegation — attached once) ─────────────────────────────

/**
 * Attach a SINGLE delegated click listener to document for all dropdowns.
 * Called once on initAuth, never again.
 * Uses document-level delegation so survives innerHTML replacements.
 */
function attachDropdownListener() {
  if (__authUiModule) {
    __authUiModule.attachDropdownListener({
      isAttached: function () {
        return !!DROPDOWN_LISTENER_ATTACHED;
      },
      setAttached: function (attached) {
        DROPDOWN_LISTENER_ATTACHED = !!attached;
        if (__authStateModule) __authStateModule.setDropdownListenerAttached(!!attached);
      }
    });
    return;
  }
  if (DROPDOWN_LISTENER_ATTACHED) return;
  DROPDOWN_LISTENER_ATTACHED = true;
  if (__authStateModule) __authStateModule.setDropdownListenerAttached(true);

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.user-dropdown-trigger');
    if (trigger) {
      e.stopPropagation();
      var dropdown = trigger.closest('.user-dropdown');
      if (!dropdown) return;
      var menu = dropdown.querySelector('.user-dropdown-menu');
      if (!menu) return;
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        if (m !== menu) m.classList.remove('show');
      });
      menu.classList.toggle('show');
      return;
    }
    if (!e.target.closest('.user-dropdown')) {
      document.querySelectorAll('.user-dropdown-menu.show').forEach(function (m) {
        m.classList.remove('show');
