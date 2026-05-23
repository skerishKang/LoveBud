(function() {
    const template = `
            <div id="canvasEmptyGuide" class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden" aria-live="polite">
                <div class="editor-canvas-empty-guide__eyebrow" id="canvasEmptyGuideEyebrow">시작하기</div>
                <h3 class="editor-canvas-empty-guide__title" id="canvasEmptyGuideTitle">이 트리의 첫 순간을 기록해볼까요?</h3>
                <p class="editor-canvas-empty-guide__desc" id="canvasEmptyGuideDesc">소중한 영상이나 글로 시작해보세요.</p>
                
                <div class="editor-canvas-empty-guide__structured">
                    <button type="button" id="canvasEmptyVideoBtn" class="btn-round btn-primary">영상으로 첫 순간 심기</button>
                    <button type="button" id="canvasEmptyTextBtn" class="btn-round btn-outline">텍스트로 첫 순간 심기</button>
                </div>

                <div class="editor-canvas-empty-guide__divider">또는</div>

                <div class="editor-canvas-empty-guide__quick">
                    <label class="sr-only" for="canvasEmptyQuickInput">YouTube 링크 붙여넣기</label>
                    <input type="url" id="canvasEmptyQuickInput" class="editor-canvas-empty-guide__input" placeholder="YouTube 링크를 붙여넣어 바로 시작하기" autocomplete="off" inputmode="url">
                </div>

                <p class="editor-canvas-empty-guide__hint" id="canvasEmptyGuideHint">캔버스를 두 번 클릭해도 새 순간을 시작할 수 있어요.</p>
            </div>
    `;
    const mount = document.getElementById('editorEmptyGuideTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }
})();
