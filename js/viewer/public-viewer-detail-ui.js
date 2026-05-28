(function() {
    'use strict';

    function createPublicViewerUpdateFocusSelectedBtn(deps) {
        var getSelectedNodeId = deps && typeof deps.getSelectedNodeId === 'function'
            ? deps.getSelectedNodeId
            : function() { return null; };

        return function updatePublicViewerFocusSelectedBtn() {
            var btn = document.getElementById('focusSelectedBtn');
            if (!btn) return;

            var hasSelection = !!getSelectedNodeId();
            btn.disabled = !hasSelection;
            btn.classList.toggle('is-disabled', !hasSelection);
        };
    }

    function updatePublicViewerSidebarStatus() {}

    function createPublicViewerEmptyStateContent() {
        var wrap = document.createElement('div');
        var icon = document.createElement('span');
        var title = document.createElement('p');
        var description = document.createElement('p');

        wrap.style.textAlign = 'center';
        wrap.style.padding = '40px 24px';
        wrap.style.color = 'var(--on-surface-variant)';

        icon.className = 'material-symbols-outlined';
        icon.style.fontSize = '48px';
        icon.style.opacity = '0.4';
        icon.style.marginBottom = '16px';
        icon.style.display = 'block';
        icon.textContent = 'sentiment_satisfied';

        title.style.fontSize = '1rem';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        title.style.color = 'var(--on-surface)';
        title.textContent = '첫 순간이 트리를 깨워요';

        description.style.fontSize = '0.9rem';
        description.style.opacity = '0.78';
        description.style.lineHeight = '1.6';
        description.textContent = '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.';

        wrap.appendChild(icon);
        wrap.appendChild(title);
        wrap.appendChild(description);
        return wrap;
    }

    function createPublicViewerSetDetailEmptyState(deps) {
        return function setPublicViewerDetailEmptyState(isEmpty) {
            var detailContent = document.getElementById('detailContent');
            if (!detailContent) return;

            var emptyState = document.getElementById('detailEmptyState');
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.id = 'detailEmptyState';
                emptyState.appendChild(createPublicViewerEmptyStateContent());
                detailContent.appendChild(emptyState);
            }

            var viewMode = document.getElementById('detailViewMode');
            var footer = document.getElementById('detailPanelFooter');

            if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
            if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'block';
            if (footer) footer.style.display = isEmpty ? 'none' : '';
        };
    }

    function createPublicViewerCurrentMomentBadgeBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };

        function getText(key, fallback) {
            var text = i18n(key);
            return text && text !== key ? text : fallback;
        }

        function hasAnyMoments() {
            var memories = getTreeMemories();
            return Array.isArray(memories) && memories.length > 0;
        }

        return function updatePublicViewerCurrentMomentBadge(data) {
            var badgeEl = document.getElementById('detailCurrentMomentBadge');
            if (!badgeEl) return;

            var isEmptyState = !!(data && data.isNewTree) && !hasAnyMoments();
            var rootId = getCanonicalRootId();
            var isRootSelected = !isEmptyState && !!data && isRootMemory(data, rootId);

            badgeEl.textContent = isEmptyState
                ? getText('waiting_first_moment', '첫 순간을 기다리고 있어요')
                : isRootSelected
                    ? getText('start_moment', '시작 순간')
                    : getText('selected_moment', '선택된 순간');
        };
    }

    function createPublicViewerCurrentMomentTitleBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };

        function getText(key, fallback) {
            var text = i18n(key);
            return text && text !== key ? text : fallback;
        }

        function hasAnyMoments() {
            var memories = getTreeMemories();
            return Array.isArray(memories) && memories.length > 0;
        }

        return function updatePublicViewerCurrentMomentTitle(data) {
            var titleEl = document.getElementById('detailCurrentMomentTitle');
            if (!titleEl) return;

            var isEmptyState = !!(data && data.isNewTree) && !hasAnyMoments();
            var titleContainer = document.createElement('div');
            var titleText = document.createElement('span');

            while (titleEl.firstChild) {
                titleEl.removeChild(titleEl.firstChild);
            }

            titleContainer.className = 'memory-inline-edit';
            titleContainer.style.width = '100%';
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'flex-start';

            titleText.style.flex = '1';
            titleText.textContent = isEmptyState
                ? getText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요')
                : ((data && data.title) || getText('editor_current_moment_title', '지금 마음이 머문 장면'));

            titleContainer.appendChild(titleText);
            titleEl.appendChild(titleContainer);
        };
    }

    function updatePublicViewerCurrentMomentHint() {
        var hintEl = document.getElementById('detailCurrentMomentHint');
        if (!hintEl) return;
        hintEl.textContent = '';
        hintEl.hidden = true;
    }

    function updatePublicViewerDetailChannelLink(data) {
        var helper = window.LoveBudPublicViewerDetailChannelLink;
        if (!helper || typeof helper.renderDetailChannelLink !== 'function') return;
        helper.renderDetailChannelLink(data);
    }

    function createPublicViewerCurrentMomentImageBoundary(deps) {
        var resolveMemoryThumbnail = deps && typeof deps.resolveMemoryThumbnail === 'function'
            ? deps.resolveMemoryThumbnail
            : function() { return ''; };

        return function updatePublicViewerCurrentMomentImage(data) {
            var imgEl = document.getElementById('detailImg') || document.querySelector('.detail-video img');
            if (!imgEl) return;

            var isEmptyState = !!(data && data.isNewTree);
            imgEl.src = resolveMemoryThumbnail(data);
            imgEl.alt = isEmptyState ? '' : ((data && data.title) || '');
        };
    }

    function updatePublicViewerCurrentMomentDate(data) {
        var dateEl = document.getElementById('detailDateText');
        if (!dateEl) return;

        var isEmptyState = !!(data && data.isNewTree);
        dateEl.textContent = isEmptyState ? '' : ((data && data.timestamp) || '');
    }

    function createPublicViewerMemoBodyBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };

        function formatI18nText(key, fallback) {
            var text = i18n(key) || fallback;
            return !text || text === key ? fallback : text;
        }

        function hasAnyMoments() {
            var memories = getTreeMemories();
            return Array.isArray(memories) && memories.length > 0;
        }

        function getMemoFallbackText(options) {
            if (typeof window.createEditorDetailUIBuilders === 'function') {
                var builders = window.createEditorDetailUIBuilders({ formatI18nText: formatI18nText });
                if (builders && typeof builders.getMemoFallbackText === 'function') {
                    return builders.getMemoFallbackText(options);
                }
            }
            return formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요');
        }

        return function updatePublicViewerMemoBody(data) {
            var noteEl = document.getElementById('detailMemo') || document.querySelector('.diary-note');
            if (!noteEl) return;

            var isEmptyState = !!(data && data.isNewTree) && !hasAnyMoments();
            var memoContainer = document.createElement('div');
            var memoBody = document.createElement('div');

            while (noteEl.firstChild) {
                noteEl.removeChild(noteEl.firstChild);
            }

            memoContainer.style.width = '100%';

            memoBody.style.lineHeight = '1.8';
            memoBody.style.fontSize = '0.95rem';
            memoBody.style.color = 'var(--on-surface)';
            memoBody.style.whiteSpace = 'pre-line';
            memoBody.textContent = isEmptyState
                ? getMemoFallbackText({ isEmptyState: true })
                : ((data && data.memo) || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요'));

            memoContainer.appendChild(memoBody);
            noteEl.appendChild(memoContainer);
        };
    }

    function createPublicViewerCurrentMomentTagsBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };

        function formatI18nText(key, fallback) {
            var text = i18n(key) || fallback;
            return !text || text === key ? fallback : text;
        }

        function createFallbackTags(data, options) {
            var opts = options || {};
            var isRootSelected = !!opts.isRootSelected;
            var isEmptyState = !!opts.isEmptyState;
            var rawTags = Array.isArray(data && data.emotionTags) ? data.emotionTags.filter(Boolean) : [];
            var normalizedTags = rawTags.map(function(tag) {
                var trimmed = String(tag || '').trim();
                if (!trimmed) return '';
                return trimmed === '기록' ? formatI18nText('editor_root_emotion_tag', '첫 마음') : trimmed;
            }).filter(Boolean);

            if (normalizedTags.length > 0) return normalizedTags;
            if (!isEmptyState && isRootSelected) return [formatI18nText('editor_root_emotion_tag', '첫 마음')];
            return [];
        }

        function getDisplayTags(data, options) {
            if (typeof window.createEditorDetailUIBuilders === 'function') {
                var builders = window.createEditorDetailUIBuilders({ formatI18nText: formatI18nText });
                if (builders && typeof builders.getDisplayEmotionTags === 'function') {
                    return builders.getDisplayEmotionTags(data, options);
                }
            }
            return createFallbackTags(data, options);
        }

        return function updatePublicViewerCurrentMomentTags(data) {
            var tagsContainer = document.getElementById('detailTags');
            if (!tagsContainer) return;

            var isEmptyState = !!(data && data.isNewTree);
            var rootId = getCanonicalRootId();
            var isRootSelected = !isEmptyState && !!data && isRootMemory(data, rootId);
            var displayTags = getDisplayTags(data, { isRootSelected: isRootSelected, isEmptyState: isEmptyState });

            while (tagsContainer.firstChild) {
                tagsContainer.removeChild(tagsContainer.firstChild);
            }

            displayTags.forEach(function(tag) {
                var tagEl = document.createElement('span');
                tagEl.className = 'tag tag-primary';
                tagEl.textContent = tag;
                tagsContainer.appendChild(tagEl);
            });
        };
    }

    function createPublicViewerReadOnlyReactionSummaryBoundary(deps) {
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };

        function resetSummary(likeBtn, likeCount, commentCount) {
            if (likeBtn) {
                likeBtn.dataset.reacted = 'false';
                var icon = likeBtn.querySelector('.editor-reaction-like-icon');
                if (icon) icon.textContent = '🤍';
                likeBtn.onclick = null;
            }
            if (likeCount) likeCount.textContent = '0';
            if (commentCount) commentCount.textContent = '0';
        }

        return function updatePublicViewerReadOnlyReactionSummary(data) {
            var reactionsCard = document.getElementById('momentReactionsCard');
            if (!reactionsCard) return;

            var rootId = getCanonicalRootId();
            if (!data || isRootMemory(data, rootId)) {
                reactionsCard.style.display = 'none';
                return;
            }

            reactionsCard.style.display = '';

            var likeBtn = document.getElementById('momentLikeBtn');
            var likeCount = document.getElementById('momentLikeCount');
            var commentCount = document.getElementById('momentCommentCount');
            var commentBtn = document.getElementById('momentCommentBtn');

            resetSummary(likeBtn, likeCount, commentCount);
            if (commentBtn) commentBtn.onclick = null;

            if (!data.id || !window.apiClient || typeof window.apiClient.fetchReactionSummary !== 'function') {
                return;
            }

            window.apiClient.fetchReactionSummary(data.id)
                .then(function(summary) {
                    if (!summary) return;
                    if (likeCount) likeCount.textContent = summary.like_count ?? summary.likeCount ?? 0;
                    if (commentCount) commentCount.textContent = summary.comment_count ?? summary.commentCount ?? 0;
                    var userReacted = summary.user_reacted ?? summary.userReacted ?? false;
                    if (likeBtn) {
                        likeBtn.dataset.reacted = userReacted ? 'true' : 'false';
                        var icon = likeBtn.querySelector('.editor-reaction-like-icon');
                        if (icon) icon.textContent = userReacted ? '❤️' : '🤍';
                    }
                })
                .catch(function() {});
        };
    }

    function createPublicViewerDetailUI(deps) {
        if (typeof window.createEditorDetailUI !== 'function') {
            throw new Error('createEditorDetailUI is required for public viewer detail UI adapter');
        }

        var detailUI = window.createEditorDetailUI(deps);
        var updateCurrentMomentBadge = createPublicViewerCurrentMomentBadgeBoundary(deps);
        var updateCurrentMomentTitle = createPublicViewerCurrentMomentTitleBoundary(deps);
        var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps);
        var updateMemoBody = createPublicViewerMemoBodyBoundary(deps);
        var updateCurrentMomentTags = createPublicViewerCurrentMomentTagsBoundary(deps);
        var updateReadOnlyReactionSummary = createPublicViewerReadOnlyReactionSummaryBoundary(deps);
        var delegatedUpdateDetailPanel = typeof detailUI.updateDetailPanel === 'function'
            ? detailUI.updateDetailPanel
            : function() {};

        detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps);
        detailUI.updateSidebarStatus = updatePublicViewerSidebarStatus;
        detailUI.setDetailEmptyState = createPublicViewerSetDetailEmptyState(deps);
        detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data) {
            delegatedUpdateDetailPanel(data);
            updateCurrentMomentBadge(data);
            updateCurrentMomentTitle(data);
            updatePublicViewerDetailChannelLink(data);
            updatePublicViewerCurrentMomentHint();
            updateCurrentMomentImage(data);
            updatePublicViewerCurrentMomentDate(data);
            updateMemoBody(data);
            updateCurrentMomentTags(data);
            updateReadOnlyReactionSummary(data);
        };
        return detailUI;
    }

    window.createPublicViewerDetailUI = createPublicViewerDetailUI;
    window.LoveBudPublicViewerDetailUI = {
        createPublicViewerDetailUI: createPublicViewerDetailUI,
        createPublicViewerUpdateFocusSelectedBtn: createPublicViewerUpdateFocusSelectedBtn,
        updatePublicViewerSidebarStatus: updatePublicViewerSidebarStatus,
        createPublicViewerSetDetailEmptyState: createPublicViewerSetDetailEmptyState,
        createPublicViewerCurrentMomentBadgeBoundary: createPublicViewerCurrentMomentBadgeBoundary,
        createPublicViewerCurrentMomentTitleBoundary: createPublicViewerCurrentMomentTitleBoundary,
        updatePublicViewerCurrentMomentHint: updatePublicViewerCurrentMomentHint,
        updatePublicViewerDetailChannelLink: updatePublicViewerDetailChannelLink,
        createPublicViewerCurrentMomentImageBoundary: createPublicViewerCurrentMomentImageBoundary,
        updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate,
        createPublicViewerMemoBodyBoundary: createPublicViewerMemoBodyBoundary,
        createPublicViewerCurrentMomentTagsBoundary: createPublicViewerCurrentMomentTagsBoundary,
        createPublicViewerReadOnlyReactionSummaryBoundary: createPublicViewerReadOnlyReactionSummaryBoundary,
        delegatesToEditorDetailUI: true
    };
})();
