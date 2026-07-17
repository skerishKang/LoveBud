const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const html = fs.readFileSync('pages/editor.html', 'utf8');

const TEMPLATE_SCRIPTS = [
    'js/editor/templates/editor-add-memory-form-template.js',
    'js/editor/templates/editor-sidebar-template.js',
    'js/editor/templates/editor-canvas-topbar-template.js',
    'js/editor/templates/editor-empty-guide-template.js',
    'js/editor/templates/editor-floating-toolbar-template.js',
    'js/editor/templates/editor-detail-panel-shell-template.js',
    'js/editor/templates/editor-detail-empty-state-template.js',
    'js/editor/templates/editor-detail-view-mode-template.js',
    'js/editor/templates/editor-detail-edit-mode-template.js'
];

const MODULE_TEMPLATE_SCRIPTS = [
    'js/editor/templates/editor-add-memory-form-template.js',
    'js/editor/templates/editor-canvas-topbar-template.js',
    'js/editor/templates/editor-empty-guide-template.js',
    'js/editor/templates/editor-sidebar-template.js',
    'js/editor/templates/editor-floating-toolbar-template.js',
    'js/editor/templates/editor-detail-panel-shell-template.js',
    'js/editor/templates/editor-detail-empty-state-template.js',
    'js/editor/templates/editor-detail-view-mode-template.js',
    'js/editor/templates/editor-detail-edit-mode-template.js'
];

function isModuleTemplate(script) {
    return MODULE_TEMPLATE_SCRIPTS.includes(script);
}

// Mount IDs that exist directly in editor.html (top-level)
const HTML_MOUNT_IDS = [
    'addMemoryFormTemplateMount',
    'editorSidebarTemplateMount',
    'editorCanvasTopbarTemplateMount',
    'editorEmptyGuideTemplateMount',
    'editorFloatingToolbarTemplateMount',
    'editorDetailPanelShellTemplateMount'
];

// Mount IDs nested inside editor-detail-panel-shell-template.js (not in editor.html)
const NESTED_MOUNT_IDS = [
    'editorDetailEditModeTemplateMount',
    'editorDetailEmptyStateTemplateMount',
    'editorDetailViewModeTemplateMount'
];

// --- 1. Top-level mount elements appear before template scripts ---

test('top-level mount elements appear before template scripts in editor.html', () => {
    for (const mountId of HTML_MOUNT_IDS) {
        const mountIndex = html.indexOf(`id="${mountId}"`);
        assert.notEqual(mountIndex, -1, `mount element #${mountId} must exist in editor.html`);
        const firstTemplateIndex = html.indexOf(TEMPLATE_SCRIPTS[0]);
        assert.ok(mountIndex < firstTemplateIndex,
            `mount element #${mountId} must appear before first template script`);
    }
});

// --- 2. Nested mount IDs exist inside the detail panel shell template ---

test('nested detail mount IDs exist inside editor-detail-panel-shell-template.js', () => {
    const shellPath = 'js/editor/templates/editor-detail-panel-shell-template.js';
    assert.ok(fs.existsSync(shellPath), 'detail panel shell template must exist');
    const shellContent = fs.readFileSync(shellPath, 'utf8');
    for (const mountId of NESTED_MOUNT_IDS) {
        assert.ok(shellContent.includes(`id="${mountId}"`),
            `detail panel shell template must contain nested mount element #${mountId}`);
    }
});

// --- 3. Template scripts load before editor.js ---

test('all 9 template scripts load before js/editor.js', () => {
    const editorJsIndex = html.indexOf('js/editor.js');
    assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');

    for (const script of TEMPLATE_SCRIPTS) {
        const scriptIndex = html.indexOf(script);
        assert.notEqual(scriptIndex, -1, `template script ${script} must exist`);
        assert.ok(scriptIndex < editorJsIndex,
            `template script ${script} must load before js/editor.js`);
    }
});

test('template scripts load before first runtime script (editor-dom-selectors.js)', () => {
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    assert.notEqual(domSelectorsIndex, -1, 'editor-dom-selectors.js must be loaded');

    for (const script of TEMPLATE_SCRIPTS) {
        const scriptIndex = html.indexOf(script);
        assert.ok(scriptIndex < domSelectorsIndex,
            `template script ${script} must load before editor-dom-selectors.js`);
    }
});

// --- 4. Template files don't create window provider globals ---

