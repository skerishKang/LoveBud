const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PREVIEW_PATH = path.join(ROOT, 'js/editor/editor-memory-form-preview.js');
const previewSource = fs.readFileSync(PREVIEW_PATH, 'utf8');

function makeClassList() {
  return {
    values: new Set(),
    add(value) { this.values.add(value); },
    remove(value) { this.values.delete(value); },
    contains(value) { return this.values.has(value); }
  };
}

function makeElement() {
  return {
    textContent: '',
    src: '',
    disabled: false,
    dataset: {},
    style: {},
    attributes: {},
    classList: makeClassList(),
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    querySelector() { return null; }
  };
}

function makeRefs(url = '') {
  return {
    urlInput: { value: url },
    preview: makeElement(),
    thumbWrap: makeElement(),
    thumb: makeElement(),
    playIcon: makeElement(),
    badge: makeElement(),
    previewTitle: makeElement(),
    previewHint: makeElement(),
    startTimeHint: makeElement(),
    confirmBtn: makeElement()
  };
}

function loadPreview() {
  const sandbox = {
    window: {},
    document: {
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'editor-memory-form-preview.js' });
  return sandbox.window.LoveBudEditorMemoryFormPreview;
}

test('memory form preview exposes source record preview helpers', () => {
  const preview = loadPreview();

  assert.equal(typeof preview.resolveSourceRecordPreviewTitle, 'function');
  assert.equal(typeof preview.buildSourceRecordPreviewHint, 'function');
  assert.equal(typeof preview.updateSourceRecordPreview, 'function');
  assert.equal(typeof preview.setPreviewConfirmState, 'function');
  assert.equal(typeof preview.restoreStartTimeHint, 'function');
});

test('source record preview uses source framing and disables normal moment submit', () => {
  const preview = loadPreview();
  const refs = makeRefs();
  refs.confirmBtn.textContent = '첫 순간 심기';

  preview.updateSourceRecordPreview(refs, {
    sourceType: 'channel',
    provider: 'youtube',
    source: 'YouTube',
    sourceHandle: '@SomeChannel',
    sourceTitle: '@SomeChannel',
    sourceUrl: 'https://www.youtube.com/@SomeChannel'
  });

  assert.equal(refs.preview.classList.contains('is-hidden'), false);
  assert.equal(refs.preview.classList.contains('is-source-record-preview'), true);
  assert.equal(refs.thumbWrap.style.display, 'none');
  assert.equal(refs.thumb.style.display, 'none');
  assert.equal(refs.playIcon.style.display, 'none');
  assert.equal(refs.badge.textContent, '순간의 출처');
  assert.equal(refs.previewTitle.textContent, '@SomeChannel');
  assert.equal(refs.previewHint.textContent, 'YouTube 채널 · 아직 심은 순간이 없어요');
  assert.equal(refs.startTimeHint.textContent, '채널은 영상 순간의 출처로만 미리 볼 수 있어요.');
  assert.equal(refs.confirmBtn.disabled, true);
  assert.equal(refs.confirmBtn.getAttribute('aria-disabled'), 'true');
  assert.equal(refs.confirmBtn.textContent, '출처 미리보기 중');
  assert.equal(refs.confirmBtn.dataset.sourcePreviewPreviousText, '첫 순간 심기');
});

test('hide restores source preview button state and start time helper text', () => {
  const preview = loadPreview();
  const refs = makeRefs();
  refs.confirmBtn.textContent = '이 순간 이어가기';

  preview.updateSourceRecordPreview(refs, {
    sourceType: 'channel',
    provider: 'youtube',
    sourceHandle: '@SomeChannel'
  });
  preview.hide(refs);

  assert.equal(refs.preview.classList.contains('is-hidden'), true);
  assert.equal(refs.preview.classList.contains('is-source-record-preview'), false);
  assert.equal(refs.confirmBtn.disabled, false);
  assert.equal(refs.confirmBtn.getAttribute('aria-disabled'), undefined);
  assert.equal(refs.confirmBtn.textContent, '이 순간 이어가기');
  assert.equal(refs.confirmBtn.dataset.sourcePreviewPreviousText, undefined);
  assert.equal(refs.startTimeHint.textContent, '순간의 시작과 끝 시간을 입력하세요.');
});

test('channel/profile URL update path renders non-persistent source preview without video id', () => {
  const refs = makeRefs('https://www.youtube.com/@SomeChannel');
  refs.confirmBtn.textContent = '첫 순간 심기';

  const sandbox = {
    window: {
      LoveBudMedia: {
        extractYouTubeId() { return null; },
        createYouTubeChannelSourceRecord(url) {
          assert.equal(url, 'https://www.youtube.com/@SomeChannel');
          return {
            sourceType: 'channel',
            provider: 'youtube',
            source: 'YouTube',
            sourceHandle: '@SomeChannel',
            sourceTitle: '@SomeChannel',
            sourceUrl: url
          };
        }
      },
      LoveBudEditorMemoryFormTime: {}
    },
    document: {
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'editor-memory-form-preview.js' });

  sandbox.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs,
    userHasEditedStartTime: false
  });

  assert.equal(refs.preview.classList.contains('is-source-record-preview'), true);
  assert.equal(refs.badge.textContent, '순간의 출처');
  assert.equal(refs.previewTitle.textContent, '@SomeChannel');
  assert.equal(refs.confirmBtn.disabled, true);
  assert.equal(refs.confirmBtn.textContent, '출처 미리보기 중');
});

