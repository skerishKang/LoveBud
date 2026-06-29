/**
 * LoveBud Search Card Media Fallback Renderer
 * v1
 *
 * DOM-agnostic fallback rendering helpers for search/browse tree cards.
 * Extracted from search-card-renderer.js for #1501 modularization.
 *
 * Dependencies: window.LoveBudSecurity (optional), window.LoveBudSearchSharedUtils (optional)
 */

(function() {
    'use strict';

    if (window.LoveBudSearchCardFallback) return;

    function hashSeed(value) {
        var source = String(value || 'lovetree');
        var hash = 0;
        for (var i = 0; i < source.length; i++) {
            hash = ((hash << 5) - hash) + source.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function buildPremiumFallbackSVG(tree, palette) {
        var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
        var trunkId = 'trunkGrad-' + seed;

        var branches = [
            '<path d="M 100 178 Q 98 142 100 112 Q 102 82 95 52" stroke="url(#' + trunkId + ')" stroke-width="5" fill="none" stroke-linecap="round"/>',
            '<path d="M 100 132 Q 72 122 56 98 Q 46 80 52 58" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
            '<path d="M 100 112 Q 128 102 145 84 Q 157 70 152 50" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
            '<path d="M 98 82 Q 78 72 68 52 Q 60 38 66 24" stroke="' + palette.leaf + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.75"/>'
        ].join('');

        var nodePositions = [
            { x: 52, y: 58, type: 'heart', r: 8 },
            { x: 152, y: 50, type: 'pearl', r: 7 },
            { x: 66, y: 24, type: 'pearl', r: 6 },
            { x: 102, y: 52, type: 'heart', r: 8 },
            { x: 138, y: 84, type: 'pearl', r: 6 },
            { x: 80, y: 104, type: 'heart', r: 7 }
        ];

        var nodesHtml = [];
        for (var i = 0; i < nodePositions.length; i++) {
            var pos = nodePositions[i];
            if (pos.type === 'heart') {
                var scale = (pos.r / 10).toFixed(2);
                nodesHtml.push(
                    '<g transform="translate(' + pos.x + ', ' + (pos.y - 5) + ') scale(' + scale + ')" opacity="0.95">' +
                        '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="' + palette.accent + '" opacity="0.85"/>' +
                        '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="#ffb4c1" transform="scale(0.85)"/>' +
                    '</g>'
                );
            } else {
                nodesHtml.push(
                    '<g opacity="0.95">' +
                        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pos.r + '" fill="' + palette.leafSoft + '" stroke="' + palette.leaf + '" stroke-width="1.5"/>' +
                        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (pos.r * 0.7).toFixed(1) + '" fill="rgba(255, 255, 255, 0.9)"/>' +
                        '<circle cx="' + (pos.x - pos.r * 0.2).toFixed(1) + '" cy="' + (pos.y - pos.r * 0.2).toFixed(1) + '" r="' + (pos.r * 0.25).toFixed(1) + '" fill="#ffffff"/>' +
                    '</g>'
                );
            }
        }

        return [
            '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%; max-height: 120px; display: block; margin: 0 auto;">',
                '<defs>',
                    '<linearGradient id="' + trunkId + '" x1="0%" y1="0%" x2="100%" y2="0%">',
                        '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
                        '<stop offset="50%" style="stop-color:#c87480;stop-opacity:1" />',
                        '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
                    '</linearGradient>',
                '</defs>',
                branches,
                nodesHtml.join(''),
                '<ellipse cx="100" cy="176" rx="34" ry="8" fill="none" stroke="' + palette.accent + '" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
            '</svg>'
        ].join('');
    }

    function renderMediaFallback(tree, titleText) {
        var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
        var palettes = [
            {
                background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
                leaf: '#d8839a',
                leafSoft: 'rgba(216, 131, 154, 0.18)',
                accent: '#904951'
            },
            {
                background: 'linear-gradient(135deg, #fdf6ea 0%, #f7ebd7 46%, #f5f0f7 100%)',
                leaf: '#c79d68',
                leafSoft: 'rgba(199, 157, 104, 0.18)',
                accent: '#9d6b4d'
            },
            {
                background: 'linear-gradient(135deg, #f2f6ef 0%, #e4efe1 48%, #f8efe8 100%)',
                leaf: '#7a8b6e',
                leafSoft: 'rgba(122, 139, 110, 0.18)',
                accent: '#5d6f52'
            },
            {
                background: 'linear-gradient(135deg, #f6f0fb 0%, #ece4f7 42%, #fdf2f3 100%)',
                leaf: '#9f7ec2',
                leafSoft: 'rgba(159, 126, 194, 0.18)',
                accent: '#7d5ba6'
            }
        ];
        var activePalette = palettes[seed % palettes.length];

        var locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        var isEnglish = String(locale).toLowerCase().startsWith('en');
        var pill1 = isEnglish ? 'First Moment' : '첫 순간';
        var pill2 = isEnglish ? 'Memory Note' : '마음 메모';
        var pill3 = isEnglish ? 'Favorite Scene' : '다시 보고 싶은 장면';

        var svgHtml = buildPremiumFallbackSVG(tree, activePalette);

        return `
            <div class="tree-card-media-fallback" style="background: ${activePalette.background};">
                <div class="fallback-svg-container">
                    ${svgHtml}
                </div>
                <div class="fallback-pills">
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill1}</span>
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill2}</span>
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill3}</span>
                </div>
                <div class="fallback-title" style="display:none !important;"></div>
            </div>
        `;
    }

    function renderRepresentativeImage(src, alt, tree, titleText) {
        if (!src) {
            return renderMediaFallback(tree, titleText);
        }
        // hqdefault.jpg 로드 실패 시 mqdefault.jpg 로 대체 처리를 위해 data 속성 부여
        var isYouTubeHq = src && (src.includes('ytimg.com/vi/') || src.includes('img.youtube.com/vi/'));
        var ytAttr = isYouTubeHq ? ' data-yt-hq-thumbnail="true"' : '';
        return `
            <img src="${src}" alt="${alt}" loading="lazy" data-search-card-image=""${ytAttr} style="width:100%;height:100%;object-fit:cover;">
            <div data-fallback-container hidden style="width:100%;height:100%;position:absolute;inset:0;">
                ${renderMediaFallback(tree, titleText)}
            </div>
        `;
    }

    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.sanitizeUrl) return utils.sanitizeUrl(value);
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        try {
            var parsed = new URL(raw, window.location.origin);
            var protocol = parsed.protocol;
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function clipText(value, maxLength) {
        var text = String(value || '').trim();
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).trim() + '\u2026';
    }

    function buildRepresentativeTextVisual(tree, palette, firstMem) {
        var repTitle = clipText(
            tree.representativeTitle || tree.representative_title || firstMem?.title || '',
            40
        );
        var repMemo = clipText(
            tree.representativeMemo || tree.representative_memo ||
            firstMem?.memo || firstMem?.description || '',
            82
        );
        if (!repTitle && !repMemo) return '';

        // i18n kicker with Korean fallback
        var kickerKey = 'card.representative.kicker';
        var kickerText = (typeof window.t === 'function' ? window.t(kickerKey) : kickerKey);
        if (!kickerText || kickerText === kickerKey) {
            kickerText = '첫 순간 기록'; // Korean fallback if i18n unavailable
        }

        return [
            '<div class="tree-card-text-visual" style="--tree-card-text-border:' + palette.leafSoft + ';--tree-card-text-accent:' + palette.accent + ';">',
                '<div class="tree-card-text-kicker">' + escapeHtml(kickerText) + '</div>',
                '<div class="tree-card-text-title">' + escapeHtml(repTitle) + '</div>',
                '<div class="tree-card-text-memo">' + escapeHtml(repMemo) + '</div>',
            '</div>'
        ].join('');
    }

    var _fallbackPalettes = [
        {
            background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
            leaf: '#d8839a',
            leafSoft: 'rgba(216, 131, 154, 0.18)',
            accent: '#904951'
        },
        {
            background: 'linear-gradient(135deg, #fdf6ea 0%, #f7ebd7 46%, #f5f0f7 100%)',
            leaf: '#c79d68',
            leafSoft: 'rgba(199, 157, 104, 0.18)',
            accent: '#9d6b4d'
        },
        {
            background: 'linear-gradient(135deg, #f2f6ef 0%, #e4efe1 48%, #f8efe8 100%)',
            leaf: '#7a8b6e',
            leafSoft: 'rgba(122, 139, 110, 0.18)',
            accent: '#5d6f52'
        },
        {
            background: 'linear-gradient(135deg, #f6f0fb 0%, #ece4f7 42%, #fdf2f3 100%)',
            leaf: '#9f7ec2',
            leafSoft: 'rgba(159, 126, 194, 0.18)',
            accent: '#7d5ba6'
        }
    ];

    function _getFallbackPalette(tree) {
        var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
        return _fallbackPalettes[seed % _fallbackPalettes.length];
    }

    function renderRepresentativeMedia(tree, firstMem, titleText) {
        const mediaUrl = sanitizeUrl(
            tree.representativeThumbnail ||
            firstMem?.thumbnail ||
            tree.thumbnail ||
            ''
        );
        const firstMoment = escapeHtml(firstMem?.title || '');

        // Tier 1: real media thumbnail
        if (mediaUrl) {
            return `
                <div class="tree-card-media" aria-label="${firstMoment}" style="position:relative;overflow:hidden;">
                    ${renderRepresentativeImage(mediaUrl, firstMoment, tree, titleText)}
                </div>
            `;
        }

        var palette = _getFallbackPalette(tree);

        // Tier 2: text-led cover when representative text exists
        var textVisual = buildRepresentativeTextVisual(tree, palette, firstMem);
        if (textVisual) {
            return `
                <div class="tree-card-media" aria-label="${firstMoment}" style="background:${palette.background};position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                    ${textVisual}
                </div>
            `;
        }

        // Tier 3: premium SVG fallback
        return `
            <div class="tree-card-media" aria-label="${firstMoment}" style="position:relative;overflow:hidden;">
                ${renderMediaFallback(tree, titleText)}
            </div>
        `;
    }

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.escapeHtml) return utils.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.LoveBudSearchCardFallback = {
        hashSeed: hashSeed,
        buildPremiumFallbackSVG: buildPremiumFallbackSVG,
        renderMediaFallback: renderMediaFallback,
        renderRepresentativeImage: renderRepresentativeImage,
        sanitizeUrl: sanitizeUrl,
        renderRepresentativeMedia: renderRepresentativeMedia,
        escapeHtml: escapeHtml,
        clipText: clipText,
        buildRepresentativeTextVisual: buildRepresentativeTextVisual,
        _fallbackPalettes: _fallbackPalettes,
        _getFallbackPalette: _getFallbackPalette
    };
})();