test('template files do not create window.LoveBudEditor* or window.createEditor* providers', () => {
    for (const script of TEMPLATE_SCRIPTS) {
        const filePath = script;
        assert.ok(fs.existsSync(filePath), `template file ${filePath} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');
        assert.doesNotMatch(content, /window\.LoveBudEditor[A-Z]/,
            `template ${script} must not set window.LoveBudEditor* globals`);
        assert.doesNotMatch(content, /window\.createEditor[A-Z]/,
            `template ${script} must not set window.createEditor* globals`);
    }
});

// --- 5. Template files use IIFE + mount.outerHTML pattern ---

test('template files use IIFE pattern with mount.outerHTML replacement', () => {
    for (const script of TEMPLATE_SCRIPTS) {
        const filePath = script;
        const content = fs.readFileSync(filePath, 'utf8');
        if (isModuleTemplate(script)) {
            // Module templates use export function instead of IIFE
            assert.match(content, /export\s+function\s+build\w+Template\s*\(/,
                `module template ${script} must use export function builder`);
            assert.doesNotMatch(content, /^\(function\(\)\s*\{/,
                `module template ${script} must not use IIFE wrapper`);
        } else {
            assert.match(content, /^\(function\(\)\s*\{/,
                `template ${script} must start with IIFE pattern`);
        }
        // All templates: mount.outerHTML = builder call
        assert.match(content, /mount\.outerHTML\s*=\s*build\w+Template\(\)/,
            `template ${script} must use mount.outerHTML = buildXxxTemplate()`);
        assert.match(content, /document\.getElementById\(.*TemplateMount/,
            `template ${script} must reference a TemplateMount element`);
    }
});

// --- 6. All 9 mount IDs are accounted for (6 in HTML + 3 in shell) ---

test('all 9 mount IDs are accounted for across editor.html and shell template', () => {
    for (const mountId of HTML_MOUNT_IDS) {
        assert.ok(html.includes(`id="${mountId}"`),
            `editor.html must contain mount element with id="${mountId}"`);
    }
    const shellContent = fs.readFileSync('js/editor/templates/editor-detail-panel-shell-template.js', 'utf8');
    for (const mountId of NESTED_MOUNT_IDS) {
        assert.ok(shellContent.includes(`id="${mountId}"`),
            `shell template must contain nested mount element with id="${mountId}"`);
    }
});

// --- 7. Top-level mount elements are empty divs ---

test('top-level mount elements in editor.html are empty placeholder divs', () => {
    for (const mountId of HTML_MOUNT_IDS) {
        const mountPattern = new RegExp(`id="${mountId}"[^>]*>\\s*</div>`);
        assert.match(html, mountPattern,
            `mount element #${mountId} must be an empty div (no inner content)`);
    }
});

// --- 8. No duplicate template scripts ---

test('no duplicate template script references in editor.html', () => {
    for (const script of TEMPLATE_SCRIPTS) {
        const firstIndex = html.indexOf(script);
        const secondIndex = html.indexOf(script, firstIndex + 1);
        assert.equal(secondIndex, -1,
            `template script ${script} must not be loaded more than once`);
    }
});

// --- 10. Templates with builder functions ---

test('editor-add-memory-form-template.js defines buildAddMemoryFormTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-add-memory-form-template.js', 'utf8');
    assert.match(content, /export\s+function buildAddMemoryFormTemplate\(\)/,
        'must define buildAddMemoryFormTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildAddMemoryFormTemplate\(\)/,
        'must call buildAddMemoryFormTemplate() for mount.outerHTML');
});

test('editor-canvas-topbar-template.js defines buildCanvasTopbarTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-canvas-topbar-template.js', 'utf8');
    assert.match(content, /export\s+function buildCanvasTopbarTemplate\(\)/,
        'must define buildCanvasTopbarTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildCanvasTopbarTemplate\(\)/,
        'must call buildCanvasTopbarTemplate() for mount.outerHTML');
});

test('editor-empty-guide-template.js defines buildEmptyGuideTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-empty-guide-template.js', 'utf8');
    assert.match(content, /export\s+function buildEmptyGuideTemplate\(\)/,
        'must define buildEmptyGuideTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildEmptyGuideTemplate\(\)/,
        'must call buildEmptyGuideTemplate() for mount.outerHTML');
});

test('editor-sidebar-template.js defines buildSidebarTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-sidebar-template.js', 'utf8');
    assert.match(content, /export\s+function buildSidebarTemplate\(\)/,
        'must define buildSidebarTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildSidebarTemplate\(\)/,
        'must call buildSidebarTemplate() for mount.outerHTML');
});

test('editor-floating-toolbar-template.js defines buildFloatingToolbarTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-floating-toolbar-template.js', 'utf8');
    assert.match(content, /export\s+function buildFloatingToolbarTemplate\(\)/,
        'must define buildFloatingToolbarTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildFloatingToolbarTemplate\(\)/,
        'must call buildFloatingToolbarTemplate() for mount.outerHTML');
});

