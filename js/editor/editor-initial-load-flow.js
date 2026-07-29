(function() {
    'use strict';

    async function runEditorInitialLoadFlow(options) {
        const opts = options || {};
        const editorDataLoader = opts.editorDataLoader || {};
        const log = typeof opts.log === 'function' ? opts.log : function() {};
        const reportError = typeof opts.reportError === 'function' ? opts.reportError : function() {};
        const cache = opts.cache || null;
        let cacheKey = 'memories_default';

        // ── Region loading indicators ──
        var i18n = opts.i18n || function() { return ''; };

        function showRegionLoading(containerId, className, text) {
            var container = document.getElementById(containerId);
            if (!container) return;
            var existing = container.querySelector('[data-region-loading]');
            if (existing) return;
            var el = document.createElement('div');
            el.dataset.regionLoading = className;
            el.className = className;
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = '<span class="lt-spinner" aria-hidden="true"></span> <span>' + text + '</span>';
            container.appendChild(el);
        }

        function hideRegionLoading(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;
            var els = container.querySelectorAll('[data-region-loading]');
            for (var i = 0; i < els.length; i++) {
                els[i].remove();
            }
        }

        var loadTreeText = (i18n('editor_loading_tree') || '\uD2B8\uB9AC \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911');
        var loadMemText = (i18n('editor_loading_memories') || '\uC21C\uAC04 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911');

        const loadInitialTree = editorDataLoader.loadInitialEditorTree;
        if (typeof loadInitialTree !== 'function') {
            reportError('LoveBudEditorDataLoader.loadInitialEditorTree missing');
            return { status: 'stopped' };
        }

        // Show sidebar loading (tree region) only after confirming data loader exists
        showRegionLoading('editorSidebarTemplateMount', 'lt-loading-inline', loadTreeText);

        log('Loading initial tree data...');
        const treeLoadResult = await loadInitialTree({
            urlTreeId: opts.urlTreeId,
            apiClient: opts.apiClient,
            createDefaultTreeTitle: opts.createDefaultTreeTitle,
            getConfirmedSessionUser: opts.getConfirmedSessionUser
        });

        const tree = treeLoadResult.tree || null;
        if (!tree) {
            log('Tree not found or auth required');
            if (treeLoadResult.authRequired) {
                opts.showToast(opts.i18n('need_login'), 'error');
                opts.redirectToEditorLogin(2000);
                hideRegionLoading('editorSidebarTemplateMount');
                return { status: 'stopped' };
            }

            if (opts.urlTreeId) {
                const treeLoadStatus = treeLoadResult.treeLoadStatus || 'not_found';
                const treeLoadErrorMessage = treeLoadResult.treeLoadErrorMessage || '';
                const treeLoadErrorCopy = opts.buildTreeLoadErrorCopy({
                    treeLoadStatus,
                    treeLoadErrorMessage,
                    i18n: opts.i18n
                });

                opts.renderTreeLoadError({
                    canvas: opts.canvas,
                    addBtn: opts.addBtn,
                    errorTitle: treeLoadErrorCopy.errorTitle,
                    errorDesc: treeLoadErrorCopy.errorDesc,
                    i18n: opts.i18n,
                    escapeHtml: opts.escapeHtml,
                    setDetailEmptyState: null
                });
                hideRegionLoading('editorSidebarTemplateMount');
                opts.markEditorReady();
                return { status: 'stopped' };
            }

            hideRegionLoading('editorSidebarTemplateMount');
            opts.markEditorReady();
            return { status: 'stopped' };
        }

        // Tree loaded — sidebar region transitions from LOADING to READY
        // Canvas region begins loading (memories list)
        hideRegionLoading('editorSidebarTemplateMount');
        opts.syncCurrentTreeData(tree);
        const treeId = tree.id || null;
        cacheKey = 'memories_' + (treeId || 'default');
        log(`Tree loaded: ${treeId}`);
        showRegionLoading('canvasArea', 'lt-loading-compact', loadMemText);

        if (typeof editorDataLoader.createNormalizeMemory !== 'function') {
            reportError('LoveBudEditorDataLoader.createNormalizeMemory missing');
            hideRegionLoading('canvasArea');
            return { status: 'stopped' };
        }
        const normalizeMemory = editorDataLoader.createNormalizeMemory({
            sharedNormalize: opts.sharedNormalize
        });

        if (typeof editorDataLoader.loadEditorMemories !== 'function') {
            reportError('LoveBudEditorDataLoader.loadEditorMemories missing');
            hideRegionLoading('canvasArea');
            return { status: 'stopped' };
        }

        log('Loading editor memories...');
        await editorDataLoader.loadEditorMemories({
            treeId,
            cache,
            cacheKey,
            apiClient: opts.apiClient,
            showToast: opts.showToast,
            i18n: opts.i18n,
            normalizeMemory
        });

        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory).filter(Boolean);
        const memoriesCount = treeMemories().length;
        hideRegionLoading('canvasArea');
        log(`Memories loaded: ${memoriesCount}`);

        return {
            status: 'ready',
            tree,
            treeId,
            cache,
            cacheKey,
            normalizeMemory,
            treeMemories,
            memoriesCount
        };
    }

    window.LoveBudEditorInitialLoadFlow = Object.freeze({
        runEditorInitialLoadFlow
    });
})();
