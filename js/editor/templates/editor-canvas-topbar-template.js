export function buildCanvasTopbarTemplate() {
    return `
            <div class="editor-canvas-topbar" aria-label="러브트리 캔버스 도구">
                
                <div class="editor-canvas-toolbar" role="toolbar" aria-label="트리 화면 조정">
                    <div class="editor-canvas-toolbar-group" aria-label="화면 줌 컨트롤">
                        <button type="button" class="editor-canvas-tool-btn" id="zoomOutCanvasBtn" aria-label="축소" title="축소">
                            <span class="material-symbols-outlined" aria-hidden="true">zoom_out</span>
                        </button>
                        <span class="editor-canvas-zoom-indicator is-hidden" id="zoomIndicator" aria-live="polite" aria-atomic="true">100%</span>
                        <button type="button" class="editor-canvas-tool-btn" id="zoomInCanvasBtn" aria-label="확대" title="확대">
                            <span class="material-symbols-outlined" aria-hidden="true">zoom_in</span>
                        </button>
                    </div>
                    <div class="editor-canvas-toolbar-separator" aria-hidden="true"></div>
                    <div class="editor-canvas-toolbar-group" aria-label="트리 뷰 컨트롤">
                        <button type="button" class="editor-canvas-tool-btn editor-canvas-tool-btn-wide" id="recenterCanvasBtn" aria-label="트리 한눈에 보기" title="트리 한눈에 보기">
                            <span class="material-symbols-outlined" aria-hidden="true">fit_screen</span>
                            <span class="editor-canvas-tool-label" id="recenterCanvasBtnLabel">트리 한눈에 보기</span>
                        </button>
                        <button type="button" class="editor-canvas-tool-btn editor-canvas-tool-btn-wide" id="focusSelectedBtn" aria-label="선택한 순간 보기" title="선택한 순간 보기" disabled>
                            <span class="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
                            <span class="editor-canvas-tool-label" id="focusSelectedBtnLabel">선택한 순간 보기</span>
                        </button>
                    </div>
                    <div class="editor-canvas-toolbar-separator" aria-hidden="true"></div>
                    <div class="editor-canvas-toolbar-group" aria-label="레이아웃 모드">
                        <button type="button" class="editor-canvas-tool-btn editor-canvas-tool-btn-wide is-active" id="layoutModeToggleBtn" aria-pressed="true" aria-label="현재 정리된 트리, 자유 배치로 전환" title="현재 정리된 트리, 자유 배치로 전환">
                            <span class="material-symbols-outlined" aria-hidden="true" id="layoutModeToggleIcon">account_tree</span>
                            <span class="editor-canvas-tool-label" id="layoutModeToggleLabel">정리된 트리</span>
                        </button>
                    </div>
                    <div class="editor-canvas-toolbar-separator" aria-hidden="true"></div>
                    <div class="editor-canvas-toolbar-group" aria-label="표시 옵션">
                        <button type="button" class="editor-canvas-tool-btn editor-canvas-tool-btn-wide" id="compactModeToggleBtn" aria-pressed="false" aria-label="현재 상세 보기, 간략 보기로 전환" title="현재 상세 보기, 간략 보기로 전환">
                            <span class="material-symbols-outlined" aria-hidden="true">unfold_more</span>
                            <span class="editor-canvas-tool-label" id="compactModeToggleLabel">상세 보기</span>
                        </button>
                    </div>
                    <div class="editor-canvas-toolbar-separator" aria-hidden="true"></div>
                    <div class="editor-canvas-toolbar-group" aria-label="도움말">
                        <button type="button" class="editor-canvas-tool-btn editor-canvas-tool-btn-wide" id="editorShortcutHelpBtn" aria-label="단축키 안내" title="단축키 안내" aria-haspopup="dialog" aria-expanded="false" aria-controls="editorShortcutHelpModal">
                            <span class="material-symbols-outlined" aria-hidden="true">keyboard</span>
                            <span class="editor-canvas-tool-label">단축키</span>
                        </button>
                    </div>
                </div>
            </div>
    `;
}

const mount = document.getElementById('editorCanvasTopbarTemplateMount');
if (mount) {
    mount.outerHTML = buildCanvasTopbarTemplate();
}
