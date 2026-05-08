(function() {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function renderTree(root, data, state, handlers) {
        const branchHost = root.querySelector('#visitorTreeBranches');
        const rootSeed = root.querySelector('#visitorRootSeed');
        if (!branchHost || !rootSeed) return;

        const selectedBranchId = state.selectedBranchId;
        const selectedMomentId = state.selectedMomentId;
        root.querySelector('#visitorTreeCanvas')?.classList.toggle('has-selection', Boolean(selectedBranchId || selectedMomentId));

        branchHost.innerHTML = data.branches.map((branch) => {
            const moments = branch.momentIds.map((id) => data.moments.find((moment) => moment.id === id)).filter(Boolean);
            const branchSelected = selectedBranchId === branch.id || moments.some((moment) => moment.id === selectedMomentId);
            const showLeafTitles = state.panel === 'branch' && selectedBranchId === branch.id;
            return `
                <div class="visitor-branch ${branchSelected ? 'is-selected' : ''}" data-branch-id="${escapeHtml(branch.id)}" data-side="${escapeHtml(branch.side)}" style="top:${branch.y}%; --branch-rotate:${escapeHtml(branch.rotate)}">
                    <span class="visitor-branch-line" aria-hidden="true"></span>
                    <button type="button" class="visitor-branch-btn" data-branch-select="${escapeHtml(branch.id)}">${escapeHtml(branch.name)}</button>
                    ${moments.map((moment, index) => renderLeaf(moment, index, selectedMomentId, showLeafTitles)).join('')}
                </div>
            `;
        }).join('');

        const rootMoment = data.moments.find((moment) => moment.id === data.tree.rootMomentId);
        rootSeed.textContent = rootMoment ? rootMoment.title : 'Root';
        rootSeed.dataset.momentSelect = rootMoment ? rootMoment.id : '';
        rootSeed.hidden = !rootMoment;
        rootSeed.classList.toggle('is-selected', selectedMomentId === data.tree.rootMomentId);

        branchHost.querySelectorAll('[data-branch-select]').forEach((button) => {
            button.addEventListener('click', () => handlers.onBranch(button.dataset.branchSelect));
        });
        root.querySelectorAll('[data-moment-select]').forEach((button) => {
            button.addEventListener('click', () => handlers.onMoment(button.dataset.momentSelect));
        });
    }

    function renderLeaf(moment, index, selectedMomentId, showTitle) {
        const selected = selectedMomentId === moment.id;
        const rotate = index % 2 === 0 ? '-4deg' : '5deg';
        return `
            <button type="button" class="visitor-media-leaf ${selected ? 'is-selected' : ''} ${showTitle ? 'has-title' : ''}" data-index="${index + 1}" data-moment-select="${escapeHtml(moment.id)}" style="--leaf-rotate:${rotate}" aria-label="${escapeHtml(moment.title)}">
                <span class="visitor-media-leaf-thumb" aria-hidden="true"></span>
                ${showTitle ? `<span class="visitor-media-leaf-title">${escapeHtml(moment.title)}</span>` : ''}
            </button>
        `;
    }

    window.LoveBudVisitorViewerRenderTree = { renderTree };
})();
