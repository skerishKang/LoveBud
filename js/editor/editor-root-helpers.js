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
 * @version 1.1.0
 * @since 2026-04-18
 * @updated 2026-06-13
 */

(function() {
    'use strict';

    /**
     * Root-like memory 판정 (공통 predicate)
     *
     * 메모리가 root placeholder로 간주되어야 하는지 판정한다.
     * 5가지 케이스 모두 root-like로 본다:
     *   1) memory.id === 'root'             — legacy root
     *   2) memory.parentId === null         — 정식 root (parentId 미설정)
     *   3) memory.parentId === undefined    — 정식 root (parentId 미설정)
     *   4) memory.parentId === ''           — blank-parent root placeholder
     *   5) memory.parentId === memory.id    — self-parent root placeholder
     *
     * 이 predicate는 empty guide visibility, canvas detail, root helper
     * selection 등 모든 root 판정 경로에서 공통으로 사용된다.
     *
     * @param {Object} memory - memory 객체
     * @returns {boolean} - root-like 여부
     */
    const isRootLikeMemory = (memory) => {
        if (!memory) return false;
        const parentId = memory.parentId;
        return memory.id === 'root'
            || parentId === null
            || parentId === undefined
            || parentId === ''
            || parentId === memory.id;
    };

    /**
     * Root memory 식별
     *
     * 규칙:
     * 1) root-like 노드 (`isRootLikeMemory`) 중 id === 'root' 우선
     *    (legacy root compatibility: parentId: null인 real child가 있어도
     *     'root'를 canonical root로 선택)
     * 2) id === 'root'가 없으면 root-like 노드 중 createdAt 가장 오래된 것
     * 3) root-like 노드가 없으면 null
     *
     * @param {Array} memories - memory 객체 배열
     * @returns {Object|null} - root memory 객체 또는 null
     */
    const findRootMemory = (memories) => {
        if (!Array.isArray(memories)) return null;

        // 1순위: root-like 노드 필터 (5가지 케이스 모두 포함)
        const rootLikeNodes = memories.filter(isRootLikeMemory);

        if (rootLikeNodes.length === 0) {
            return null;
        }

        // 2순위: legacy 'root' 우선 (parentId: null인 real child 오인 방지)
        const legacyRoot = rootLikeNodes.find(m => m.id === 'root');
        if (legacyRoot) {
            return legacyRoot;
        }

        // 3순위: root-like가 하나면 그게 root
        if (rootLikeNodes.length === 1) {
            return rootLikeNodes[0];
        }

        // 4순위: 여러 개면 createdAt 기준으로 가장 오래된 것이 진짜 root
        const oldest = rootLikeNodes.slice().sort((a, b) => {
            const aTime = a.createdAt || a.timestamp || '9999';
            const bTime = b.createdAt || b.timestamp || '9999';
            return new Date(aTime) - new Date(bTime);
        })[0];
        return oldest;
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
        isRootMemory,
        isRootLikeMemory
    };

    // 전역 노출
    if (typeof window !== 'undefined') {
        window.LoveBudEditorUtils = LoveBudEditorUtils;
    }

    // 모듈 환경 지원 (향후 ES6 모듈 전환 시)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LoveBudEditorUtils;
    }

})();
