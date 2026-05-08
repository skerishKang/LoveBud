(function() {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function renderPanel(host, data, state, handlers) {
        if (!host) return;
        document.body.classList.toggle('visitor-panel-open', state.panel !== 'hint');
        if (state.panel === 'branch') return renderBranch(host, data, state);
        if (state.panel === 'moment') return renderMoment(host, data, state, handlers);
        if (state.panel === 'comments') return renderTreeComments(host, data, handlers);
        if (state.panel === 'share') return renderShare(host);
        renderHint(host);
    }

    function closeButton() {
        return '<button type="button" class="visitor-icon-btn visitor-close-panel" data-panel-close aria-label="Close panel"><span class="material-symbols-outlined">close</span></button>';
    }

    function renderHint(host) {
        host.innerHTML = `
            <div class="visitor-panel-empty">
                <p>가지를 선택하면 이 트리의 작은 흐름이 열려요.</p>
            </div>
        `;
    }

    function renderBranch(host, data, state) {
        const branch = data.branches.find((item) => item.id === state.selectedBranchId);
        if (!branch) return renderHint(host);
        const moments = branch.momentIds.map((id) => data.moments.find((moment) => moment.id === id)).filter(Boolean);
        host.innerHTML = `
            ${closeButton()}
            <span class="visitor-panel-kicker">Branch · ${moments.length} moments</span>
            <h2 class="visitor-panel-title">${escapeHtml(branch.name)}</h2>
            <p class="visitor-panel-caption">${escapeHtml(branch.caption)}</p>
            <div class="visitor-branch-leaves" aria-label="Branch moment leaves">
                ${moments.map(() => '<span class="visitor-leaf-mini" aria-hidden="true"></span>').join('')}
            </div>
            <div class="visitor-tags">
                ${moments.flatMap((moment) => moment.tags).slice(0, 4).map((tag) => `<span class="visitor-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
    }

    function renderMoment(host, data, state, handlers) {
        const moment = data.moments.find((item) => item.id === state.selectedMomentId);
        if (!moment) return renderHint(host);
        host.innerHTML = `
            ${closeButton()}
            <span class="visitor-panel-kicker">Moment</span>
            <div class="visitor-media-box" aria-label="Moment media placeholder"></div>
            <h2 class="visitor-panel-title">${escapeHtml(moment.title)}</h2>
            <p class="visitor-panel-caption">${escapeHtml(moment.caption)}</p>
            <div class="visitor-tags">${moment.tags.map((tag) => `<span class="visitor-tag">${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="visitor-inline-actions" aria-label="Moment actions">
                <button type="button" class="visitor-panel-btn" data-moment-like><span class="material-symbols-outlined">favorite</span> Like</button>
                <button type="button" class="visitor-panel-btn"><span class="material-symbols-outlined">chat_bubble</span> Comment</button>
                <button type="button" class="visitor-panel-btn"><span class="material-symbols-outlined">ios_share</span> Share</button>
            </div>
            <div class="visitor-comments-list" aria-label="Moment comments">
                ${moment.comments.map((comment) => renderComment(comment)).join('')}
            </div>
            <div class="visitor-comment-input">
                <input type="text" aria-label="Moment comment placeholder" placeholder="이 순간에 짧게 반응하기">
                <button type="button" class="visitor-icon-btn visitor-comment-submit"><span class="material-symbols-outlined">send</span></button>
            </div>
            <div class="visitor-step-actions">
                <button type="button" class="visitor-panel-btn" data-step-moment="prev">Previous</button>
                <button type="button" class="visitor-panel-btn" data-step-moment="next">Next</button>
            </div>
        `;
        host.querySelector('[data-step-moment="prev"]')?.addEventListener('click', () => handlers.onStepMoment(-1));
        host.querySelector('[data-step-moment="next"]')?.addEventListener('click', () => handlers.onStepMoment(1));
    }

    function renderTreeComments(host, data) {
        host.innerHTML = `
            ${closeButton()}
            <span class="visitor-panel-kicker">Tree comments</span>
            <h2 class="visitor-panel-title">트리 전체에 남긴 반응</h2>
            <p class="visitor-panel-caption">흐름과 큐레이션에 대한 댓글만 여기에 모여요.</p>
            <div class="visitor-comments-list">${data.tree.commentsList.map((comment) => renderComment(comment)).join('')}</div>
            <div class="visitor-comment-input">
                <input type="text" aria-label="Tree comment placeholder" placeholder="트리 흐름에 반응하기">
                <button type="button" class="visitor-icon-btn visitor-comment-submit"><span class="material-symbols-outlined">send</span></button>
            </div>
        `;
    }

    function renderShare(host) {
        host.innerHTML = `
            ${closeButton()}
            <span class="visitor-panel-kicker">Share</span>
            <h2 class="visitor-panel-title">이 러브트리 나누기</h2>
            <p class="visitor-panel-caption">공개 링크와 공유 흐름을 확인하는 placeholder shell입니다.</p>
            <div class="visitor-share-grid">
                <button type="button" class="visitor-panel-btn"><span class="material-symbols-outlined">link</span> Copy link</button>
                <button type="button" class="visitor-panel-btn"><span class="material-symbols-outlined">ios_share</span> Native share</button>
                <button type="button" class="visitor-panel-btn"><span class="material-symbols-outlined">group</span> Public share</button>
            </div>
        `;
    }

    function renderComment(comment) {
        return `<div class="visitor-comment"><strong>${escapeHtml(comment.author)}</strong><span>${escapeHtml(comment.text)}</span></div>`;
    }

    window.LoveBudVisitorViewerPanels = { renderPanel };
})();
