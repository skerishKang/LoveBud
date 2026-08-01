(function() {
    'use strict';

    // Shared modal accessibility lifecycle (Issue #3795 / decision #3788).
    //
    // Bounded lifecycle authority for the six core true-modal surfaces. Owns
    // only the accessibility lifecycle: live focusable discovery, initial
    // focus after visibility, Tab/Shift+Tab containment, Escape close with a
    // configurable busy gate, guarded focus restoration, reference-counted
    // body scroll locking, and idempotent open/close/dispose listener
    // cleanup. Every visual shell, backdrop policy, media/form/Auth behavior,
    // inert/aria-hidden background handling, and page-owned close logic stays
    // in the surface controller.

    function isElementLike(value) {
        return !!value && (typeof value === 'object');
    }

    function isNodeConnected(el) {
        return el.isConnected !== false;
    }

    function isRendered(el, win) {
        // Hidden attribute / explicit hidden state.
        if (el.hidden === true) return false;
        // Disabled / inert.
        if (el.disabled === true) return false;
        if (el.hasAttribute && el.hasAttribute('inert')) return false;
        if (el.closest && el.closest('[inert]')) return false;
        // Computed visibility / display when getComputedStyle is available.
        var winRef = win || (typeof window !== 'undefined' ? window : null);
        if (winRef && typeof winRef.getComputedStyle === 'function') {
            var cs;
            try {
                cs = winRef.getComputedStyle(el);
            } catch (err) {
                cs = null;
            }
            if (cs) {
                if (cs.display === 'none') return false;
                if (cs.visibility === 'hidden') return false;
            }
        }
        // Geometry check: rendered boxes exist.
        if (typeof el.getClientRects === 'function') {
            try {
                if (el.getClientRects().length === 0) return false;
            } catch (err) {
                // Fall through to offsetParent heuristic.
            }
        } else if (typeof el.offsetParent !== 'undefined') {
            if (el.offsetParent === null && el.getAttribute && el.getAttribute('position') !== 'fixed') {
                return false;
            }
        }
        return true;
    }

    function getComputedVisibility(el, win) {
        return isRendered(el, win);
    }

    window.LoveBudModalA11y = Object.freeze({
        createLifecycle: function createLifecycle(options) {
            options = options || {};
            var doc = options.documentRef || (typeof document !== 'undefined' ? document : null);
            var win = options.windowRef || (typeof window !== 'undefined' ? window : null);

            var getModal = typeof options.getModal === 'function' ? options.getModal : function() { return null; };
            var isOpen = typeof options.isOpen === 'function' ? options.isOpen : function() { return false; };
            var onRequestClose = typeof options.onRequestClose === 'function' ? options.onRequestClose : function() {};
            var canClose = typeof options.canClose === 'function' ? options.canClose : function() { return true; };
            var getInitialFocus = typeof options.getInitialFocus === 'function' ? options.getInitialFocus : function() { return null; };
            var getRestoreFocus = typeof options.getRestoreFocus === 'function' ? options.getRestoreFocus : function() { return null; };
            var onFallbackFocus = typeof options.onFallbackFocus === 'function' ? options.onFallbackFocus : function() {};
            var onNoFocusable = typeof options.onNoFocusable === 'function' ? options.onNoFocusable : function() {};

            var focusinContain = !!options.focusinContain;
            var bindTarget = options.bindTarget === 'modal' ? 'modal' : 'document';
            var scrollLockEnabled = !!options.scrollLock;
            var escapeStopPropagation = !!options.escapeStopPropagation;
            var escapePreventDefault = options.escapePreventDefault !== false;

            var bound = false;
            var disposed = false;
            var scrollToken = null;

            // ── Live focusable discovery (recomputed per keyboard event) ──
            function getFocusables(modal) {
                if (!modal || typeof modal.querySelectorAll !== 'function') return [];
                var selector = 'button:not([disabled]), [href]:not([tabindex="-1"]), ' +
                    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), ' +
                    '[tabindex]:not([tabindex="-1"])';
                var nodes;
                try {
                    nodes = modal.querySelectorAll(selector);
                } catch (err) {
                    return [];
                }
                var result = [];
                for (var i = 0; i < nodes.length; i++) {
                    var el = nodes[i];
                    if (!isNodeConnected(el)) continue;
                    if (typeof el.tabIndex === 'number' && el.tabIndex === -1) continue;
                    if (!isRendered(el, win)) continue;
                    result.push(el);
                }
                return result;
            }

            function focusElement(el) {
                if (!el || typeof el.focus !== 'function') return false;
                try {
                    el.focus();
                    return true;
                } catch (err) {
                    return false;
                }
            }

            function resolveTarget(resolver) {
                if (typeof resolver !== 'function') return resolver;
                var target = resolver();
                if (typeof target === 'string' && doc && typeof doc.querySelector === 'function') {
                    try {
                        return doc.querySelector(target);
                    } catch (err) {
                        return null;
                    }
                }
                return isElementLike(target) ? target : null;
            }

            // ── Tab containment + Escape (exactly one close request) ──
            function handleKeydown(event) {
                if (disposed) return false;
                if (!event || !event.key) return false;
                if (!isOpen()) return false;
                var modal = getModal();
                if (!modal) return false;

                if (event.key === 'Escape') {
                    if (typeof canClose === 'function' && canClose() === false) {
                        if (escapePreventDefault) event.preventDefault();
                        return true;
                    }
                    if (escapeStopPropagation) event.stopPropagation();
                    if (escapePreventDefault) event.preventDefault();
                    onRequestClose();
                    return true;
                }

                if (event.key === 'Tab') {
                    var focusables = getFocusables(modal);
                    if (focusables.length === 0) {
                        if (onNoFocusable) onNoFocusable();
                        return false;
                    }
                    var active = doc ? doc.activeElement : null;
                    var first = focusables[0];
                    var last = focusables[focusables.length - 1];
                    if (event.shiftKey) {
                        if (active === first || (active && !modal.contains(active))) {
                            event.preventDefault();
                            focusElement(last);
                            return true;
                        }
                    } else if (active === last || (active && !modal.contains(active))) {
                        event.preventDefault();
                        focusElement(first);
                        return true;
                    }
                    return false;
                }

                return false;
            }

            // ── Optional focusin containment (Home media boundary) ──
            function handleFocusIn(event) {
                if (disposed) return;
                if (!isOpen()) return;
                var modal = getModal();
                if (!modal) return;
                var target = event && event.target;
                if (!target || modal.contains(target)) return;
                var focusables = getFocusables(modal);
                var first = focusables[0] || focusables[focusables.length - 1] || null;
                if (first) focusElement(first);
            }

            // ── Initial focus only after visible + attached ──
            function focusInitial() {
                if (disposed) return false;
                var modal = getModal();
                if (!modal || !isNodeConnected(modal)) return false;
                if (!getComputedVisibility(modal, win)) return false;
                var target = resolveTarget(getInitialFocus);
                if (!target) return false;
                return focusElement(target);
            }

            // ── Guarded focus restoration ──
            function isRestorable(target) {
                if (!isElementLike(target)) return false;
                if (typeof target.focus !== 'function') return false;
                if (isNodeConnected(target) === false) return false;
                if (target.hidden === true) return false;
                if (target.disabled === true) return false;
                if (!isRendered(target, win)) return false;
                return true;
            }

            function restoreFocusElement(target) {
                if (disposed) return false;
                if (isRestorable(target)) {
                    return focusElement(target);
                }
                if (onFallbackFocus) onFallbackFocus();
                return false;
            }

            function restoreFocus() {
                return restoreFocusElement(resolveTarget(getRestoreFocus));
            }

            // ── Reference-counted body scroll lock (per-document ownership) ──
            var scrollRegistry = getScrollRegistry();

            function getScrollRegistry() {
                var registry = window.LoveBudModalA11yScrollRegistry;
                if (!registry) {
                    registry = new WeakMap();
                    try {
                        Object.defineProperty(window, 'LoveBudModalA11yScrollRegistry', {
                            value: registry,
                            writable: false,
                            configurable: false
                        });
                    } catch (err) {
                        // Non-configurable environments: fall back to a per-call map.
                        window.LoveBudModalA11yScrollRegistry = registry;
                    }
                }
                return registry;
            }

            function getScrollState() {
                if (!doc) return null;
                var state = scrollRegistry.get(doc);
                if (!state) {
                    state = { count: 0, previousValue: null, tokens: new Set() };
                    scrollRegistry.set(doc, state);
                }
                return state;
            }

            function lockScroll() {
                if (disposed) return null;
                if (!doc || !doc.body) return null;
                var state = getScrollState();
                if (!state) return null;
                var token = {};
                state.tokens.add(token);
                if (state.count === 0) {
                    state.previousValue = doc.body.style.overflow;
                }
                state.count++;
                doc.body.style.overflow = 'hidden';
                return token;
            }

            function unlockScroll(token) {
                if (disposed) return;
                if (!token) return;
                if (!doc || !doc.body) return;
                var state = getScrollState();
                if (!state || !state.tokens.has(token)) return;
                state.tokens.delete(token);
                state.count = Math.max(0, state.count - 1);
                if (state.count === 0) {
                    doc.body.style.overflow = state.previousValue || '';
                    state.previousValue = null;
                }
            }

            // ── Listener lifecycle (idempotent) ──
            function getBindTarget() {
                if (bindTarget === 'modal') return getModal();
                return doc;
            }

            function bind() {
                if (bound || disposed) return;
                var target = getBindTarget();
                if (!target || typeof target.addEventListener !== 'function') return;
                target.addEventListener('keydown', handleKeydown);
                if (focusinContain && doc && typeof doc.addEventListener === 'function') {
                    doc.addEventListener('focusin', handleFocusIn, true);
                }
                bound = true;
            }

            function unbind() {
                if (!bound) return;
                var target = getBindTarget();
                if (target && typeof target.removeEventListener === 'function') {
                    target.removeEventListener('keydown', handleKeydown);
                }
                if (focusinContain && doc && typeof doc.removeEventListener === 'function') {
                    doc.removeEventListener('focusin', handleFocusIn, true);
                }
                bound = false;
            }

            // ── Public API ──
            return {
                bind: bind,
                unbind: unbind,
                handleKeydown: handleKeydown,
                handleFocusIn: handleFocusIn,
                focusInitial: focusInitial,
                restoreFocus: restoreFocus,
                restoreFocusElement: restoreFocusElement,
                isRestorable: isRestorable,
                lockScroll: lockScroll,
                unlockScroll: unlockScroll,
                getFocusables: function() { return getFocusables(getModal()); },
                open: function() {
                    if (disposed) return false;
                    bind();
                    if (scrollLockEnabled && !scrollToken) {
                        scrollToken = lockScroll();
                    }
                    return focusInitial();
                },
                close: function() {
                    if (disposed) return false;
                    unbind();
                    if (scrollToken) {
                        unlockScroll(scrollToken);
                        scrollToken = null;
                    }
                    return true;
                },
                dispose: function() {
                    if (disposed) return false;
                    unbind();
                    if (scrollToken) {
                        unlockScroll(scrollToken);
                        scrollToken = null;
                    }
                    disposed = true;
                    return true;
                },
                isDisposed: function() { return disposed; },
                isBound: function() { return bound; }
            };
        }
    });
})();
