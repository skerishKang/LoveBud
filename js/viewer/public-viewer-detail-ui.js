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

    function createPublicViewerReadOnlyReactionSummaryBoundary(deps) {
        var fetchReactionSummary = deps && typeof deps.fetchPublicMomentReactionSummary === 'function'
            ? deps.fetchPublicMomentReactionSummary
            : null;
        var fetchComments = deps && typeof deps.fetchPublicMomentComments === 'function'
            ? deps.fetchPublicMomentComments
            : null;
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var resolveSocialContext = deps && typeof deps.resolveSocialContext === 'function'
            ? deps.resolveSocialContext
            : null;

        var onCommentsPanelStateChange = deps && typeof deps.onCommentsPanelStateChange === 'function'
            ? deps.onCommentsPanelStateChange
            : null;

        var sharedGenRef = deps && deps.sharedGenerationRef;
        var currentGeneration = sharedGenRef ? sharedGenRef.value : 0;
        var lastLoadedMemoryId = null;
        var lastData = null;
        var cardEl = null;
        var likeValueEl = null;
        var commentValueEl = null;
        var noteEl = null;
        var commentToggleEl = null;
        var commentPanelEl = null;
        var commentsListEl = null;
        var commentsPanelStatusEl = null;
        var commentMemoryMeta = null;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : currentGeneration;
        }

        function nextGeneration() {
            if (sharedGenRef) {
                sharedGenRef.value++;
                return sharedGenRef.value;
            }
            currentGeneration++;
            return currentGeneration;
        }

        function getElements() {
            if (!cardEl) cardEl = document.getElementById('momentReactionsCard');
            if (!likeValueEl) likeValueEl = document.getElementById('momentReactionLikeValue');
            if (!commentValueEl) commentValueEl = document.getElementById('momentReactionCommentValue');
            if (!noteEl) noteEl = document.getElementById('momentReactionNote');
            if (!commentToggleEl) commentToggleEl = document.getElementById('momentReactionCommentStatus');
            if (!commentPanelEl) commentPanelEl = document.getElementById('momentCommentsPanel');
            if (!commentsListEl) commentsListEl = document.getElementById('momentCommentsList');
            if (!commentsPanelStatusEl) commentsPanelStatusEl = document.getElementById('momentCommentsPanelStatus');
            return cardEl && likeValueEl && commentValueEl && noteEl
                && commentToggleEl && commentPanelEl && commentsListEl && commentsPanelStatusEl;
        }

        function setLoadingState(force, preservePanel) {
            if (!getElements()) return;
            cardEl.style.display = '';
            cardEl.dataset.socialLoading = 'true';
            if (!force) {
                cardEl.setAttribute('data-read-only-summary', 'true');
                cardEl.classList.add('is-read-only');
                cardEl.classList.add('is-public-readonly');
                cardEl.setAttribute('aria-label', '순간 반응 (읽기 전용)');
                likeValueEl.textContent = '⋯';
                commentValueEl.textContent = '⋯';
                var likeStatus = likeValueEl.parentElement;
                var commentStatus = commentValueEl.parentElement;
                if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 불러오는 중');
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 불러오는 중');
                noteEl.textContent = '반응 기능은 준비 중이에요.';
                commentToggleEl.setAttribute('disabled', '');
                commentToggleEl.setAttribute('aria-expanded', 'false');
            }
            if (!preservePanel) {
                resetCommentsPanel();
            }
            removeRetryButton();
        }

        function removeRetryButton() {
            if (!cardEl) return;
            var existingRetry = cardEl.querySelector('[data-social-retry="1"]');
            if (existingRetry && existingRetry.parentElement) {
                existingRetry.parentElement.removeChild(existingRetry);
            }
        }

        function validateSocialDTOs(reactionData, commentsData) {
            // Validate reaction DTO: { counts: { like: <non-negative integer> }, total: ... }
            var likeCount = -1;
            if (reactionData && typeof reactionData === 'object' && !Array.isArray(reactionData)) {
                var counts = reactionData.counts;
                if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
                    var rawLike = counts.like;
                    if (rawLike === undefined || rawLike === null) {
                        likeCount = 0;
                    } else if (typeof rawLike === 'number' && Number.isFinite(rawLike) && rawLike >= 0 && Math.floor(rawLike) === rawLike) {
                        likeCount = rawLike;
                    }
                }
            }

            // Validate comments DTO: exactly { comments: Array, nextCursor: null }
            // Each item must be an object with own string body.
            // Any malformed item invalidates the entire payload.
            var validComments = null;
            if (commentsData && typeof commentsData === 'object' && !Array.isArray(commentsData)) {
                if (Array.isArray(commentsData.comments) && commentsData.nextCursor === null) {
                    var items = commentsData.comments;
                    var allValid = true;
                    for (var i = 0; i < items.length; i++) {
                        var item = items[i];
                        if (!item || typeof item !== 'object' || Array.isArray(item) ||
                            !Object.prototype.hasOwnProperty.call(item, 'body') ||
                            typeof item.body !== 'string') {
                            allValid = false;
                            break;
                        }
                    }
                    if (allValid) {
                        validComments = items;
                    }
                }
            }

            if (likeCount >= 0 && validComments !== null) {
                return { likeCount: likeCount, commentCount: validComments.length, comments: validComments };
            }
            return null;
        }

        function renderSuccess(likeCount, commentCount, force) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;

            likeValueEl.textContent = String(likeCount);
            var likeStatus = likeValueEl.parentElement;
            if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 ' + likeCount + '개');

            if (commentCount === 0) {
                commentValueEl.textContent = '0';
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 없음');
            } else {
                commentValueEl.textContent = commentCount + '개 표시';
                if (commentToggleEl) commentToggleEl.setAttribute('aria-label', '댓글 ' + commentCount + '개 보기');
            }

            removeRetryButton();
            commentToggleEl.removeAttribute('disabled');
        }

        function resetCommentsPanel() {
            if (commentToggleEl) {
                commentToggleEl.setAttribute('disabled', '');
                commentToggleEl.setAttribute('aria-expanded', 'false');
            }
            if (commentPanelEl) commentPanelEl.hidden = true;
            if (commentsListEl) commentsListEl.textContent = '';
            if (commentsPanelStatusEl) commentsPanelStatusEl.textContent = '';
            commentMemoryMeta = null;
            emitPanelState(false);
        }

        function openCommentPanel(commentItems) {
            if (!commentPanelEl || !commentsListEl || !commentsPanelStatusEl) return;
            commentsListEl.textContent = '';

            if (!commentItems || !Array.isArray(commentItems) || commentItems.length === 0) {
                commentsPanelStatusEl.textContent = '아직 댓글이 없어요.';
                commentPanelEl.hidden = false;
                emitPanelState(true);
                return;
            }

            for (var i = 0; i < commentItems.length; i++) {
                var li = document.createElement('li');
                li.textContent = commentItems[i].body;
                commentsListEl.appendChild(li);
            }
            commentsPanelStatusEl.textContent = '';
            commentPanelEl.hidden = false;
            emitPanelState(true);
        }

        function emitPanelState(open) {
            if (typeof onCommentsPanelStateChange !== 'function') return;
            var meta = commentMemoryMeta;
            if (open && meta) {
                onCommentsPanelStateChange({
                    open: true,
                    treeId: meta.treeId,
                    memoryId: meta.memoryId,
                    generation: meta.generation,
                    data: meta.data
                });
            } else {
                onCommentsPanelStateChange({ open: false });
            }
        }

        function renderUnavailable(treeId, memoryId, generation, force) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;
            resetCommentsPanel();

            if (!force) {
                likeValueEl.textContent = '—';
                var likeStatus = likeValueEl.parentElement;
                if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 정보 없음');
                commentValueEl.textContent = '—';
                var commentStatus = commentValueEl.parentElement;
                if (commentStatus) commentStatus.setAttribute('aria-label', '댓글 정보 없음');
                noteEl.textContent = '반응 정보를 불러올 수 없어요.';

                // Add real keyboard-accessible retry button only in unavailable state
                if (!cardEl.querySelector('[data-social-retry="1"]')) {
                    var retryBtn = document.createElement('button');
                    retryBtn.setAttribute('data-social-retry', '1');
                    retryBtn.className = 'editor-retry-button';
                    retryBtn.textContent = '다시 시도';
                    retryBtn.setAttribute('aria-label', '반응 정보 다시 불러오기');
                    retryBtn.type = 'button';
                    retryBtn.onclick = function() {
                        if (generation !== getGeneration()) return;
                        performFetch(treeId, memoryId, generation, false);
                    };
                    cardEl.appendChild(retryBtn);
                }
            } else {
                var statusRegion = document.getElementById('momentReactionLikeStatusRegion');
                if (statusRegion) {
                    statusRegion.textContent = '반응 동기화에 실패했습니다.';
                    statusRegion.style.display = '';
                    setTimeout(function() {
                        if (statusRegion) {
                            statusRegion.style.display = 'none';
                            statusRegion.textContent = '';
                        }
                    }, 4000);
                }
            }
        }

        function performFetch(treeId, memoryId, generation, force, preservePanel) {
            if (!fetchReactionSummary || !fetchComments) {
                if (generation === getGeneration()) {
                    if (sharedGenRef) {
                        sharedGenRef.publicSummaryValid = false;
                    }
                    renderUnavailable(treeId, memoryId, generation, force);
                    if (sharedGenRef && typeof sharedGenRef.onPublicSummarySettled === 'function') {
                        sharedGenRef.onPublicSummarySettled(generation);
                    }
                }
                return;
            }

            setLoadingState(force, preservePanel);

            Promise.all([
                fetchReactionSummary(treeId, memoryId).catch(function() { return null; }),
                fetchComments(treeId, memoryId).catch(function() { return null; })
            ]).then(function(results) {
                if (generation !== getGeneration()) return;
                var reactionData = results[0];
                var commentsData = results[1];
                if (reactionData !== null && commentsData !== null) {
                    var valid = validateSocialDTOs(reactionData, commentsData);
                    if (valid) {
                        if (sharedGenRef) {
                            sharedGenRef.publicSummaryValid = true;
                        }
                        commentMemoryMeta = {
                            memoryId: memoryId,
                            treeId: treeId,
                            generation: generation,
                            comments: valid.comments,
                            data: lastData
                        };
                        renderSuccess(valid.likeCount, valid.commentCount, force);
                        // Wire comment toggle only on success (non-force or first load)
                        if (!force || !commentToggleEl.onclick) {
                            wireCommentToggle(generation, memoryId);
                        }
                        // If preserving panel, re-render comments display
                        if (preservePanel && commentPanelEl && !commentPanelEl.hidden) {
                            if (commentsListEl) commentsListEl.textContent = '';
                            if (commentsPanelStatusEl) commentsPanelStatusEl.textContent = '';
                            if (!valid.comments || valid.comments.length === 0) {
                                commentsPanelStatusEl.textContent = '아직 댓글이 없어요.';
                            } else {
                                for (var i = 0; i < valid.comments.length; i++) {
                                    var li = document.createElement('li');
                                    li.textContent = valid.comments[i].body;
                                    commentsListEl.appendChild(li);
                                }
                            }
                        }
                    } else {
                        if (sharedGenRef) {
                            sharedGenRef.publicSummaryValid = false;
                        }
                        renderUnavailable(treeId, memoryId, generation, force);
                    }
                } else {
                    if (sharedGenRef) {
                        sharedGenRef.publicSummaryValid = false;
                    }
                    renderUnavailable(treeId, memoryId, generation, force);
                }
                if (sharedGenRef && typeof sharedGenRef.onPublicSummarySettled === 'function') {
                    sharedGenRef.onPublicSummarySettled(generation);
                }
            });
        }

        function hideCard() {
            if (!getElements()) return;
            cardEl.style.display = 'none';
            removeRetryButton();
            resetCommentsPanel();
        }

        function wireCommentToggle(gen, memId) {
            if (!commentToggleEl) return;
            commentToggleEl.onclick = function() {
                var currentMeta = commentMemoryMeta;
                if (getGeneration() !== gen) return;
                // A click may set aria-expanded=true only when metadata
                // exists and generation + memoryId both match the current wire.
                if (!currentMeta || currentMeta.generation !== gen || currentMeta.memoryId !== memId) {
                    return;
                }
                var isOpen = commentToggleEl.getAttribute('aria-expanded') === 'true';
                if (isOpen) {
                    commentToggleEl.setAttribute('aria-expanded', 'false');
                    if (commentPanelEl) commentPanelEl.hidden = true;
                    emitPanelState(false);
                } else {
                    commentToggleEl.setAttribute('aria-expanded', 'true');
                    openCommentPanel(currentMeta.comments);
                }
            };
        }

        return function updatePublicViewerReadOnlyReactionSummary(data, force) {
            var preservePanel = false;
            if (force && typeof force === 'object') {
                preservePanel = !!force.preserveCommentsPanel;
                force = !!force.force;
            }
            var context = resolveSocialContext ? resolveSocialContext(data) : null;
            if (!context) {
                hideCard();
                var thisGen = nextGeneration();
                if (sharedGenRef) {
                    sharedGenRef.publicSummaryValid = false;
                }
                lastLoadedMemoryId = null;
                return;
            }

            lastData = data;

            var treeId = context.treeId;
            var memoryId = context.memoryId;

            // Avoid duplicate requests when same moment is rendered repeatedly (debounce window)
            // unless force=true (used for post-write reconciliation)
            if (memoryId === lastLoadedMemoryId && !force) {
                return;
            }

            var thisGen = getGeneration();
            if (!force) {
                thisGen = nextGeneration();
                if (sharedGenRef) {
                    sharedGenRef.publicSummaryValid = false;
                }
            }
            lastLoadedMemoryId = memoryId;

            performFetch(treeId, memoryId, thisGen, force, preservePanel);
        };
    }

    function createPublicViewerAuthenticatedLikeBoundary(deps) {
        var hasConfirmedAuthSession = deps && typeof deps.hasConfirmedAuthSession === 'function'
            ? deps.hasConfirmedAuthSession
            : function() { return false; };
        var fetchReactionSummary = deps && typeof deps.fetchReactionSummary === 'function'
            ? deps.fetchReactionSummary
            : null;
        var toggleReaction = deps && typeof deps.toggleReaction === 'function'
            ? deps.toggleReaction
            : null;
        var isRootMemory = deps && typeof deps.isRootMemory === 'function'
            ? deps.isRootMemory
            : function() { return false; };
        var getCanonicalRootId = deps && typeof deps.getCanonicalRootId === 'function'
            ? deps.getCanonicalRootId
            : function() { return null; };
        var reconcilePublicSummary = deps && typeof deps.reconcilePublicSummary === 'function'
            ? deps.reconcilePublicSummary
            : null;
        var resolveSocialContext = deps && typeof deps.resolveSocialContext === 'function'
            ? deps.resolveSocialContext
            : null;
        var sharedGenRef = deps && deps.sharedGenerationRef;
        var currentGeneration = sharedGenRef ? sharedGenRef.value : 0;

        var lastLikeState = { pressed: false, count: 0 };
        var inFlight = false;
        var lastLoadedMemoryId = null;
        var currentSelectionValid = false;
        var currentSelectionEpoch = 0;
        var nextWriteToken = 0;
        var activeWriteToken = 0;

        var cardEl = null;
        var likeButtonEl = null;
        var guestNoteEl = null;
        var errorEl = null;
        var likeValueEl = null;
        var likeStatusEl = null;
        var commentStatusEl = null;
        var commentValueEl = null;
        var noteEl = null;
        var statusRegionEl = null;
        var treeId = null;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : currentGeneration;
        }

        function getElements() {
            if (!cardEl) cardEl = document.getElementById('momentReactionsCard');
            if (!likeButtonEl) likeButtonEl = document.getElementById('momentReactionLikeButton');
            if (!guestNoteEl) guestNoteEl = document.getElementById('momentReactionLikeGuestNote');
            if (!errorEl) errorEl = document.getElementById('momentReactionWriteError');
            if (!likeValueEl) likeValueEl = document.getElementById('momentReactionLikeValue');
            if (!likeStatusEl) likeStatusEl = document.getElementById('momentReactionLikeStatus');
            if (!commentStatusEl) commentStatusEl = document.getElementById('momentReactionCommentStatus');
            if (!commentValueEl) commentValueEl = document.getElementById('momentReactionCommentValue');
            if (!noteEl) noteEl = document.getElementById('momentReactionNote');
            if (!statusRegionEl) statusRegionEl = document.getElementById('momentReactionLikeStatusRegion');
            return cardEl && likeButtonEl && guestNoteEl && errorEl && likeValueEl && likeStatusEl
                && commentStatusEl && commentValueEl && noteEl && statusRegionEl;
        }

        function setCardReadOnly() {
            if (!getElements()) return;
            cardEl.setAttribute('data-read-only-summary', 'true');
            cardEl.classList.add('is-read-only');
            cardEl.classList.add('is-public-readonly');
            cardEl.setAttribute('aria-label', '순간 반응 (읽기 전용)');
        }

        function setCardActionable() {
            if (!getElements()) return;
            cardEl.removeAttribute('data-read-only-summary');
            cardEl.classList.remove('is-read-only');
            cardEl.classList.remove('is-public-readonly');
            cardEl.setAttribute('aria-label', '순간 반응');
        }

        function hideAuthElements() {
            if (!getElements()) return;
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            likeButtonEl.setAttribute('aria-pressed', 'false');
            likeButtonEl.removeAttribute('aria-busy');
            likeButtonEl.classList.remove('is-pressed');
            likeButtonEl.textContent = '';
            guestNoteEl.style.display = 'none';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
        }

        function showGuestMode() {
            if (!getElements()) return;
            setCardReadOnly();
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            guestNoteEl.style.display = '';
            guestNoteEl.textContent = '로그인하면 좋아요를 남길 수 있어요.';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            noteEl.textContent = '반응 기능은 준비 중이에요.';
        }

        function updateLikeButtonUI(pressed) {
            if (!likeButtonEl) return;
            likeButtonEl.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            likeButtonEl.classList.toggle('is-pressed', pressed);
            likeButtonEl.textContent = pressed ? '❤️ 좋아요 취소' : '❤️ 좋아요';
            likeButtonEl.setAttribute('aria-label', pressed ? '좋아요 취소' : '좋아요 누르기');
        }

        function syncButtonActionableState() {
            if (!getElements()) return;
            if (currentSelectionValid && sharedGenRef && sharedGenRef.publicSummaryValid) {
                likeButtonEl.disabled = inFlight;
            } else {
                likeButtonEl.disabled = true;
            }
            if (inFlight) {
                likeButtonEl.setAttribute('aria-busy', 'true');
            } else {
                likeButtonEl.removeAttribute('aria-busy');
            }
        }

        function showAuthActionable(pressed, count) {
            if (!getElements()) return;
            setCardActionable();
            likeButtonEl.style.display = '';
            updateLikeButtonUI(pressed);
            syncButtonActionableState();
            guestNoteEl.style.display = 'none';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + (parseInt(likeValueEl.textContent, 10) || 0) + '개');
            noteEl.textContent = '댓글 기능은 준비 중이에요.';
        }

        function showAuthUnavailable() {
            if (!getElements()) return;
            setCardReadOnly();
            likeButtonEl.style.display = 'none';
            likeButtonEl.disabled = true;
            guestNoteEl.style.display = '';
            guestNoteEl.textContent = '좋아요 정보를 불러올 수 없어요.';
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            statusRegionEl.style.display = 'none';
            statusRegionEl.textContent = '';
            noteEl.textContent = '반응 기능은 준비 중이에요.';
        }

        function showPoliteNotice(message) {
            if (!getElements()) return;
            errorEl.textContent = message || '';
            errorEl.style.display = '';
            errorEl.setAttribute('role', 'status');
            errorEl.setAttribute('aria-live', 'polite');

            statusRegionEl.textContent = message || '';
            statusRegionEl.style.display = '';
            setTimeout(function() {
                if (errorEl) {
                    errorEl.style.display = 'none';
                    errorEl.textContent = '';
                }
                if (statusRegionEl) {
                    statusRegionEl.style.display = 'none';
                    statusRegionEl.textContent = '';
                }
            }, 4000);
        }

        function validatePrivateDTO(result) {
            if (!result || typeof result !== 'object' || Array.isArray(result)) {
                return null;
            }
            var userReactions = result.userReactions;
            if (!userReactions || typeof userReactions !== 'object' || Array.isArray(userReactions)) {
                return null;
            }
            var counts = result.counts;
            if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
                return null;
            }

            if (Object.prototype.hasOwnProperty.call(userReactions, 'like')) {
                if (typeof userReactions.like !== 'boolean') {
                    return null;
                }
            }

            if (Object.prototype.hasOwnProperty.call(counts, 'like')) {
                var like = counts.like;
                if (typeof like !== 'number' || !Number.isFinite(like) || like < 0 || Math.floor(like) !== like) {
                    return null;
                }
            }

            var pressed = false;
            if (Object.prototype.hasOwnProperty.call(userReactions, 'like')) {
                pressed = userReactions.like;
            }

            var count = null;
            if (Object.prototype.hasOwnProperty.call(counts, 'like')) {
                count = counts.like;
            }

            return {
                pressed: pressed,
                count: count
            };
        }

        function validateWriteResponse(response) {
            if (!response || typeof response !== 'object' || Array.isArray(response)) {
                return null;
            }
            if (response.type !== 'like') {
                return null;
            }
            if (typeof response.active !== 'boolean') {
                return null;
            }
            var counts = response.counts;
            if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
                return null;
            }
            var hasLikeCount = Object.prototype.hasOwnProperty.call(counts, 'like');
            if (response.active === false && !hasLikeCount) {
                return { active: false, count: 0 };
            }
            if (response.active === true && !hasLikeCount) {
                return null;
            }
            var like = counts.like;
            if (typeof like !== 'number' || !Number.isFinite(like) || like < 0 || Math.floor(like) !== like) {
                return null;
            }
            if (response.active === true && like < 1) {
                return null;
            }
            return { active: response.active, count: like };
        }

        function createClickHandler(memoryId, boundEpoch) {
            return function() {
                if (inFlight) return;
                if (!toggleReaction) return;
                if (boundEpoch !== currentSelectionEpoch) return;
                if (memoryId !== lastLoadedMemoryId) return;
                if (!currentSelectionValid) return;

                // Save current state for rollback
                var previousPressed = likeButtonEl.getAttribute('aria-pressed') === 'true';
                var previousCount = parseInt(likeValueEl.textContent, 10) || 0;

                // Optimistic toggle
                var newPressed = !previousPressed;
                var newCount = previousCount + (newPressed ? 1 : -1);
                if (newCount < 0) newCount = 0;

                lastLikeState.pressed = previousPressed;
                lastLikeState.count = previousCount;

                // Update UI optimistically
                updateLikeButtonUI(newPressed);
                likeValueEl.textContent = String(newCount);
                if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + newCount + '개');

                var writeToken = ++nextWriteToken;
                activeWriteToken = writeToken;
                inFlight = true;
                syncButtonActionableState();

                var callEpoch = currentSelectionEpoch;

                toggleReaction(memoryId, 'like').then(function(response) {
                    var ownsActiveWrite = activeWriteToken === writeToken;
                    var stillCurrentSelection =
                        ownsActiveWrite &&
                        callEpoch === currentSelectionEpoch &&
                        memoryId === lastLoadedMemoryId &&
                        currentSelectionValid;

                    if (!ownsActiveWrite) {
                        return;
                    }

                    inFlight = false;
                    activeWriteToken = 0;

                    if (!stillCurrentSelection) {
                        syncButtonActionableState();
                        return;
                    }
                    if (!getElements()) return;

                    // Use response as immediate state
                    var validatedWrite = validateWriteResponse(response);
                    if (!validatedWrite) {
                        updateLikeButtonUI(lastLikeState.pressed);
                        likeValueEl.textContent = String(lastLikeState.count);
                        if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + lastLikeState.count + '개');
                        showPoliteNotice('좋아요를 처리할 수 없어요. 다시 시도해 주세요.');
                        syncButtonActionableState();
                        return;
                    }

                    var active = validatedWrite.active;
                    var responseCount = validatedWrite.count;
                    updateLikeButtonUI(active);
                    likeValueEl.textContent = String(responseCount);
                    if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + responseCount + '개');
                    lastLikeState.pressed = active;
                    lastLikeState.count = responseCount;

                    syncButtonActionableState();

                    // Public reconciliation after successful write
                    if (typeof reconcilePublicSummary === 'function') {
                        reconcilePublicSummary({ id: memoryId, treeId: treeId }, true);
                    }
                }).catch(function() {
                    var ownsActiveWrite = activeWriteToken === writeToken;
                    var stillCurrentSelection =
                        ownsActiveWrite &&
                        callEpoch === currentSelectionEpoch &&
                        memoryId === lastLoadedMemoryId &&
                        currentSelectionValid;

                    if (!ownsActiveWrite) {
                        return;
                    }

                    inFlight = false;
                    activeWriteToken = 0;

                    if (!stillCurrentSelection) {
                        syncButtonActionableState();
                        return;
                    }
                    if (!getElements()) return;

                    // Rollback to previous state
                    updateLikeButtonUI(lastLikeState.pressed);
                    likeValueEl.textContent = String(lastLikeState.count);
                    if (likeStatusEl) likeStatusEl.setAttribute('aria-label', '좋아요 ' + lastLikeState.count + '개');

                    showPoliteNotice('좋아요를 처리할 수 없어요. 다시 시도해 주세요.');
                    syncButtonActionableState();
                });
            };
        }

        function loadPrivateSummary(memoryId, boundEpoch) {
            if (!fetchReactionSummary) {
                showAuthUnavailable();
                return;
            }

            // Fetch private reaction summary to get user's like state
            fetchReactionSummary(memoryId).then(function(result) {
                if (boundEpoch !== currentSelectionEpoch) return;
                if (!getElements()) return;

                var validated = validatePrivateDTO(result);
                if (!validated) {
                    currentSelectionValid = false;
                    showAuthUnavailable();
                    return;
                }

                currentSelectionValid = true;
                lastLikeState.pressed = validated.pressed;

                if (validated.count === null) {
                    var parsedCount = 0;
                    if (likeValueEl && likeValueEl.textContent) {
                        var txt = likeValueEl.textContent.trim();
                        if (txt !== '' && txt !== '⋯' && txt !== '...' && txt !== '—') {
                            var num = parseInt(txt, 10);
                            if (!isNaN(num) && num >= 0) {
                                parsedCount = num;
                            }
                        }
                    }
                    lastLikeState.count = parsedCount;
                } else {
                    lastLikeState.count = validated.count;
                }

                // Wire up click handler for this memory
                likeButtonEl.onclick = createClickHandler(memoryId, boundEpoch);

                if (sharedGenRef && sharedGenRef.publicSummaryValid) {
                    showAuthActionable(validated.pressed, validated.count);
                } else {
                    showAuthUnavailable();
                }
            }).catch(function() {
                if (boundEpoch !== currentSelectionEpoch) return;
                currentSelectionValid = false;
                showAuthUnavailable();
            });
        }

        if (sharedGenRef) {
            sharedGenRef.onPublicSummarySettled = function(generation) {
                if (generation !== getGeneration()) return;
                if (!hasConfirmedAuthSession()) {
                    showGuestMode();
                    return;
                }
                if (sharedGenRef.publicSummaryValid) {
                    if (!currentSelectionValid) {
                        loadPrivateSummary(lastLoadedMemoryId, currentSelectionEpoch);
                    } else {
                        showAuthActionable(lastLikeState.pressed, lastLikeState.count);
                    }
                } else {
                    showAuthUnavailable();
                }
            };
        }

        return function updatePublicViewerAuthenticatedLike(data) {
            var context = resolveSocialContext ? resolveSocialContext(data) : null;
            if (!context) {
                currentSelectionEpoch++;
                hideAuthElements();
                lastLoadedMemoryId = null;
                treeId = null;
                currentSelectionValid = false;
                inFlight = false;
                activeWriteToken = 0;
                return;
            }

            var memTreeId = context.treeId;
            var memoryId = context.memoryId;

            // Memory changed: reset selection valid and save lastLoadedMemoryId
            if (memoryId !== lastLoadedMemoryId || memTreeId !== treeId) {
                currentSelectionEpoch++;
                lastLoadedMemoryId = memoryId;
                treeId = memTreeId;
                currentSelectionValid = false;
                inFlight = false;
                activeWriteToken = 0;
            }

            // Check auth
            var isAuthConfirmed = hasConfirmedAuthSession();

            if (!isAuthConfirmed) {
                showGuestMode();
                return;
            }

            // Auth confirmed: show button as disabled / loading initially
            if (!getElements()) return;
            likeButtonEl.style.display = '';
            updateLikeButtonUI(lastLikeState.pressed);
            syncButtonActionableState();
            guestNoteEl.style.display = 'none';
            guestNoteEl.textContent = '로그인하면 좋아요를 남길 수 있어요.';
            errorEl.style.display = 'none';
            statusRegionEl.style.display = 'none';

            if (sharedGenRef && sharedGenRef.publicSummaryValid) {
                loadPrivateSummary(memoryId, currentSelectionEpoch);
            } else {
                showAuthUnavailable();
            }
        };
    }

    function createPublicViewerAuthenticatedCommentComposerBoundary(deps) {
        var hasConfirmedAuthSession = deps && typeof deps.hasConfirmedAuthSession === 'function'
            ? deps.hasConfirmedAuthSession
            : function() { return false; };
        var createComment = deps && typeof deps.createComment === 'function'
            ? deps.createComment
            : null;
        var reconcilePublicSummary = deps && typeof deps.reconcilePublicSummary === 'function'
            ? deps.reconcilePublicSummary
            : null;
        var sharedGenRef = deps && deps.sharedGenerationRef;

        var composerFormEl = null;
        var composerInputEl = null;
        var composerErrorEl = null;
        var composerSuccessEl = null;
        var composerDraftIdemKey = null;
        var composerDraftBody = null;
        var activeContext = null;
        var composerInstanceToken = 0;

        function getGeneration() {
            return sharedGenRef ? sharedGenRef.value : 0;
        }

        function removeComposerDom() {
            if (composerFormEl && composerFormEl.parentNode) {
                composerFormEl.parentNode.removeChild(composerFormEl);
            }
            composerFormEl = null;
            composerInputEl = null;
            composerErrorEl = null;
            composerSuccessEl = null;
        }

        function deactivateComposer() {
            removeComposerDom();
            activeContext = null;
            composerDraftIdemKey = null;
            composerDraftBody = null;
            composerInstanceToken++;
        }

        function appendComposerDom(panelEl, context, instanceToken) {
            if (!panelEl) return;
            removeComposerDom();

            composerInputEl = document.createElement('textarea');
            composerInputEl.setAttribute('aria-label', '댓글 입력');
            composerInputEl.placeholder = '댓글을 입력하세요...';
            composerInputEl.rows = 2;
            composerInputEl.maxLength = 5000;
            composerInputEl.style.width = '100%';
            composerInputEl.style.boxSizing = 'border-box';

            var submitBtn = document.createElement('button');
            submitBtn.textContent = '등록';
            submitBtn.type = 'button';

            composerErrorEl = document.createElement('p');
            composerErrorEl.setAttribute('aria-live', 'polite');
            composerErrorEl.style.color = 'red';
            composerErrorEl.style.fontSize = '0.85em';
            composerErrorEl.style.margin = '4px 0 0';
            composerErrorEl.style.display = 'none';

            composerSuccessEl = document.createElement('p');
            composerSuccessEl.setAttribute('aria-live', 'polite');
            composerSuccessEl.textContent = '댓글이 등록되었습니다.';
            composerSuccessEl.style.color = 'green';
            composerSuccessEl.style.fontSize = '0.85em';
            composerSuccessEl.style.margin = '4px 0 0';
            composerSuccessEl.style.display = 'none';

            composerFormEl = document.createElement('div');
            composerFormEl.style.display = 'flex';
            composerFormEl.style.flexDirection = 'column';
            composerFormEl.style.gap = '4px';
            composerFormEl.style.marginTop = '8px';

            var inputRow = document.createElement('div');
            inputRow.style.display = 'flex';
            inputRow.style.gap = '8px';
            inputRow.appendChild(composerInputEl);
            inputRow.appendChild(submitBtn);

            composerFormEl.appendChild(inputRow);
            composerFormEl.appendChild(composerErrorEl);
            composerFormEl.appendChild(composerSuccessEl);

            // Reset draft for new composer instance
            composerDraftIdemKey = null;
            composerDraftBody = null;

            submitBtn.onclick = function() {
                if (submitBtn.disabled) return;
                var body = (composerInputEl.value || '').trim();
                if (!body) return;
                if (body.length > 5000) {
                    composerErrorEl.textContent = '댓글은 5,000자 이하로 입력해주세요.';
                    composerErrorEl.style.display = '';
                    return;
                }
                if (!activeContext) return;

                // Capture immutable submission context for async race safety
                var subCtx = {
                    instanceToken: composerInstanceToken,
                    treeId: activeContext.treeId,
                    memoryId: activeContext.memoryId,
                    generation: getGeneration(),
                    data: activeContext.data
                };
                if (!subCtx.treeId || !subCtx.memoryId) return;

                if (body !== composerDraftBody) {
                    composerDraftIdemKey = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
                    composerDraftBody = body;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = '등록 중...';
                composerErrorEl.style.display = 'none';
                composerSuccessEl.style.display = 'none';

                createComment(subCtx.memoryId, body, composerDraftIdemKey).then(function() {
                    if (composerInstanceToken !== subCtx.instanceToken) return;
                    if (!activeContext || activeContext.treeId !== subCtx.treeId ||
                        activeContext.memoryId !== subCtx.memoryId) return;

                    submitBtn.disabled = false;
                    submitBtn.textContent = '등록';
                    composerInputEl.value = '';
                    composerDraftIdemKey = null;
                    composerDraftBody = null;
                    composerErrorEl.style.display = 'none';
                    composerSuccessEl.style.display = '';

                    if (subCtx.generation === getGeneration()) {
                        reconcilePublicSummary(subCtx.data, { force: true, preserveCommentsPanel: true });
                    }
                }).catch(function() {
                    if (composerInstanceToken !== subCtx.instanceToken) return;
                    if (!activeContext || activeContext.treeId !== subCtx.treeId ||
                        activeContext.memoryId !== subCtx.memoryId) return;

                    submitBtn.disabled = false;
                    submitBtn.textContent = '등록';
                    composerSuccessEl.style.display = 'none';
                    composerErrorEl.textContent = '댓글을 등록하지 못했습니다. 다시 시도해주세요.';
                    composerErrorEl.style.display = '';
                });
            };

            panelEl.appendChild(composerFormEl);
        }

        return function updatePublicViewerAuthenticatedCommentComposer(state) {
            if (!state || !state.open || typeof createComment !== 'function' || !hasConfirmedAuthSession()) {
                deactivateComposer();
                return;
            }
            var panelEl = document.getElementById('momentCommentsPanel');
            if (!panelEl || panelEl.hidden) {
                deactivateComposer();
                return;
            }

            var newContext = {
                memoryId: state.memoryId,
                treeId: state.treeId,
                data: state.data,
                generation: state.generation !== undefined ? state.generation : (sharedGenRef ? sharedGenRef.value : 0)
            };

            // Mount order: remove old DOM → set new context → increment token → append new DOM
            removeComposerDom();
            activeContext = newContext;
            composerInstanceToken++;
            appendComposerDom(panelEl, activeContext, composerInstanceToken);
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

        return function updatePublicViewerTreeMeta(data) {
            var treeMetaMount = document.getElementById('detailTreeMetaMount');
            if (!treeMetaMount || !boundary) return;

            var currentTree = getCurrentTreeData() || {};
            var treeState = getTreeState();
            var isEmptyState = !!(data && data.isNewTree) && !treeState.hasMoments;
            var localSaveMode = getLocalSaveMode();
            var treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');

            var model = boundary.buildTreeMetaRenderModel({
                currentTree: currentTree,
                treeState: treeState,
                data: data,
                isEmptyState: isEmptyState,
                localSaveMode: localSaveMode
            });

            boundary.renderTreeMetaBoundary(treeMetaMount, model, treeId, data);
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
