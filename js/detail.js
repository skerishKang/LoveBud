/**
 * detail.js - Memory Detail Renderer
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: DOM 요소 참조
    // ═══════════════════════════════════════════════════════════════════════
    const videoMain = document.getElementById('videoMain');
    const memoryTitle = document.getElementById('memoryTitle');
    const diaryQuote = document.getElementById('diaryQuote');
    const diaryContent = document.getElementById('diaryContent');
    const detailArtist = document.getElementById('detailArtist');
    const detailDate = document.getElementById('detailDate');
    const detailSubtitle = document.getElementById('detailSubtitle');
    const tagsContainer = document.getElementById('tagsContainer');
    const connectedFragments = document.getElementById('connectedFragments');
    const treeContextEl = document.getElementById('treeContext');
    const backButton = document.getElementById('backButton');
    const container = document.querySelector('.detail-layout');

    const getI18n = () => window.t || ((k) => k);
    const i18n = getI18n();

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:image')) return raw;
        try {
            return new URL(raw, window.location.origin).toString();
        } catch (e) { return ''; }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: 이벤트 핸들러 및 유틸리티
    // ═══════════════════════════════════════════════════════════════════════

    // 뒤로가기 버튼 설정 (addEventListener 교체 및 중복 방지)
    if (backButton) {
        const handleBack = () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                const isPages = window.location.pathname.includes('/pages/');
                window.location.href = isPages ? 'search.html' : 'pages/search.html';
            }
        };

        if (backButton.__detailBackHandler) {
            backButton.removeEventListener('click', backButton.__detailBackHandler);
        }
        backButton.__detailBackHandler = handleBack;
        backButton.addEventListener('click', handleBack);
        backButton.onclick = null;
    }

    function renderMemoryNotFound() {
        if (!container) return;
        const isPages = window.location.pathname.includes('/pages/');
        const homeUrl = isPages ? '../index.html' : 'index.html';
        const searchUrl = isPages ? 'search.html' : 'pages/search.html';

        container.innerHTML = `
            <div class="error-container" style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: var(--outline-variant); margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                <h2 class="headline" style="margin-bottom: 16px;">기억을 찾을 수 없습니다</h2>
                <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">요청하신 기억이 삭제되었거나 잘못된 접근입니다.</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <a href="${homeUrl}" class="btn-round btn-primary" style="padding: 12px 24px; text-decoration: none;">홈으로</a>
                    <a href="${searchUrl}" class="btn-round btn-outline" style="padding: 12px 24px; text-decoration: none;">검색하기</a>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: 데이터 로드 및 렌더링
    // ═══════════════════════════════════════════════════════════════════════

    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');

    if (!memoryId) {
        renderMemoryNotFound();
        return;
    }

    try {
        if (!window.apiClient) throw new Error('API Client not found');
        
        const memory = await window.apiClient.getMemory(memoryId);
        if (!memory) {
            renderMemoryNotFound();
            return;
        }

        // 본문 렌더링
        if (memoryTitle) memoryTitle.textContent = memory.title || '기억의 순간';
        if (detailArtist) detailArtist.textContent = memory.artist || i18n('unknown_artist');
        if (detailDate) detailDate.textContent = memory.timestamp || '';
        if (diaryQuote) diaryQuote.textContent = `"${memory.memo || ''}"`;
        if (diaryContent) diaryContent.textContent = memory.memo || '';
        
        // 태그 렌더링
        if (tagsContainer && memory.emotionTags) {
            tagsContainer.innerHTML = memory.emotionTags.map(tag => 
                `<span class="tag-chip active">${escapeHtml(tag)}</span>`
            ).join('');
        }

        // 이미지 처리
        if (videoMain) {
            const thumb = safeUrl(memory.thumbnail);
            videoMain.innerHTML = `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 0.5s;" onload="this.style.opacity=1;">`;
        }

        document.title = `${memory.title || '기억'} — Lovetree`;

    } catch (e) {
        console.error('[detail] Load failed:', e);
        renderMemoryNotFound();
    }
});
