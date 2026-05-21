(function() {
    const template = `
                        <div id="canvasEmptyGuide" class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden" aria-live="polite">
                <div class="editor-canvas-empty-guide__icon" id="canvasEmptyGuideIcon" aria-hidden="true">🌱</div>
                <div class="editor-canvas-empty-guide__eyebrow" id="canvasEmptyGuideEyebrow">시작하기</div>
                <h3 class="editor-canvas-empty-guide__title" id="canvasEmptyGuideTitle">이 트리의 첫 순간을 기록해볼까요?</h3>
                <div class="editor-canvas-empty-guide__input-wrap">
                    <label class="sr-only" for="canvasEmptyYoutubeInput" id="canvasEmptyYoutubeLabel">YouTube 링크</label>
                    <input type="url" id="canvasEmptyYoutubeInput" class="editor-canvas-empty-guide__input" placeholder="YouTube 링크를 붙여넣어 첫 순간 심기" autocomplete="off" inputmode="url">
                    <button type="button" id="canvasEmptyStartBtn" class="btn-round btn-primary editor-canvas-empty-guide__cta">첫 순간 심기</button>
                </div>
                <button type="button" id="canvasEmptyTextStartBtn" class="editor-canvas-empty-guide__text-start">텍스트로 시작하기</button>
                <p class="editor-canvas-empty-guide__hint" id="canvasEmptyGuideHint">캔버스를 두 번 클릭해도 새 순간을 시작할 수 있어요.</p>
            </div>
    `;
    const mount = document.getElementById('editorEmptyGuideTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }
})();
