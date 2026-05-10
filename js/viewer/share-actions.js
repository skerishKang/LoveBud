(function() {
    'use strict';

    var MARKER = 'LoveBudShareActionsLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function getCurrentUrl() {
        return window.location.href;
    }

    function getPublicShareUrl(url) {
        try {
            var u = new URL(url || getCurrentUrl(), getCurrentUrl());
            u.hash = '';
            return u.href;
        } catch(e) {
            return getCurrentUrl();
        }
    }

    function getShareData(handlers) {
        var tree = window.LoveBudVisitorViewerData && window.LoveBudVisitorViewerData.tree;
        var url = (handlers && handlers.getShareUrl) ? handlers.getShareUrl() : getCurrentUrl();
        return {
            title: (tree && tree.title) || document.title || '러브트리',
            url: getPublicShareUrl(url)
        };
    }

    function sanitizeCardText(value, fallback, maxLength) {
        var text = String(value == null ? '' : value)
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[?#][^\s]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) text = fallback || '';
        if (maxLength && text.length > maxLength) return text.slice(0, maxLength - 1) + '…';
        return text;
    }

    function getTreeCardPayload() {
        var data = window.LoveBudVisitorViewerData || {};
        var tree = data.tree || {};
        var branches = Array.isArray(data.branches) ? data.branches : [];
        var firstBranch = branches[0] || {};
        var moments = Array.isArray(firstBranch.moments) ? firstBranch.moments : [];
        var root = data.rootSeed || {};
        var count = moments.length + (root && root.title ? 1 : 0);

        return {
            title: sanitizeCardText(tree.title, '러브트리', 46),
            caption: sanitizeCardText(root.caption || firstBranch.caption || tree.meta, '공개 순간들이 이어진 러브트리', 74),
            meta: (count || 0) + ' public moments',
            brand: 'LoveBud / LoveTree',
            routeLabel: 'Public LoveTree'
        };
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        var words = String(text || '').split(' ');
        var line = '';
        var lines = [];
        for (var i = 0; i < words.length; i++) {
            var testLine = line ? line + ' ' + words[i] : words[i];
            if (ctx.measureText(testLine).width > maxWidth && line) {
                lines.push(line);
                line = words[i];
                if (lines.length === maxLines - 1) break;
            } else {
                line = testLine;
            }
        }
        if (line && lines.length < maxLines) lines.push(line);
        lines.forEach(function(item, idx) {
            ctx.fillText(item, x, y + idx * lineHeight);
        });
    }

    function makeDownloadName(payload) {
        var name = sanitizeCardText(payload.title, 'lovetree', 28)
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]+/gi, '-')
            .replace(/^-+|-+$/g, '');
        return (name || 'lovetree') + '-card.png';
    }

    function roundedRect(ctx, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }

    function renderTreeCardCanvas(payload) {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
        var canvas = document.createElement('canvas');
        if (!canvas || typeof canvas.getContext !== 'function') return null;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        canvas.width = 1200;
        canvas.height = 630;

        var gradient = ctx.createLinearGradient(0, 0, 1200, 630);
        gradient.addColorStop(0, '#fff7ed');
        gradient.addColorStop(0.45, '#fff1f3');
        gradient.addColorStop(1, '#fdfbf7');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);

        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.strokeStyle = 'rgba(194,124,126,0.24)';
        ctx.lineWidth = 3;
        roundedRect(ctx, 74, 70, 1052, 490, 42);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#c27c7e';
        ctx.font = '700 34px Outfit, sans-serif';
        ctx.fillText(payload.routeLabel, 132, 152);

        ctx.fillStyle = '#3e342f';
        ctx.font = '700 68px Outfit, sans-serif';
        drawWrappedText(ctx, payload.title, 132, 244, 820, 78, 2);

        ctx.fillStyle = '#7e6b62';
        ctx.font = '400 34px "Noto Sans KR", sans-serif';
        drawWrappedText(ctx, payload.caption, 132, 414, 780, 44, 2);

        ctx.fillStyle = 'rgba(194,124,126,0.13)';
        ctx.beginPath();
        ctx.arc(982, 226, 92, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c27c7e';
        ctx.font = '700 82px Outfit, sans-serif';
        ctx.fillText('♡', 944, 258);

        ctx.fillStyle = '#6b5850';
        ctx.font = '600 28px Outfit, sans-serif';
        ctx.fillText(payload.meta, 132, 514);

        ctx.fillStyle = '#a8a29e';
        ctx.font = '600 24px Outfit, sans-serif';
        ctx.fillText(payload.brand, 858, 514);

        return canvas;
    }

    function downloadCanvas(canvas, payload) {
        return new Promise(function(resolve, reject) {
            if (!canvas || typeof canvas.toBlob !== 'function') {
                reject(new Error('canvas-export-unavailable'));
                return;
            }
            canvas.toBlob(function(blob) {
                try {
                    if (!blob || !window.URL || typeof window.URL.createObjectURL !== 'function') {
                        reject(new Error('canvas-blob-unavailable'));
                        return;
                    }
                    var url = window.URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = makeDownloadName(payload);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (typeof window.URL.revokeObjectURL === 'function') {
                        window.URL.revokeObjectURL(url);
                    }
                    resolve({ success: true, message: '이미지 카드를 저장했어요' });
                } catch(e) {
                    reject(e);
                }
            }, 'image/png');
        });
    }

    function getPlatformIntent(platform, handlers) {
        var data = getShareData(handlers);
        var label = String(platform || '').toLowerCase();
        var intent;

        if (label === 'x' || label === 'twitter') {
            intent = new URL('https://twitter.com/intent/tweet');
            intent.searchParams.set('text', data.title);
            intent.searchParams.set('url', data.url);
            return { url: intent.href, mode: 'popup' };
        }

        if (label === 'facebook') {
            intent = new URL('https://www.facebook.com/sharer/sharer.php');
            intent.searchParams.set('u', data.url);
            return { url: intent.href, mode: 'popup' };
        }

        if (label === 'email' || label === 'mail') {
            return {
                url: 'mailto:?subject=' + encodeURIComponent(data.title) +
                    '&body=' + encodeURIComponent(data.title + '\n' + data.url),
                mode: 'location'
            };
        }

        return null;
    }

    function copyLink(handlers) {
        var data = getShareData(handlers);
        if (!navigator.clipboard) {
            // Fallback: select and copy via textarea
            try {
                var ta = document.createElement('textarea');
                ta.value = data.url;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                return { success: true, message: '링크를 복사했어요' };
            } catch(e) {
                return { success: false, message: '복사하지 못했어요' };
            }
        }
        return navigator.clipboard.writeText(data.url).then(function() {
            return { success: true, message: '링크를 복사했어요' };
        }).catch(function() {
            return { success: false, message: '복사하지 못했어요' };
        });
    }

    function nativeShare(handlers) {
        var data = getShareData(handlers);
        if (typeof navigator.share !== 'function') {
            // Fallback to link copy
            return copyLink(handlers);
        }
        return navigator.share({
            title: data.title,
            text: data.title,
            url: data.url
        }).then(function() {
            return { success: true, message: '공유를 열었어요' };
        }).catch(function(err) {
            if (err.name === 'AbortError') {
                return { success: false, message: '' }; // User cancelled, no feedback needed
            }
            return { success: false, message: '공유하지 못했어요' };
        });
    }

    function shareToPlatform(handlers, platform) {
        var intent = getPlatformIntent(platform, handlers);
        if (!intent) return copyLink(handlers);

        try {
            if (intent.mode === 'location') {
                window.location.href = intent.url;
                return Promise.resolve({ success: true, message: '공유를 열었어요' });
            }

            var opened = window.open(intent.url, '_blank', 'noopener,noreferrer');
            if (!opened) return copyLink(handlers);
            return Promise.resolve({ success: true, message: '공유를 열었어요' });
        } catch(e) {
            return copyLink(handlers);
        }
    }

    function exportTreeImageCard(handlers) {
        try {
            var payload = getTreeCardPayload();
            var canvas = renderTreeCardCanvas(payload);
            return downloadCanvas(canvas, payload).catch(function() {
                return copyLink(handlers);
            });
        } catch(e) {
            return Promise.resolve(copyLink(handlers));
        }
    }

     window.LoveBudShareActions = {
         copyLink: copyLink,
         nativeShare: nativeShare,
         getPlatformIntent: getPlatformIntent,
         shareToPlatform: shareToPlatform,
         getTreeCardPayload: getTreeCardPayload,
         exportTreeImageCard: exportTreeImageCard
     };

     // Temporary performance optimization: hide eager video/player loads
     window.LoveBudHideEagerVideo = true;
 })();
