(function() {
    const template = `
                <div id="detailEmptyState" class="editor-visible-initial">
                    <div class="editor-empty-state-box">
                        <span class="material-symbols-outlined editor-empty-state-icon">sentiment_satisfied</span>
                        <p id="detailEmptyTitle" class="editor-empty-state-title"></p>
                        <p id="detailEmptyDesc" class="editor-empty-state-desc"></p>
                        <button type="button" id="detailEmptyStartBtn" class="btn-round btn-primary editor-empty-state-cta" tabindex="-1">첫 순간 심기</button>
                    </div>
                </div>
    `;
    const mount = document.getElementById('editorDetailEmptyStateTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }
})();
