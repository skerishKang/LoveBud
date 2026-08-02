/**
 * LoveBud - My Trees Story View (thin surface adapter)
 * Issue #3811 (parent #3654). Prerequisite: #3813 / PR #3819 (shared
 * controller surface-adapter boundary).
 *
 * This module is a THIN adapter over the shared `window.LoveBudBrowseStoryView`.
 * It never copies the Browse controller, never creates a second Story
 * grouping/navigation/transition authority, never performs backend pagination,
 * never guesses controller internals via DOM polling, and never binds per-card
 * listeners.
 *
 * Responsibilities:
 *  - lazily initialize the shared controller against #trees-grid (which is
 *    mounted only after a successful owner-list render) and
 *    #myTreesStoryNavMount
 *  - My Trees-specific surface translation (i18n-my-trees.js `myTrees.story.*`)
 *  - Story entry at the currently selected tree's group (or group 1)
 *  - on the settled onGroupChange snapshot: sync selected-tree + desktop
 *    preview hub (mobile never auto-opens the bottom sheet and never navigates
 *    to the editor from a Story group change)
 *  - result replacement in the same task as renderTrees:
 *    refresh({ preferredTreeId }) clamps to a valid group
 *  - Story rail visible only in the loaded-with-cards state
 *  - destroy() releases all listeners/observers/callbacks
 */
