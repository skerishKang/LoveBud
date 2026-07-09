/**
 * public-viewer-tree-like.js — Tree-level like toggle control
 *
 * Activated after #3361 runtime verification. Provides an authenticated
 * whole-tree like toggle in the tree identity / header band area.
 *
 * State machine:
 *   inactive (guest) → disabled button, no click handler
 *   inactive (auth, not liked) → actionable, aria-pressed=false
 *   active (auth, liked) → actionable, aria-pressed=true
 *   pending → disabled, aria-busy=true
 *   failure → rollback to last authoritative state, safe error toast
 *
 * Idempotency-Key: one stable key per intentional user action.
 * Fast repeated clicks during pending are suppressed (no duplicate keys).
 * Same-key replay from the server returns authoritative DTO (no double toggle).
 *
 * Refs #3369, #3356, #3361, #3188
 */
(function () {
    'use strict';

    window.LoveBudTreeLikeControl = {
        createTreeLikeControl: null  // set below
    };

    function createTreeLikeControl(deps) {
        var hasConfirmedAuthSession = deps && typeof deps.hasConfirmedAuthSession === 'function'
            ? deps.hasConfirmedAuthSession
            : function () { return false; };
        var getAuthToken = deps && typeof deps.getAuthToken === 'function'
            ? deps.getAuthToken
            : function () { return null; };
        var i18n = deps && typeof deps.i18n === 'function'
            ? deps.i18n
            : function (k, fb) { return fb; };
        var showToast = deps && typeof deps.showToast === 'function'
            ? deps.showToast
            : function () {};
        var treeId = deps && deps.treeId;
        var initialActive = deps && deps.initialActive === true;
        var initialCount = (deps && typeof deps.initialCount === 'number') ? deps.initialCount : 0;
        var formatCompactCount = deps && typeof deps.formatCompactCount === 'function'
            ? deps.formatCompactCount
            : function (n) { return String(n); };
        var resolveTreeTitleText = deps && typeof deps.resolveTreeTitleText === 'function'
            ? deps.resolveTreeTitleText
            : function (t) { return t; };

        var isGuest = !hasConfirmedAuthSession();
        var currentActive = initialActive;
        var currentCount = initialCount;
        var inFlight = false;
        var pendingKey = null;

        // --- DOM elements ---
        var container = document.createElement('div');
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.gap = '4px';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '4px';
        btn.style.minHeight = '32px';
        btn.style.padding = '4px 12px';
        btn.style.borderRadius = '999px';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '700';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease';
        btn.style.border = '1px solid rgba(144,73,81,0.10)';
        btn.style.boxShadow = '0 6px 16px rgba(75, 64, 57, 0.06)';
        btn.style.background = initialActive
            ? 'linear-gradient(180deg, rgba(230,80,90,0.98), rgba(230,80,90,0.90))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
        btn.style.color = initialActive ? '#fff' : 'var(--primary)';

        btn.addEventListener('mouseenter', function () {
            if (!btn.disabled) btn.style.transform = 'translateY(-1px)';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.transform = 'translateY(0)';
        });

        // Icon span (heart)
        var iconSpan = document.createElement('span');
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.style.fontSize = '14px';
        iconSpan.style.lineHeight = '1';
        iconSpan.textContent = currentActive ? '❤️' : '🤍';
        btn.appendChild(iconSpan);

        // Count label
        var countSpan = document.createElement('span');
        countSpan.textContent = formatCompactCount(currentCount);
        btn.appendChild(countSpan);

        if (isGuest) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'default';
            btn.setAttribute('aria-label', i18n('viewer.treeLikeGuest', '트리 좋아요 (로그인 필요)', 'Tree like (sign in required)'));
            btn.setAttribute('title', i18n('viewer.treeLikeGuestTitle', '로그인하면 좋아요를 누를 수 있어요', 'Sign in to like this tree'));
        } else {
            btn.setAttribute('aria-pressed', currentActive ? 'true' : 'false');
            btn.setAttribute('aria-label', currentActive
                ? i18n('viewer.treeLikeActiveLabel', '트리 좋아요 취소 ({count}개)', 'Unlike tree ({count})', { count: currentCount })
                : i18n('viewer.treeLikeInactiveLabel', '트리 좋아요 ({count}개)', 'Like tree ({count})', { count: currentCount }));
            btn.addEventListener('click', handleClick);
        }

        container.appendChild(btn);

        // --- Public API ---
        function getElement() {
            return container;
        }

        function updateState(active, count) {
            currentActive = active;
            currentCount = count;
            countSpan.textContent = formatCompactCount(count);
            iconSpan.textContent = active ? '❤️' : '🤍';
            btn.style.background = active
                ? 'linear-gradient(180deg, rgba(230,80,90,0.98), rgba(230,80,90,0.90))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
            btn.style.color = active ? '#fff' : 'var(--primary)';
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.setAttribute('aria-label', active
                ? i18n('viewer.treeLikeActiveLabel', '트리 좋아요 취소 ({count}개)', 'Unlike tree ({count})', { count: count })
                : i18n('viewer.treeLikeInactiveLabel', '트리 좋아요 ({count}개)', 'Like tree ({count})', { count: count }));
        }

        function setLoading(isLoading) {
            inFlight = isLoading;
            btn.disabled = isLoading;
            if (isLoading) {
                btn.setAttribute('aria-busy', 'true');
            } else {
                btn.removeAttribute('aria-busy');
            }
        }

        function rollback(prevActive, prevCount) {
            setLoading(false);
            updateState(prevActive, prevCount);
        }

        function handleClick() {
            if (inFlight || isGuest) return;
            if (!treeId) return;

            var token = getAuthToken();

            var idempotencyKey = 'tlk-' + crypto.randomUUID();
            pendingKey = idempotencyKey;

            // Optimistic toggle
            var prevActive = currentActive;
            var prevCount = currentCount;
            var optimisticActive = !prevActive;
            var optimisticCount = prevCount + (optimisticActive ? 1 : -1);
            if (optimisticCount < 0) optimisticCount = 0;

            updateState(optimisticActive, optimisticCount);
            setLoading(true);

            var url = '/api/trees/' + encodeURIComponent(treeId) + '/likes';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);

            // Register handlers BEFORE any send (required for Promise path)
            xhr.onload = function () {
                if (xhr.status !== 200) {
                    rollback(prevActive, prevCount);
                    if (xhr.status === 401 || xhr.status === 403) {
                        showToast(i18n('viewer.treeLikeAuthError', '좋아요를 처리할 수 없습니다. 다시 로그인해 주세요.', 'Please sign in again'), 'error');
                    } else {
                        showToast(i18n('viewer.treeLikeError', '좋아요 처리 중 오류가 발생했습니다', 'Failed to update like'), 'error');
                    }
                    return;
                }
                try {
                    var dto = JSON.parse(xhr.responseText);
                    if (dto && typeof dto.treeId === 'string' && typeof dto.active === 'boolean' && typeof dto.likeCount === 'number') {
                        setLoading(false);
                        updateState(dto.active, dto.likeCount);
                    } else {
                        rollback(prevActive, prevCount);
                        showToast(i18n('viewer.treeLikeUnexpectedResponse', '예상치 못한 응답입니다', 'Unexpected response'), 'error');
                    }
                } catch (e) {
                    rollback(prevActive, prevCount);
                    showToast(i18n('viewer.treeLikeUnexpectedResponse', '예상치 못한 응답입니다', 'Unexpected response'), 'error');
                }
            };

            xhr.onerror = function () {
                rollback(prevActive, prevCount);
                showToast(i18n('viewer.treeLikeNetworkError', '네트워크 오류가 발생했습니다', 'Network error'), 'error');
            };

            // Single send helper — called exactly once per mutation
            function sendWithToken(realToken) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + realToken);
                xhr.setRequestHeader('Idempotency-Key', idempotencyKey);
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.send();
            }

            // Resolve token: Promise or synchronous, then dispatch via sendWithToken
            if (token && typeof token.then === 'function') {
                token.then(function(realToken) {
                    if (!realToken) {
                        rollback(prevActive, prevCount);
                        showToast(i18n('viewer.treeLikeAuthMissing', '로그인이 필요합니다', 'Sign in required'), 'error');
                        return;
                    }
                    sendWithToken(realToken);
                }).catch(function() {
                    rollback(prevActive, prevCount);
                    showToast(i18n('viewer.treeLikeAuthMissing', '로그인이 필요합니다', 'Sign in required'), 'error');
                });
                return;
            }

            if (!token) {
                rollback(prevActive, prevCount);
                showToast(i18n('viewer.treeLikeAuthMissing', '로그인이 필요합니다', 'Sign in required'), 'error');
                return;
            }

            sendWithToken(token);
        }

        return {
            getElement: getElement,
            updateState: updateState,
            setLoading: setLoading,
            btn: btn
        };
    }

    window.LoveBudTreeLikeControl.createTreeLikeControl = createTreeLikeControl;
})();
