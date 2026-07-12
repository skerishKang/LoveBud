(function () {
    'use strict';

    function createEditorMomentCommentsController() {
        var currentMemoryId = null;
        var generation = 0;
        var loadedMemoryId = null;
        var isSubmitting = false;
        var bound = false;

        function getElements() {
            return {
                panel: document.getElementById('momentCommentsPanel'),
                list: document.getElementById('momentCommentsList'),
                status: document.getElementById('momentCommentsPanelStatus'),
                form: document.getElementById('momentCommentComposer'),
                input: document.getElementById('momentCommentInput'),
                submit: document.getElementById('momentCommentSubmitBtn'),
                feedback: document.getElementById('momentCommentFeedback'),
                commentButton: document.getElementById('momentCommentBtn'),
                commentCount: document.getElementById('momentCommentCount')
            };
        }

        function extractComments(payload) {
            if (Array.isArray(payload)) return payload;
            if (payload && Array.isArray(payload.comments)) return payload.comments;
            return [];
        }

        function formatDate(value) {
            if (!value) return '';
            var parsed = new Date(value);
            if (!Number.isFinite(parsed.getTime())) return '';
            try {
                return new Intl.DateTimeFormat('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }).format(parsed);
            } catch (error) {
                return '';
            }
        }

        function setFeedback(message, tone) {
            var elements = getElements();
            if (!elements.feedback) return;
            elements.feedback.textContent = message || '';
            elements.feedback.dataset.tone = tone || '';
        }

        function setSubmitting(nextSubmitting) {
            var elements = getElements();
            isSubmitting = nextSubmitting;
            if (elements.input) elements.input.disabled = nextSubmitting;
            if (elements.submit) {
                elements.submit.disabled = nextSubmitting;
                var label = elements.submit.querySelector('span:last-child');
                if (label) label.textContent = nextSubmitting ? '등록 중' : '등록';
            }
        }

        function renderComments(comments) {
            var elements = getElements();
            if (!elements.list || !elements.status) return;
            var validComments = comments.filter(function (comment) {
                return comment && typeof comment.body === 'string';
            });

            elements.list.replaceChildren();
            if (!validComments.length) {
                elements.status.textContent = '아직 댓글이 없어요. 이 순간의 첫 마음을 남겨보세요.';
                elements.status.dataset.state = 'empty';
            } else {
                elements.status.textContent = '';
                elements.status.dataset.state = 'ready';
            }

            validComments.forEach(function (comment) {
                var item = document.createElement('li');
                item.className = 'editor-moment-comment-item';

                var meta = document.createElement('div');
                meta.className = 'editor-moment-comment-meta';

                var author = document.createElement('strong');
                author.textContent = String(comment.authorDisplayLabel || '익명');
                meta.appendChild(author);

                var dateText = formatDate(comment.createdAt || comment.created_at);
                if (dateText) {
                    var date = document.createElement('time');
                    date.textContent = dateText;
                    meta.appendChild(date);
                }

                var body = document.createElement('p');
                body.textContent = comment.body;

                item.appendChild(meta);
                item.appendChild(body);
                elements.list.appendChild(item);
            });

            elements.list.scrollTop = elements.list.scrollHeight;

            if (elements.commentCount) elements.commentCount.textContent = String(validComments.length);
        }

        async function loadComments(requestGeneration, preserveFeedback) {
            var elements = getElements();
            var api = window.apiClient;
            var memoryId = currentMemoryId;

            if (!memoryId || !elements.panel) return;
            elements.panel.hidden = false;
            if (!preserveFeedback) setFeedback('', '');

            if (!api || typeof api.fetchComments !== 'function') {
                if (elements.status) elements.status.textContent = '댓글 기능을 불러오지 못했어요.';
                return;
            }

            if (elements.status) {
                elements.status.textContent = '댓글을 불러오는 중이에요.';
                elements.status.dataset.state = 'loading';
            }

            try {
                var payload = await api.fetchComments(memoryId);
                if (requestGeneration !== generation || memoryId !== currentMemoryId) return;
                var comments = extractComments(payload);
                renderComments(comments);
                loadedMemoryId = memoryId;
            } catch (error) {
                if (requestGeneration !== generation || memoryId !== currentMemoryId) return;
                if (elements.status) {
                    elements.status.textContent = '댓글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
                    elements.status.dataset.state = 'error';
                }
            }
        }

        async function submitComment(event) {
            event.preventDefault();
            if (isSubmitting || !currentMemoryId) return;

            var elements = getElements();
            var body = String(elements.input?.value || '').trim();
            if (!body) {
                setFeedback('댓글 내용을 입력해 주세요.', 'error');
                if (elements.input) elements.input.focus();
                return;
            }

            var api = window.apiClient;
            if (!api || typeof api.createComment !== 'function') {
                setFeedback('댓글 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.', 'error');
                return;
            }

            var memoryId = currentMemoryId;
            var requestGeneration = generation;
            setSubmitting(true);
            setFeedback('', '');

            try {
                await api.createComment(memoryId, body);
                if (requestGeneration !== generation || memoryId !== currentMemoryId) return;
                if (elements.input) elements.input.value = '';
                setFeedback('댓글을 남겼어요.', 'success');
                await loadComments(requestGeneration, true);
            } catch (error) {
                if (requestGeneration !== generation || memoryId !== currentMemoryId) return;
                setFeedback('댓글을 남기지 못했어요. 다시 시도해 주세요.', 'error');
            } finally {
                if (requestGeneration === generation && memoryId === currentMemoryId) {
                    setSubmitting(false);
                }
            }
        }

        function bind() {
            if (bound) return;
            var elements = getElements();
            if (!elements.form) return;
            bound = true;

            elements.form.addEventListener('submit', submitComment);
            if (elements.input) {
                elements.input.addEventListener('input', function () {
                    if (elements.feedback?.dataset.tone === 'error') setFeedback('', '');
                });
            }
            if (elements.commentButton) {
                elements.commentButton.addEventListener('click', function () {
                    var currentElements = getElements();
                    if (!currentElements.input) return;
                    currentElements.input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    currentElements.input.focus({ preventScroll: true });
                });
            }
        }

        function update(context) {
            var memoryId = context && context.memoryId ? String(context.memoryId) : '';
            if (!memoryId) {
                hide();
                return;
            }

            bind();
            var changed = currentMemoryId !== memoryId;
            currentMemoryId = memoryId;
            var elements = getElements();
            if (elements.panel) elements.panel.hidden = false;

            if (changed) {
                generation += 1;
                loadedMemoryId = null;
                setSubmitting(false);
                if (elements.input) elements.input.value = '';
                setFeedback('', '');
            }

            if (loadedMemoryId !== memoryId) loadComments(generation, false);
        }

        function hide() {
            generation += 1;
            currentMemoryId = null;
            loadedMemoryId = null;
            setSubmitting(false);
            var elements = getElements();
            if (elements.list) elements.list.replaceChildren();
            if (elements.status) elements.status.textContent = '';
            if (elements.input) elements.input.value = '';
            setFeedback('', '');
        }

        return {
            update: update,
            hide: hide,
            refresh: function () {
                if (!currentMemoryId) return;
                loadedMemoryId = null;
                loadComments(generation, true);
            }
        };
    }

    window.createEditorMomentCommentsController = createEditorMomentCommentsController;
})();
