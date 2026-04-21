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
    setText('myTreesPageDesc', 'myTrees.page_desc', '내가 기록한 사랑의 순간들을 모아둔 공간입니다. 트리를 선택하여 기억을 추가하거나, 새로운 러브트리를 시작해보세요.');
    setText('headerCreateTreeBtnLabel', 'myTrees.header_create', '새 러브트리');
    setText('summaryTotalSuffix', 'myTrees.summary_total_suffix', '개의 트리');
    setText('summaryPublicLabel', 'myTrees.summary_public', '공개');
    setText('summaryPrivateLabel', 'myTrees.summary_private', '비공개');
    setText('sortRecentOption', 'myTrees.sort_recent', '최근 수정순');
    setText('sortOldestOption', 'myTrees.sort_oldest', '생성순');
    setText('sortNameOption', 'myTrees.sort_name', '이름순');

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
      var renameItem = dropdown.querySelector('.dropdown-item.rename');
      var deleteItem = dropdown.querySelector('.dropdown-item.delete');
      if (renameItem) {
        renameItem.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>' + tText('rename', '이름 변경');
      }
      if (deleteItem) {
        deleteItem.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>' + tText('delete', '삭제');
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
