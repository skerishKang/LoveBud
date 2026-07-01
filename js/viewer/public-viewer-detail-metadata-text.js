(function() {
    'use strict';

    function safeDisplayTitle(title) {
        if (!title) return title;
        if (typeof title === 'string') {
            var classifier = window.LoveBudTreeWorkspaceClassifier;
            if (classifier && typeof classifier.isLocalizationKeyTitle === 'function'
                && classifier.isLocalizationKeyTitle(title)) {
                if (typeof classifier.sanitizeDisplayTitle === 'function') {
                    var sanitized = classifier.sanitizeDisplayTitle(title, null);
                    if (sanitized) return sanitized;
                }
                return null;
            }
        }
        return title;
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
            var rawTitle = data && data.title;
            var safeTitle = safeDisplayTitle(rawTitle);
            titleText.textContent = isEmptyState
                ? getText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요')
                : (safeTitle || getText('editor_current_moment_title', '지금 마음이 머춘 장면'));

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

    function updatePublicViewerCurrentMomentDate(data) {
        var dateEl = document.getElementById('detailDateText');
        if (!dateEl) return;

        var isEmptyState = !!(data && data.isNewTree);
        dateEl.textContent = isEmptyState ? '' : ((data && data.timestamp) || '');
    }

    window.LoveBudPublicViewerDetailMetadataText = {
        safeDisplayTitle: safeDisplayTitle,
        createPublicViewerCurrentMomentBadgeBoundary: createPublicViewerCurrentMomentBadgeBoundary,
        createPublicViewerCurrentMomentTitleBoundary: createPublicViewerCurrentMomentTitleBoundary,
        updatePublicViewerCurrentMomentHint: updatePublicViewerCurrentMomentHint,
        updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate
    };
})();
