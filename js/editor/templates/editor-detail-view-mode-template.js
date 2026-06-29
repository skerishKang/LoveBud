export function buildDetailViewModeTemplate() {
    return `
            <div id="detailViewMode" class="editor-hidden-initial" style="display: none;">
                <div class="editor-tree-meta-section" aria-hidden="true">
                    <div class="editor-section-eyebrow" id="detailTreeStatusLabel">현재 트리</div>
                    <div id="detailTreeMetaMount"></div>
                </div>

                <div class="editor-current-moment-card">
                    <div class="editor-current-moment-head">
                        <div id="detailCurrentMomentBadge" class="editor-current-moment-badge">...</div>
                        <button type="button" class="editor-moment-edit-chip" id="editMemoryBtn" aria-label="순간 수정">
                            <span class="editor-action-btn-label" id="editMemoryBtnLabel">순간 수정</span>
                        </button>
                    </div>
                    <h4 id="detailCurrentMomentTitle" class="editor-current-moment-title">&nbsp;</h4>
                    <p id="detailCurrentMomentHint" class="editor-current-moment-hint">&nbsp;</p>
                    <div class="detail-video">
                        <img id="detailImg" src="" alt="">
                        <div class="memory-preview-overlay">
                            <button type="button" class="play-btn" aria-label="재생">재생</button>
                        </div>
                    </div>
                </div>

                <div class="editor-moment-actions-card">
                    <div class="editor-section-eyebrow" id="detailActionsPrimaryLabel">감상</div>
                    <div class="editor-action-list">
                        <button type="button" class="editor-action-btn editor-action-btn-primary" id="viewMomentDetailBtn">
                            <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                            <span class="editor-action-btn-label" id="viewMomentDetailBtnLabel">이 순간 감상하기</span>
                        </button>
                        <button type="button" class="editor-action-btn editor-action-btn-secondary" id="continueFromMomentBtn">
                            <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
                            <span class="editor-action-btn-label" id="continueFromMomentBtnLabel">이 순간에서 이어가기</span>
                        </button>
                    </div>
                </div>

                <div class="editor-moment-info-card">
                    <div class="editor-section-eyebrow" id="detailMomentInfoLabel">...</div>

                    <div class="detail-info-group is-compact">
                        <label id="detailDateLabel">...</label>
                        <p id="detailDateText"></p>
                    </div>

                    <div class="detail-info-group is-compact">
                        <label id="detailTagsLabel">...</label>
                        <div class="tags-container" id="detailTags"></div>
                    </div>

                    <div class="detail-info-group">
                        <label id="detailMemoLabel">...</label>
                        <div class="diary-note" id="detailMemo"></div>
                    </div>
                </div>

                <div id="detailAtlasPreviewMount" class="editor-memory-atlas-preview-mount" hidden></div>

                <div class="editor-moment-reactions-card" id="momentReactionsCard" aria-label="순간 반응" style="font-variant-numeric:tabular-nums;">
                    <button
                        type="button"
                        class="editor-moment-reaction editor-reaction-like-btn"
                        id="momentLikeBtn"
                        aria-label="좋아요"
                        data-reacted="false"
                    >
                        <span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>
                        <span class="editor-reaction-label">좋아요</span>
                        <span class="editor-reaction-like-count" id="momentLikeCount">0</span>
                    </button>
                    <button
                        type="button"
                        class="editor-moment-reaction editor-reaction-comment-btn"
                        id="momentCommentBtn"
                        aria-label="댓글 보기"
                    >
                        <span class="editor-reaction-comment-icon" aria-hidden="true">💬</span>
                        <span class="editor-reaction-label">댓글</span>
                        <span class="editor-reaction-comment-count" id="momentCommentCount">0</span>
                    </button>
                </div>

                <div class="editor-save-status-card">
                    <div id="saveStatusIndicator" class="save-status-indicator save-status editor-save-status-wrap" aria-live="polite">
                        <span id="saveStatusIcon" class="editor-save-status-icon-hidden"></span>
                        <span id="saveStatusText">저장됨</span>
                        <span id="lastSavedTime" class="last-saved-time"></span>
                    </div>
                </div>
            </div>
    `;
}

const mount = document.getElementById('editorDetailViewModeTemplateMount');
if (mount) {
    mount.outerHTML = buildDetailViewModeTemplate();
}
// cache bust