test('editor-detail-panel-shell-template.js defines buildDetailPanelShellTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-detail-panel-shell-template.js', 'utf8');
    assert.match(content, /export\s+function buildDetailPanelShellTemplate\(\)/,
        'must define buildDetailPanelShellTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildDetailPanelShellTemplate\(\)/,
        'must call buildDetailPanelShellTemplate() for mount.outerHTML');
});

test('editor-detail-empty-state-template.js defines buildDetailEmptyStateTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-detail-empty-state-template.js', 'utf8');
    assert.match(content, /export\s+function buildDetailEmptyStateTemplate\(\)/,
        'must define buildDetailEmptyStateTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildDetailEmptyStateTemplate\(\)/,
        'must call buildDetailEmptyStateTemplate() for mount.outerHTML');
});

test('editor-detail-view-mode-template.js defines buildDetailViewModeTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-detail-view-mode-template.js', 'utf8');
    assert.match(content, /export\s+function buildDetailViewModeTemplate\(\)/,
        'must define buildDetailViewModeTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildDetailViewModeTemplate\(\)/,
        'must call buildDetailViewModeTemplate() for mount.outerHTML');
});

test('editor-detail-edit-mode-template.js defines buildDetailEditModeTemplate builder', () => {
    const content = fs.readFileSync('js/editor/templates/editor-detail-edit-mode-template.js', 'utf8');
    assert.match(content, /export\s+function buildDetailEditModeTemplate\(\)/,
        'must define buildDetailEditModeTemplate as exported function');
    assert.match(content, /mount\.outerHTML\s*=\s*buildDetailEditModeTemplate\(\)/,
        'must call buildDetailEditModeTemplate() for mount.outerHTML');
});

// --- 11. Template script count matches expected ---

test('exactly 9 template scripts are loaded in editor.html', () => {
    let count = 0;
    for (const script of TEMPLATE_SCRIPTS) {
        if (html.indexOf(script) !== -1) count++;
    }
    assert.equal(count, 9, 'editor.html must load exactly 9 template scripts');
});

// --- 12. Module script type verification in editor.html ---

test('editor-add-memory-form-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-add-memory-form-template\.js/;
    assert.match(html, modulePattern,
        'editor-add-memory-form-template.js must be loaded with type="module"');
});

test('editor-canvas-topbar-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-canvas-topbar-template\.js/;
    assert.match(html, modulePattern,
        'editor-canvas-topbar-template.js must be loaded with type="module"');
});

test('editor-empty-guide-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-empty-guide-template\.js/;
    assert.match(html, modulePattern,
        'editor-empty-guide-template.js must be loaded with type="module"');
});

test('editor-sidebar-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-sidebar-template\.js/;
    assert.match(html, modulePattern,
        'editor-sidebar-template.js must be loaded with type="module"');
});

test('editor-floating-toolbar-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-floating-toolbar-template\.js/;
    assert.match(html, modulePattern,
        'editor-floating-toolbar-template.js must be loaded with type="module"');
});

test('editor-detail-panel-shell-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-detail-panel-shell-template\.js/;
    assert.match(html, modulePattern,
        'editor-detail-panel-shell-template.js must be loaded with type="module"');
});

test('editor-detail-empty-state-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-detail-empty-state-template\.js/;
    assert.match(html, modulePattern,
        'editor-detail-empty-state-template.js must be loaded with type="module"');
});

test('editor-detail-view-mode-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-detail-view-mode-template\.js/;
    assert.match(html, modulePattern,
        'editor-detail-view-mode-template.js must be loaded with type="module"');
});

test('editor-detail-edit-mode-template.js is loaded as type="module" in editor.html', () => {
    const modulePattern = /<script\s+type="module"\s+src="[^"]*editor-detail-edit-mode-template\.js/;
    assert.match(html, modulePattern,
        'editor-detail-edit-mode-template.js must be loaded with type="module"');
});

test('all 9 template scripts are loaded as type="module"', () => {
    for (const script of TEMPLATE_SCRIPTS) {
        assert.ok(isModuleTemplate(script), `template ${script} must be in MODULE_TEMPLATE_SCRIPTS`);
    }
    assert.equal(MODULE_TEMPLATE_SCRIPTS.length, 9, 'all 9 templates must be ESM modules');
});

test('remaining 0 template scripts are NOT loaded as type="module"', () => {
    const classicTemplates = TEMPLATE_SCRIPTS.filter(s => !isModuleTemplate(s));
    assert.equal(classicTemplates.length, 0, 'no classic templates should remain');
});