(function () {
    'use strict';

    var STORY_MODE = 'story';
    var MOBILE_MAX_WIDTH = 768;

    function resolveElement(sel) {
        if (typeof sel === 'string') return document.querySelector(sel);
        return sel;
    }

    function createMyTreesStoryAdapter(options) {
        var opts = options || {};
        var gridSelector = opts.grid || '#trees-grid';
        var navMountSelector = opts.navMount || '#myTreesStoryNavMount';
        var stateModule = opts.stateModule || window.LoveBudMyTreesState || null;
        var previewHub = opts.previewHub || window.LoveBudMyTreesPreviewHub || null;

        var grid = null;
        var navMount = null;
        var adapterGrid = null;
        var controller = null;
        var active = false;
        var pendingStory = false;
        var disposed = false;
        var lastKnownIds = [];
        var originalRenderTrees = null;
        var railObserver = null;

        /* ── surface translation: semantic keys → i18n-my-trees.js ──── */
        var SEMANTIC_TO_MY_TREES_KEY = {
            'story.regionLabel': 'myTrees.story.regionLabel',
            'story.previous': 'myTrees.story.previous',
            'story.next': 'myTrees.story.next',
            'story.label': 'myTrees.story.label',
            'story.position': 'myTrees.story.position'
        };

        function translate(semanticKey, locale) {
            var dict = window.i18nMyTrees || null;
            var myKey = SEMANTIC_TO_MY_TREES_KEY[semanticKey];
            var entry = dict && myKey ? dict[myKey] : null;
            if (entry && typeof entry === 'object') {
                var value = entry[locale] || entry.ko;
                if (typeof value === 'string' && value.length > 0) return value;
            }
            return null;
        }

        /* ── selection / preview coordination ───────────────────────── */
        function isMobile() {
            return window.innerWidth <= MOBILE_MAX_WIDTH;
        }

        function collectCardIds() {
            if (!grid) return [];
            var cards = grid.querySelectorAll('.tree-card[data-tree-id]');
            var ids = [];
            for (var i = 0; i < cards.length; i++) {
                ids.push(cards[i].getAttribute('data-tree-id'));
            }
            return ids;
        }

        function sameIdSet(a, b) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }

        function findTreeById(treeId) {
            if (!stateModule || typeof stateModule.getLastTreesData !== 'function') return null;
            var trees = stateModule.getLastTreesData();
            if (!Array.isArray(trees)) return null;
            for (var i = 0; i < trees.length; i++) {
                if (trees[i] && String(trees[i].id) === String(treeId)) return trees[i];
            }
            return null;
        }

        function currentSelectedTreeId() {
            if (stateModule && typeof stateModule.getSelectedTreeId === 'function') {
                var id = stateModule.getSelectedTreeId();
                if (id) return id;
            }
            if (previewHub && typeof previewHub.getSelectedTree === 'function') {
                var tree = previewHub.getSelectedTree();
                if (tree && tree.id) return tree.id;
            }
            return null;
        }

        /* Visual reflection only — mirrors the preview hub's own card
         * highlight classes. Never decides which tree is selected. */
        function syncCardHighlight(treeId) {
            if (!grid) return;
            var cards = grid.querySelectorAll('.tree-card[data-tree-id]');
            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                var matches = card.getAttribute('data-tree-id') === String(treeId);
                card.classList.toggle('is-selected', matches);
                card.classList.toggle('is-active', matches);
                if (matches) {
                    card.setAttribute('data-selected-tree-card', 'true');
                } else {
                    card.removeAttribute('data-selected-tree-card');
                }
            }
        }

        /* Desktop: reuse the existing canonical card-click/selection path so
         * the preview hub stays authoritative. Mobile: update only the
         * selected-tree state + card highlight — never open the bottom sheet
         * and never navigate to the editor from a Story group change. */
        function setSelectedTree(tree) {
            if (!tree) return;
            if (isMobile()) {
                if (stateModule && typeof stateModule.setSelectedTreeId === 'function') {
                    stateModule.setSelectedTreeId(tree.id);
                }
                syncCardHighlight(tree.id);
                return;
            }
            if (previewHub && typeof previewHub.onCardClick === 'function') {
                previewHub.onCardClick(tree, { skipScroll: true });
            }
        }

        function onGroupChange(snapshot) {
            if (disposed || !active) return;
            if (!snapshot) return;
            var currentIds = collectCardIds();
            var setChanged = !sameIdSet(lastKnownIds, currentIds);
            lastKnownIds = currentIds;
            if (setChanged) {
                /* Result-set replacement: preserve the selected tree's group
                 * through the supported refresh({ preferredTreeId })
                 * boundary. If the selected tree is gone, the controller
                 * clamps to a valid group and the converged notification
                 * re-syncs selection to the first visible card. */
                if (controller && typeof controller.refresh === 'function') {
                    controller.refresh({ preferredTreeId: currentSelectedTreeId() || undefined });
                }
                return;
            }
            if (snapshot.firstVisibleTreeId) {
                var tree = findTreeById(snapshot.firstVisibleTreeId);
                if (tree) setSelectedTree(tree);
            }
        }

        /* ── controller lifecycle (lazy; grid mounts after a render) ── */
        function ensureController(targetGrid) {
            if (controller) return true;
            if (!targetGrid) targetGrid = grid;
            if (!targetGrid) return false;
            navMount = navMount || resolveElement(navMountSelector);
            if (!navMount) return false;
            grid = targetGrid;
            adapterGrid = targetGrid;
            controller = window.LoveBudBrowseStoryView.init({
                results: grid,
                navMount: navMount,
                translate: translate,
                onGroupChange: onGroupChange
            });
            if (controller) {
                lastKnownIds = collectCardIds();
            }
            return !!controller;
        }

        function destroyController() {
            if (controller && typeof controller.destroy === 'function') {
                try { controller.destroy(); } catch (e) { /* contained */ }
            }
            controller = null;
            adapterGrid = null;
            lastKnownIds = [];
        }

        function activateStoryMode() {
            if (disposed) return;
            if (!ensureController()) return;
            pendingStory = false;
            active = true;
            lastKnownIds = collectCardIds();
            controller.setMode(STORY_MODE, { initialTreeId: currentSelectedTreeId() || undefined });
        }

        function leaveStoryMode() {
            pendingStory = false;
            active = false;
            if (controller) {
                controller.setMode('compact');
            }
        }

        /* ── result replacement: same-task refresh ──────────────────── */
        function afterRender() {
            if (disposed) return;
            var currentGrid = resolveElement(gridSelector);
            if (!currentGrid) return;
            if (controller && adapterGrid !== currentGrid) {
                /* #trees-grid was remounted (e.g. the search-empty state was
                 * cleared and a fresh grid was created): re-initialize the
                 * shared controller against the new node so no stale DOM
                 * reference is held. */
                destroyController();
            }
            if (!controller) {
                ensureController(currentGrid);
            }
            if (pendingStory && !active) {
                activateStoryMode();
            }
            if (controller && active) {
                controller.refresh({ preferredTreeId: currentSelectedTreeId() || undefined });
            }
        }

        function patchRenderTrees() {
            var renderModule = window.LoveBudMyTreesRender;
            if (!renderModule || typeof renderModule.renderTrees !== 'function') return;
            if (renderModule.__myTreesStoryPatched) return;
            originalRenderTrees = renderModule.renderTrees;
            renderModule.__myTreesStoryPatched = true;
            renderModule.renderTrees = function (trees, options) {
                var result = originalRenderTrees.apply(this, arguments);
                try { afterRender(); } catch (e) { /* contained */ }
                return result;
            };
        }

        /* ── Story rail visibility: loaded-with-cards only ──────────── */
        function syncRailVisibility() {
            if (!navMount) return;
            var stateLoadedEl = resolveElement('#state-loaded');
            var gridNow = resolveElement(gridSelector);
            var loadedVisible = stateLoadedEl && !stateLoadedEl.hidden;
            var hasCards = gridNow && gridNow.querySelectorAll('.tree-card[data-tree-id]').length > 0;
            var visible = active && loadedVisible && hasCards;
            if (navMount.hidden !== !visible) {
                navMount.hidden = !visible;
            }
        }

        function installRailObserver() {
            var stateLoadedEl = resolveElement('#state-loaded');
            var containerEl = resolveElement('#treesContainer');
            var observer = new MutationObserver(syncRailVisibility);
            if (stateLoadedEl) {
                observer.observe(stateLoadedEl, { childList: true, attributes: true, attributeFilter: ['hidden'] });
            }
            if (containerEl) {
                observer.observe(containerEl, { childList: true, subtree: true });
            }
            return observer;
        }

        /* ── init ───────────────────────────────────────────────────── */
        navMount = resolveElement(navMountSelector);
        grid = resolveElement(gridSelector);
        patchRenderTrees();
        railObserver = installRailObserver();

        function setStoryMode(mode) {
            if (disposed) return;
            if (mode === STORY_MODE) {
                pendingStory = true;
                if (!controller && !resolveElement(gridSelector)) {
                    /* grid not rendered yet (loading/empty/error): stay
                     * pending; afterRender activates once cards exist. */
                    syncRailVisibility();
                    return;
                }
                activateStoryMode();
            } else {
                leaveStoryMode();
            }
            syncRailVisibility();
        }

        function refresh() {
            if (disposed || !active || !controller) return;
            controller.refresh({ preferredTreeId: currentSelectedTreeId() || undefined });
        }

        function destroy() {
            if (disposed) return;
            disposed = true;
            pendingStory = false;
            active = false;
            if (railObserver) {
                railObserver.disconnect();
                railObserver = null;
            }
            destroyController();
            var renderModule = window.LoveBudMyTreesRender;
            if (renderModule && originalRenderTrees) {
                renderModule.renderTrees = originalRenderTrees;
                renderModule.__myTreesStoryPatched = false;
                originalRenderTrees = null;
            }
        }

        return {
            setStoryMode: setStoryMode,
            refresh: refresh,
            isStoryActive: function () { return active; },
            getCurrentGroup: function () { return controller ? controller.getCurrentGroup() : 0; },
            getGroupCount: function () { return controller ? controller.getGroupCount() : 0; },
            destroy: destroy
        };
    }

    window.LoveBudMyTreesStoryView = { create: createMyTreesStoryAdapter };
    if (typeof window.LoveTreeMyTreesStoryView === 'undefined') {
        window.LoveTreeMyTreesStoryView = { create: createMyTreesStoryAdapter };
    }
})();
