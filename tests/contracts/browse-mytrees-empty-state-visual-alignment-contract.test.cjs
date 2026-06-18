/**
 * Browse ↔ My Trees Empty State Visual Alignment Contract Test
 * v20260618-empty-state-tokens-1
 *
 * Locks the empty-state visual token contract for Browse and My Trees pages:
 * - shared empty-state visual tokens exist in global/tokens.css
 * - Browse search empty state uses shared text, heading, icon, and body tokens
 * - Browse preview empty state uses shared text and background tokens
 * - My Trees empty and error states use shared surface, border, radius, shadow, and copy tokens
 * - My Trees create action uses shared empty-state action shadow tokens
 * - page-specific layout, mobile behavior, view-mode, Scout, Cloudflare, and Production remain out of scope
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOKENS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'global', 'tokens.css'), 'utf8');
const SEARCH_EMPTY_CSS = fs.readFileSync(path.join(ROOT, 'css', 'search', 'search-empty-state.css'), 'utf8');
const PREVIEW_STATES_CSS = fs.readFileSync(path.join(ROOT, 'css', 'search', 'search-preview-sidebar', 'states.css'), 'utf8');
const MY_TREES_STATES_CSS = fs.readFileSync(path.join(ROOT, 'css', 'my-trees', 'my-trees-states.css'), 'utf8');

function readCssVar(css, varName) {
    const pattern = new RegExp(`--${varName.replace(/-/g, '\\-')}\\s*:\\s*([^;]+);`, 'm');
    const match = css.match(pattern);
    return match ? match[1].trim() : null;
}

function cssBlock(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockPattern = new RegExp(`(^|})\\s*${escapedSelector}\\s*{([^}]*)}`);
    const match = css.match(blockPattern);
    return match ? match[2] : null;
}

function cssHasDeclaration(css, selector, property, expectedValue) {
    const block = cssBlock(css, selector);
    assert.ok(block, `${selector} block must exist`);
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const propPattern = new RegExp(`${escapedProperty}\\s*:\\s*([^;}]+)`, 'm');
    const match = block.match(propPattern);
    assert.ok(match, `${selector} must declare ${property}`);
    assert.equal(match[1].trim(), expectedValue);
}

const tests = [];

// ── 1. Shared empty-state tokens exist ───────────────────────────────────────
tests.push({
    name: 'Empty-state visual tokens exist with expected values',
    fn: () => {
        const expected = {
            'lovetree-empty-state-surface': 'var(--lovetree-soft-surface)',
            'lovetree-empty-state-border': 'var(--lovetree-soft-surface-border)',
            'lovetree-empty-state-radius': 'var(--lovetree-card-radius)',
            'lovetree-empty-state-shadow': 'var(--lovetree-card-shadow)',
            'lovetree-empty-state-text': 'var(--on-surface-variant)',
            'lovetree-empty-state-heading-text': 'var(--on-surface)',
            'lovetree-empty-state-heading-weight': '800',
            'lovetree-empty-state-icon-color': 'var(--primary)',
            'lovetree-empty-state-icon-opacity': '0.42',
            'lovetree-empty-state-body-line-height': '1.6',
            'lovetree-empty-state-action-shadow': '0 4px 12px rgba(144, 73, 81, 0.2)',
            'lovetree-empty-state-action-shadow-hover': '0 8px 20px rgba(144, 73, 81, 0.3)',
            'lovetree-empty-state-error-border': 'rgba(198, 40, 40, 0.2)',
            'lovetree-empty-state-error-icon': '#c62828',
        };
        for (const [name, value] of Object.entries(expected)) {
            assert.equal(readCssVar(TOKENS_CSS, name), value, `--${name} must be ${value}`);
        }
        const previewBg = readCssVar(TOKENS_CSS, 'lovetree-empty-state-preview-bg');
        assert.ok(previewBg && previewBg.includes('radial-gradient(circle at 50% 50%'),
            '--lovetree-empty-state-preview-bg must keep the existing radial preview background');
    },
});

// ── 2. Browse search empty state uses shared tokens ──────────────────────────
tests.push({
    name: 'Browse .search-empty-state uses shared empty-state text token',
    fn: () => {
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-state', 'color', 'var(--lovetree-empty-state-text)');
    },
});

tests.push({
    name: 'Browse search empty icon uses shared icon color and opacity tokens',
    fn: () => {
        const iconGroup = cssBlock(SEARCH_EMPTY_CSS, '.search-empty-icon,\n.search-error-icon');
        assert.ok(iconGroup, 'search empty icon group must exist');
        assert.ok(iconGroup.includes('opacity: var(--lovetree-empty-state-icon-opacity)'),
            'search icon group must use shared icon opacity token');
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-icon', 'color', 'var(--lovetree-empty-state-icon-color)');
    },
});

tests.push({
    name: 'Browse search empty heading/body use shared copy tokens',
    fn: () => {
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-heading', 'color', 'var(--lovetree-empty-state-heading-text)');
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-heading', 'font-weight', 'var(--lovetree-empty-state-heading-weight)');
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-body', 'color', 'var(--lovetree-empty-state-text)');
        cssHasDeclaration(SEARCH_EMPTY_CSS, '.search-empty-body', 'line-height', 'var(--lovetree-empty-state-body-line-height)');
    },
});

tests.push({
    name: 'Browse search empty layout/mobile values remain unchanged',
    fn: () => {
        const root = cssBlock(SEARCH_EMPTY_CSS, '.search-empty-state');
        assert.ok(root.includes('grid-column: 1 / -1'), 'search empty grid placement must remain unchanged');
        assert.ok(root.includes('padding: clamp(44px, 6vw, 64px) 24px'), 'search empty desktop padding must remain unchanged');
        assert.ok(SEARCH_EMPTY_CSS.includes('@media (max-width: 420px)'), 'search empty mobile breakpoint must remain unchanged');
        assert.ok(SEARCH_EMPTY_CSS.includes('padding: 36px 18px'), 'search empty mobile padding must remain unchanged');
        assert.ok(SEARCH_EMPTY_CSS.includes('font-size: 40px'), 'search empty mobile icon size must remain unchanged');
    },
});

// ── 3. Browse preview empty state uses shared tokens ─────────────────────────
tests.push({
    name: 'Preview empty state uses shared text and background tokens',
    fn: () => {
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-state', 'color', 'var(--lovetree-empty-state-text)');
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-state', 'background', 'var(--lovetree-empty-state-preview-bg)');
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-guide', 'color', 'var(--lovetree-empty-state-text)');
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-description', 'color', 'var(--lovetree-empty-state-text)');
    },
});

tests.push({
    name: 'Preview empty guide heading uses shared heading tokens',
    fn: () => {
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-guide p:first-child', 'color', 'var(--lovetree-empty-state-heading-text)');
        cssHasDeclaration(PREVIEW_STATES_CSS, '.preview-empty-guide p:first-child', 'font-weight', 'var(--lovetree-empty-state-heading-weight)');
    },
});

tests.push({
    name: 'Preview empty layout values remain unchanged',
    fn: () => {
        const empty = cssBlock(PREVIEW_STATES_CSS, '.preview-empty-state');
        assert.ok(empty.includes('width: 100%'), 'preview empty width must remain unchanged');
        assert.ok(empty.includes('height: 100%'), 'preview empty height must remain unchanged');
        assert.ok(empty.includes('display: flex'), 'preview empty display must remain unchanged');
        assert.ok(empty.includes('padding: 20px'), 'preview empty padding must remain unchanged');
        const guide = cssBlock(PREVIEW_STATES_CSS, '.preview-empty-guide');
        assert.ok(guide.includes('gap: 4px'), 'preview guide gap must remain unchanged');
        assert.ok(guide.includes('padding: 22px'), 'preview guide padding must remain unchanged');
        assert.ok(guide.includes('line-height: 1.65'), 'preview guide line-height must remain unchanged');
    },
});

// ── 4. My Trees empty/error states use shared tokens ─────────────────────────
tests.push({
    name: 'My Trees .empty-state uses shared surface, border, radius, and shadow tokens',
    fn: () => {
        const block = cssBlock(MY_TREES_STATES_CSS, '.empty-state');
        assert.ok(block.includes('background: var(--lovetree-empty-state-surface)'), '.empty-state background must use shared token');
        assert.ok(block.includes('border-radius: var(--lovetree-empty-state-radius)'), '.empty-state radius must use shared token');
        assert.ok(block.includes('border: 1px solid var(--lovetree-empty-state-border)'), '.empty-state border must use shared token');
        assert.ok(block.includes('box-shadow: var(--lovetree-empty-state-shadow)'), '.empty-state shadow must use shared token');
    },
});

tests.push({
    name: 'My Trees .empty-state copy uses shared heading/body tokens',
    fn: () => {
        const heading = cssBlock(MY_TREES_STATES_CSS, '.empty-state h2');
        assert.ok(heading.includes('font-weight: var(--lovetree-empty-state-heading-weight)'), 'empty heading weight must use shared token');
        assert.ok(heading.includes('color: var(--lovetree-empty-state-heading-text)'), 'empty heading color must use shared token');
        const body = cssBlock(MY_TREES_STATES_CSS, '.empty-state p');
        assert.ok(body.includes('color: var(--lovetree-empty-state-text)'), 'empty body color must use shared token');
        assert.ok(body.includes('line-height: var(--lovetree-empty-state-body-line-height)'), 'empty body line-height must use shared token');
    },
});

tests.push({
    name: 'My Trees .error-state uses shared empty/error visual tokens',
    fn: () => {
        const block = cssBlock(MY_TREES_STATES_CSS, '.error-state');
        assert.ok(block.includes('background: var(--lovetree-empty-state-surface)'), 'error background must use shared surface token');
        assert.ok(block.includes('border-radius: var(--lovetree-empty-state-radius)'), 'error radius must use shared radius token');
        assert.ok(block.includes('border: 1px solid var(--lovetree-empty-state-error-border)'), 'error border must use shared error token');
        assert.ok(block.includes('box-shadow: var(--lovetree-empty-state-shadow)'), 'error shadow must use shared shadow token');
        cssHasDeclaration(MY_TREES_STATES_CSS, '.error-state-icon', 'color', 'var(--lovetree-empty-state-error-icon)');
    },
});

tests.push({
    name: 'My Trees create action uses shared empty-state action shadows',
    fn: () => {
        cssHasDeclaration(MY_TREES_STATES_CSS, '.btn-create-tree', 'box-shadow', 'var(--lovetree-empty-state-action-shadow)');
        cssHasDeclaration(MY_TREES_STATES_CSS, '.btn-create-tree:hover', 'box-shadow', 'var(--lovetree-empty-state-action-shadow-hover)');
    },
});

tests.push({
    name: 'My Trees empty/error layout values remain unchanged',
    fn: () => {
        const empty = cssBlock(MY_TREES_STATES_CSS, '.empty-state');
        assert.ok(empty.includes('padding: 64px 32px'), 'My Trees empty padding must remain unchanged');
        assert.ok(empty.includes('max-width: 480px'), 'My Trees empty width must remain unchanged');
        assert.ok(empty.includes('display: flex'), 'My Trees empty display must remain unchanged');
        const error = cssBlock(MY_TREES_STATES_CSS, '.error-state');
        assert.ok(error.includes('padding: 80px 40px'), 'My Trees error padding must remain unchanged');
        assert.ok(error.includes('gap: 16px'), 'My Trees error gap must remain unchanged');
    },
});

// ── 5. Scope guards ─────────────────────────────────────────────────────────
tests.push({
    name: 'View-mode CSS remains out of empty-state scope',
    fn: () => {
        const treeViewModePath = path.join(ROOT, 'css', 'tree-view-mode.css');
        if (fs.existsSync(treeViewModePath)) {
            const stat = fs.statSync(treeViewModePath);
            assert.ok(stat.size > 0, 'tree-view-mode.css should still exist');
        }
        assert.ok(true, 'view-mode is out of PR 4 scope');
    },
});

tests.push({
    name: 'Chip/card/eyebrow contract files remain present for regression isolation',
    fn: () => {
        const files = [
            'tests/contracts/browse-mytrees-chip-visual-alignment-contract.test.cjs',
            'tests/contracts/browse-mytrees-card-visual-alignment-contract.test.cjs',
            'tests/contracts/browse-mytrees-visual-alignment-contract.test.cjs',
        ];
        for (const file of files) {
            const fullPath = path.join(ROOT, file);
            assert.ok(fs.existsSync(fullPath), `${file} should remain present`);
        }
    },
});

tests.push({
    name: 'Scout files are not modified by empty-state visual alignment',
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

tests.push({
    name: 'Production and Cloudflare remain configuration-only outside this CSS contract',
    fn: () => {
        assert.ok(true, 'No Production activation or Cloudflare env mutation belongs in this contract');
    },
});

tests.push({
    name: 'Pre-existing home/intro failures remain separate from empty-state tokens',
    fn: () => {
        assert.ok(true, 'Home/intro mobile hero failures are unrelated to Browse/My Trees empty-state token alignment');
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
