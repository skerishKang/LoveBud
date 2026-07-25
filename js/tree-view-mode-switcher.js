/**
 * LoveBud Tree View Mode Switcher
 *
 * Shared view-mode controller for Browse (`#resultsList`) and My LoveTree
 * (`.trees-grid`). Pure presentation helper — no fetch, no storage I/O beyond
 * localStorage, no API calls, no DB or schema changes.
 *
 * Public API (`window.LoveBudTreeViewModeSwitcher`):
 *   - MODES: ordered list of base modes shared by every surface
 *   - KNOWN_MODES: every mode the switcher can render, including
 *     surface-specific opt-in modes (e.g. Browse-only `story`, #3655)
 *   - LABELS: user-facing labels per mode
 *   - ICONS: Material Symbols icon per mode
 *   - getMode(storageKey, defaultMode, allowedModes?): read mode from localStorage
 *   - setMode(storageKey, mode, allowedModes?): write mode to localStorage
 *   - applyMode(target, mode, allowedModes?): set `data-tree-view-mode` on target
 *   - createControl(options): build a keyboard-accessible mode button group
 *     (options.modes: surface-specific capability list, defaults to MODES)
 *   - init(options): wire control + target together with default + observer
 *     (options.modes: surface-specific capability list, defaults to MODES)
 *
 * Surface-specific capability (#3655): `allowedModes` / `options.modes`
 * default to the three base MODES, so existing callers (My Trees) keep
 * exactly large/compact/list without any change. Browse opts in to the
 * fourth `story` mode by passing `modes: ['large', 'compact', 'list', 'story']`.
 * A stored value outside a surface's capability (e.g. `story` on My Trees)
 * is treated as invalid and falls back to the default — the stored value
 * is never deleted or rewritten.
 *
 * The helper is intentionally data-attribute driven so existing layouts stay
 * intact and view mode is the only thing that changes per user choice.
 */
