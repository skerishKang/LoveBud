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
 * @version 1.2.0
 * @since 2026-04-18
 * @updated 2026-06-13
 */

(function() {
    'use strict';

    /**
     * Root placeholder에서 흔히 사용되는 기본 title 집합.
     * hasRealMomentContent()에서 "title만 있는 memory"가
     * placeholder인지 real moment인지 구분하는 데 사용된다.
     */
    const ROOT_PLACEHOLDER_TITLES = new Set([
        'root', 'Root', 'ROOT',
        '루트',
        '새 트리', '새 러브트리', '새 트리입니다', '새 러브트리입니다',
        'untitled', 'Untitled', 'UNTITLED',
        '새 moment', '새 순간', 'root placeholder'
    ]);

    /**
     * memory에 "실제 표시 가능한 moment content"가 있는지 검사.
     *
     * PR #2448에서 도입. parentId === null/undefined인 memory가
     * root placeholder로 오인되는 false positive를 막기 위해 사용된다.
     *
     * strong signal (하나라도 truthy → real moment):
     *   - sourceUrl (YouTube/외부 URL)
     *   - source   ('YouTube', '텍스트' 등)
     *   - thumbnail
     *   - memo
     *   - quote
     *   - emotionTags (비어있지 않은 배열)
     *
     * weak signal:
     *   - title이 비어있지 않고 ROOT_PLACEHOLDER_TITLES에 없는 경우
     *     → root placeholder가 아닌 "유저가 입력한 의미있는 제목"으로 보고 real moment로 본다.
     *
     * @param {Object} memory - memory 객체
     * @returns {boolean} - real moment content 존재 여부
     */
    const hasRealMomentContent = (memory) => {
        if (!memory) return false;

        if (memory.sourceUrl && String(memory.sourceUrl).trim()) return true;
        if (memory.source && String(memory.source).trim()) return true;
        if (memory.thumbnail && String(memory.thumbnail).trim()) return true;
        if (memory.memo && String(memory.memo).trim()) return true;
        if (memory.quote && String(memory.quote).trim()) return true;
        if (Array.isArray(memory.emotionTags) && memory.emotionTags.length > 0) return true;

        const title = memory.title ? String(memory.title).trim() : '';
        if (title && !ROOT_PLACEHOLDER_TITLES.has(title)) return true;

        return false;
    };

    /**
     * Root-like memory 판정 (공통 predicate)
     *
     * 메모리가 root placeholder로 간주되어야 하는지 판정한다.
     *
     * 규칙 (PR #2448에서 정밀화):
     *   1) memory.id === 'root'                    → root (legacy root)
     *   2) memory.parentId === ''                  → blank-parent root placeholder
     *   3) memory.parentId === memory.id           → self-parent root placeholder
     *   4) memory.parentId === null/undefined:
     *      - hasRealMomentContent(memory) === true  → real moment (root 아님)
     *      - 그 외                                   → root-like (legacy placeholder 호환)
     *
     * 이 predicate는 empty guide visibility, canvas detail, root helper
     * selection 등 모든 root 판정 경로에서 공통으로 사용된다.
     *
     * signature는 (memory) → boolean으로 유지되며, PR #2447의
     * filterMemoriesForTree()는 이 helper를 직접 사용하지 않는다
     * (treeId 매칭을 최우선으로 본다).
     *
     * @param {Object} memory - memory 객체
     * @returns {boolean} - root-like 여부
     */
    const isRootLikeMemory = (memory) => {
        if (!memory) return false;
        const parentId = memory.parentId;

        // 무조건 root
        if (memory.id === 'root') return true;
        if (parentId === '') return true;
        if (parentId === memory.id) return true;

        // parentId null/undefined는 content-aware
        if (parentId === null || parentId === undefined) {
            return !hasRealMomentContent(memory);
        }

        return false;
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

        // 1순위: root-like 노드 필터 (정밀화된 4가지 케이스)
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
     * 1) parentId === null 우선 (단, real content가 없는 placeholder만)
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
        isRootLikeMemory,
        hasRealMomentContent
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
