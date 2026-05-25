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
    var MY_TREES_PATH_PATTERN = /(?:^|\/)my-trees\/?$/;
    var myTreesScrollResetQueued = false;

    function safely(fn) {
        try {
            fn();
        } catch (error) {
            if (window.console && typeof window.console.warn === 'function') {
                window.console.warn('[page-transitions] skipped:', error);
            }
        }
    }

    function isMyTreesPage() {
        return MY_TREES_PATH_PATTERN.test(window.location.pathname || '');
    }

    function resetMyTreesScrollPosition() {
        if (!isMyTreesPage()) return;

        try {
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'manual';
            }
        } catch (error) {}

        try {
            window.scrollTo(0, 0);
            var scrollingElement = document.scrollingElement || document.documentElement || document.body;
            if (scrollingElement) scrollingElement.scrollTop = 0;
            if (document.documentElement) document.documentElement.scrollTop = 0;
            if (document.body) document.body.scrollTop = 0;
        } catch (error) {}
    }

    function scheduleMyTreesScrollReset() {
        if (!isMyTreesPage()) return;
        resetMyTreesScrollPosition();
        if (myTreesScrollResetQueued) return;
        myTreesScrollResetQueued = true;

        var finish = function () {
            myTreesScrollResetQueued = false;
            resetMyTreesScrollPosition();
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(finish);
        } else {
            setTimeout(finish, 0);
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
            scheduleMyTreesScrollReset();
            return;
        }

        window.requestAnimationFrame(function () {
            nodes.forEach(markVisible);
            scheduleMyTreesScrollReset();
        });
    }

    function init(root) {
        safely(function () {
            scheduleMyTreesScrollReset();
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

    window.addEventListener('pageshow', function () {
        scheduleMyTreesScrollReset();
    });

    window.LoveBudPageTransitions = {
        init: init
    };
})();
