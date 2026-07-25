/**
 * LoveBud Browse Story View Controller
 * Issue #3655 — Story view foundation (parent #3654)
 *
 * Opt-in fourth Browse view mode (`story`) that focuses on 1–3 of the
 * already-rendered LoveTree cards at a time, with previous/next arrows
 * and a local position indicator.
 *
 * Scope boundaries (foundation child):
 *   - Groups ONLY the currently loaded `#resultsList` cards. The position
 *     indicator is a LOCAL group index over loaded results — it is NOT a
 *     backend page number and no server pagination semantics are added.
 *   - Reuses the canonical rendered `.tree-card[data-tree-id]` DOM built by
 *     LoveBudTreeCardComposition via js/search/search-card-renderer.js.
 *     No card HTML is rebuilt, no card content is rewritten, no new card
 *     routes are created, and the canonical appreciation route is untouched.
 *   - Pure presentation controller: no network capability of any kind,
 *     no data fetching, no filtering/sorting, no generated content,
 *     no timed advance / wraparound behaviour.
 *   - My Trees never receives this mode; the shared switcher keeps the
 *     three base modes unless a surface opts in via `modes`.
 *
 * Public API (`window.LoveBudBrowseStoryView`):
 *   - init({ results, navMount }) -> controller | null
 *
 * Controller surface:
 *   - setMode(mode): activate on 'story', fully restore on any other mode
 *   - refresh(): re-collect cards and re-sync the current group
 *   - getCurrentGroup() / getGroupCount(): local group index / count
 *   - destroy(): remove all listeners, nav DOM, and restore every card
 *
 * Load order: after js/tree-view-mode-switcher.js, before
 * js/search/search-page-shell-init.js (which calls init and setMode).
 */
