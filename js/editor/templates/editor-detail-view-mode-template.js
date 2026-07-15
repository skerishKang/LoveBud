export function buildDetailViewModeTemplate() {
    return `
            <div id="detailViewMode" class="editor-hidden-initial" style="display: none;">
                <div class="editor-tree-meta-section" id="detailTreeMetaSection">
                    <div class="editor-section-eyebrow" id="detailTreeStatusLabel">현재 선택한 순간</div>
                    <div id="detailTreeMetaMount"></div>
                </div>

                <div class="editor-current-moment-card">
                    <div class="editor-current-moment-head">
                        <div id="detailCurrentMomentBadge" class="editor-current-moment-badge">현재 선택한 순간</div>
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

                <div class="editor-moment-info-card">
                    <div class="editor-section-eyebrow" id="detailMomentInfoLabel">기록</div>

                    <div class="detail-info-group is-compact" id="detailDateGroup">
                        <label id="detailDateLabel">기억한 날</label>
                        <p id="detailDateText"></p>
                    </div>

                    <div class="detail-info-group is-compact" id="detailTagsGroup">
                        <label id="detailTagsLabel">감정 태그</label>
                        <div class="tags-container" id="detailTags"></div>
                    </div>

                    <div
                        class="detail-info-group detail-info-group-knowledge"
                        id="detailOwnerKnowledgeGroup"
                        hidden
                    >
                        <label id="detailOwnerKnowledgeLabel">연결된 지식</label>
                        <ul
                            id="detailOwnerKnowledgeList"
                            class="editor-owner-knowledge-list"
                        ></ul>
                    </div>

                    <div class="detail-info-group" id="detailMemoGroup">
                        <label id="detailMemoLabel">감정 메모</label>
                        <div class="diary-note" id="detailMemo"></div>
                    </div>
                </div>

                <div id="detailAtlasPreviewMount" class="editor-memory-atlas-preview-mount" hidden></div>

                <div class="editor-moment-actions-card">
                    <div class="editor-section-eyebrow" id="detailActionsPrimaryLabel">이 순간에서</div>
                    <div class="editor-action-list">
                        <button type="button" class="editor-action-btn editor-action-btn-primary" id="viewMomentDetailBtn">
                            <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                            <span class="editor-action-btn-label" id="viewMomentDetailBtnLabel">현재 순간 감상하기</span>
                        </button>
                        <button type="button" class="editor-action-btn editor-action-btn-secondary" id="continueFromMomentBtn">
                            <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
                            <span class="editor-action-btn-label" id="continueFromMomentBtnLabel">이 순간에서 이어가기</span>
                        </button>
                    </div>

                </div>

                <div
                    class="editor-moment-reactions-card editor-moment-social-card"
                    id="momentReactionsCard"
                    aria-label="순간 반응과 댓글"
                    data-social-state="hidden"
                    style="font-variant-numeric:tabular-nums;"
                >
                    <button
                        type="button"
                        id="momentReactionLikeButton"
                        class="public-viewer-social-status editor-like-button editor-moment-reaction"
                        aria-label="좋아요 누르기"
                        aria-pressed="false"
                        disabled
                    >
                        <span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>
                        <span class="editor-reaction-label">좋아요</span>
                        <span class="public-viewer-social-status-value" id="momentReactionLikeValue">⋯</span>
                    </button>
                    <p id="momentReactionLikeGuestNote" style="display:none">로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.</p>
                    <div aria-live="polite" role="status" id="momentReactionLikeStatusRegion" style="display:none"></div>
                    <p id="momentReactionWriteError" class="editor-like-error" role="alert" style="display:none"></p>
                    <button
                        type="button"
                        id="momentReactionCommentStatus"
                        class="public-viewer-social-status editor-comment-toggle editor-moment-reaction"
                        aria-label="댓글 열기"
                        aria-expanded="false"
                        aria-controls="momentCommentsPanel"
                        disabled
                    >
                        <span class="editor-reaction-comment-icon" aria-hidden="true">💬</span>
                        <span class="editor-reaction-label">댓글</span>
                        <span class="public-viewer-social-status-value" id="momentReactionCommentValue">⋯</span>
                    </button>
                    <section
                      id="momentCommentsPanel"
                      class="editor-moment-comments-panel"
                      aria-label="순간 댓글"
                      hidden
                    >
                        <p id="momentCommentsPanelStatus" class="editor-moment-comments-status" role="status" aria-live="polite">댓글을 불러오는 중이에요.</p>
                        <ul id="momentCommentsList" class="editor-moment-comments-list"></ul>
                        <form id="momentCommentComposer" class="editor-moment-comment-composer">
                            <label for="momentCommentInput">이 순간에 댓글 남기기</label>
                            <div class="editor-moment-comment-input-row">
                                <textarea id="momentCommentInput" rows="2" maxlength="5000" placeholder="이 순간에 떠오른 마음을 남겨보세요."></textarea>
                                <button id="momentCommentSubmitBtn" type="submit" aria-label="댓글 등록">
                                    <span class="material-symbols-outlined" aria-hidden="true">send</span>
                                    <span>등록</span>
                                </button>
                            </div>
                            <p id="momentCommentFeedback" class="editor-moment-comment-feedback" role="status" aria-live="polite"></p>
                        </form>
                    </section>
                </div>
            </div>
    `;
}

const mount = document.getElementById('editorDetailViewModeTemplateMount');
if (mount) {
    mount.outerHTML = buildDetailViewModeTemplate();
}
