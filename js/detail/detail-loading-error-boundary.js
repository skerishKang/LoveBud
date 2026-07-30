(function () {
    function createDetailLoadingErrorBoundary({ tText, homeHref, searchHref }) {
        const renderMissingMemoryState = () => {
            const detailTopbar = document.querySelector('.detail-topbar');
            const detailHero = document.getElementById('detailHero');
            const mainLayout = document.querySelector('.detail-layout');
            const contentSlot = document.querySelector('.detail-main') || document.querySelector('.detail-content') || mainLayout;
            const videoMain = document.getElementById('videoMain');

            if (videoMain) videoMain.removeAttribute('aria-busy');
            if (detailTopbar) detailTopbar.style.display = 'none';
            if (detailHero) detailHero.style.display = 'none';
            if (mainLayout) mainLayout.style.display = 'block';

            const fallbackHTML = `
                <div class="detail-missing-state" role="status" aria-live="polite" style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                    <span class="material-symbols-outlined" aria-hidden="true" style="font-size: 64px; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                    <h2 class="headline" style="font-size: 1.8rem; margin-bottom: 16px; color: var(--on-surface);">${tText('memory_not_found_title', '기억을 찾지 못했어요')}</h2>
                    <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">
                        ${tText('memory_not_found_desc', '요청하신 기억이 존재하지 않거나 접근할 수 없는 상태입니다.').replace('.', '<br>')}
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <a href="${homeHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('back_to_home', '홈으로')}</a>
                        <a href="${searchHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('browse_lovetrees', '러브트리 둘러보기')}</a>
                    </div>
                </div>
            `;

            if (contentSlot) contentSlot.innerHTML = fallbackHTML;
        };

        return {
            renderMissingMemoryState
        };
    }

    window.createDetailLoadingErrorBoundary = createDetailLoadingErrorBoundary;
})();
