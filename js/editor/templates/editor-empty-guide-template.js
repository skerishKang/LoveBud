/**
 * editor-empty-guide-template.js
 *
 * 빈 러브트리 상태에서 캔버스 중앙에 표시되는 가이드 카드 템플릿.
 *
 * PR #2449 (UX): 첫 순간 CTA 단순화
 * - video/text/YouTube 직접 입력을 가이드 카드에서 제거
 * - primary 1개로 단순화: "첫 순간 만들기" → showAddMemoryForm() 연결
 * - 영상/텍스트/YouTube 입력 경로는 add-memory form에서 선택 (기존 showAddMemoryForm 경로)
 *
 * 외부 진입점 (pages/editor.html):
 *   <script type="module" src="../js/editor/templates/editor-empty-guide-template.js"></script>
 *
 * 보존:
 * - buildEmptyGuideTemplate export (contract test에서 호출)
 * - 기존 mount.outerHTML side effect (DOM id="editorEmptyGuideTemplateMount"에 마운트)
 */

export function buildEmptyGuideTemplate() {
    return `
                        <div id="canvasEmptyGuide" class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden" aria-live="polite">
                <div class="editor-canvas-empty-guide__eyebrow" id="canvasEmptyGuideEyebrow">시작하기</div>
                <h3 class="editor-canvas-empty-guide__title" id="canvasEmptyGuideTitle">이 트리의 첫 순간을 기록해볼까요?</h3>
                <p class="editor-canvas-empty-guide__desc" id="canvasEmptyGuideDesc">영상 링크나 텍스트는 다음 단계에서 선택할 수 있어요.</p>
                <button type="button" id="canvasEmptyStartBtn" class="btn-round btn-primary editor-canvas-empty-guide__primary-cta">첫 순간 만들기</button>
            </div>
    `;
}

const mount = document.getElementById('editorEmptyGuideTemplateMount');
if (mount) {
    mount.outerHTML = buildEmptyGuideTemplate();
}
