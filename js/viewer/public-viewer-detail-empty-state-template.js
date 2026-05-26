(function() {
    'use strict';

    const mount = document.getElementById('editorDetailEmptyStateTemplateMount');
    if (!mount) return;

    const emptyState = document.createElement('div');
    emptyState.id = 'detailEmptyState';
    emptyState.className = 'editor-visible-initial';

    const box = document.createElement('div');
    box.className = 'editor-empty-state-box';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined editor-empty-state-icon';
    icon.textContent = 'sentiment_satisfied';

    const title = document.createElement('p');
    title.id = 'detailEmptyTitle';
    title.className = 'editor-empty-state-title';

    const description = document.createElement('p');
    description.id = 'detailEmptyDesc';
    description.className = 'editor-empty-state-desc';

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.id = 'detailEmptyStartBtn';
    startButton.className = 'btn-round btn-primary editor-empty-state-cta';
    startButton.tabIndex = -1;
    startButton.textContent = '첫 순간 심기';

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(description);
    box.appendChild(startButton);
    emptyState.appendChild(box);
    mount.replaceWith(emptyState);

    window.LoveBudPublicViewerDetailEmptyStateTemplate = {
        mountId: 'editorDetailEmptyStateTemplateMount',
        emptyStateId: 'detailEmptyState',
        startButtonId: 'detailEmptyStartBtn'
    };
})();
