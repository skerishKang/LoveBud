/**
 * LoveBud 미디어 유틸리티
 * v20260418-1
 *
 * YouTube 및 기타 미디어 소스 처리 유틸리티
 */

(function() {
    'use strict';

    /**
     * YouTube URL에서 비디오 ID 추출
     * @param {string} url - YouTube URL
     * @returns {string|null} 비디오 ID (11자리)
     */
    function extractYouTubeId(url) {
        if (!url || typeof url !== 'string') return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * 임베드 URL 생성
     * @param {string} sourceUrl - 원본 URL
     * @param {string} type - 소스 타입 (현재 youtube만 지원)
     * @returns {string|null} 임베드 URL
     */
    function getEmbedUrl(sourceUrl, type = 'youtube') {
        if (type === 'youtube') {
            const videoId = extractYouTubeId(sourceUrl);
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }
        return null;
    }

    /**
     * 썸네일 URL 생성
     * @param {string} sourceUrl - 원본 URL
     * @param {string} type - 소스 타입
     * @param {string} quality - 썸네일 품질 (default: mqdefault)
     * @returns {string|null} 썸네일 URL
     */
    function getThumbnailUrl(sourceUrl, type = 'youtube', quality = 'mqdefault') {
        if (type === 'youtube') {
            const videoId = extractYouTubeId(sourceUrl);
            if (!videoId) return null;
            // 품질 옵션: default, mqdefault, hqdefault, sddefault, maxresdefault
            const validQuality = ['default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'].includes(quality)
                ? quality
                : 'mqdefault';
            return `https://img.youtube.com/vi/${videoId}/${validQuality}.jpg`;
        }
        return null;
    }

    /**
     * 소스 URL 유효성 검사
     * @param {string} url - 검사할 URL
     * @param {string} type - 소스 타입
     * @returns {boolean}
     */
    function validateSourceUrl(url, type = 'youtube') {
        if (!url || typeof url !== 'string') return false;
        if (type === 'youtube') {
            return extractYouTubeId(url) !== null;
        }
        return false;
    }

    /**
     * 소스 타입 자동 감지
     * @param {string} url - 검사할 URL
     * @returns {string} 감지된 타입 (youtube, unknown)
     */
    function detectSourceType(url) {
        if (!url || typeof url !== 'string') return 'unknown';
        if (extractYouTubeId(url)) return 'youtube';
        return 'unknown';
    }

    // 전역 노출
    window.LoveBudMedia = {
        extractYouTubeId,
        getEmbedUrl,
        getThumbnailUrl,
        validateSourceUrl,
        detectSourceType
    };

    console.log('[LoveBudMedia] Media utilities loaded v20260418-1');
})();