(function () {
    'use strict';

    var STORY_MODE = 'story';
    var GROUP_SIZE_ATTR = 'data-story-group-size';
    var DIRECTION_ATTR = 'data-story-direction';
    var VISIBLE_CLASS = 'is-story-visible';
    var ENTERING_CLASS = 'is-story-entering';
    var NAV_CLASS = 'browse-story-navigation';
    var EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

    /* Minimal fallbacks mirror js/i18n/i18n-search.js (same repository
     * pattern as js/search/search-card-renderer.js empty-state copy). */
    var FALLBACK_STRINGS = {
        'search.story.regionLabel': { ko: '스토리 보기', en: 'Story view' },
        'search.story.previous': { ko: '이전 스토리 그룹', en: 'Previous story group' },
        'search.story.next': { ko: '다음 스토리 그룹', en: 'Next story group' },
        'search.story.position': { ko: '스토리 {current} / {total}', en: 'Story {current} of {total}' }
    };

    function resolveElement(target) {
        if (!target) return null;
        if (typeof target === 'string') return document.querySelector(target);
        if (typeof target === 'function') return target();
        return target;
    }

    function getCurrentLocale() {
        try {
            var lang =
                (window.i18n && window.i18n.currentLang) ||
                (typeof window.getCurrentLang === 'function' ? window.getCurrentLang() : '') ||
                (document.documentElement && document.documentElement.lang) ||
                'ko';
            return String(lang).toLowerCase().indexOf('en') === 0 ? 'en' : 'ko';
        } catch (e) {
            return 'ko';
        }
    }

    function t(key) {
        var locale = getCurrentLocale();
        var dict = window.i18nSearch;
        var entry = dict && typeof dict === 'object' ? dict[key] : null;
        if (entry && typeof entry === 'object' && typeof entry[locale] === 'string') {
            return entry[locale];
        }
        var fallback = FALLBACK_STRINGS[key];
        if (fallback) return fallback[locale] || fallback.ko;
        return key;
    }

    function pad2(value) {
        var s = String(value);
        return s.length < 2 ? '0' + s : s;
    }

    function buildIcon(name) {
        var icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = name;
        return icon;
    }

    function init(options) {
        var opts = options || {};
        var results = resolveElement(opts.results || '#resultsList');
        var navMount = resolveElement(opts.navMount || '#browseStoryNavMount');
        if (!results) return null;

        var active = false;
        var disposed = false;
        var cards = [];
        var groupIndex = 0;
        var groupSize = computeGroupSize();
        var nav = null;
        var prevBtn = null;
        var nextBtn = null;
        var indicatorCurrent = null;
        var indicatorA11y = null;
        var observer = null;

        var mediaWide = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1200px)') : null;
        var mediaMid = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)') : null;

        function computeGroupSize() {
            if (mediaWide && mediaWide.matches) return 3;
            if (mediaMid && mediaMid.matches) return 2;
            return 1;
        }

        /* Canonical rendered Browse cards only: direct children of the
         * results list carrying data-tree-id. Skeleton cards, empty/error
         * states, and demo badges are excluded. Order is preserved — no
         * sort, dedupe, or filtering beyond node type. */
        function collectCards() {
            var out = [];
            var children = results.children;
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (!child.classList || !child.classList.contains('tree-card')) continue;
                if (child.classList.contains('search-skeleton-card')) continue;
                if (!child.hasAttribute('data-tree-id')) continue;
                out.push(child);
            }
            return out;
        }

        function groupCount() {
            if (cards.length === 0) return 0;
            return Math.ceil(cards.length / groupSize);
        }

        function clampIndex(index) {
            var count = groupCount();
            if (count === 0) return 0;
            if (index < 0) return 0;
            if (index > count - 1) return count - 1;
            return index;
        }

        function ensureNav() {
            if (nav || !navMount) return;

            nav = document.createElement('nav');
            nav.className = NAV_CLASS;
            nav.setAttribute('aria-label', t('search.story.regionLabel'));
            nav.hidden = true;

            prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'browse-story-nav-btn browse-story-nav-prev';
            prevBtn.setAttribute('data-story-prev', '');
            prevBtn.setAttribute('aria-label', t('search.story.previous'));
            prevBtn.appendChild(buildIcon('arrow_back'));
            prevBtn.addEventListener('click', function (event) {
                event.preventDefault();
                step(-1);
            });

            var indicator = document.createElement('span');
            indicator.className = 'browse-story-indicator';
            indicator.setAttribute('role', 'status');
            indicatorCurrent = document.createElement('span');
            indicatorCurrent.className = 'browse-story-indicator-current';
            indicatorCurrent.setAttribute('aria-hidden', 'true');
            indicatorA11y = document.createElement('span');
            indicatorA11y.className = 'browse-story-indicator-a11y';
            indicator.appendChild(indicatorCurrent);
            indicator.appendChild(indicatorA11y);

            nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'browse-story-nav-btn browse-story-nav-next';
            nextBtn.setAttribute('data-story-next', '');
            nextBtn.setAttribute('aria-label', t('search.story.next'));
            nextBtn.appendChild(buildIcon('arrow_forward'));
            nextBtn.addEventListener('click', function (event) {
                event.preventDefault();
                step(1);
            });

            nav.appendChild(prevBtn);
            nav.appendChild(indicator);
            nav.appendChild(nextBtn);
            navMount.appendChild(nav);
        }

        function updateNav() {
            if (!nav) return;
            var count = groupCount();
            if (count === 0) {
                nav.hidden = true;
                return;
            }
            nav.hidden = false;
            indicatorCurrent.textContent = pad2(groupIndex + 1) + ' / ' + pad2(count);
            indicatorA11y.textContent = t('search.story.position')
                .replace('{current}', String(groupIndex + 1))
                .replace('{total}', String(count));
            prevBtn.disabled = groupIndex <= 0;
            nextBtn.disabled = groupIndex >= count - 1;
        }

        function applyGroup(direction) {
            if (!active) return;
            groupIndex = clampIndex(groupIndex);

            var start = groupIndex * groupSize;
            var end = Math.min(start + groupSize, cards.length);
            var i;

            for (i = 0; i < cards.length; i++) {
                cards[i].classList.remove(ENTERING_CLASS);
            }

            for (i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (i >= start && i < end) {
                    /* hidden=false + helper class; the [hidden] attribute is
                     * the single source of truth for a11y/tree exclusion. */
                    card.hidden = false;
                    card.classList.add(VISIBLE_CLASS);
                } else {
                    card.hidden = true;
                    card.classList.remove(VISIBLE_CLASS);
                }
            }

            var visibleCount = Math.max(0, end - start);
            if (visibleCount > 0) {
                results.setAttribute(GROUP_SIZE_ATTR, String(visibleCount));
            } else {
                results.removeAttribute(GROUP_SIZE_ATTR);
            }

            if (direction === 'next' || direction === 'prev') {
                results.setAttribute(DIRECTION_ATTR, direction);
                /* Restart the enter animation on the freshly visible group. */
                void results.offsetWidth;
                for (i = start; i < end; i++) {
                    cards[i].classList.add(ENTERING_CLASS);
                }
            }

            updateNav();
        }

        function step(delta) {
            if (!active) return;
            var next = clampIndex(groupIndex + delta);
            if (next === groupIndex) return;
            groupIndex = next;
            applyGroup(delta > 0 ? 'next' : 'prev');
        }

        function goTo(index) {
            if (!active) return;
            var next = clampIndex(index);
            if (next === groupIndex) return;
            var direction = next > groupIndex ? 'next' : 'prev';
            groupIndex = next;
            applyGroup(direction);
        }

        function restoreAllCards() {
            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                card.hidden = false;
                card.classList.remove(VISIBLE_CLASS);
                card.classList.remove(ENTERING_CLASS);
            }
            results.removeAttribute(GROUP_SIZE_ATTR);
            results.removeAttribute(DIRECTION_ATTR);
        }

        function deactivate() {
            if (!active) return;
            active = false;
            restoreAllCards();
            if (nav) nav.hidden = true;
            cards = [];
            groupIndex = 0;
        }

        function setMode(mode) {
            if (disposed) return;
            if (mode === STORY_MODE) {
                if (active) return;
                active = true;
                cards = collectCards();
                groupIndex = 0;
                groupSize = computeGroupSize();
                ensureNav();
                applyGroup(null);
                return;
            }
            deactivate();
        }

        function refresh() {
            if (disposed || !active) return;
            cards = collectCards();
            applyGroup(null);
        }

        /* Search/filter/sort/load-more replace #resultsList children via
         * innerHTML. Re-collect and reset to the first group on a new
         * result set; clamp otherwise. No blank group is ever shown and
         * no extra request is triggered from this side. */
        function onResultsMutated() {
            if (disposed || !active) return;
            var next = collectCards();
            var changed = next.length !== cards.length;
            if (!changed) {
                for (var i = 0; i < next.length; i++) {
                    if (next[i] !== cards[i]) {
                        changed = true;
                        break;
                    }
                }
            }
            cards = next;
            if (changed) groupIndex = 0;
            applyGroup(null);
        }

        function onKeyDown(event) {
            if (disposed || !active) return;
            var key = event.key;
            if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
            if (event.repeat) return;
            var target = event.target;
            if (target) {
                if (target.isContentEditable) return;
                if (typeof target.closest === 'function' && target.closest(EDITABLE_SELECTOR)) return;
            }
            if (key === 'ArrowLeft') step(-1);
            else if (key === 'ArrowRight') step(1);
            else if (key === 'Home') goTo(0);
            else goTo(groupCount() - 1);
            event.preventDefault();
        }

        function onBreakpointChange() {
            if (disposed || !active) return;
            var next = computeGroupSize();
            if (next === groupSize) return;
            groupSize = next;
            applyGroup(null);
        }

        if (typeof MutationObserver === 'function') {
            observer = new MutationObserver(onResultsMutated);
            /* childList only: visibility toggles are attribute mutations and
             * therefore never feed back into the observer. */
            observer.observe(results, { childList: true });
        }
        document.addEventListener('keydown', onKeyDown);

        /* Build the (hidden) navigation shell up front so the control is
         * present-but-hidden in every non-Story mode and show/hide is a
         * pure state flip while Story is active. */
        ensureNav();
        if (mediaWide) {
            if (typeof mediaWide.addEventListener === 'function') mediaWide.addEventListener('change', onBreakpointChange);
            else if (typeof mediaWide.addListener === 'function') mediaWide.addListener(onBreakpointChange);
        }
        if (mediaMid) {
            if (typeof mediaMid.addEventListener === 'function') mediaMid.addEventListener('change', onBreakpointChange);
            else if (typeof mediaMid.addListener === 'function') mediaMid.addListener(onBreakpointChange);
        }

        function destroy() {
            if (disposed) return;
            deactivate();
            disposed = true;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            document.removeEventListener('keydown', onKeyDown);
            if (mediaWide) {
                if (typeof mediaWide.removeEventListener === 'function') mediaWide.removeEventListener('change', onBreakpointChange);
                else if (typeof mediaWide.removeListener === 'function') mediaWide.removeListener(onBreakpointChange);
            }
            if (mediaMid) {
                if (typeof mediaMid.removeEventListener === 'function') mediaMid.removeEventListener('change', onBreakpointChange);
                else if (typeof mediaMid.removeListener === 'function') mediaMid.removeListener(onBreakpointChange);
            }
            if (nav && nav.parentNode) {
                nav.parentNode.removeChild(nav);
            }
            nav = null;
            prevBtn = null;
            nextBtn = null;
            indicatorCurrent = null;
            indicatorA11y = null;
        }

        return {
            setMode: setMode,
            refresh: refresh,
            getCurrentGroup: function () { return groupIndex; },
            getGroupCount: groupCount,
            destroy: destroy
        };
    }

    var api = { init: init };

    if (typeof window !== 'undefined') {
        window.LoveBudBrowseStoryView = api;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.LoveBudBrowseStoryView === 'undefined') {
        globalThis.LoveBudBrowseStoryView = api;
    }
})();
