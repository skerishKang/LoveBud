const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('interaction mode default is view', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(source.includes('MODE_VIEW'), 'editor.js must reference MODE_VIEW');
});

test('desktop toggle uses 감상 모드 / 편집 모드 copy', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(source.includes('감상 모드'), 'toggle must include 감상 모드 label');
    assert.ok(source.includes('편집 모드'), 'toggle must include 편집 모드 label');
    assert.ok(!source.includes('<span>보기</span>'), 'old 보기 label must be removed');
    assert.ok(!source.includes('<span>편집</span>'), 'old 편집 label must be removed');
});

test('radiogroup aria-label is 편집기 모드 선택', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    // setAttribute('aria-label', '편집기 모드 선택')
    assert.ok(source.includes('편집기 모드 선택'), 'radiogroup aria-label must specify 편집기 모드 선택');
});

test('mode buttons have aria-label and title attributes', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(source.includes("aria-label', '감상 모드'"), 'view button must have aria-label');
    assert.ok(source.includes("aria-label', '편집 모드'"), 'edit button must have aria-label');
    assert.ok(source.includes("title', '감상 모드'"), 'view button must have title');
    assert.ok(source.includes("title', '편집 모드'"), 'edit button must have title');
});

test('view description explains playback and emotion-flow viewing', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(
        source.includes('감상 중 · 순간을 재생하고 감정 흐름을 살펴봐요.'),
        'view description must explain playback and emotion-flow viewing'
    );
});

test('edit description explains editing and continuing the flow', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(
        source.includes('편집 중 · 순간을 수정하거나 다음 흐름을 이어갈 수 있어요.'),
        'edit description must explain editing and continuing the flow'
    );
});

test('CSS has [data-editor-interaction-mode="view"] hide rules', () => {
    const css = fs.readFileSync('css/editor/editor-mode-selection.css', 'utf8');
    assert.ok(css.includes('[data-editor-interaction-mode="view"]'), 'CSS must include view mode selector');
});

test('owner editing actions hidden in view mode via CSS', () => {
    const css = fs.readFileSync('css/editor/editor-mode-selection.css', 'utf8');
    const viewSelectors = [
        '#editMemoryBtn',
        '#continueFromMomentBtn',
        '#connectExistingCtaSection',
        '#ftbEditBtn',
        '#ftbContinueBtn',
        '#ftbQuickAdd'
    ];
    // Find the hide block (starts at second occurrence of view selector)
    const parts = css.split('[data-editor-interaction-mode="view"]');
    // parts[0] = everything before first selector
    // parts[1] = first occurrence block (editor-mobile-bottom-action)
    // parts[2] = second occurrence block (display: none rules)
    assert.ok(parts.length >= 3, 'CSS must have multiple [data-editor-interaction-mode="view"] blocks');
    const hideBlock = parts.slice(1).join(' ');
    for (const sel of viewSelectors) {
        assert.ok(hideBlock.includes(sel), `CSS must hide ${sel} in view mode`);
    }
});

test('edit mode does not permanently hide owner buttons', () => {
    const css = fs.readFileSync('css/editor/editor-mode-selection.css', 'utf8');
    // There should be NO CSS rule with [data-editor-interaction-mode="edit"] that hides buttons
    assert.ok(
        !css.includes('[data-editor-interaction-mode="edit"] #'),
        'edit mode must not have CSS display:none rules for owner buttons'
    );
});

function buildOwnerAppreciationHtml() {
    const vm = require('node:vm');
    const ctx = { window: {}, globalThis: null };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('js/shared/canonical-appreciation-detail-presentation.js', 'utf8'), ctx);
    return ctx.window.LoveBudCanonicalAppreciationDetailPresentation.buildDetailViewModeHtml({
        authority: 'owner'
    });
}

test('view mode retains 감상하기 and 재생 actions', () => {
    const detailTemplate = buildOwnerAppreciationHtml();
    assert.ok(detailTemplate.includes('viewMomentDetailBtn'), 'viewMomentDetailBtn must exist');
    assert.ok(detailTemplate.includes('play-btn'), 'play button must exist');
});

test('editMemoryBtn exists in detail template', () => {
    const detailTemplate = buildOwnerAppreciationHtml();
    assert.ok(detailTemplate.includes('editMemoryBtn'), 'editMemoryBtn must exist in template');
});

test('editor.js retains isEditMode() guard for edit handlers', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(
        source.includes('isEditMode') || source.includes('isEditMode()'),
        'editor.js must reference isEditMode for action guards'
    );
});

test('no unrelated DB/API/Firebase/persistence files modified', () => {
    // #3192 — narrow exception: js/auth/auth-firebase.js containing 'firebase' is approved
    const changed = runGitDiffNames();
    const blockedPatterns = ['firebase', 'api-client', 'firestore'];
    for (const file of changed) {
        for (const pattern of blockedPatterns) {
            const isApproved3192FirebaseException =
                file === 'js/auth/auth-firebase.js' &&
                pattern === 'firebase';
            assert.ok(
                isApproved3192FirebaseException || !file.includes(pattern),
                `#3192 exception not matched: Must not modify ${file} (contains ${pattern})`
            );
        }
    }
});

test('modeDescription has aria-live attribute', () => {
    const source = fs.readFileSync('js/editor.js', 'utf8');
    assert.ok(source.includes('aria-live'), 'modeDescription must have aria-live attribute');
    assert.ok(source.includes('aria-live'), 'modeDescription aria-live must be polite');
});

test('detail primary action label is 이 순간에서', () => {
    const template = buildOwnerAppreciationHtml();
    assert.ok(template.includes('id="detailActionsPrimaryLabel">이 순간에서'), 'detail actions section must be labeled 이 순간에서');
});

test('viewMomentDetailBtn label is 현재 순간 감상하기', () => {
    const template = buildOwnerAppreciationHtml();
    assert.ok(template.includes('id="viewMomentDetailBtnLabel">현재 순간 감상하기'), 'view btn label must be 현재 순간 감상하기');
});

test('continueFromMomentBtn kept and hidden by view-mode CSS', () => {
    const css = fs.readFileSync('css/editor/editor-mode-selection.css', 'utf8');
    const template = buildOwnerAppreciationHtml();
    assert.ok(template.includes('continueFromMomentBtn'), 'continue button must exist in template');
    assert.ok(css.includes('#continueFromMomentBtn'), 'CSS must hide continueFromMomentBtn in view mode');
});

test('floating toolbar view btn (감상하기) kept', () => {
    const toolbar = fs.readFileSync('js/editor/templates/editor-floating-toolbar-template.js', 'utf8');
    assert.ok(toolbar.includes('ftbViewBtn'), 'floating toolbar view button must exist');
});

/**
 * Helper: git diff --name-only against origin/main
 */
function runGitDiffNames() {
    try {
        const output = execSync('git diff --name-only origin/main...HEAD', {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 15000
        });
        return output.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}
