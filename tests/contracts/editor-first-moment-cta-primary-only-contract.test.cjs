/**
 * editor-first-moment-cta-primary-only-contract.test.cjs
 *
 * PR #2449 (UX): 빈 가이드 CTA 단순화 lock
 *
 * Source-level contract:
 * - editor-empty-guide-template.js: video/text/YouTube 직접 입력이 보이지 않음,
 *   primary 1개 (#canvasEmptyStartBtn, "첫 순간 만들기")만 보임
 * - editor-empty-guide-ui.js: primary CTA click이 showAddMemoryForm() 호출,
 *   video/text/quick input binding은 더 이상 없음
 * - createMemoryFromQuickYoutube / fetchYoutubeTitle / isYoutubeUrl 정의는
 *   export 호환을 위해 source에 유지 (legacy callers / contract tests)
 *
 * editor-canvas.js는 본 contract 범위 밖 (수정 금지)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TEMPLATE_PATH = 'js/editor/templates/editor-empty-guide-template.js';
const UI_PATH = 'js/editor/editor-empty-guide-ui.js';

test('PR #2449 template: primary CTA only — video/text/quick input are not present in first visible card', () => {
    const source = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // primary CTA는 존재
    assert.match(source, /id=["']canvasEmptyStartBtn["']/,
        'PR #2449: primary start button id must be present');
    assert.match(source, /첫 순간 만들기/,
        'PR #2449: primary CTA copy "첫 순간 만들기" must be present');

    // direct crowded controls는 모두 제거됨
    assert.doesNotMatch(source, /id=["']canvasEmptyVideoBtn["']/,
        'PR #2449: direct video start button must be removed from first visible card');
    assert.doesNotMatch(source, /id=["']canvasEmptyTextBtn["']/,
        'PR #2449: direct text start button must be removed');
    assert.doesNotMatch(source, /id=["']canvasEmptyQuickInput["']/,
        'PR #2449: direct YouTube quick input must be removed');
    assert.doesNotMatch(source, /YouTube 링크 붙여넣기/,
        'PR #2449: YouTube paste placeholder must be removed from first visible card');
});

test('PR #2449 template: title and description reflect "next step selection" copy', () => {
    const source = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    assert.match(source, /이 트리의 첫 순간을 기록해볼까요\?/,
        'PR #2449: title copy is preserved');
    assert.match(source, /영상 링크나 텍스트는 다음 단계에서 선택할 수 있어요\./,
        'PR #2449: description copy is updated to "next step selection"');
});

test('PR #2449 UI: primary CTA binding calls showAddMemoryForm', () => {
    const source = fs.readFileSync(UI_PATH, 'utf8');

    // primary button click binding이 showAddMemoryForm을 호출하는지
    assert.match(source, /canvasEmptyStartBtn[\s\S]{0,200}showAddMemoryForm/,
        'PR #2449: primary CTA binding must call showAddMemoryForm');
});

test('PR #2449 UI: video/text/quick input bindings are removed from bindEmptyGuideEvents', () => {
    const source = fs.readFileSync(UI_PATH, 'utf8');

    // video/text/quick input element 참조가 bindEmptyGuideEvents에서 사라졌는지
    // (단, 함수 정의(createMemoryFromQuickYoutube, isYoutubeUrl, fetchYoutubeTitle)는
    // export 호환을 위해 source에 유지)
    assert.doesNotMatch(
        source,
        /document\.getElementById\(['"]canvasEmptyVideoBtn['"]\)/,
        'PR #2449: canvasEmptyVideoBtn lookup must be removed from UI bindings'
    );
    assert.doesNotMatch(
        source,
        /document\.getElementById\(['"]canvasEmptyTextBtn['"]\)/,
        'PR #2449: canvasEmptyTextBtn lookup must be removed from UI bindings'
    );
    assert.doesNotMatch(
        source,
        /document\.getElementById\(['"]canvasEmptyQuickInput['"]\)/,
        'PR #2449: canvasEmptyQuickInput lookup must be removed from UI bindings'
    );
});

test('PR #2449 UI: legacy quick youtube helpers retained in source for export/back-compat', () => {
    const source = fs.readFileSync(UI_PATH, 'utf8');

    // 함수 정의는 export 호환 / legacy callers / contract test 호환을 위해 유지
    assert.match(source, /function\s+isYoutubeUrl/,
        'PR #2449: isYoutubeUrl helper retained for export');
    assert.match(source, /async\s+function\s+fetchYoutubeTitle/,
        'PR #2449: fetchYoutubeTitle helper retained for export');
    assert.match(source, /async\s+function\s+createMemoryFromQuickYoutube/,
        'PR #2449: createMemoryFromQuickYoutube helper retained for export');
});
