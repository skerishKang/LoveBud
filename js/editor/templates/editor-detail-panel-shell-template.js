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

                <div id="connectExistingCtaSection" class="editor-connect-existing-section" style="display: none;">
                    <button id="connectExistingCtaBtn" type="button" class="editor-action-btn editor-action-btn-secondary">
                        <span class="material-symbols-outlined" aria-hidden="true">link</span>
                        <span class="editor-action-btn-label" id="connectExistingCtaLabel">기존 순간 연결하기</span>
                    </button>
                </div>

                <div id="connectExistingPendingSection" class="editor-connect-existing-section" style="display: none;">
                    <p class="editor-connect-pending-hint" id="connectExistingPendingHint">연결할 대상 순간을 클릭하세요</p>
                    <div class="editor-connect-pending-actions">
                        <button id="connectExistingCancelBtn" type="button" class="btn-round btn-outline editor-form-action-btn">취소</button>
                    </div>
                </div>

                <div id="connectExistingConfirmSection" class="editor-connect-existing-section" style="display: none;">
                    <p class="editor-connect-confirm-hint" id="connectExistingConfirmHint">이 순간으로 연결할까요?</p>
                    <div class="editor-connect-confirm-actions">
                        <button id="connectExistingConfirmBtn" type="button" class="btn-round btn-primary editor-form-action-btn">연결</button>
                        <button id="connectExistingConfirmCancelBtn" type="button" class="btn-round btn-outline editor-form-action-btn">다시 선택</button>
                    </div>
                </div>
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