(function() {
    'use strict';

    function getMedia() {
        return window.LoveBudMedia || {};
    }

    function parseTime(value) {
        const media = getMedia();
        if (typeof media.parseYouTubeTimeToSeconds !== 'function') return null;
        return media.parseYouTubeTimeToSeconds(value);
    }

    function extractStartSeconds(url) {
        const media = getMedia();
        if (typeof media.extractYouTubeStartSeconds !== 'function') return null;
        return media.extractYouTubeStartSeconds(url);
    }

    function formatStartTime(seconds) {
        const media = getMedia();
        if (typeof media.formatYouTubeStartTime !== 'function') return '';
        return media.formatYouTubeStartTime(seconds);
    }

    function resolveStartSeconds(options) {
        const { rawUrl, startValue, userHasEditedStartTime } = options || {};
        return userHasEditedStartTime ? parseTime(startValue) : extractStartSeconds(rawUrl);
    }

    function autofillStartFromUrl(options) {
        const { rawUrl, startTimeInput, userHasEditedStartTime } = options || {};
        if (!startTimeInput || userHasEditedStartTime) return;
        const fromUrl = extractStartSeconds(rawUrl);
        startTimeInput.value = fromUrl ? formatStartTime(fromUrl) : '';
    }

    function validateEndTime(options) {
        const {
            rawEndTime,
            startSeconds,
            invalidMessage,
            rangeMessage
        } = options || {};
        const value = String(rawEndTime || '').trim();
        if (!value) return { ok: true, endSeconds: null };

        const endSeconds = parseTime(value);
        if (!endSeconds) {
            return {
                ok: false,
                message: invalidMessage || '끝 시간을 다시 확인해 주세요.'
            };
        }
        if (startSeconds && endSeconds <= startSeconds) {
            return {
                ok: false,
                message: rangeMessage || '끝 시간은 시작 시간보다 뒤여야 해요.'
            };
        }
        return { ok: true, endSeconds };
    }

    window.LoveBudEditorMemoryFormTime = {
        parseTime,
        extractStartSeconds,
        formatStartTime,
        resolveStartSeconds,
        autofillStartFromUrl,
        validateEndTime
    };
})();
