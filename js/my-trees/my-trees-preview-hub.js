/**
 * LoveBud - My Trees Appreciation Hub
 * v20260514-1
 *
 * Selected-tree appreciation hub for My Trees page.
 * Adapted from Browse's preview hub (search-preview-renderer.js) grammar.
 *
 * Responsibilities:
 * - Show a compact appreciation panel when a tree card is selected
 * - Display: tree title, moment count, representative info, flow preview
 * - "트리 열기" primary action → opens Editor
 * - No management controls (rename, delete, visibility)
 */

(function () {
    'use strict';

    /* ── Constants ── */

    var VISIBLE_FLOW_MOMENT_COUNT = 4;

    /* ── Escape HTML ── */

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ── i18n helpers ── */

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            var val = window.t(key);
            if (typeof val === 'string' && val.trim() && val !== key) {
                return val;
            }
        }
        return fallback || key;
    }

    function getLocale() {
        var locale = window.i18n && window.i18n.currentLang;
        if (locale) return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
        var htmlLang = document.documentElement && document.documentElement.lang;
        if (htmlLang) return String(htmlLang).toLowerCase().startsWith('en') ? 'en' : 'ko';
        return 'ko';
    }

    function i18nHub(key, fallbackKo, fallbackEn) {
        if (key && typeof window.t === 'function') {
            var val = window.t(key);
            if (typeof val === 'string' && val.trim() && val !== key) {
                return val;
            }
        }
        return getLocale() === 'en' ? fallbackEn : fallbackKo;
    }

    /* ── Private state ── */

    var _selectedTree = null;
    var _expandedFlowKey = null;
    var _stateModule = null;
    var _onOpenTree = null;
    var _treeGridContainer = null;

    /* ── Exposed setter for tree grid container ── */

    function setTreeGridContainer(selectorOrEl) {
        if (typeof selectorOrEl === 'string') {
            _treeGridContainer = document.querySelector(selectorOrEl);
        } else {
            _treeGridContainer = selectorOrEl;
        }
    }

    /* ── Get hub panel elements ── */

    function getEls() {
        var panel = document.getElementById('myTreesHubPanel');
        if (!panel) return null;

        return {
            panel: panel,
            header: document.getElementById('myTreesHubHeader'),
            badge: document.getElementById('myTreesHubBadge'),
            placeholder: document.getElementById('myTreesHubPlaceholder'),
            content: document.getElementById('myTreesHubContent'),
            treeTitle: document.getElementById('myTreesHubTreeTitle'),
            metaBadge: document.getElementById('myTreesHubMetaBadge'),
            flowSection: document.getElementById('myTreesHubFlow'),
            flowLabel: document.getElementById('myTreesHubFlowLabel'),
            flowList: document.getElementById('myTreesHubFlowList'),
            flowControls: document.getElementById('myTreesHubFlowControls'),
            summary: document.getElementById('myTreesHubSummary'),
            actions: document.getElementById('myTreesHubActions'),
            openBtn: document.getElementById('myTreesHubOpenBtn'),
            editBtn: document.getElementById('myTreesHubEditBtn'),
            noMoments: document.getElementById('myTreesHubNoMoments')
        };
    }

    /* ── Get tree key for flow expansion tracking ── */

    function getTreeKey(tree) {
        if (!tree) return '';
        if (tree.id != null && tree.id !== '') {
            return String(tree.id);
        }
        var title = String(tree.title || '').trim();
        var memoryCount = Array.isArray(tree.memories) ? tree.memories.length : Number(tree.memoryCount || 0);
        return title + ':' + memoryCount;
    }

    /* ── Get moment count ── */

    function getTreeMomentCount(tree) {
        if (!tree) return 0;
        var count = tree.memoryCount ||
            tree.memory_count ||
            tree.nodeCount ||
            tree.node_count ||
            (Array.isArray(tree.memories) ? tree.memories.length : undefined) ||
            (Array.isArray(tree.nodes) ? tree.nodes.length : undefined) ||
            0;
        count = Number(count);
        return Number.isFinite(count) ? count : 0;
    }



    /* ── Get moment label ── */

    function getMomentLabel(memory, fallbackKo, fallbackEn) {
        if (!memory) return i18nHub('', fallbackKo, fallbackEn);
        var title = String(memory.title || '').trim();
        if (title) {
            // Clean title like Browse does
            var cleaned = title.replace(/\s*-\s*.*$/, '').trim();
            if (cleaned) return cleaned;
        }
        return i18nHub('', fallbackKo, fallbackEn);
    }

    /* ── Build flow stages HTML ── */
    // Renders each moment stage as a compact, scannable card with a
    // numeric index (1-based) on the left and the moment label on the
    // right. Matches Browse's .preview-flow-stage rhythm (no emoji icon).

    function buildFlowStages(memories, startIndex) {
        if (!Array.isArray(memories) || memories.length === 0) return '';
        var offset = typeof startIndex === 'number' && startIndex > 0 ? startIndex : 0;
        var html = '';
        for (var i = 0; i < memories.length; i++) {
            var mem = memories[i];
            var label = getMomentLabel(mem, '시작 순간', 'Starting moment');
            var stageIndex = offset + i + 1;
            html += '<div class="my-trees-hub-flow-stage" title="' + escapeHtml(label) + '">' +
                '<span class="my-trees-hub-flow-stage-index">' + stageIndex + '</span>' +
                '<span class="my-trees-hub-flow-stage-label">' + escapeHtml(label) + '</span>' +
                '</div>';
        }
        return html;
    }

    /* ── Build flow toggle button ── */

    function buildFlowToggle(hiddenCount, isExpanded) {
        if (hiddenCount <= 0) return '';
        return '<button type="button" class="my-trees-hub-flow-toggle" data-my-trees-flow-toggle>' +
            (isExpanded
                ? i18nHub('', '간략히 보기', 'Show less')
                : i18nHub('', '더보기 (' + hiddenCount + ')', 'Show more (' + hiddenCount + ')')) +
            '</button>';
    }

    function showPlaceholder() {
        var els = getEls();
        if (!els) return;
        els.panel.classList.add('is-empty');
        els.panel.classList.remove('is-loaded');
        els.panel.classList.add('preview-state-empty');
        els.panel.classList.remove('preview-state-thumbnail', 'preview-state-media', 'preview-state-no-moments');
        if (els.placeholder) els.placeholder.hidden = false;
        if (els.content) els.content.hidden = true;
        if (els.badge) els.badge.textContent = i18nHub('myTrees.hub_badge', '선택한 내 트리', 'Selected tree');
        _selectedTree = null;
        _expandedFlowKey = null;
    }

    function showContent(tree) {
        var els = getEls();
        if (!els) return;

        _selectedTree = tree || null;
        var treeKey = getTreeKey(tree);
        var isFlowExpanded = !!treeKey && _expandedFlowKey === treeKey;
        var memories = Array.isArray(tree && tree.memories) ? tree.memories : [];
        var memoryCount = Math.max(getTreeMomentCount(tree), memories.length);
        var hasMemories = memories.length > 0 || memoryCount > 0;

        els.panel.classList.remove('is-empty');
        els.panel.classList.add('is-loaded');
        els.panel.classList.remove('preview-state-empty');
        
        var hasMedia = !!(tree && (tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail));
        if (hasMedia) {
            els.panel.classList.add('preview-state-thumbnail');
            els.panel.classList.remove('preview-state-no-moments');
        } else {
            els.panel.classList.remove('preview-state-thumbnail', 'preview-state-media');
        }

        if (els.placeholder) els.placeholder.hidden = true;
        if (els.content) els.content.hidden = false;
        if (els.badge) {
            els.badge.textContent = i18nHub('myTrees.hub_badge', '선택한 내 트리', 'Selected tree');
        }

        /* ── Update action buttons href ── */
        var basePath = '';
        if (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath) {
            basePath = window.LoveBudPath.getBasePath();
        } else {
            basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        }

        if (els.openBtn && tree && tree.id) {
            var isPublicTree = (tree.visibility === 'public');
            els.openBtn.href = isPublicTree
                ? basePath + 'view.html?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees'
                : basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
        }
        if (els.editBtn && tree && tree.id) {
            els.editBtn.href = basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
        }

        /* ── Tree title ── */
        if (els.treeTitle) {
            var displayTitle = String(tree && tree.title || '').trim() || t('default_tree_title', '나의 러브트리');
            els.treeTitle.textContent = displayTitle;
        }

        /* ── Meta badge ── */
        if (els.metaBadge) {
            var countStr = memoryCount > 0
                ? memoryCount + i18nHub('', '개의 순간', ' moments')
                : i18nHub('myTrees.card_waiting', '첫 순간을 기다리는 중', 'Waiting for the first moment');
            els.metaBadge.innerHTML = '<span class="material-symbols-outlined">auto_stories</span> ' + escapeHtml(countStr);
        }

        /* ── Flow section ── */
        if (hasMemories && memories.length > 0) {
            if (els.noMoments) els.noMoments.hidden = true;
            if (els.flowSection) els.flowSection.hidden = false;

            var visibleMemories = memories.slice(0, VISIBLE_FLOW_MOMENT_COUNT);
            var hiddenMemories = memories.slice(VISIBLE_FLOW_MOMENT_COUNT);

            if (els.flowList) {
                els.flowList.innerHTML = buildFlowStages(visibleMemories, 0);
            }

            if (els.flowControls) {
                if (hiddenMemories.length > 0 && isFlowExpanded) {
                    // Show all hidden memories
                    var hiddenHtml = buildFlowStages(hiddenMemories, VISIBLE_FLOW_MOMENT_COUNT);
                    if (els.flowList) {
                        els.flowList.insertAdjacentHTML('beforeend', hiddenHtml);
                    }
                    els.flowControls.innerHTML = buildFlowToggle(hiddenMemories.length, true);
                } else if (hiddenMemories.length > 0) {
                    els.flowControls.innerHTML = buildFlowToggle(hiddenMemories.length, false);
                } else {
                    els.flowControls.innerHTML = '';
                }
            }
        } else {
            // No moments — show waiting state
            if (els.flowSection) els.flowSection.hidden = true;
            if (els.noMoments) {
                els.noMoments.hidden = false;
                var titleText = String(tree && tree.title || '').trim() || t('default_tree_title', '나의 러브트리');
                els.noMoments.innerHTML =
                    '<span class="material-symbols-outlined">psychiatry</span>' +
                    '<strong>' + escapeHtml(titleText) + '</strong>' +
                    '<p>' + escapeHtml(i18nHub('',
                        '아직 대표 순간이 남아 있지 않아요. 첫 순간을 남기면 이곳에서 흐름을 미리 볼 수 있어요.',
                        'There is no featured moment yet. Once the first moment is added, the flow will preview here.'
                    )) + '</p>';
            }
        }

        /* ── Summary ── */
        if (els.summary) {
            if (hasMemories) {
                els.summary.hidden = false;
                var displayTitle = String(tree && tree.title || '').trim() || t('default_tree_title', '나의 러브트리');
                els.summary.innerHTML = i18nHub('',
                    '<strong style="color:var(--on-surface);">' + escapeHtml(displayTitle) + '</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">' + memoryCount + '개의 순간</span>이 이어졌어요.',
                    '<strong style="color:var(--on-surface);">' + memoryCount + ' moments</strong> in <strong style="color:var(--on-surface);">' + escapeHtml(displayTitle) + '</strong> are connected.'
                );
            } else {
                els.summary.hidden = true;
            }
        }

        /* ── Actions ── */
        if (els.actions) {
            els.actions.hidden = false;
            if (els.openBtn && tree && tree.id) {
                var isPublicTree = (tree.visibility === 'public');
                els.openBtn.href = isPublicTree
                    ? basePath + 'view.html?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees'
                    : basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
                els.openBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span>' +
                    escapeHtml(i18nHub('', '감상하기', 'View'));
            }
            if (els.editBtn && tree && tree.id) {
                els.editBtn.href = basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
                els.editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>' +
                    escapeHtml(i18nHub('', '편집하기', 'Edit'));
            }
        }
    }
    
    /* ── Helper to navigate back to my trees after editor ── */
    function getEditorUrl(treeId) {
        if (!treeId) return '#';
        var basePath = '';
        if (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath) {
            basePath = window.LoveBudPath.getBasePath();
        } else {
            basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        }
        return basePath + 'editor?treeId=' + encodeURIComponent(treeId);
    }

    /* ── Hub loader (loading skeleton) ── */

    function showLoading(tree) {
        var els = getEls();
        if (!els) return;

        els.panel.classList.remove('is-empty');
        els.panel.classList.add('is-loaded');
        if (els.placeholder) els.placeholder.hidden = true;
        if (els.content) els.content.hidden = false;

        if (els.treeTitle) {
            els.treeTitle.textContent = String(tree && tree.title || '').trim() || t('default_tree_title', '나의 러브트리');
        }

        if (els.metaBadge) {
            els.metaBadge.innerHTML = '<span class="material-symbols-outlined">sync</span> ' +
                escapeHtml(i18nHub('', '불러오는 중…', 'Loading…'));
        }

        if (els.flowSection) els.flowSection.hidden = true;
        if (els.noMoments) els.noMoments.hidden = true;

        if (els.summary) {
            els.summary.hidden = false;
            els.summary.textContent = i18nHub('',
                '이 트리의 대표 순간과 이어진 감정을 불러오는 중이에요.',
                'Loading the featured moment and connected feelings of this tree.'
            );
        }

        if (els.actions) {
            els.actions.hidden = false;
            var basePath = '';
            if (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath) {
                basePath = window.LoveBudPath.getBasePath();
            } else {
                basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
            }
            if (els.openBtn && tree && tree.id) {
                var isPublicTree = (tree.visibility === 'public');
                els.openBtn.href = isPublicTree
                    ? basePath + 'view.html?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees'
                    : basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
                els.openBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span> ' +
                    escapeHtml(i18nHub('', '감상하기', 'View'));
            }
            if (els.editBtn && tree && tree.id) {
                els.editBtn.href = basePath + 'editor?treeId=' + encodeURIComponent(tree.id) + '&from=my-trees';
                els.editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> ' +
                    escapeHtml(i18nHub('', '편집하기', 'Edit'));
            }
        }
    }
    
    /* ── Helper to navigate back to my trees after editor ── */
    function getEditorUrl(treeId) {
        if (!treeId) return '#';
        var basePath = '';
        if (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath) {
            basePath = window.LoveBudPath.getBasePath();
        } else {
            basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        }
        return basePath + 'editor?treeId=' + encodeURIComponent(treeId);
    }

    /* ── Card selection handler ── */

    function onCardClick(tree, options) {
        if (!tree) return;
        options = options || {};

        // Update visual selection state
        var grid = document.getElementById('trees-grid');
        if (grid) {
            var cards = grid.querySelectorAll('.tree-card');
            cards.forEach(function (card) {
                card.classList.remove('is-selected');
                card.removeAttribute('data-selected-tree-card');
            });
            // Find and mark selected card
            cards.forEach(function (card) {
                if (card.dataset && card.dataset.treeId === String(tree.id)) {
                    card.classList.add('is-selected');
                    card.setAttribute('data-selected-tree-card', 'true');
                }
            });
        }

        // Update state module
        if (_stateModule && typeof _stateModule.setSelectedTreeId === 'function') {
            _stateModule.setSelectedTreeId(tree.id);
        }

        // Show appreciation hub
        showContent(tree);

        // Scroll to hub on mobile (skip for initial auto-select)
        if (!options.skipScroll) {
            var panel = document.getElementById('myTreesHubPanel');
            if (panel && window.innerWidth <= 768) {
                setTimeout(function () {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }

    /* ── Bind flow toggle events (delegated) ── */

    function bindFlowToggle() {
        document.addEventListener('click', function (event) {
            var toggle = event.target && event.target.closest && event.target.closest('[data-my-trees-flow-toggle]');
            if (!toggle) return;
            if (!_selectedTree) return;

            var treeKey = getTreeKey(_selectedTree);
            _expandedFlowKey = _expandedFlowKey === treeKey ? null : treeKey;
            showContent(_selectedTree);
        });
    }

    /* ── Initialize hub ── */

    function init(options) {
        options = options || {};
        _stateModule = options.stateModule || window.LoveBudMyTreesState || null;
        _onOpenTree = options.onOpenTree || null;

        bindFlowToggle();

        var closeBtn = document.getElementById('myTreesHubClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                showPlaceholder();
            });
        }

        // Show placeholder initially
        showPlaceholder();
    }

    /* ── Public API ── */

    var api = {
        init: init,
        showPlaceholder: showPlaceholder,
        showContent: showContent,
        showLoading: showLoading,
        onCardClick: onCardClick,
        getSelectedTree: function () { return _selectedTree; },
        setTreeGridContainer: setTreeGridContainer
    };

    window.LoveBudMyTreesPreviewHub = api;
    window.LoveTreeMyTreesPreviewHub = api;

})();
