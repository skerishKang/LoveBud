(function() {
    const template = `
                <div id="detailViewMode" class="editor-hidden-initial">
                    <div class="editor-tree-meta-section" aria-hidden="true">
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

                    <div
                        class="editor-moment-reactions-card is-read-only is-public-readonly"
                        id="momentReactionsCard"
                        aria-label="순간 반응"
                        data-read-only-summary="true"
                        style="font-variant-numeric:tabular-nums;"
                    >
                        <div
                            class="editor-moment-reaction editor-reaction-like-btn editor-reaction-stat"
                            id="momentLikeBtn"
                            aria-label="좋아요 0"
                        >
                            <span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>
                            <span class="editor-reaction-label">좋아요</span>
                            <span class="editor-reaction-like-count" id="momentLikeCount">0</span>
                        </div>
                        <div
                            class="editor-moment-reaction editor-reaction-comment-btn editor-reaction-stat"
                            id="momentCommentBtn"
                            aria-label="댓글 0"
                        >
                            <span class="editor-reaction-comment-icon" aria-hidden="true">💬</span>
                            <span class="editor-reaction-label">댓글</span>
                            <span class="editor-reaction-comment-count" id="momentCommentCount">0</span>
                        </div>
                        <p class="editor-moment-reaction-readonly-note">반응 기능은 준비 중이에요.</p>
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
