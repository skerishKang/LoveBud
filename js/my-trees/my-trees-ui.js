/**
 * LoveBud - My Trees UI Helpers
 * v20260421-2
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

  function hashSeed(value) {
    var source = String(value || 'lovetree');
    var hash = 0;
    for (var i = 0; i < source.length; i++) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getTreeMomentCount(tree) {
    if (!tree) return 0;
    var count = tree.memoryCount || tree.memory_count || 0;
    count = Number(count);
    return Number.isFinite(count) ? count : 0;
  }

  function getTreeMoodPalette(tree) {
    var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
    var palettes = [
      {
        background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
        leaf: '#d8839a',
        leafSoft: 'rgba(216, 131, 154, 0.18)',
        accent: '#904951'
      },
      {
        background: 'linear-gradient(135deg, #fdf6ea 0%, #f7ebd7 46%, #f5f0f7 100%)',
        leaf: '#c79d68',
        leafSoft: 'rgba(199, 157, 104, 0.18)',
        accent: '#9d6b4d'
      },
      {
        background: 'linear-gradient(135deg, #f2f6ef 0%, #e4efe1 48%, #f8efe8 100%)',
        leaf: '#7a8b6e',
        leafSoft: 'rgba(122, 139, 110, 0.18)',
        accent: '#5d6f52'
      },
      {
        background: 'linear-gradient(135deg, #f6f0fb 0%, #ece4f7 42%, #fdf2f3 100%)',
        leaf: '#9f7ec2',
        leafSoft: 'rgba(159, 126, 194, 0.18)',
        accent: '#7d5ba6'
      }
    ];

    return palettes[seed % palettes.length];
  }

  function buildMiniTreeSVG(tree) {
    var palette = getTreeMoodPalette(tree);
    var momentCount = Math.max(0, Math.min(6, getTreeMomentCount(tree)));
    var leafDots = [];
    var positions = [
      { x: 58, y: 58, r: 10 },
      { x: 150, y: 50, r: 10 },
      { x: 72, y: 26, r: 8 },
      { x: 102, y: 58, r: 11 },
      { x: 132, y: 88, r: 8 },
      { x: 84, y: 104, r: 7 }
    ];

    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var isFilled = i < momentCount;
      leafDots.push(
        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pos.r + '" fill="' + (isFilled ? palette.leafSoft : 'rgba(255,255,255,0.82)') + '" stroke="' + palette.leaf + '" stroke-width="1.5"/>'
      );
    }

    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
        '<defs>',
          '<linearGradient id="trunkGrad-' + hashSeed((tree && tree.id) || 'trunk') + '" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#b85c66;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        '<path d="M 100 182 Q 98 142 100 112 Q 102 82 95 52" stroke="url(#trunkGrad-' + hashSeed((tree && tree.id) || 'trunk') + ')" stroke-width="6" fill="none" stroke-linecap="round"/>',
        '<path d="M 100 132 Q 72 122 56 98 Q 46 80 52 58" stroke="' + palette.leaf + '" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.78"/>',
        '<path d="M 100 112 Q 128 102 145 84 Q 157 70 152 50" stroke="' + palette.leaf + '" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.78"/>',
        '<path d="M 98 82 Q 78 72 68 52 Q 60 38 66 24" stroke="' + palette.leaf + '" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.7"/>',
        leafDots.join(''),
        '<ellipse cx="100" cy="172" rx="34" ry="11" fill="none" stroke="' + palette.accent + '" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
  }

  function buildTreeThumbVisual(tree, i18n) {
    var palette = getTreeMoodPalette(tree);
    var momentCount = getTreeMomentCount(tree);
    var title = (tree && tree.title) || (i18n('default_tree_title') || '나의 러브트리');
    var initial = escapeHtml(title.charAt(0).toUpperCase());
    var moodLabel = momentCount > 1
      ? (i18n('myTrees.card_growing') || '차곡차곡 자라는 중')
      : (i18n('myTrees.card_waiting') || '첫 순간을 기다리는 중');

    return [
      '<div class="tree-card-thumb" style="background:' + palette.background + ';">',
        '<div class="tree-card-thumb-glow" style="background:' + palette.leafSoft + ';"></div>',
        '<div class="tree-card-thumb-initial" style="color:' + palette.accent + ';border-color:' + palette.leafSoft + ';">' + initial + '</div>',
        '<div class="tree-card-thumb-art">' + buildMiniTreeSVG(tree) + '</div>',
        '<div class="tree-card-thumb-topline">',
          '<span class="tree-card-moment-badge" data-count="' + momentCount + '">' + (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) + '</span>',
        '</div>',
        '<div class="tree-card-thumb-caption">' + moodLabel + '</div>',
      '</div>'
    ].join('');
  }

  function updateManageSummary(trees, options) {
    var summaryBar = document.getElementById('manageSummaryBar');
    if (!summaryBar || !trees || trees.length === 0) {
      if (summaryBar) summaryBar.style.display = 'none';
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

    [openBtn, renameBtn, deleteBtn].forEach(function(btn) {
      if (btn) btn.disabled = !selectedTree;
    });

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
    var onSelect = options && options.onSelect;
    var isSelected = options && options.isSelected;
    var closeDropdowns = (options && options.closeAllDropdowns) || closeAllDropdowns;

    var normalizedTree = typeof normalizeTree === 'function'
      ? normalizeTree(tree)
      : null;

    if (!normalizedTree) {
      normalizedTree = {
        id: tree && tree.id,
        title: (tree && tree.title) || '나의 러브트리',
        visibility: (tree && tree.visibility) || 'public',
        updatedAt: (tree && (tree.updatedAt || tree.createdAt)) || null,
        memoryCount: getTreeMomentCount(tree)
      };
    }

    var momentCount = getTreeMomentCount(normalizedTree);
    var visClass = normalizedTree.visibility === 'public' ? 'public' : 'private';
    var visLabel = normalizedTree.visibility === 'public'
      ? (i18n('myTrees.summary_public') || '공개')
      : (i18n('myTrees.summary_private') || '비공개');
    var title = normalizedTree.title;
    var date = normalizedTree.updatedAt || normalizedTree.createdAt || '';
    var metaMood = momentCount > 0
      ? (i18n('myTrees.card_growing') || '차곡차곡 자라는 중')
      : (i18n('myTrees.card_waiting') || '첫 순간을 기다리는 중');

    if (date) {
      date = date.slice(0, 10).replace(/-/g, '.');
    }

    var menuBtnId = 'menuBtn_' + normalizedTree.id;
    var dropdownId = 'dropdown_' + normalizedTree.id;
    var selectedClass = typeof isSelected === 'function' && isSelected(normalizedTree.id) ? ' is-selected' : '';

    var card = document.createElement('div');
    card.className = 'tree-card' + selectedClass;
    card.style.cursor = 'pointer';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.tree-card-menu') || e.target.closest('.tree-card-dropdown') || e.target.closest('.tree-card-manage-btn')) {
        return;
      }
      if (typeof onNavigate === 'function') {
        onNavigate(normalizedTree);
      } else {
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
      }
    });

    card.innerHTML = [
      '<button class="tree-card-menu" id="' + menuBtnId + '" type="button" aria-label="' + escapeHtml(i18n('myTrees.card_menu') || '트리 관리 열기') + '">',
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
      buildTreeThumbVisual(normalizedTree, i18n),
      '<div class="tree-card-info">',
        '<div class="tree-card-title-row">',
          '<div class="tree-card-title">' + escapeHtml(title) + '</div>',
          '<span class="tree-card-count-pill" data-count="' + momentCount + '">' + (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) + '</span>',
        '</div>',
        '<div class="tree-card-subcopy">' + metaMood + '</div>',
        '<div class="tree-card-meta">',
          '<span class="tree-card-visibility ' + visClass + '">',
            '<span class="material-symbols-outlined" style="font-size:12px;">' + (visClass === 'public' ? 'public' : 'lock') + '</span>',
            visLabel,
          '</span>',
          date ? '<span class="tree-card-date">' + date + '</span>' : '',
        '</div>',
        '<div class="tree-card-manage-row">',
          '<button type="button" class="tree-card-manage-btn tree-card-select-btn">' + (selectedClass ? (i18n('myTrees.card_selected') || '선택됨') : (i18n('myTrees.card_select') || '선택')) + '</button>',
          '<button type="button" class="tree-card-manage-btn tree-card-open-btn">' + (i18n('myTrees.card_open') || '열어보기') + '</button>',
        '</div>',
      '</div>'
    ].join('');

    setTimeout(function () {
      var menuBtn = document.getElementById(menuBtnId);
      var dropdown = document.getElementById(dropdownId);
      var selectBtn = card.querySelector('.tree-card-select-btn');
      var openBtn = card.querySelector('.tree-card-open-btn');

      if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof onSelect === 'function') {
            onSelect(normalizedTree.id);
          }
          closeDropdowns();
          dropdown.classList.toggle('show');
        });

        dropdown.querySelectorAll('.dropdown-item').forEach(function (item) {
          item.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (typeof onSelect === 'function') {
              onSelect(normalizedTree.id);
            }

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

      if (selectBtn) {
        selectBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof onSelect === 'function') {
            onSelect(normalizedTree.id);
          }
        });
      }

      if (openBtn) {
        openBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof onNavigate === 'function') {
            onNavigate(normalizedTree);
          }
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
    getTreeMomentCount: getTreeMomentCount,
    buildTreeThumbVisual: buildTreeThumbVisual,
    updateManageSummary: updateManageSummary,
    buildTreeCard: buildTreeCard,
    renderTrees: renderTrees
  };
})();
