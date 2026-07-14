(function() {
    const template = `
                <div id="detailViewMode" class="editor-hidden-initial">
                    <div class="editor-tree-meta-section">
                        <div class="editor-section-eyebrow" id="detailTreeStatusLabel">현재 트리</div>
                        <div id="detailTreeMetaMount"></div>
                    </div>

                    <div class="editor-current-moment-card">
                        <div class="editor-current-moment-head">
                            <div id="detailCurrentMomentBadge" class="editor-current-moment-badge">...</div>
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
                        <div class="editor-section-eyebrow" id="detailMomentInfoLabel">...</div>

                        <div class="detail-info-group is-compact" id="detailDateGroup">
                            <label id="detailDateLabel">...</label>
                            <p id="detailDateText"></p>
                        </div>

                        <div class="detail-info-group is-compact" id="detailTagsGroup">
                            <label id="detailTagsLabel">...</label>
                            <div class="tags-container" id="detailTags"></div>
                        </div>

                        <div
                            class="detail-info-group detail-info-group-knowledge"
                            id="detailPublicKnowledgeGroup"
                            hidden
                        >
                            <label id="detailPublicKnowledgeLabel">연결된 지식</label>
                            <ul
                                id="detailPublicKnowledgeList"
                                class="public-viewer-knowledge-list"
                            ></ul>
                        </div>

                        <div class="detail-info-group" id="detailMemoGroup">
                            <label id="detailMemoLabel">...</label>
                            <div class="diary-note" id="detailMemo"></div>
                        </div>
                    </div>

                    <div
                        class="editor-moment-reactions-card is-read-only is-public-readonly"
                        id="momentReactionsCard"
                        aria-label="순간 반응 (읽기 전용)"
                        data-read-only-summary="true"
                        data-social-loading="true"
                        style="font-variant-numeric:tabular-nums;"
                    >
                        <div
                            class="public-viewer-social-status"
                            id="momentReactionLikeStatus"
                            role="status"
                            aria-label="좋아요 불러오는 중"
                        >
                            <span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>
                            <span class="editor-reaction-label">좋아요</span>
                            <span class="public-viewer-social-status-value" id="momentReactionLikeValue">⋯</span>
                        </div>
                        <button type="button" id="momentReactionLikeButton"
                          class="editor-like-button"
                          aria-label="좋아요 누르기"
                          aria-pressed="false"
                          disabled
                          style="display:none"></button>
                        <p id="momentReactionLikeGuestNote" style="display:none">로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.</p>
                        <div aria-live="polite" role="status" id="momentReactionLikeStatusRegion" style="display:none"></div>
                        <p id="momentReactionWriteError" class="editor-like-error" role="alert" style="display:none"></p>
                        <button type="button" id="momentReactionCommentStatus"
                          class="public-viewer-social-status editor-comment-toggle"
                          aria-label="댓글 불러오는 중"
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
                          <p id="momentCommentsPanelStatus" role="status" aria-live="polite"></p>
                          <ul id="momentCommentsList" class="editor-moment-comments-list"></ul>
                        </section>
                        <p class="editor-moment-reaction-readonly-note" id="momentReactionNote">반응 정보를 불러오는 중이에요.</p>
                    </div>
                </div>
    `;
    const mount = document.getElementById('editorDetailViewModeTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }

    window.LoveBudPublicViewerDetailViewModeTemplate = {
        mountId: 'editorDetailViewModeTemplateMount',
        viewModeId: 'detailViewMode'
    };
})();
