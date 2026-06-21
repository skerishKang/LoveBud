(function() {
  'use strict';

  function tText(key, fallback) {
    if (typeof window.t === 'function') {
      var translated = window.t(key);
      if (typeof translated === 'string' && translated.trim() && translated !== key) {
        return translated;
      }
    }
    return fallback;
  }

  function setText(id, key, fallback) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = tText(key, fallback);
  }

  function setTitleMarkup() {
    var el = document.getElementById('myTreesPageTitle');
    if (!el) return;
    var locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
    var isEnglish = String(locale).toLowerCase().startsWith('en');
    if (isEnglish) {
      el.innerHTML = '<span class="my-trees-title-line">Open and continue</span>' +
                     '<span class="my-trees-title-line my-trees-title-accent">Your LoveTrees</span>';
      return;
    }
    el.innerHTML = '<span class="my-trees-title-line">내가 키운</span>' +
                   '<span class="my-trees-title-line my-trees-title-accent">러브트리를</span>' +
                   '<span class="my-trees-title-line">다시 열어보세요</span>';
  }

  function setDescMarkup() {
    var el = document.getElementById('myTreesPageDesc');
    if (!el) return;

    var locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
    var isEnglish = String(locale).toLowerCase().startsWith('en');

    var firstLine = isEnglish
      ? 'Reopen the moments you saved,'
      : '기록해 둔 나의 순간,';
    var secondLine = isEnglish
      ? 'and gently revisit your favorite feelings.'
      : '소중한 마음의 결을 천천히 꺼내보세요.';

    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    el.appendChild(document.createTextNode(firstLine));

    var br = document.createElement('br');
    br.className = 'pc-only';
    el.appendChild(br);

    el.appendChild(document.createTextNode(secondLine));
  }

  function applyMyTreesShellCopy() {
    document.title = tText('nav.myTrees', '내 러브트리') + ' | LoveTree';
    setText('myTreesPageEyebrow', 'myTrees.page_eyebrow', '내가 키우는 러브트리');
    setTitleMarkup();
    setDescMarkup();
    setText('headerCreateTreeBtnLabel', 'myTrees.header_create', '새 러브트리');
    setText('summaryTotalSuffix', 'myTrees.summary_total_suffix', '개의 트리');
    setText('summaryPublicLabel', 'myTrees.summary_public', '공개');
    setText('summaryPrivateLabel', 'myTrees.summary_private', '비공개');
    setText('summaryMomentsSuffix', 'myTrees.summary_moments_suffix', '개의 순간');
    setText('sortRecentOption', 'myTrees.sort_recent', '최신순');
    setText('sortOldestOption', 'myTrees.sort_oldest', '생성순');
    setText('sortNameOption', 'myTrees.sort_name', '이름순');
    setText('manageSelectedTreeLabel', 'myTrees.manage_label', '지금 돌보는 트리');
    setText('manageSelectedTreeName', 'myTrees.manage_none', '카드에서 트리를 하나 골라 보세요');
    setText('manageSelectedTreeMeta', 'myTrees.manage_hint', '선택한 트리를 여기서 바로 이어가거나 다듬을 수 있어요.');
    setText('manageOpenBtn', 'myTrees.manage_open', '이어보기');
    setText('manageVisibilityBtn', 'myTrees.manage_visibility', '공개 범위');
    setText('manageRenameBtn', 'myTrees.manage_rename', '이름 다듬기');
    setText('manageDeleteBtn', 'myTrees.manage_delete', '삭제');

    setText('myTreesHubTitle', 'myTrees.hub_title', '감상 허브');
    setText('myTreesHubBadge', 'myTrees.hub_badge', '선택한 내 트리');
    setText('myTreesHubOpenBtn', 'myTrees.hub_open', '감상 열기');
    setText('myTreesHubEditBtn', 'myTrees.hub_edit', '편집하기');
    setText('myTreesHubShareBtn', 'myTrees.hub_share', '감상 링크 복사');
    setText('myTreesHubMetaViewsLabel', 'myTrees.hub_meta_views_label', '조회수');
    setText('myTreesHubMetaLikesLabel', 'myTrees.hub_meta_likes_label', '좋아요');
    setText('myTreesHubMetaCommentsLabel', 'myTrees.hub_meta_comments_label', '댓글');
    setText('myTreesHubMetaSharesLabel', 'myTrees.hub_meta_shares_label', '공유');
    var retryBtn = document.getElementById('retryLoadBtn');
    if (retryBtn) retryBtn.textContent = tText('myTrees.retry', '다시 시도');

    var createTreeBtn = document.getElementById('createTreeBtn');
    if (createTreeBtn && !createTreeBtn.disabled) {
      var btnLabel = createTreeBtn.querySelector('[data-i18n="create_tree_btn"]') || createTreeBtn.querySelector('span:last-child');
      if (btnLabel) btnLabel.textContent = tText('create_tree_btn', '새 러브트리 만들기');
    }
  }

  function applyRenderedTreeCardCopy() {
    document.querySelectorAll('.tree-card-visibility').forEach(function(el) {
      if (el.classList.contains('public')) {
        var icon = el.querySelector('.material-symbols-outlined');
        el.innerHTML = (icon ? icon.outerHTML : '<span class="material-symbols-outlined" style="font-size:12px;">public</span>') + tText('myTrees.summary_public', '공개');
      } else if (el.classList.contains('private')) {
        var iconPrivate = el.querySelector('.material-symbols-outlined');
        el.innerHTML = (iconPrivate ? iconPrivate.outerHTML : '<span class="material-symbols-outlined" style="font-size:12px;">lock</span>') + tText('myTrees.summary_private', '비공개');
      }
    });

    document.querySelectorAll('.tree-card-count-pill, .tree-card-moment-badge').forEach(function(el) {
      var count = el.getAttribute('data-count');
      if (count !== null) {
        el.textContent = tText('myTrees.moment_count_compact', '순간 {count}개').replace('{count}', count);
      }
    });

  }

  function refreshMyTreesLanguage() {
    if (typeof window.applyI18n === 'function') {
      window.applyI18n();
    }
    applyMyTreesShellCopy();
    applyRenderedTreeCardCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshMyTreesLanguage, { once: true });
  } else {
    refreshMyTreesLanguage();
  }

  if (!window.__lovebudMyTreesLangRefreshBound) {
    window.__lovebudMyTreesLangRefreshBound = true;
    window.addEventListener('lovebud-lang-change', function() {
      refreshMyTreesLanguage();
    });
  }
})();
