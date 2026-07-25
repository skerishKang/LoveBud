/**
 * LoveBud #3655 Browse Story View Foundation — Static Contract Test
 *
 * Refs #3655 (implementation child). Parent #3654 stays OPEN.
 * Baseline: b3bcdda7d69fe98d447df41fddcd9edcde4e20cd
 *
 * Locks the foundation contract:
 *   - a Browse-only opt-in fourth view mode `story` on the shared switcher
 *     (surface-specific capability; My Trees keeps exactly large/compact/list)
 *   - default Browse mode stays `compact`; existing stored modes preserved;
 *     invalid/out-of-capability storage falls back WITHOUT rewrite
 *   - the Story controller is a pure presentation module: canonical cards
 *     reused, local loaded-results grouping only, no server pagination,
 *     no fetch/API/DB/auth capability, no framework, no autoplay/looping
 *   - minimal nav (previous / local position / next), no numbered pages
 *   - Browse-scoped selectors, reduced-motion support, i18n keys present
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const storyModule = read('js/search/search-story-view.js');
const switcherModule = read('js/tree-view-mode-switcher.js');
const browseInit = read('js/search/search-page-shell-init.js');
const myTreesBootstrap = read('js/my-trees/my-trees-page-bootstrap.js');
const searchHtml = read('pages/search.html');
const myTreesHtml = read('pages/my-trees.html');
const viewModeCss = read('css/tree-view-mode.css');
const i18nSearch = read('js/i18n/i18n-search.js');
const cardRenderer = read('js/search/search-card-renderer.js');
const storyDoc = read('docs/product/lovebud-browse-story-view-foundation-contract.md');

function stripJsComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

/* ── Switcher sandbox (same pattern as tree-view-mode-switcher contract) ── */
function loadSwitcher(store) {
    const sandbox = {
        window: {
            localStorage: {
                getItem: (k) => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k)
            }
        },
        globalThis: {}
    };
    sandbox.globalThis = sandbox.window;
    sandbox.window.document = { addEventListener: () => {} };
    const fn = new Function('window', 'globalThis', switcherModule);
    fn(sandbox.window, sandbox.globalThis);
    return sandbox.globalThis.LoveBudTreeViewModeSwitcher;
}

const BROWSE_MODES = ['large', 'compact', 'list', 'story'];

/* ── 1) Story module exists and is wired into the Browse page ───────── */
test('1. Story module exists and exposes window.LoveBudBrowseStoryView.init', () => {
    assert.match(storyModule, /window\.LoveBudBrowseStoryView\s*=\s*api/);
    assert.match(storyModule, /init:\s*init/);
    assert.match(storyModule, /setMode/);
    assert.match(storyModule, /destroy/);
});

test('2. Search page loads the Story module', () => {
    assert.match(searchHtml, /src="\.\.\/js\/search\/search-story-view\.js\?v=[^"]+"/);
});

test('3. Story module loads before the page-shell initializer', () => {
    const storyIdx = searchHtml.indexOf('<script src="../js/search/search-story-view.js');
    const initIdx = searchHtml.indexOf('<script src="../js/search/search-page-shell-init.js');
    const switcherIdx = searchHtml.indexOf('<script src="../js/tree-view-mode-switcher.js');
    assert.ok(storyIdx !== -1, 'story module script tag present');
    assert.ok(initIdx !== -1, 'page-shell init script tag present');
    assert.ok(switcherIdx !== -1, 'switcher script tag present');
    assert.ok(switcherIdx < storyIdx, 'switcher must load before story module');
    assert.ok(storyIdx < initIdx, 'story module must load before page-shell initializer');
});

test('no new inline script blocks added to search.html', () => {
    assert.ok(!searchHtml.includes('LoveBudBrowseStoryView.init(') || /src="[^"]*search-story-view\.js/.test(searchHtml));
    assert.ok(!/LoveBudTreeViewModeSwitcher\.init/.test(searchHtml), 'switcher init stays out of inline HTML');
});

