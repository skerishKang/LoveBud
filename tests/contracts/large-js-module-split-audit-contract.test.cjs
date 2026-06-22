/**
 * Large JS Module Split Audit Contract Test (Issue #2713)
 *
 * Guards that the audit document exists and covers the required modules
 * at the baseline SHA. This test checks document structure only — it does
 * not assert exact line counts (which change over time) and does not test
 * runtime behavior.
 *
 * Intentionally non-brittle: checks for section headings, not exact content.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const AUDIT_DOC = 'docs/engineering/LARGE_JS_MODULE_SPLIT_AUDIT.md';

const REQUIRED_MODULES = [
    'js/editor.js',
    'js/viewer/public-viewer-detail-ui.js',
    'js/editor/editor-canvas.js',
    'js/scout/scout-draft-ui.js',
    'js/viewer/public-canvas-init.js'
];

const REQUIRED_SECTIONS = [
    '## 1. `js/editor.js`',
    '## 2. `js/viewer/public-viewer-detail-ui.js`',
    '## 3. `js/editor/editor-canvas.js`',
    '## 4. `js/scout/scout-draft-ui.js`',
    '## 5. `js/viewer/public-canvas-init.js`'
];

function read(relativePath) {
    const full = path.join(ROOT, relativePath);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf8');
}

test('1. Audit document exists at expected path', () => {
    const content = read(AUDIT_DOC);
    assert.ok(content !== null, `${AUDIT_DOC} must exist`);
});

test('2. All 5 target modules are listed in the Baseline line counts table', () => {
    const content = read(AUDIT_DOC);
    assert.ok(content, 'Audit doc must be readable');
    for (const mod of REQUIRED_MODULES) {
        assert.ok(
            content.includes(mod),
            `Audit doc must list ${mod} in the baseline table`
        );
    }
});

test('3. Each module has a dedicated audit section', () => {
    const content = read(AUDIT_DOC);
    assert.ok(content, 'Audit doc must be readable');
    for (const heading of REQUIRED_SECTIONS) {
        assert.ok(
            content.includes(heading),
            `Audit doc must contain section heading for ${heading}`
        );
    }
});

test('4. Each section documents public API, DOM ownership, extraction candidates, and risky sections', () => {
    const content = read(AUDIT_DOC);
    assert.ok(content, 'Audit doc must be readable');
    // Check that every numbered section has the required subsections.
    // We look for the subsection headings rather than exact content to stay non-brittle.
    const requiredSubheadings = ['### Public API', '### DOM ownership', '### Low-risk extraction', '### Risky'];
    for (const section of REQUIRED_SECTIONS) {
        // Find the section start.
        const startIdx = content.indexOf(section);
        assert.ok(startIdx >= 0, `Section ${section} must exist`);
        // Find the next section or end of doc.
        const nextSection = REQUIRED_SECTIONS.indexOf(section) < REQUIRED_SECTIONS.length - 1
            ? content.indexOf(REQUIRED_SECTIONS[REQUIRED_SECTIONS.indexOf(section) + 1])
            : content.length;
        const sectionText = content.substring(startIdx, nextSection);
        for (const sub in requiredSubheadings) {
            assert.ok(
                sectionText.includes(requiredSubheadings[sub]),
                `Section ${section} must contain "${requiredSubheadings[sub]}" subsection`
            );
        }
    }
});

test('5. Follow-up split order and "No behavior changes" acceptance are documented', () => {
    const content = read(AUDIT_DOC);
    assert.ok(content, 'Audit doc must be readable');
    assert.ok(
        content.includes('### Phase 1') || content.includes('## Summary') || content.includes('one-file-at-a-time'),
        'Audit doc must recommend staged follow-up splits'
    );
    assert.ok(
        content.includes('No behavior changes') || content.includes('no runtime') || content.includes('audit/docs-only'),
        'Audit doc must state this is audit/docs-only with no behavior changes'
    );
    assert.ok(
        content.includes('#1882'),
        'Audit doc must reference #1882 as keep-open'
    );
});
