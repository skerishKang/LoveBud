/**
 * LoveBud 미디어 유틸리티
 * v20260424-2
 *
 * YouTube 및 기타 미디어 소스 처리 유틸리티
 */

(function() {
    'use strict';

    const MAX_YOUTUBE_START_SECONDS = 12 * 60 * 60;


    /**
     * YouTube URL에서 비디오 ID 추출
     * @param {string} url - YouTube URL
     * @returns {string|null} 비디오 ID (11자리)
     */
    function extractYouTubeId(url) {
        if (!url || typeof url !== 'string') return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * YouTube 시간 문자열을 초 단위로 변환
     * 지원 예: 83, 83초, 1:23, 01:23, 1m23s, 2h1m3s
     * @param {string|number} value
     * @returns {number|null}
     */
    function parseYouTubeTimeToSeconds(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim().toLowerCase();
        if (!raw) return null;

        const normalized = raw
            .replace(/초/g, 's')
            .replace(/분/g, 'm')
            .replace(/시간/g, 'h')
            .replace(/\s+/g, '');

        if (!normalized || normalized.startsWith('-')) return null;

        let seconds = null;

        if (/^\d+(?::\d{1,2}){1,2}$/.test(normalized)) {
            const parts = normalized.split(':').map((part) => Number(part));
            if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
            if (parts.length === 2) {
                seconds = (parts[0] * 60) + parts[1];
            } else if (parts.length === 3) {
                seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            }
        } else if (/^\d+$/.test(normalized)) {
            seconds = Number(normalized);
        } else {
            const timeMatch = normalized.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
            if (timeMatch && (timeMatch[1] || timeMatch[2] || timeMatch[3])) {
                seconds = (Number(timeMatch[1] || 0) * 3600) +
                    (Number(timeMatch[2] || 0) * 60) +
                    Number(timeMatch[3] || 0);
            }
        }

        if (!Number.isFinite(seconds) || seconds < 0) return null;
        seconds = Math.floor(seconds);
        if (seconds <= 0 || seconds > MAX_YOUTUBE_START_SECONDS) return null;
        return seconds;
    }

    /**
     * YouTube URL의 t/start 파라미터에서 시작 시간을 추출
     * @param {string} url
     * @returns {number|null}
     */
    function extractYouTubeStartSeconds(url) {
        if (!url || typeof url !== 'string') return null;
        try {
            const parsed = new URL(url.trim());
            const searchValue = parsed.searchParams.get('t') || parsed.searchParams.get('start');
            const hashParams = new URLSearchParams((parsed.hash || '').replace(/^#/, ''));
            const hashValue = hashParams.get('t') || hashParams.get('start');
            return parseYouTubeTimeToSeconds(searchValue || hashValue);
        } catch (e) {
            const hashMatch = url.match(/[#&?](?:t|start)=([^&#]+)/i);
            return parseYouTubeTimeToSeconds(hashMatch ? decodeURIComponent(hashMatch[1]) : '');
        }
    }

    /**
     * 초 단위 시간을 사람이 읽는 시간 문자열로 변환
     * @param {number} seconds
     * @returns {string}
     */
    function formatYouTubeStartTime(seconds) {
        const safeSeconds = Number(seconds);
        if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) return '';
        const whole = Math.floor(safeSeconds);
        const hours = Math.floor(whole / 3600);
        const minutes = Math.floor((whole % 3600) / 60);
        const rest = whole % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
        }
        return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function resolveStartSeconds(sourceUrl, options = {}) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'startSeconds')) {
            return parseYouTubeTimeToSeconds(options.startSeconds);
        }
        return extractYouTubeStartSeconds(sourceUrl);
    }

    /**
     * 임베드 URL 생성
     * @param {string} sourceUrl - 원본 URL
     * @param {string} type - 소스 타입 (현재 youtube만 지원)
     * @param {object} options - 옵션 ({ startSeconds })
     * @returns {string|null} 임베드 URL
     */
    function getEmbedUrl(sourceUrl, type = 'youtube', options = {}) {
        if (type === 'youtube') {
            const videoId = extractYouTubeId(sourceUrl);
            if (!videoId) return null;
            const startSeconds = resolveStartSeconds(sourceUrl, options);
            const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
            if (startSeconds) embedUrl.searchParams.set('start', String(startSeconds));
            return embedUrl.toString();
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
        parseYouTubeTimeToSeconds,
        extractYouTubeStartSeconds,
        formatYouTubeStartTime,
        getEmbedUrl,
        getThumbnailUrl,
        validateSourceUrl,
        detectSourceType
    };

    console.log('[LoveBudMedia] Media utilities loaded v20260424-3 (pure)');
})();
