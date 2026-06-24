export function buildDetailEditModeTemplate() {
    return `
            <div id="detailEditMode" class="editor-hidden-initial" style="display: none;">
                <div class="editor-form-stack editor-form-stack-compact">
                    <label id="editTitleLabel" class="editor-form-label">...</label>
                    <input type="text" id="editTitleInput" class="editor-form-input" placeholder="...">
                </div>

                <div class="editor-form-stack editor-form-stack-roomy" style="margin-top: 12px;">
                    <label id="editMemoLabel" class="editor-form-label">...</label>
                    <textarea id="editMemoInput" rows="4" class="editor-form-textarea" placeholder="..."></textarea>
                </div>

                <div class="editor-form-stack editor-form-stack-compact" style="margin-top: 12px;">
                    <label id="editTagsLabel" class="editor-form-label">...</label>
                    <input type="text" id="editTagsInput" class="editor-form-input" placeholder="...">
                </div>

                <div class="editor-form-actions" style="margin-top: 12px;">
                    <button id="cancelEditBtn" class="btn-round btn-outline editor-form-action-btn">...</button>
                    <button id="saveEditBtn" class="btn-round btn-primary editor-form-action-btn">...</button>
                </div>

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

                <div class="detail-actions editor-delete-row">
                    <button id="deleteMemoryBtn" class="editor-delete-link">...</button>
                </div>
            </div>
    `;
}

const mount = document.getElementById('editorDetailEditModeTemplateMount');
if (mount) {
    mount.outerHTML = buildDetailEditModeTemplate();
}
