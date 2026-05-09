/*
 * LoveBud shared page transition and reveal behavior.
 *
 * Asset-only: pages must explicitly include this script and opt in with
 * transition/reveal classes. If no opt-in nodes exist, this script is a no-op.
 */

(function () {
    'use strict';

    var VISIBLE_CLASS = 'is-visible';
    var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
    var ROOT_SELECTOR = '.page-transition-enter';
    var REVEAL_SELECTOR = '.reveal-up, .reveal-fade, .reveal-scale';

    function safely(fn) {
        try {
            fn();
        } catch (error) {
            if (window.console && typeof window.console.warn === 'function') {
                window.console.warn('[page-transitions] skipped:', error);
            }
        }
    }

    function prefersReducedMotion() {
        return Boolean(
            window.matchMedia &&
            window.matchMedia(REDUCED_MOTION_QUERY).matches
        );
    }

    function markVisible(node) {
        if (!node || !node.classList) return;
        node.classList.add(VISIBLE_CLASS);
    }

    function collectOptInNodes(root) {
        var scope = root || document;
        var nodes = [];

        if (scope.querySelectorAll) {
            nodes = Array.prototype.slice.call(
                scope.querySelectorAll(ROOT_SELECTOR + ', ' + REVEAL_SELECTOR)
            );
        }

        if (scope.matches && scope.matches(ROOT_SELECTOR + ', ' + REVEAL_SELECTOR)) {
            nodes.unshift(scope);
        }

        return nodes;
    }

    function setRevealIndexes(nodes) {
        var index = 0;

        nodes.forEach(function (node) {
            if (!node || !node.classList) return;
            if (!node.matches || !node.matches(REVEAL_SELECTOR)) return;
            if (node.style && !node.style.getPropertyValue('--reveal-index')) {
                node.style.setProperty('--reveal-index', String(index));
            }
            index += 1;
        });
    }

    function revealNodes(nodes) {
        if (!nodes || nodes.length === 0) return;

        setRevealIndexes(nodes);

        if (prefersReducedMotion()) {
            nodes.forEach(markVisible);
            return;
        }

        window.requestAnimationFrame(function () {
            nodes.forEach(markVisible);
        });
    }

    function init(root) {
        safely(function () {
            var nodes = collectOptInNodes(root);
            revealNodes(nodes);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            init(document);
        }, { once: true });
    } else {
        init(document);
    }

    window.LoveBudPageTransitions = {
        init: init
    };
})();
