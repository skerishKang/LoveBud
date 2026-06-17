/**
 * LoveBud #2533 Tree View Mode Switcher — Contract Test
 *
 * Locks the contract between:
 *   - js/tree-view-mode-switcher.js
 *   - css/tree-view-mode.css
 *   - pages/search.html (Browse)
 *   - pages/my-trees.html (My LoveTree)
 *
 * The switcher must remain a per-user preference (large/compact/list) — NOT
 * a forced layout change. Both pages must keep their existing default column
 * count when no data-attribute is set.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const helperSource = fs.readFileSync(
    path.join(ROOT, 'js/tree-view-mode-switcher.js'),
    'utf8'
);
const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/tree-view-mode.css'),
    'utf8'
);
const searchHtml = fs.readFileSync(
    path.join(ROOT, 'pages/search.html'),
    'utf8'
);
const myTreesHtml = fs.readFileSync(
    path.join(ROOT, 'pages/my-trees.html'),
    'utf8'
);
const myTreesPageBootstrap = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-page-bootstrap.js'),
    'utf8'
);
const myTreesCardsCss = fs.readFileSync(
    path.join(ROOT, 'css/my-trees/my-trees-cards.css'),
    'utf8'
);
const searchResultsCss = fs.readFileSync(
    path.join(ROOT, 'css/search/search-results-skeleton.css'),
    'utf8'
);

// ── 1) Helper module presence and exported surface ────────────────────
test('tree view mode switcher helper exists', () => {
    assert.match(helperSource, /LoveBudTreeViewModeSwitcher/);
    assert.match(helperSource, /window\.LoveBudTreeViewModeSwitcher\s*=\s*api/);
    assert.match(helperSource, /globalThis\.LoveBudTreeViewModeSwitcher\s*=\s*api/);
});

test('large / compact / list modes are all defined', () => {
    assert.match(helperSource, /large/);
    assert.match(helperSource, /compact/);
    assert.match(helperSource, /list/);
    assert.match(helperSource, /MODES\s*=\s*\[\s*['"]large['"]/);
    assert.match(helperSource, /MODES\s*=\s*\[[^\]]*['"]compact['"]/);
    assert.match(helperSource, /MODES\s*=\s*\[[^\]]*['"]list['"]/);
});

// ── 2) Browse page wiring ─────────────────────────────────────────────
test('Browse page loads tree view mode CSS and helper script', () => {
    assert.match(
        searchHtml,
        /href="\.\.\/css\/tree-view-mode\.css\?v=20260616-2533-1"/
    );
    assert.match(
        searchHtml,
        /src="\.\.\/js\/tree-view-mode-switcher\.js\?v=20260616-2533-1"/
    );
});

test('Browse page has view mode control mount point', () => {
    assert.match(searchHtml, /id="browseViewModeMount"/);
});

test('Browse page initializes the switcher with browse storage key and default compact', () => {
    assert.match(searchHtml, /lovebud:browse:viewMode/);
    assert.match(searchHtml, /defaultMode:\s*['"]compact['"]/);
    assert.match(searchHtml, /mount:\s*['"]#browseViewModeMount['"]/);
    assert.match(searchHtml, /target:\s*['"]#resultsList['"]/);
});

// ── 3) My LoveTree page wiring ───────────────────────────────────────
test('My LoveTree page loads tree view mode CSS and helper script', () => {
    assert.match(
        myTreesHtml,
        /href="\.\.\/css\/tree-view-mode\.css\?v=20260616-2533-1"/
    );
    assert.match(
        myTreesHtml,
        /src="\.\.\/js\/tree-view-mode-switcher\.js\?v=20260616-2533-1"/
    );
});

test('My LoveTree page has view mode control mount point', () => {
    assert.match(myTreesHtml, /id="myTreesViewModeMount"/);
});

test('My LoveTree page loads my trees page bootstrap', () => {
    assert.match(
        myTreesHtml,
        /src="\.\.\/js\/my-trees\/my-trees-page-bootstrap\.js\?v=20260617-1"/
    );
});

test('My LoveTree page initializes the switcher with myTrees storage key and default large', () => {
    assert.match(myTreesPageBootstrap, /lovebud:myTrees:viewMode/);
    assert.match(myTreesPageBootstrap, /defaultMode:\s*['"]large['"]/);
    assert.match(myTreesPageBootstrap, /mount:\s*['"]#myTreesViewModeMount['"]/);
    assert.match(myTreesPageBootstrap, /target:\s*['"]#trees-grid['"]/);
});

// ── 4) CSS selectors for all modes on both pages ────────────────────
test('CSS has Browse (#resultsList) large/compact/list selectors', () => {
    assert.match(cssSource, /#resultsList\[data-tree-view-mode="large"\]/);
    assert.match(cssSource, /#resultsList\[data-tree-view-mode="compact"\]/);
    assert.match(cssSource, /#resultsList\[data-tree-view-mode="list"\]/);
});

test('CSS has My LoveTree (.trees-grid) large/compact/list selectors', () => {
    assert.match(cssSource, /\.trees-grid\[data-tree-view-mode="large"\]/);
    assert.match(cssSource, /\.trees-grid\[data-tree-view-mode="compact"\]/);
    assert.match(cssSource, /\.trees-grid\[data-tree-view-mode="list"\]/);
});

// ── 5) Default behavior is NOT a forced layout change ────────────────
test('My LoveTree default 2-col .trees-grid is NOT forced to 3-col', () => {
    // The base CSS for .trees-grid (without data attribute) must still
    // resolve to 2 columns. The view-mode switcher must not redefine it.
    assert.match(myTreesCardsCss, /\.trees-grid/);
    assert.match(myTreesCardsCss, /repeat\(2,/);
    // tree-view-mode.css must NOT redefine .trees-grid without a selector
    // (i.e., must not set a 3-col default that overrides the base 2-col).
    const baseOverride = /^\.trees-grid\s*\{/m;
    assert.equal(
        baseOverride.test(cssSource),
        false,
        'tree-view-mode.css must not redefine .trees-grid without a data-mode selector'
    );
});

test('Browse default 3-col #resultsList discovery behavior is maintained', () => {
    // The base CSS for #resultsList (without data attribute) must still
    // resolve to 3 columns. The view-mode switcher must not redefine it.
    assert.match(searchResultsCss, /#resultsList/);
    assert.match(searchResultsCss, /repeat\(3,/);
    const baseOverride = /^#resultsList\s*\{/m;
    assert.equal(
        baseOverride.test(cssSource),
        false,
        'tree-view-mode.css must not redefine #resultsList without a data-mode selector'
    );
});

// ── 6) Helper runtime API works in node test context ──────────────────
test('helper exposes getMode/setMode/applyMode that validate modes', () => {
    // Load the script into a sandbox with a minimal window/localStorage.
    const store = new Map();
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
    // Provide `document` minimally; not used by getMode/setMode.
    sandbox.window.document = { addEventListener: () => {} };
    const fn = new Function('window', 'globalThis', helperSource);
    fn(sandbox.window, sandbox.globalThis);
    const api = sandbox.globalThis.LoveBudTreeViewModeSwitcher;
    assert.ok(api, 'helper should attach to globalThis');

    // getMode returns the default when nothing is stored
    assert.equal(api.getMode('lovebud:test:viewMode', 'compact'), 'compact');
    assert.equal(api.getMode('lovebud:test:viewMode', 'invalid'), 'large');

    // setMode persists and getMode returns the new value
    assert.equal(api.setMode('lovebud:test:viewMode', 'list'), true);
    assert.equal(api.getMode('lovebud:test:viewMode', 'compact'), 'list');

    // invalid mode is rejected
    assert.equal(api.setMode('lovebud:test:viewMode', 'wide'), false);

    // isValidMode semantics are folded into getMode: invalid stored value
    // must fall back to the default rather than corrupt state
    store.set('lovebud:test:viewMode', 'wide');
    assert.equal(api.getMode('lovebud:test:viewMode', 'compact'), 'compact');

    // MODES list is exactly large/compact/list
    assert.deepEqual(api.MODES, ['large', 'compact', 'list']);
});

// ── 7) Regression: observer must not reapply a captured initial value ─
function stripJsComments(src) {
    // Strip /* ... */ block comments first (non-greedy), then // line comments
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

