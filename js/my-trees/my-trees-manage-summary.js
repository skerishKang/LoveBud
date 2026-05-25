/**
 * LoveBud My Trees Manage Summary
 * v1
 *
 * Manage summary bar DOM updates for my-trees page.
 * Extracted from my-trees-ui.js for #1501 modularization.
 *
 * Dependencies: LoveBudMyTreesUtils (optional), LoveBudMyTreesCardVisuals (optional)
 */

(function () {
  if (window.LoveBudMyTreesManageSummary) return;

  function getTreeMomentCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeMomentCount === 'function') return Utils.getTreeMomentCount(tree);
    return tree ? Number(tree.memoryCount ?? tree.memory_count ?? tree.nodeCount ?? tree.node_count ?? 0) : 0;
  }

  function getVisibilityActionLabel(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getVisibilityActionLabel === 'function') return Visuals.getVisibilityActionLabel(tree, i18n);
    return tree && tree.visibility === 'public' ? (i18n('visibility_make_private') || '비공개로 전환') : (i18n('visibility_make_public') || '공개로 전환');
  }

  function updateManageSummary(trees, options) {
    var summaryBar = document.getElementById('manageSummaryBar');
    if (!summaryBar || !trees || trees.length === 0) {
      if (summaryBar) {
        summaryBar.classList.remove('manage-summary-visible');
        summaryBar.classList.add('manage-summary-hidden');
      }
      return trees || [];
    }

    var i18n = (options && options.i18n) || window.t || function(k) { return k; };
    var selectedTreeId = options && options.getSelectedTreeId ? options.getSelectedTreeId() : null;
    var selectedTree = selectedTreeId
      ? trees.find(function(t) { return t && t.id === selectedTreeId; })
      : null;
    var total = trees.length;
    var publicCount = trees.filter(function (t) { return t.visibility === 'public'; }).length;
    var privateCount = total - publicCount;
    var totalMoments = trees.reduce(function(sum, tree) {
      return sum + getTreeMomentCount(tree);
    }, 0);

    var totalEl = document.getElementById('totalTreesCount');
    var publicEl = document.getElementById('publicTreesCount');
    var privateEl = document.getElementById('privateTreesCount');
    var momentEl = document.getElementById('totalMomentsCount');
    var selectedTitleEl = document.getElementById('manageSelectedTreeName');
    var selectedMetaEl = document.getElementById('manageSelectedTreeMeta');
    var openBtn = document.getElementById('manageOpenBtn');
    var renameBtn = document.getElementById('manageRenameBtn');
    var deleteBtn = document.getElementById('manageDeleteBtn');
    var visibilityBtn = document.getElementById('manageVisibilityBtn');

    if (totalEl) totalEl.textContent = total;
    if (publicEl) publicEl.textContent = publicCount;
    if (privateEl) privateEl.textContent = privateCount;
    if (momentEl) momentEl.textContent = totalMoments;

    if (selectedTitleEl) {
      selectedTitleEl.textContent = selectedTree
        ? selectedTree.title
        : (i18n('myTrees.manage_none') || '카드에서 트리를 하나 골라 관리해보세요');
    }

    if (selectedMetaEl) {
      if (selectedTree) {
        var momentCount = getTreeMomentCount(selectedTree);
        var visibilityKey = selectedTree.visibility === 'public' ? 'myTrees.summary_public' : 'myTrees.summary_private';
        selectedMetaEl.textContent =
          (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) +
          ' · ' +
          (i18n(visibilityKey) || (selectedTree.visibility === 'public' ? '공개' : '비공개'));
      } else {
        selectedMetaEl.textContent = i18n('myTrees.manage_hint') || '카드 아래 선택 버튼으로 빠르게 이름 변경과 삭제를 할 수 있어요.';
      }
    }

    [openBtn, renameBtn, deleteBtn, visibilityBtn].forEach(function(btn) {
      if (btn) btn.disabled = !selectedTree;
    });

    if (visibilityBtn) {
      visibilityBtn.textContent = selectedTree
        ? getVisibilityActionLabel(selectedTree, i18n)
        : (i18n('myTrees.manage_visibility') || '공개 설정');
    }

    if (openBtn) {
      openBtn.onclick = function() {
        if (!selectedTree) return;
        if (typeof options?.onNavigate === 'function') {
          options.onNavigate(selectedTree);
        }
      };
    }

    if (renameBtn) {
      renameBtn.onclick = function() {
        if (!selectedTree || typeof options?.onRename !== 'function') return;
        options.onRename(selectedTree.id, selectedTree.title);
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = function() {
        if (!selectedTree || typeof options?.onDelete !== 'function') return;
        options.onDelete(selectedTree.id, selectedTree.title);
      };
    }

    if (visibilityBtn) {
      visibilityBtn.onclick = function() {
        if (!selectedTree || typeof options?.onToggleVisibility !== 'function') return;
        options.onToggleVisibility(selectedTree.id, selectedTree.visibility);
      };
    }

    summaryBar.classList.remove('manage-summary-hidden');
    summaryBar.classList.add('manage-summary-visible');

    if (options && typeof options.setLastTreesData === 'function') {
      options.setLastTreesData(trees);
    }

    return trees;
  }

  window.LoveBudMyTreesManageSummary = {
    updateManageSummary: updateManageSummary,
    getTreeMomentCount: getTreeMomentCount,
    getVisibilityActionLabel: getVisibilityActionLabel
  };
})();
