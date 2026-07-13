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
