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

        var currentGeneration = 0;
        var lastLoadedMemoryId = null;
        var cardEl = null;
        var likeValueEl = null;
        var commentValueEl = null;
        var noteEl = null;

        function getElements() {
            if (!cardEl) cardEl = document.getElementById('momentReactionsCard');
            if (!likeValueEl) likeValueEl = document.getElementById('momentReactionLikeValue');
            if (!commentValueEl) commentValueEl = document.getElementById('momentReactionCommentValue');
            if (!noteEl) noteEl = document.getElementById('momentReactionNote');
            return cardEl && likeValueEl && commentValueEl && noteEl;
        }

        function setLoadingState() {
            if (!getElements()) return;
            cardEl.style.display = '';
            cardEl.dataset.socialLoading = 'true';
            cardEl.setAttribute('data-read-only-summary', 'true');
            cardEl.classList.add('is-read-only');
            cardEl.classList.add('is-public-readonly');
            cardEl.setAttribute('aria-label', '순간 반응 (읽기 전용)');
            likeValueEl.textContent = '⋯';
            commentValueEl.textContent = '⋯';
            var likeStatus = likeValueEl.parentElement;
            var commentStatus = commentValueEl.parentElement;
            if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 불러오는 중');
            if (commentStatus) commentStatus.setAttribute('aria-label', '댓글 불러오는 중');
            noteEl.textContent = '반응 기능은 준비 중이에요.';
            removeRetryButton();
        }

        function removeRetryButton() {
            if (!cardEl) return;
            var existingRetry = cardEl.querySelector('[data-social-retry="1"]');
            if (existingRetry && existingRetry.parentElement) {
                existingRetry.parentElement.removeChild(existingRetry);
            }
        }

        function renderSuccess(reactionData, commentsData) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;

            // Like aggregate from reaction DTO
            var likeCount = 0;
            if (reactionData && typeof reactionData === 'object') {
                if (Array.isArray(reactionData.reactions)) {
                    likeCount = reactionData.reactions.filter(function(r) {
                        return r && r.type === 'like';
                    }).length;
                } else if (typeof reactionData.likeCount === 'number') {
                    likeCount = reactionData.likeCount;
                } else if (reactionData.count !== undefined) {
                    likeCount = Number(reactionData.count) || 0;
                }
            }
            likeValueEl.textContent = String(likeCount);
            var likeStatus = likeValueEl.parentElement;
            if (likeStatus) likeStatus.setAttribute('aria-label', '좋아요 ' + likeCount + '개');

            // Bounded comment count — never claim unbounded total
            var commentCount = 0;
            if (commentsData && typeof commentsData === 'object') {
                if (Array.isArray(commentsData.comments)) {
                    commentCount = commentsData.comments.length;
                } else if (Array.isArray(commentsData)) {
                    commentCount = commentsData.length;
                } else if (typeof commentsData.count === 'number') {
                    commentCount = commentsData.count;
                }
            }

            if (commentCount === 0) {
                commentValueEl.textContent = '0';
                var commentStatus = commentValueEl.parentElement;
                if (commentStatus) commentStatus.setAttribute('aria-label', '댓글 없음');
            } else {
                commentValueEl.textContent = commentCount + '개 표시';
                var commentStatus = commentValueEl.parentElement;
                if (commentStatus) commentStatus.setAttribute('aria-label', '댓글 ' + commentCount + '개 표시');
            }

            noteEl.textContent = '반응 기능은 준비 중이에요.';
            removeRetryButton();
        }

        function renderUnavailable(treeId, memoryId, generation) {
            if (!getElements()) return;
            delete cardEl.dataset.socialLoading;
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
                    if (generation !== currentGeneration) return;
                    performFetch(treeId, memoryId, generation);
                };
                cardEl.appendChild(retryBtn);
            }
        }

        function performFetch(treeId, memoryId, generation) {
            if (!fetchReactionSummary || !fetchComments) {
                if (generation === currentGeneration) renderUnavailable(treeId, memoryId, generation);
                return;
            }

            setLoadingState();

            Promise.all([
                fetchReactionSummary(treeId, memoryId).catch(function() { return null; }),
                fetchComments(treeId, memoryId).catch(function() { return null; })
            ]).then(function(results) {
                if (generation !== currentGeneration) return;
                var reactionData = results[0];
                var commentsData = results[1];
                if (reactionData !== null && commentsData !== null) {
                    renderSuccess(reactionData, commentsData);
                } else {
                    renderUnavailable(treeId, memoryId, generation);
                }
            });
        }

        function hideCard() {
            if (!getElements()) return;
            cardEl.style.display = 'none';
            removeRetryButton();
        }

        return function updatePublicViewerReadOnlyReactionSummary(data) {
            var rootId = getCanonicalRootId();
            var treeId = data && data.treeId;
            var memoryId = data && data.id;

            // Root moment, empty state, missing memory/tree ID: hide card, issue no request
            if (!data || !treeId || !memoryId || isRootMemory(data, rootId)) {
                hideCard();
                currentGeneration++;
                lastLoadedMemoryId = null;
                return;
            }

            // Avoid duplicate requests when same moment is rendered repeatedly (debounce window)
            if (memoryId === lastLoadedMemoryId) {
                return;
            }

            currentGeneration++;
            lastLoadedMemoryId = memoryId;
            var thisGen = currentGeneration;

            performFetch(treeId, memoryId, thisGen);
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
        var updateReadOnlyReactionSummary = createPublicViewerReadOnlyReactionSummaryBoundary(deps);

        detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps);
        detailUI.updateSidebarStatus = createPublicViewerSidebarStatusUpdater(deps);
        detailUI.setDetailEmptyState = createPublicViewerSetDetailEmptyState(deps);

        var lastDetailKey = null;
        var lastDetailAt = 0;

        detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data) {
            var now = Date.now();
            var memoryId = data ? data.id : null;
            if (memoryId && lastDetailKey === memoryId && (now - lastDetailAt) < 150) {
                updateReadOnlyReactionSummary(data);
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
            updateReadOnlyReactionSummary(data);
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
        createPublicViewerTreeMetaBoundary: createPublicViewerTreeMetaBoundary,
        delegatesToEditorDetailUI: false
    };
})();
