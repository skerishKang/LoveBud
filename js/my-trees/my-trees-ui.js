/**
 * LoveBud - My Trees UI Helpers
 * v20260420-1
 *
 * Tree card rendering and summary UI utilities
 */

(function () {
  if (window.LoveBudMyTreesUI) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.tree-card-dropdown').forEach(function (dd) {
      dd.classList.remove('show');
    });
  }

  function buildMiniTreeSVG() {
    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
          '<linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#b85c66;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        '<path d="M 100 180 Q 98 140 100 110 Q 102 80 95 50" stroke="url(#trunkGrad)" stroke-width="6" fill="none" stroke-linecap="round"/>',
        '<path d="M 100 130 Q 70 120 55 95 Q 45 75 50 55" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 100 110 Q 130 100 145 80 Q 155 65 150 45" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 98 80 Q 75 70 65 50 Q 58 35 62 20" stroke="#c97b83" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>',
        '<circle cx="50" cy="55" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="150" cy="45" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="62" cy="20" r="8" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="95" cy="50" r="12" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<ellipse cx="100" cy="170" rx="30" ry="10" fill="none" stroke="#904951" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
  }

  function updateManageSummary(trees, options) {
    var summaryBar = document.getElementById('manageSummaryBar');
    if (!summaryBar || !trees || trees.length === 0) {
      if (summaryBar) summaryBar.style.display = 'none';
      return trees || [];
    }

    var total = trees.length;
    var publicCount = trees.filter(function (t) { return t.visibility === 'public'; }).length;
    var privateCount = total - publicCount;

    var totalEl = document.getElementById('totalTreesCount');
    var publicEl = document.getElementById('publicTreesCount');
    var privateEl = document.getElementById('privateTreesCount');

    if (totalEl) totalEl.textContent = total;
    if (publicEl) publicEl.textContent = publicCount;
    if (privateEl) privateEl.textContent = privateCount;

    summaryBar.style.display = 'flex';

    if (options && typeof options.setLastTreesData === 'function') {
      options.setLastTreesData(trees);
    }

    return trees;
  }

  function buildTreeCard(tree, options) {
    var i18n = (options && options.i18n) || window.t || function (k) { return k; };
    var normalizeTree = options && options.normalizeTree;
    var onRename = options && options.onRename;
    var onDelete = options && options.onDelete;
    var onNavigate = options && options.onNavigate;
    var closeDropdowns = (options && options.closeAllDropdowns) || closeAllDropdowns;

    var normalizedTree = typeof normalizeTree === 'function'
      ? normalizeTree(tree)
      : null;

    if (!normalizedTree) {
      normalizedTree = {
        id: tree && tree.id,
        title: (tree && tree.title) || '나의 러브트리',
        visibility: (tree && tree.visibility) || 'private',
        updatedAt: (tree && (tree.updatedAt || tree.createdAt)) || null
      };
    }

    var card = document.createElement('div');
    card.className = 'tree-card';
    card.style.cursor = 'pointer';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.tree-card-menu') || e.target.closest('.tree-card-dropdown')) {
        return;
      }
      if (typeof onNavigate === 'function') {
        onNavigate(normalizedTree);
      } else {
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
      }
    });

    var visClass = normalizedTree.visibility === 'public' ? 'public' : 'private';
    var visLabel = normalizedTree.visibility === 'public'
      ? i18n('visibility_public')
      : i18n('visibility_private');

    var title = normalizedTree.title;
    var date = normalizedTree.updatedAt || '';
    if (date) {
      date = date.slice(0, 10).replace(/-/g, '.');
    }

    var menuBtnId = 'menuBtn_' + normalizedTree.id;
    var dropdownId = 'dropdown_' + normalizedTree.id;

    card.innerHTML = [
      '<button class="tree-card-menu" id="' + menuBtnId + '" type="button">',
        '<span class="material-symbols-outlined" style="font-size:18px;color:#666;">more_vert</span>',
      '</button>',
      '<div class="tree-card-dropdown" id="' + dropdownId + '">',
        '<div class="dropdown-item rename" data-action="rename">',
          '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>',
          i18n('rename') || '이름 변경',
        '</div>',
        '<div class="dropdown-item delete" data-action="delete">',
          '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>',
          i18n('delete') || '삭제',
        '</div>',
      '</div>',
      '<div class="tree-card-thumb">' + buildMiniTreeSVG() + '</div>',
      '<div class="tree-card-info">',
        '<div class="tree-card-title">' + escapeHtml(title) + '</div>',
        '<div class="tree-card-meta">',
          '<span class="tree-card-visibility ' + visClass + '">',
            '<span class="material-symbols-outlined" style="font-size:12px;">' + (visClass === 'public' ? 'public' : 'lock') + '</span>',
            visLabel,
          '</span>',
          date ? '<span>' + date + '</span>' : '',
        '</div>',
      '</div>'
    ].join('');

    setTimeout(function () {
      var menuBtn = document.getElementById(menuBtnId);
      var dropdown = document.getElementById(dropdownId);

      if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          closeDropdowns();
          dropdown.classList.toggle('show');
        });

        dropdown.querySelectorAll('.dropdown-item').forEach(function (item) {
          item.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var action = this.getAttribute('data-action');
            if (action === 'rename' && typeof onRename === 'function') {
              onRename(normalizedTree.id, title);
            } else if (action === 'delete' && typeof onDelete === 'function') {
              onDelete(normalizedTree.id, title);
            }

            closeDropdowns();
          });
        });
      }
    }, 0);

    return card;
  }

  function renderTrees(trees, options) {
    var container = document.getElementById('state-loaded');
    if (!container) return;

    var setState = options && options.setState;
    var stateEnum = options && options.stateEnum;
    var buildTreeCardFn = (options && options.buildTreeCard) || buildTreeCard;
    var updateManageSummaryFn = (options && options.updateManageSummary) || updateManageSummary;

    updateManageSummaryFn(trees, options);

    if (!trees || trees.length === 0) {
      if (typeof setState === 'function' && stateEnum && stateEnum.EMPTY) {
        setState(stateEnum.EMPTY);
      }
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'trees-grid';

    trees.forEach(function (tree) {
      var card = buildTreeCardFn(tree, options);
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);

    if (typeof setState === 'function' && stateEnum && stateEnum.LOADED) {
      setState(stateEnum.LOADED);
    }
  }

  window.LoveBudMyTreesUI = {
    escapeHtml: escapeHtml,
    closeAllDropdowns: closeAllDropdowns,
    buildMiniTreeSVG: buildMiniTreeSVG,
    updateManageSummary: updateManageSummary,
    buildTreeCard: buildTreeCard,
    renderTrees: renderTrees
  };
})();