(function () {
    'use strict';

    var MODES = ['large', 'compact', 'list'];
    var KNOWN_MODES = ['large', 'compact', 'list', 'story'];
    var LABELS = {
        large: '큰 카드',
        compact: '작은 카드',
        list: '목록',
        story: '스토리'
    };
    var ICONS = {
        large: 'dashboard',
        compact: 'grid_view',
        list: 'view_list',
        story: 'auto_stories'
    };
    var STORAGE_PREFIX = 'lovebud:';
    var DATA_ATTR = 'data-tree-view-mode';

    /**
     * Normalize a surface-specific capability list. Unknown tokens are
     * dropped, duplicates removed, and the result is a fresh array so
     * callers can never mutate internal mode state. Empty/invalid input
     * falls back to the three base MODES (backward-compatible default).
     */
    function normalizeAllowedModes(allowedModes) {
        if (!Array.isArray(allowedModes) || allowedModes.length === 0) {
            return MODES.slice();
        }
        var seen = {};
        var out = [];
        allowedModes.forEach(function (mode) {
            if (typeof mode !== 'string') return;
            if (KNOWN_MODES.indexOf(mode) === -1) return;
            if (seen[mode]) return;
            seen[mode] = true;
            out.push(mode);
        });
        if (out.length === 0) return MODES.slice();
        return out;
    }

    function isValidMode(mode, allowedModes) {
        if (typeof mode !== 'string') return false;
        if (KNOWN_MODES.indexOf(mode) === -1) return false;
        return normalizeAllowedModes(allowedModes).indexOf(mode) !== -1;
    }

    function safeLocalStorage() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return null;
            var probeKey = STORAGE_PREFIX + '__probe__';
            window.localStorage.setItem(probeKey, '1');
            window.localStorage.removeItem(probeKey);
            return window.localStorage;
        } catch (e) {
            return null;
        }
    }

    function getMode(storageKey, defaultMode, allowedModes) {
        var allowed = normalizeAllowedModes(allowedModes);
        var fallback = isValidMode(defaultMode, allowed) ? defaultMode : allowed[0];
        var store = safeLocalStorage();
        if (!store || !storageKey) return fallback;
        try {
            var value = store.getItem(storageKey);
            if (isValidMode(value, allowed)) return value;
        } catch (e) {
            // ignore
        }
        return fallback;
    }

    function setMode(storageKey, mode, allowedModes) {
        if (!isValidMode(mode, allowedModes)) return false;
        var store = safeLocalStorage();
        if (!store || !storageKey) return false;
        try {
            store.setItem(storageKey, mode);
            return true;
        } catch (e) {
            return false;
        }
    }

    function applyMode(target, mode, allowedModes) {
        if (!target) return false;
        if (!isValidMode(mode, allowedModes)) return false;
        target.setAttribute(DATA_ATTR, mode);
        return true;
    }

    function resolveTarget(target) {
        if (!target) return null;
        if (typeof target === 'string') {
            return document.querySelector(target);
        }
        if (typeof target === 'function') {
            return target();
        }
        return target;
    }

    function createButton(mode, currentMode) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tree-view-mode-btn';
        btn.setAttribute('data-mode', mode);
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(mode === currentMode));
        btn.setAttribute('aria-label', LABELS[mode] || mode);
        btn.title = LABELS[mode] || mode;
        var icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = ICONS[mode] || 'view_module';
        var label = document.createElement('span');
        label.className = 'tree-view-mode-label';
        label.textContent = LABELS[mode] || mode;
        btn.appendChild(icon);
        btn.appendChild(label);
        return btn;
    }

    function createControl(options) {
        var opts = options || {};
        var storageKey = opts.storageKey;
        var allowed = normalizeAllowedModes(opts.modes);
        var defaultMode = isValidMode(opts.defaultMode, allowed) ? opts.defaultMode : allowed[0];
        if (!storageKey) {
            throw new Error('LoveBudTreeViewModeSwitcher.createControl: storageKey is required');
        }

        var initial = getMode(storageKey, defaultMode, allowed);
        var wrapper = document.createElement('div');
        wrapper.className = 'tree-view-mode-control';
        wrapper.setAttribute('role', 'radiogroup');
        wrapper.setAttribute('aria-label', '보기 방식');
        wrapper.setAttribute('data-initial-mode', initial);

        var buttons = {};
        allowed.forEach(function (mode) {
            var btn = createButton(mode, initial);
            buttons[mode] = btn;
            wrapper.appendChild(btn);
        });

        function setActive(mode) {
            if (!isValidMode(mode, allowed)) return;
            Object.keys(buttons).forEach(function (key) {
                buttons[key].setAttribute('aria-checked', String(key === mode));
                if (key === mode) {
                    buttons[mode].classList.add('is-active');
                } else {
                    buttons[key].classList.remove('is-active');
                }
            });
        }

        allowed.forEach(function (mode) {
            buttons[mode].addEventListener('click', function (event) {
                event.preventDefault();
                if (!isValidMode(mode, allowed)) return;
                setMode(storageKey, mode, allowed);
                setActive(mode);
                var resolved = resolveTarget(opts.target);
                applyMode(resolved, mode, allowed);
                if (typeof opts.onChange === 'function') {
                    try {
                        opts.onChange(mode, resolved);
                    } catch (e) {
                        // ignore consumer errors
                    }
                }
            });
        });

        setActive(initial);
        return {
            element: wrapper,
            initialMode: initial,
            setActive: setActive
        };
    }

    function init(options) {
        var opts = options || {};
        var storageKey = opts.storageKey;
        var allowed = normalizeAllowedModes(opts.modes);
        var defaultMode = isValidMode(opts.defaultMode, allowed) ? opts.defaultMode : allowed[0];
        if (!storageKey) {
            throw new Error('LoveBudTreeViewModeSwitcher.init: storageKey is required');
        }

        // Source of truth for the user's current view-mode choice. Starts at
        // whatever is persisted (or the default), and is updated whenever a
        // button is clicked. The observer reads THIS — not a one-shot
        // capture of the initial value — so a re-rendered target always
        // receives the latest selected mode.
        var currentMode = getMode(storageKey, defaultMode, allowed);

        var mount = resolveTarget(opts.mount);
        if (!mount) return null;

        var control = createControl({
            storageKey: storageKey,
            defaultMode: defaultMode,
            target: opts.target,
            modes: allowed,
            onChange: function (mode) {
                currentMode = mode;
                if (typeof opts.onChange === 'function') {
                    try {
                        opts.onChange(mode, resolveTarget(opts.target));
                    } catch (e) {
                        // ignore consumer errors
                    }
                }
            }
        });
        mount.appendChild(control.element);

        var resolved = resolveTarget(opts.target);
        if (resolved) {
            applyMode(resolved, currentMode, allowed);
        }

        var observer = null;
        if (opts.observeTarget !== false && typeof MutationObserver === 'function' && typeof opts.target === 'string') {
            var targetSelector = opts.target;
            observer = new MutationObserver(function () {
                var node = document.querySelector(targetSelector);
                if (!node) return;
                // Re-read the latest mode on every mutation. This handles:
                //   - click events that updated currentMode + localStorage
                //   - cross-tab preference changes (storage events would
                //     also be a future improvement)
                // Never use a captured `initial` value — that path caused
                // the .trees-grid re-render to revert to the page default.
                var latest = getMode(storageKey, defaultMode, allowed);
                if (!isValidMode(latest, allowed)) latest = currentMode;
                if (node.getAttribute(DATA_ATTR) === latest) return;
                applyMode(node, latest, allowed);
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }

        return {
            control: control,
            storageKey: storageKey,
            initialMode: currentMode,
            getCurrentMode: function () { return currentMode; },
            observer: observer,
            detach: function () {
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                if (control.element.parentNode) {
                    control.element.parentNode.removeChild(control.element);
                }
            }
        };
    }

    var api = {
        MODES: Object.freeze(MODES.slice()),
        KNOWN_MODES: Object.freeze(KNOWN_MODES.slice()),
        LABELS: LABELS,
        ICONS: ICONS,
        STORAGE_PREFIX: STORAGE_PREFIX,
        DATA_ATTR: DATA_ATTR,
        getMode: getMode,
        setMode: setMode,
        applyMode: applyMode,
        createControl: createControl,
        init: init
    };

    if (typeof window !== 'undefined') {
        window.LoveBudTreeViewModeSwitcher = api;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.LoveBudTreeViewModeSwitcher === 'undefined') {
        globalThis.LoveBudTreeViewModeSwitcher = api;
    }
})();
