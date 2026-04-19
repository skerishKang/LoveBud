/**
 * editor-canvas.js
 * 
 * 러브트리 에디터 - Canvas 렌더링 모듈
 * 
 * 책임:
 * - SVG 캔버스 초기화 및 렌더링
 * - 트리 노드 (root, memory nodes) 그리기
 * - 브랜치 (부모-자식 연결선) 그리기
 * - 노드 위치 계산 지원
 * 
 * 의존성:
 * - 외부에서 canvas, svg 엘리먼트 제공받음
 * - 외부에서 treeMemories, calcPosition, isRootMemory 제공받음
 * 
 * 사용처: editor.js
 * 
 * @version 1.0.0
 * @since 2026-04-18
 */

(function() {
    'use strict';

    // 배치 상수 - 첫 노드 중앙 정렬
    const ROOT_X = 320; // 400→320: 첫 노드를 캔버스 중심축으로 이동
    const ROOT_Y = 300; // 350→300: 중앙 정렬
    const RADIUS_L1 = 320; // L1 반경 (280→320) - 노드 겹침 방지
    const RADIUS_L2 = 240; // L2 반경 (200→240) - 노드 겹침 방지
    const NODE_WIDTH = 80;  // 노드 카드 너비 (px)
    const MIN_ANGLE_GAP = 35; // 최소 각도 간격 (도) - 겹침 방지

    /**
     * 루트 노드 그리기
     * @param {SVGElement} svg - SVG 엘리먼트
     */
    const drawRoot = (svg) => {
        // Root marker is no longer rendered in production UI.
        // The editor treats the root as a logical anchor only.
        return null;
    };

    /**
     * 브랜치 (연결선) 그리기
     * @param {SVGElement} svg - SVG 엘리먼트
     * @param {Object} startPos - 시작 위치 {x, y}
     * @param {Object} endPos - 끝 위치 {x, y}
     */
    const drawBranch = (svg, startPos, endPos) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
        const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "branch-line");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "var(--secondary)");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("opacity", "0.5");
        svg.appendChild(path);
    };

    /**
     * 메모리 노드 그리기
     * @param {HTMLElement} canvas - 캔버스 컨테이너
     * @param {Object} mem - memory 데이터
     * @param {Function} calcPosition - 위치 계산 함수
     * @param {Function} onNodeClick - 노드 클릭 핸들러
     */
    const drawNode = (canvas, mem, calcPosition, onNodeClick) => {
        const pos = calcPosition(mem);
        const nodeEl = document.createElement('div');
        nodeEl.className = 'memory-node floating-node';
        nodeEl.dataset.memoryId = mem.id;
        nodeEl.style.left = `${pos.x - 40}px`;
        nodeEl.style.top = `${pos.y - 40}px`;
        nodeEl.style.animationDelay = mem.delay || '0s';
        nodeEl.innerHTML = `
            <div class="node-card">
                <div class="node-img-wrapper">
                    <img src="${mem.thumbnail}" alt="${mem.title}">
                </div>
            </div>
            <div class="node-info-label">
                <p class="node-title">${mem.title}</p>
                <p class="node-date">${mem.timestamp}</p>
            </div>
        `;
        if (onNodeClick) {
            nodeEl.addEventListener('click', () => onNodeClick(nodeEl, mem));
        }
        canvas.appendChild(nodeEl);
        return nodeEl;
    };

    /**
     * 캔버스 초기화 - 전체 트리 렌더링
     * @param {Object} config - 설정 객체
     * @param {HTMLElement} config.canvas - 캔버스 컨테이너
     * @param {SVGElement} config.svg - SVG 엘리먼트
     * @param {Array} config.memories - memory 배열
     * @param {Function} config.calcPosition - 위치 계산 함수
     * @param {Function} config.isRootMemory - root 체크 함수
     * @param {string} config.canonicalRootId - canonical root ID
     * @param {Function} config.onNodeClick - 노드 클릭 핸들러
     */
    const initCanvas = (config) => {
        const { canvas, svg, memories, calcPosition, isRootMemory, canonicalRootId, onNodeClick } = config;
        
        if (!canvas || !svg) {
            console.warn('[editor-canvas] Canvas or SVG element not provided');
            return;
        }

        // SVG 초기화
        svg.innerHTML = '';
        
        // 루트는 논리적 anchor만 유지하고 시각 마커는 그리지 않음
        drawRoot(svg);

        // 메모리 노드들 그리기
        if (Array.isArray(memories)) {
            memories.forEach(node => {
                if (isRootMemory && isRootMemory(node, canonicalRootId)) return;
                
                const nodeEl = drawNode(canvas, node, calcPosition, onNodeClick);
                
                // 브랜치 그리기
                const parentId = node.parentId || canonicalRootId;
                const parent = memories.find(m => m.id === parentId);
                if (parent) {
                    drawBranch(svg, calcPosition(parent), calcPosition(node));
                }
            });
        }

        console.log('[editor-canvas] Tree rendered:', memories?.length || 0, 'nodes');
    };

    /**
     * 캔버스 유틸리티 객체
     */
    const LoveBudEditorCanvas = {
        drawRoot,
        drawBranch,
        drawNode,
        initCanvas,
        // 상수 노출
        constants: {
            ROOT_X,
            ROOT_Y,
            RADIUS_L1,
            RADIUS_L2,
            NODE_WIDTH,
            MIN_ANGLE_GAP
        }
    };

    // 전역 노출
    if (typeof window !== 'undefined') {
        window.LoveBudEditorCanvas = LoveBudEditorCanvas;
    }

    // 모듈 환경 지원
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LoveBudEditorCanvas;
    }

    console.log('[editor-canvas] Canvas rendering utilities loaded v1.0.0');
})();
