(function() {
    'use strict';

    const mount = document.getElementById('editorDetailPanelShellTemplateMount');
    if (!mount) return;

    const panel = document.createElement('aside');
    panel.className = 'detail-panel memory-detail-section reveal-fade';
    panel.id = 'detailPanel';

    const header = document.createElement('div');
    header.className = 'panel-header';

    const heading = document.createElement('h3');
    heading.className = 'headline editor-panel-headline';
    header.appendChild(heading);

    const content = document.createElement('div');
    content.className = 'detail-content';
    content.id = 'detailContent';

    const emptyMount = document.createElement('div');
    emptyMount.id = 'editorDetailEmptyStateTemplateMount';

    const viewMount = document.createElement('div');
    viewMount.id = 'editorDetailViewModeTemplateMount';

    const editMount = document.createElement('div');
    editMount.id = 'editorDetailEditModeTemplateMount';

    content.appendChild(emptyMount);
    content.appendChild(viewMount);
    content.appendChild(editMount);

    panel.appendChild(header);
    panel.appendChild(content);
    mount.replaceWith(panel);

    window.LoveBudPublicViewerDetailPanelShellTemplate = {
        mountId: 'editorDetailPanelShellTemplateMount',
        detailPanelId: 'detailPanel',
        detailContentId: 'detailContent'
    };
})();