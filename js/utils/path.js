/**
 * LoveBud 경로 유틸리티
 * v20260418-1
 *
 * 페이지 경로 및 컨텍스트 관련 유틸리티
 */

(function() {
    'use strict';

    /**
     * 현재 페이지가 /pages/ 컨텍스트인지 확인
     * @returns {boolean}
     */
    function isPagesContext() {
        return window.location.pathname.indexOf('/pages/') !== -1;
    }

    /**
     * basePath 반환
     * @returns {string} '' 또는 'pages/'
     */
    function getBasePath() {
        return isPagesContext() ? '' : 'pages/';
    }

    /**
     * 페이지 URL 생성
     * @param {string} pageName - 예: 'detail.html', 'search.html'
     * @returns {string} 완성된 경로
     */
    function resolvePageUrl(pageName) {
        return getBasePath() + pageName;
    }

    /**
     * 쿼리 파라미터가 포함된 URL 생성
     * @param {string} pageName - 페이지 이름
     * @param {Object} params - 쿼리 파라미터 객체
     * @returns {string} 완성된 URL
     */
    function buildUrl(pageName, params = {}) {
        const baseUrl = resolvePageUrl(pageName);
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    // 전역 노출
    window.LoveBudPath = {
        isPagesContext,
        getBasePath,
        resolvePageUrl,
        buildUrl
    };

    console.log('[LoveBudPath] Path utilities loaded v20260418-1');
})();
