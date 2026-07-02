(function() {
    'use strict';

    function escapeHtml(v) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(v);
        return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    function renderShell(container, viewerData) {
        if (!container || !viewerData || !viewerData.tree) return;

        var treeTitle = viewerData.tree.title;
        var treeMetaText = viewerData.tree.meta;

        container.innerHTML =
            '<header class="vv-header">' +
            '  <div><p class="vv-eyebrow">Public LoveTree Viewer</p>' +
            '  <h1 class="vv-title">' + escapeHtml(treeTitle) + '</h1>' +
            '  <div class="vv-meta-row"><span>' + escapeHtml(viewerData.tree.creator) + '</span><span class="vv-dot">·</span><span>' + escapeHtml(treeMetaText) + '</span></div></div>' +
            '  <div class="vv-header-actions">' +
            '    <button type="button" class="vv-layout-toggle" data-action="toggle-layout" aria-label="&#xB808;&#xC774;&#xC544;&#xC6B0;&#xCDE8; &#xC804;&#xD658;" title="&#xB808;&#xC774;&#xC544;&#xC6B0;&#xCDE8; &#xC804;&#xD658;">' +
            '      <span class="vv-layout-toggle-label" id="vvLayoutToggleLabel">&#xAD6C;&#xC870; &#xBCF4;&#xAE30;</span>' +
            '    </button>' +
            '  </div>' +
            '</header>' +
            '<div class="vv-action-dock">' +
            '  <div class="vv-action-group">' +
            '    <button type="button" class="vv-action-btn" data-action="toggle-like" aria-label="트리 좋아요"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon vv-icon-heart"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>' +
            '    좋아요</button>' +
            '    <button type="button" class="vv-action-btn" data-action="open-tree-comments" aria-label="트리 댓글 보기"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>' +
            '    댓글</button>' +
            '    <button type="button" class="vv-action-btn" data-action="open-share" aria-label="트리 공유하기"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M8.1 12.7 15.9 17M15.9 7 8.1 11.3M6.4 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm10.9-5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm0 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>' +
            '    공유</button>' +
            '  </div>' +
            '</div>' +
            '<div class="vv-viewer-layout">' +
            '  <div class="vv-tree-container"></div>' +
            '  <div class="vv-panel-host"></div>' +
            '</div>';
    }

    /**
     * Render a minimal fallback shell when a confirmed Neon hub snapshot is
     * missing or corrupted.  Produces the same visual shell as renderShell(),
     * but uses hardcoded deterministic defaults and marks the tree area with
     * a data attribute so consumers can detect the fallback.
     *
     * @param {Element} container - The container element to render into
     * @param {Object}  viewerData - Fallback viewerData (from State.createDeterministicFallbackData)
     */
    function renderFallbackShell(container, viewerData) {
        if (!container) return;
        renderShell(container, viewerData || { tree: { title: '\uB7EC\uBE0C\uD2B8\uB9AC', creator: '@lovetree_viewer', meta: '' } });
        var treeBox = container.querySelector('.vv-tree-container');
        if (treeBox) {
            treeBox.setAttribute('data-fallback', 'neon-snapshot');
        }
    }

    window.LoveBudViewerShellRender = {
        renderShell: renderShell,
        renderFallbackShell: renderFallbackShell,
        escapeHtml: escapeHtml
    };
})();
