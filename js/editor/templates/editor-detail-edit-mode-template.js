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
