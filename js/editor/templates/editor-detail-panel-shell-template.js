(function() {
    const template = `
        <aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel">
            <div class="panel-header">
                <h3 class="headline editor-panel-headline"></h3>
            </div>

            <div class="detail-content" id="detailContent">
                <div id="editorDetailEmptyStateTemplateMount"></div>

                <div id="editorDetailViewModeTemplateMount"></div>

                <div id="editorDetailEditModeTemplateMount"></div>
            </div>

        </aside>
    `;
    const mount = document.getElementById('editorDetailPanelShellTemplateMount');
    if (mount) {
        mount.outerHTML = template;
    }
})();
