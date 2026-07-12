// Cache-bust marker for editor sidebar/detail polish.
export function buildDetailPanelShellTemplate() {
    return `
        <aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel">
            <div class="panel-header">
                <h3 class="headline editor-panel-headline"></h3>
            </div>

            <div class="detail-content" id="detailContent">
                <div id="editorDetailEmptyStateTemplateMount"></div>

                <div id="editorDetailViewModeTemplateMount"></div>

                <div id="editorDetailEditModeTemplateMount"></div>

            </div>

            <div id="editorMemoryFormContext" class="editor-memory-form-context" aria-hidden="true">
                <div class="editor-memory-form-context-icon" aria-hidden="true">
                    <span class="material-symbols-outlined">edit_note</span>
                </div>
                <div class="editor-section-eyebrow">새 순간 기록 중</div>
                <h4>지금 이어지는 마음에 집중해요</h4>
                <p>가운데에서 순간의 제목과 감정 메모를 남기면, 저장 뒤 이곳에 기록과 댓글이 정리돼요.</p>
            </div>

            <div class="editor-save-status-card">
                <div id="saveStatusIndicator" class="save-status-indicator save-status editor-save-status-wrap" aria-live="polite">
                    <span id="saveStatusIcon" class="editor-save-status-icon-hidden"></span>
                    <span id="saveStatusText">저장됨</span>
                    <span id="lastSavedTime" class="last-saved-time"></span>
                </div>
            </div>

        </aside>
    `;
}

const mount = document.getElementById('editorDetailPanelShellTemplateMount');
if (mount) {
    mount.outerHTML = buildDetailPanelShellTemplate();
}
