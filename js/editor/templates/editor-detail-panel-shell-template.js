// Cache-bust marker for editor sidebar/detail polish.
export function buildDetailPanelShellTemplate() {
    return `
        <aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel" data-editor-rail="right">
            <div class="panel-header">
                <h3 class="headline editor-panel-headline"></h3>
                <button
                  type="button"
                  id="editorRightRailCollapseBtn"
                  class="editor-rail-collapse-btn"
                  data-editor-rail-collapse="right"
                  aria-controls="detailPanel"
                  aria-expanded="true"
                  data-i18n-aria-label="editor_rail_hide_moment"
                  data-i18n-title="editor_rail_hide_moment"
                  aria-label="순간 패널 숨기기"
                  title="순간 패널 숨기기"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">right_panel_close</span>
                  <span class="editor-rail-collapse-label" data-i18n="editor_rail_hide_moment_short">숨기기</span>
                </button>
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
