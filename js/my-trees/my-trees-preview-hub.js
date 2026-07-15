/**
 * LoveBud - My Trees Appreciation Hub
 * v20260624-summary-slot-align-1
 *
 * Selected-tree appreciation hub for My Trees page.
 * Adapted from Browse's preview hub (search-preview-renderer.js) grammar.
 *
 * Responsibilities:
 * - Show a compact appreciation panel when a tree card is selected
 * - Display: tree title, moment count, representative info, flow preview
 * - "감상하기" primary action → opens Editor
 * - No management controls (rename, delete, visibility)
 *
 * Structure alignment with Browse:
 * - #myTreesHubSummary is a plain wrapper slot (no preview-focus-copy class)
 * - JS writes <div class="preview-focus-copy" style="padding:0 4px"> inside it
 *   so the rendered DOM matches Browse's #previewHubSummarySlot structure exactly
 */

(function () {
    'use strict';

    /* ── Constants ── */

    var VISIBLE_FLOW_MOMENT_COUNT = 10;

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
            publicViewBtn: document.getElementById('myTreesHubPublicViewBtn'),
            editBtn: document.getElementById('myTreesHubEditBtn'),
            shareBtn: document.getElementById('myTreesHubShareBtn'),
            noMoments: document.getElementById('myTreesHubNoMoments'),
            socialSlot: document.getElementById('myTreesHubSocialSlot')
        };
    }

    /* ── Write summary content into the slot wrapper.
       #myTreesHubSummary is a plain wrapper (no preview-focus-copy class).
       We create the inner preview-focus-copy div here, matching Browse's
       #previewHubSummarySlot → <div class="preview-focus-copy"> structure. ── */

    function writeSummary(summaryEl, html, hidden) {
        if (!summaryEl) return;
        if (hidden) {
            summaryEl.hidden = true;
            summaryEl.innerHTML = '';
            return;
        }
        summaryEl.hidden = false;
        summaryEl.innerHTML = '<div class="preview-focus-copy">' + html + '</div>';
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
            var activeClass = (stageIndex === 1) ? ' is-active' : '';
            html += '<span class="my-trees-hub-flow-stage preview-flow-stage' + activeClass + '" role="button" tabindex="0" data-my-trees-moment-index="' + stageIndex + '">' +
                '<span class="my-trees-hub-flow-stage-index">' + stageIndex + '</span>' +
                '<span class="my-trees-hub-flow-stage-label preview-flow-stage-label" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
                '</span>';
        }
        return html;
    }

    /* ── Build flow toggle button ── */

    function buildFlowToggle(hiddenCount, isExpanded) {
        if (hiddenCount <= 0) return '';
        var label = isExpanded
            ? i18nHub('', '접기', 'Show less')
            : i18nHub(
                '',
                '... 그리고 ' + hiddenCount + '개의 순간 더',
                '... and ' + hiddenCount + ' more moments'
            );
        return '<button type="button" class="my-trees-hub-flow-toggle preview-flow-toggle" data-my-trees-flow-toggle>' +
            label +
            '</button>';
    }

    var _selectedMomentIndexByTree = {};

    function getMomentSourceUrl(memory) {
        if (!memory) return '';
        return String(
            memory.sourceUrl || memory.source_url ||
            memory.videoUrl || memory.videoURL ||
            memory.mediaUrl || memory.mediaURL ||
            memory.linkUrl || memory.linkURL ||
            ''
        ).trim();
    }

    function swapToMomentIframe(tree, momentIndex) {
        var memories = Array.isArray(tree && tree.memories) ? tree.memories : [];
        var memory = memories[Number(momentIndex) || 0];
        if (!memory) return false;
        var sourceUrl = getMomentSourceUrl(memory);
        if (!sourceUrl) return false;
        var iframe = document.querySelector('#myTreesHubMedia iframe');
        if (!iframe) return false;
        var embedUrl = sourceUrl;
        if (window.LoveBudSearchPreviewMediaHelper && typeof window.LoveBudSearchPreviewMediaHelper.generateIframeSource === 'function') {
            var resolved = window.LoveBudSearchPreviewMediaHelper.generateIframeSource(sourceUrl);
            if (resolved) embedUrl = resolved;
        }
        iframe.src = embedUrl;
        var label = getMomentLabel(memory, '시작 순간', 'Starting moment');
        iframe.setAttribute('title', label);
        return true;
    }

    function enhanceMyTreesFlowStages(tree) {
        var flowList = document.getElementById('myTreesHubFlowList');
        if (!flowList || !tree) return;
        var stages = Array.prototype.slice.call(flowList.querySelectorAll('.my-trees-hub-flow-stage'));
        if (!stages.length) return;
        var treeKey = getTreeKey(tree);
        var selectedIndex = Number(_selectedMomentIndexByTree[treeKey] || 0);
        stages.forEach(function(stage, index) {
            stage.setAttribute('role', 'button');
            stage.setAttribute('tabindex', '0');
            stage.classList.toggle('is-active', index === selectedIndex);
            if (stage.dataset.myTreesMomentBound) return;
            stage.dataset.myTreesMomentBound = 'true';
            var activate = function() {
                _selectedMomentIndexByTree[treeKey] = index;
                stages.forEach(function(item) { item.classList.remove('is-active'); });
                stage.classList.add('is-active');
                // Issue #2825: the click must re-render the media preview
                // to the clicked moment so the active stage and the
                // visible media always refer to the same moment. The
                // legacy swapToMomentIframe() only swapped the existing
                // iframe's src (and returned false silently if the
                // initial media was a thumbnail), so compact flow stage
                // 1-4 clicks effectively did nothing for thumbnail media.
                // renderMediaForMoment() goes through the same code path
                // as the initial showContent render but with a forced
                // moment index, so iframe and thumbnail media are both
                // re-rendered correctly.
                var previewMedia = window.LoveBudMyTreesPreviewMedia;
                if (previewMedia && typeof previewMedia.renderMediaForMoment === 'function') {
                    previewMedia.renderMediaForMoment(tree, index);
                } else {
                    // Fallback if the preview-media module hasn't loaded
                    // yet (e.g. older cached hub). Keeps the previous
                    // iframe-swap behavior as a graceful degradation.
                    swapToMomentIframe(tree, index);
                }
            };
            stage.addEventListener('click', activate);
            stage.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        });
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
        resetActionButton(els.openBtn);
        resetActionButton(els.publicViewBtn);
        resetActionButton(els.editBtn);
        if (els.shareBtn) {
            els.shareBtn.hidden = true;
            els.shareBtn.onclick = null;
            els.shareBtn.removeAttribute('data-tree-id');
        }
    }

    function createMyTreesSocialShell() {
        var shell = document.createElement('div');
        shell.className = 'preview-social-shell';
        shell.setAttribute('data-my-trees-social-shell', '');
        shell.innerHTML = [
            '<div class="preview-social-bar" aria-label="트리 반응">',
            '<div class="preview-social-action preview-social-stat" aria-label="조회수" role="status">',
              '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
              '<strong data-my-trees-social-views>0</strong>',
              '<span>조회수</span>',
            '</div>',
            '<button type="button" class="preview-social-action" aria-label="좋아요 0" disabled>',
              '<span class="material-symbols-outlined" aria-hidden="true">favorite</span>',
              '<strong data-my-trees-social-likes>0</strong>',
              '<span>좋아요</span>',
            '</button>',
            '<button type="button" class="preview-social-action" aria-expanded="false" aria-label="댓글 0">',
              '<span class="material-symbols-outlined" aria-hidden="true">mode_comment</span>',
              '<strong data-my-trees-social-comments>0</strong>',
              '<span>댓글</span>',
            '</button>',
            '</div>'
        ].join('');
        return shell;
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

        /* ── Update action buttons via shared helper ── */
        applyHubActions(tree, els);

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
                    var hiddenHtml = buildFlowStages(hiddenMemories, VISIBLE_FLOW_MOMENT_COUNT);
                    if (els.flowList) {
                        els.flowList.insertAdjacentHTML('beforeend', hiddenHtml);
                    }
                    els.flowControls.innerHTML = buildFlowToggle(hiddenMemories.length, true);
                    els.flowControls.style.display = '';
                    els.flowControls.hidden = false;
                } else if (hiddenMemories.length > 0) {
                    els.flowControls.innerHTML = buildFlowToggle(hiddenMemories.length, false);
                    els.flowControls.style.display = '';
                    els.flowControls.hidden = false;
                } else {
                    els.flowControls.innerHTML = '';
                    els.flowControls.style.display = 'none';
                    els.flowControls.hidden = true;
                }
            }

            enhanceMyTreesFlowStages(tree);
        } else {
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
        if (hasMemories) {
            var summaryTitle = String(tree && tree.title || '').trim() || t('default_tree_title', '나의 러브트리');
            var timeRange = String(tree && tree.timeRange || tree && tree.time_range || '').trim();
            var summaryHtml;
            if (timeRange) {
                summaryHtml = i18nHub('',
                    '<p class="preview-summary-line"><strong>' + escapeHtml(summaryTitle) + '</strong>에 담긴 <strong>' + memoryCount + '개의 순간</strong>이 <strong>' + escapeHtml(timeRange) + '</strong>에 걸쳐 이어졌어요.</p>',
                    '<p class="preview-summary-line"><strong>' + memoryCount + ' moments</strong> in <strong>' + escapeHtml(summaryTitle) + '</strong> connected across <strong>' + escapeHtml(timeRange) + '</strong>.</p>'
                );
            } else {
                summaryHtml = i18nHub('',
                    '<strong style="color:var(--on-surface);">' + escapeHtml(summaryTitle) + '</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">' + memoryCount + '개의 순간</span>이 이어졌어요.',
                    '<strong style="color:var(--on-surface);">' + memoryCount + ' moments</strong> in <strong style="color:var(--on-surface);">' + escapeHtml(summaryTitle) + '</strong> are connected.'
                );
            }
            writeSummary(els.summary, summaryHtml, false);
        } else {
            writeSummary(els.summary, '', true);
        }

        /* ── Social shell (owner passive) ── */
        var socialSlot = els.socialSlot;
        if (socialSlot) {
            if (!socialSlot.querySelector('[data-my-trees-social-shell]')) {
                socialSlot.appendChild(createMyTreesSocialShell());
            }
        } else {
            if (!document.querySelector('[data-my-trees-social-shell]') && els.actions) {
                els.actions.after(createMyTreesSocialShell());
            }
        }

        var panelScope = els.panel;
        if (tree) {
            var likeEl = panelScope ? panelScope.querySelector('[data-my-trees-social-likes]') : document.querySelector('[data-my-trees-social-likes]');
            if (likeEl) likeEl.textContent = String(tree.likeCount || tree.like_count || 0);
            var commentEl = panelScope ? panelScope.querySelector('[data-my-trees-social-comments]') : document.querySelector('[data-my-trees-social-comments]');
            if (commentEl) commentEl.textContent = String(tree.commentCount || tree.comment_count || 0);
            var viewEl = panelScope ? panelScope.querySelector('[data-my-trees-social-views]') : document.querySelector('[data-my-trees-social-views]');
            if (viewEl) viewEl.textContent = String(tree.viewCount || tree.view_count || 0);
        }

        /* ── Keep like button display-only ── */
        var socialBar = panelScope
            ? panelScope.querySelector('.preview-social-bar')
            : document.querySelector('.preview-social-bar');
        if (socialBar) {
            var likeBtn = socialBar.querySelector('[aria-label*="좋아요"]');
            if (likeBtn) {
                likeBtn.onclick = function () {
                    // Issue #3178: Do not send tree IDs to moment reaction endpoint.
                    // Tree-level social reactions are not supported by the moment reaction API.
                    // This button should remain display-only for now.
                    return;
                };
            }
        }
    }
    
    /* ── Shared action button helpers ── */

    function resetActionButton(btn) {
        if (!btn) return;
        btn.removeAttribute('href');
        btn.hidden = true;
        btn.onclick = null;
        btn.removeAttribute('data-tree-id');
    }

    function applyHubActions(tree, els) {
        if (!els || !els.actions) return;
        els.actions.hidden = false;

        resetActionButton(els.openBtn);
        resetActionButton(els.publicViewBtn);
        resetActionButton(els.editBtn);
        if (els.shareBtn) {
            els.shareBtn.hidden = true;
            els.shareBtn.onclick = null;
            els.shareBtn.removeAttribute('data-tree-id');
        }

        var UI = window.LoveBudMyTreesUI || window.LoveTreeMyTreesUI;
        var resolved = null;
        if (UI && typeof UI.validateAndResolveEntryTargets === 'function') {
            try {
                resolved = UI.validateAndResolveEntryTargets(tree);
            } catch (e) {
                resolved = null;
            }
        }
        if (!resolved || typeof resolved !== 'object') {
            resolved = { treeId: null, accessState: 'unknown', primary: null, publicView: null, edit: null };
        }

        if (els.openBtn && resolved.primary) {
            els.openBtn.href = resolved.primary;
            els.openBtn.hidden = false;
            els.openBtn.innerHTML = '<span class="material-symbols-outlined">account_tree</span><span data-i18n="myTrees.entry_appreciation">' +
                escapeHtml(i18nHub('myTrees.entry_appreciation', '감상하기', 'Appreciate')) + '</span>';
        }

        if (els.publicViewBtn && resolved.publicView) {
            els.publicViewBtn.href = resolved.publicView;
            els.publicViewBtn.hidden = false;
            els.publicViewBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span><span data-i18n="myTrees.entry_public_view">' +
                escapeHtml(i18nHub('myTrees.entry_public_view', '공개 화면 보기', 'View public screen')) + '</span>';
        }

        if (els.editBtn && resolved.edit) {
            els.editBtn.href = resolved.edit;
            els.editBtn.hidden = false;
            els.editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span><span data-i18n="myTrees.entry_edit">' +
                escapeHtml(i18nHub('myTrees.entry_edit', '편집하기', 'Edit')) + '</span>';
        }

        /* ── Share button: public tree only, use validated publicView href ── */
        if (els.shareBtn && resolved.accessState === 'public' && resolved.publicView) {
            els.shareBtn.hidden = false;
            els.shareBtn.setAttribute('data-tree-id', resolved.treeId || '');
            els.shareBtn.onclick = (function(shareHref) {
                return function(ev) {
                    ev.preventDefault();
                    // Resolve the validated publicView relative href against the
                    // current document URL so the result is always correct
                    // regardless of whether we are on /pages/my-trees.html or /my-trees.
                    // This avoids the previous bug where a bare relative href was
                    // concatenated to location.origin and produced /view.html.
                    var currentHref = window.location.href ||
                        (window.location.origin + window.location.pathname);
                    var shareUrl = new URL(shareHref, currentHref);
                    shareUrl.searchParams.set('from', 'shared');
                    var url = shareUrl.toString();
                    var labelEl = els.shareBtn.querySelector('[data-i18n=\"myTrees.hub_share\"]');
                    var origLabel = labelEl ? labelEl.textContent : '';
                    var copyFromInput = function(text) {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            return navigator.clipboard.writeText(text);
                        }
                        return new Promise(function(resolve, reject) {
                            try {
                                var ta = document.createElement('textarea');
                                ta.value = text;
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                document.body.appendChild(ta);
                                ta.focus();
                                ta.select();
                                var ok = document.execCommand('copy');
                                document.body.removeChild(ta);
                                ok ? resolve() : reject(new Error('copy failed'));
                            } catch (e) { reject(e); }
                        });
                    };
                    copyFromInput(url).then(function() {
                        if (labelEl) labelEl.textContent = i18nHub('', '복사되었어요', 'Copied');
                        setTimeout(function() { if (labelEl) labelEl.textContent = origLabel; }, 1800);
                    }).catch(function() {
                        if (labelEl) labelEl.textContent = i18nHub('', '복사 실패', 'Copy failed');
                        setTimeout(function() { if (labelEl) labelEl.textContent = origLabel; }, 1800);
                    });
                };
            })(resolved.publicView);
        }
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

        writeSummary(
            els.summary,
            escapeHtml(i18nHub('',
                '이 트리의 대표 순간과 이어진 감정을 불러오는 중이에요.',
                'Loading the featured moment and connected feelings of this tree.'
            )),
            false
        );

        applyHubActions(tree, els);
    }

    /* ── Card selection handler ── */

    function onCardClick(tree, options) {
        if (!tree) return;
        options = options || {};

        var grid = document.getElementById('trees-grid');
        if (grid) {
            var cards = grid.querySelectorAll('.tree-card');
            cards.forEach(function (card) {
                card.classList.remove('is-selected', 'is-active');
                card.removeAttribute('data-selected-tree-card');
            });
            cards.forEach(function (card) {
                if (card.dataset && card.dataset.treeId === String(tree.id)) {
                    card.classList.add('is-selected', 'is-active');
                    card.setAttribute('data-selected-tree-card', 'true');
                }
            });
        }

        if (_stateModule && typeof _stateModule.setSelectedTreeId === 'function') {
            _stateModule.setSelectedTreeId(tree.id);
        }

        showContent(tree);

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

        /* #2903 layout probe: expose 4th action + status slot only when ?hubLayoutProbe=1 */
        if (window.location.search.indexOf('hubLayoutProbe=1') !== -1) {
            var probeSlot = document.querySelector('[data-layout-probe-slot]');
            var probeStatus = document.querySelector('[data-layout-probe-status]');
            if (probeSlot) probeSlot.removeAttribute('hidden');
            if (probeStatus) probeStatus.removeAttribute('hidden');
        }

        bindFlowToggle();

        var closeBtn = document.getElementById('myTreesHubClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                showPlaceholder();
            });
        }

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
        setTreeGridContainer: setTreeGridContainer,
        rebindFlowStages: function(tree) { enhanceMyTreesFlowStages(tree); }
    };

    window.LoveBudMyTreesPreviewHub = api;
    window.LoveTreeMyTreesPreviewHub = api;

})();
