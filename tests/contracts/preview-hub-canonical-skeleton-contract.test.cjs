/**
 * LoveBud Preview Hub Canonical Skeleton — Contract Test (Issue #2841)
 *
 * Validates that both Browse and My Trees hub panels share the same
 * semantic slot skeleton:
 *
 *   aside.preview-hub
 *     header
 *     media slot
 *     content slot
 *       heading slot
 *       meta slot
 *       flow slot
 *       summary slot
 *       actions slot
 *       social slot
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const browseHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
const myTreesHtml = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');
const browseRendererJs = fs.readFileSync(path.join(ROOT, 'js/search/search-preview-renderer.js'), 'utf8');
const sharedScrollCss = fs.readFileSync(path.join(ROOT, 'css/shared/preview-hub-scroll.css'), 'utf8');
const searchCss = fs.readFileSync(path.join(ROOT, 'css/search.css'), 'utf8');
const myTreesCss = fs.readFileSync(path.join(ROOT, 'css/my-trees.css'), 'utf8');

// ── 1) Both pages have .preview-hub class ─────────────────────────────
test('Browse aside has .preview-hub class', () => {
    assert.match(
        browseHtml,
        /class="[^"]*preview-hub[^"]*"/,
        'Browse sidebar must have preview-hub class'
    );
});

test('My Trees aside has .preview-hub class', () => {
    assert.match(
        myTreesHtml,
        /class="[^"]*preview-hub[^"]*"/,
        'My Trees hub panel must have preview-hub class'
    );
});

// ── 2) Shared scroll module imported by both pages ────────────────────
test('Shared scroll CSS is imported by search.css', () => {
    assert.match(
        searchCss,
        /@import url\(['"](?:\.\.\/shared\/|\.\/shared\/)preview-hub-scroll\.css['"]\)/,
        'search.css must import shared preview-hub-scroll.css'
    );
});

test('Shared scroll CSS is NOT directly linked from HTML entrypoints (CSS import only)', () => {
    // Shared scroll CSS must only be loaded via CSS @import chains, not direct <link>.
    // This prevents duplicate-load and stale-cache scenarios.
    const linkRe = /<link[^>]*preview-hub-scroll\.css[^>]*>/i;
    assert.ok(
        !linkRe.test(browseHtml),
        'Browse HTML must NOT have a direct <link> to preview-hub-scroll.css'
    );
    assert.ok(
        !linkRe.test(myTreesHtml),
        'My Trees HTML must NOT have a direct <link> to preview-hub-scroll.css'
    );
});

test('Shared scroll CSS defines .preview-hub rules', () => {
    assert.match(sharedScrollCss, /\.preview-hub\s*\{/);
    assert.match(sharedScrollCss, /max-height:\s*calc\(100dvh\s*-\s*120px\)/);
    assert.match(sharedScrollCss, /overflow-y:\s*auto/);
    assert.match(sharedScrollCss, /overscroll-behavior:\s*contain/);
    assert.match(sharedScrollCss, /scrollbar-gutter:\s*stable\s+both-edges/);
});

// ── 3) Browse canonical slot order ────────────────────────────────────
function getBrowseSlotIndexes(html) {
    const slots = [
        { id: 'previewVideoContainer', label: 'media slot' },
        { id: 'previewDesc', label: 'content slot' },
    ];
    const result = {};
    for (const slot of slots) {
        const idx = html.indexOf(`id="${slot.id}"`);
        assert.ok(idx !== -1, `Browse must have #${slot.id}`);
        result[slot.label] = idx;
    }
    return result;
}

function getBrowseContentInnerSlots(html) {
    const slots = [
        { id: 'previewTitle', label: 'heading slot' },
        { id: 'previewHubMetaSlot', label: 'meta slot' },
        { id: 'previewHubFlowSlot', label: 'flow slot' },
        { id: 'previewHubSummarySlot', label: 'summary slot' },
        { id: 'previewHubActionsSlot', label: 'actions slot' },
        { id: 'previewHubSocialSlot', label: 'social slot' },
    ];
    const result = {};
    for (const slot of slots) {
        const idx = html.indexOf(`id="${slot.id}"`);
        assert.ok(idx !== -1, `Browse must have #${slot.id}`);
        result[slot.label] = idx;
    }
    return result;
}

test('Browse hub slots follow canonical order (media → content)', () => {
    const idx = getBrowseSlotIndexes(browseHtml);
    assert.ok(idx['media slot'] < idx['content slot'],
        'media slot must come before content slot');
});

test('Browse content inner slots follow canonical order (heading → meta → flow → summary → actions → social)', () => {
    const inner = getBrowseContentInnerSlots(browseHtml);
    assert.ok(inner['heading slot'] < inner['meta slot'],
        'heading slot must come before meta slot');
    assert.ok(inner['meta slot'] < inner['flow slot'],
        'meta slot must come before flow slot');
    assert.ok(inner['flow slot'] < inner['summary slot'],
        'flow slot must come before summary slot');
    assert.ok(inner['summary slot'] < inner['actions slot'],
        'summary slot must come before actions slot');
    assert.ok(inner['actions slot'] < inner['social slot'],
        'actions slot must come before social slot');
});

test('Browse has no #previewDetails wrapper (removed)', () => {
    assert.ok(
        !browseHtml.includes('id="previewDetails"'),
        '#previewDetails wrapper must be removed from Browse HTML'
    );
});

// ── 4) My Trees canonical slot order ──────────────────────────────────
function getMyTreesSlotIndexes(html) {
    const slots = [
        { id: 'myTreesHubVideoContainer', label: 'media slot' },
        { id: 'myTreesHubContent', label: 'content slot' },
    ];
    const result = {};
    for (const slot of slots) {
        const idx = html.indexOf(`id="${slot.id}"`);
        assert.ok(idx !== -1, `My Trees must have #${slot.id}`);
        result[slot.label] = idx;
    }
    return result;
}

function getMyTreesContentInnerSlots(html) {
    const slots = [
        { id: 'myTreesHubTreeTitle', label: 'heading slot (title)' },
        { id: 'myTreesHubMetaBadge', label: 'meta slot (badge)' },
        { id: 'myTreesHubFlow', label: 'flow slot' },
        { id: 'myTreesHubNoMoments', label: 'no-moments slot' },
        { id: 'myTreesHubSummary', label: 'summary slot' },
        { id: 'myTreesHubActions', label: 'actions slot' },
        { id: 'myTreesHubSocialSlot', label: 'social slot' },
    ];
    const result = {};
    for (const slot of slots) {
        const idx = html.indexOf(`id="${slot.id}"`);
        assert.ok(idx !== -1, `My Trees must have #${slot.id}`);
        result[slot.label] = idx;
    }
    return result;
}

test('My Trees hub slots follow canonical order (media → content)', () => {
    const idx = getMyTreesSlotIndexes(myTreesHtml);
    assert.ok(idx['media slot'] < idx['content slot'],
        'media slot must come before content slot');
});

test('My Trees content inner slots follow canonical order (heading → meta → flow → no-moments → summary → actions → social)', () => {
    const inner = getMyTreesContentInnerSlots(myTreesHtml);
    assert.ok(inner['heading slot (title)'] < inner['meta slot (badge)'],
        'heading slot must come before meta slot');
    assert.ok(inner['meta slot (badge)'] < inner['flow slot'],
        'meta slot must come before flow slot');
    assert.ok(inner['flow slot'] < inner['no-moments slot'],
        'flow slot must come before no-moments slot');
    assert.ok(inner['no-moments slot'] < inner['summary slot'],
        'no-moments slot must come before summary slot');
    assert.ok(inner['summary slot'] < inner['actions slot'],
        'summary slot must come before actions slot');
    assert.ok(inner['actions slot'] < inner['social slot'],
        'actions slot must come before social slot');
});

test('My Trees has no #myTreesHubDetails wrapper (removed)', () => {
    assert.ok(
        !myTreesHtml.includes('id="myTreesHubDetails"'),
        '#myTreesHubDetails wrapper must be removed from My Trees HTML'
    );
});

// ── 5) Browse renderer uses individual slot hosts ─────────────────────
test('Browse renderer writes to previewHubFlowSlot', () => {
    assert.match(
        browseRendererJs,
        /previewHubFlowSlot\.innerHTML\s*=/,
        'search-preview-renderer.js must write to previewHubFlowSlot'
    );
});

test('Browse renderer writes to previewHubSummarySlot', () => {
    assert.match(
        browseRendererJs,
        /previewHubSummarySlot\.innerHTML\s*=/,
        'search-preview-renderer.js must write to previewHubSummarySlot'
    );
});

test('Browse renderer writes to previewHubActionsSlot', () => {
    assert.match(
        browseRendererJs,
        /previewHubActionsSlot\.innerHTML\s*=/,
        'search-preview-renderer.js must write to previewHubActionsSlot'
    );
});

test('Browse renderer no longer writes flat innerHTML to previewDesc for flow/summary/actions', () => {
    // The renderer should not contain the old concatenated flow + summary + actions pattern
    // inside previewDesc.innerHTML assignment. It still writes the placeholder text to
    // previewDesc in resetPreview, but the main update path uses slot hosts.
    const hasOldFlatFlowSummaryActions = /previewDesc\.innerHTML\s*=.*preview-focus-flow-card/.test(browseRendererJs);
    assert.ok(
        !hasOldFlatFlowSummaryActions,
        'search-preview-renderer.js must not write flow/summary/actions as flat innerHTML to previewDesc'
    );
});

// ── 6) Browse social shell targets previewHubSocialSlot ────────────────
test('hub-dom-patch uses previewHubSocialSlot for social shell', () => {
    const domPatchJs = fs.readFileSync(
        path.join(ROOT, 'js/search/search-preview-hub-dom-patch.js'), 'utf8');
    assert.match(
        domPatchJs,
        /getElementById\(['"]previewHubSocialSlot['"]\)/,
        'hub-dom-patch must reference #previewHubSocialSlot'
    );
});

test('playable-hub-patch uses previewHubSocialSlot for social shell', () => {
    const playablePatchJs = fs.readFileSync(
        path.join(ROOT, 'js/search/search-preview-playable-hub-patch.js'), 'utf8');
    assert.match(
        playablePatchJs,
        /getElementById\(['"]previewHubSocialSlot['"]\)/,
        'playable-hub-patch must reference #previewHubSocialSlot'
    );
});

// ── 7) My Trees getEls() has no details ref ────────────────────────────
test('My Trees getEls() no longer returns details', () => {
    const myTreesHubJs = fs.readFileSync(
        path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'), 'utf8');
    assert.ok(
        !myTreesHubJs.includes("details: document.getElementById('myTreesHubDetails')"),
        'getEls must not have a details property'
    );
    assert.ok(
        !myTreesHubJs.includes("details: document.getElementById(\"myTreesHubDetails\")"),
        'getEls must not have a details property (double-quote variant)'
    );
});

// ── 8) Old search-preview-scroll-fix.css is no-op alias ────────────────
test('search-preview-scroll-fix.css is a no-op alias', () => {
    const oldScrollCss = fs.readFileSync(
        path.join(ROOT, 'css/search/search-preview-scroll-fix.css'), 'utf8');
    assert.ok(
        oldScrollCss.includes('Superseded by'),
        'old scroll fix CSS must be a no-op alias referencing the shared module'
    );
    assert.ok(
        !oldScrollCss.includes('max-height: calc(100dvh - 120px)'),
        'old scroll fix CSS must not contain active rules'
    );
});

// ── 9) Existing IDs preserved ─────────────────────────────────────────
test('Browse preserves all existing IDs', () => {
    const requiredIds = [
        'previewSidebar', 'previewVideoContainer', 'previewDesc',
        'previewTitle', 'previewTreeStats', 'previewMemoriesCount',
        'previewTreeDuration', 'previewEmotionSection', 'previewEmotionTags'
    ];
    for (const id of requiredIds) {
        assert.match(browseHtml, new RegExp(`id=["']${id}["']`),
            `Browse HTML must retain #${id}`);
    }
});

test('My Trees preserves all retained canonical IDs and drops obsolete Edit ID', () => {
    const requiredIds = [
        'myTreesHubPanel', 'myTreesHubVideoContainer', 'myTreesHubContent',
        'myTreesHubTreeTitle', 'myTreesHubMetaBadge',
        'myTreesHubFlow', 'myTreesHubNoMoments', 'myTreesHubSummary',
        'myTreesHubOpenBtn', 'myTreesHubShareBtn'
    ];
    for (const id of requiredIds) {
        assert.match(myTreesHtml, new RegExp(`id=["']${id}["']`),
            `My Trees HTML must retain #${id}`);
    }
    // #3578 Phase 1: direct Edit from the hub is removed; the obsolete Edit ID
    // must no longer exist in the markup.
    assert.doesNotMatch(myTreesHtml, /id=["']myTreesHubEditBtn["']/,
        'My Trees HTML must NOT retain obsolete #myTreesHubEditBtn (#3578)');
});

// ── 10) Browse reset must NOT destroy canonical slot hosts ─────────────
test('Browse resetPreview does not use previewDesc.innerHTML for placeholder', () => {
    // resetPreview must clear individual slot hosts, not nuke #previewDesc's children.
    // It may set previewDesc.hidden but must not set previewDesc.innerHTML.
    // Check that the only remaining previewDesc.innerHTML assignment is in updatePreview
    // (which is the normal update path that renders new content into slot hosts).
    const resetLine = /previewDesc\.innerHTML\s*=/.exec(browseRendererJs);
    // In updatePreview, previewDesc.innerHTML is NOT used. But let's be more precise:
    // The renderer must NOT use previewDesc.innerHTML in resetPreview.
    // We check that the ONLY innerHTML on previewDesc is in the updatePreview path,
    // which should only set previewDesc.hidden.
    const match = browseRendererJs.match(/previewDesc\.innerHTML\s*=/);
    // After the fix, resetPreview no longer sets previewDesc.innerHTML.
    // The only valid use would be in updatePreview to set hidden state, which uses .hidden, not innerHTML.
    assert.ok(match === null, 'resetPreview must not set previewDesc.innerHTML');
});

test('Browse resetPreview renders placeholder into previewHubSummarySlot after clearing all slots', () => {
    // resetPreview must first clear all canonical slots (including summary),
    // then render the placeholder into summary slot last.
    // Verify that summary clear precedes placeholder assignment.
    const clearIdx = browseRendererJs.indexOf("previewHubSummarySlot.innerHTML = ''");
    const placeholderIdx = browseRendererJs.indexOf("previewHubSummarySlot.innerHTML = '<p class=\"preview-empty-description\">");
    assert.ok(clearIdx !== -1, 'resetPreview must clear previewHubSummarySlot');
    assert.ok(placeholderIdx !== -1, 'resetPreview must render placeholder into previewHubSummarySlot');
    assert.ok(placeholderIdx > clearIdx,
        'placeholder assignment must come after summary clear in resetPreview');
});

// ── 11) Browse dynamic metadata host ───────────────────────────────────
test('Browse HTML has #previewHubDynamicMetadataSlot inside meta slot', () => {
    const idxMetaSlot = browseHtml.indexOf('id="previewHubMetaSlot"');
    const idxDynamicMeta = browseHtml.indexOf('id="previewHubDynamicMetadataSlot"');
    const idxTreeStats = browseHtml.indexOf('id="previewTreeStats"');
    assert.ok(idxDynamicMeta !== -1, 'Browse HTML must have #previewHubDynamicMetadataSlot');
    assert.ok(idxDynamicMeta > idxMetaSlot, '#previewHubDynamicMetadataSlot must be inside #previewHubMetaSlot');
    assert.ok(idxTreeStats > idxDynamicMeta, '#previewTreeStats must be after #previewHubDynamicMetadataSlot');
});

test('Browse renderer writes hubMetadataHtml to dynamic metadata slot via getElementById', () => {
    // The renderer uses a variable for the dynamic metadata host.
    const usesDynamicMeta = /document\.getElementById\(['"]previewHubDynamicMetadataSlot['"]\)/.test(browseRendererJs);
    const overwritesMetaSlot = /previewHubMetaSlot\.innerHTML\s*=/.test(browseRendererJs);
    assert.ok(usesDynamicMeta, 'renderer must reference #previewHubDynamicMetadataSlot');
    assert.ok(!overwritesMetaSlot, 'renderer must NOT write directly to previewHubMetaSlot.innerHTML');
});

// ── 12) Static meta IDs preserved through dynamic rendering ────────────
test('Browse static #previewTreeStats and #previewEmotionSection are not removed by reset', () => {
    // resetPreview clears the dynamic metadata host via getElementById, not previewHubMetaSlot.innerHTML.
    const hasMetaSlotInnerHtml = /previewHubMetaSlot\.innerHTML\s*=/.test(browseRendererJs);
    assert.ok(!hasMetaSlotInnerHtml, 'resetPreview must not clear previewHubMetaSlot.innerHTML');
});

test('Browse reset + update path renders to flow/summary/actions slot hosts', () => {
    // After reset, the updatePreview path writes to individual slot hosts.
    // (Social slot is populated by hub-dom-patch/playable-hub-patch, not the renderer.)
    assert.match(browseRendererJs, /previewHubFlowSlot\.innerHTML\s*=\s*`/,
        'updatePreview must write to previewHubFlowSlot');
    assert.match(browseRendererJs, /previewHubSummarySlot\.innerHTML\s*=\s*`/,
        'updatePreview must write to previewHubSummarySlot');
    assert.match(browseRendererJs, /previewHubActionsSlot\.innerHTML\s*=\s*`/,
        'updatePreview must write to previewHubActionsSlot');
});

// ── 13) My Trees social shell targets #myTreesHubSocialSlot in canonical DOM ─
test('My Trees social shell uses socialSlot.appendChild when socialSlot exists', () => {
    const myTreesHubJs = fs.readFileSync(
        path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'), 'utf8');
    // The primary path must be socialSlot.appendChild(shell) — this is the canonical branch.
    // The fallback els.actions.after(shell) must be in the else branch.
    const socialSlotPrimary = /if\s*\(\s*socialSlot\s*\)\s*\{[\s\S]*?socialSlot\.appendChild\s*\((?:createMyTreesSocialShell\(\)|shell)\)/.test(myTreesHubJs);
    const fallbackActionsAfter = /else\s*\{[\s\S]*?els\.actions\.after\s*\((?:createMyTreesSocialShell\(\)|shell)\)/.test(myTreesHubJs);
    assert.ok(socialSlotPrimary, 'canonical DOM: social shell must use socialSlot.appendChild');
    assert.ok(fallbackActionsAfter, 'legacy fallback: else branch must use els.actions.after');
});

// ── 14) My Trees social count query scoped to #myTreesHubPanel ──────────
test('My Trees social count query uses els.panel scope (panel-scoped)', () => {
    const myTreesHubJs = fs.readFileSync(
        path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'), 'utf8');
    // Social count queries use els.panel (i.e. #myTreesHubPanel) as query scope
    // to avoid picking up Browse panel elements when both panels coexist.
    assert.match(
        myTreesHubJs,
        /panelScope\s*\?\s*panelScope\.querySelector/,
        'social count query must scope to panel element'
    );
});
