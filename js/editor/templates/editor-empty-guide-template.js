(function() {
    const template = `
                        <div id="canvasEmptyGuide" class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden" aria-live="polite">
                <div class="editor-canvas-empty-guide__eyebrow" id="canvasEmptyGuideEyebrow">시작하기</div>
                <h3 class="editor-canvas-empty-guide__title" id="canvasEmptyGuideTitle">이 트리의 첫 순간을 기록해볼까요?</h3>
                <p class="editor-canvas-empty-guide__desc" id="canvasEmptyGuideDesc">소중한 영상이나 글로 시작해보세요.</p>

                <div class="editor-canvas-empty-guide__structured" aria-label="체계적으로 입력하기">
                    <div class="editor-canvas-empty-guide__section-heading">체계적으로 입력하기</div>
                    <button type="button" id="canvasEmptyVideoBtn" class="btn-round btn-primary editor-canvas-empty-guide__structured-btn">🎬 영상으로 시작하기</button>
                    <button type="button" id="canvasEmptyTextBtn" class="btn-round btn-outline editor-canvas-empty-guide__structured-btn">📝 텍스트로 시작하기</button>
                </div>

                <div class="editor-canvas-empty-guide__divider" aria-hidden="true">또는</div>

                <div class="editor-canvas-empty-guide__quick" aria-label="빠르게 바로 시작하기">
                    <label class="sr-only" for="canvasEmptyQuickInput" id="canvasEmptyQuickLabel">YouTube 링크 붙여넣기</label>
                    <div class="editor-canvas-empty-guide__section-heading">빠르게 바로 시작하기</div>
                    <input type="url" id="canvasEmptyQuickInput" class="editor-canvas-empty-guide__input" placeholder="YouTube 링크 붙여넣기" autocomplete="off" inputmode="url">
                </div>
                <p class="editor-canvas-empty-guide__hint" id="canvasEmptyGuideHint">붙여넣는 순간 바로 생성돼요.</p>
            </div>
    `;
    const mount = document.getElementById('editorEmptyGuideTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }
})();