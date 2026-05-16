(function() {
    'use strict';

    function todayDateString() {
        const today = new Date();
        return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    }

    function buildFallbackYouTubeSource(rawUrl, getYouTubeInputErrorMessage) {
        const match = rawUrl.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
        if (!match) {
            return {
                ok: false,
                message: getYouTubeInputErrorMessage(rawUrl),
                level: 'error'
            };
        }
        const videoId = match[1];
        return {
            ok: true,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
    }

    function buildMediaSource(options) {
        const {
            rawUrl,
            startValue,
            endValue,
            userHasEditedStartTime,
            getYouTubeInputErrorMessage
        } = options || {};
        if (!rawUrl) {
            return {
                ok: true,
                embedUrl: '',
                thumbnailUrl: '',
                sourceType: 'other',
                sourceLabel: ''
            };
        }

        const media = window.LoveBudMedia || {};
        if (typeof media.extractYouTubeId !== 'function') {
            console.warn('[editor] LoveBudMedia not loaded, using fallback YouTube parsing');
            const fallback = buildFallbackYouTubeSource(rawUrl, getYouTubeInputErrorMessage);
            if (!fallback.ok) return fallback;
            return {
                ...fallback,
                sourceType: 'youtube',
                sourceLabel: 'YouTube'
            };
        }

        const videoId = media.extractYouTubeId(rawUrl);
        if (!videoId) {
            return {
                ok: false,
                message: getYouTubeInputErrorMessage(rawUrl),
                level: 'error'
            };
        }

        const time = window.LoveBudEditorMemoryFormTime || {};
        const startSeconds = typeof time.resolveStartSeconds === 'function'
            ? time.resolveStartSeconds({ rawUrl, startValue, userHasEditedStartTime })
            : null;
        const endCheck = typeof time.validateEndTime === 'function'
            ? time.validateEndTime({ rawEndTime: endValue, startSeconds })
            : { ok: true, endSeconds: null };
        if (!endCheck.ok) {
            return {
                ok: false,
                message: endCheck.message,
                level: 'warn'
            };
        }

        let embedUrl = media.getEmbedUrl(rawUrl, 'youtube', { startSeconds });
        if (embedUrl && endCheck.endSeconds) {
            const parsedEmbed = new URL(embedUrl);
            parsedEmbed.searchParams.set('end', String(endCheck.endSeconds));
            embedUrl = parsedEmbed.toString();
        }

        return {
            ok: true,
            embedUrl,
            thumbnailUrl: media.getThumbnailUrl(rawUrl, 'youtube', 'mqdefault'),
            sourceType: 'youtube',
            sourceLabel: 'YouTube'
        };
    }

    function buildMemoryPayload(options) {
        const {
            refs,
            currentInputMode,
            userHasEditedStartTime,
            i18n,
            treeId,
            getYouTubeInputErrorMessage,
            getTreeMemories,
            resolveParentIdForCreate,
            getSelectedNodeId,
            getCanonicalRootId
        } = options || {};
        const rawUrl = refs?.urlInput ? refs.urlInput.value.trim() : '';
        const titleValue = refs?.titleInput ? refs.titleInput.value.trim() : '';
        const memoValue = refs?.memoInput ? refs.memoInput.value.trim() : '';
        const usingLinkMode = currentInputMode === 'link';

        if (usingLinkMode && !rawUrl) {
            return {
                ok: false,
                message: i18n('enter_youtube'),
                level: 'warn'
            };
        }

        if (!usingLinkMode && !titleValue && !memoValue) {
            return {
                ok: false,
                message: i18n('editor_enter_text_moment') || '제목이나 메모를 한 줄 이상 남겨 주세요.',
                level: 'warn'
            };
        }

        const mediaSource = buildMediaSource({
            rawUrl,
            startValue: refs?.startTimeInput?.value,
            endValue: refs?.endTimeInput?.value,
            userHasEditedStartTime,
            getYouTubeInputErrorMessage
        });
        if (!mediaSource.ok) return mediaSource;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;
        const defaultTitle = isFirstMoment
            ? (i18n('editor_default_first_title') || '첫 순간')
            : (i18n('editor_default_next_title') || '이어진 순간');

        const freshCanonicalRootId = window.LoveBudEditorUtils?.getCanonicalRootId
            ? window.LoveBudEditorUtils.getCanonicalRootId(memories)
            : getCanonicalRootId();

        return {
            ok: true,
            data: {
                treeId,
                title: titleValue || defaultTitle,
                memo: memoValue || '',
                timestamp: todayDateString(),
                sourceUrl: mediaSource.embedUrl,
                sourceType: mediaSource.sourceType,
                emotionTags: [],
                parentId: resolveParentIdForCreate(getSelectedNodeId(), freshCanonicalRootId),
                thumbnail: mediaSource.thumbnailUrl,
                artist: '',
                source: mediaSource.sourceLabel,
                visibility: 'public'
            }
        };
    }

    window.LoveBudEditorMemoryFormPayload = {
        buildMediaSource,
        buildMemoryPayload
    };
})();
