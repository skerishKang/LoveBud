const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PREVIEW_PATH = path.join(ROOT, 'js/editor/editor-memory-form-preview.js');
const previewSource = fs.readFileSync(PREVIEW_PATH, 'utf8');

function makeElement() {
  return {
    textContent: '',
    src: '',
    style: {},
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); }
    },
    querySelector() { return null; }
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
});

test('source record preview uses source framing and does not require a video thumbnail', () => {
  const preview = loadPreview();
  const refs = {
    preview: makeElement(),
    thumbWrap: makeElement(),
    thumb: makeElement(),
    playIcon: makeElement(),
    badge: makeElement(),
    previewTitle: makeElement(),
    previewHint: makeElement(),
    startTimeHint: makeElement()
  };

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
});

test('channel/profile URL update path renders source record preview without video id', () => {
  const preview = loadPreview();
  const refs = {
    urlInput: { value: 'https://www.youtube.com/@SomeChannel' },
    preview: makeElement(),
    thumbWrap: makeElement(),
    thumb: makeElement(),
    playIcon: makeElement(),
    badge: makeElement(),
    previewTitle: makeElement(),
    previewHint: makeElement(),
    startTimeHint: makeElement()
  };

  global.window = undefined;
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
});

test('video URL path remains video preview path and clears source record identity', () => {
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

  const refs = {
    urlInput: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    preview: makeElement(),
    thumbWrap: makeElement(),
    thumb: makeElement(),
    playIcon: makeElement(),
    badge: makeElement(),
    previewTitle: makeElement(),
    previewHint: makeElement(),
    startTimeHint: makeElement()
  };
  refs.preview.classList.add('is-source-record-preview');

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
});

test('preview source remains frontend-only and non-persistent', () => {
  assert.match(previewSource, /createYouTubeChannelSourceRecord/);
  assert.match(previewSource, /is-source-record-preview/);
  assert.doesNotMatch(previewSource, /\.memory-node/);
  assert.doesNotMatch(previewSource, /apiClient/);
  assert.doesNotMatch(previewSource, /createMemory\s*\(/);
  assert.doesNotMatch(previewSource, /fetch\s*\(/);
  assert.doesNotMatch(previewSource, /getYouTubeOEmbedChannel/);
});
