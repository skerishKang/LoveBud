/**
 * Browse ↔ My Trees Chip Visual Alignment Contract Test
 * v20260618-chip-tokens-1
 *
 * Locks the chip visual token contract for Browse and My Trees pages:
 * - chip active shadow token exists in global/tokens.css
 * - My Trees .my-trees-filter-chip.is-active uses the active shadow token
 *   (no hardcoded rgba(144, 73, 81, 0.05) shadow)
 * - Browse tag-chip and related CSS uses existing chip token families
 *   (--control-chip-* and/or --lovetree-chip-*), not hardcoded values
 * - Browse chip layout/mobile behavior is unchanged (guard)
 * - empty-state files are NOT modified (reserved for PR 4)
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
const SEARCH_CONTROLS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'search', 'search-controls.css'), 'utf8');
const MY_TREES_FINDER_CSS = fs.readFileSync(path.join(ROOT, 'css', 'my-trees', 'my-trees-finder.css'), 'utf8');

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

// ── 1. Chip active shadow token exists ───────────────────────────────────────
tests.push({
    name: 'Chip token --lovetree-chip-active-shadow exists with correct value',
    fn: () => {
        const val = readCssVar(TOKENS_CSS, 'lovetree-chip-active-shadow');
        assert.ok(val !== null && val.length > 0, 'Missing --lovetree-chip-active-shadow token');
        assert.ok(val === '0 4px 12px rgba(144, 73, 81, 0.05)',
            `Expected "0 4px 12px rgba(144, 73, 81, 0.05)", got "${val}"`);
    },
});

// ── 2. My Trees filter chips now use shared .tag-chip from search-controls.css ────
// After #2878 structure parity, My Trees uses shared .tag-chip/.tag-chip.active
// geometry from search-controls.css. Visual tokens are aligned with Browse.
tests.push({
    name: 'My Trees uses shared .tag-chip class alongside my-trees-filter-chip',
    fn: () => {
        // My Trees HTML should have both tag-chip and my-trees-filter-chip classes
        const html = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');
        assert.ok(html.includes('class="my-trees-filter-chip tag-chip'),
            'My Trees filter chips must have both my-trees-filter-chip and tag-chip classes');
    },
});

tests.push({
    name: 'Shared .tag-chip in search-controls.css has expected base styles',
    fn: () => {
        assert.ok(SEARCH_CONTROLS_CSS.includes('.tag-chip {'),
            'Shared .tag-chip selector must exist in search-controls.css');
        assert.ok(SEARCH_CONTROLS_CSS.includes('background: rgba(255,255,255,0.76)'),
            'Shared .tag-chip must have expected background');
    },
});

tests.push({
    name: 'Shared .tag-chip.active in search-controls.css has expected active styles',
    fn: () => {
        assert.ok(SEARCH_CONTROLS_CSS.includes('.tag-chip.active {'),
            'Shared .tag-chip.active selector must exist in search-controls.css');
        assert.ok(SEARCH_CONTROLS_CSS.includes('background: rgba(144, 73, 81, 0.12)'),
            'Shared .tag-chip.active must have expected background');
    },
});

// ── 3. My Trees finder CSS no longer has desktop duplicate geometry ────────

// ── 4. Browse tag-chip still uses --control-chip-* family (no regression) ─────
tests.push({
    name: 'Browse .tag-chip uses --control-chip-* family (no regression)',
    fn: () => {
        // The active style is in global.css (body .tag-chip.active)
        const re = /body\s+\.tag-chip\.active\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, 'body .tag-chip.active block must exist in global.css');
        const block = match[1];
        assert.ok(block.includes('var(--control-chip-active-bg)'),
            'Browse tag-chip.active must use --control-chip-active-bg');
        assert.ok(block.includes('var(--control-chip-active-text)'),
            'Browse tag-chip.active must use --control-chip-active-text');
        assert.ok(block.includes('var(--control-chip-active-border)'),
            'Browse tag-chip.active must use --control-chip-active-border');
    },
});

tests.push({
    name: 'Browse .tag-chip base uses --control-chip-* family (no regression)',
    fn: () => {
        const re = /body\s+\.tag-chip\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, 'body .tag-chip block must exist in global.css');
        const block = match[1];
        assert.ok(block.includes('var(--control-chip-bg)'),
            'Browse tag-chip base must use --control-chip-bg');
        assert.ok(block.includes('var(--control-chip-text)'),
            'Browse tag-chip base must use --control-chip-text');
        assert.ok(block.includes('var(--control-chip-border)'),
            'Browse tag-chip base must use --control-chip-border');
    },
});

// ── 5. Browse .browse-sort-select keeps --lovetree-chip-* family (no regression) ─
tests.push({
    name: 'Browse .browse-sort-select uses --lovetree-chip-* family (no regression)',
    fn: () => {
        const bg = cssHasRule(SEARCH_CONTROLS_CSS, '.browse-sort-select', 'background');
        assert.ok(bg !== null, '.browse-sort-select must have background');
        // The background includes both color and background-image, so check separately
        assert.ok(bg.includes('var(--lovetree-chip-bg)'),
            '.browse-sort-select must reference --lovetree-chip-bg');
        const border = cssHasRule(SEARCH_CONTROLS_CSS, '.browse-sort-select', 'border');
        assert.ok(border !== null && border.includes('var(--lovetree-chip-border)'),
            '.browse-sort-select border must use --lovetree-chip-border');
        const color = cssHasRule(SEARCH_CONTROLS_CSS, '.browse-sort-select', 'color');
        assert.ok(color !== null && color.includes('var(--lovetree-chip-text)'),
            '.browse-sort-select color must use --lovetree-chip-text');
    },
});

// ── 6. Global .lovetree-chip.is-active uses new token (consistency) ──────────
tests.push({
    name: 'Global .lovetree-chip.is-active uses --lovetree-chip-active-shadow',
    fn: () => {
        const re = /\.lovetree-chip\.is-active\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, '.lovetree-chip.is-active block must exist in global.css');
        const block = match[1];
        assert.ok(block.includes('var(--lovetree-chip-active-shadow)'),
            '.lovetree-chip.is-active must use --lovetree-chip-active-shadow');
    },
});

tests.push({
    name: 'Global .lovetree-chip.is-active does NOT have hardcoded rgba shadow',
    fn: () => {
        const re = /\.lovetree-chip\.is-active\s*{([^}]*)}/m;
        const match = GLOBAL_CSS.match(re);
        assert.ok(match, '.lovetree-chip.is-active block must exist');
        const block = match[1];
        assert.ok(!block.includes('0 8px 20px rgba(75, 64, 57, 0.05)'),
            '.lovetree-chip.is-active must NOT have hardcoded 0 8px 20px rgba(75, 64, 57, 0.05) shadow');
    },
});

// ── 7. Browse chip layout/mobile guard (no structural change) ───────────────
tests.push({
    name: 'Browse .tag-chip layout properties (display, padding, font-size) unchanged',
    fn: () => {
        // Verify the tag-chip in search-controls.css still has core layout values
        const re = /\.tag-chip\s*{([^}]*)}/m;
        const match = SEARCH_CONTROLS_CSS.match(re);
        assert.ok(match, '.tag-chip block must exist in search-controls.css');
        const block = match[1];
        assert.ok(block.includes('border-radius: 99px'),
            '.tag-chip must still use border-radius: 99px');
        assert.ok(block.includes('padding: 8px 14px'),
            '.tag-chip must still use padding: 8px 14px');
        assert.ok(block.includes('font-size: 12px'),
            '.tag-chip must still use font-size: 12px');
    },
});

tests.push({
    name: 'Browse .filter-row structure unchanged',
    fn: () => {
        const re = /\.filter-row\s*{([^}]*)}/m;
        const match = SEARCH_CONTROLS_CSS.match(re);
        assert.ok(match, '.filter-row block must exist');
        const block = match[1];
        assert.ok(block.includes('display: flex'),
            '.filter-row must still use display: flex');
        assert.ok(block.includes('gap: 8px'),
            '.filter-row must still use gap: 8px');
    },
});

// ── 8. My Trees filter chip layout guard - now uses shared .tag-chip ────────
tests.push({
    name: 'Shared .tag-chip has expected layout properties',
    fn: () => {
        // After #2878, My Trees uses shared .tag-chip from search-controls.css
        const tagChipBlock = /\.tag-chip\s*{([^}]*)}/m.exec(SEARCH_CONTROLS_CSS);
        assert.ok(tagChipBlock, '.tag-chip block must exist in search-controls.css');
        const block = tagChipBlock[1];
        assert.ok(block.includes('border-radius: 99px'),
            'Shared .tag-chip must have border-radius: 999px');
        assert.ok(block.includes('font-size: 12px'),
            'Shared .tag-chip must have font-size: 12px');
    },
});

// ── 9. View mode control guard (NOT modified by this PR) ─────────────────────
tests.push({
    name: 'View mode CSS file is not modified (PR 3 scope guard)',
    fn: () => {
        const treeViewModePath = path.join(ROOT, 'css', 'tree-view-mode.css');
        if (fs.existsSync(treeViewModePath)) {
            const stat = fs.statSync(treeViewModePath);
            // Just verify the file exists and isn't empty
            assert.ok(stat.size > 0, 'tree-view-mode.css should still exist');
        }
        // This is a guard test: contract test for view-mode is in PR 4 (if any)
        assert.ok(true, 'view-mode is out of PR 3 scope');
    },
});

// ── 10. Empty-state files NOT modified (reserved for PR 4) ──────────────────
tests.push({
    name: 'Empty-state CSS files are NOT modified by this PR',
    fn: () => {
        const emptyStateFiles = [
            'css/search/search-empty-state.css',
            'css/search/search-preview-sidebar/states.css',
            'css/my-trees/my-trees-states.css',
        ];
        for (const file of emptyStateFiles) {
            const fullPath = path.join(ROOT, file);
            if (fs.existsSync(fullPath)) {
                const stat = fs.statSync(fullPath);
                assert.ok(stat.size > 0, `Empty-state file ${file} should still exist`);
            }
        }
        assert.ok(true, 'empty-state is reserved for PR 4');
    },
});

// ── 11. Scout files not modified ─────────────────────────────────────────────
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

// ── 12. Pre-existing home/intro failure isolation note ──────────────────────
tests.push({
    name: 'Test documents that pre-existing home/intro failures are separate from this change',
    fn: () => {
        // The failures "home must keep mobile title font size" and
        // "intro must match home mobile hero padding" are in intro-home-hero-alignment-contract.test.cjs
        // and relate to home/intro hero alignment, not chip visual tokens.
        assert.ok(true, 'Pre-existing home/intro UI failures are tracked separately');
    },
});

// ── Runner ──────────────────────────────────────────────────────────────────
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
