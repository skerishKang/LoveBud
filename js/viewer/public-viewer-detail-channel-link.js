(function() {
    'use strict';

    const CHANNEL_ROW_ID = 'detailCurrentMomentChannel';

    function normalizeYouTubeHost(hostname) {
        return String(hostname || '')
            .trim()
            .toLowerCase()
            .replace(/^www\./, '')
            .replace(/^m\./, '');
    }

    function isSafeYouTubeChannelPath(pathname) {
        const path = String(pathname || '').trim();
        return /^\/@[0-9A-Za-z._-]{3,100}$/.test(path) ||
            /^\/channel\/UC[0-9A-Za-z_-]{10,100}$/.test(path);
    }

    function sanitizeYouTubeChannelUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            const parsed = new URL(url.trim());
            const host = normalizeYouTubeHost(parsed.hostname);
            if (parsed.protocol !== 'https:' || host !== 'youtube.com') return '';
            if (!isSafeYouTubeChannelPath(parsed.pathname)) return '';
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        } catch (e) {
            return '';
        }
    }

    function buildChannelUrlFromId(channelId) {
        const id = String(channelId || '').trim();
        if (/^@[0-9A-Za-z._-]{3,100}$/.test(id)) {
            return `https://www.youtube.com/${id}`;
        }
        if (/^UC[0-9A-Za-z_-]{10,100}$/.test(id)) {
            return `https://www.youtube.com/channel/${id}`;
        }
        return '';
    }

    function resolveChannelLabel(data) {
        const label = String(data?.channelName || data?.channelId || '').trim();
        if (!label) return '';
        return label.startsWith('@') ? label : `from ${label}`;
    }

    function resolveSafeChannelUrl(data) {
        const explicitUrl = sanitizeYouTubeChannelUrl(data?.channelUrl || '');
        if (explicitUrl) return explicitUrl;
        return sanitizeYouTubeChannelUrl(buildChannelUrlFromId(data?.channelId || ''));
    }

    function removeExistingChannelRow() {
        const existing = document.getElementById(CHANNEL_ROW_ID);
        if (existing) existing.remove();
    }

    function renderDetailChannelLink(data) {
        removeExistingChannelRow();

        const titleEl = document.getElementById('detailCurrentMomentTitle');
        if (!titleEl || !data || data.isNewTree) return;

        const label = resolveChannelLabel(data);
        const safeUrl = resolveSafeChannelUrl(data);
        if (!label || !safeUrl) return;

        const row = document.createElement('div');
        row.id = CHANNEL_ROW_ID;
        row.className = 'editor-current-moment-channel';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.margin = '-4px 0 12px';
        row.style.fontSize = '12px';
        row.style.lineHeight = '1.45';
        row.style.color = 'var(--on-surface-variant)';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.fontSize = '14px';
        icon.textContent = 'account_circle';
        row.appendChild(icon);

        const prefix = document.createElement('span');
        prefix.textContent = 'from';
        row.appendChild(prefix);

        const link = document.createElement('a');
        link.href = safeUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'editor-current-moment-channel-link';
        link.textContent = label.replace(/^from\s+/i, '');
        link.style.color = 'var(--primary)';
        link.style.textDecoration = 'none';
        link.style.fontWeight = '700';
        row.appendChild(link);

        titleEl.insertAdjacentElement('afterend', row);
    }

    function installDetailChannelLinkPatch() {
        const originalFactory = window.createPublicViewerDetailUI;
        if (typeof originalFactory !== 'function' || originalFactory.__publicViewerChannelLinkPatched) return;

        const patchedFactory = function(deps) {
            const detailUI = originalFactory(deps);
            if (!detailUI || typeof detailUI.updateDetailPanel !== 'function') return detailUI;

            const originalUpdateDetailPanel = detailUI.updateDetailPanel;
            detailUI.updateDetailPanel = function(data) {
                originalUpdateDetailPanel(data);
                renderDetailChannelLink(data);
            };

            return detailUI;
        };

        patchedFactory.__publicViewerChannelLinkPatched = true;
        window.createPublicViewerDetailUI = patchedFactory;
    }

    window.LoveBudPublicViewerDetailChannelLink = {
        renderDetailChannelLink,
        sanitizeYouTubeChannelUrl,
        buildChannelUrlFromId
    };

    installDetailChannelLinkPatch();
})();