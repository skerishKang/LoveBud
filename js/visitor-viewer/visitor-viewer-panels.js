(function() {
    'use strict';

    function getData(key) {
        var d = window.LoveBudVisitorViewerData;
        return d ? d[key] : null;
    }

    var Icon = {
        heart: '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M12 20.2s-7.2-4.42-9.4-9.08C.92 7.58 2.68 4.3 6.15 4.3c2.02 0 3.38 1.12 3.98 2.02.58-.9 1.96-2.02 3.98-2.02 3.46 0 5.22 3.28 3.55 6.82C15.45 15.78 12 20.2 12 20.2Z" fill="currentColor"/></svg>',
        message: '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M5.3 17.6c-1.16-1.14-1.8-2.62-1.8-4.2 0-3.62 3.58-6.55 8-6.55s8 2.93 8 6.55-3.58 6.55-8 6.55c-.9 0-1.76-.12-2.56-.36L5.2 21.2l.1-3.6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
        share: '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M8.1 12.7 15.9 17M15.9 7 8.1 11.3M6.4 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm10.9-5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm0 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>'
    };

    function escape(str) {
        return String(str == null ? '' : str)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
    }

    function normalizeYouTubeHost(hostname) {
        return String(hostname || '')
            .trim()
            .toLowerCase()
            .replace(/^www\./, '')
            .replace(/^m\./, '');
    }

    function isSafeYouTubeChannelPath(pathname) {
        var path = String(pathname || '').trim();
        return /^\/@[0-9A-Za-z._-]{3,100}$/.test(path) ||
            /^\/channel\/UC[0-9A-Za-z_-]{10,100}$/.test(path);
    }

    function sanitizeYouTubeChannelUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            var parsed = new URL(url.trim());
            var host = normalizeYouTubeHost(parsed.hostname);
            if (parsed.protocol !== 'https:' || host !== 'youtube.com') return '';
            if (!isSafeYouTubeChannelPath(parsed.pathname)) return '';
            parsed.hostname = 'www.youtube.com';
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        } catch (e) {
            return '';
        }
    }

    function buildChannelUrlFromId(channelId) {
        var id = String(channelId || '').trim();
        if (/^@[0-9A-Za-z._-]{3,100}$/.test(id)) {
            return 'https://www.youtube.com/' + id;
        }
        if (/^UC[0-9A-Za-z_-]{10,100}$/.test(id)) {
            return 'https://www.youtube.com/channel/' + id;
        }
        return '';
    }

    function resolveChannelLabel(moment) {
        return String(moment && (moment.channelName || moment.channelId) || '').trim();
    }

    function resolveSafeChannelUrl(moment) {
        var explicitUrl = sanitizeYouTubeChannelUrl(moment && moment.channelUrl || '');
        if (explicitUrl) return explicitUrl;
        return sanitizeYouTubeChannelUrl(buildChannelUrlFromId(moment && moment.channelId || ''));
    }

    function buildChannelMetaHtml(moment) {
        var label = resolveChannelLabel(moment);
        var safeUrl = resolveSafeChannelUrl(moment);
        if (!label || !safeUrl) return '';
        return '<p class="vv-moment-channel">from <a class="vv-moment-channel-link" href="' + escape(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a></p>';
    }

    function momentGrad(moment, branch) {
        var pal = getData('palette');
        var p = pal && (pal[branch && branch.color] || pal.rose) || { soft:'#fff1f3', stroke:'#e99aac' };
        return 'linear-gradient(135deg,' + p.soft + ',' + p.stroke + ' 40%,white)';
    }

    function momentBg(moment, branch) {
        return 'background:' + momentGrad(moment, branch);
    }

    function CommentRow(comment) {
        return '<article class="vv-comment-row">' +
            '<div class="vv-comment-header">' +
            '  <div class="vv-comment-avatar" style="background:linear-gradient(135deg,var(--rose-200),var(--amber-100))"><span>' + escape(comment.author).slice(1, 3).toUpperCase() + '</span></div>' +
            '  <div class="vv-comment-author"><span class="vv-comment-name">' + escape(comment.author) + '</span><span class="vv-comment-time">' + escape(comment.time) + '</span></div>' +
            '  <button type="button" class="vv-comment-like-btn" data-action="comment-like">' + Icon.heart + ' <span>' + escape(comment.likes) + '</span></button>' +
            '</div>' +
            '<p class="vv-comment-body">' + escape(comment.body) + '</p>' +
            (comment.replies > 0 ? '<button type="button" class="vv-comment-replies-btn" data-action="show-replies">답글 ' + escape(comment.replies) + '개 보기</button>' : '') +
            '</article>';
    }

    function renderEmptyPanel(handlers) {
        return '<aside class="vv-panel vv-panel-empty">' +
            '<div class="vv-panel-empty-illus"></div>' +
            '<p class="vv-panel-eyebrow">Media leaf tree v3</p>' +
            '<h2 class="vv-panel-title">가지를 선택해 보세요</h2>' +
            '<p class="vv-panel-desc">트리의 구조와 media leaf가 먼저 보이는 상태입니다. 순간 상세는 아직 열리지 않습니다.</p>' +
            '<div class="vv-panel-stats"><div><strong>43</strong>순간</div><div><strong>4</strong>가지</div></div>' +
            '</aside>';
    }

    function renderBranchPanel(branch, handlers) {
        if (!branch) return '';
        var moments = branch.moments || [];
        return '<aside class="vv-panel vv-panel-branch">' +
            '<div class="vv-panel-header">' +
            '  <p class="vv-panel-eyebrow">Tree overview</p>' +
            '  <h2 class="vv-panel-title-lg">' + escape(branch.name) + '</h2>' +
            '  <p class="vv-panel-meta">' + escape(String(branch.count)) + '개의 순간</p>' +
            '</div>' +
            '<div class="vv-panel-caption">' + escape(branch.caption || '이 가지의 순간들') + '</div>' +
            '<div class="vv-branch-moment-grid">' +
            moments.map(function(m) {
                var bg = m.cluster ? '' : momentBg(m, branch);
                return '<button type="button" class="vv-branch-moment-btn" style="' + bg + '" data-moment-id="' + escape(m.id) + '" data-branch-id="' + escape(branch.id) + '" title="' + escape(m.title) + '">' +
                    '<span class="vv-branch-moment-frame"></span>' +
                    (m.cluster ? '<span class="vv-branch-moment-label">+' + escape(m.cluster) + '</span>' : '<span class="vv-branch-moment-label">' + escape(m.emoji) + '</span>') +
                    (m.cluster ? '' : '<span class="vv-branch-moment-play">▶</span>') +
                    '</button>';
            }).join('') +
            '</div>' +
            '<div class="vv-branch-moment-list">' +
            moments.slice(0, 3).map(function(m) {
                return '<button type="button" class="vv-branch-moment-item" data-moment-id="' + escape(m.id) + '" data-branch-id="' + escape(branch.id) + '"><span>' + escape(m.title) + '</span><span class="vv-branch-moment-open">열기</span></button>';
            }).join('') +
            '</div></aside>';
    }

    function renderMomentPanel(moment, branch, handlers) {
        if (!moment || !branch) return '';
        var momentComments = getData('momentComments') || {};
        var comments = momentComments[moment.id] || [
            { id: 'mc-empty', author: '@lovetree_viewer', body: '이 장면에 대한 댓글이 이곳에 모입니다.', time: '예시', likes: 0, replies: 0 }
        ];
        var channelMetaHtml = buildChannelMetaHtml(moment);
        return '<aside class="vv-panel vv-panel-moment">' +
            '<div class="vv-panel-header">' +
            '  <div><p class="vv-panel-eyebrow">Moment detail</p><p class="vv-panel-sub">순간 하나에 대한 media · caption · comments</p></div>' +
            '  <button type="button" class="vv-panel-close" data-action="close-moment" aria-label="순간 상세 닫기">' + Icon.close + '</button>' +
            '</div>' +
            '<div class="vv-moment-media">' +
            '  <div class="vv-moment-media-inner" style="background:' + momentGrad(moment, branch) + '">' +
            '    <div class="vv-moment-media-border"></div>' +
            '    <span class="vv-moment-media-badge">moment media</span>' +
            '    <button type="button" class="vv-moment-play-btn" aria-label="미디어 재생">▶</button>' +
            '    <span class="vv-moment-media-emoji">' + escape(moment.emoji) + '</span></div></div>' +
            '<div class="vv-moment-tags"><span class="vv-moment-tag-branch" style="background:' + (getData('palette') && (getData('palette')[branch.id] || {}).soft || '#fff1f3') + ';color:' + (getData('palette') && (getData('palette')[branch.id] || {}).text || '#be123c') + '">' + escape(branch.name) + '</span>' + (moment.tag ? '<span class="vv-moment-tag-default">' + escape(moment.tag) + '</span>' : '') + '</div>' +
            '<h2 class="vv-moment-title">' + escape(moment.title) + '</h2>' +
            channelMetaHtml +
            '<p class="vv-moment-caption">' + escape(moment.caption) + '</p>' +
            '<div class="vv-moment-memo"><p class="vv-moment-memo-label">creator memo</p><p class="vv-moment-memo-text"></p></div>' +
            '<div class="vv-moment-actions" aria-label="순간 반응 요약">' +
            '  <span class="vv-moment-action-stat" aria-label="좋아요"><span aria-hidden="true">' + Icon.heart + '</span> 좋아요</span>' +
            '  <span class="vv-moment-action-stat" aria-label="댓글"><span aria-hidden="true">' + Icon.message + '</span> 순간 댓글</span>' +
            '  <button type="button" class="vv-moment-action-btn" data-action="export-moment-card" aria-label="순간 이미지 카드 저장">이미지 카드 저장</button></div>' +
            '<p class="vv-moment-reactions-readonly-note">반응 기능은 준비 중이에요.</p>' +
            '<div class="vv-moment-comments-section">' +
            '  <div class="vv-moment-comments-header"><div><p class="vv-panel-eyebrow">Moment comments</p><h3 class="vv-moment-comments-title">이 순간에 남긴 댓글</h3></div></div>' +
            '  <p class="vv-moment-comment-readonly-note">댓글은 준비 중이에요.</p>' +
            '  <div class="vv-comment-list">' + comments.map(CommentRow).join('') + '</div></div>' +
            '<div class="vv-moment-nav"><button type="button" data-action="prev-moment">← 이전 순간</button><button type="button" data-action="next-moment">다음 순간 →</button></div>' +
            '<p class="vv-moment-close-hint">닫으면 같은 가지 선택 상태로 돌아갑니다.</p></aside>';
    }

    function renderTreeCommentsPanel(handlers) {
        var treeComments = getData('treeComments') || [];
        return '<aside class="vv-panel vv-panel-tree-comments">' +
            '<div class="vv-panel-header">' +
            '  <div><p class="vv-panel-eyebrow">Tree comments</p><h2 class="vv-panel-title-lg">트리 전체 댓글</h2></div>' +
            '  <button type="button" class="vv-panel-close" data-action="close-panel" aria-label="트리 댓글 닫기">' + Icon.close + '</button>' +
            '</div>' +
            '<div class="vv-scope-notice"><p class="vv-scope-notice-label">comment scope</p><p class="vv-scope-notice-text">트리 전체 댓글은 흐름, 큐레이션, 만든 사람의 기억에 대한 반응입니다.</p></div>' +
            '<div class="vv-sort-tabs"><button type="button" class="vv-sort-tab is-active">인기순</button><button type="button" class="vv-sort-tab">최신순</button></div>' +
            '<div class="vv-comment-input"><div class="vv-comment-input-avatar"></div><input type="text" class="vv-comment-input-field" placeholder="트리 전체에 댓글 남기기" /><button type="button" class="vv-comment-submit">게시</button></div>' +
            '<div class="vv-comment-list">' + treeComments.map(CommentRow).join('') + '</div></aside>';
    }

    function renderSharePanel(handlers) {
        var tree = getData('tree') || {};
        return '<aside class="vv-panel vv-panel-share">' +
            '<div class="vv-panel-header">' +
            '  <div><p class="vv-panel-eyebrow">Share tree</p><h2 class="vv-panel-title-lg">트리 공유</h2></div>' +
            '  <button type="button" class="vv-panel-close" data-action="close-panel" aria-label="공유 패널 닫기">' + Icon.close + '</button>' +
            '</div>' +
            '<div class="vv-share-preview"><div class="vv-share-icon">🌳</div><h3 class="vv-share-title">' + escape(tree.title || '') + '</h3><p class="vv-share-creator">' + escape(tree.creator || '') + '</p></div>' +
            '<div class="vv-share-actions">' +
            '<button type="button" class="vv-share-btn vv-share-btn-primary" data-action="copy-link">링크 복사 <span>copy</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="export-tree-card" aria-label="트리 이미지 카드 저장">이미지 카드 저장 <span>png</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="print-tree" aria-label="러브트리 인쇄 또는 PDF 저장">인쇄/PDF 저장 <span>print</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="native-share">공유하기 <span>share</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="platform-share" data-platform="x" aria-label="X에 트리 공유">X에 공유 <span>intent</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="platform-share" data-platform="facebook" aria-label="Facebook에 트리 공유">Facebook에 공유 <span>intent</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="platform-share" data-platform="email" aria-label="메일로 트리 공유">메일로 공유 <span>mail</span></button>' +
            '<button type="button" class="vv-share-btn vv-share-btn-secondary" data-action="close-panel">나중에 하기 <span>close</span></button></div>' +
            '<div id="vvShareStatus" class="vv-share-status" aria-live="polite"></div>' +
            '<p class="vv-share-note">공개 러브트리 주소만 공유해요. 열리지 않으면 링크 복사로 이어집니다.</p></aside>';
    }

    function renderPanel(state, handlers) {
        if (state.activePanel === 'tree-comments') return renderTreeCommentsPanel(handlers);
        if (state.activePanel === 'share') return renderSharePanel(handlers);
        if (!state.selectedBranchId && !state.selectedMomentId) return renderEmptyPanel(handlers);
        if (state.selectedBranch && !state.selectedMoment) return renderBranchPanel(state.selectedBranch, handlers);
        if (state.selectedMoment && state.panelBranch) return renderMomentPanel(state.selectedMoment, state.panelBranch, handlers);
        return renderEmptyPanel(handlers);
    }

    window.LoveBudVisitorViewerPanels = {
        renderPanel: renderPanel,
        buildChannelMetaHtml: buildChannelMetaHtml,
        sanitizeYouTubeChannelUrl: sanitizeYouTubeChannelUrl
    };
})();
