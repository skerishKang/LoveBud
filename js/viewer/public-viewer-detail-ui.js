(function() {
    'use strict';

    function createPublicViewerUpdateFocusSelectedBtn(deps) {
        var getSelectedNodeId = deps && typeof deps.getSelectedNodeId === 'function'
            ? deps.getSelectedNodeId
            : function() { return null; };

        return function updatePublicViewerFocusSelectedBtn() {
            var btn = document.getElementById('focusSelectedBtn');
            if (!btn) return;

            var hasSelection = !!getSelectedNodeId();
            btn.disabled = !hasSelection;
            btn.classList.toggle('is-disabled', !hasSelection);
        };
    }

    function createPublicViewerSidebarStatusUpdater(deps) {
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function(memory, rootId) { return !!(memory && rootId && memory.id === rootId); };

        return function updatePublicViewerSidebarStatus() {
            var sidebarCountEl = document.getElementById('viewerSidebarMomentCount');
            if (!sidebarCountEl) return;

            var treeMemories = Array.isArray(getTreeMemories()) ? getTreeMemories() : [];
            var canonicalRootId = getCanonicalRootId();
            var nonRootMemories = treeMemories.filter(function(memory) {
                return memory && !isRootMemory(memory, canonicalRootId);
            });
            var visibleMomentCount = nonRootMemories.length;

            sidebarCountEl.textContent = visibleMomentCount + '개의 순간';
        };
    }

    function createPublicViewerEmptyStateContent() {
        var wrap = document.createElement('div');
        var icon = document.createElement('span');
        var title = document.createElement('p');
        var description = document.createElement('p');

        wrap.style.textAlign = 'center';
        wrap.style.padding = '40px 24px';
        wrap.style.color = 'var(--on-surface-variant)';

        icon.className = 'material-symbols-outlined';
        icon.style.fontSize = '48px';
        icon.style.opacity = '0.4';
        icon.style.marginBottom = '16px';
        icon.style.display = 'block';
        icon.textContent = 'sentiment_satisfied';

        title.style.fontSize = '1rem';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        title.style.color = 'var(--on-surface)';
        title.textContent = '첫 순간이 트리를 깨워요';

        description.style.fontSize = '0.9rem';
        description.style.opacity = '0.78';
        description.style.lineHeight = '1.6';
        description.textContent = '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.';

        wrap.appendChild(icon);
        wrap.appendChild(title);
        wrap.appendChild(description);
        return wrap;
    }

    function createPublicViewerSetDetailEmptyState(deps) {
        return function setPublicViewerDetailEmptyState(isEmpty) {
            var detailContent = document.getElementById('detailContent');
            if (!detailContent) return;

            var emptyState = document.getElementById('detailEmptyState');
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.id = 'detailEmptyState';
                emptyState.appendChild(createPublicViewerEmptyStateContent());
                detailContent.appendChild(emptyState);
            }

            var viewMode = document.getElementById('detailViewMode');

            if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
            if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'block';
        };
    }

    function updatePublicViewerDetailChannelLink(data) {
        var helper = window.LoveBudPublicViewerDetailChannelLink;
        if (!helper || typeof helper.renderDetailChannelLink !== 'function') return;
        helper.renderDetailChannelLink(data);
    }

    function createPublicViewerCurrentMomentImageBoundary(deps) {
        var resolveMemoryThumbnail = deps && typeof deps.resolveMemoryThumbnail === 'function'
            ? deps.resolveMemoryThumbnail
            : function() { return ''; };
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var showToast = deps && typeof deps.showToast === 'function'
            ? deps.showToast
            : function() {};

        function formatI18nText(key, fallback) {
            var text = i18n(key);
            return text && text !== key ? text : fallback;
        }

        var clearDetailPlayer = function(mediaWrap) {
            if (!mediaWrap) return;
            var existingPlayer = mediaWrap.querySelector('[data-editor-detail-player="1"]');
            if (existingPlayer) existingPlayer.remove();
            mediaWrap.classList.remove('is-playing');
            var overlay = mediaWrap.querySelector('.memory-preview-overlay');
            if (overlay) overlay.hidden = false;
            var imgEl = mediaWrap.querySelector('img');
            if (imgEl) imgEl.style.display = '';
        };

        var getMemoryPlaybackUrl = function(data) {
            if (!data) return '';
            return String(
                data.sourceUrl ||
                data.source_url ||
                data.videoUrl ||
                data.video_url ||
                data.url ||
                data.linkUrl ||
                data.link_url ||
                ''
            ).trim();
        };

        var getYouTubeVideoId = function(rawUrl) {
            if (!rawUrl) return '';
            var mediaHelper = window.LoveBudMedia;
            if (mediaHelper && typeof mediaHelper.extractYouTubeId === 'function') {
                return mediaHelper.extractYouTubeId(rawUrl) || '';
            }
            try {
                var url = new URL(rawUrl, window.location.origin);
                var host = url.hostname.replace(/^www\./, '');
                if (host === 'youtu.be') {
                    return url.pathname.split('/').filter(Boolean)[0] || '';
                }
                if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
                    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/').filter(Boolean)[1] || '';
                    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/').filter(Boolean)[1] || '';
                    return url.searchParams.get('v') || '';
                }
            } catch (error) {}
            return '';
        };

        var buildYouTubeEmbedUrl = function(data) {
            var rawUrl = getMemoryPlaybackUrl(data);
            var videoId = getYouTubeVideoId(rawUrl);
            if (!videoId) return '';

            var mediaHelper = window.LoveBudMedia;
            var startSeconds = null;
            var endSeconds = null;

            var startValue = data && (data.startTime || data.start_time || data.startSeconds || data.start_seconds);
            var endValue = data && (data.endTime || data.end_time || data.endSeconds || data.end_seconds);

            if (mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
                if (startValue !== undefined && startValue !== null) {
                    startSeconds = mediaHelper.parseYouTubeTimeToSeconds(startValue);
                }
                if (endValue !== undefined && endValue !== null) {
                    endSeconds = mediaHelper.parseYouTubeTimeToSeconds(endValue);
                }
            }

            try {
                var parsed = new URL(rawUrl);
                if (startSeconds === null) {
                    var urlStart = parsed.searchParams.get('start') || parsed.searchParams.get('t');
                    if (urlStart && mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
                        startSeconds = mediaHelper.parseYouTubeTimeToSeconds(urlStart);
                    } else if (urlStart) {
                        startSeconds = Number(urlStart);
                    }
                }
                if (endSeconds === null) {
                    var urlEnd = parsed.searchParams.get('end');
                    if (urlEnd && mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
                        endSeconds = mediaHelper.parseYouTubeTimeToSeconds(urlEnd);
                    } else if (urlEnd) {
                        endSeconds = Number(urlEnd);
                    }
                }
            } catch (e) {}

            var params = new URLSearchParams();
            params.set('autoplay', '1');
            params.set('rel', '0');

            if (Number.isFinite(startSeconds) && startSeconds > 0) {
                params.set('start', String(Math.floor(startSeconds)));
            }
            if (Number.isFinite(endSeconds) && endSeconds > 0) {
                params.set('end', String(Math.floor(endSeconds)));
            }

            return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?' + params.toString();
        };

        var buildInlinePlayerElement = function(data) {
            var youtubeEmbedUrl = buildYouTubeEmbedUrl(data);
            if (youtubeEmbedUrl) {
                var iframe = document.createElement('iframe');
                iframe.dataset.editorDetailPlayer = '1';
                iframe.className = 'detail-video-player';
                iframe.src = youtubeEmbedUrl;
                iframe.title = data && data.title ? data.title : formatI18nText('selected_moment_video', '선택된 순간 영상');
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                return iframe;
            }
            return null;
        };

        var bindDetailMediaPlayback = function(data, mediaWrap) {
            if (!mediaWrap) return;
            var playBtn = mediaWrap.querySelector('.play-btn');
            if (!playBtn) return;
            playBtn.hidden = false;
            playBtn.onclick = function(event) {
                event.preventDefault();
                event.stopPropagation();
                var player = buildInlinePlayerElement(data);
                if (!player) {
                    if (showToast) showToast(formatI18nText('moment_inline_player_unavailable', '재생 가능한 영상 링크가 없어요.'), 'warn');
                    return;
                }
                clearDetailPlayer(mediaWrap);
                var imgEl = mediaWrap.querySelector('img');
                var overlay = mediaWrap.querySelector('.memory-preview-overlay');
                if (imgEl) imgEl.style.display = 'none';
                if (overlay) overlay.hidden = true;
                mediaWrap.classList.add('is-playing');
                mediaWrap.appendChild(player);
            };
        };

        return function updatePublicViewerCurrentMomentImage(data) {
            var imgEl = document.getElementById('detailImg') || document.querySelector('.detail-video img');
            if (!imgEl) return;

            var mediaWrap = imgEl.closest('.detail-video') || imgEl.parentElement;
            clearDetailPlayer(mediaWrap);

            var isEmptyState = !!(data && data.isNewTree);
            var safeAlt = (window.LoveBudPublicViewerDetailMetadataText && window.LoveBudPublicViewerDetailMetadataText.safeDisplayTitle)
                ? window.LoveBudPublicViewerDetailMetadataText.safeDisplayTitle(data && data.title)
                : (data && data.title);
            imgEl.alt = isEmptyState ? '' : (safeAlt || '');

            if (isEmptyState) {
                imgEl.removeAttribute('src');
                if (mediaWrap) {
                    mediaWrap.classList.add('is-empty');
                    mediaWrap.style.display = 'none';
                }
                return;
            }

            var rawUrl = getMemoryPlaybackUrl(data);
            var videoId = getYouTubeVideoId(rawUrl);

            if (videoId) {
                // YouTube: explicit-play only — show thumbnail + play overlay, never autoplay
                var thumb = resolveMemoryThumbnail(data);
                if (thumb) {
                    imgEl.src = thumb;
                    imgEl.style.display = '';
                    var overlay = mediaWrap ? mediaWrap.querySelector('.memory-preview-overlay') : null;
                    if (overlay) overlay.hidden = false;
                    if (mediaWrap) {
                        mediaWrap.style.display = '';
                        mediaWrap.classList.remove('is-empty');
                    }
                    bindDetailMediaPlayback(data, mediaWrap);
                } else {
                    imgEl.removeAttribute('src');
                    if (mediaWrap) {
                        mediaWrap.classList.add('is-empty');
                        mediaWrap.style.display = 'none';
                    }
                }
            } else {
                var thumb = resolveMemoryThumbnail(data);
                if (thumb) {
                    imgEl.src = thumb;
                    imgEl.style.display = '';
                    var overlay = mediaWrap ? mediaWrap.querySelector('.memory-preview-overlay') : null;
                    if (overlay) overlay.hidden = false;
                    if (mediaWrap) {
                        mediaWrap.style.display = '';
                        mediaWrap.classList.remove('is-empty');
                    }
                    bindDetailMediaPlayback(data, mediaWrap);
                } else {
                    imgEl.removeAttribute('src');
                    if (mediaWrap) {
                        mediaWrap.classList.add('is-empty');
                        mediaWrap.style.display = 'none';
                    }
                }
            }
        };
    }

    function createPublicViewerMemoBodyBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };

        function formatI18nText(key, fallback) {
            var text = i18n(key) || fallback;
            return !text || text === key ? fallback : text;
        }

        function hasAnyMoments() {
            var memories = getTreeMemories();
            return Array.isArray(memories) && memories.length > 0;
        }

        function getMemoFallbackText(options) {
            var createDetailUIBuilders = typeof window.createPublicViewerDetailUIBuilders === 'function'
                ? window.createPublicViewerDetailUIBuilders
                : window.createEditorDetailUIBuilders;

            if (typeof createDetailUIBuilders === 'function') {
                var builders = createDetailUIBuilders({ formatI18nText: formatI18nText });
                if (builders && typeof builders.getMemoFallbackText === 'function') {
                    return builders.getMemoFallbackText(options);
                }
            }
            return formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요');
        }

        return function updatePublicViewerMemoBody(data) {
            var noteEl = document.getElementById('detailMemo') || document.querySelector('.diary-note');
            if (!noteEl) return;

            var isEmptyState = !!(data && data.isNewTree) && !hasAnyMoments();
            var memoContainer = document.createElement('div');
            var memoBody = document.createElement('div');

            while (noteEl.firstChild) {
                noteEl.removeChild(noteEl.firstChild);
            }

            memoContainer.style.width = '100%';

            memoBody.style.lineHeight = '1.8';
            memoBody.style.fontSize = '0.95rem';
            memoBody.style.color = 'var(--on-surface)';
            memoBody.style.whiteSpace = 'pre-line';
            memoBody.textContent = isEmptyState
                ? getMemoFallbackText({ isEmptyState: true })
                : ((data && data.memo) || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요'));

            memoContainer.appendChild(memoBody);
            noteEl.appendChild(memoContainer);
        };
    }

    function createPublicViewerCurrentMomentTagsBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };

        function formatI18nText(key, fallback) {
            var text = i18n(key) || fallback;
            return !text || text === key ? fallback : text;
        }

        function createFallbackTags(data, options) {
            var opts = options || {};
            var isRootSelected = !!opts.isRootSelected;
            var isEmptyState = !!opts.isEmptyState;
            var rawTags = Array.isArray(data && data.emotionTags) ? data.emotionTags.filter(Boolean) : [];
            var normalizedTags = rawTags.map(function(tag) {
                var trimmed = String(tag || '').trim();
                if (!trimmed) return '';
                return trimmed === '기록' ? formatI18nText('editor_root_emotion_tag', '첫 마음') : trimmed;
            }).filter(Boolean);

            if (normalizedTags.length > 0) return normalizedTags;
            if (!isEmptyState && isRootSelected) return [formatI18nText('editor_root_emotion_tag', '첫 마음')];
            return [];
        }

        function getDisplayTags(data, options) {
            var createDetailUIBuilders = typeof window.createPublicViewerDetailUIBuilders === 'function'
                ? window.createPublicViewerDetailUIBuilders
                : window.createEditorDetailUIBuilders;

            if (typeof createDetailUIBuilders === 'function') {
                var builders = createDetailUIBuilders({ formatI18nText: formatI18nText });
                if (builders && typeof builders.getDisplayEmotionTags === 'function') {
                    return builders.getDisplayEmotionTags(data, options);
                }
            }
            return createFallbackTags(data, options);
        }

        return function updatePublicViewerCurrentMomentTags(data) {
            var tagsContainer = document.getElementById('detailTags');
            if (!tagsContainer) return;

            var isEmptyState = !!(data && data.isNewTree);
            var rootId = getCanonicalRootId();
            var isRootSelected = !isEmptyState && !!data && isRootMemory(data, rootId);
            var displayTags = getDisplayTags(data, { isRootSelected: isRootSelected, isEmptyState: isEmptyState });

            while (tagsContainer.firstChild) {
                tagsContainer.removeChild(tagsContainer.firstChild);
            }

            displayTags.forEach(function(tag) {
                var tagEl = document.createElement('span');
                tagEl.className = 'tag tag-primary';
                tagEl.textContent = tag;
                tagsContainer.appendChild(tagEl);
            });
        };
    }

    // ---------------------------------------------------------------------------
    // Compatibility aliases for window.LoveBudPublicViewerDetailUI surface.
    // Resolved at top-level; may be null if social modules load later.
    // ---------------------------------------------------------------------------
        var createPublicViewerReadOnlyReactionSummaryBoundary = (window.LoveBudPublicViewerReadOnlySocialSummary &&
            typeof window.LoveBudPublicViewerReadOnlySocialSummary.createPublicViewerReadOnlyReactionSummaryBoundary === 'function')
            ? window.LoveBudPublicViewerReadOnlySocialSummary.createPublicViewerReadOnlyReactionSummaryBoundary : null;
        var createPublicViewerAuthenticatedLikeBoundary = (window.LoveBudPublicViewerAuthenticatedLike &&
            typeof window.LoveBudPublicViewerAuthenticatedLike.createPublicViewerAuthenticatedLikeBoundary === 'function')
            ? window.LoveBudPublicViewerAuthenticatedLike.createPublicViewerAuthenticatedLikeBoundary : null;

    // ---------------------------------------------------------------------------
    // Resolver — reads factories from window at call time.
    // ---------------------------------------------------------------------------
    function resolvePublicViewerSocialFactories() {
        var readOnlyNs = window.LoveBudPublicViewerReadOnlySocialSummary;
        var likeNs = window.LoveBudPublicViewerAuthenticatedLike;
        var composerNs = window.LoveBudPublicViewerAuthenticatedCommentComposer;

        if (!readOnlyNs || typeof readOnlyNs.createPublicViewerReadOnlyReactionSummaryBoundary !== 'function') {
            throw new Error('[public-viewer-detail-ui] LoveBudPublicViewerReadOnlySocialSummary.createPublicViewerReadOnlyReactionSummaryBoundary not found');
        }
        if (!likeNs || typeof likeNs.createPublicViewerAuthenticatedLikeBoundary !== 'function') {
            throw new Error('[public-viewer-detail-ui] LoveBudPublicViewerAuthenticatedLike.createPublicViewerAuthenticatedLikeBoundary not found');
        }
        if (!composerNs || typeof composerNs.createPublicViewerAuthenticatedCommentComposerBoundary !== 'function') {
            throw new Error('[public-viewer-detail-ui] LoveBudPublicViewerAuthenticatedCommentComposer.createPublicViewerAuthenticatedCommentComposerBoundary not found');
        }

        return {
            createReadOnly: readOnlyNs.createPublicViewerReadOnlyReactionSummaryBoundary,
            createLike: likeNs.createPublicViewerAuthenticatedLikeBoundary,
            createComposer: composerNs.createPublicViewerAuthenticatedCommentComposerBoundary
        };
    }

    function createPublicViewerTreeMetaBoundary(deps) {
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };
        var resolveTreeTitleText = deps && typeof deps.resolveTreeTitleText === 'function'
            ? deps.resolveTreeTitleText
            : function(title) { return title || '러브트리'; };
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var getTreeMemories = deps && typeof deps.getTreeMemories === 'function'
            ? deps.getTreeMemories
            : function() { return []; };
        var getCurrentTreeData = deps && typeof deps.getCurrentTreeData === 'function'
            ? deps.getCurrentTreeData
            : function() { return {}; };
        var getLocalSaveMode = deps && typeof deps.getLocalSaveMode === 'function'
            ? deps.getLocalSaveMode
            : function() { return false; };
        var showToast = deps && typeof deps.showToast === 'function'
            ? deps.showToast
            : function() {};

        function formatI18nText(key, fallback, replacements) {
            var text = i18n(key) || fallback;
            if (!text || text === key) text = fallback;
            if (replacements && typeof replacements === 'object') {
                Object.keys(replacements).forEach(function(name) {
                    text = String(text).replace(new RegExp('\\{' + name + '\\}', 'g'), String(replacements[name] ?? ''));
                });
            }
            return text;
        }

        function createInlineIcon(name, size) {
            var createDetailUIBuilders = typeof window.createPublicViewerDetailUIBuilders === 'function'
                ? window.createPublicViewerDetailUIBuilders
                : window.createEditorDetailUIBuilders;

            if (typeof createDetailUIBuilders === 'function') {
                var builders = createDetailUIBuilders({ formatI18nText: formatI18nText });
                if (builders && typeof builders.createInlineIcon === 'function') {
                    return builders.createInlineIcon(name, size);
                }
            }

            var icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.style.fontSize = size || '12px';
            icon.textContent = name;
            return icon;
        }

        function getTreeState() {
            var canonicalRootId = getCanonicalRootId();
            var treeMemories = getTreeMemories();
            var rootMemory = treeMemories.find(function(memory) {
                return isRootMemory(memory, canonicalRootId);
            }) || null;
            var nonRootMemories = treeMemories.filter(function(memory) {
                return !isRootMemory(memory, canonicalRootId);
            });
            var totalMomentCount = treeMemories.length;
            var visibleMomentCount = nonRootMemories.length > 0 ? nonRootMemories.length : (rootMemory ? 1 : 0);

            return {
                canonicalRootId: canonicalRootId,
                treeMemories: treeMemories,
                rootMemory: rootMemory,
                nonRootMemories: nonRootMemories,
                totalMomentCount: totalMomentCount,
                visibleMomentCount: visibleMomentCount,
                hasMoments: totalMomentCount > 0,
                hasVisibleMoments: visibleMomentCount > 0
            };
        }

        var createTreeMetaBoundary = typeof window.createPublicViewerDetailTreeMetaBoundary === 'function'
            ? window.createPublicViewerDetailTreeMetaBoundary
            : window.createEditorDetailTreeMetaBoundary;

        var boundary = null;
        if (typeof createTreeMetaBoundary === 'function') {
            boundary = createTreeMetaBoundary({
                i18n: i18n,
                formatI18nText: formatI18nText,
                resolveTreeTitleText: resolveTreeTitleText,
                createInlineIcon: createInlineIcon,
                showToast: showToast
            });
        }

        var _cachedTreeLikeControl = null;
        var _cachedTreeCommentsControl = null;
        var _lastTreeId = null;

        return function updatePublicViewerTreeMeta(data) {
            var treeMetaMount = document.getElementById('detailTreeMetaMount');
            if (!treeMetaMount || !boundary) return;

            var currentTree = getCurrentTreeData() || {};
            var treeState = getTreeState();
            var isEmptyState = !!(data && data.isNewTree) && !treeState.hasMoments;
            var localSaveMode = getLocalSaveMode();
            var visibility = currentTree.visibility || 'public';
            var isPublic = visibility === 'public';
            var treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');

            var model = boundary.buildTreeMetaRenderModel({
                currentTree: currentTree,
                treeState: treeState,
                data: data,
                isEmptyState: isEmptyState,
                localSaveMode: localSaveMode
            });

            // Create tree-level like control once per treeId
            var treeLikeControlEl = null;
            if (treeId && treeId !== _lastTreeId) {
                _lastTreeId = treeId;
                _cachedTreeLikeControl = null;
                _cachedTreeCommentsControl = null;
            }
            if (treeId && !_cachedTreeLikeControl) {
                var treeLikeFactory = window.LoveBudTreeLikeControl;
                if (treeLikeFactory && typeof treeLikeFactory.createTreeLikeControl === 'function') {
                    var tlc = treeLikeFactory.createTreeLikeControl({
                        hasConfirmedAuthSession: function() {
                            return !!(window.LoveBudAuth && typeof window.LoveBudAuth.hasConfirmedAuthSession === 'function'
                                ? window.LoveBudAuth.hasConfirmedAuthSession()
                                : false);
                        },
                        getAuthToken: function() {
                            // Acquire at call time from Firebase auth singleton
                            try {
                                var user = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
                                if (user) {
                                    // getIdToken returns a Promise — return it directly
                                    return user.getIdToken(false);
                                }
                            } catch (e) {
                                // Silent — guest / not initialized
                            }
                            return null;
                        },
                        i18n: i18n,
                        showToast: showToast,
                        treeId: treeId,
                        initialActive: false,
                        initialCount: 0,
                        formatCompactCount: function(n) {
                            // Use LoveBudFormatCompactCount if available
                            if (window.LoveBudFormatCompactCount && typeof window.LoveBudFormatCompactCount === 'function') {
                                return window.LoveBudFormatCompactCount(n);
                            }
                            if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
                            if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
                            return String(n);
                        },
                        resolveTreeTitleText: resolveTreeTitleText
                    });
                    _cachedTreeLikeControl = tlc;
                    if (tlc && tlc.getElement) {
                        treeLikeControlEl = tlc.getElement();
                    }
                }
            } else if (_cachedTreeLikeControl && _cachedTreeLikeControl.getElement) {
                treeLikeControlEl = _cachedTreeLikeControl.getElement();
            }

            // Create read-only whole-tree comments control once per treeId.
            // Only for public trees; non-public trees get no control/panel.
            var treeCommentsControlEl = null;
            var treeCommentsPanelEl = null;
            if (treeId && isPublic) {
                if (!_cachedTreeCommentsControl) {
                    var treeCommentsFactory = window.LoveBudPublicViewerTreeComments;
                    if (treeCommentsFactory && typeof treeCommentsFactory.createTreeCommentsReadOnlyControl === 'function') {
                        var tcc = treeCommentsFactory.createTreeCommentsReadOnlyControl({
                            i18n: i18n,
                            showToast: showToast,
                            treeId: treeId
                        });
                        _cachedTreeCommentsControl = tcc;
                    }
                }
                if (_cachedTreeCommentsControl) {
                    // reset(treeId) is deliberately NOT called here.
                    // The cached control is only nulled (line ~616) when treeId
                    // actually changes. A same-tree rerender (e.g. selected
                    // moment switch) must preserve panel state and cache.
                    if (_cachedTreeCommentsControl.getElement) {
                        treeCommentsControlEl = _cachedTreeCommentsControl.getElement();
                    }
                    if (_cachedTreeCommentsControl.getPanelElement) {
                        treeCommentsPanelEl = _cachedTreeCommentsControl.getPanelElement();
                    }
                }
            }

            boundary.renderTreeMetaBoundary(treeMetaMount, model, treeId, data, treeLikeControlEl, treeCommentsControlEl, treeCommentsPanelEl);
        };
    }

    function createPublicViewerDetailHeadingBoundary(deps) {
        var detailPanel = deps && deps.detailPanel;
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function() { return ''; };

        function getText(key, fallback) {
            var text = i18n(key);
            return text && text !== key ? text : fallback;
        }

        return function updatePublicViewerDetailHeading() {
            var headerEl = detailPanel && typeof detailPanel.querySelector === 'function'
                ? detailPanel.querySelector('h3')
                : document.querySelector('#detailPanel h3');
            if (!headerEl) return;
            headerEl.textContent = getText('editor_current_hub_heading', '현재 순간 허브');
        };
    }

    function createPublicViewerDetailUI(deps) {
        var metadataText = window.LoveBudPublicViewerDetailMetadataText;

        if (
            !metadataText ||
            typeof metadataText.createPublicViewerCurrentMomentBadgeBoundary !== 'function' ||
            typeof metadataText.createPublicViewerCurrentMomentTitleBoundary !== 'function' ||
            typeof metadataText.updatePublicViewerCurrentMomentHint !== 'function' ||
            typeof metadataText.updatePublicViewerCurrentMomentDate !== 'function'
        ) {
            throw new Error('[public-viewer-detail] Metadata text dependency not loaded');
        }

        // Resolve social boundary factories from current window state
        var socialFactories = resolvePublicViewerSocialFactories();
        var createPublicViewerReadOnlyReactionSummaryBoundary = socialFactories.createReadOnly;
        var createPublicViewerAuthenticatedLikeBoundary = socialFactories.createLike;
        var createPublicViewerAuthenticatedCommentComposerBoundary = socialFactories.createComposer;

        var detailUI = {};
        var updateDetailHeading = createPublicViewerDetailHeadingBoundary(deps);
        var updateTreeMeta = createPublicViewerTreeMetaBoundary(deps);
        var updateCurrentMomentBadge = metadataText.createPublicViewerCurrentMomentBadgeBoundary(deps);
        var updateCurrentMomentTitle = metadataText.createPublicViewerCurrentMomentTitleBoundary(deps);
        var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps);
        var updateMemoBody = createPublicViewerMemoBodyBoundary(deps);
        var updateCurrentMomentTags = createPublicViewerCurrentMomentTagsBoundary(deps);
        var sharedGenerationRef = deps && deps.sharedGenerationRef
            ? deps.sharedGenerationRef
            : { value: 0 };

        var resolveSocialContext = function(data) {
            if (!data || typeof data !== 'object') {
                return null;
            }
            if (!data.id && !data.memoryId && !data.memory_id) {
                return null;
            }
            var isRootMemoryFn = deps && deps.isRootMemory;
            var getCanonicalRootIdFn = deps && deps.getCanonicalRootId;
            if (isRootMemoryFn && getCanonicalRootIdFn) {
                var rootId = getCanonicalRootIdFn();
                if (isRootMemoryFn(data, rootId)) {
                    return null;
                }
            }

            if (!deps || typeof deps.getSelectedNodeId !== 'function') {
                return null;
            }
            var selectedId = deps.getSelectedNodeId();
            if (!selectedId) {
                return null;
            }

            var memories = deps && typeof deps.getTreeMemories === 'function' ? deps.getTreeMemories() : [];
            if (!Array.isArray(memories)) {
                return null;
            }

            var matchedMemory = null;
            for (var i = 0; i < memories.length; i++) {
                var m = memories[i];
                if (m && m.id === selectedId) {
                    matchedMemory = m;
                    break;
                }
            }

            if (!matchedMemory) {
                return null;
            }

            var treeId = matchedMemory.treeId;
            if (!treeId || !matchedMemory.id) {
                return null;
            }

            if (!data.treeId || data.treeId !== treeId) {
                return null;
            }

            // Check if root memory
            var isRoot = false;
            if (isRootMemoryFn && getCanonicalRootIdFn) {
                var rootId = getCanonicalRootIdFn();
                if (isRootMemoryFn(matchedMemory, rootId)) {
                    isRoot = true;
                }
            }
            if (isRoot) {
                return null;
            }

            return {
                treeId: treeId,
                memoryId: matchedMemory.id,
                memory: matchedMemory
            };
        };

        var boundaryDeps = Object.assign({}, deps, {
            sharedGenerationRef: sharedGenerationRef,
            resolveSocialContext: resolveSocialContext
        });

        // Create composer boundary first (it will receive reconcilePublicSummary after read-only is created)
        var updateCommentComposer = null;
        var commentPanelStateHandler = function(state) {
            if (updateCommentComposer) updateCommentComposer(state);
        };

        // Create read-only boundary with lifecycle callback
        var updateReadOnlyReactionSummary = createPublicViewerReadOnlyReactionSummaryBoundary(
            Object.assign({}, boundaryDeps, {
                onCommentsPanelStateChange: function(state) {
                    commentPanelStateHandler(state);
                }
            })
        );

        // Create authenticaticated like boundary
        var updateAuthenticatedLike = createPublicViewerAuthenticatedLikeBoundary(
            Object.assign({}, boundaryDeps, {
                reconcilePublicSummary: updateReadOnlyReactionSummary
            })
        );

        // Create composer boundary with reconcile pointing to read-only
        updateCommentComposer = createPublicViewerAuthenticatedCommentComposerBoundary(
            Object.assign({}, boundaryDeps, {
                reconcilePublicSummary: updateReadOnlyReactionSummary
            })
        );

        detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps);
        detailUI.updateSidebarStatus = createPublicViewerSidebarStatusUpdater(deps);
        detailUI.setDetailEmptyState = createPublicViewerSetDetailEmptyState(deps);

        var lastDetailKey = null;
        var lastDetailAt = 0;

        detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data) {
            var force = arguments.length > 1 ? arguments[1] : undefined;
            var now = Date.now();
            var memoryId = data ? data.id : null;
            if (!force && memoryId && lastDetailKey === memoryId && (now - lastDetailAt) < 150) {
                updateReadOnlyReactionSummary(data);
                // Defer auth boundary after public summary microtasks
                Promise.resolve().then(function() {
                    updateAuthenticatedLike(data);
                });
                return;
            }
            if (memoryId) {
                lastDetailKey = memoryId;
                lastDetailAt = now;
            } else {
                lastDetailKey = null;
                lastDetailAt = 0;
            }

            updateDetailHeading();
            updateTreeMeta(data);
            updateCurrentMomentBadge(data);
            updateCurrentMomentTitle(data);
            updatePublicViewerDetailChannelLink(data);
            metadataText.updatePublicViewerCurrentMomentHint();
            updateCurrentMomentImage(data);
            metadataText.updatePublicViewerCurrentMomentDate(data);
            updateMemoBody(data);
            updateCurrentMomentTags(data);
            if (force) {
                updateReadOnlyReactionSummary(data, force);
            } else {
                updateReadOnlyReactionSummary(data);
            }
            Promise.resolve().then(function() {
                updateAuthenticatedLike(data);
            });
        };
        return detailUI;
    }

    window.createPublicViewerDetailUI = createPublicViewerDetailUI;
    window.LoveBudPublicViewerDetailUI = {
        createPublicViewerDetailUI: createPublicViewerDetailUI,
        createPublicViewerDetailHeadingBoundary: createPublicViewerDetailHeadingBoundary,
        createPublicViewerUpdateFocusSelectedBtn: createPublicViewerUpdateFocusSelectedBtn,
        createPublicViewerSidebarStatusUpdater: createPublicViewerSidebarStatusUpdater,
        createPublicViewerSetDetailEmptyState: createPublicViewerSetDetailEmptyState,
        createPublicViewerCurrentMomentBadgeBoundary: (window.LoveBudPublicViewerDetailMetadataText && window.LoveBudPublicViewerDetailMetadataText.createPublicViewerCurrentMomentBadgeBoundary) || null,
        createPublicViewerCurrentMomentTitleBoundary: (window.LoveBudPublicViewerDetailMetadataText && window.LoveBudPublicViewerDetailMetadataText.createPublicViewerCurrentMomentTitleBoundary) || null,
        updatePublicViewerCurrentMomentHint: (window.LoveBudPublicViewerDetailMetadataText && window.LoveBudPublicViewerDetailMetadataText.updatePublicViewerCurrentMomentHint) || null,
        updatePublicViewerDetailChannelLink: updatePublicViewerDetailChannelLink,
        createPublicViewerCurrentMomentImageBoundary: createPublicViewerCurrentMomentImageBoundary,
        updatePublicViewerCurrentMomentDate: (window.LoveBudPublicViewerDetailMetadataText && window.LoveBudPublicViewerDetailMetadataText.updatePublicViewerCurrentMomentDate) || null,
        createPublicViewerMemoBodyBoundary: createPublicViewerMemoBodyBoundary,
        createPublicViewerCurrentMomentTagsBoundary: createPublicViewerCurrentMomentTagsBoundary,
        createPublicViewerReadOnlyReactionSummaryBoundary: createPublicViewerReadOnlyReactionSummaryBoundary,
        createPublicViewerAuthenticatedLikeBoundary: createPublicViewerAuthenticatedLikeBoundary,
        createPublicViewerTreeMetaBoundary: createPublicViewerTreeMetaBoundary,
        delegatesToEditorDetailUI: false
    };
})();
