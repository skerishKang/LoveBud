export function buildAddMemoryFormTemplate() {
    return `
        <div id="addMemoryForm" class="memory-create-section editor-memory-form-modal">
            <div class="editor-memory-form-body">
                <div class="editor-modal-eyebrow" id="addMemoryFormEyebrow">첫 순간 시작</div>
                <h3 class="headline editor-modal-title" id="addMemoryFormTitle">...</h3>
                <p id="addMemoryFormIntro" class="editor-modal-intro">...</p>
                <div class="editor-memory-mode-group" id="memoryInputModeGroup" aria-label="순간 입력 방식">
                    <button type="button" class="editor-memory-mode-chip is-active" id="memoryModeLinkBtn" data-mode="link">
                        <span class="material-symbols-outlined">smart_display</span>
                        <span>링크로 시작</span>
                    </button>
                    <button type="button" class="editor-memory-mode-chip" id="memoryModeTextBtn" data-mode="text">
                        <span class="material-symbols-outlined">edit_note</span>
                        <span>텍스트로 시작</span>
                    </button>
                </div>
                <div class="editor-form-support-note editor-form-support-note-hidden" id="memoryFormSupportNote" aria-hidden="true">
                    <span class="material-symbols-outlined">info</span>
                    <span id="memoryFormSupportNoteText">YouTube 링크가 있으면 대표 장면이 잡히고, 링크가 없어도 제목과 메모만으로 첫 순간을 시작할 수 있어요.</span>
                </div>
                <div class="editor-form-field editor-form-field-primary" id="memoryUrlField">
                    <label id="memoryUrlLabel" for="memoryUrlInput" class="editor-form-label">...</label>
                    <input type="text" id="memoryUrlInput" placeholder="https://www.youtube.com/watch?v=..." class="editor-form-input">
                </div>
                <div class="editor-video-segment-grid" id="memoryVideoSegmentGrid">
                    <div class="editor-form-field editor-video-segment-field editor-video-segment-field-start" id="memoryStartTimeField">
                        <label id="memoryStartTimeLabel" for="memoryStartTimeInput" class="editor-form-label">시작</label>
                        <input type="text" id="memoryStartTimeInput" placeholder="예: 1:23" class="editor-form-input">
                    </div>
                    <div class="editor-form-field editor-video-segment-field editor-video-segment-field-end" id="memoryEndTimeField">
                        <label id="memoryEndTimeLabel" for="memoryEndTimeInput" class="editor-form-label">끝</label>
                        <input type="text" id="memoryEndTimeInput" placeholder="선택, 예: 1:45" class="editor-form-input">
                    </div>
                    <p id="memoryStartTimeHint" class="editor-form-help editor-video-segment-help">순간의 시작과 끝 시간을 입력하세요.</p>
                </div>
                <div class="memory-link-preview is-hidden" id="memoryLinkPreview" aria-live="polite">
                    <div class="memory-link-preview__thumb-wrap">
                        <img class="memory-link-preview__thumb" id="memoryPreviewThumb" alt="">
                        <div class="memory-link-preview__play-icon material-symbols-outlined">play_circle</div>
                    </div>
                    <div class="memory-link-preview__body">
                        <span class="memory-link-preview__badge" id="memoryPreviewBadge">YouTube</span>
                        <strong class="memory-link-preview__title" id="memoryPreviewTitle">영상 링크가 확인됐어요</strong>
                        <p class="memory-link-preview__hint" id="memoryPreviewHint">이 장면을 트리에 심기 전에 제목과 메모를 다듬어 주세요.</p>
                    </div>
                </div>
                <div class="editor-form-field editor-form-field-grid">
                    <div class="editor-form-stack editor-form-stack-compact">
                        <label id="memoryTitleLabel" for="memoryTitleInput" class="editor-form-label">...</label>
                        <input type="text" id="memoryTitleInput" placeholder="..." class="editor-form-input">
                    </div>
                    <div class="editor-form-stack editor-form-stack-compact">
                        <label id="memoryTagsLabel" for="memoryTagsInput" class="editor-form-label">...</label>
                        <input type="text" id="memoryTagsInput" class="editor-form-input" placeholder="...">
                    </div>
                    <div class="editor-form-stack editor-form-stack-roomy">
                        <label id="memoryMemoLabel" for="memoryMemoInput" class="editor-form-label">...</label>
                        <textarea id="memoryMemoInput" placeholder="..." rows="5" class="editor-form-textarea"></textarea>
                    </div>
                </div>
            </div>
            <div class="editor-form-connect-row" id="connectExistingFromFormRow">
                <button type="button" id="connectExistingFromFormBtn" class="btn-round btn-outline editor-form-connect-entry">
                    <span class="material-symbols-outlined" aria-hidden="true">link</span>
                    <span class="editor-form-connect-entry-label">기존 순간 연결하기</span>
                </button>
            </div>
            <div class="editor-form-actions">
                <button id="cancelAddMemory" class="btn-round btn-outline editor-form-action-btn">...</button>
                <button id="confirmAddMemory" class="btn-round btn-primary editor-form-action-btn">...</button>
            </div>
        </div>
    `;
}

const mount = document.getElementById('addMemoryFormTemplateMount');
if (mount) {
    mount.outerHTML = buildAddMemoryFormTemplate();
}
