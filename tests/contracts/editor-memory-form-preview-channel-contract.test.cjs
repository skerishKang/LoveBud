const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createPreviewContext({ url, formatted = '' } = {}) {
  const previewClassList = new Set(['is-hidden']);
  const preview = {
    classList: {
      add: (name) => previewClassList.add(name),
      remove: (name) => previewClassList.delete(name),
      contains: (name) => previewClassList.has(name)
    },
    style: {},
    querySelector: () => null
  };

  const refs = {
    preview,
    urlInput: { value: url || '' },
    startTimeInput: { value: '' },
    previewHint: { textContent: '', style: {} },
    previewTitle: { textContent: '', style: {} },
    badge: { style: {} },
    thumb: { src: '', style: {} },
    thumbWrap: { style: {} },
    playIcon: { style: {} },
    previewBody: { style: {} },
    startTimeHint: { textContent: '' }
  };

  const context = {
    URL,
    window: {
      LoveBudEditorMemoryFormTime: {
        resolveStartSeconds: () => formatted ? 83 : null,
        formatStartTime: () => formatted
      }
    },
    document: {
      getElementById: () => preview
    }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-preview.js'), 'utf8'), context);

  return {
    context,
    refs,
    previewClassList
  };
}

test('memory form preview shows URL-visible YouTube handle channel label', () => {
  const harness = createPreviewContext({
    url: 'https://www.youtube.com/@woowayoung/shorts/dQw4w9WgXcQ'
  });

  harness.context.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs: harness.refs,
    userHasEditedStartTime: false
  });

  assert.equal(harness.refs.preview.classList.contains('is-hidden'), false);
  assert.equal(harness.refs.previewHint.textContent, 'from @woowayoung · 제목과 메모를 다듬어 주세요.');
  assert.equal(harness.refs.thumb.src, 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
});

test('memory form preview does not invent channel label for standard watch URL', () => {
  const harness = createPreviewContext({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  });

  harness.context.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs: harness.refs,
    userHasEditedStartTime: false
  });

  assert.equal(harness.refs.preview.classList.contains('is-hidden'), false);
  assert.equal(harness.refs.previewHint.textContent, '제목과 메모를 다듬어 주세요.');
});

test('memory form preview combines channel label with start time hint', () => {
  const harness = createPreviewContext({
    url: 'https://www.youtube.com/@woowayoung/shorts/dQw4w9WgXcQ?t=83',
    formatted: '1:23'
  });

  harness.context.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs: harness.refs,
    userHasEditedStartTime: false
  });

  assert.equal(harness.refs.previewHint.textContent, 'from @woowayoung · 1:23부터 재생돼요. 제목과 메모를 다듬어 주세요.');
});

test('memory form preview hides and clears no channel-specific row in text mode', () => {
  const harness = createPreviewContext({
    url: 'https://www.youtube.com/@woowayoung/shorts/dQw4w9WgXcQ'
  });

  harness.context.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'text',
    refs: harness.refs,
    userHasEditedStartTime: false
  });

  assert.equal(harness.refs.preview.classList.contains('is-hidden'), true);
});
