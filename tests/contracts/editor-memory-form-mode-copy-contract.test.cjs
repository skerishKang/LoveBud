const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const MODE_PATH = path.join(ROOT, 'js/editor/editor-memory-form-mode.js');
const modeSource = fs.readFileSync(MODE_PATH, 'utf8');

function makeClassList() {
  return {
    values: new Set(),
    toggle(value, force) {
      if (force) this.values.add(value);
      else this.values.delete(value);
    },
    contains(value) { return this.values.has(value); }
  };
}

function makeElement() {
  return {
    textContent: '',
    placeholder: '',
    style: {},
    classList: makeClassList(),
    querySelector() { return null; }
  };
}

function makeModeButton(labelTarget) {
  const element = makeElement();
  element.querySelector = (selector) => selector === 'span:last-child' ? labelTarget : null;
  return element;
}

function loadMode(options = {}) {
  const sandbox = {
    window: {}
  };
  if (options.lang) {
    sandbox.window.getCurrentLang = () => options.lang;
  }
  vm.runInNewContext(modeSource, sandbox, { filename: 'editor-memory-form-mode.js' });
  return sandbox.window.LoveBudEditorMemoryFormMode;
}

function makeRefs() {
  const linkModeLabel = makeElement();
  const textModeLabel = makeElement();
  return {
    linkModeLabel,
    textModeLabel,
    modeLinkBtn: makeModeButton(linkModeLabel),
    modeTextBtn: makeModeButton(textModeLabel),
    urlField: makeElement(),
    startTimeField: makeElement(),
    videoSegmentGrid: makeElement(),
    urlInput: makeElement(),
    urlLabel: makeElement(),
    formIntro: makeElement(),
    supportNoteText: makeElement(),
    confirmBtn: makeElement()
  };
}

test('link mode copy explains video or channel input', () => {
  const mode = loadMode();
  const refs = makeRefs();

  const currentMode = mode.setInputMode({
    mode: 'link',
    isFirstMoment: true,
    refs,
    i18n: () => '',
    hidePreview: () => assert.fail('link mode must not hide preview')
  });

  assert.equal(currentMode, 'link');
  assert.equal(refs.linkModeLabel.textContent, '영상·채널로 시작');
  assert.equal(refs.textModeLabel.textContent, '텍스트로 시작');
  assert.equal(refs.urlInput.placeholder, 'YouTube 영상 또는 채널 링크를 붙여넣으세요');
  assert.equal(refs.urlLabel.textContent, 'YouTube 영상 또는 채널 링크');
  assert.equal(
    refs.supportNoteText.textContent,
    '영상 링크는 순간 미리보기로, 채널 링크는 순간의 출처 미리보기로 확인할 수 있어요. 제목과 메모는 직접 다듬어 주세요.'
  );
  assert.equal(refs.confirmBtn.textContent, '첫 순간 심기');
  assert.equal(refs.videoSegmentGrid.style.display, 'grid');
});

test('link mode copy stays English when new i18n keys are missing', () => {
  const mode = loadMode({ lang: 'en' });
  const refs = makeRefs();
  const missingKeyI18n = (key) => key;

  const currentMode = mode.setInputMode({
    mode: 'link',
    isFirstMoment: false,
    refs,
    i18n: missingKeyI18n,
    hidePreview: () => assert.fail('link mode must not hide preview')
  });

  assert.equal(currentMode, 'link');
  assert.equal(refs.linkModeLabel.textContent, 'Start with video or channel');
  assert.equal(refs.textModeLabel.textContent, 'Start with text');
  assert.equal(refs.urlInput.placeholder, 'Paste a YouTube video or channel link');
  assert.equal(refs.urlLabel.textContent, 'YouTube video or channel link');
  assert.equal(
    refs.supportNoteText.textContent,
    'Video links open a moment preview, while channel links open a source preview. Please refine the title and note yourself.'
  );
  assert.equal(refs.confirmBtn.textContent, 'Continue from this moment');
});

test('link mode copy can still be localized by i18n keys', () => {
  const mode = loadMode();
  const refs = makeRefs();
  const i18n = (key) => ({
    editor_youtube_video_or_channel_link: 'Localized video/channel label',
    editor_link_mode_video_or_channel_help: 'Localized video/channel helper',
    editor_confirm_add_next: 'Localized add next'
  }[key] || '');

  mode.setInputMode({
    mode: 'link',
    isFirstMoment: false,
    refs,
    i18n,
    hidePreview: () => assert.fail('link mode must not hide preview')
  });

  assert.equal(refs.urlLabel.textContent, 'Localized video/channel label');
  assert.equal(refs.supportNoteText.textContent, 'Localized video/channel helper');
  assert.equal(refs.confirmBtn.textContent, 'Localized add next');
});

test('text mode copy and behavior remain unchanged', () => {
  const mode = loadMode();
  const refs = makeRefs();
  let hidePreviewCalled = false;

  const currentMode = mode.setInputMode({
    mode: 'text',
    isFirstMoment: false,
    refs,
    i18n: (key) => ({
      editor_link_optional_placeholder: '링크는 나중에 붙여도 괜찮아요',
      editor_optional_link: '참고 링크 (선택)',
      editor_text_mode_help: '링크가 없어도 제목과 메모만으로 저장할 수 있어요. 카드에는 텍스트형 대표 순간이 표시돼요.',
      editor_confirm_add_next_text: '이 메모 이어붙이기'
    }[key] || ''),
    hidePreview: () => { hidePreviewCalled = true; }
  });

  assert.equal(currentMode, 'text');
  assert.equal(refs.linkModeLabel.textContent, '영상·채널로 시작');
  assert.equal(refs.textModeLabel.textContent, '텍스트로 시작');
  assert.equal(refs.urlInput.placeholder, '링크는 나중에 붙여도 괜찮아요');
  assert.equal(refs.urlLabel.textContent, '참고 링크 (선택)');
  assert.equal(
    refs.supportNoteText.textContent,
    '링크가 없어도 제목과 메모만으로 저장할 수 있어요. 카드에는 텍스트형 대표 순간이 표시돼요.'
  );
  assert.equal(refs.confirmBtn.textContent, '이 메모 이어붙이기');
  assert.equal(refs.videoSegmentGrid.style.display, 'none');
  assert.equal(hidePreviewCalled, true);
});

test('copy-only slice does not add persistence or network behavior', () => {
  assert.match(modeSource, /영상·채널로 시작/);
  assert.match(modeSource, /YouTube 영상 또는 채널 링크/);
  assert.match(modeSource, /순간의 출처 미리보기/);
  assert.doesNotMatch(modeSource, /apiClient/);
  assert.doesNotMatch(modeSource, /fetch\s*\(/);
  assert.doesNotMatch(modeSource, /createMemory\s*\(/);
  assert.doesNotMatch(modeSource, /createYouTubeChannelSourceRecord/);
  assert.doesNotMatch(modeSource, /\.memory-node/);
});
