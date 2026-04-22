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

  function applyMyTreesShellCopy() {
    document.title = tText('nav.myTrees', '내 러브트리') + ' | LoveTree';
    setText('myTreesPageTitle', 'myTrees.page_title', '🌳 내 러브트리');
    setText('myTreesPageDesc', 'myTrees.page_desc', '내가 남긴 순간들을 다시 감상하고, 다음 장면을 이어가는 곳입니다.');
    setText('headerCreateTreeBtnLabel', 'myTrees.header_create', '새 러브트리');
    setText('summaryTotalSuffix', 'myTrees.summary_total_suffix', '개의 트리');
    setText('summaryPublicLabel', 'myTrees.summary_public', '공개');
    setText('summaryPrivateLabel', 'myTrees.summary_private', '비공개');
    setText('summaryMomentsSuffix', 'myTrees.summary_moments_suffix', '개의 순간');
    setText('sortRecentOption', 'myTrees.sort_recent', '최근 수정순');
    setText('sortOldestOption', 'myTrees.sort_oldest', '생성순');
    setText('sortNameOption', 'myTrees.sort_name', '이름순');
    setText('manageSelectedTreeLabel', 'myTrees.manage_label', '지금 돌보는 트리');
    setText('manageSelectedTreeName', 'myTrees.manage_none', '카드에서 트리를 하나 골라 보세요');
    setText('manageSelectedTreeMeta', 'myTrees.manage_hint', '선택한 트리를 여기서 바로 이어가거나 다듬을 수 있어요.');
    setText('manageOpenBtn', 'myTrees.manage_open', '이어보기');
    setText('manageVisibilityBtn', 'myTrees.manage_visibility', '공개 범위');
    setText('manageRenameBtn', 'myTrees.manage_rename', '이름 다듬기');
    setText('manageDeleteBtn', 'myTrees.manage_delete', '삭제');

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

    document.querySelectorAll('.tree-card-dropdown').forEach(function(dropdown) {
      var card = dropdown.closest('.tree-card');
      var isPublic = !!card?.querySelector('.tree-card-visibility.public');
      var visibilityItem = dropdown.querySelector('.dropdown-item.visibility');
      var renameItem = dropdown.querySelector('.dropdown-item.rename');
      var deleteItem = dropdown.querySelector('.dropdown-item.delete');
      if (visibilityItem) {
        visibilityItem.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">' + (isPublic ? 'lock' : 'public') + '</span>' + (isPublic ? tText('visibility_make_private', '비공개로 전환') : tText('visibility_make_public', '공개로 전환'));
      }
      if (renameItem) {
        renameItem.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>' + tText('rename', '이름 변경');
      }
      if (deleteItem) {
        deleteItem.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>' + tText('delete', '삭제');
      }
    });

    document.querySelectorAll('.tree-card-count-pill, .tree-card-moment-badge').forEach(function(el) {
      var count = el.getAttribute('data-count');
      if (count !== null) {
        el.textContent = tText('myTrees.moment_count_compact', '순간 {count}개').replace('{count}', count);
      }
    });

    document.querySelectorAll('.tree-card-select-btn').forEach(function(el) {
      el.textContent = el.closest('.tree-card') && el.closest('.tree-card').classList.contains('is-selected')
        ? tText('myTrees.card_selected', '보고 있는 트리')
        : tText('myTrees.card_select', '고르기');
    });

    document.querySelectorAll('.tree-card-open-btn').forEach(function(el) {
      el.textContent = tText('myTrees.card_open', '트리 열기');
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
