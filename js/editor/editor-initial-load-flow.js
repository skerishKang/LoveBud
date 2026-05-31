(function() {
    'use strict';

    async function runEditorInitialLoadFlow(options) {
        const opts = options || {};
        const editorDataLoader = opts.editorDataLoader || {};
        const log = typeof opts.log === 'function' ? opts.log : function() {};
        const reportError = typeof opts.reportError === 'function' ? opts.reportError : function() {};
        const cache = opts.cache || null;
        let cacheKey = 'memories_default';

        const loadInitialTree = editorDataLoader.loadInitialEditorTree;
        if (typeof loadInitialTree !== 'function') {
            reportError('LoveBudEditorDataLoader.loadInitialEditorTree missing');
            return { status: 'stopped' };
        }

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
                opts.markEditorReady();
                return { status: 'stopped' };
            }

            opts.markEditorReady();
            return { status: 'stopped' };
        }

        opts.syncCurrentTreeData(tree);
        const treeId = tree.id || null;
        cacheKey = 'memories_' + (treeId || 'default');
        log(`Tree loaded: ${treeId}`);

        if (typeof editorDataLoader.createNormalizeMemory !== 'function') {
            reportError('LoveBudEditorDataLoader.createNormalizeMemory missing');
            return { status: 'stopped' };
        }
        const normalizeMemory = editorDataLoader.createNormalizeMemory({
            sharedNormalize: opts.sharedNormalize
        });

        if (typeof editorDataLoader.loadEditorMemories !== 'function') {
            reportError('LoveBudEditorDataLoader.loadEditorMemories missing');
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
