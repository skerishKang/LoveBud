(function() {
    'use strict';

    async function runEditorInitialLoadFlow(options) {
        const opts = options || {};
        const editorDataLoader = opts.editorDataLoader || {};
        const log = typeof opts.log === 'function' ? opts.log : function() {};
        const reportError = typeof opts.reportError === 'function' ? opts.reportError : function() {};
        const cache = opts.cache || null;
        let cacheKey = 'memories_default';

        // ── Region loading indicators with 500ms display delay ──
        var loadI18n = opts.i18n || function() { return ''; };
        var regionTimers = {};
        var LONG_WAIT_MS = 8000;

        function showRegionLoading(containerId, className, text) {
            var container = document.getElementById(containerId);
            if (!container) return;
            // If already scheduled or visible, skip
            if (regionTimers[containerId]) return;
            if (container.querySelector('[data-region-loading]')) return;

            // 500ms display delay before showing the indicator.
            // If data arrives before the timer fires, hideRegionLoading
            // clears the timer and no indicator is ever created.
            regionTimers[containerId] = setTimeout(function() {
                // Double-check: container still exists and no loading element yet
                if (!document.getElementById(containerId)) return;
                if (container.querySelector('[data-region-loading]')) return;

                var el = document.createElement('div');
                el.dataset.regionLoading = className;
                el.className = className;
                el.setAttribute('role', 'status');
                el.setAttribute('aria-live', 'polite');

                var spinner = document.createElement('span');
                spinner.className = 'lt-spinner';
                spinner.setAttribute('aria-hidden', 'true');
                el.appendChild(spinner);

                var copySpan = document.createElement('span');
                copySpan.textContent = text;
                el.appendChild(copySpan);

                container.appendChild(el);
                regionTimers[containerId] = null;

                // Long-wait escalation: show plain-language message
                // after LONG_WAIT_MS - 500ms display delay.
                el.dataset.lwTimerId = setTimeout(function() {
                    if (!container.contains(el)) return;
                    el.className = className + ' lt-long-wait';
                    el.removeChild(spinner);
                    el.removeChild(copySpan);
                    var icon = document.createElement('span');
                    icon.className = 'lt-long-wait-icon';
                    icon.textContent = '\u23F3';
                    el.appendChild(icon);
                    var heading = document.createElement('p');
                    heading.className = 'lt-long-wait-heading';
                    heading.textContent = (typeof window.t === 'function') ? window.t('loading.long.wait') : '';
                    el.appendChild(heading);
                }, LONG_WAIT_MS - 500);
            }, 500);
        }

        function hideRegionLoading(containerId) {
            // Cancel pending timer if data arrived before 500ms
            if (regionTimers[containerId]) {
                clearTimeout(regionTimers[containerId]);
                regionTimers[containerId] = null;
            }
            // Remove any existing loading element, clearing any long-wait timer first
            var container = document.getElementById(containerId);
            if (!container) return;
            var els = container.querySelectorAll('[data-region-loading]');
            for (var i = 0; i < els.length; i++) {
                var lwId = els[i].dataset.lwTimerId;
                if (lwId) {
                    clearTimeout(Number(lwId));
                }
                els[i].remove();
            }
        }

        var loadTreeText = (loadI18n('editor_loading_tree') || '트리 정보를 불러오는 중');
        var loadMemText = (loadI18n('editor_loading_memories') || '순간 목록을 불러오는 중');

        const loadInitialTree = editorDataLoader.loadInitialEditorTree;
        if (typeof loadInitialTree !== 'function') {
            reportError('LoveBudEditorDataLoader.loadInitialEditorTree missing');
            return { status: 'stopped' };
        }

        // Show sidebar loading (tree region) with 500ms delay
        showRegionLoading('editorSidebarTemplateMount', 'lt-loading-inline', loadTreeText);

        log('Loading initial tree data...');

        // Wrapped in try/finally so a Promise rejection always cleans up
        var tree, treeId, normalizeMemory, treeMemories, memoriesCount;
        try {
            var treeLoadResult = await loadInitialTree({
                urlTreeId: opts.urlTreeId,
                apiClient: opts.apiClient,
                createDefaultTreeTitle: opts.createDefaultTreeTitle,
                getConfirmedSessionUser: opts.getConfirmedSessionUser
            });

            tree = treeLoadResult.tree || null;
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
            hideRegionLoading('editorSidebarTemplateMount');
            opts.syncCurrentTreeData(tree);
            treeId = tree.id || null;
            cacheKey = 'memories_' + (treeId || 'default');
            log(`Tree loaded: ${treeId}`);

            // Canvas region begins loading (memories list) with 500ms delay
            showRegionLoading('canvasArea', 'lt-loading-compact', loadMemText);

            if (typeof editorDataLoader.createNormalizeMemory !== 'function') {
                reportError('LoveBudEditorDataLoader.createNormalizeMemory missing');
                hideRegionLoading('canvasArea');
                return { status: 'stopped' };
            }
            normalizeMemory = editorDataLoader.createNormalizeMemory({
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

            treeMemories = function() { return (window.currentTreeMemories || []).map(normalizeMemory).filter(Boolean); };
            memoriesCount = treeMemories().length;
            log(`Memories loaded: ${memoriesCount}`);
        } finally {
            // Guarantee cleanup on all paths: success, stopped, rejection
            hideRegionLoading('editorSidebarTemplateMount');
            hideRegionLoading('canvasArea');
        }

        return {
            status: 'ready',
            tree: tree,
            treeId: treeId,
            cache: cache,
            cacheKey: cacheKey,
            normalizeMemory: normalizeMemory,
            treeMemories: treeMemories,
            memoriesCount: memoriesCount
        };
    }

    window.LoveBudEditorInitialLoadFlow = Object.freeze({
        runEditorInitialLoadFlow
    });
})();
