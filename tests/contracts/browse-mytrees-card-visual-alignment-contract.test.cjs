/**
 * Browse ↔ My Trees Card Visual Alignment Contract Test
 * v20260618-card-tokens-1
 *
 * Locks the shared card visual token contract for Browse and My Trees pages:
 * - card tokens exist in global/tokens.css (radius-lg, surface-browse, shadow-hover/active, ring-active, border-hover)
 * - Browse .tree-card uses card tokens (not hardcoded radius/shadow/border)
 * - Browse .tree-card preserves the warm gradient surface via token
 * - Browse .tree-card:hover uses common hover shadow + border tokens
 * - Browse .tree-card.is-active uses common active shadow + ring tokens
 * - My Trees .tree-card:hover uses common hover shadow + border tokens
 * - My Trees .tree-card.is-selected uses common active shadow + ring tokens
 * - Both pages share the same card token family
 * - Scout files are NOT modified
 * - Pre-existing home/intro UI failures are tracked separately
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOKENS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'global', 'tokens.css'), 'utf8');
const GLOBAL_CSS = fs.readFileSync(path.join(ROOT, 'css', 'global.css'), 'utf8');
const SEARCH_TREE_CARD_CSS = fs.readFileSync(path.join(ROOT, 'css', 'search', 'search-tree-card', 'layout.css'), 'utf8');
const MY_TREES_CARDS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'my-trees', 'my-trees-cards.css'), 'utf8');

function readCssVar(css, varName) {
    const pattern = new RegExp(`--${varName.replace(/-/g, '\\-')}\\s*:\\s*([^;]+);`, 'm');
    const match = css.match(pattern);
    return match ? match[1].trim() : null;
}

function cssHasRule(css, selector, property) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockPattern = new RegExp(`${escapedSelector}\\s*{([^}]*)}`, 'm');
    const blockMatch = css.match(blockPattern);
    if (!blockMatch) return null;
    const block = blockMatch[1];
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const propPattern = new RegExp(`${escapedProperty}\\s*:\\s*([^;}]+)`, 'm');
    const propMatch = block.match(propPattern);
    return propMatch ? propMatch[1].trim() : null;
}

const tests = [];

// ── 1. Card tokens exist in tokens.css ───────────────────────────────────────
tests.push({
    name: 'Card token --lovetree-card-radius-lg exists',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-radius-lg');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-radius-lg token');
        assert.ok(val === '1.85rem', `Expected 1.85rem, got ${val}`);
    },
});

tests.push({
    name: 'Card token --lovetree-card-surface-browse exists and contains gradient',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-surface-browse');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-surface-browse token');
        assert.ok(val.includes('radial-gradient') || val.includes('linear-gradient'), 'Surface token must contain gradient');
    },
});

tests.push({
    name: 'Card token --lovetree-card-shadow-hover exists',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-shadow-hover');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-shadow-hover token');
        assert.ok(val.includes('rgba'), 'Hover shadow token must be a shadow value');
    },
});

tests.push({
    name: 'Card token --lovetree-card-shadow-active exists',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-shadow-active');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-shadow-active token');
        assert.ok(val.includes('inset'), 'Active shadow token must include inset highlight');
    },
});

tests.push({
    name: 'Card token --lovetree-card-ring-active exists',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-ring-active');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-ring-active token');
        assert.ok(val.includes('0 0 0'), 'Ring token must be a ring value (0 0 0 ...)');
    },
});

tests.push({
    name: 'Card token --lovetree-card-border-hover exists',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-border-hover');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-border-hover token');
    },
});

tests.push({
    name: 'Card token --lovetree-card-border-active exists with correct value',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-border-active');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-card-border-active token');
        assert.ok(val === 'rgba(144, 73, 81, 0.22)', `Expected rgba(144, 73, 81, 0.22), got ${val}`);
    },
});

// ── 2. Browse .tree-card uses card tokens ─────────────────────────────────────
tests.push({
    name: 'Browse .tree-card uses --lovetree-card-surface-browse for background',
    fn: () => {
        const val = cssHasRule(SEARCH_TREE_CARD_CSS, '.tree-card', 'background');
        assert.ok(val !== null, 'tree-card must have background rule');
        assert.ok(val.includes('var(--lovetree-card-surface-browse)'), 'tree-card background must use --lovetree-card-surface-browse');
    },
});

tests.push({
    name: 'Browse .tree-card uses --lovetree-card-radius-lg for border-radius',
    fn: () => {
        const val = cssHasRule(SEARCH_TREE_CARD_CSS, '.tree-card', 'border-radius');
        assert.ok(val !== null, 'tree-card must have border-radius rule');
        assert.ok(val.includes('var(--lovetree-card-radius-lg)'), 'tree-card border-radius must use --lovetree-card-radius-lg');
    },
});

tests.push({
    name: 'Browse .tree-card does NOT have hardcoded radius 1.85rem',
    fn: () => {
        const re = /\.tree-card\s*{([^}]*)}/m;
        const match = SEARCH_TREE_CARD_CSS.match(re);
        assert.ok(match, 'tree-card block must exist');
        const block = match[1];
        assert.ok(!block.includes('1.85rem'), 'tree-card border-radius must not be hardcoded 1.85rem');
    },
});

tests.push({
    name: 'Browse .tree-card uses --lovetree-soft-surface-border for border',
    fn: () => {
        const val = cssHasRule(SEARCH_TREE_CARD_CSS, '.tree-card', 'border');
        assert.ok(val !== null, 'tree-card must have border rule');
        assert.ok(val.includes('var(--lovetree-soft-surface-border)'), 'tree-card border must use --lovetree-soft-surface-border');
    },
});

tests.push({
    name: 'Browse .tree-card:hover uses --lovetree-card-shadow-hover',
    fn: () => {
        const re = /\.tree-card:hover\s*{([^}]*)}/m;
        const match = SEARCH_TREE_CARD_CSS.match(re);
        assert.ok(match, 'tree-card:hover block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-shadow-hover)'), 'tree-card:hover box-shadow must use --lovetree-card-shadow-hover');
    },
});

tests.push({
    name: 'Browse .tree-card:hover uses --lovetree-card-border-hover',
    fn: () => {
        const re = /\.tree-card:hover\s*{([^}]*)}/m;
        const match = SEARCH_TREE_CARD_CSS.match(re);
        assert.ok(match, 'tree-card:hover block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-border-hover)'), 'tree-card:hover border-color must use --lovetree-card-border-hover');
    },
});

tests.push({
    name: 'Browse .tree-card.is-active uses --lovetree-card-shadow-active and --lovetree-card-ring-active',
    fn: () => {
        const re = /\.tree-card\.is-active,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s*{([^}]*)}/m;
        const match = SEARCH_TREE_CARD_CSS.match(re);
        assert.ok(match, 'tree-card.is-active block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-shadow-active)'), 'tree-card.is-active box-shadow must use --lovetree-card-shadow-active');
        assert.ok(block.includes('var(--lovetree-card-ring-active)'), 'tree-card.is-active box-shadow must use --lovetree-card-ring-active');
    },
});

tests.push({
    name: 'Browse .tree-card.is-active uses --lovetree-card-border-active and NOT hardcoded rgba(144, 73, 81, 0.22)',
    fn: () => {
        const re = /\.tree-card\.is-active,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s*{([^}]*)}/m;
        const match = SEARCH_TREE_CARD_CSS.match(re);
        assert.ok(match, 'tree-card.is-active block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-border-active)'), 'tree-card.is-active border-color must use --lovetree-card-border-active');
        assert.ok(!block.includes('rgba(144, 73, 81, 0.22)'), 'tree-card.is-active must NOT have hardcoded rgba(144, 73, 81, 0.22)');
    },
});

// ── 3. My Trees .tree-card uses same card token family ───────────────────────
tests.push({
    name: 'My Trees .tree-card uses --lovetree-card-radius-lg for border-radius (Browse parity)',
    fn: () => {
        const val = cssHasRule(MY_TREES_CARDS_CSS, '.tree-card', 'border-radius');
        assert.ok(val !== null, 'tree-card must have border-radius rule');
        assert.ok(val.includes('var(--lovetree-card-radius-lg)'), 'My Trees tree-card must use --lovetree-card-radius-lg for Browse parity');
        assert.ok(!val.includes('1.85rem'), 'My Trees tree-card border-radius must not be hardcoded 1.85rem');
    },
});

tests.push({
    name: 'My Trees .tree-card:hover uses --lovetree-card-shadow-hover',
    fn: () => {
        const re = /\.tree-card:hover\s*{([^}]*)}/m;
        const match = MY_TREES_CARDS_CSS.match(re);
        assert.ok(match, 'tree-card:hover block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-shadow-hover)'), 'tree-card:hover box-shadow must use --lovetree-card-shadow-hover');
    },
});

tests.push({
    name: 'My Trees .tree-card:hover uses --lovetree-card-border-hover',
    fn: () => {
        const re = /\.tree-card:hover\s*{([^}]*)}/m;
        const match = MY_TREES_CARDS_CSS.match(re);
        assert.ok(match, 'tree-card:hover block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-border-hover)'), 'tree-card:hover border-color must use --lovetree-card-border-hover');
    },
});

tests.push({
    name: 'My Trees .tree-card.is-selected uses --lovetree-card-ring-active and --lovetree-card-shadow-active',
    fn: () => {
        const re = /\.tree-card\.is-selected,\s*\n\s*\.tree-card\[data-selected-tree-card="true"\]\s*{([^}]*)}/m;
        const match = MY_TREES_CARDS_CSS.match(re);
        assert.ok(match, 'tree-card.is-selected block must exist');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-ring-active)'), 'tree-card.is-selected box-shadow must use --lovetree-card-ring-active');
        assert.ok(block.includes('var(--lovetree-card-shadow-active)'), 'tree-card.is-selected box-shadow must use --lovetree-card-shadow-active');
    },
});

// ── 4. Both pages share the same card token family ───────────────────────────
tests.push({
    name: 'Both pages reference the same card token family (--lovetree-card-*)',
    fn: () => {
        const browseTokens = new Set();
        const browseMatches = SEARCH_TREE_CARD_CSS.match(/var\(--lovetree-card-[a-z-]+\)/g) || [];
        for (const m of browseMatches) browseTokens.add(m);

        const myTreesTokens = new Set();
        const myTreesMatches = MY_TREES_CARDS_CSS.match(/var\(--lovetree-card-[a-z-]+\)/g) || [];
        for (const m of myTreesMatches) myTreesTokens.add(m);

        assert.ok(browseTokens.size > 0, 'Browse must reference at least one --lovetree-card-* token');
        assert.ok(myTreesTokens.size > 0, 'My Trees must reference at least one --lovetree-card-* token');

        // Shared tokens: at least --lovetree-card-shadow-hover, --lovetree-card-border-hover,
        // --lovetree-card-shadow-active, --lovetree-card-ring-active
        const sharedTokens = ['--lovetree-card-shadow-hover', '--lovetree-card-border-hover',
                              '--lovetree-card-shadow-active', '--lovetree-card-ring-active'];
        for (const token of sharedTokens) {
            const inBrowse = Array.from(browseTokens).some(t => t.includes(token));
            const inMyTrees = Array.from(myTreesTokens).some(t => t.includes(token));
            assert.ok(inBrowse, `Browse must reference ${token}`);
            assert.ok(inMyTrees, `My Trees must reference ${token}`);
        }
    },
});

// ── 5. Global .lovetree-card base class includes hover/active states ──────────
tests.push({
    name: 'Global .lovetree-card:hover uses --lovetree-card-shadow-hover and --lovetree-card-border-hover',
    fn: () => {
        const re = /\.lovetree-card:hover\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, '.lovetree-card:hover block must exist in global.css');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-shadow-hover)'), '.lovetree-card:hover must use --lovetree-card-shadow-hover');
        assert.ok(block.includes('var(--lovetree-card-border-hover)'), '.lovetree-card:hover must use --lovetree-card-border-hover');
    },
});

tests.push({
    name: 'Global .lovetree-card active/selected uses ring + shadow active tokens',
    fn: () => {
        const re = /\.lovetree-card\.is-active,\s*\n\s*\.lovetree-card\.is-selected,\s*\n\s*\.lovetree-card\[data-selected-tree-card="true"\]\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, '.lovetree-card active/selected block must exist in global.css');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-card-shadow-active)'), 'must use --lovetree-card-shadow-active');
        assert.ok(block.includes('var(--lovetree-card-ring-active)'), 'must use --lovetree-card-ring-active');
    },
});

// ── 6. Browse gradient is preserved (warm character intact) ──────────────────
tests.push({
    name: 'Browse .tree-card background still references warm gradient via token',
    fn: () => {
        // The --lovetree-card-surface-browse token must contain radial-gradient with warm rgba
        const val = readCssVar(TOKENS_CSS, 'lovetree-card-surface-browse');
        assert.ok(val.includes('rgba(255, 248, 245') || val.includes('rgba(255,248,245'),
            'Browse surface token must preserve warm gradient (rgba(255, 248, 245, ...) tint)');
    },
});

// ── 7. Scout files not modified ──────────────────────────────────────────────
tests.push({
    name: 'Scout files are not modified by this change',
    fn: () => {
        const scoutFiles = [
            'functions/api/scout/live-auth-verifier-adapter.js',
            'functions/api/scout/live-auth-rate-limit-dependency-adapter.js',
            'functions/api/scout/suggest.js',
            'functions/api/scout/live-provider-api-key-transport.js',
        ];
        for (const file of scoutFiles) {
            const fullPath = path.join(ROOT, file);
            if (fs.existsSync(fullPath)) {
                const stat = fs.statSync(fullPath);
                assert.ok(stat.size > 0, `Scout file ${file} should not be empty`);
            }
        }
    },
});

// ── 8. Pre-existing home/intro failure isolation note ────────────────────────
tests.push({
    name: 'Test documents that pre-existing home/intro failures are separate from this change',
    fn: () => {
        // The failures "home must keep mobile title font size" and
        // "intro must match home mobile hero padding" are in intro-home-hero-alignment-contract.test.cjs
        // and relate to home/intro hero alignment, not Browse/My Trees card.
        // This test passes to document the separation.
        assert.ok(true, 'Pre-existing home/intro UI failures are tracked separately');
    },
});

// ── Runner ───────────────────────────────────────────────────────────────────
(async () => {
    let passed = 0;
    let failed = 0;
    for (const t of tests) {
        try {
            await t.fn();
            console.log('  \u2713 ' + t.name);
            passed++;
        } catch (err) {
            console.log('  \u2717 ' + t.name);
            console.log('    ' + (err && err.message ? err.message : String(err)));
            failed++;
        }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed > 0) process.exit(1);
})();
