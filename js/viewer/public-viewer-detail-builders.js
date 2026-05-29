(function () {
    function noop() {}

    function createNoopInlineEditBoundary() {
        return {
            createTitleEditBoundary: noop,
            createMemoEditBoundary: noop
        };
    }

    function createNoopSidebarStatusBoundary() {
        return {
            updateSidebarStatus: noop
        };
    }

    function installPublicDetailBoundaryFallbacks() {
        if (typeof window.createEditorDetailInlineEditBoundary !== 'function') {
            window.createEditorDetailInlineEditBoundary = createNoopInlineEditBoundary;
        }

        if (typeof window.createEditorDetailSidebarStatusBoundary !== 'function') {
            window.createEditorDetailSidebarStatusBoundary = createNoopSidebarStatusBoundary;
        }
    }

    function createPublicViewerDetailUIBuilders({ formatI18nText }) {
        const createInlineIcon = (name, size = '12px') => {
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.style.fontSize = size;
            icon.textContent = name;
            return icon;
        };

        const getDisplayEmotionTags = (data, options = {}) => {
            const opts = options || {};
            const isRootSelected = !!opts.isRootSelected;
            const isEmptyState = !!opts.isEmptyState;
            const rawTags = Array.isArray(data?.emotionTags) ? data.emotionTags.filter(Boolean) : [];
            const normalizedTags = rawTags.map((tag) => {
                const trimmed = String(tag || '').trim();
                if (!trimmed) return '';
                if (trimmed === '기록') {
                    return formatI18nText('editor_root_emotion_tag', '첫 마음');
                }
                return trimmed;
            }).filter(Boolean);

            if (normalizedTags.length > 0) return normalizedTags;
            if (!isEmptyState && isRootSelected) return [formatI18nText('editor_root_emotion_tag', '첫 마음')];
            return [];
        };

        const getMemoFallbackText = (options = {}) => {
            const opts = options || {};
            if (opts.isEmptyState) {
                return formatI18nText('empty_tree_memo', '아직 비어 있는 자리예요. 첫 순간을 심으면 이 트리가 당신의 흐름으로 자라나기 시작해요.');
            }
            if (opts.isRootSelected) {
                return formatI18nText('editor_root_memo_fallback', '이 장면이 왜 시작이 되었는지 남겨두면, 다음 순간들이 더 자연스럽게 이어져요.');
            }
            return formatI18nText('editor_selected_memo_fallback', '이 순간의 마음을 한 줄 남겨두면, 이어진 흐름을 다시 떠올리기 쉬워져요.');
        };

        return {
            createInlineIcon,
            getDisplayEmotionTags,
            getMemoFallbackText
        };
    }

    const createEditorDetailUIBuilders = createPublicViewerDetailUIBuilders;

    installPublicDetailBoundaryFallbacks();

    window.createPublicViewerDetailUIBuilders = createPublicViewerDetailUIBuilders;
    window.createEditorDetailUIBuilders = createEditorDetailUIBuilders;
    window.LoveBudPublicViewerDetailBuilders = {
        createPublicViewerDetailUIBuilders,
        createEditorDetailUIBuilders,
        createNoopInlineEditBoundary,
        createNoopSidebarStatusBoundary
    };
})();