test('invalid non-channel URL after source preview restores button and helper text', () => {
  const preview = loadPreview();
  const refs = makeRefs('https://www.youtube.com/@SomeChannel');
  refs.confirmBtn.textContent = '첫 순간 심기';

  preview.updateSourceRecordPreview(refs, {
    sourceType: 'channel',
    provider: 'youtube',
    sourceHandle: '@SomeChannel'
  });

  refs.urlInput.value = 'https://example.com/not-youtube';
  const sandbox = {
    window: {
      LoveBudMedia: {
        extractYouTubeId() { return null; },
        createYouTubeChannelSourceRecord() { return null; }
      },
      LoveBudEditorMemoryFormTime: {}
    },
    document: {
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'editor-memory-form-preview.js' });

  sandbox.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs,
    userHasEditedStartTime: false
  });

  assert.equal(refs.preview.classList.contains('is-hidden'), true);
  assert.equal(refs.preview.classList.contains('is-source-record-preview'), false);
  assert.equal(refs.confirmBtn.disabled, false);
  assert.equal(refs.confirmBtn.textContent, '첫 순간 심기');
  assert.equal(refs.startTimeHint.textContent, '순간의 시작과 끝 시간을 입력하세요.');
});

test('video URL path remains video preview path and restores source preview action state', () => {
  const sandbox = {
    window: {
      LoveBudMedia: {
        extractYouTubeId() { return 'dQw4w9WgXcQ'; },
        getThumbnailUrl() { return 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'; },
        extractYouTubeChannelInfo() { return null; }
      },
      LoveBudEditorMemoryFormTime: {}
    },
    document: {
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'editor-memory-form-preview.js' });

  const refs = makeRefs('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  refs.confirmBtn.textContent = '출처 미리보기 중';
  refs.confirmBtn.dataset.sourcePreviewPreviousText = '첫 순간 심기';
  refs.confirmBtn.disabled = true;
  refs.confirmBtn.setAttribute('aria-disabled', 'true');
  refs.preview.classList.add('is-source-record-preview');
  refs.startTimeHint.textContent = '채널은 영상 순간의 출처로만 미리 볼 수 있어요.';

  sandbox.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'link',
    refs,
    userHasEditedStartTime: false
  });

  assert.equal(refs.preview.classList.contains('is-source-record-preview'), false);
  assert.equal(refs.thumbWrap.style.display, 'block');
  assert.equal(refs.thumb.style.display, 'block');
  assert.equal(refs.playIcon.style.display, 'block');
  assert.equal(refs.previewTitle.textContent, '영상 링크 확인됨');
  assert.equal(refs.thumb.src, 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  assert.equal(refs.confirmBtn.disabled, false);
  assert.equal(refs.confirmBtn.getAttribute('aria-disabled'), undefined);
  assert.equal(refs.confirmBtn.textContent, '첫 순간 심기');
  assert.equal(refs.startTimeHint.textContent, '순간의 시작과 끝 시간을 입력하세요.');
});

test('non-link mode hides preview and restores action state', () => {
  const sandbox = {
    window: {
      LoveBudMedia: {},
      LoveBudEditorMemoryFormTime: {}
    },
    document: {
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'editor-memory-form-preview.js' });

  const refs = makeRefs('https://www.youtube.com/@SomeChannel');
  refs.confirmBtn.textContent = '출처 미리보기 중';
  refs.confirmBtn.dataset.sourcePreviewPreviousText = '이 마음으로 시작하기';
  refs.confirmBtn.disabled = true;
  refs.confirmBtn.setAttribute('aria-disabled', 'true');
  refs.preview.classList.add('is-source-record-preview');
  refs.startTimeHint.textContent = '채널은 영상 순간의 출처로만 미리 볼 수 있어요.';

  sandbox.window.LoveBudEditorMemoryFormPreview.update({
    currentInputMode: 'text',
    refs,
    userHasEditedStartTime: false
  });

  assert.equal(refs.preview.classList.contains('is-hidden'), true);
  assert.equal(refs.preview.classList.contains('is-source-record-preview'), false);
  assert.equal(refs.confirmBtn.disabled, false);
  assert.equal(refs.confirmBtn.textContent, '이 마음으로 시작하기');
  assert.equal(refs.startTimeHint.textContent, '순간의 시작과 끝 시간을 입력하세요.');
});

test('preview source remains frontend-only and non-persistent', () => {
  assert.match(previewSource, /createYouTubeChannelSourceRecord/);
  assert.match(previewSource, /is-source-record-preview/);
  assert.match(previewSource, /출처 미리보기 중/);
  assert.doesNotMatch(previewSource, /\.memory-node/);
  assert.doesNotMatch(previewSource, /apiClient/);
  assert.doesNotMatch(previewSource, /createMemory\s*\(/);
  assert.doesNotMatch(previewSource, /fetch\s*\(/);
  assert.doesNotMatch(previewSource, /getYouTubeOEmbedChannel/);
});
