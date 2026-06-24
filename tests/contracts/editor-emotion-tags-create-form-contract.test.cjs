const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-add-memory-form-template.js');
const PAYLOAD_PATH = path.join(ROOT, 'js/editor/editor-memory-form-payload.js');
const EDIT_TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-detail-edit-mode-template.js');
const I18N_PATH = path.join(ROOT, 'js/i18n/i18n-editor.js');
const SHELL_COPY_PATH = path.join(ROOT, 'js/editor/editor-shell-copy-applier.js');
const EDIT_ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');

const templateSource = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const payloadSource = fs.readFileSync(PAYLOAD_PATH, 'utf8');
const editTemplateSource = fs.readFileSync(EDIT_TEMPLATE_PATH, 'utf8');
const i18nSource = fs.readFileSync(I18N_PATH, 'utf8');
const shellCopySource = fs.readFileSync(SHELL_COPY_PATH, 'utf8');
const editActionsSource = fs.readFileSync(EDIT_ACTIONS_PATH, 'utf8');

function loadPayloadModule() {
  const sandbox = {
    window: {
      LoveBudEditorUtils: { getCanonicalRootId: () => 'root-1' },
      LoveBudMedia: { extractYouTubeId: () => null, getEmbedUrl: () => '', getThumbnailUrl: () => '' },
      LoveBudEditorMemoryFormTime: {}
    }
  };
  vm.runInNewContext(payloadSource, sandbox, { filename: 'editor-memory-form-payload.js' });
  return sandbox.window.LoveBudEditorMemoryFormPayload;
}

function makeTextRefs({ title = 'test', tags = '', memo = 'note', url = '' } = {}) {
  return {
    urlInput: { value: url },
    titleInput: { value: title },
    tagsInput: { value: tags },
    memoInput: { value: memo },
    startTimeInput: { value: '' },
    endTimeInput: { value: '' }
  };
}

function buildCreatePayload(payloadModule, refs) {
  return payloadModule.buildMemoryPayload({
    refs,
    currentInputMode: 'text',
    userHasEditedStartTime: false,
    i18n: () => '',
    treeId: 'tree-1',
    getYouTubeInputErrorMessage: () => '',
    getTreeMemories: () => [],
    resolveParentIdForCreate: () => 'root-1',
    getSelectedNodeId: () => null,
    getCanonicalRootId: () => 'root-1'
  });
}

test('create form template exposes emotion memo label and emotion tags input', () => {
  assert.ok(templateSource.includes('id="memoryMemoLabel"'), 'memoryMemoLabel must exist in create form template');
  assert.ok(templateSource.includes('id="memoryMemoInput"'), 'memoryMemoInput must exist in create form template');
  assert.ok(templateSource.includes('id="memoryTagsLabel"'), 'memoryTagsLabel must exist in create form template');
  assert.ok(templateSource.includes('id="memoryTagsInput"'), 'memoryTagsInput must exist in create form template');
});

test('create UI does not retain 메모 한 줄 as the memo label', () => {
  const i18nMatch = i18nSource.match(/editor_memory_memo_optional:\s*\{[^}]*ko:\s*'([^']+)'/);
  assert.ok(i18nMatch, 'i18n-editor.js must define editor_memory_memo_optional');
  assert.notEqual(i18nMatch[1], '메모 한 줄', 'editor_memory_memo_optional ko value must not be "메모 한 줄"');

  const shellCopyMatch = shellCopySource.match(
    /\[\s*'memoryMemoLabel'\s*,\s*'editor_memory_memo_optional'\s*,\s*'([^']+)'\s*\]/
  );
  assert.ok(shellCopyMatch, 'editor-shell-copy-applier.js must bind memoryMemoLabel with editor_memory_memo_optional');
  assert.notEqual(shellCopyMatch[1], '메모 한 줄', 'memoryMemoLabel fallback must not be "메모 한 줄"');
});