test('observer callback source does not reference a captured initial value', () => {
    const m = helperSource.match(
        /new\s+MutationObserver\s*\(\s*function\s*\(\s*\)\s*\{([\s\S]*?)\}\s*\)/
    );
    assert.ok(m, 'observer callback must exist');
    const body = stripJsComments(m[1]);
    assert.equal(
        /\binitial\b/.test(body),
        false,
        'observer callback (excluding comments) must not reference a captured "initial" value'
    );
});

test('observer callback source reads the latest mode from getMode or currentMode', () => {
    const m = helperSource.match(
        /new\s+MutationObserver\s*\(\s*function\s*\(\s*\)\s*\{([\s\S]*?)\}\s*\)/
    );
    assert.ok(m, 'observer callback must exist');
    const body = stripJsComments(m[1]);
    const readsLatest =
        /getMode\s*\(\s*storageKey\s*,\s*defaultMode\s*\)/.test(body) ||
        /\bcurrentMode\b/.test(body);
    assert.equal(
        readsLatest,
        true,
        'observer callback must read the latest mode via getMode(storageKey, defaultMode) or currentMode'
    );
});

test('source does not contain the stale applyMode(..., initial) pattern', () => {
    const body = stripJsComments(helperSource);
    const stalePattern = /applyMode\s*\(\s*(?:node|target)\s*,\s*initial\s*\)/;
    assert.equal(
        stalePattern.test(body),
        false,
        'source (excluding comments) must not contain the stale applyMode(..., initial) pattern'
    );
});

