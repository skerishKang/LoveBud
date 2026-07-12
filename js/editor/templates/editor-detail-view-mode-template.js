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

                    <div class="detail-info-group is-compact">
                        <label id="detailDateLabel">기억한 날</label>
                        <p id="detailDateText"></p>
                    </div>

                    <div class="detail-info-group is-compact">
                        <label id="detailTagsLabel">감정 태그</label>
                        <div class="tags-container" id="detailTags"></div>
                    </div>

                    <div class="detail-info-group detail-info-group-knowledge">
                        <div class="detail-info-heading-with-copy">
                            <label id="detailEntitySearchLabel">연결된 지식</label>
                            <p class="detail-field-helper" id="detailEntitySearchHelper">인물, 팀, 곡처럼 이 순간과 이어지는 단서를 남겨두면 나중에 다시 찾기 쉬워져요.</p>
                        </div>
                        <div id="detailEntitySearchMount"></div>
                    </div>

                    <div class="detail-info-group">
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

                    <div id="connectExistingCtaSection" class="editor-connect-existing-section" style="display: none;">
                        <p class="editor-connect-section-copy">이미 기록한 순간을 현재 흐름에 이어 붙여요.</p>
                        <button id="connectExistingCtaBtn" type="button" class="editor-action-btn editor-action-btn-secondary">
                            <span class="material-symbols-outlined" aria-hidden="true">link</span>
                            <span class="editor-action-btn-label" id="connectExistingCtaLabel">기존 순간 연결하기</span>
                        </button>
                    </div>

                    <div id="connectExistingPendingSection" class="editor-connect-existing-section" style="display: none;">
                        <p class="editor-connect-pending-hint" id="connectExistingPendingHint">연결할 대상 순간을 클릭해 주세요.</p>
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

                <div class="editor-moment-reactions-card editor-moment-social-card" id="momentReactionsCard" aria-label="순간 반응과 댓글" style="font-variant-numeric:tabular-nums;">
                    <div class="editor-moment-social-head">
                        <div>
                            <div class="editor-section-eyebrow">반응과 댓글</div>
                            <p class="editor-moment-social-copy">이 순간에 남겨진 마음을 바로 확인해요.</p>
                        </div>
                        <div class="editor-moment-reactions-row">
                            <button
                                type="button"
                                class="editor-moment-reaction editor-reaction-like-btn"
                                id="momentLikeBtn"
                                aria-label="좋아요"
                                data-reacted="false"
                            >
                                <span class="editor-reaction-like-icon" aria-hidden="true">♡</span>
                                <span class="editor-reaction-label">좋아요</span>
                                <span class="editor-reaction-like-count" id="momentLikeCount">0</span>
                            </button>
                            <button
                                type="button"
                                class="editor-moment-reaction editor-reaction-comment-btn"
                                id="momentCommentBtn"
                                aria-label="댓글 입력으로 이동"
                                aria-controls="momentCommentInput"
                            >
                                <span class="material-symbols-outlined editor-reaction-comment-icon" aria-hidden="true">chat_bubble</span>
                                <span class="editor-reaction-label">댓글</span>
                                <span class="editor-reaction-comment-count" id="momentCommentCount">0</span>
                            </button>
                        </div>
                    </div>

                    <section id="momentCommentsPanel" class="editor-moment-comments-panel" aria-label="순간 댓글">
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
