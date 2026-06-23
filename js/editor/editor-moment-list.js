/**
 * Editor Moment List - Created-order moment list panel
 * Provides a list view of moments in their creation order.
 * 
 * MVP Scope:
 * - Renders moments in the order returned by getTreeMemories()
 * - Clicking a list item selects the corresponding canvas node
 * - Root memory is displayed with a special label
 * - No drag/reorder, no persistence, no sorting
 */

(function () {
    'use strict';

    const CSS_PREFIX = 'editor-moment-list';

    function getText(key, fallback) {
        const i18n = window.t || function(key) { return key; };
        const translated = typeof i18n === 'function' ? i18n(key) : '';
        return translated && translated !== key ? translated : fallback;
    }

    function getSourceLabel(mem) {
        if (!mem) return null;
        const sourceType = mem.sourceType || mem.source_type;
        const sourceUrl = mem.sourceUrl || mem.source_url || mem.url;
        if (sourceType === 'youtube' || (sourceUrl && sourceUrl.includes('youtube.com'))) {
            return 'YouTube';
        }
        if (sourceUrl) {
            return getText('editor_source_link', '링크');
        }
        return null;
    }

    function formatDate(mem) {
        if (!mem || !mem.date) return null;
        try {
            const d = new Date(mem.date);
            return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return null;
        }
    }

    function createEditorMomentList(deps) {
        const {
            documentRef = document,
            getTreeMemories,
            getSelectedNodeId,
            setSelectedNodeId,
            updateDetailPanel,
            rerenderCanvas,
            isRootMemory,
            getCanonicalRootId
        } = deps;

        const canonicalRootId = getCanonicalRootId();

        // Create panel container
        const panel = documentRef.createElement('aside');
        panel.className = `${CSS_PREFIX}-panel`;
        panel.setAttribute('aria-label', getText('editor_moment_list_title', '순간 목록'));
        panel.style.display = 'none';

        // Create panel header
        const header = documentRef.createElement('div');
        header.className = `${CSS_PREFIX}-header`;

        const title = documentRef.createElement('h3');
        title.className = `${CSS_PREFIX}-title`;
        title.textContent = getText('editor_moment_list_title', '순간 목록');
        header.appendChild(title);

        const closeBtn = documentRef.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = `${CSS_PREFIX}-close`;
        closeBtn.setAttribute('aria-label', getText('editor_moment_list_close', '목록 닫기'));
        const closeIcon = documentRef.createElement('span');
        closeIcon.className = 'material-symbols-outlined';
        closeIcon.setAttribute('aria-hidden', 'true');
        closeIcon.textContent = 'close';
        closeBtn.appendChild(closeIcon);
        closeBtn.addEventListener('click', hidePanel);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Create list container
        const listContainer = documentRef.createElement('div');
        listContainer.className = `${CSS_PREFIX}-items`;
        panel.appendChild(listContainer);

        // Mount to document
        const canvasArea = documentRef.getElementById('canvasArea');
        if (canvasArea) {
            canvasArea.appendChild(panel);
        } else {
            documentRef.body.appendChild(panel);
        }

        // State
        let isVisible = false;

        // Render list items from memories
        function renderList() {
            const memories = getTreeMemories();
            if (!Array.isArray(memories)) return;

            while (listContainer.firstChild) {
                listContainer.removeChild(listContainer.firstChild);
            }

            memories.forEach((mem, index) => {
                if (!mem || !mem.id) return;

                const item = documentRef.createElement('button');
                item.type = 'button';
                item.className = `${CSS_PREFIX}-item`;
                item.dataset.memoryId = mem.id;

                const isSelected = getSelectedNodeId() === mem.id;
                const isRoot = isRootMemory(mem, canonicalRootId);

                if (isSelected) {
                    item.classList.add(`${CSS_PREFIX}-item--selected`);
                }

                // Build item content
                const order = documentRef.createElement('span');
                order.className = `${CSS_PREFIX}-item-order`;
                order.textContent = index + 1;
                item.appendChild(order);

                const content = documentRef.createElement('div');
                content.className = `${CSS_PREFIX}-item-content`;

                const titleWrap = documentRef.createElement('div');
                titleWrap.className = `${CSS_PREFIX}-item-title-wrap`;

                const title = documentRef.createElement('span');
                title.className = `${CSS_PREFIX}-item-title`;
                title.textContent = mem.title || getText('editor_untitled_memory', '제목 없음');
                titleWrap.appendChild(title);

                if (isRoot) {
                    const badge = documentRef.createElement('span');
                    badge.className = `${CSS_PREFIX}-item-badge`;
                    badge.textContent = getText('editor_start_moment', '시작 순간');
                    titleWrap.appendChild(badge);
                }
                content.appendChild(titleWrap);

                const meta = documentRef.createElement('div');
                meta.className = `${CSS_PREFIX}-item-meta`;

                const dateStr = formatDate(mem);
                const sourceStr = getSourceLabel(mem);

                if (dateStr) {
                    const dateEl = documentRef.createElement('span');
                    dateEl.className = `${CSS_PREFIX}-item-date`;
                    dateEl.textContent = dateStr;
                    meta.appendChild(dateEl);
                }

                if (sourceStr) {
                    const sourceEl = documentRef.createElement('span');
                    sourceEl.className = `${CSS_PREFIX}-item-source`;
                    sourceEl.textContent = sourceStr;
                    meta.appendChild(sourceEl);
                }

                if (meta.children.length > 0) {
                    content.appendChild(meta);
                }
                item.appendChild(content);

                // Click handler - reuse existing selection flow
                item.addEventListener('click', () => {
                    setSelectedNodeId(mem.id);
                    updateDetailPanel(mem);
                    rerenderCanvas();
                    // Update active state
                    const allItems = listContainer.querySelectorAll(`.${CSS_PREFIX}-item`);
                    allItems.forEach(el => {
                        el.classList.remove(`${CSS_PREFIX}-item--selected`);
                    });
                    item.classList.add(`${CSS_PREFIX}-item--selected`);
                });

                listContainer.appendChild(item);
            });
        }

        // Show panel
        function showPanel() {
            isVisible = true;
            panel.style.display = 'block';
            renderList();
        }

        // Hide panel
        function hidePanel() {
            isVisible = false;
            panel.style.display = 'none';
        }

        // Toggle panel
        function togglePanel() {
            if (isVisible) {
                hidePanel();
            } else {
                showPanel();
            }
        }

        // Public API
        return {
            show: showPanel,
            hide: hidePanel,
            toggle: togglePanel,
            refresh: renderList,
            getPanel: () => panel,
            isVisible: () => isVisible
        };
    }

    // Expose globally for dependency injection
    window.LoveBudEditorMomentList = {
        createEditorMomentList
    };
})();
