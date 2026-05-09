/**
 * editor-root-helpers.js
 * 
 * 러브트리 에디터 - Root Memory 식별 및 관리 헬퍼
 * 
 * 책임:
 * - Root memory 식별 (parentId === null 기반)
 * - Canonical root ID 계산
 * - Root 관련 유틸리티 함수 제공
 * 
 * 의존성: 없음 (순수 함수들만 제공)
 * 사용처: editor.js, 추후 다른 트리 관련 페이지에서 재사용 가능
 * 
 * @version 1.0.0
 * @since 2026-04-18
 */

(function() {
    'use strict';

    /**
     * Root memory 식별
     * 
     * 규칙:
     * 1) parentId === null인 노드 중 createdAt이 가장 오래된 것 (진짜 root)
     * 2) id === 'root' (legacy root compatibility)
     * 
     * @param {Array} memories - memory 객체 배열
     * @returns {Object|null} - root memory 객체 또는 null
     */
    const findRootMemory = (memories) => {
        if (!Array.isArray(memories)) return null;
        
        // 1순위: parentId === null인 노드 중 createdAt이 가장 오래된 것 (진짜 root)
        const parentNullNodes = memories.filter(m => m.parentId === null || m.parentId === undefined);
        
        if (parentNullNodes.length === 1) {
            return parentNullNodes[0];
        } else if (parentNullNodes.length > 1) {
            // 여러 개면 createdAt 기준으로 가장 오래된 것이 진짜 root
            const oldest = parentNullNodes.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || '9999';
                const bTime = b.createdAt || b.timestamp || '9999';
                return new Date(aTime) - new Date(bTime);
            })[0];
            console.log('[editor-root-helpers] Multiple parentId=null nodes found, using oldest as root:', oldest.id);
            return oldest;
        }
        
        // 2순위: id === 'root' (legacy root compatibility)
        return memories.find(m => m.id === 'root');
    };

    /**
     * Root ID 반환 (없으면 'root' fallback - backward compatibility)
     * 
     * @param {Array} memories - memory 객체 배열
     * @returns {string} - root ID 또는 'root'
     */
    const getRootId = (memories) => {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    /**
     * Canonical root 계산 (현재 메모리 배열 기준, 항상 fresh)
     * 
     * 규칙:
     * 1) parentId === null 우선
     * 2) id === 'root' (legacy root compatibility)
     * 3) 없으면 'root' fallback
     * 
     * @param {Array} memories - memory 객체 배열
     * @returns {string} - canonical root ID
     */
    const getCanonicalRootId = (memories) => {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    /**
     * memory가 지정된 root ID와 같은지 확인
     * 
     * @param {Object} mem - memory 객체
     * @param {string} rootId - root ID
     * @returns {boolean}
     */
    const isRootMemory = (mem, rootId) => {
        if (!mem || !rootId) return false;
        return mem.id === rootId;
    };

    /**
     * 러브트리 유틸리티 객체
     * 
     * 전역 노출: window.LoveBudEditorUtils
     */
    const LoveBudEditorUtils = {
        findRootMemory,
        getRootId,
        getCanonicalRootId,
        isRootMemory
    };

    // 전역 노출
    if (typeof window !== 'undefined') {
        window.LoveBudEditorUtils = LoveBudEditorUtils;
    }

    // 모듈 환경 지원 (향후 ES6 모듈 전환 시)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LoveBudEditorUtils;
    }

    console.log('[editor-root-helpers] Root memory utilities loaded v1.0.0');
})();
