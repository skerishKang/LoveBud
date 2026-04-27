(function () {
    function createVideoHelpers({ tText, escapeHtml, normalizeVideoSourceUrl }) {
        const buildSoftPanelMarkup = ({ icon, kicker, title, description }) => `
            <div style="display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:24px;border-radius:1.5rem;background:linear-gradient(180deg, rgba(250,246,243,0.96), rgba(255,255,255,0.98));border:1px solid rgba(144, 73, 81, 0.08);box-shadow:0 14px 34px rgba(75,64,57,0.05);">
                <span class="material-symbols-outlined" style="font-size:22px;color:var(--primary);">${icon}</span>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--primary);">${escapeHtml(kicker)}</div>
                <div style="font-size:1rem;font-weight:800;line-height:1.5;color:var(--on-surface);">${escapeHtml(title)}</div>
                <p style="margin:0;font-size:0.95rem;line-height:1.7;color:var(--on-surface-variant);">${escapeHtml(description)}</p>
            </div>
        `;

        const buildImageOnlyMomentMarkup = (memory) => {
            const thumbnail = String(memory?.thumbnail || '').trim();
            if (!thumbnail) return '';
            const title = escapeHtml(memory?.title || tText('tree_context_moment', '순간 상세'));
            const caption = escapeHtml(
                memory?.memo
                    || tText('image_only_moment_caption', '링크 없이 남겨진 장면이지만, 이 순간의 분위기는 그대로 감상할 수 있어요.')
            );

            return `
                <div style="position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg, rgba(255,255,255,0.1), rgba(35,28,29,0.18));">
                    <img src="${escapeHtml(thumbnail)}" alt="${title}" style="width:100%;height:100%;object-fit:cover;display:block;">
                    <div style="position:absolute;inset:auto 18px 18px 18px;padding:14px 16px;border-radius:1.1rem;background:rgba(23,17,18,0.42);border:1px solid rgba(255,255,255,0.12);color:#fff;backdrop-filter:blur(12px);">
                        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;margin-bottom:6px;">${tText('image_only_moment_kicker', '대표 장면')}</div>
                        <div style="font-size:1rem;font-weight:800;line-height:1.45;margin-bottom:4px;">${title}</div>
                        <p style="margin:0;font-size:0.88rem;line-height:1.6;color:rgba(255,255,255,0.82);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${caption}</p>
                    </div>
                </div>
            `;
        };

        const buildVideoUnavailableMarkup = (memory) => {
            const normalizedVideo = normalizeVideoSourceUrl(memory?.sourceUrl || memory?.videoUrl || memory?.originalUrl || '');
            const watchUrl = normalizedVideo.watchUrl;
            const title = escapeHtml(memory?.title || tText('tree_context_moment', '순간 상세'));
            const hasWatchUrl = !!watchUrl;

            return `
                <div style="width:100%;height:100%;background:linear-gradient(180deg, rgba(35,28,29,0.82), rgba(62,45,48,0.92));display:flex;align-items:center;justify-content:center;padding:32px;">
                    <div style="max-width:420px;text-align:center;color:rgba(255,255,255,0.92);">
                        <span class="material-symbols-outlined" style="font-size:34px;display:block;margin-bottom:14px;opacity:0.88;">play_circle</span>
                        <div style="font-size:1.05rem;font-weight:800;line-height:1.5;margin-bottom:10px;">${tText('video_unavailable_soft_title', '이 순간의 영상은 여기서 바로 열리지 않을 수 있어요.')}</div>
                        <p style="margin:0 0 18px;font-size:0.95rem;line-height:1.7;color:rgba(255,255,255,0.76);">${tText('video_unavailable_soft_desc', '재생이 열리지 않더라도 이 순간의 감상은 이어서 읽어볼 수 있어요.')}</p>
                        ${hasWatchUrl ? `<a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${title}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-size:13px;font-weight:700;backdrop-filter:blur(10px);">
                            <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span>
                            <span>${tText('video_embed_fallback_cta', '원본에서 감상 이어가기')}</span>
                        </a>` : ''}
                    </div>
                </div>
            `;
        };

        const buildIframeEmbedMarkup = ({ iframeSrc, watchUrl, title }) => `
            <div style="position:relative;width:100%;height:100%;">
                <iframe width="100%" height="100%"
                    src="${iframeSrc}"
                    title="${escapeHtml(title || '')}" frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen></iframe>
                ${watchUrl ? `
                    <a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer"
                       style="position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:rgba(23,17,18,0.56);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;font-size:12px;font-weight:700;backdrop-filter:blur(10px);">
                        <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
                        <span>${tText('video_embed_fallback_cta', '원본에서 감상 이어가기')}</span>
                    </a>
                ` : ''}
            </div>
        `;

        const buildVideoMainMarkup = (memory) => {
            const normalizedVideo = normalizeVideoSourceUrl(memory.sourceUrl || memory.videoUrl || memory.originalUrl || '');
            const embedUrl = normalizedVideo.embedUrl;
            const watchUrl = normalizedVideo.watchUrl;
            const iframeSrc = embedUrl ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=0` : '';
            const imageOnlyMarkup = !memory.sourceUrl && !memory.videoUrl && !memory.originalUrl
                ? buildImageOnlyMomentMarkup(memory)
                : '';

            if (iframeSrc) return buildIframeEmbedMarkup({ iframeSrc, watchUrl, title: memory.title || '' });
            if (imageOnlyMarkup) return imageOnlyMarkup;
            return buildVideoUnavailableMarkup(memory);
        };

        return {
            buildSoftPanelMarkup,
            buildImageOnlyMomentMarkup,
            buildVideoUnavailableMarkup,
            buildIframeEmbedMarkup,
            buildVideoMainMarkup
        };
    }

    window.LoveBudDetailVideo = { createVideoHelpers };
})();
