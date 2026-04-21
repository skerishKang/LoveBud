/**
 * LoveBud auth UI module
 * Pure UI builders and auth-nav rendering helpers.
 */
(function () {
  if (window.LoveBudAuthUI) return;

  function markAuthLoading() {
    var authNav = document.getElementById("auth-nav");
    var authContainer = document.getElementById("auth-nav-container");
    var loadingStyle =
      "pointer-events:none;opacity:0.6;transition:opacity 0.2s ease;min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:none;";
    if (authNav) authNav.style.cssText = loadingStyle;
    if (authContainer) authContainer.style.cssText = loadingStyle;
  }

  function markAuthReady(authReadyFlagKey) {
    if (authReadyFlagKey) window[authReadyFlagKey] = true;

    var authNav = document.getElementById("auth-nav");
    var authContainer = document.getElementById("auth-nav-container");
    var visibleStyle =
      "pointer-events:auto;opacity:1;transition:opacity 0.2s ease;min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;user-select:auto;";

    if (authNav) {
      var navSpinner = authNav.querySelector(".material-symbols-outlined");
      if (navSpinner && navSpinner.textContent === "progress_activity") {
        navSpinner.remove();
      }
      authNav.style.cssText = visibleStyle;
      authNav.classList.add("auth-ready");
    }
    if (authContainer) {
      var containerSpinner = authContainer.querySelector(
        ".material-symbols-outlined"
      );
      if (containerSpinner && containerSpinner.textContent === "progress_activity") {
        containerSpinner.remove();
      }
      authContainer.style.cssText = visibleStyle;
      authContainer.classList.add("auth-ready");
    }
  }

  function getBasePath() {
    var path = window.location.pathname;
    var isPagesContext = path.indexOf("/pages/") !== -1;
    return isPagesContext ? "" : "pages/";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getLangLabel(lang) {
    return lang === 'en' ? 'English' : '한국어';
  }

  function buildLangInlineOptions(currentLang) {
    return [
      '<div class="user-dropdown-meta" style="border-bottom:none;padding-bottom:6px;">언어 / Language</div>',
      '<button type="button" class="user-dropdown-item lang-option' + (currentLang === 'ko' ? ' active' : '') + '" data-lang="ko">',
      '<span class="material-symbols-outlined">check</span>한국어',
      '</button>',
      '<button type="button" class="user-dropdown-item lang-option' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en">',
      '<span class="material-symbols-outlined">check</span>English',
      '</button>'
    ].join('');
  }

  function buildLoginButton() {
    var basePath = getBasePath();
    var loginHref = basePath + "login.html";
    var currentLang = typeof window.getCurrentLang === 'function' ? window.getCurrentLang() : 'ko';
    return [
      '<div style="display:flex;align-items:center;gap:10px;">',
      '<div class="lang-toggle">',
      '<button type="button" class="btn-round btn-outline lang-menu-trigger" style="text-decoration:none;padding:8px 14px;font-size:13px;font-weight:600;">언어 / Language</button>',
      '<div class="lang-dropdown" style="min-width:132px;">',
      '<button type="button" class="lang-option' + (currentLang === 'ko' ? ' active' : '') + '" data-lang="ko">한국어</button>',
      '<button type="button" class="lang-option' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en">English</button>',
      '</div>',
      '</div>',
      '<a href="' + loginHref + '" class="btn-round btn-outline" style="text-decoration:none;padding:8px 20px;font-size:14px;">로그인</a>',
      '</div>'
    ].join('');
  }

  function getUserAvatarInitial(user) {
    var source = "";
    if (user) source = String(user.displayName || user.email || "").trim();
    if (!source) return "L";

    var firstChar = source.charAt(0).toUpperCase();
    return /[A-Z0-9가-힣]/.test(firstChar) ? firstChar : "L";
  }

  function buildUserDropdown(user) {
    var userName = "";
    var hasPhoto = !!(user && user.photoURL);
    if (user) userName = user.displayName || user.email || "";

    var safeUserName = escapeHtml(userName);
    var safePhotoUrl = hasPhoto ? escapeHtml(user.photoURL) : "";
    var isPagesContext = window.location.pathname.indexOf("/pages/") !== -1;
    var myTreesHref = isPagesContext ? "my-trees.html" : "pages/my-trees.html";
    var settingsHref = isPagesContext ? "settings.html" : "pages/settings.html";
    var avatarInitial = getUserAvatarInitial(user);
    var currentLang = typeof window.getCurrentLang === 'function' ? window.getCurrentLang() : 'ko';

    var avatarContent = hasPhoto
      ? '<img src="' +
        safePhotoUrl +
        '" alt="" class="user-avatar-image" referrerpolicy="no-referrer">'
      : '<span class="user-avatar-initial" aria-hidden="true">' +
        escapeHtml(avatarInitial) +
        "</span>";

    return [
      '<div class="user-dropdown" id="userDropdown">',
      '<button class="user-dropdown-trigger user-dropdown-trigger-icon" aria-label="내 계정 메뉴">',
      '<span class="user-avatar-shell">',
      avatarContent,
      "</span>",
      "</button>",
      '<div class="user-dropdown-menu">',
      safeUserName
        ? '<div class="user-dropdown-meta">' + safeUserName + "</div>"
        : "",
      '<a href="' +
        myTreesHref +
        '" class="user-dropdown-item"><span class="material-symbols-outlined">account_tree</span>내 러브트리</a>',
      '<a href="' +
        settingsHref +
        '" class="user-dropdown-item"><span class="material-symbols-outlined">settings</span>설정</a>',
      '<div class="dropdown-divider"></div>',
      buildLangInlineOptions(currentLang),
      '<div class="dropdown-divider"></div>',
      '<button class="user-dropdown-item" onclick="signOut()"><span class="material-symbols-outlined">logout</span>로그아웃</button>',
      "</div>",
      "</div>",
    ].join("");
  }

  function updateNavUI(options) {
    var user = options && options.user;
    var authReadyFlagKey = options && options.authReadyFlagKey;
    var persistConfirmedAuthSession =
      options && options.persistConfirmedAuthSession;
    var buildUserDropdownFn = options && options.buildUserDropdown;
    var buildLoginButtonFn = options && options.buildLoginButton;

    var authNav = document.getElementById("auth-nav");
    var authContainer = document.getElementById("auth-nav-container");
    if (authReadyFlagKey && !window[authReadyFlagKey]) return;

    if (typeof persistConfirmedAuthSession === "function") {
      persistConfirmedAuthSession(user);
    }

    if (user) {
      var userHtml = (
        typeof buildUserDropdownFn === "function"
          ? buildUserDropdownFn
          : buildUserDropdown
      )(user);
      if (authNav) authNav.innerHTML = userHtml;
      if (authContainer) authContainer.innerHTML = userHtml;
    } else {
      var loginHtml = (
        typeof buildLoginButtonFn === "function"
          ? buildLoginButtonFn
          : buildLoginButton
      )();
      if (authNav) authNav.innerHTML = loginHtml;
    }
  }

  function attachDropdownListener(options) {
    var isAttached = options && options.isAttached;
    var setAttached = options && options.setAttached;

    if (typeof isAttached === "function" && isAttached()) return;
    if (typeof setAttached === "function") setAttached(true);

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest(".user-dropdown-trigger");
      if (trigger) {
        e.stopPropagation();
        var dropdown = trigger.closest(".user-dropdown");
        if (!dropdown) return;
        var menu = dropdown.querySelector(".user-dropdown-menu");
        if (!menu) return;
        document.querySelectorAll(".user-dropdown-menu.show").forEach(function (m) {
          if (m !== menu) m.classList.remove("show");
        });
        document.querySelectorAll(".lang-dropdown.show").forEach(function (m) {
          m.classList.remove("show");
        });
        menu.classList.toggle("show");
        return;
      }

      var langTrigger = e.target.closest('.lang-menu-trigger');
      if (langTrigger) {
        e.stopPropagation();
        var langDropdown = langTrigger.parentElement && langTrigger.parentElement.querySelector('.lang-dropdown');
        if (!langDropdown) return;
        document.querySelectorAll('.lang-dropdown.show').forEach(function (m) {
          if (m !== langDropdown) m.classList.remove('show');
        });
        langDropdown.classList.toggle('show');
        return;
      }

      var langOption = e.target.closest('.lang-option[data-lang]');
      if (langOption) {
        e.stopPropagation();
        var lang = langOption.getAttribute('data-lang');
        if (lang === 'ko' || lang === 'en') {
          if (typeof window.setCurrentLang === 'function') {
            window.setCurrentLang(lang);
          }
          if (typeof window.applyI18n === 'function') {
            window.applyI18n();
          }
          if (typeof window.triggerLangChange === 'function') {
            window.triggerLangChange(lang);
          }
          document.querySelectorAll('.lang-option[data-lang]').forEach(function (node) {
            node.classList.toggle('active', node.getAttribute('data-lang') === lang);
          });
        }
        document.querySelectorAll('.lang-dropdown.show').forEach(function (m) {
          m.classList.remove('show');
        });
        return;
      }

      if (!e.target.closest(".user-dropdown")) {
        document.querySelectorAll(".user-dropdown-menu.show").forEach(function (m) {
          m.classList.remove("show");
        });
      }
      if (!e.target.closest('.lang-toggle')) {
        document.querySelectorAll('.lang-dropdown.show').forEach(function (m) {
          m.classList.remove('show');
        });
      }
    });
  }

  window.LoveBudAuthUI = {
    markAuthLoading: markAuthLoading,
    markAuthReady: markAuthReady,
    getBasePath: getBasePath,
    escapeHtml: escapeHtml,
    buildLoginButton: buildLoginButton,
    getUserAvatarInitial: getUserAvatarInitial,
    buildUserDropdown: buildUserDropdown,
    updateNavUI: updateNavUI,
    attachDropdownListener: attachDropdownListener,
    getLangLabel: getLangLabel,
  };
})();