test('observer re-applies the latest user-selected mode when the target is re-rendered', () => {
    // Mock DOM with mutable target node so we can simulate re-render
    const store = new Map();
    function makeNode(tag) {
        const listeners = {};
        const children = [];
        const classSet = new Set();
        const node = {
            tagName: tag,
            __attrs: {},
            __children: children,
            __listeners: listeners,
            parentNode: null,
            setAttribute(name, value) {
                this.__attrs[name] = String(value);
            },
            getAttribute(name) {
                return Object.prototype.hasOwnProperty.call(this.__attrs, name)
                    ? this.__attrs[name]
                    : null;
            },
            appendChild(child) {
                children.push(child);
                child.parentNode = node;
                return child;
            },
            removeChild(child) {
                const i = children.indexOf(child);
                if (i >= 0) children.splice(i, 1);
                return child;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            classList: {
                add: (c) => classSet.add(c),
                remove: (c) => classSet.delete(c),
                contains: (c) => classSet.has(c)
            },
            textContent: ''
        };
        return node;
    }

    let currentNode = makeNode('div');
    currentNode.setAttribute('id', 'trees-grid');
    currentNode.setAttribute('class', 'trees-grid');

    const mountNode = makeNode('div');
    mountNode.setAttribute('id', 'myTreesViewModeMount');

    const sandbox = {};
    sandbox.document = {
        createElement: (tag) => makeNode(tag),
        querySelector: (sel) => {
            if (sel === '#trees-grid') return currentNode;
            if (sel === '#myTreesViewModeMount') return mountNode;
            return null;
        },
        documentElement: makeNode('html'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
    };

    let observerCallback = null;
    const MockMutationObserver = function (cb) {
        observerCallback = cb;
        return { observe: () => {}, disconnect: () => {} };
    };
    sandbox.window.MutationObserver = MockMutationObserver;

    const fn = new Function(
        'window', 'globalThis', 'document', 'MutationObserver',
        helperSource
    );
    fn(sandbox.window, sandbox.globalThis, sandbox.document, MockMutationObserver);
    const api = sandbox.globalThis.LoveBudTreeViewModeSwitcher;

    // Init with default 'large' (matches My LoveTree spec)
    const result = api.init({
        storageKey: 'lovebud:myTrees:viewMode',
        defaultMode: 'large',
        mount: '#myTreesViewModeMount',
        target: '#trees-grid'
    });
    assert.ok(result, 'init should return a result');
    assert.equal(
        currentNode.getAttribute('data-tree-view-mode'),
        'large',
        'initial mode must be applied to the target'
    );
    assert.equal(result.getCurrentMode(), 'large');

    // Simulate the user clicking the 'compact' button
    const controlEl = mountNode.__children[0];
    assert.ok(controlEl, 'control must be mounted');
    const compactBtn = controlEl.__children[1]; // [0]=large, [1]=compact, [2]=list
    assert.equal(compactBtn.getAttribute('data-mode'), 'compact');
    compactBtn.__listeners.click({ preventDefault: () => {} });
    assert.equal(
        currentNode.getAttribute('data-tree-view-mode'),
        'compact',
        'click should set target to compact'
    );
    assert.equal(store.get('lovebud:myTrees:viewMode'), 'compact');
    assert.equal(result.getCurrentMode(), 'compact');

    // Simulate My LoveTree re-rendering the .trees-grid (e.g. after sort)
    const newTarget = makeNode('div');
    newTarget.setAttribute('id', 'trees-grid');
    newTarget.setAttribute('class', 'trees-grid');
    currentNode = newTarget;

    // Fire the observer (as if a DOM mutation happened)
    assert.ok(observerCallback, 'observer should have been wired');
    observerCallback();

    // The new node MUST receive the latest user-selected mode ('compact'),
    // NOT the captured initial ('large').
    assert.equal(
        newTarget.getAttribute('data-tree-view-mode'),
        'compact',
        're-rendered target must receive the latest user-selected mode, not the captured initial'
    );

    // Switch to 'list' and re-render again
    const listBtn = controlEl.__children[2];
    listBtn.__listeners.click({ preventDefault: () => {} });
    assert.equal(currentNode.getAttribute('data-tree-view-mode'), 'list');

    const newTarget2 = makeNode('div');
    newTarget2.setAttribute('id', 'trees-grid');
    currentNode = newTarget2;
    observerCallback();
    assert.equal(
        newTarget2.getAttribute('data-tree-view-mode'),
        'list',
        'second re-render must also receive the latest user-selected mode'
    );
});