/* ── 2) Surface-specific mode capability ────────────────────────────── */
test('4. Browse initializer passes exactly four modes and keeps default compact', () => {
    assert.match(browseInit, /modes:\s*\[?\s*browseModes|modes:\s*\[\s*['"]large['"]\s*,\s*['"]compact['"]\s*,\s*['"]list['"]\s*,\s*['"]story['"]\s*\]/);
    assert.match(browseInit, /\[\s*['"]large['"]\s*,\s*['"]compact['"]\s*,\s*['"]list['"]\s*,\s*['"]story['"]\s*\]/);
    // 5. default remains compact
    assert.match(browseInit, /defaultMode:\s*['"]compact['"]/);
    assert.match(browseInit, /lovebud:browse:viewMode/);
    assert.match(browseInit, /LoveBudBrowseStoryView/);
});

test('6. My Trees initializer does not pass story (no modes option at all)', () => {
    assert.ok(!/story/.test(myTreesBootstrap), 'My Trees bootstrap must not mention story');
    assert.ok(!/modes\s*:/.test(myTreesBootstrap), 'My Trees bootstrap must not pass a modes option');
    assert.match(myTreesBootstrap, /defaultMode:\s*['"]compact['"]/);
    assert.ok(!/story/.test(myTreesHtml), 'My Trees HTML must not mention story');
});

test('7. shared switcher defaults to the three base modes', () => {
    const api = loadSwitcher(new Map());
    assert.deepEqual([...api.MODES], ['large', 'compact', 'list']);
    assert.deepEqual([...api.KNOWN_MODES], ['large', 'compact', 'list', 'story']);
    // getMode without allowedModes rejects story
    const store = new Map([['lovebud:test:viewMode', 'story']]);
    const api2 = loadSwitcher(store);
    assert.equal(api2.getMode('lovebud:test:viewMode', 'compact'), 'compact');
    assert.equal(api2.setMode('lovebud:test:viewMode', 'story'), false);
});

test('8. Browse capability accepts a stored story value', () => {
    const store = new Map([['lovebud:browse:viewMode', 'story']]);
    const api = loadSwitcher(store);
    assert.equal(api.getMode('lovebud:browse:viewMode', 'compact', BROWSE_MODES), 'story');
    assert.equal(api.setMode('lovebud:browse:viewMode', 'story', BROWSE_MODES), true);
});

test('9. My Trees capability rejects a stored story value (compact fallback)', () => {
    const store = new Map([['lovebud:myTrees:viewMode', 'story']]);
    const api = loadSwitcher(store);
    assert.equal(api.getMode('lovebud:myTrees:viewMode', 'compact'), 'compact');
    assert.equal(api.setMode('lovebud:myTrees:viewMode', 'story'), false);
});

test('10. existing valid large/compact/list values preserved on both surfaces', () => {
    for (const mode of ['large', 'compact', 'list']) {
        const browseStore = new Map([['lovebud:browse:viewMode', mode]]);
        const myStore = new Map([['lovebud:myTrees:viewMode', mode]]);
        assert.equal(loadSwitcher(browseStore).getMode('lovebud:browse:viewMode', 'compact', BROWSE_MODES), mode);
        assert.equal(loadSwitcher(myStore).getMode('lovebud:myTrees:viewMode', 'compact'), mode);
    }
});

test('11. invalid storage falls back without deleting or rewriting the value', () => {
    const store = new Map([['lovebud:myTrees:viewMode', 'story']]);
    const api = loadSwitcher(store);
    assert.equal(api.getMode('lovebud:myTrees:viewMode', 'compact'), 'compact');
    assert.equal(store.get('lovebud:myTrees:viewMode'), 'story', 'stored value must not be rewritten');

    const store2 = new Map([['lovebud:browse:viewMode', 'bogus-mode']]);
    const api2 = loadSwitcher(store2);
    assert.equal(api2.getMode('lovebud:browse:viewMode', 'compact', BROWSE_MODES), 'compact');
    assert.equal(store2.get('lovebud:browse:viewMode'), 'bogus-mode', 'stored value must not be deleted');
});

test('exported mode arrays are frozen (no external mutation)', () => {
    const api = loadSwitcher(new Map());
    assert.ok(Object.isFrozen(api.MODES));
    assert.ok(Object.isFrozen(api.KNOWN_MODES));
    assert.throws(() => { api.MODES.push('story'); });
    assert.throws(() => { api.KNOWN_MODES.push('edit'); });
});

test('unknown tokens in a modes option are dropped, never honoured', () => {
    const api = loadSwitcher(new Map());
    assert.equal(api.setMode('lovebud:test:viewMode', 'edit', ['large', 'edit']), false);
    assert.equal(api.getMode('lovebud:test:viewMode', 'compact', ['edit']), 'compact');
});

/* ── 3) Story controller boundaries ─────────────────────────────────── */
test('12. Story controller has no fetch/API/DB capability', () => {
    const src = stripJsComments(storyModule);
    for (const banned of [
        /fetch\s*\(/,
        /XMLHttpRequest/,
        /axios/,
        /apiClient/,
        /firebase/i,
        /postgres/i,
        /DATABASE_URL/,
        /process\.env/,
        /child_process/,
        /\bpg\b\s*[.(]/
    ]) {
        assert.equal(banned.test(src), false, `story module must not contain ${banned}`);
    }
});

test('13. Story controller contains no autoplay or looping timer', () => {
    const src = stripJsComments(storyModule);
    assert.equal(/setInterval/.test(src), false, 'no setInterval');
    assert.equal(/autoplay/i.test(src), false, 'no autoplay');
    assert.equal(/requestAnimationFrame/.test(src), false, 'no animation-frame loop');
    assert.equal(/infinite/i.test(src), false, 'no wraparound/infinite behaviour');
});

test('Story controller implements bidirectional transition with two-layer stage', () => {
    assert.match(storyModule, /browse-story-transition-stage/);
    assert.match(storyModule, /browse-story-layer-outgoing/);
    assert.match(storyModule, /browse-story-layer-incoming/);
    assert.match(storyModule, /aria-busy/);
    assert.match(storyModule, /inert/);
    assert.match(storyModule, /transitioning/);
    assert.match(storyModule, /cancelTransition/);
    assert.match(storyModule, /EXITING_CLASS/);
    assert.match(storyModule, /prefersReducedMotion/);
});

test('14. no framework dependency', () => {
    const src = stripJsComments(storyModule);
    assert.equal(/\b(react|vue|svelte|angular|preact|solid-js)\b/i.test(src), false);
    assert.equal(/\bimport\s+.*from\s+['"]/.test(src), false, 'no ES module imports');
    assert.equal(/require\s*\(/.test(src), false, 'no CommonJS requires');
});

test('15. no server-pagination semantics in the Story controller', () => {
    const src = stripJsComments(storyModule);
    assert.equal(/[?&]page=/.test(src), false, 'no page query parameter');
    assert.equal(/\bpageSize\b/.test(src), false, 'no pageSize');
    assert.equal(/\btotalPages\b/.test(src), false, 'no totalPages');
    assert.equal(/\boffset\b|\blimit\b/.test(src), false, 'no offset/limit');
    assert.equal(/loadMore|nextPage|fetchPage/.test(src), false, 'no pagination loaders');
});

test('Story controller reuses canonical rendered cards (no card HTML generation)', () => {
    const src = stripJsComments(storyModule);
    // Collects existing .tree-card[data-tree-id] nodes; never builds cards.
    assert.match(storyModule, /tree-card/);
    assert.match(storyModule, /data-tree-id/);
    assert.equal(/class="tree-card/.test(src), false, 'no card HTML templates');
    assert.equal(/renderTreeCard|buildTreeCard/.test(src), false, 'no card rendering');
    assert.equal(/innerHTML/.test(src), false, 'no innerHTML card injection');
});

test('Story controller does not bind per-card listeners', () => {
    const src = stripJsComments(storyModule);
    // Only the document-level keydown handler, its own nav buttons (click),
    // and matchMedia breakpoint 'change' listeners may be registered.
    const listeners = src.match(/addEventListener\s*\(\s*['"]([a-z]+)['"]/g) || [];
    for (const l of listeners) {
        assert.ok(/keydown|click|change/.test(l), `unexpected listener ${l}`);
    }
    assert.equal(/card\.addEventListener|cards\[i\]\.addEventListener/.test(src), false);
});

/* ── 4) Navigation UI contract ──────────────────────────────────────── */
test('17. Story nav has previous/next buttons and a current indicator', () => {
    assert.match(storyModule, /data-story-prev/);
    assert.match(storyModule, /data-story-next/);
    assert.match(storyModule, /type\s*=\s*['"]button['"]/);
    assert.match(storyModule, /role['"],\s*['"]status|setAttribute\(['"]role['"],\s*['"]status['"]\)/);
    assert.match(storyModule, /search\.story\.previous/);
    assert.match(storyModule, /search\.story\.next/);
    assert.match(storyModule, /search\.story\.position/);
    assert.match(storyModule, /search\.story\.regionLabel/);
    assert.match(storyModule, /disabled/);
});

test('18. no numbered page list or ellipsis pagination in this child', () => {
    const src = stripJsComments(storyModule);
    assert.equal(/…|\\u2026|\.\.\.\s*\d/.test(src), false, 'no ellipsis pagination');
    assert.equal(/page-number|pageNumber|pageList/.test(src), false, 'no numbered page list');
    assert.equal(/createElement\(['"](ol|ul)['"]\)/.test(src), false, 'no list-based pagination');
});

test('keyboard semantics: arrows + Home/End with editable guards', () => {
    assert.match(storyModule, /ArrowLeft/);
    assert.match(storyModule, /ArrowRight/);
    assert.match(storyModule, /Home/);
    assert.match(storyModule, /End/);
    assert.match(storyModule, /input,\s*textarea,\s*select,\s*\[contenteditable/);
    assert.match(storyModule, /isContentEditable/);
    assert.match(storyModule, /ctrlKey[\s\S]*altKey[\s\S]*metaKey[\s\S]*shiftKey|ctrlKey/);
    assert.match(storyModule, /event\.repeat/);
    assert.match(storyModule, /preventDefault/);
});

/* ── 5) CSS contract ────────────────────────────────────────────────── */
test('16. Story selectors are Browse-scoped (#resultsList / .browse-story-*)', () => {
    assert.match(viewModeCss, /#resultsList\[data-tree-view-mode="story"\]/);
    assert.match(viewModeCss, /\.browse-story-navigation/);
    assert.match(viewModeCss, /\.browse-story-nav-btn/);
    assert.match(viewModeCss, /\.browse-story-indicator/);
    // story mode must hide cards from layout AND accessibility tree
    assert.match(viewModeCss, /#resultsList\[data-tree-view-mode="story"\]\s+\.tree-card\[hidden\]\s*\{[^}]*display:\s*none/);
});

test('19. reduced-motion CSS exists for the Story sections (wrappers + entering)', () => {
    const rm = viewModeCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?browse-story[\s\S]*?\n\}/);
    assert.ok(rm, 'a prefers-reduced-motion block must cover story styles');
    assert.match(viewModeCss, /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?is-story-entering[\s\S]*?animation:\s*none/);
    assert.match(viewModeCss, /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?browse-story-layer-outgoing[\s\S]*?animation:\s*none/);
    assert.match(viewModeCss, /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?browse-story-layer-incoming[\s\S]*?animation:\s*none/);
});

test('20. no .trees-grid story selector (My Trees untouched)', () => {
    assert.equal(/\.trees-grid\[data-tree-view-mode="story"\]/.test(viewModeCss), false);
    assert.equal(viewModeCss.includes('trees-grid[data-tree-view-mode="story"]'), false);
});

test('Story mode keeps token-driven styling (no hardcoded travel palette)', () => {
    const storySection = viewModeCss.slice(viewModeCss.indexOf('Browse Story root layout'));
    assert.match(storySection, /var\(--lovetree-card-grid-gap\)/);
    assert.match(storySection, /var\(--outline-variant\)/);
    assert.match(storySection, /var\(--on-surface-variant\)/);
    assert.match(storySection, /var\(--on-surface\)/);
});

test('Story animation uses bidirectional 8% translate with exit + enter keyframes', () => {
    assert.match(viewModeCss, /@keyframes browse-story-enter-next\s*\{[\s\S]*?translateX\(8%\)/);
    assert.match(viewModeCss, /@keyframes browse-story-enter-prev\s*\{[\s\S]*?translateX\(-8%\)/);
    assert.match(viewModeCss, /@keyframes browse-story-exit-next\s*\{[\s\S]*?translateX\(-8%\)/);
    assert.match(viewModeCss, /@keyframes browse-story-exit-prev\s*\{[\s\S]*?translateX\(8%\)/);
    assert.match(viewModeCss, /340ms\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
    assert.equal(/browse-story[\s\S]*?translateX\([2-9]00px/.test(viewModeCss), false);
});

/* ── 6) Cross-cutting prohibitions ──────────────────────────────────── */
test('21. no mode=edit anywhere in the Story surface', () => {
    assert.equal(storyModule.includes('mode=edit'), false);
    assert.equal(browseInit.includes('mode=edit'), false);
});

test('22. canonical card renderer remains reused and untouched in route', () => {
    assert.match(cardRenderer, /requireComposition\(\)/);
    assert.match(cardRenderer, /comp\.buildTreeCard\(tree,/);
    assert.match(cardRenderer, /view\.html\?treeId=/);
    assert.match(cardRenderer, /primaryLabel:\s*'트리 열기'/);
});

test('23. no generated title/summary logic in the Story controller', () => {
    const src = stripJsComments(storyModule);
    assert.equal(/generateTitle|generatedTitle|aiSummary|summaryGenerat|llm|openai|gpt/i.test(src), false);
});

test('24. no DB or migration file references in the Story module', () => {
    // The contract doc *describes* these prohibitions, so absence is
    // asserted on the executable module only.
    assert.equal(/scripts\/migration-/.test(storyModule), false);
    assert.equal(/(^|[^a-zA-Z])db\//.test(stripJsComments(storyModule)), false);
    assert.equal(/DATABASE_URL/.test(storyModule), false);
    assert.equal(/postgres/i.test(stripJsComments(storyModule)), false);
    assert.equal(/sql\s|SELECT\s|INSERT\s/i.test(stripJsComments(storyModule)), false);
});

/* ── 7) i18n + documentation ────────────────────────────────────────── */
test('i18n keys exist in ko and en', () => {
    // Execute the dictionary module and inspect the real object.
    const w = { location: { pathname: '/pages/search.html' } };
    const doc = {
        readyState: 'complete',
        head: { appendChild: () => {} },
        createElement: () => ({ dataset: {} }),
        addEventListener: () => {},
        querySelector: () => null
    };
    new Function('window', 'document', i18nSearch)(w, doc);
    assert.ok(w.i18nSearch, 'window.i18nSearch must be defined');
    for (const key of [
        'search.viewMode.story',
        'search.story.regionLabel',
        'search.story.previous',
        'search.story.next',
        'search.story.position'
    ]) {
        const entry = w.i18nSearch[key];
        assert.ok(entry && typeof entry === 'object', `missing i18n entry ${key}`);
        assert.equal(typeof entry.ko, 'string', `${key} must have a ko string`);
        assert.equal(typeof entry.en, 'string', `${key} must have an en string`);
    }
    assert.equal(w.i18nSearch['search.viewMode.story'].ko, '스토리');
    assert.equal(w.i18nSearch['search.viewMode.story'].en, 'Story');
    assert.match(w.i18nSearch['search.story.position'].ko, /스토리 \{current\} \/ \{total\}/);
    assert.match(w.i18nSearch['search.story.position'].en, /Story \{current\} of \{total\}/);
});

test('switcher label table carries the Story label', () => {
    assert.match(switcherModule, /story:\s*'스토리'/);
    assert.match(switcherModule, /story:\s*'auto_stories'/);
});

test('25. contract doc references parent/child issues and baseline', () => {
    assert.match(storyDoc, /#3655/);
    assert.match(storyDoc, /#3654/);
    assert.match(storyDoc, /b3bcdda7d69fe98d447df41fddcd9edcde4e20cd/);
    assert.match(storyDoc, /#1882/);
    assert.match(storyDoc, /OPEN/);
    assert.match(storyDoc, /compact/);
    assert.match(storyDoc, /My Trees/);
});
