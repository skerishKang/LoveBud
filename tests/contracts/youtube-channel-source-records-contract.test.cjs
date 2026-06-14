const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const MEDIA_JS_PATH = path.join(ROOT, 'js/utils/media.js');
const mediaJs = fs.readFileSync(MEDIA_JS_PATH, 'utf8');

function loadMedia() {
  const sandbox = {
    window: {},
    URL,
    URLSearchParams
  };
  vm.runInNewContext(mediaJs, sandbox, { filename: 'media.js' });
  return sandbox.window.LoveBudMedia;
}

test('LoveBudMedia exposes YouTube channel source record helpers', () => {
  const media = loadMedia();

  assert.equal(typeof media.classifyYouTubeUrl, 'function');
  assert.equal(typeof media.isYouTubeChannelUrl, 'function');
  assert.equal(typeof media.createYouTubeChannelSourceRecord, 'function');
});

test('YouTube channel/profile URLs classify as channel source candidates', () => {
  const media = loadMedia();
  const cases = [
    ['https://www.youtube.com/@SomeChannel', '@SomeChannel'],
    ['https://www.youtube.com/channel/UCabcdef1234567890', 'UCabcdef1234567890'],
    ['https://www.youtube.com/c/SomeChannel', 'SomeChannel'],
    ['https://www.youtube.com/user/SomeChannel', 'SomeChannel']
  ];

  for (const [url, expectedId] of cases) {
    const classification = media.classifyYouTubeUrl(url);

    assert.equal(classification.kind, 'channel');
    assert.equal(classification.sourceType, 'channel');
    assert.equal(classification.provider, 'youtube');
    assert.equal(classification.channelInfo.channelId, expectedId);
    assert.equal(media.isYouTubeChannelUrl(url), true);
  }
});

test('YouTube video URLs stay video-backed moment candidates', () => {
  const media = loadMedia();
  const cases = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ'
  ];

  for (const url of cases) {
    const classification = media.classifyYouTubeUrl(url);

    assert.equal(classification.kind, 'video');
    assert.equal(classification.sourceType, 'youtube');
    assert.equal(classification.videoId, 'dQw4w9WgXcQ');
    assert.equal(media.isYouTubeChannelUrl(url), false);
    assert.equal(media.validateSourceUrl(url, 'youtube'), true);
  }
});

test('YouTube channel source record derives only safe URL fallback fields', () => {
  const media = loadMedia();

  const record = media.createYouTubeChannelSourceRecord('https://www.youtube.com/c/LoveBudOfficial');

  assert.equal(record.sourceType, 'channel');
  assert.equal(record.provider, 'youtube');
  assert.equal(record.source, 'YouTube');
  assert.equal(record.sourceUrl, 'https://www.youtube.com/c/LoveBudOfficial');
  assert.equal(record.sourceHandle, 'LoveBudOfficial');
  assert.equal(record.sourceTitle, 'LoveBudOfficial');
});

test('YouTube channel URLs do not validate as normal YouTube video source URLs', () => {
  const media = loadMedia();
  const url = 'https://www.youtube.com/@SomeChannel';

  assert.equal(media.validateSourceUrl(url, 'youtube'), false);
  assert.equal(media.detectSourceType(url), 'unknown');
  assert.equal(media.createYouTubeChannelSourceRecord('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('YouTube channel source helpers stay network-free and provider-free', () => {
  assert.doesNotMatch(mediaJs, /\bfetch\s*\(/);
  assert.doesNotMatch(mediaJs, /XMLHttpRequest/);
  assert.doesNotMatch(mediaJs, /googleapis|youtube\/v3|gapi/i);
  assert.doesNotMatch(mediaJs, /apiClient/);
});