test('create payload reuses existing emotion/tag field keys and normalizes tags like edit flow', () => {
  assert.ok(payloadSource.includes('emotionTags'), 'payload must use existing emotionTags key');
  assert.ok(payloadSource.includes('refs.tagsInput'), 'payload must read from existing tagsInput ref');
  assert.ok(
    payloadSource.includes("split(',').map(t => t.trim()).filter(t => t)"),
    'create payload must use split/trim/filter normalization'
  );
});

test('comma-separated tag is trimmed and empty entries are removed', () => {
  const payloadModule = loadPayloadModule();
  const result = buildCreatePayload(payloadModule, makeTextRefs({ tags: '설렘, 고마움, ,  ,그리움' }));
  assert.ok(result.ok, 'payload must be valid');
  assert.equal(JSON.stringify(result.data.emotionTags), JSON.stringify(['설렘', '고마움', '그리움']), 'tags must be trimmed and empty entries removed');
});

test('empty tag input yields empty array or equivalent safe default', () => {
  const payloadModule = loadPayloadModule();
  const result = buildCreatePayload(payloadModule, makeTextRefs({ tags: '' }));
  assert.ok(result.ok, 'payload must be valid with empty tags');
  assert.ok(Array.isArray(result.data.emotionTags), 'emotionTags must be an array');
  assert.equal(result.data.emotionTags.length, 0, 'empty tags input must produce empty array');
});

test('create flow does not introduce new persistence or network behavior', () => {
  assert.doesNotMatch(payloadSource, /apiClient/);
  assert.doesNotMatch(payloadSource, /fetch\s*\(/);
  assert.doesNotMatch(payloadSource, /localStorage/);
  assert.doesNotMatch(payloadSource, /Firebase/);
  assert.doesNotMatch(payloadSource, /indexedDB/);
});

test('create flow does not reference Browse/My Trees/Scout', () => {
  assert.doesNotMatch(payloadSource, /browse/i);
  assert.doesNotMatch(payloadSource, /my-trees/i);
  assert.doesNotMatch(payloadSource, /scout/i);
});

test('edit form label and create form label both resolve to 감정 메모', () => {
  assert.ok(editTemplateSource.includes('id="editMemoLabel"'), 'edit form must have editMemoLabel');
  assert.ok(editTemplateSource.includes('id="editTagsInput"'), 'edit form must have editTagsInput');

  const shellMatch = shellCopySource.match(
    /\[\s*'editMemoLabel'\s*,\s*'editor_note_label'\s*,\s*'([^']+)'\s*\]/
  );
  assert.ok(shellMatch, 'editor-shell-copy-applier.js must bind editMemoLabel');
  assert.equal(shellMatch[1], '감정 메모', 'edit form memo label must be "감정 메모"');

  const i18nMatch = i18nSource.match(/editor_note_label:\s*\{[^}]*ko:\s*'([^']+)'/);
  assert.ok(i18nMatch, 'i18n-editor.js must define editor_note_label');
  assert.equal(i18nMatch[1], '감정 메모', 'editor_note_label ko value must be "감정 메모"');

  const createMemoMatch = shellCopySource.match(
    /\[\s*'memoryMemoLabel'\s*,\s*'editor_memory_memo_optional'\s*,\s*'([^']+)'\s*\]/
  );
  assert.ok(createMemoMatch, 'editor-shell-copy-applier.js must bind memoryMemoLabel');
  assert.equal(createMemoMatch[1], '감정 메모', 'create form memo label must be "감정 메모"');
});

test('edit flow tag normalization matches create flow tag normalization', () => {
  assert.ok(
    editActionsSource.includes(".split(',').map((t) => t.trim()).filter((t) => t)"),
    'edit flow must use split/trim/filter normalization'
  );
  assert.ok(
    payloadSource.includes("split(',').map(t => t.trim()).filter(t => t)"),
    'create flow must use split/trim/filter normalization'
  );
});
