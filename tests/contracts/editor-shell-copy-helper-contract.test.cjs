const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellStartupSource = fs.readFileSync('js/editor/editor-shell-startup.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const editorHtmlSource = fs.readFileSync('pages/editor.html', 'utf8');

function getApplyEditorShellCopyBlock() {
  const start = shellStartupSource.indexOf('applyEditorShellCopy: function(safeI18nText, i18n)');
  assert.notEqual(start, -1, 'applyEditorShellCopy helper must exist');

  const end = shellStartupSource.indexOf('markEditorReady:', start);
  assert.notEqual(end, -1, 'applyEditorShellCopy block must end before markEditorReady');

  return shellStartupSource.slice(start, end);
}

test('editor shell startup sub-module exposes applyEditorShellCopy helper', () => {
  assert.match(shellStartupSource, /applyEditorShellCopy:\s*function\(safeI18nText,\s*i18n\)/);
});

test('applyEditorShellCopy preserves setText and setPlaceholder helper patterns', () => {
  const block = getApplyEditorShellCopyBlock();

  assert.match(block, /const setText\s*=\s*\(id,\s*key,\s*fallback\)\s*=>/);
  assert.match(block, /const el\s*=\s*document\.getElementById\(id\)/);
  assert.match(block, /if \(!el\) return/);
  assert.match(block, /el\.textContent\s*=\s*safeI18nText\(i18n,\s*key,\s*fallback\)/);

  assert.match(block, /const setPlaceholder\s*=\s*\(id,\s*key,\s*fallback\)\s*=>/);
  assert.match(block, /el\.setAttribute\('placeholder',\s*safeI18nText\(i18n,\s*key,\s*fallback\)\)/);
});

test('applyEditorShellCopy preserves sidebar and canvas shell copy targets', () => {
  const block = getApplyEditorShellCopyBlock();

  const requiredTargets = [
    ['backToMyTreesLabel', 'editor_back_to_my_trees', '내 러브트리로 돌아가기'],
    ['editorFlowHeading', 'sidebar_flow_heading', '트리 정보'],
    ['editorFlowLead', 'sidebar_flow_lead', '첫 순간부터 지금까지 이어진 마음을 확인하고 있어요.'],
    ['recenterCanvasBtnLabel', 'sidebar_recenter_tree', '트리 한눈에 보기'],
    ['canvasEmptyGuideEyebrow', 'editor_canvas_empty_eyebrow', '시작하기'],
    ['canvasEmptyGuideTitle', 'editor_canvas_empty_title', '이 트리의 첫 순간을 기록해볼까요?'],
    ['canvasEmptyYoutubeLabel', 'editor_youtube_link', 'YouTube 링크'],
    ['canvasEmptyStartBtn', 'editor_add_first_memory', '첫 순간 심기'],
    ['canvasEmptyTextStartBtn', 'editor_canvas_empty_text_start', '텍스트로 시작하기'],
    ['canvasEmptyGuideHint', 'editor_canvas_empty_hint', '캔버스를 두 번 클릭해도 새 순간을 시작할 수 있어요.']
  ];

  for (const [id, key, fallback] of requiredTargets) {
    assert.ok(block.includes(id), `missing DOM id: ${id}`);
    assert.ok(block.includes(key), `missing i18n key: ${key}`);
    assert.ok(block.includes(fallback), `missing fallback copy: ${fallback}`);
  }
});

test('applyEditorShellCopy preserves memory form and edit form copy targets', () => {
  const block = getApplyEditorShellCopyBlock();

  const requiredTargets = [
    ['addMemoryFormEyebrow', 'editor_add_first_memory', '첫 순간 심기'],
    ['addMemoryFormTitle', 'editor_new_memory', '어떤 순간이 이어졌나요?'],
    ['memoryUrlLabel', 'editor_youtube_link', 'YouTube 장면 링크'],
    ['memoryTitleLabel', 'editor_memory_title', '순간 제목'],
    ['memoryMemoLabel', 'editor_memory_memo_optional', '감정 메모'],
    ['cancelAddMemory', 'editor_cancel', '취소'],
    ['confirmAddMemory', 'editor_confirm_add', '이 순간 심기'],
    ['editTitleLabel', 'editor_memory_title', '제목'],
    ['editMemoLabel', 'editor_note_label', '감정 메모'],
    ['editTagsLabel', 'editor_edit_tag_label', '감정 태그 (쉼표로 구분)'],
    ['cancelEditBtn', 'editor_cancel', '취소'],
    ['saveEditBtn', 'editor_save', '저장하기']
  ];

  for (const [id, key, fallback] of requiredTargets) {
    assert.ok(block.includes(id), `missing DOM id: ${id}`);
    assert.ok(block.includes(key), `missing i18n key: ${key}`);
    assert.ok(block.includes(fallback), `missing fallback copy: ${fallback}`);
  }
});

test('applyEditorShellCopy preserves placeholder targets', () => {
  const block = getApplyEditorShellCopyBlock();

  const requiredPlaceholders = [
    ['canvasEmptyYoutubeInput', 'editor_canvas_empty_youtube_placeholder', 'YouTube 링크를 붙여넣어 첫 순간 심기'],
    ['memoryTitleInput', 'editor_memory_title_placeholder', '이 순간을 어떻게 기억하고 싶은지 적어보세요'],
    ['memoryMemoInput', 'editor_memory_memo_placeholder', '왜 이 장면이 이어졌는지, 지금 마음을 남겨보세요...'],
    ['editTitleInput', 'editor_edit_title_placeholder', '순간의 제목을 입력하세요'],
    ['editMemoInput', 'editor_memory_memo_placeholder', '이 순간의 감정을 남겨보세요...'],
    ['editTagsInput', 'editor_edit_tag_placeholder', '#감동, #행복, #그리움']
  ];

  for (const [id, key, fallback] of requiredPlaceholders) {
    const pattern = new RegExp(`setPlaceholder\\('${id}',\\s*'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',`);
    assert.match(block, pattern);
    assert.ok(block.includes(fallback), `missing placeholder fallback copy: ${fallback}`);
  }
});

test('applyEditorShellCopy preserves detail panel copy targets', () => {
  const block = getApplyEditorShellCopyBlock();

  const requiredTargets = [
    ['detailEmptyTitle', 'detail_empty_title', '첫 순간이 트리를 깨워요'],
    ['detailEmptyDesc', 'detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.'],
    ['detailCurrentMomentBadge', 'editor_current_moment_badge', '현재 순간'],
    ['detailCurrentMomentTitle', 'editor_current_moment_title', '지금 마음이 머문 장면'],
    ['detailCurrentMomentHint', 'editor_current_moment_hint', '선택한 순간을 중심으로 감정 메모와 다음 행동이 정리됩니다.'],
    ['detailMomentInfoLabel', 'editor_moment_info_label', '순간 정보'],
    ['detailTreeStatusLabel', 'current_tree', '현재 트리'],
    ['detailDateLabel', 'editor_date_label', '기억한 날'],
    ['detailTagsLabel', 'editor_tag_label', '감정 태그'],
    ['detailMemoLabel', 'editor_note_label', '감정 메모'],
    ['editMemoryBtn', 'editor_edit', '순간 수정'],
    ['viewMomentDetailBtnLabel', 'editor_view_moment_detail', '현재 순간 감상하기'],
    ['continueFromMomentBtnLabel', 'editor_continue_from_moment', '이 순간에서 이어가기'],
    ['detailActionsPrimaryLabel', 'editor_actions_primary', '이 순간에서'],
    ['deleteMemoryBtn', 'editor_delete', '순간 삭제']
  ];

  for (const [id, key, fallback] of requiredTargets) {
    assert.ok(block.includes(id), `missing DOM id: ${id}`);
    assert.ok(block.includes(key), `missing i18n key: ${key}`);
    assert.ok(block.includes(fallback), `missing fallback copy: ${fallback}`);
  }
});

test('editor entrypoint invokes applyEditorShellCopy with safe i18n helpers via deps', () => {
  assert.match(editorSource, /deps\.applyEditorShellCopy/);
  assert.match(editorSource, /applyEditorShellCopy\(deps\.safeI18nText,\s*deps\.i18n\)/);
});

test('editor html loads shell helpers before editor entrypoint', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
